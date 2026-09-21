# ValoHub System Architecture & Functional Goals (`gemini.md`)

## 1. Project Goal & Core Philosophy
Create a high-conversion, boutique motorcycle and scooter rental platform tailored specifically for Kozhikode (Calicut), Kerala. Inspired by the sleek user experience of premium rental platforms, ValoHub is scaled to operate a boutique fleet of exactly 3 curated machines with zero errors, decoupled microservices, and absolute data isolation.

---

## 2. Core Architectural Decoupling Rules
1. **The Golden Rule**: Every subsystem is decoupled and operates through strict API contracts.
   - The Authentication subsystem (Email/Phone OTP via Redis) does NOT touch the Payment subsystem.
   - The Payment subsystem (Razorpay + GST) does NOT mutate user authentication state.
   - The Frontend communicates strictly via JSON over HTTP with resilient fetch handlers (`safeJsonFetch`).
2. **Deterministic Pricing**:
   - The backend is the single source of truth for pricing. Any dynamic tariff calculation (base hourly/daily tariff + 18% GST + refundable deposit) is computed and validated server-side.
   - Client-side tampering of prices or payloads is rejected by the server.

---

## 3. UI & Experience Specifications
1. **Hero Section & Sticky Booking Bar**:
   - Calicut-centric messaging promoting effortless rides from Kozhikode Beach to Wayanad Ghats.
   - Intuitive Pickup Date & Time and Dropoff Date & Time selectors using standardized 30-minute intervals (e.g. 1:00 PM, 1:30 PM, 2:00 PM).
2. **Boutique 3-Bike Fleet**:
   - **Machine 1**: Royal Enfield Himalayan 450 (Kamet White Summit Edition) — Adventure Touring (452cc liquid-cooled Sherpa engine).
   - **Machine 2**: Royal Enfield Classic 350 (Reborn Chrome Bronze) — Modern Classic Cruiser (349cc J-Series).
   - **Machine 3**: Suzuki Access 125 (Special Edition) — City Commuter & Highway Cruiser (124cc SEP engine).
3. **Public vs Admin Segregation**:
   - **Public Navbar**: Clean rider experience (Our Bikes, How It Works, Requirements, Scenic Rides, Contact, WhatsApp, Log in / Profile). No administrative links.
   - **Admin Portal**: Accessible exclusively via `/admin` with dedicated authentication (`athul` / `bkathul84@gmail.com`).
4. **GST Invoicing & Delivery**:
   - SAC 996601: Passenger motor vehicle rental without operator.
   - 18% GST itemized (9% CGST + 9% SGST).
   - Instant PDF generation, direct download link, and automatic Gmail + WhatsApp invoice delivery.
