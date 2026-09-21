/**
 * scratch/test-admin-dbms.js
 * Comprehensive validation suite for ValoHub DBMS & Admin Operations Subsystem
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3000';
let adminToken = '';
let testBikeId = '';
let testBookingId = '';

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 VALOHUB COMPREHENSIVE DBMS & ADMIN SUBSYSTEM TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`⏳ ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error(`   Error: ${err.response?.data?.message || err.message}`);
      failed++;
    }
  }

  // 1. ROUTE OBFUSCATION & HONEYPOT
  await test('Honeypot: GET /admin returns 404', async () => {
    try {
      await axios.get(`${BASE_URL}/admin`);
      throw new Error('Expected 404 for /admin');
    } catch (err) {
      if (err.response && err.response.status === 404) return;
      throw err;
    }
  });

  await test('Honeypot: GET /admin.html returns 404', async () => {
    try {
      await axios.get(`${BASE_URL}/admin.html`);
      throw new Error('Expected 404 for /admin.html');
    } catch (err) {
      if (err.response && err.response.status === 404) return;
      throw err;
    }
  });

  await test('Secret Route: GET /secure-portal-auth-xyz returns 200 HTML', async () => {
    const res = await axios.get(`${BASE_URL}/secure-portal-auth-xyz`);
    if (res.status !== 200 || !res.data.includes('VALOHUB')) {
      throw new Error('Secret portal did not return expected HTML');
    }
  });

  // 2. SINGLE-ADMIN AUTHENTICATION
  await test('Auth: Reject non-Athul admin username', async () => {
    try {
      await axios.post(`${BASE_URL}/api/admin/login`, {
        usernameOrEmail: 'attacker',
        password: 'valohub@84athul'
      });
      throw new Error('Expected rejection for non-Athul user');
    } catch (err) {
      if (err.response && err.response.status === 401) return;
      throw err;
    }
  });

  await test('Auth: Reject Athul with incorrect password', async () => {
    try {
      await axios.post(`${BASE_URL}/api/admin/login`, {
        usernameOrEmail: 'athul',
        password: 'wrong_password_999'
      });
      throw new Error('Expected rejection for wrong password');
    } catch (err) {
      if (err.response && err.response.status === 401) return;
      throw err;
    }
  });

  await test('Auth: Authenticate super-admin Athul by username', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/login`, {
      usernameOrEmail: 'athul',
      password: 'valohub@84athul'
    });
    if (!res.data.success || !res.data.token) {
      throw new Error('Login failed for Athul');
    }
    adminToken = res.data.token;
  });

  await test('Auth: Verify token heartbeat (/api/admin/verify)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.data.success || res.data.admin.username !== 'athul') {
      throw new Error('Verify failed or returned incorrect admin');
    }
  });

  // 3. FLEET INVENTORY CRUD & MILEAGE
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${adminToken}` } });

  await test('Fleet: Fetch all bikes (GET /api/admin/bikes)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/bikes`, authHeaders());
    if (!res.data.success || !Array.isArray(res.data.bikes)) {
      throw new Error('Failed to retrieve bikes list');
    }
  });

  await test('Fleet: Add new vehicle (POST /api/admin/bikes)', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/bikes`, {
      name: 'Royal Enfield Shotgun 650 Test Edition',
      brand: 'Royal Enfield',
      edition: 'Custom Test Edition',
      category: 'Bobber / Cruiser',
      registrationNumber: `KL-11-TEST-${Date.now().toString().slice(-4)}`,
      hourlyRate: 150,
      dailyRate: 1500,
      depositAmount: 2000,
      odometerKm: 1000,
      isAvailable: true
    }, authHeaders());

    if (!res.data.success || !res.data.bike?.id) {
      throw new Error('Failed to add new vehicle');
    }
    testBikeId = res.data.bike.id;
  });

  await test('Fleet: Toggle availability (PUT /api/admin/bikes/:id)', async () => {
    const res = await axios.put(`${BASE_URL}/api/admin/bikes/${testBikeId}`, {
      isAvailable: false
    }, authHeaders());
    if (!res.data.success || res.data.bike.isAvailable !== false) {
      throw new Error('Failed to toggle availability to false');
    }
  });

  await test('Fleet: Mileage update with service threshold alert (>= 3,000 km)', async () => {
    // Current is 1000 km, lastService is 1000 km. Setting to 4500 km -> 3500 km driven >= 3000 -> alert!
    const res = await axios.post(`${BASE_URL}/api/admin/bikes/${testBikeId}/odometer`, {
      odometerKm: 4500
    }, authHeaders());
    if (!res.data.success || !res.data.maintenanceAlert) {
      throw new Error('Expected maintenance alert when threshold exceeded');
    }
  });

  await test('Fleet: Mark serviced resets maintenance alert', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/bikes/${testBikeId}/service`, {}, authHeaders());
    if (!res.data.success || res.data.bike.isMaintenanceRequired !== false) {
      throw new Error('Maintenance alert was not cleared on service');
    }
  });

  // 4. BOOKINGS & DEPOSIT/DAMAGE MANAGEMENT
  await test('Bookings: Create new booking (POST /api/admin/bookings)', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/bookings`, {
      customerName: 'Rohit Sharma',
      customerPhone: '9847012345',
      customerEmail: 'rohit.test@gmail.com',
      bikeId: testBikeId,
      baseAmount: 1500,
      depositAmount: 2000
    }, authHeaders());
    if (!res.data.success || !res.data.booking?.id) {
      throw new Error('Failed to create booking');
    }
    testBookingId = res.data.booking.id;
  });

  await test('Deposit: Deduct damage amount & calculate net refund', async () => {
    // Deposit is 2000, damage is 600 -> net refund 1400
    const res = await axios.post(`${BASE_URL}/api/admin/bookings/${testBookingId}/deposit-action`, {
      action: 'DEDUCT_DAMAGE',
      damageAmount: 600,
      damageNotes: 'Scratched headlight guard'
    }, authHeaders());
    if (!res.data.success || res.data.netRefund !== 1400 || res.data.booking.damageAmount !== 600) {
      throw new Error(`Net refund mismatch: expected 1400, got ${res.data.netRefund}`);
    }
  });

  await test('Deposit: Full refund action', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/bookings/${testBookingId}/deposit-action`, {
      action: 'REFUND_FULL'
    }, authHeaders());
    if (!res.data.success || res.data.booking.depositStatus !== 'REFUNDED' || res.data.booking.refundedDeposit !== 2000) {
      throw new Error('Failed to process full refund');
    }
  });

  // 5. LIVE FINANCIALS & UTILIZATION
  await test('Financials: Live stats & fleet utilization rate (GET /api/admin/stats)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/stats`, authHeaders());
    if (!res.data.success || res.data.stats.utilizationRate === undefined) {
      throw new Error('Stats did not return utilizationRate');
    }
  });

  await test('Financials: Payment transactions table (GET /api/admin/payments)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/payments`, authHeaders());
    if (!res.data.success || !Array.isArray(res.data.payments)) {
      throw new Error('Failed to fetch payments');
    }
  });

  // 6. NOTIFICATION STATUS CONTROL
  let testNotifId = '';
  await test('Notifications: Fetch notification logs (GET /api/admin/notifications)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/notifications`, authHeaders());
    if (!res.data.success || res.data.notifications.length === 0) {
      throw new Error('Failed to fetch notifications');
    }
    testNotifId = res.data.notifications[0].id;
  });

  await test('Notifications: Manual status override (PUT /api/admin/notifications/:id/status)', async () => {
    const res = await axios.put(`${BASE_URL}/api/admin/notifications/${testNotifId}/status`, {
      status: 'DELIVERED'
    }, authHeaders());
    if (!res.data.success || res.data.notification.status !== 'DELIVERED') {
      throw new Error('Failed to manually override notification status');
    }
  });

  await test('Notifications: Trigger resend (POST /api/admin/notifications/:id/resend)', async () => {
    const res = await axios.post(`${BASE_URL}/api/admin/notifications/${testNotifId}/resend`, {}, authHeaders());
    if (!res.data.success) {
      throw new Error('Failed to trigger notification resend');
    }
  });

  // 7. CSV DATA EXPORT
  await test('Export: Payments CSV export (GET /api/admin/export/payments.csv)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/export/payments.csv`, authHeaders());
    if (res.status !== 200 || !res.data.includes('Payment ID')) {
      throw new Error('Payments CSV export failed');
    }
  });

  await test('Export: Bookings CSV export (GET /api/admin/export/bookings.csv)', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/export/bookings.csv`, authHeaders());
    if (res.status !== 200 || !res.data.includes('Booking Ref')) {
      throw new Error('Bookings CSV export failed');
    }
  });

  // Clean up test bike
  if (testBikeId) {
    try {
      await axios.delete(`${BASE_URL}/api/admin/bikes/${testBikeId}`, authHeaders());
    } catch (e) {}
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
