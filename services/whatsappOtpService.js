/**
 * services/whatsappOtpService.js
 * 
 * Direct WhatsApp OTP Dispatcher via Meta WhatsApp Cloud API / Twilio
 * Dispatches 6-digit verification code directly to customer's WhatsApp number.
 */

const axios = require('axios');
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
 * Send OTP via WhatsApp to customer mobile number
 * @param {string} phone - 10 digit Indian phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{ success: boolean, channel: string, messageId?: string, simulated: boolean }>}
 */
async function sendWhatsAppOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const formattedRecipient = `91${cleanPhone}`;

  const token = getEnv('WHATSAPP_TOKEN');
  const phoneId = getEnv('WHATSAPP_PHONE_NUMBER_ID');

  const messageText = 
`🛵 *ValoHub Bike Rental - Login Verification*

Your 6-digit one-time password (OTP) is:
*${otp}*

⏳ Valid for 5 minutes.
🛡️ For security, do not share this code with anyone.

_ValoHub Rentals Kozhikode (Calicut)_`;

  // 1. Check if Meta WhatsApp Cloud API is configured
  if (token && phoneId) {
    try {
      console.log(`[WhatsApp OTP] Dispatching live OTP to +${formattedRecipient} via Meta Cloud API...`);
      const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const msgId = response.data?.messages?.[0]?.id;
      console.log(`[WhatsApp OTP] ✓ Successfully delivered to +${formattedRecipient} (Msg ID: ${msgId})`);
      return {
        success: true,
        channel: 'WHATSAPP_LIVE',
        messageId: msgId,
        simulated: false
      };
    } catch (apiErr) {
      const errorObj = apiErr.response?.data?.error;
      const errorMsg = errorObj?.message || apiErr.message;
      const errorCode = errorObj?.code;
      console.warn(`[WhatsApp OTP API Warning]: (${errorCode}) ${errorMsg}`);
      
      if (errorCode === 131030) {
        console.log(`\n======================================================`);
        console.log(`⚠️ [META CLOUD API: TEST NUMBER AUTHORIZATION REQUIRED]`);
        console.log(`📱 Recipient: +${formattedRecipient}`);
        console.log(`Reason: In Meta Development Mode, you must add the test number to your dashboard:`);
        console.log(`1. Go to https://developers.facebook.com/apps/`);
        console.log(`2. Select your WhatsApp App -> WhatsApp -> API Setup`);
        console.log(`3. Under "Step 2: Send and receive messages", open the "To" dropdown`);
        console.log(`4. Click "Manage phone number list" -> Add +${formattedRecipient}`);
        console.log(`5. Verify the 6-digit confirmation code Meta sends to your WhatsApp.`);
        console.log(`Once added, live messages will deliver instantly to +${formattedRecipient}!`);
        console.log(`======================================================\n`);
      }
      // Continue to local logging so development is never blocked
    }
  }

  // 2. Simulated/Local Server Console Mode (with clear developer instructions)
  console.log(`\n========================================`);
  console.log(`[ValoHub WhatsApp OTP Service]`);
  console.log(`📱 Recipient WhatsApp: +${formattedRecipient}`);
  console.log(`🔑 OTP Code: ${otp}`);
  console.log(`💬 Message Payload:\n${messageText}`);
  if (!token || !phoneId) {
    console.log(`ℹ️ To deliver live WhatsApp messages to +${formattedRecipient}:`);
    console.log(`   Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.`);
  }
  console.log(`========================================\n`);

  return {
    success: true,
    channel: 'WHATSAPP_SIMULATED',
    simulated: true,
    recipient: formattedRecipient
  };
}

module.exports = { sendWhatsAppOtp, getEnv };
