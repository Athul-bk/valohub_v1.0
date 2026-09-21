# ValoHub One-Time Password (OTP) Engine (`otp.md`)

## 1. Engine Specifications & Lifecycle
The OTP Engine manages one-time authentication tokens with strict security boundaries, preventing replay attacks, brute-force guessing, and denial-of-service spam.

---

## 2. API Endpoints

### 1. `POST /send-otp`
- **Request Body**:
  ```json
  { "email": "rider@gmail.com" }
  ```
  *(or `{ "phone": "6282567675" }` for phone fallback)*
- **Processing Logic**:
  1. Validates email regex / 10-digit phone.
  2. Queries Redis rate-limiter: Max 5 requests/hr per email (or 3/hr per phone).
  3. Generates a secure, cryptographically random 6-digit numeric string.
  4. Stores in Redis with 300s (5-minute) TTL: `otp:<identifier>`.
  5. Dispatches code via configured channel (live Gmail SMTP service / Fast2SMS / WhatsApp API).
- **Response**:
  ```json
  {
    "success": true,
    "message": "Verification code sent to rider@gmail.com",
    "email": "rider@gmail.com",
    "expiresInSeconds": 300,
    "rateLimitRemaining": 4,
    "channel": "EMAIL_LIVE"
  }
  ```

### 2. `POST /verify-otp`
- **Request Body**:
  ```json
  {
    "email": "rider@gmail.com",
    "otp": "236685"
  }
  ```
- **Processing Logic**:
  1. Retrieves active OTP from Redis.
  2. If expired or non-existent: returns `400 Bad Request` (`"OTP expired or not found. Please request a new OTP."`).
  3. If incorrect: increments failure counter. If 3 failures occur, deletes OTP and returns `"Maximum verification attempts exceeded (3/3). OTP has been locked and invalidated."`
  4. If correct: **immediately deletes** the OTP (`redis.del('otp:<identifier>')`), invalidating it for single-use consumption.
  5. Returns verified rider object.

---

## 3. Storage Architecture: Redis + In-Memory Fallback
- **Primary**: High-throughput Redis server on `localhost:6379`.
- **Resilient Fallback**: Automatic seamless in-memory store with `Map` and `setTimeout` cleanup if Redis server is temporarily unreachable, ensuring 100% zero-downtime uptime for local development.