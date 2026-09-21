# ValoHub Production Architecture: PostgreSQL, Prisma, Admin UI, WhatsApp & AI Webhook

This plan outlines the complete production upgrade for **ValoHub Bike Rental**, converting the platform from static files and in-memory storage into an enterprise-ready full-stack system as requested in [database.md](file:///d:/New%20folder%20%282%29/testing-bike-clone/database.md).

---

## Architecture Overview

```mermaid
flowchart TD
    UserClient[User Web App / Mobile] -->|Book / Pay| API[Node.js Express Server]
    AdminClient[React Tailwind Admin Dashboard] -->|Manage Fleet & Bookings| API
    WhatsAppUser[WhatsApp Customer] <-->|Chat / Messages| MetaAPI[Meta WhatsApp Cloud API]
    MetaAPI <-->|Webhook| WebhookHandler[Express /webhook/whatsapp]
    WebhookHandler <-->|Support Prompts| OpenAI[OpenAI gpt-4o-mini]
    
    API -->|ORM Queries| Prisma[Prisma Client]
    Prisma --> DB[(PostgreSQL Database)]
    API -->|OTP TTL & Rate Limits| Redis[(Redis Cache)]
    API -->|Receipts| PDFGen[PDFKit Engine]
    PDFGen -->|Send Document| MetaAPI
```

---

## 1. Suggested Improvements & Enhancements to `database.md`

Before finalizing the schema and services, here are critical real-world additions recommended for ValoHub:

1. **Driving License (DL) & MCWG Verification**:
   - In `otpissues.md`, we established that motorcycle rentals require verified DL endorsements (MCWG). The `User` model must track `drivingLicense`, `isDlVerified: Boolean`, and `dlCategory` so unverified users cannot bypass rental safety checks.
2. **Refundable Security Deposit Tracking**:
   - Rental bikes in Kozhikode (e.g. Royal Enfield Himalayan 450, KTM 390 Duke) require a ₹1,500 - ₹3,000 security deposit. Adding `depositAmount` and `depositStatus: PENDING | HELD | REFUNDED | DEDUCTED` to `Booking` avoids accounting disputes.
3. **Vehicle Registration & Odometer Tracking**:
   - For real fleet management: a physical bike needs a registration plate number (e.g. `KL-11-BV-4567`), current odometer reading (`odometerKm`), and fuel policy status.
4. **Add-ons & Equipment Model**:
   - ValoHub offers complimentary ISI helmets, optional pillion helmets, riding jackets, and phone mounts. A `BookingAddon` relation model preserves add-on purchase history.
5. **Meta WhatsApp Webhook Verification Endpoint**:
   - Meta requires a `GET /webhook/whatsapp` route to verify the webhook handshake using `hub.mode`, `hub.verify_token`, and `hub.challenge` before any message payloads are sent.

---

## 2. Proposed Changes & Code Implementations

### Component 1: Database Schema ([NEW] `prisma/schema.prisma`)
Production PostgreSQL schema featuring all required models plus our suggested improvements:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
  OPERATOR
}

enum BookingStatus {
  PENDING
  CONFIRMED
  ACTIVE
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum DepositStatus {
  HELD
  REFUNDED
  DEDUCTED
}

model User {
  id                 String    @id @default(uuid())
  phone              String    @unique
  name               String
  email              String?   @unique
  role               Role      @default(USER)
  drivingLicense     String?
  isDlVerified       Boolean   @default(false)
  dlCategory         String?   // MCWG
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  bookings           Booking[]
}

model Bike {
  id                 String    @id @default(uuid())
  name               String    // e.g. "Royal Enfield Himalayan 450"
  brand              String    // e.g. "Royal Enfield", "KTM"
  edition            String?   // e.g. "Summit Hanle Black"
  engineCapacity     String    // e.g. "452cc Liquid-Cooled Sherpa"
  registrationNumber String?   @unique // e.g. "KL-11-BV-4567"
  hourlyRate         Decimal   @db.Decimal(10, 2)
  dailyRate          Decimal   @db.Decimal(10, 2)
  depositAmount      Decimal   @default(1500.00) @db.Decimal(10, 2)
  isAvailable        Boolean   @default(true)
  odometerKm         Int       @default(0)
  images             String[]  // Array of image URLs
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  bookings           Booking[]
}

model Booking {
  id                 String         @id @default(uuid())
  bookingReference   String         @unique // e.g. "VH-KZK-849201"
  userId             String
  user               User           @relation(fields: [userId], references: [id])
  bikeId             String
  bike               Bike           @relation(fields: [bikeId], references: [id])
  startTime          DateTime
  endTime            DateTime
  pickupLocation     String         @default("Mavoor Road Hub, Kozhikode")
  totalAmount        Decimal        @db.Decimal(10, 2)
  depositAmount      Decimal        @default(1500.00) @db.Decimal(10, 2)
  depositStatus      DepositStatus  @default(HELD)
  status             BookingStatus  @default(PENDING)
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  payment            Payment?
}

model Payment {
  id                 String         @id @default(uuid())
  bookingId          String         @unique
  booking            Booking        @relation(fields: [bookingId], references: [id])
  amount             Decimal        @db.Decimal(10, 2)
  status             PaymentStatus  @default(PENDING)
  paymentMethod      String?        // "UPI", "CARD", "NETBANKING"
  gatewayReference   String         @unique // Razorpay / Stripe Payment ID
  receiptUrl         String?
  paidAt             DateTime?
  createdAt          DateTime       @default(now())
}
```

---

### Component 2: Admin Dashboard ([NEW] `admin/AdminDashboard.jsx`)
Full React + Tailwind CSS Admin Panel featuring:
- Live KPI Metrics: Total Revenue, Active Rentals, Total Users, and Fleet Availability.
- Fleet Management Table: Add, Edit, Delete bikes, and live availability toggling.

```jsx
import React, { useState, useEffect } from 'react';
import { 
  Bike, Users, DollarSign, Calendar, Plus, Edit2, Trash2, CheckCircle, XCircle 
} from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    totalRevenue: 142500,
    activeRentals: 2,
    totalUsers: 84,
    totalBikes: 3
  });

  const [fleet, setFleet] = useState([
    {
      id: 'himalayan-450',
      name: 'Royal Enfield Himalayan 450',
      brand: 'Royal Enfield',
      hourlyRate: 140,
      dailyRate: 1599,
      isAvailable: true,
      registrationNumber: 'KL-11-BX-4501'
    },
    {
      id: 'classic-350',
      name: 'Royal Enfield Classic 350 Reborn',
      brand: 'Royal Enfield',
      hourlyRate: 105,
      dailyRate: 1199,
      isAvailable: false,
      registrationNumber: 'KL-11-BW-3502'
    },
    {
      id: 'ktm-390',
      name: 'KTM 390 Duke Gen-3',
      brand: 'KTM',
      hourlyRate: 160,
      dailyRate: 1799,
      isAvailable: true,
      registrationNumber: 'KL-11-BY-3903'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editBike, setEditBike] = useState(null);
  const [formData, setFormData] = useState({
    name: '', brand: '', hourlyRate: '', dailyRate: '', registrationNumber: '', isAvailable: true
  });

  const handleOpenAdd = () => {
    setEditBike(null);
    setFormData({ name: '', brand: '', hourlyRate: '', dailyRate: '', registrationNumber: '', isAvailable: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (bike) => {
    setEditBike(bike);
    setFormData({ ...bike });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to remove this bike from the active fleet?')) {
      setFleet(fleet.filter(b => b.id !== id));
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editBike) {
      setFleet(fleet.map(b => b.id === editBike.id ? { ...formData, id: editBike.id } : b));
    } else {
      setFleet([...fleet, { ...formData, id: 'bike-' + Date.now() }]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-yellow-400">ValoHub Admin</h1>
            <p className="text-slate-400 text-sm mt-1">Kozhikode Fleet & Booking Operations Portal</p>
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all"
          >
            <Plus size={18} /> Add Machine
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-800/80 border border-slate-700/60 p-6 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">₹{metrics.totalRevenue.toLocaleString('en-IN')}</h3>
              </div>
              <div className="p-3 bg-yellow-400/10 text-yellow-400 rounded-xl"><DollarSign size={22} /></div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-6 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Rentals</p>
                <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{metrics.activeRentals} Ongoing</h3>
              </div>
              <div className="p-3 bg-emerald-400/10 text-emerald-400 rounded-xl"><Calendar size={22} /></div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-6 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Registered Riders</p>
                <h3 className="text-2xl font-extrabold text-sky-400 mt-1">{metrics.totalUsers} Riders</h3>
              </div>
              <div className="p-3 bg-sky-400/10 text-sky-400 rounded-xl"><Users size={22} /></div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-6 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Fleet</p>
                <h3 className="text-2xl font-extrabold text-purple-400 mt-1">{fleet.length} Machines</h3>
              </div>
              <div className="p-3 bg-purple-400/10 text-purple-400 rounded-xl"><Bike size={22} /></div>
            </div>
          </div>
        </div>

        {/* Fleet Table */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Fleet Inventory Management</h2>
            <span className="text-xs text-slate-400">Showing {fleet.length} active units</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-4 px-6">Model</th>
                  <th className="py-4 px-6">Brand</th>
                  <th className="py-4 px-6">Reg Number</th>
                  <th className="py-4 px-6">Hourly Rate</th>
                  <th className="py-4 px-6">Daily Rate</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {fleet.map((bike) => (
                  <tr key={bike.id} className="hover:bg-slate-750 transition-colors">
                    <td className="py-4 px-6 font-bold text-white">{bike.name}</td>
                    <td className="py-4 px-6 text-slate-300">{bike.brand}</td>
                    <td className="py-4 px-6 font-mono text-xs text-yellow-300">{bike.registrationNumber}</td>
                    <td className="py-4 px-6 font-medium">₹{bike.hourlyRate}/hr</td>
                    <td className="py-4 px-6 font-medium">₹{bike.dailyRate}/day</td>
                    <td className="py-4 px-6">
                      {bike.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle size={12} /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle size={12} /> On Rent
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button onClick={() => handleOpenEdit(bike)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(bike.id)} className="p-2 hover:bg-rose-500/20 rounded-lg text-rose-400">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Component 3: PDF Receipt Engine & Meta WhatsApp API Controller ([NEW] `services/receiptService.js`)
Generates PDF receipts using `pdfkit` and dispatches document messages via Meta's WhatsApp Cloud API (`v20.0`):

```javascript
const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF Receipt using PDFKit
 */
function generateReceiptPdf(booking, payment, user, bike) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const filename = `receipt-${booking.bookingReference}.pdf`;
    const receiptPath = path.join(__dirname, '../public/receipts', filename);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    const stream = fs.createWriteStream(receiptPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('VALOHUB BIKE RENTAL', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text('Mavoor Road Hub, Kozhikode, Kerala 673004 | support@valohub.kerala.in', { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#FFC107').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1.5);

    // Metadata
    doc.fillColor('#111').fontSize(14).font('Helvetica-Bold').text('OFFICIAL BOOKING RECEIPT');
    doc.fontSize(10).font('Helvetica')
      .text(`Booking Ref: ${booking.bookingReference}`)
      .text(`Transaction ID: ${payment.gatewayReference}`)
      .text(`Date & Time: ${new Date().toLocaleString('en-IN')}`)
      .moveDown();

    // Rider & Vehicle Table
    doc.fontSize(12).font('Helvetica-Bold').text('Rider & Vehicle Details');
    doc.fontSize(10).font('Helvetica')
      .text(`Rider Name: ${user.name}`)
      .text(`Phone: ${user.phone}`)
      .text(`Driving License: ${user.drivingLicense || 'KL-11 Verified'} (MCWG)`)
      .text(`Motorcycle: ${bike.name} (${bike.engineCapacity})`)
      .text(`Pickup Hub: ${booking.pickupLocation}`)
      .text(`Pickup Schedule: ${new Date(booking.startTime).toLocaleString('en-IN')}`)
      .text(`Dropoff Schedule: ${new Date(booking.endTime).toLocaleString('en-IN')}`)
      .moveDown();

    // Financial Breakdown
    doc.fontSize(12).font('Helvetica-Bold').text('Payment Breakdown');
    doc.fontSize(10).font('Helvetica')
      .text(`Base Tariff & Add-ons: Rs. ${booking.totalAmount}`)
      .text(`Refundable Security Deposit (Held): Rs. ${booking.depositAmount}`)
      .moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#047857')
      .text(`Total Paid at Gateway: Rs. ${(Number(booking.totalAmount) + Number(booking.depositAmount)).toLocaleString('en-IN')}`)
      .moveDown(2);

    // Footer terms
    doc.fontSize(8).fillColor('#777')
      .text('Zero hidden charges. 100% security deposit refunded instantly upon return inspection.', { align: 'center' })
      .text('Thank you for riding with ValoHub Kozhikode!', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve({ receiptPath, filename }));
    stream.on('error', reject);
  });
}

/**
 * Send Receipt via Meta WhatsApp Cloud API
 */
async function sendWhatsAppReceipt(userPhone, pdfUrl, bookingRef, bikeName) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const formattedPhone = userPhone.replace(/\D/g, '').slice(-10);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `91${formattedPhone}`,
    type: 'document',
    document: {
      link: pdfUrl,
      filename: `ValoHub-Booking-${bookingRef}.pdf`,
      caption: `Namaskaram! Here is your official booking confirmation receipt for the ${bikeName}. Your machine is ready for pickup at our Kozhikode Hub!`
    }
  };

  const response = await axios.post(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

module.exports = { generateReceiptPdf, sendWhatsAppReceipt };
```

---

### Component 4: AI Customer Support WhatsApp Webhook ([NEW] `routes/whatsappWebhook.js`)
Express webhook receiving incoming customer WhatsApp messages, forwarding them to OpenAI (`gpt-4o-mini`), and replying back via WhatsApp:

```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'valohub_secret_token_123';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * GET /webhook/whatsapp
 * Meta Webhook Handshake Verification
 */
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verification successful');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * POST /webhook/whatsapp
 * Receives incoming customer messages, passes to gpt-4o-mini, replies via WhatsApp
 */
router.post('/whatsapp', async (req, res) => {
  res.sendStatus(200); // Immediate 200 acknowledge to Meta

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message || message.type !== 'text') return;

    const userPhone = message.from; // e.g. "916282567675"
    const userMessage = message.text.body;

    console.log(`[WhatsApp Incoming from ${userPhone}]: ${userMessage}`);

    // System prompt for ValoHub Customer Support
    const systemPrompt = `
You are the polite, knowledgeable customer support concierge for "ValoHub Bike Rental" in Kozhikode (Calicut), Kerala.
- Our Fleet: Exactly 3 curated boutique motorcycles:
  1. Royal Enfield Himalayan 450 (Liquid-Cooled, for Wayanad Ghats / offroad, Rs. 1599/day)
  2. Royal Enfield Classic 350 Reborn (Smooth cruiser for Kappad Beach & Beypore, Rs. 1199/day)
  3. KTM 390 Duke Gen-3 (Corner carver, Rs. 1799/day)
- Hub Location: Opposite Calicut Railway Station North Gate, Mavoor Road Junction, Kozhikode.
- Requirements: Original Indian Driving License with MCWG (Motorcycle with Gear) endorsement, Government ID, and Rs. 1500 refundable deposit (instant UPI refund).
- Complimentary: Sanitized ISI helmet and 200 km/day included.
- Tone: Welcoming ("Namaskaram!"), concise, helpful, and localized to Kozhikode.
`;

    // Forward to OpenAI gpt-4o-mini
    const openAiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 250
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const botReply = openAiResponse.data.choices[0].message.content.trim();

    // Reply back via WhatsApp Cloud API
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: userPhone,
        text: { body: botReply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[WhatsApp Reply Sent to ${userPhone}]: ${botReply}`);
  } catch (error) {
    console.error('Error processing WhatsApp Webhook:', error.response?.data || error.message);
  }
});

module.exports = router;
```

---

### Component 5: System Reliability (Redis OTP Expiration & Anti-Spam Rate Limiting)

Here is the exact architectural strategy using Redis:

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

/**
 * 1. OTP Storage with 5-minute Auto-Expiration (TTL)
 * SETEX key seconds value
 */
async function saveOtp(phone, otp) {
  // Automatically purged by Redis after 300 seconds (5 minutes)
  await redis.setex(`otp:${phone}`, 300, otp);
}

/**
 * 2. Rate-Limiting & Anti-Spam Protection (Sliding Window)
 * Rule: Maximum 3 OTP requests per phone per hour to prevent SMS spam and billing exhaustion
 */
async function checkSmsRateLimit(phone) {
  const key = `ratelimit:sms:${phone}`;
  const attempts = await redis.incr(key);

  if (attempts === 1) {
    // First attempt: set 1-hour window (3600 seconds)
    await redis.expire(key, 3600);
  }

  if (attempts > 3) {
    const ttl = await redis.ttl(key);
    throw new Error(`Too many OTP requests. Please wait ${Math.ceil(ttl / 60)} minutes before trying again.`);
  }
  return true;
}
```

---

## 3. Verification & Deployment Plan

### Automated Verification
1. Run Prisma validation: `npx prisma validate`
2. Test PDFKit generation script producing sample receipt in `scratch/test-receipt.pdf`
3. Test Redis TTL and rate-limiting keys with mock phone `6282567675`
4. Test WhatsApp Webhook mock payload with OpenAI completion endpoint

### Environment Configuration Checklist (`.env`)
- `DATABASE_URL="postgresql://user:password@localhost:5432/valohub?schema=public"`
- `REDIS_URL="redis://127.0.0.1:6379"`
- `WHATSAPP_TOKEN="EAA..."`
- `WHATSAPP_PHONE_NUMBER_ID="10928374..."`
- `WHATSAPP_VERIFY_TOKEN="valohub_secret_token_123"`
- `OPENAI_API_KEY="sk-..."`
