# ValoHub Database & Security Architecture (`database.md`)

## 1. Executive Summary & Zero-Trust Principles
ValoHub operates on a **Zero-Trust, Decoupled Architecture**. Sensitive operations (administrative metrics, fleet management, and invoice audit trails) are completely decoupled from public booking and user authentication flows.

### Core Database Rules:
1. **Zero Hardcoded Secrets**: All database connection strings, JWT keys, and API secrets are loaded from protected environment variables via `.env`.
2. **Row-Level Security (RLS) & Scope Isolation**: 
   - Public users can only read their own purchase records (`GET /api/invoices/:invoiceNumber`).
   - Global financial aggregations (`SELECT * FROM payments`, `SELECT * FROM invoices`, `SELECT * FROM users`) are strictly restricted to authenticated administrators carrying valid bearer tokens (`requireAdminAuth`).
3. **Database Integrity & Decoupling**:
   - The OTP verification store (Redis / in-memory cache) operates independently of the SQL persistence store.
   - Payments and bookings maintain foreign-key constraints to guarantee financial referential integrity.

---

## 2. Production Prisma Schema (`prisma/schema.prisma`)

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
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}

enum PaymentStatus {
  CREATED
  AUTHORIZED
  CAPTURED
  FAILED
  REFUNDED
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  phone         String?
  name          String?
  drivingLicense String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  bookings      Booking[]

  @@index([email])
}

model Bike {
  id                 String    @id
  name               String
  edition            String
  category           String
  engineCapacity     String
  hourlyRate         Float
  dailyRate          Float
  depositAmount      Float
  registrationNumber String?
  isAvailable        Boolean   @default(true)
  imageUrl           String
  badge              String?
  bookings           Booking[]
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model Booking {
  id             String        @id
  userId         String
  bikeId         String
  user           User          @relation(fields: [userId], references: [id])
  bike           Bike          @relation(fields: [bikeId], references: [id])
  pickupDate     DateTime
  dropoffDate    DateTime
  pickupLocation String
  totalDays      Float
  baseAmount     Float
  cgst           Float
  sgst           Float
  totalGst       Float
  depositAmount  Float
  totalAmount    Float
  status         BookingStatus @default(PENDING)
  payment        Payment?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([userId])
  @@index([bikeId])
}

model Payment {
  id               String        @id
  bookingId        String        @unique
  booking          Booking       @relation(fields: [bookingId], references: [id])
  orderId          String
  amount           Float
  currency         String        @default("INR")
  status           PaymentStatus @default(CREATED)
  paymentMethod    String        @default("UPI")
  razorpaySignature String?
  invoiceNumber    String        @unique
  pdfPath          String
  createdAt        DateTime      @default(now())
}
```

---

## 3. Microservice Decoupling & Isolation
- **Authentication Service**: Operates with Redis TTL caches. Never modifies financial or invoice rows.
- **Payment Gateway Service**: Validates HMAC SHA-256 signatures server-side before persisting confirmed payment records.
- **GST Invoice Service**: Calculates 18% GST (SAC 996601: 9% CGST + 9% SGST) and compiles official PDF tax receipts locally.
- **Admin Management API**: Gated behind `requireAdminAuth`. All responses sanitize sensitive credentials.
