/**
 * services/redisService.js
 * 
 * High-performance Redis service with:
 * - 5-minute TTL OTP lifecycle management
 * - Sliding-window / Counter rate limiting (max 3 SMS requests per hour per phone number)
 * - Automatic in-memory fallback if Redis daemon is not running locally
 */

const Redis = require('ioredis');

// Environment configurations
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient = null;
let isRedisConnected = false;

// In-Memory fallback store for environments without a local Redis instance
const memoryStore = new Map();
const memoryRateLimits = new Map();

try {
    redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 2) {
                // Stop retrying quickly to avoid blocking startup
                return null;
            }
            return 500;
        },
        lazyConnect: true
    });

    redisClient.connect().then(() => {
        isRedisConnected = true;
        console.log(`[Redis] Connected successfully to ${REDIS_HOST}:${REDIS_PORT}`);
    }).catch((err) => {
        isRedisConnected = false;
        console.warn(`[Redis] Local Redis server unavailable (${err.message}). Using resilient In-Memory Store for OTPs & Rate Limiting.`);
    });

    redisClient.on('error', (err) => {
        isRedisConnected = false;
    });
} catch (e) {
    isRedisConnected = false;
    console.warn(`[Redis] Failed to initialize Redis client. Falling back to in-memory store.`);
}

/**
 * Save OTP with Expiration TTL (Default 300s = 5 minutes)
 * Key format: otp:<phone>
 */
async function saveOtp(phone, otp, ttlSeconds = 300) {
    const key = `otp:${phone}`;

    if (isRedisConnected && redisClient) {
        try {
            await redisClient.setex(key, ttlSeconds, otp);
            return true;
        } catch (e) {
            console.error('[Redis Error] setex failed, saving to memory fallback:', e.message);
        }
    }

    // In-memory fallback with TTL
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    memoryStore.set(key, { otp, expiresAt });
    return true;
}

/**
 * Get current active OTP for a phone number
 */
async function getOtp(phone) {
    const key = `otp:${phone}`;

    if (isRedisConnected && redisClient) {
        try {
            return await redisClient.get(key);
        } catch (e) {
            console.error('[Redis Error] get failed:', e.message);
        }
    }

    const item = memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
        memoryStore.delete(key);
        return null;
    }
    return item.otp;
}

// Track failed attempts in-memory or Redis
const attemptsStore = new Map();

/**
 * Verify and delete OTP (Single-use consumption + 3-attempt lockout)
 */
async function verifyAndConsumeOtp(phone, inputOtp) {
    const attemptsKey = `attempts:${phone}`;
    let attempts = attemptsStore.get(attemptsKey) || 0;

    const storedOtp = await getOtp(phone);
    if (!storedOtp) {
        attemptsStore.delete(attemptsKey);
        return { valid: false, reason: 'OTP expired or not found. Please request a new OTP.' };
    }

    if (String(storedOtp).trim() !== String(inputOtp).trim()) {
        attempts++;
        attemptsStore.set(attemptsKey, attempts);

        if (attempts >= 3) {
            // Lock attempt and delete OTP to prevent brute-force attacks
            await deleteOtp(phone);
            attemptsStore.delete(attemptsKey);
            return {
                valid: false,
                reason: 'Maximum verification attempts exceeded (3/3). OTP has been locked and invalidated. Please request a fresh OTP.'
            };
        }

        return {
            valid: false,
            reason: `Invalid OTP code entered. Attempt ${attempts} of 3.`
        };
    }

    // Valid OTP -> Delete OTP immediately to prevent replay attacks
    await deleteOtp(phone);
    attemptsStore.delete(attemptsKey);
    return { valid: true };
}

/**
 * Delete OTP
 */
async function deleteOtp(phone) {
    const key = `otp:${phone}`;
    if (isRedisConnected && redisClient) {
        try {
            await redisClient.del(key);
        } catch (e) {
            console.error('[Redis Error] del failed:', e.message);
        }
    }
    memoryStore.delete(key);
}

/**
 * Rate Limiting for SMS Requests:
 * Max 3 requests per hour (3600 seconds) per phone number
 * Prevents SMS spamming and reduces gateway costs.
 */
async function checkRateLimit(phone, maxRequests = 3, windowSeconds = 3600) {
    const key = `ratelimit:sms:${phone}`;

    if (isRedisConnected && redisClient) {
        try {
            const current = await redisClient.incr(key);
            if (current === 1) {
                await redisClient.expire(key, windowSeconds);
            }
            const ttl = await redisClient.ttl(key);

            if (current > maxRequests) {
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                };
            }

            return {
                allowed: true,
                remaining: maxRequests - current,
                retryAfterSeconds: 0
            };
        } catch (e) {
            console.error('[Redis Error] Rate limit check failed, using memory fallback:', e.message);
        }
    }

    // In-memory rate limiting fallback
    const now = Date.now();
    let record = memoryRateLimits.get(key);

    if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + (windowSeconds * 1000) };
        memoryRateLimits.set(key, record);
        return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (record.count >= maxRequests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
        return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    record.count += 1;
    return {
        allowed: true,
        remaining: maxRequests - record.count,
        retryAfterSeconds: 0
    };
}

module.exports = {
    saveOtp,
    getOtp,
    verifyAndConsumeOtp,
    deleteOtp,
    checkRateLimit,
    isRedisConnected: () => isRedisConnected
};
