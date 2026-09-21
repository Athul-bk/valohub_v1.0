System Prompt: ValoHub Secure Payment Service Architecture

Objective:
Build a highly secure, multi-option payment service for the ValoHub bike rental platform using PostgreSQL and the Razorpay API to handle Google Pay (UPI), Credit/Debit Cards, and NetBanking. The architecture must prioritize zero-trust database security, ensuring raw financial data is completely isolated and strictly accessible only by the admin.

1. Payment Gateway Integration (Razorpay SDK)

Gateway Provider: Implement the Razorpay Standard Checkout API. This offloads PCI-DSS compliance, ensuring ValoHub's servers never touch or store raw credit card numbers or UPI PINs.

User Options: Enable the UPI intent flow (optimized for Google Pay/PhonePe on mobile) and standard Card/Netbanking options.

Checkout Flow:

Backend receives the calculated rental cost (including 18% GST).

Backend requests a unique order_id from Razorpay and sends it to the frontend.

Frontend triggers the Razorpay modal.

Upon completion, the frontend sends the razorpay_payment_id and razorpay_signature to the backend.

2. Webhook Verification & Transaction Integrity

Zero-Spoofing Rule: The backend must NEVER trust frontend payment success messages.

HMAC Validation: Implement a webhook endpoint to receive server-to-server updates from Razorpay. Validate the payload signature using HMAC SHA256 and your Razorpay secret key before updating any database record to "Paid."

Idempotency: Ensure webhook processing is idempotent so that duplicate Razorpay network events do not result in double-booking or double-crediting.

3. High-Security Database Hardening (PostgreSQL)

Network Isolation: The PostgreSQL database must reside in a private subnet (VPC) with public access completely disabled.

Admin-Only Access Tunnel: Admin access to the database must be routed through a secure VPN or an SSH Bastion Host.

Role-Based Access Control (RBAC): Implement strict database roles.

The application_role used by the backend API is only granted INSERT and UPDATE permissions on the payment tables. It cannot SELECT (read) the full ledger.

The admin_role requires a separate set of highly secure credentials and is the only role with global SELECT and DELETE permissions.

Encryption: Implement Encryption at Rest (KMS) and Encryption in Transit (TLS 1.2+ mandatory). Use the PostgreSQL pgcrypto extension to column-level encrypt sensitive PII (like billing addresses or user phone numbers) associated with the transaction.

4. Payment Table Schema
Design the transactions table to track the payment lifecycle securely:

id (UUID, Primary Key)

booking_id (Foreign Key, linked to the rental reservation)

user_id (Foreign Key, linked to the user table)

razorpay_order_id (String, Unique)

razorpay_payment_id (String, Unique, Nullable until captured)

amount_paise (Integer — always store currency in smallest units to prevent floating-point calculation errors)

status (Enum: pending, authorized, captured, failed, refunded)

payment_method (String: upi, card, netbanking)

created_at (Timestamp, Default NOW)

Using Razorpay is the standard approach here because they take on the legal and technical burden of securely processing the actual card details. Your database only needs to securely store the tokens (Order ID and Payment ID) that prove the transaction happened.
