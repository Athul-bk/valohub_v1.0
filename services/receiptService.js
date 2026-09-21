const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF Receipt using PDFKit
 * Accepts either:
 * - (booking, payment, user, bike) OR
 * - a unified booking payload { bookingId, bookingReference, customerName, customerPhone, bikeName, bikeRegNo, ... }
 * @returns {Promise<{ receiptPath: string, filename: string, fileName: string, receiptUrl: string }>}
 */
function generateReceiptPdf(booking = {}, payment = {}, user = {}, bike = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Handle unified payload if passed as single argument
      const bRef = booking.bookingReference || booking.bookingId || 'VH-KZK-' + Math.floor(1000 + Math.random() * 9000);
      const pMethod = payment.paymentMethod || booking.paymentMethod || 'UPI / Instant Pay';
      const pRef = payment.gatewayReference || booking.paymentId || 'PAY-' + Math.floor(100000 + Math.random() * 900000);
      const rName = user.name || booking.customerName || 'Valued Customer';
      const rPhone = user.phone || booking.customerPhone || '916282567675';
      const rDl = user.drivingLicense || booking.drivingLicense || 'KL-11-DL-VERIFIED';
      const bName = bike.name || booking.bikeName || 'Royal Enfield Hunter 350';
      const bReg = bike.registrationNumber || booking.bikeRegNo || 'KL-11-BX-4501';
      const bCc = bike.engineCapacity || booking.engineCapacity || 'Curated Kozhikode Fleet';
      const pLoc = booking.pickupLocation || 'Mavoor Road Hub, Kozhikode';
      const sTime = booking.startTime || booking.pickupDate || new Date().toLocaleString('en-IN');
      const eTime = booking.endTime || booking.dropoffDate || new Date(Date.now() + 86400000).toLocaleString('en-IN');
      const baseFare = Number(booking.totalAmount || booking.rentalAmount || 899);
      const deposit = Number(booking.depositAmount !== undefined ? booking.depositAmount : 2000);
      const totalPaid = baseFare + deposit;

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const filename = `receipt-${bRef}.pdf`;
      const receiptsDir = path.join(__dirname, '../public/receipts');

      // Ensure directory exists
      fs.mkdirSync(receiptsDir, { recursive: true });
      const receiptPath = path.join(receiptsDir, filename);
      const stream = fs.createWriteStream(receiptPath);
      doc.pipe(stream);

      // --- BRAND HEADER ---
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A1A1A').text('VALOHUB BIKE RENTAL', { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('Opp. Calicut Railway Station North Gate, Mavoor Road Junction, Kozhikode, Kerala 673004', { align: 'center' });
      doc.fontSize(9).text('Tel: +91 94000 00000 | Email: support@valohub.kerala.in | Web: valohub.kerala.in', { align: 'center' });
      doc.moveDown(0.8);

      // Gold Accent Divider Line
      doc.strokeColor('#FFC107').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1.2);

      // --- RECEIPT TITLE & META ---
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('OFFICIAL BOOKING CONFIRMATION & GATE PASS');
      doc.moveDown(0.5);

      const metaY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#374151')
        .text(`Booking Reference: ${bRef}`, 50, metaY)
        .text(`Date & Time: ${new Date().toLocaleString('en-IN')}`, 320, metaY);

      doc.text(`Payment Ref (Gateway): ${pRef}`, 50, metaY + 14)
        .text(`Payment Method: ${pMethod}`, 320, metaY + 14);

      doc.moveDown(2);

      // --- SECTION 1: RIDER & VEHICLE DETAILS ---
      doc.rect(50, doc.y, 495, 24).fill('#F8F9FA');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('  1. RIDER & MOTORCYCLE DETAILS', 55, doc.y - 18);
      doc.moveDown(0.8);

      const riderStartY = doc.y;
      doc.fontSize(9).font('Helvetica')
        .text(`Rider Name: ${rName}`, 55, riderStartY)
        .text(`Phone: +91 ${rPhone.replace(/\D/g, '').slice(-10)}`, 320, riderStartY);

      doc.text(`Driving License: ${rDl} (Govt MoRTH Verified ✓)`, 55, riderStartY + 14)
        .text(`Endorsement: MCWG (Motorcycle with Gear)`, 320, riderStartY + 14);

      doc.text(`Vehicle: ${bName}`, 55, riderStartY + 28)
        .text(`Registration Plate: ${bReg}`, 320, riderStartY + 28);

      doc.text(`Pickup Hub: ${pLoc}`, 55, riderStartY + 42)
        .text(`Engine: ${bCc}`, 320, riderStartY + 42);

      doc.text(`Pickup Schedule: ${typeof sTime === 'string' ? sTime : new Date(sTime).toLocaleString('en-IN')}`, 55, riderStartY + 56)
        .text(`Dropoff Schedule: ${typeof eTime === 'string' ? eTime : new Date(eTime).toLocaleString('en-IN')}`, 320, riderStartY + 56);

      doc.y = riderStartY + 74;
      doc.moveDown(1);

      // --- SECTION 2: CHARGES & DEPOSIT BREAKDOWN ---
      doc.rect(50, doc.y, 495, 24).fill('#F8F9FA');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('  2. FINANCIAL BREAKDOWN & SECURITY DEPOSIT', 55, doc.y - 18);
      doc.moveDown(0.8);

      const finStartY = doc.y;
      doc.fontSize(9).font('Helvetica')
        .text('Rental Tariff & Included Helmet (200 km/day):', 55, finStartY)
        .text(`Rs. ${baseFare.toLocaleString('en-IN')}`, 450, finStartY, { align: 'right' });

      doc.text('Complimentary ISI Certified Helmet:', 55, finStartY + 14)
        .text('FREE (Included)', 450, finStartY + 14, { align: 'right' });

      doc.text('100% Refundable Security Deposit (Held):', 55, finStartY + 28)
        .text(`Rs. ${deposit.toLocaleString('en-IN')}`, 450, finStartY + 28, { align: 'right' });

      doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(55, finStartY + 46).lineTo(545, finStartY + 46).stroke();

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#047857')
        .text('Total Amount Paid (Inclusive of Refundable Deposit):', 55, finStartY + 54)
        .text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, 450, finStartY + 54, { align: 'right' });

      doc.y = finStartY + 76;
      doc.moveDown(1.5);

      // --- TERMS & SECURITY DEPOSIT REFUND NOTICE ---
      doc.rect(50, doc.y, 495, 48).fillAndStroke('#FFFBEB', '#FDE68A');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#92400E')
        .text('IMPORTANT RENTAL & INSTANT REFUND POLICY', 60, doc.y - 42);
      doc.fontSize(8).font('Helvetica').fillColor('#78350F')
        .text(`• 100% Security Deposit (Rs. ${deposit.toLocaleString('en-IN')}) will be refunded via UPI instantly upon physical vehicle return.`, 60, doc.y + 4)
        .text('• Please carry your original Physical Driving License and Government ID card for vehicle release verification.', 60, doc.y + 2);

      doc.moveDown(3);

      // Footer
      doc.fontSize(8).fillColor('#9CA3AF')
        .text('© 2026 ValoHub Bike Rental. Computer generated valid gate pass & tax invoice.', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          receiptPath,
          filename,
          fileName: filename,
          receiptUrl: `/receipts/${filename}`
        });
      });

      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Send Receipt PDF via Meta WhatsApp Cloud API
 */
async function sendWhatsAppReceipt(userPhone, pdfUrl, bookingRefOrData, bikeNameParam) {
  const WHATSAPP_TOKEN = (process.env.WHATSAPP_TOKEN || '').trim();
  const WHATSAPP_PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

  let bookingRef = 'VH-KZK';
  let bikeName = 'Motorcycle';

  if (typeof bookingRefOrData === 'object' && bookingRefOrData !== null) {
    bookingRef = bookingRefOrData.bookingReference || bookingRefOrData.bookingId || 'VH-KZK';
    bikeName = bookingRefOrData.bikeName || 'Motorcycle';
  } else if (typeof bookingRefOrData === 'string') {
    bookingRef = bookingRefOrData;
    bikeName = bikeNameParam || 'Motorcycle';
  }

  const cleanPhone = String(userPhone).replace(/\D/g, '').slice(-10);

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`\n========================================`);
    console.log(`[WhatsApp API Simulated Mode]`);
    console.log(`📱 Recipient: +91 ${cleanPhone}`);
    console.log(`📄 Document Payload: ValoHub-Booking-${bookingRef}.pdf`);
    console.log(`🔗 Receipt URL: ${pdfUrl}`);
    console.log(`💬 Message: Namaskaram! Your ${bikeName} is confirmed for pickup in Kozhikode.`);
    console.log(`========================================\n`);
    return { success: true, simulated: true, message: 'WhatsApp API credentials not set, logged in demo mode.' };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: `91${cleanPhone}`,
      type: 'document',
      document: {
        link: pdfUrl,
        filename: `ValoHub-Booking-${bookingRef}.pdf`,
        caption: `Namaskaram! Here is your official booking confirmation receipt for the ${bikeName}. Your machine is ready for pickup at our Kozhikode Hub!`
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return { success: true, data: response.data };
  } catch (apiErr) {
    console.warn('[WhatsApp Cloud API Warning]:', apiErr.response?.data || apiErr.message);
    return { success: false, simulated: true, error: apiErr.message };
  }
}

module.exports = { generateReceiptPdf, sendWhatsAppReceipt };
