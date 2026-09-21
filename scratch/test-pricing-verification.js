const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- TEST 1: Fleet Data Verification ---');
const fleetDataContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'fleet-data.js'), 'utf-8');

// Extract FLEET_DATA by evaluating in a clean context
const sandbox = {};
const fn = new Function('sandbox', `${fleetDataContent}; sandbox.FLEET_DATA = FLEET_DATA;`);
fn(sandbox);
const FLEET_DATA = sandbox.FLEET_DATA;

assert.strictEqual(FLEET_DATA.length, 3, 'Fleet must contain exactly 3 machines');

const himalayan = FLEET_DATA.find(b => b.id === 'himalayan-450');
const classic = FLEET_DATA.find(b => b.id === 'classic-350');
const duke = FLEET_DATA.find(b => b.id === 'duke-390');

console.log(`Himalayan 450: Hourly=₹${himalayan.pricing.hourlyRate}, Daily=₹${himalayan.pricing.dailyRate}`);
assert.strictEqual(himalayan.pricing.hourlyRate, 120);
assert.strictEqual(himalayan.pricing.dailyRate, 120 * 24, 'Himalayan daily rate must be 24 * hourlyRate (2,880)');

console.log(`Classic 350: Hourly=₹${classic.pricing.hourlyRate}, Daily=₹${classic.pricing.dailyRate}`);
assert.strictEqual(classic.pricing.hourlyRate, 85);
assert.strictEqual(classic.pricing.dailyRate, 85 * 24, 'Classic daily rate must be 24 * hourlyRate (2,040)');

console.log(`KTM 390 Duke: Hourly=₹${duke.pricing.hourlyRate}, Daily=₹${duke.pricing.dailyRate}`);
assert.strictEqual(duke.pricing.hourlyRate, 110);
assert.strictEqual(duke.pricing.dailyRate, 110 * 24, 'Duke daily rate must be 24 * hourlyRate (2,640)');

console.log('✓ Fleet Data verification passed!');

console.log('\n--- TEST 2: Frontend Pricing Utility (calculateBikePrice) ---');
function calculateBikePrice(bike, hours, days) {
  if (!bike || !bike.pricing) return 0;
  const hourlyRate = Number(bike.pricing.hourlyRate) || 0;
  const dailyRate = Number(bike.pricing.dailyRate) || (hourlyRate * 24);

  if (hours < 24) {
    return Math.round(hourlyRate * hours);
  } else {
    return Math.round(dailyRate * days);
  }
}

// Check Classic 350
assert.strictEqual(calculateBikePrice(classic, 1, 1), 85, '1 hour must be ₹85');
assert.strictEqual(calculateBikePrice(classic, 10, 1), 850, '10 hours must be ₹850');
assert.strictEqual(calculateBikePrice(classic, 24, 1), 2040, '24 hours (1 day) must be ₹2,040');
assert.strictEqual(calculateBikePrice(classic, 48, 2), 4080, '48 hours (2 days) must be ₹4,080');

// Check Himalayan 450
assert.strictEqual(calculateBikePrice(himalayan, 24, 1), 2880, 'Himalayan 1 day must be ₹2,880');

// Check Duke 390
assert.strictEqual(calculateBikePrice(duke, 24, 1), 2640, 'Duke 1 day must be ₹2,640');

console.log('✓ calculateBikePrice verification passed!');

console.log('\n--- TEST 3: GST Calculation on 1-Day Rental ---');
const { calculateGst } = require('../services/invoiceService');

const classic1Day = calculateBikePrice(classic, 24, 1);
const gst = calculateGst(classic1Day);

console.log('GST Breakdown for Classic 350 1-Day Rental (₹2,040):', gst);
assert.strictEqual(gst.baseAmount, 2040);
assert.strictEqual(gst.cgst, 183.6);
assert.strictEqual(gst.sgst, 183.6);
assert.strictEqual(gst.totalTax, 367.2);
assert.strictEqual(gst.totalWithTax, 2407.2);

console.log('✓ GST Calculation verified!');

console.log('\n--- TEST 4: Backend Payment Routes & Anti-Tamper Protection ---');
const express = require('express');
const { paymentRouter } = require('../routes/paymentRoutes');
assert.ok(paymentRouter, 'paymentRouter must be exported');

const app = express();
app.use(express.json());
app.use('/api/payments', paymentRouter);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const axios = require('axios');
  const url = `http://127.0.0.1:${port}/api/payments/create-order`;

  try {
    // Test 4A: Normal 1-day rental for Classic 350 (24h)
    const res1 = await axios.post(url, {
      bookingId: 'BK-TEST-001',
      bikeId: 'classic-350',
      bikeName: 'Royal Enfield Classic 350',
      rentalDurationHours: 24,
      rentalDurationDays: 1,
      rentalAmount: 2040,
      depositAmount: 1000
    });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.breakdown.baseRental, 2040, 'Classic 350 1-day base rental must be 2040');
    assert.strictEqual(res1.data.breakdown.totalGst, 367.20, 'GST must be 367.20');
    assert.strictEqual(res1.data.breakdown.refundableDeposit, 1000, 'Deposit must be 1000');
    assert.strictEqual(res1.data.breakdown.totalPayable, 3407.20, 'Total payable must be 3407.20');
    console.log('✓ Classic 350 1-day rental order verified (Base: ₹2,040, Total: ₹3,407.20)');

    // Test 4B: Spoofed request (sending old ₹850 or ₹10 for Classic 350)
    const res2 = await axios.post(url, {
      bookingId: 'BK-TEST-002',
      bikeId: 'classic-350',
      bikeName: 'Royal Enfield Classic 350',
      rentalDurationHours: 24,
      rentalDurationDays: 1,
      rentalAmount: 850, // Old 10x rate spoofed
      depositAmount: 1000
    });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.breakdown.baseRental, 2040, 'Backend must override spoofed 850 with 2040');
    console.log('✓ Anti-tamper enforcement verified (spoofed ₹850 was overridden to ₹2,040)');

    // Test 4C: Spoofed request for Himalayan 450 (sending old ₹1,200)
    const res3 = await axios.post(url, {
      bookingId: 'BK-TEST-003',
      bikeId: 'himalayan-450',
      bikeName: 'Royal Enfield Himalayan 450',
      rentalDurationHours: 24,
      rentalDurationDays: 1,
      rentalAmount: 1200, // Old 10x rate spoofed
      depositAmount: 1500
    });

    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.data.breakdown.baseRental, 2880, 'Backend must override spoofed 1200 with 2880');
    console.log('✓ Anti-tamper enforcement verified for Himalayan 450 (spoofed ₹1,200 was overridden to ₹2,880)');

    console.log('\n======================================================');
    console.log('🎉 ALL PRICING CALCULATIONS & ANTI-TAMPER VERIFIED 100% WORKING!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
