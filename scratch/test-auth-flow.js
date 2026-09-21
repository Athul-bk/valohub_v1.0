const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING AUTH FLOW TESTS ---');

  // Test 1: Login with pre-seeded username & password
  console.log('Test 1: Login with username bkathul0077 & Password123!');
  const res1 = await postJson('/api/auth/login', {
    identifier: 'bkathul0077',
    password: 'Password123!'
  });
  console.log('Result 1:', res1.status, res1.data.success ? 'SUCCESS' : 'FAILED', res1.data.user ? res1.data.user.name : res1.data);
  if (res1.status !== 200 || !res1.data.token) throw new Error('Test 1 failed!');

  // Test 2: Login with pre-seeded email & password
  console.log('\nTest 2: Login with email bkathul0077@gmail.com & Password123!');
  const res2 = await postJson('/api/auth/login', {
    identifier: 'bkathul0077@gmail.com',
    password: 'Password123!'
  });
  console.log('Result 2:', res2.status, res2.data.success ? 'SUCCESS' : 'FAILED');
  if (res2.status !== 200) throw new Error('Test 2 failed!');

  // Test 3: Login with wrong password
  console.log('\nTest 3: Login with incorrect password');
  const res3 = await postJson('/api/auth/login', {
    identifier: 'bkathul0077',
    password: 'WrongPassword!'
  });
  console.log('Result 3:', res3.status, 'Message:', res3.data.message);
  if (res3.status !== 401) throw new Error('Test 3 failed! Expected 401.');

  // Test 4: Register new user
  const uniqueSuffix = Date.now().toString().slice(-4);
  const testUsername = `rahul_${uniqueSuffix}`;
  const testEmail = `rahul_${uniqueSuffix}@example.com`;
  console.log(`\nTest 4: Register new user ${testUsername} / ${testEmail}`);
  const res4 = await postJson('/api/auth/register', {
    name: 'Rahul Nair',
    username: testUsername,
    email: testEmail,
    phone: '+91 9876543210',
    password: 'RiderPassword123!'
  });
  console.log('Result 4:', res4.status, (res4.status === 201 || res4.status === 200) ? 'SUCCESS' : 'FAILED', res4.data.user ? res4.data.user.name : res4.data);
  if ((res4.status !== 201 && res4.status !== 200) || !res4.data.token) throw new Error('Test 4 failed!');

  // Test 5: Login with newly registered user
  console.log(`\nTest 5: Login with newly registered user ${testUsername}`);
  const res5 = await postJson('/api/auth/login', {
    identifier: testUsername,
    password: 'RiderPassword123!'
  });
  console.log('Result 5:', res5.status, res5.data.success ? 'SUCCESS' : 'FAILED');
  if (res5.status !== 200) throw new Error('Test 5 failed!');

  // Test 6: Forgot password flow
  console.log(`\nTest 6a: Request OTP for ${testEmail}`);
  const res6a = await postJson('/api/auth/forgot-password', {
    email: testEmail
  });
  console.log('Result 6a:', res6a.status, res6a.data.success ? 'SUCCESS' : 'FAILED', res6a.data.message);
  if (res6a.status !== 200) throw new Error('Test 6a failed!');

  // Fetch OTP via internal test endpoint
  const otpRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:3000/api/test/otp/reset_${testEmail}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  const otpToUse = otpRes.otp;
  console.log('OTP received from test endpoint:', otpToUse);

  console.log(`\nTest 6b: Reset password with OTP and new password NewPass123!`);
  const res6b = await postJson('/api/auth/reset-password', {
    email: testEmail,
    otp: otpToUse,
    newPassword: 'NewPass123!'
  });
  console.log('Result 6b:', res6b.status, res6b.data.success ? 'SUCCESS' : 'FAILED');
  if (res6b.status !== 200) throw new Error('Test 6b failed!');

  // Test 6c: Login with new password
  console.log(`\nTest 6c: Login with new password NewPass123!`);
  const res6c = await postJson('/api/auth/login', {
    identifier: testUsername,
    password: 'NewPass123!'
  });
  console.log('Result 6c:', res6c.status, res6c.data.success ? 'SUCCESS' : 'FAILED');
  if (res6c.status !== 200) throw new Error('Test 6c failed!');

  // Test 7: Logout
  console.log(`\nTest 7: Logout token`);
  const res7 = await postJson('/api/auth/logout', {
    token: res6c.data.token
  });
  console.log('Result 7:', res7.status, res7.data.success ? 'SUCCESS' : 'FAILED');
  if (res7.status !== 200) throw new Error('Test 7 failed!');

  console.log('\n>>> ALL 7 AUTH TESTS PASSED PERFECTLY! <<<');
}

runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
