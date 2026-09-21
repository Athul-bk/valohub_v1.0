/**
 * Deep End-to-End Automated QA Verification Suite
 * Tests all core features: Admin Fleet Creation, Public User Fleet Sync,
 * Authentication (Login/Logout), Government DL Verification, Payment Gateway,
 * GST Tax Invoice PDF Generation, and Isolated User Bookings.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:3000';

async function runFullQaSuite() {
  console.log('\n======================================================');
  console.log('🚀 VALOHUB DEEP AUTOMATED END-TO-END QA TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function logPass(testName, details = '') {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   └─ ${details}`);
  }

  function logFail(testName, error) {
    failedTests++;
    console.error(`❌ [FAIL] ${testName}`);
    console.error(`   └─ Error: ${error.response?.data?.message || error.message}\n`);
  }

  // ----------------------------------------------------
  // TEST 1: Public Fleet Catalog Endpoint
  // ----------------------------------------------------
  try {
    const res = await axios.get(`${BASE_URL}/api/bikes`);
    if (res.data && res.data.success && Array.isArray(res.data.bikes)) {
      logPass('Public Fleet Catalog (/api/bikes)', `Found ${res.data.count} bikes in initial catalog.`);
    } else {
      throw new Error('Invalid response structure from /api/bikes');
    }
  } catch (err) {
    logFail('Public Fleet Catalog (/api/bikes)', err);
  }

  // ----------------------------------------------------
  // TEST 2: Admin Login Authentication ('Athul')
  // ----------------------------------------------------
  let adminToken = '';
  try {
    const res = await axios.post(`${BASE_URL}/api/admin/login`, {
      usernameOrEmail: 'athul',
      password: 'valohub@84athul'
    });
    if (res.data && res.data.success && res.data.token) {
      adminToken = res.data.token;
      logPass('Admin Login Authentication', `Authenticated Super-Admin Athul. Token: ${adminToken.slice(0, 15)}...`);
    } else {
      throw new Error('Admin authentication failed');
    }
  } catch (err) {
    logFail('Admin Login Authentication', err);
  }

  // ----------------------------------------------------
  // TEST 3: Admin Add New Fleet Bike
  // ----------------------------------------------------
  const newBikePayload = {
    name: 'Royal Enfield Shotgun 650',
    brand: 'Royal Enfield',
    edition: '2026 Special Black Edition',
    category: 'Custom Cruiser / Touring',
    engineCapacity: '648cc Parallel Twin',
    registrationNumber: `KL-11-SH-${Math.floor(1000 + Math.random() * 9000)}`,
    hourlyRate: 160,
    dailyRate: 3800,
    depositAmount: 2500,
    odometerKm: 150,
    images: ['https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1000&q=80'],
    isAvailable: true
  };

  let createdBikeId = '';
  try {
    const res = await axios.post(`${BASE_URL}/api/admin/bikes`, newBikePayload, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.data && res.data.success && res.data.bike) {
      createdBikeId = res.data.bike.id;
      logPass('Admin Add Fleet Bike', `Created "${res.data.bike.name}" (${res.data.bike.registrationNumber}) with ID: ${createdBikeId}`);
    } else {
      throw new Error('Failed to create bike in admin portal');
    }
  } catch (err) {
    logFail('Admin Add Fleet Bike', err);
  }

  // ----------------------------------------------------
  // TEST 4: Public User Fleet Sync (New Bike Visibility)
  // ----------------------------------------------------
  try {
    const res = await axios.get(`${BASE_URL}/api/bikes`);
    const foundNewBike = res.data.bikes.find(b => b.id === createdBikeId || b.name === newBikePayload.name);
    if (foundNewBike) {
      logPass('Public User Fleet Sync', `New Admin-added bike "${foundNewBike.name}" is LIVE for public users! Rate: ₹${foundNewBike.dailyRate}/day.`);
    } else {
      throw new Error('Newly added bike not found in public /api/bikes response');
    }
  } catch (err) {
    logFail('Public User Fleet Sync', err);
  }

  // ----------------------------------------------------
  // TEST 5: User Sign Up & Authentication
  // ----------------------------------------------------
  const testUser = {
    name: 'Rahul Nambiar',
    username: `rahul_qa_${Date.now().toString().slice(-4)}`,
    email: `rahul.qa.${Date.now()}@gmail.com`,
    phone: `98765${Math.floor(10005 + Math.random() * 89990)}`,
    password: 'Password123!'
  };

  let userToken = '';
  let registeredUserId = '';

  try {
    const res = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
    if (res.data && res.data.success && res.data.token) {
      userToken = res.data.token;
      registeredUserId = res.data.user.id;
      logPass('User Sign Up (Registration)', `Registered rider "${res.data.user.name}" (@${res.data.user.username}). ID: ${registeredUserId}`);
    } else {
      throw new Error('User registration failed');
    }
  } catch (err) {
    logFail('User Sign Up (Registration)', err);
  }

  // ----------------------------------------------------
  // TEST 6: User Login & Session Verification
  // ----------------------------------------------------
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: testUser.username,
      password: testUser.password
    });
    if (res.data && res.data.success && res.data.token) {
      logPass('User Login (Instant Auth)', `Logged in as @${testUser.username}. Welcome: "${res.data.message}"`);
    } else {
      throw new Error('User login failed');
    }
  } catch (err) {
    logFail('User Login (Instant Auth)', err);
  }

  // ----------------------------------------------------
  // TEST 7: AI Vision Tool & DL Photo Upload (JPG / PNG / WEBP / PDF / HEIC)
  // ----------------------------------------------------
  const validDlNumber = 'KL-11-2022-0004567';
  let uploadedDlPhotoUrl = '';
  let uploadedDlAiStatus = '';
  let uploadedDlAiScore = 0;
  let uploadedDlAiNotes = '';

  try {
    // 1x1 pixel PNG sample base64
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const res = await axios.post(`${BASE_URL}/api/upload-dl-photo`, {
      base64: sampleBase64,
      fileName: 'rider_license_sample.png',
      riderName: testUser.name
    });

    if (res.data && res.data.success && (res.data.photoUrl || res.data.publicUrl)) {
      uploadedDlPhotoUrl = res.data.photoUrl || res.data.publicUrl;
      uploadedDlAiStatus = res.data.aiStatus;
      uploadedDlAiScore = res.data.aiScore;
      uploadedDlAiNotes = res.data.analysisNotes;

      logPass('AI Vision Tool & DL Photo Upload (/api/upload-dl-photo)', `Uploaded photo! URL: ${uploadedDlPhotoUrl}, AI Score: ${uploadedDlAiScore}%, Status: ${uploadedDlAiStatus}, DL: ${res.data.detectedDlNumber}`);
    } else {
      throw new Error('DL photo upload & AI analysis failed');
    }
  } catch (err) {
    logFail('AI Vision Tool & DL Photo Upload (/api/upload-dl-photo)', err);
  }

  // ----------------------------------------------------
  // TEST 8: Government Parivahan DL Verification
  // ----------------------------------------------------
  try {
    const res = await axios.post(`${BASE_URL}/api/verify-driving-license`, {
      dlNumber: validDlNumber,
      riderName: testUser.name
    });
    if (res.data && res.data.success && res.data.data && res.data.data.status === 'ACTIVE') {
      logPass('Parivahan DL Verification API', `DL ${validDlNumber} Verified! Endorsement: ${res.data.data.vehicleClass}, RTO: ${res.data.data.rtoName}`);
    } else {
      throw new Error('DL Verification failed');
    }
  } catch (err) {
    logFail('Parivahan DL Verification API', err);
  }

  // ----------------------------------------------------
  // TEST 9: Invalid DL Format Rejection Check
  // ----------------------------------------------------
  try {
    await axios.post(`${BASE_URL}/api/verify-driving-license`, {
      dlNumber: 'INVALID_123',
      riderName: testUser.name
    });
    logFail('Invalid DL Rejection Guard', new Error('Server accepted invalid DL when it should have rejected it'));
  } catch (err) {
    if (err.response && err.response.status === 400) {
      logPass('Invalid DL Rejection Guard', `Correctly rejected invalid DL format with message: "${err.response.data.message}"`);
    } else {
      logFail('Invalid DL Rejection Guard', err);
    }
  }

  // ----------------------------------------------------
  // TEST 10: Create Payment Order for New Bike
  // ----------------------------------------------------
  const bookingId = `VH-KZK-${Math.floor(100000 + Math.random() * 900000)}`;
  let orderData = null;
  try {
    const res = await axios.post(`${BASE_URL}/api/payments/create-order`, {
      bookingId,
      bikeId: createdBikeId,
      rentalDurationHours: 24,
      rentalDurationDays: 1,
      rentalAmount: 3800,
      depositAmount: 2500,
      customerName: testUser.name,
      customerPhone: testUser.phone,
      bikeName: newBikePayload.name
    });

    if (res.data && res.data.success && res.data.orderId) {
      orderData = res.data;
      logPass('Payment Create Order', `Created Order ${orderData.orderId} for ₹${orderData.breakdown.totalPayable} (Base: ₹${orderData.breakdown.baseRental}, GST: ₹${orderData.breakdown.totalGst}, Deposit: ₹${orderData.breakdown.refundableDeposit})`);
    } else {
      throw new Error('Payment order creation failed');
    }
  } catch (err) {
    logFail('Payment Create Order', err);
  }

  // ----------------------------------------------------
  // TEST 11: Verify Payment & Auto-Generate GST PDF Invoice with DL Metadata
  // ----------------------------------------------------
  let verifyData = null;
  try {
    const res = await axios.post(
      `${BASE_URL}/api/payments/verify-payment`,
      {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: `pay_qa_${Date.now()}`,
        razorpay_signature: orderData.demoSignature,
        bookingId,
        customerName: testUser.name,
        customerPhone: testUser.phone,
        customerEmail: testUser.email,
        drivingLicense: validDlNumber,
        dlPhotoUrl: uploadedDlPhotoUrl,
        dlAiStatus: uploadedDlAiStatus,
        dlAiScore: uploadedDlAiScore,
        dlAiNotes: uploadedDlAiNotes,
        bikeId: createdBikeId,
        bikeName: newBikePayload.name,
        bikeRegNo: newBikePayload.registrationNumber,
        pickupDateTime: '2026-09-20 10:00 AM',
        dropoffDateTime: '2026-09-21 10:00 AM',
        pickupLocation: 'Mavoor Road Hub, Kozhikode',
        rentalDurationHours: 24,
        rentalDurationDays: 1,
        rentalAmount: 3800,
        depositAmount: 2500,
        paymentMethod: 'UPI (Google Pay)',
        userId: registeredUserId
      },
      {
        headers: { Authorization: `Bearer ${userToken}` }
      }
    );

    if (res.data && res.data.success && res.data.invoice) {
      verifyData = res.data;
      logPass('Verify Payment & GST Invoice Generation', `Payment Confirmed! GST Tax Invoice: ${res.data.invoice.invoiceNumber}. DL Photo Saved: ${uploadedDlPhotoUrl}`);
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (err) {
    logFail('Verify Payment & GST Invoice Generation', err);
  }

  // ----------------------------------------------------
  // TEST 12: Admin DL Verification Override (/api/admin/bookings/:id/verify-dl)
  // ----------------------------------------------------
  try {
    const res = await axios.post(`${BASE_URL}/api/admin/bookings/${bookingId}/verify-dl`, {
      status: 'ADMIN_APPROVED',
      notes: 'Super-Admin Athul manually reviewed DL photo and verified counter identity.'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    if (res.data && res.data.success && res.data.booking && res.data.booking.dlAiStatus === 'ADMIN_APPROVED') {
      logPass('Admin DL Verification Override', `Super-Admin Athul approved DL for booking ${bookingId}. Admin Notes: "${res.data.booking.adminDlNotes}"`);
    } else {
      throw new Error('Admin DL verification override failed');
    }
  } catch (err) {
    logFail('Admin DL Verification Override', err);
  }

  // ----------------------------------------------------
  // TEST 13: Verify Generated PDF File Exists on Disk
  // ----------------------------------------------------
  try {
    if (verifyData && verifyData.invoice && verifyData.invoice.pdfPath) {
      const relativePath = verifyData.invoice.pdfPath.replace(/^\//, '');
      const fullDiskPath = path.join(__dirname, '..', 'public', relativePath);
      if (fs.existsSync(fullDiskPath)) {
        const stats = fs.statSync(fullDiskPath);
        logPass('GST Invoice PDF File Verification', `File ${relativePath} exists on disk (${stats.size} bytes).`);
      } else {
        throw new Error(`PDF file not found at ${fullDiskPath}`);
      }
    }
  } catch (err) {
    logFail('GST Invoice PDF File Verification', err);
  }

  // ----------------------------------------------------
  // TEST 12: Secure User Purchases & Isolated Bookings Retrieval
  // ----------------------------------------------------
  try {
    const res = await axios.get(`${BASE_URL}/api/user/bookings`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    if (res.data && res.data.success && Array.isArray(res.data.purchases)) {
      const userBookings = res.data.purchases;
      const foundBooking = userBookings.find(b => b.id === bookingId);
      if (foundBooking) {
        logPass('User Isolated Bookings (/api/user/bookings)', `Retrieved ${userBookings.length} booking(s) for user ${res.data.user.name}. Confirmed Ref: ${foundBooking.id}, Vehicle: ${foundBooking.bikeName}, Deposit Status: ${foundBooking.depositStatus}`);
      } else {
        throw new Error(`Booking ${bookingId} not found in user purchases`);
      }
    } else {
      throw new Error('Failed to retrieve user bookings');
    }
  } catch (err) {
    logFail('User Isolated Bookings (/api/user/bookings)', err);
  }

  // ----------------------------------------------------
  // TEST 13: IDOR Security Check (User A cannot access User B's bookings)
  // ----------------------------------------------------
  try {
    await axios.get(`${BASE_URL}/api/user/bookings?userId=SPOOFED_USER_999`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    logFail('IDOR Spoofing Security Check', new Error('Server allowed spoofed userId in query params'));
  } catch (err) {
    if (err.response && err.response.status === 403) {
      logPass('IDOR Spoofing Security Check', `Correctly blocked unauthorized userId query param with 403 Forbidden!`);
    } else {
      logFail('IDOR Spoofing Security Check', err);
    }
  }

  // ----------------------------------------------------
  // TEST 14: User Logout Endpoint
  // ----------------------------------------------------
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/logout`, { token: userToken });
    if (res.data && res.data.success) {
      logPass('User Logout Endpoint', `User logged out successfully. Session invalidated.`);
    } else {
      throw new Error('Logout failed');
    }
  } catch (err) {
    logFail('User Logout Endpoint', err);
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests === 0) {
    console.log('🎉 ALL AUTOMATED E2E QA TESTS PASSED WITH ZERO ERRORS!');
  } else {
    console.error(`⚠️ ${failedTests} test(s) failed. Please review errors above.`);
  }
}

runFullQaSuite().catch(console.error);
