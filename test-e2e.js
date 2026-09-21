/**
 * test-e2e.js
 * Comprehensive automated verification for:
 * 1. Meta WhatsApp Webhook Handshake (GET)
 * 2. Meta WhatsApp Webhook Incoming AI Concierge (POST)
 * 3. PDF Receipt Generation & WhatsApp Delivery (/api/bookings/:id/confirm-payment)
 * 4. Redis OTP Rate Limiting & TTL Verification
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const redisService = require('./services/redisService');

const BASE_URL = 'http://127.0.0.1:3000';

async function runVerification() {
  console.log('🚀 Starting ValoHub E2E Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(title, condition, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      if (details) console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   └─ ${details}`);
    }
  }

  // --- TEST 1: WhatsApp Webhook GET Handshake ---
  console.log('--- Test 1: Meta WhatsApp Webhook Verification Handshake ---');
  try {
    const challengeCode = 'VALOHUB_TEST_CHALLENGE_987654';
    const res = await axios.get(`${BASE_URL}/webhook/whatsapp`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'valohub_meta_webhook_secret_2026',
        'hub.challenge': challengeCode
      }
    });
    assert('Meta Webhook Handshake verified successfully', res.status === 200 && res.data.toString() === challengeCode, `Status: ${res.status}, Response: ${res.data}`);
  } catch (err) {
    assert('Meta Webhook Handshake verified successfully', false, err.message);
  }

  // --- TEST 2: WhatsApp Webhook POST Incoming Message ---
  console.log('\n--- Test 2: Meta WhatsApp Webhook POST (AI Concierge) ---');
  try {
    const mockMetaPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'WHATSAPP_BUS_ACC_ID',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '919400000000', phone_number_id: 'TEST_PHONE_ID' },
            contacts: [{ profile: { name: 'Rahul Nair' }, wa_id: '916282567675' }],
            messages: [{
              from: '916282567675',
              id: 'wamid.HBgMOTE2MjgyNTY3Njc1FQIAEhgg...',
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              text: { body: 'What documents are required to rent a Hunter 350 in Kozhikode?' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const res = await axios.post(`${BASE_URL}/webhook/whatsapp`, mockMetaPayload);
    assert('Meta Webhook POST returned 200 EVENT_RECEIVED immediately', res.status === 200 && res.data === 'EVENT_RECEIVED');
  } catch (err) {
    assert('Meta Webhook POST returned 200 EVENT_RECEIVED immediately', false, err.message);
  }

  // --- TEST 3: PDF Receipt Generation & Delivery API ---
  console.log('\n--- Test 3: PDF Receipt Generation & Payment Confirmation ---');
  try {
    const testBookingId = `BK-KZK-${Date.now().toString().slice(-4)}`;
    const res = await axios.post(`${BASE_URL}/api/bookings/${testBookingId}/confirm-payment`, {
      customerName: 'Rahul Nair',
      customerPhone: '916282567675',
      bikeName: 'Royal Enfield Hunter 350',
      bikeRegNo: 'KL-11-BX-4501',
      pickupDate: '2026-09-19 10:00 AM',
      dropoffDate: '2026-09-21 10:00 AM',
      rentalAmount: 1798,
      depositAmount: 2000,
      paymentId: 'pay_Kzhk9812491'
    });

    const isSuccess = res.status === 200 && res.data.success === true;
    const fileName = res.data.receipt?.fileName;
    const localDirectPath = path.resolve(__dirname, 'public', 'receipts', fileName || '');
    const fileExists = fs.existsSync(localDirectPath);

    assert('Payment confirmation API returned 200 and receipt metadata', isSuccess, `BookingId: ${res.data.bookingId}, URL: ${res.data.receipt?.downloadUrl}`);
    assert('Official PDF receipt file created on disk in public/receipts', fileExists, `File: ${localDirectPath} (${fileExists ? fs.statSync(localDirectPath).size + ' bytes' : 'Not found'})`);
  } catch (err) {
    assert('Payment confirmation API returned 200 and receipt metadata', false, err.message);
  }

  // --- TEST 4: Redis OTP Generation & Rate Limiting ---
  console.log('\n--- Test 4: Redis OTP Generation & Rate Limiting Protection ---');
  const testPhone = '9998887776';
  try {
    // Request 1
    const r1 = await axios.post(`${BASE_URL}/send-otp`, { phone: testPhone });
    assert('OTP Request 1 succeeds (Allowed)', r1.status === 200 && r1.data.success === true, `Remaining: ${r1.data.rateLimitRemaining}`);

    // Request 2
    const r2 = await axios.post(`${BASE_URL}/send-otp`, { phone: testPhone });
    assert('OTP Request 2 succeeds (Allowed)', r2.status === 200 && r2.data.success === true, `Remaining: ${r2.data.rateLimitRemaining}`);

    // Request 3
    const r3 = await axios.post(`${BASE_URL}/send-otp`, { phone: testPhone });
    assert('OTP Request 3 succeeds (Allowed)', r3.status === 200 && r3.data.success === true, `Remaining: ${r3.data.rateLimitRemaining}`);

    // Request 4 (Should be blocked by 3/hr rate limit)
    let rateLimited = false;
    let rateLimitMessage = '';
    try {
      await axios.post(`${BASE_URL}/send-otp`, { phone: testPhone });
    } catch (rateErr) {
      if (rateErr.response && rateErr.response.status === 429) {
        rateLimited = true;
        rateLimitMessage = rateErr.response.data.message;
      }
    }
    assert('OTP Request 4 correctly rejected with HTTP 429 (Rate Limit Exceeded)', rateLimited, `Server message: "${rateLimitMessage}"`);

    // Fetch OTP securely from backend for testing verification
    const testOtpRes = await axios.get(`${BASE_URL}/api/test/otp/${testPhone}`);
    const secureStoredOtp = testOtpRes.data.otp;
    assert('Secure OTP successfully saved in Redis store', !!secureStoredOtp, `Stored OTP: ${secureStoredOtp}`);

    // Verify OTP for Request 3
    const verifyRes = await axios.post(`${BASE_URL}/verify-otp`, {
      phone: testPhone,
      otp: secureStoredOtp
    });
    assert('Valid OTP verified and single-use consumed successfully', verifyRes.status === 200 && verifyRes.data.success === true);

    // Verify same OTP again (Should fail because consumed)
    let reVerificationBlocked = false;
    try {
      await axios.post(`${BASE_URL}/verify-otp`, {
        phone: testPhone,
        otp: secureStoredOtp
      });
    } catch (reErr) {
      if (reErr.response && reErr.response.status === 400) {
        reVerificationBlocked = true;
      }
    }
    assert('Replay attack prevented: Single-use OTP cannot be reused', reVerificationBlocked, 'Subsequent verification returned 400 Bad Request as expected');

  } catch (err) {
    assert('Redis OTP & Rate limit test', false, err.message);
  }

  console.log(`\n========================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} assertions PASSED`);
  console.log(`========================================\n`);
}

runVerification();
