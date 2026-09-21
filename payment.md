

**Project: ValoHub Bike Rental – Payment & Invoicing System**

Build a modern web application for ValoHub Bike Rental with the following features:

**1. Core Stack**
- Backend: Node.js (Express) or Python (Django/FastAPI)
- Frontend: React or Next.js
- Database: PostgreSQL or MySQL, hosted locally (all data stored locally, no cloud DB)
- Authentication: JWT-based sessions + OTP verification

**2. User Authentication (OTP-based)**
- Users register/login with phone number
- Generate a 6-digit OTP, valid for 5 minutes, sent via SMS or WhatsApp
- Store OTP hashed in DB with expiry timestamp
- Verify OTP before granting JWT session token
- Rate-limit OTP requests to prevent abuse (e.g., max 3 per 10 minutes)

**3. Online Payment**
- Integrate a payment gateway (Razorpay/Stripe/PayU — specify which one you prefer)
- Support UPI, card, and net banking
- Store transaction ID, status, amount, and timestamp locally in DB
- Webhook handler to confirm payment success/failure

**4. GST-Compliant Invoicing**
- On successful payment, auto-generate an invoice with:
  - Base rental amount
  - GST @ 18% split as 9% CGST + 9% SGST (shown as separate line items)
  - Total amount (base + CGST + SGST)
  - Invoice number (sequential/unique), date, customer details, bike details
- Generate invoice as PDF, stored locally on server (e.g., `/invoices/{invoice_id}.pdf`)

**5. WhatsApp Invoice Delivery**
- Integrate WhatsApp Business API (via Meta Cloud API or a provider like Twilio/Gupshup/Interakt)
- Generate and store an API access token securely (in `.env`, not hardcoded)
- On invoice generation, auto-send the PDF invoice to the customer's WhatsApp number using a document message template
- Log delivery status (sent/delivered/failed) in DB

**6. Local Database Schema (example tables)**
- `users` (id, name, phone, email, password_hash, created_at)
- `otp_verifications` (id, user_id, otp_hash, expires_at, verified)
- `bikes` (id, model, plate_number, rate_per_hour, status)
- `bookings` (id, user_id, bike_id, start_time, end_time, amount)
- `payments` (id, booking_id, transaction_id, status, amount, gateway)
- `invoices` (id, booking_id, invoice_number, base_amount, cgst, sgst, total_amount, pdf_path, whatsapp_status)
- `admins` (id, username, password_hash, role)

**7. Admin Panel**
- Separate login for admin (username/password, optionally OTP too)
- Admin dashboard to:
  - View/manage all bookings and payments
  - View/download invoices
  - Manage bike inventory
  - View WhatsApp delivery logs
  - Create/manage admin accounts (role-based access)

**8. Security Notes**
- Store API keys/tokens in environment variables, not in code
- Hash passwords and OTPs (bcrypt)
- Use HTTPS in production
- Validate/sanitize all inputs

---

A couple of things worth deciding before you build this out — which payment gateway and which WhatsApp API provider you want to use, since setup differs a fair bit between them.