const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST 1: Frontend Contact & WhatsApp Redirection Links ---');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf-8');

// Announcement bar check
assert.ok(html.includes('href="tel:+917591982882"'), 'Announcement bar tel link must be +917591982882');
assert.ok(html.includes('+91 75919 82882'), 'Announcement bar text must display +91 75919 82882');
console.log('✓ Announcement bar phone verified: +91 75919 82882');

// Navbar WhatsApp check
assert.ok(html.includes('href="https://wa.me/917591982882?text='), 'Navbar WhatsApp button must redirect to https://wa.me/917591982882');
assert.ok(html.includes('Chat on WhatsApp (+91 75919 82882)'), 'Mobile drawer WhatsApp button must display (+91 75919 82882)');
console.log('✓ Navbar & Mobile Drawer WhatsApp links verified: https://wa.me/917591982882');

// App.js WhatsApp links check
assert.ok(appJs.includes('https://wa.me/917591982882'), 'app.js must redirect to https://wa.me/917591982882');
assert.ok(appJs.includes('Chat with Kozhikode Hub (+91 75919 82882)'), 'app.js must display (+91 75919 82882)');
console.log('✓ app.js Hub WhatsApp links verified: https://wa.me/917591982882');

console.log('\n--- TEST 2: Backend Post-Checkout WhatsApp Invoice Trigger ---');
const { triggerPostCheckoutWhatsAppInvoice } = require('../services/invoiceService');

async function testBackendTrigger() {
  const mockBooking = {
    bookingId: `BK-TEST-${Date.now()}`,
    customerName: 'Rahul Nair',
    customerPhone: '9847055667',
    customerEmail: 'rahul.nair@example.com',
    drivingLicense: 'KL-11-2023-0098412',
    bikeName: 'Royal Enfield Himalayan 450',
    bikeRegNo: 'KL-11-BV-4501',
    paymentRef: `pay_test_${Date.now()}`,
    paymentMethod: 'UPI',
    baseAmount: 2880,
    depositAmount: 1500,
    pickupDate: '2026-09-19 11:00 PM',
    dropoffDate: '2026-09-20 11:00 PM'
  };

  const result = await triggerPostCheckoutWhatsAppInvoice(mockBooking, {
    get: () => '127.0.0.1:3000',
    protocol: 'http'
  });

  console.log('Post-Checkout Trigger Result:', {
    invoiceNumber: result.invoiceNumber,
    pdfPath: result.pdfPath,
    publicPdfUrl: result.publicPdfUrl,
    grandTotalPaid: result.grandTotalPaid,
    whatsAppDelivery: result.whatsAppDelivery
  });

  assert.ok(result.success, 'Trigger function must return success: true');
  assert.ok(result.invoiceNumber.startsWith('INV-'), 'Invoice number must start with INV-');
  assert.strictEqual(result.whatsAppDelivery.status, 'DELIVERED', 'WhatsApp status must be DELIVERED');
  assert.strictEqual(result.whatsAppDelivery.sender, '7591982882', 'Official sender phone must be 7591982882');
  assert.strictEqual(result.whatsAppDelivery.recipient, '9847055667', 'Recipient must be 9847055667');

  // Verify file was generated on disk
  const localPdfPath = path.join(__dirname, '..', 'public', result.pdfPath);
  assert.ok(fs.existsSync(localPdfPath), `PDF invoice must exist on disk at ${localPdfPath}`);
  const stats = fs.statSync(localPdfPath);
  assert.ok(stats.size > 1000, `PDF file size must be > 1KB (got ${stats.size} bytes)`);
  console.log(`✓ Generated PDF invoice verified on disk: ${stats.size} bytes`);
  console.log(`✓ WhatsApp dispatch verified with sender 7591982882 to recipient 9847055667`);

  console.log('\n======================================================');
  console.log('🎉 ALL WHATSAPP & CONTACT INFORMATION UPDATES VERIFIED 100% WORKING!');
  console.log('======================================================\n');
}

testBackendTrigger().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
