/**
 * test-email-auth.js
 * 
 * Verifies email-based login/signup flow:
 * 1. Sending OTP to email address (/send-otp)
 * 2. Security validation: zero OTP leakage in response
 * 3. Successful verification (/verify-otp)
 * 4. Error cases (wrong OTP, invalid email)
 */

const BASE_URL = 'http://127.0.0.1:3000';

async function testEmailAuth() {
  console.log('\n======================================================');
  console.log('  TESTING VALOHUB EMAIL VERIFICATION LOGIN FLOW');
  console.log('======================================================\n');

  const testEmail = 'rider.calicut@gmail.com';

  // 1. Send OTP to email
  console.log(`[Step 1] Requesting OTP for email: ${testEmail}...`);
  const sendRes = await fetch(`${BASE_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });

  const sendData = await sendRes.json();
  console.log('Send Status:', sendRes.status);
  console.log('Send Response:', sendData);

  if (sendRes.status !== 200 || !sendData.success) {
    throw new Error('Failed to send OTP to email: ' + JSON.stringify(sendData));
  }

  // Security check: ensure OTP is not in the response
  if (sendData.otp) {
    throw new Error('SECURITY BREACH: OTP exposed in client response!');
  }
  console.log('✓ Security Check: OTP is not leaked to frontend response.');

  // 2. Retrieve the active OTP from internal test endpoint
  const testOtpRes = await fetch(`${BASE_URL}/api/test/otp/${encodeURIComponent(testEmail)}`);
  const testOtpData = await testOtpRes.json();
  const validOtp = testOtpData.otp;
  console.log(`[Step 2] Retrieved OTP from Redis/Memory store for testing: ${validOtp}`);

  if (!validOtp || validOtp.length !== 6) {
    throw new Error('Invalid OTP retrieved from store: ' + validOtp);
  }

  // 3. Test Invalid OTP
  console.log('\n[Step 3] Testing rejection of incorrect OTP (000000)...');
  const wrongRes = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: '000000' })
  });
  const wrongData = await wrongRes.json();
  console.log('Wrong OTP Status:', wrongRes.status);
  if (wrongRes.status === 400 && !wrongData.success) {
    console.log('✓ Correctly rejected invalid OTP code.');
  } else {
    throw new Error('Failed: Server accepted invalid OTP!');
  }

  // 4. Test Valid OTP Verification
  console.log(`\n[Step 4] Verifying with correct OTP: ${validOtp}...`);
  const verifyRes = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: validOtp })
  });
  const verifyData = await verifyRes.json();
  console.log('Verify Status:', verifyRes.status);
  console.log('Verify Response:', verifyData);

  if (verifyRes.status !== 200 || !verifyData.success) {
    throw new Error('Failed to verify valid OTP: ' + JSON.stringify(verifyData));
  }
  console.log(`✓ Email verified successfully for: ${verifyData.email}`);

  // 5. Test Single-Use Consumption (Replaying same OTP should fail)
  console.log('\n[Step 5] Testing replay attack prevention (reusing consumed OTP)...');
  const replayRes = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: validOtp })
  });
  const replayData = await replayRes.json();
  if (replayRes.status === 400) {
    console.log('✓ Correctly rejected replayed OTP (Single-use consumption enforced).');
  } else {
    throw new Error('Failed: Server allowed OTP reuse!');
  }

  console.log('\n======================================================');
  console.log('  ALL EMAIL AUTHENTICATION TESTS PASSED 100%!         ');
  console.log('======================================================\n');
}

testEmailAuth().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
