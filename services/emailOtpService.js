/**
 * services/emailOtpService.js
 * 
 * Direct Email OTP Dispatcher via Nodemailer / SMTP
 * Sends 6-digit verification code to customer's email address for secure login.
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

function getEnv(key, defaultVal = '') {
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.substring(0, idx).trim();
          if (k === key) {
            let val = trimmed.substring(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1).trim();
            }
            return val;
          }
        }
      }
    }
  } catch (e) {}
  const val = process.env[key] !== undefined ? process.env[key] : defaultVal;
  return String(val).replace(/^["']|["']$/g, '').trim();
}

/**
 * Send OTP to customer's email address
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{ success: boolean, channel: string, messageId?: string, simulated: boolean }>}
 */
async function sendEmailOtp(email, otp) {
  const cleanEmail = String(email).trim().toLowerCase();
  
  let smtpHost = getEnv('SMTP_HOST');
  let smtpPort = parseInt(getEnv('SMTP_PORT', '465'), 10);
  const smtpUser = getEnv('SMTP_USER');
  const smtpPass = getEnv('SMTP_PASS');
  let fromAddress = getEnv('EMAIL_FROM');

  const isGmail = Boolean(
    (smtpUser && (smtpUser.toLowerCase().endsWith('@gmail.com') || smtpUser.toLowerCase().endsWith('@googlemail.com'))) ||
    (smtpHost && smtpHost.toLowerCase().includes('gmail'))
  );

  // Auto-configure Gmail defaults if user provides a Gmail address
  if (isGmail) {
    if (!smtpHost) smtpHost = 'smtp.gmail.com';
    if (!smtpPort || isNaN(smtpPort)) smtpPort = 465;
    if (!fromAddress || fromAddress.includes('valohub.kerala.in')) {
      fromAddress = `ValoHub Bike Rental <${smtpUser}>`;
    }
  } else if (!fromAddress) {
    fromAddress = 'ValoHub Bike Rental <rentals@valohub.kerala.in>';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
        .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: #0F172A; padding: 24px; text-align: center; border-bottom: 3px solid #F59E0B; }
        .logo { font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #FFFFFF; text-transform: uppercase; }
        .logo span { color: #F59E0B; }
        .tagline { color: #94A3B8; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1.5px; }
        .body { padding: 32px 28px; }
        .title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0; }
        .text { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
        .otp-box { background: #FFFBEB; border: 2px dashed #F59E0B; border-radius: 10px; padding: 18px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #B45309; font-family: monospace; }
        .otp-label { font-size: 12px; font-weight: 600; color: #92400E; margin-top: 6px; }
        .notice { font-size: 12px; color: #64748B; background: #F1F5F9; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; }
        .footer { padding: 20px 28px; background: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 11px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">VALOHUB <span>BIKE RENTAL</span></div>
          <div class="tagline">Kozhikode • Calicut, Kerala</div>
        </div>
        <div class="body">
          <h2 class="title">Email Verification Code</h2>
          <p class="text">
            Namaskaram! Please use the 6-digit verification code below to log in or create your ValoHub account:
          </p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="otp-label">ONE-TIME PASSWORD (VALID FOR 5 MINUTES)</div>
          </div>
          <div class="notice">
            🛡️ <strong>Security Tip:</strong> ValoHub staff will never ask for your verification code. Do not share this OTP with anyone.
          </div>
        </div>
        <div class="footer">
          ValoHub Rentals • Opp. Calicut Railway Station, Mavoor Road, Kozhikode, Kerala 673004<br>
          Helpline: +91 75919 82882 | rentals@valohub.kerala.in
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. If SMTP credentials are configured, send live email
  if ((smtpHost || smtpUser) && smtpUser && smtpPass) {
    try {
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpUser.toLowerCase().endsWith('@gmail.com') || (smtpHost && smtpHost.toLowerCase().includes('gmail'));
      
      let transportConfig;
      if (isGmail) {
        transportConfig = {
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: cleanPass
          }
        };
      } else {
        transportConfig = {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: cleanPass
          }
        };
      }

      console.log(`[Email OTP] Dispatching live email to ${cleanEmail} via ${isGmail ? 'Gmail Service' : smtpHost}...`);
      const transporter = nodemailer.createTransport(transportConfig);

      const info = await transporter.sendMail({
        from: fromAddress || smtpUser,
        to: cleanEmail,
        subject: `Your ValoHub Login Code: ${otp}`,
        text: `Namaskaram! Your ValoHub 6-digit verification code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`,
        html: htmlContent
      });

      console.log(`[Email OTP] ✓ Live email sent to ${cleanEmail} (Msg ID: ${info.messageId})`);
      return {
        success: true,
        channel: 'EMAIL_LIVE',
        messageId: info.messageId,
        simulated: false
      };
    } catch (mailErr) {
      console.warn('[Email OTP SMTP Error]:', mailErr.message);
      // Fallback to console logging below
    }
  }

  // 2. High-visibility developer / testing console display
  console.log(`\n========================================`);
  console.log(`[ValoHub Email OTP Service]`);
  console.log(`📧 Recipient Email: ${cleanEmail}`);
  console.log(`🔑 OTP Code: ${otp}`);
  console.log(`⏳ TTL Expiration: 300 seconds (5 minutes)`);
  console.log(`💬 Subject: Your ValoHub Login Code: ${otp}`);
  if (!smtpHost || !smtpUser) {
    console.log(`ℹ️ Live SMTP is not configured in .env (Optional).`);
    console.log(`   To send via real SMTP: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.`);
  }
  console.log(`========================================\n`);

  return {
    success: true,
    channel: 'EMAIL_SIMULATED',
    messageId: `sim_email_${Date.now()}`,
    simulated: true
  };
}

/**
 * Automatically update or add Gmail / SMTP user credentials in .env file
 */
function updateSmtpEnv(user, pass) {
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const cleanUser = String(user || '').trim();
    const isGmail = cleanUser.toLowerCase().endsWith('@gmail.com') || cleanUser.toLowerCase().endsWith('@googlemail.com');
    const cleanPass = pass ? String(pass).trim() : '';

    const updates = {
      SMTP_USER: `"${cleanUser}"`,
      SMTP_PASS: `"${cleanPass}"`,
      SMTP_HOST: isGmail ? '"smtp.gmail.com"' : '"smtp.gmail.com"',
      SMTP_PORT: isGmail ? '465' : '587',
      EMAIL_FROM: `"ValoHub Bike Rental <${cleanUser}>"`
    };

    for (const [k, v] of Object.entries(updates)) {
      const regex = new RegExp(`^${k}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${k}=${v}`);
      } else {
        content += `\n${k}=${v}`;
      }
    }
    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
    console.log(`[Email OTP] ✓ Updated SMTP user to ${cleanUser} in .env`);
    return true;
  } catch (e) {
    console.error('Failed to update .env:', e);
    return false;
  }
}

/**
 * Send Generated GST Tax Invoice PDF to customer via Email
 */
async function sendEmailInvoice(email, invoiceData, pdfFilePath) {
  if (!email || !email.includes('@')) return { success: false, reason: 'Invalid email' };
  const cleanEmail = String(email).trim().toLowerCase();

  let smtpHost = getEnv('SMTP_HOST');
  let smtpPort = parseInt(getEnv('SMTP_PORT', '465'), 10);
  const smtpUser = getEnv('SMTP_USER');
  const smtpPass = getEnv('SMTP_PASS');
  let fromAddress = getEnv('EMAIL_FROM');

  const isGmail = Boolean(
    (smtpUser && (smtpUser.toLowerCase().endsWith('@gmail.com') || smtpUser.toLowerCase().endsWith('@googlemail.com'))) ||
    (smtpHost && smtpHost.toLowerCase().includes('gmail'))
  );

  if (isGmail) {
    if (!smtpHost) smtpHost = 'smtp.gmail.com';
    if (!smtpPort || isNaN(smtpPort)) smtpPort = 465;
    if (!fromAddress || fromAddress.includes('valohub.kerala.in')) {
      fromAddress = `ValoHub Bike Rental <${smtpUser}>`;
    }
  }

  if ((smtpHost || smtpUser) && smtpUser && smtpPass) {
    try {
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const transporter = nodemailer.createTransport(isGmail ? {
        service: 'gmail',
        auth: { user: smtpUser, pass: cleanPass }
      } : {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: cleanPass }
      });

      const attachments = [];
      if (pdfFilePath && fs.existsSync(pdfFilePath)) {
        attachments.push({
          filename: `ValoHub-GST-Invoice-${invoiceData.invoiceNumber}.pdf`,
          path: pdfFilePath
        });
      }

      console.log(`[Email Invoice] Dispatching GST Tax Invoice (${invoiceData.invoiceNumber}) to ${cleanEmail} via Gmail...`);
      const info = await transporter.sendMail({
        from: fromAddress || smtpUser,
        to: cleanEmail,
        subject: `Your ValoHub Tax Invoice & Gate Pass: ${invoiceData.invoiceNumber} (${invoiceData.bikeName || 'Motorcycle'})`,
        text: `Namaskaram ${invoiceData.customerName || 'Rider'}!\n\nYour payment for ${invoiceData.bikeName} has been confirmed.\nBooking Reference: ${invoiceData.bookingId}\nInvoice Number: ${invoiceData.invoiceNumber}\nTotal Paid: Rs. ${invoiceData.totalAmount}\n\nPlease find your attached official GST Tax Invoice and Gate Pass PDF.\n\nValoHub Rentals Kozhikode`,
        html: `
          <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 24px; color: #0F172A;">
            <div style="max-width: 540px; margin: 0 auto; background: #FFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden;">
              <div style="background: #0F172A; padding: 20px; text-align: center; border-bottom: 3px solid #F59E0B;">
                <h2 style="color: #FFF; margin: 0; font-size: 20px;">VALOHUB <span style="color: #F59E0B;">BIKE RENTAL</span></h2>
                <div style="color: #94A3B8; font-size: 11px; margin-top: 4px;">Kozhikode • Calicut, Kerala</div>
              </div>
              <div style="padding: 24px;">
                <h3 style="color: #065F46; margin-top: 0;">✓ Payment Confirmed & Reserved!</h3>
                <p>Namaskaram <strong>${invoiceData.customerName || 'Rider'}</strong>,</p>
                <p>Your reservation for <strong>${invoiceData.bikeName}</strong> is confirmed. Your official GST Tax Invoice and Gate Pass PDF is attached to this email.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Booking Reference:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${invoiceData.bookingId}</td></tr>
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Tax Invoice Number:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${invoiceData.invoiceNumber}</td></tr>
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Vehicle:</td><td style="padding: 8px 0; text-align: right;">${invoiceData.bikeName}</td></tr>
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Base Rental Tariff:</td><td style="padding: 8px 0; text-align: right;">₹${invoiceData.baseAmount}</td></tr>
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">18% GST (CGST 9% + SGST 9%):</td><td style="padding: 8px 0; text-align: right;">₹${invoiceData.totalGst}</td></tr>
                  <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #0369A1;">Refundable Deposit (Held):</td><td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0369A1;">₹${invoiceData.depositAmount}</td></tr>
                  <tr><td style="padding: 10px 0; font-weight: 800; font-size: 15px;">Total Paid:</td><td style="padding: 10px 0; font-weight: 800; font-size: 15px; text-align: right; color: #065F46;">₹${invoiceData.totalAmount}</td></tr>
                </table>
                <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400E;">
                  🛡️ <strong>Pickup Location:</strong> ValoHub Mavoor Road Hub, Opp. Calicut Railway Station.<br>
                  Please present the attached PDF Gate Pass and your Original Driving License at time of vehicle pickup.
                </div>
              </div>
              <div style="background: #F8FAFC; padding: 14px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0;">
                Helpline: +91 75919 82882 | Opp. Calicut Railway Station, Kozhikode
              </div>
            </div>
          </div>
        `,
        attachments
      });
      console.log(`[Email Invoice] ✓ Live invoice PDF email sent to ${cleanEmail} (Msg ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn('[Email Invoice Error]:', err.message);
    }
  }
  return { success: false, reason: 'SMTP not active' };
}

module.exports = {
  sendEmailOtp,
  getEnv,
  updateSmtpEnv,
  sendEmailInvoice
};
