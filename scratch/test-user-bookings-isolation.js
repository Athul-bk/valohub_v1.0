const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING SECURE USER BOOKINGS ISOLATION TESTS ===\n');

  // 1. Test Unauthenticated Access
  console.log('--- TEST 1: Unauthenticated Access ---');
  try {
    await axios.get(`${BASE_URL}/api/user/bookings`);
    assert.fail('Expected 401 Unauthorized when no token provided');
  } catch (err) {
    assert.strictEqual(err.response?.status, 401, 'Should return 401 when no token provided');
    assert.strictEqual(err.response?.data?.error, 'UNAUTHORIZED');
    console.log('✓ Verified: 401 Unauthorized returned when no token provided');
  }

  // 2. Test Insecure Header Spoofing (x-user-email without token)
  console.log('\n--- TEST 2: Insecure Header Spoofing Rejection ---');
  try {
    await axios.get(`${BASE_URL}/api/user/bookings`, {
      headers: { 'x-user-email': 'bkathul0077@gmail.com' }
    });
    assert.fail('Expected 401 Unauthorized when unverified email header is passed');
  } catch (err) {
    assert.strictEqual(err.response?.status, 401, 'Should reject unverified header');
    console.log('✓ Verified: Unverified x-user-email header without Bearer token is rejected (401)');
  }

  // 3. Create/Obtain Sessions for User A and User B
  console.log('\n--- TEST 3: User Authentication & Session Generation ---');
  const userARes = await axios.post(`${BASE_URL}/api/user/session`, {
    email: 'bkathul0077@gmail.com',
    user: {
      id: 'USR_BKATHUL_001',
      name: 'Athul User A',
      email: 'bkathul0077@gmail.com',
      phone: '+91 9847055667'
    }
  });
  const tokenA = userARes.data.token;
  assert.ok(tokenA, 'User A token must exist');
  console.log('✓ User A session token generated:', tokenA.slice(0, 16) + '...');

  const userBRes = await axios.post(`${BASE_URL}/api/user/session`, {
    email: 'bkathul84@gmail.com',
    user: {
      id: 'USR_BKATHUL_002',
      name: 'Rider User B',
      email: 'bkathul84@gmail.com',
      phone: '+91 9162825676'
    }
  });
  const tokenB = userBRes.data.token;
  assert.ok(tokenB, 'User B token must exist');
  console.log('✓ User B session token generated:', tokenB.slice(0, 16) + '...');

  // 4. Verify User A strictly sees ONLY User A's bookings
  console.log('\n--- TEST 4: User A Data Isolation ---');
  const resA = await axios.get(`${BASE_URL}/api/user/bookings`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(resA.status, 200);
  assert.strictEqual(resA.data.success, true);
  const bookingsA = resA.data.purchases;
  console.log(`User A received ${bookingsA.length} booking(s):`, bookingsA.map(b => `${b.id} (user: ${b.userId})`));
  // Verify all bookings belong to User A
  bookingsA.forEach(b => {
    assert.strictEqual(b.userId, 'USR_BKATHUL_001', `Booking ${b.id} must belong to User A (USR_BKATHUL_001)`);
    assert.notStrictEqual(b.id, 'BK-SAMPLE-01', 'User A must NOT see User B booking BK-SAMPLE-01');
  });
  console.log('✓ Verified: User A strictly sees only User A bookings');

  // 5. Verify User B strictly sees ONLY User B's bookings
  console.log('\n--- TEST 5: User B Data Isolation ---');
  const resB = await axios.get(`${BASE_URL}/api/user/bookings`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.strictEqual(resB.status, 200);
  assert.strictEqual(resB.data.success, true);
  const bookingsB = resB.data.purchases;
  console.log(`User B received ${bookingsB.length} booking(s):`, bookingsB.map(b => `${b.id} (user: ${b.userId})`));
  // Verify all bookings belong to User B
  bookingsB.forEach(b => {
    assert.strictEqual(b.userId, 'USR_BKATHUL_002', `Booking ${b.id} must belong to User B (USR_BKATHUL_002)`);
    assert.notStrictEqual(b.id, 'VH-KZK-774912', 'User B must NOT see User A booking VH-KZK-774912');
  });
  console.log('✓ Verified: User B strictly sees only User B bookings');

  // 6. Test IDOR Protection (User A attempts ?userId=USR_BKATHUL_002)
  console.log('\n--- TEST 6: IDOR Protection (?userId spoofing) ---');
  try {
    await axios.get(`${BASE_URL}/api/user/bookings?userId=USR_BKATHUL_002`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.fail('Expected 403 Forbidden when attempting to query another user ID');
  } catch (err) {
    assert.strictEqual(err.response?.status, 403, 'Should return 403 Forbidden on IDOR attempt');
    assert.strictEqual(err.response?.data?.error, 'FORBIDDEN');
    console.log('✓ Verified: IDOR query parameter attempt rejected with 403 Forbidden');
  }

  // 7. Verify Route Aliases (/api/bookings and /bookings)
  console.log('\n--- TEST 7: Route Aliases (/api/bookings, /bookings) ---');
  const aliasRes1 = await axios.get(`${BASE_URL}/api/bookings`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(aliasRes1.status, 200);
  assert.strictEqual(aliasRes1.data.purchases.length, bookingsA.length);
  console.log('✓ Verified: /api/bookings returns identical isolated bookings');

  const aliasRes2 = await axios.get(`${BASE_URL}/bookings`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(aliasRes2.status, 200);
  assert.strictEqual(aliasRes2.data.purchases.length, bookingsA.length);
  console.log('✓ Verified: /bookings returns identical isolated bookings');

  console.log('\n=== ALL USER BOOKINGS ISOLATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  if (err.response) {
    console.error('Response data:', err.response.data);
  }
  process.exit(1);
});
