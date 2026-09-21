/**
 * routes/whatsappWebhook.js
 * 
 * Meta WhatsApp Cloud API Webhook & AI Concierge Service
 * - GET: Webhook verification handshake for Meta Graph API
 * - POST: Incoming message receiver + OpenAI gpt-4o-mini intelligent customer support
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper to read and sanitize env vars (strips leading/trailing quotes and trims)
function getEnv(key, defaultVal = '') {
  const val = process.env[key] !== undefined ? process.env[key] : defaultVal;
  return String(val).replace(/^["']|["']$/g, '').trim();
}

// System instruction prompt for OpenAI gpt-4o-mini
const SYSTEM_PROMPT = `You are the official AI WhatsApp Concierge for ValoHub Bike Rentals in Kozhikode (Calicut), Kerala.
Our fleet includes:
- Royal Enfield Hunter 350 (₹899/day)
- Royal Enfield Himalayan 450 (₹1,499/day)
- KTM Duke 250 (₹1,199/day)
- Yamaha Aerox 155 (₹699/day)
- Honda Activa 6G (₹499/day)

Rental Policies:
- Mandatory Documents: Original Driving License (MCWG for geared bikes, MCWOG for gearless scooters) + Aadhaar Card / Passport.
- Refundable Security Deposit: ₹1,000 for scooters, ₹2,000 for standard bikes, ₹3,000 for adventure/premium bikes.
- Free Inclusions: 1 ISI-certified helmet, comprehensive insurance, 24/7 roadside assistance in Kozhikode district.
- Pillion helmet available at ₹50/day.
- Hub Location: Near Kozhikode Railway Station / Mavoor Road, Kozhikode, Kerala 673001.
- Support Phone: +91 94000 00000.

Guidelines:
- Keep answers concise, clear, and WhatsApp-friendly (use bullet points and emojis).
- Be polite, welcoming, and helpful.
- If the customer asks to book, guide them to visit our web portal or provide their rental dates.`;

/**
 * GET /webhook/whatsapp
 * Meta Cloud API Verification Handshake
 */
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = getEnv('WHATSAPP_VERIFY_TOKEN', 'valohub_meta_webhook_secret_2026');

    console.log(`[WhatsApp Webhook] Verification request received. Mode: ${mode}, Token: ${token}`);

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('[WhatsApp Webhook] Verification successful!');
        return res.status(200).send(challenge);
    }

    console.warn(`[WhatsApp Webhook] Verification failed. Expected: "${expectedToken}", Received: "${token}"`);
    return res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
});

/**
 * POST /webhook/whatsapp
 * Receives incoming messages from Meta WhatsApp Cloud API
 */
router.post('/whatsapp', async (req, res) => {
    // Meta requires an immediate 200 OK acknowledgment to prevent repeated webhook retries
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;

        if (!body.object || body.object !== 'whatsapp_business_account') {
            return;
        }

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        // If it's a delivery status update or read receipt, ignore
        if (!message) {
            return;
        }

        const from = message.from; // Customer phone number (e.g. "916282567675")
        const messageType = message.type;
        let incomingText = '';

        if (messageType === 'text') {
            incomingText = message.text.body;
        } else if (messageType === 'button') {
            incomingText = message.button.text;
        } else if (messageType === 'interactive') {
            incomingText = message.interactive.button_reply?.title || message.interactive.list_reply?.title || '';
        } else {
            console.log(`[WhatsApp Webhook] Received unhandled message type: ${messageType} from ${from}`);
            return;
        }

        console.log(`[WhatsApp Webhook] Incoming message from ${from}: "${incomingText}"`);

        // Generate AI response using OpenAI gpt-4o-mini or rule-based fallback
        const replyText = await generateAiResponse(incomingText);

        // Send reply back to user via WhatsApp Cloud API
        await sendWhatsAppTextMessage(from, replyText);

    } catch (error) {
        console.error('[WhatsApp Webhook] Error processing incoming webhook:', error.message);
    }
});

/**
 * Generate AI Response using OpenAI gpt-4o-mini or intelligent fallback
 */
async function generateAiResponse(userMessage) {
    const apiKey = getEnv('OPENAI_API_KEY');

    if (apiKey) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 350,
                    temperature: 0.6
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000
                }
            );

            const aiReply = response.data?.choices?.[0]?.message?.content?.trim();
            if (aiReply) return aiReply;
        } catch (err) {
            console.error('[OpenAI] API call failed, falling back to local responder:', err.message);
        }
    }

    // Intelligent Fallback Concierge if OpenAI key is not provided or fails
    const lower = userMessage.toLowerCase();

    if (lower.includes('price') || lower.includes('rate') || lower.includes('rent') || lower.includes('cost')) {
        return `🏍️ *ValoHub Kozhikode Daily Rates:*\n\n` +
               `• *Honda Activa 6G:* ₹499/day\n` +
               `• *Yamaha Aerox 155:* ₹699/day\n` +
               `• *RE Hunter 350:* ₹899/day\n` +
               `• *KTM Duke 250:* ₹1,199/day\n` +
               `• *RE Himalayan 450:* ₹1,499/day\n\n` +
               `✨ Includes 1 ISI helmet & 24/7 roadside assistance.\n` +
               `Book online or reply with your preferred dates!`;
    }

    if (lower.includes('doc') || lower.includes('license') || lower.includes('dl') || lower.includes('id') || lower.includes('require')) {
        return `📋 *Documents Required for Rental:*\n\n` +
               `1️⃣ Valid Original Driving License (MCWG for bikes, MCWOG for gearless scooters)\n` +
               `2️⃣ Original Aadhaar Card / Passport / Voter ID for identity verification\n` +
               `3️⃣ Refundable Security Deposit (₹1,000 - ₹3,000 depending on the model)\n\n` +
               `📍 Pickup Hub: Near Kozhikode Railway Station.`;
    }

    if (lower.includes('location') || lower.includes('where') || lower.includes('address') || lower.includes('calicut') || lower.includes('kozhikode')) {
        return `📍 *ValoHub Kozhikode Hub Location:*\n\n` +
               `Near Railway Station Link Road / Mavoor Road, Kozhikode, Kerala 673001.\n` +
               `⏰ Timings: 7:00 AM - 10:00 PM (All 7 days)\n` +
               `📞 Call/WhatsApp Support: +91 94000 00000`;
    }

    if (lower.includes('deposit') || lower.includes('refund')) {
        return `💳 *Security Deposit Policy:*\n\n` +
               `• Scooters: ₹1,000\n` +
               `• Bikes (Hunter/Duke): ₹2,000\n` +
               `• Adventure (Himalayan): ₹3,000\n\n` +
               `💰 *100% Refundable* immediately via UPI/Cash upon returning the motorcycle in undamaged condition!`;
    }

    return `👋 Hello from *ValoHub Bike Rentals Kozhikode*!\n\n` +
           `How can I help you today?\n` +
           `• Reply *PRICES* for motorcycle rates\n` +
           `• Reply *DOCUMENTS* for rental requirements\n` +
           `• Reply *LOCATION* for our pickup station\n` +
           `• Or ask any questions directly! 🛵💨`;
}

/**
 * Send text reply via Meta WhatsApp Cloud API
 */
async function sendWhatsAppTextMessage(recipientPhone, text) {
    const token = getEnv('WHATSAPP_TOKEN');
    const phoneId = getEnv('WHATSAPP_PHONE_NUMBER_ID');

    if (!token || !phoneId) {
        console.log(`[WhatsApp Simulated Send] To: ${recipientPhone} | Content:\n${text}`);
        return { simulated: true, recipient: recipientPhone };
    }

    try {
        const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
        const response = await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientPhone,
                type: 'text',
                text: { preview_url: false, body: text }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log(`[WhatsApp Sent] Successfully delivered reply to ${recipientPhone}, message_id:`, response.data?.messages?.[0]?.id);
        return response.data;
    } catch (err) {
        console.warn('[WhatsApp Send Warning]:', err.response?.data || err.message);
        return { simulated: true, error: err.message };
    }
}

module.exports = {
    whatsappRouter: router,
    generateAiResponse,
    sendWhatsAppTextMessage
};
