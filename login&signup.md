# ValoHub Authentication Lifecycle (`login&signup.md`)

## 1. Overview & Flow Architecture
ValoHub implements a streamlined, 3-screen passwordless authentication workflow powered by **Email OTP** (with phone fallback and auto-registration). The architecture is decoupled: authentication verifies the rider's identity, persists a clean session object, and never leaks operational database secrets to the browser.

---

## 2. Screen Specifications

### Screen 1: "Log in or Sign up"
- **Heading**: "Log in or Sign up"
- **Email Input Field**: Dedicated email input with envelope icon, placeholder `"Enter your email address (e.g. rider@gmail.com)"`.
- **Tax Invoice Checkbox**: Checked by default (`"Send booking confirmation & tax invoice to my email"`).
- **Primary CTA**: `"GET VERIFICATION CODE"` button.
- **Footer Legal**: Clickable links to `"Terms & Conditions"` and `"Privacy Policy"`.
- **Action**: Calls `POST /send-otp` with `{ email: "rider@example.com" }`. Validates email format, checks Redis rate limiting (max 5 requests/hr), and transitions to Screen 2.

### Screen 2: "Confirm Verification Code"
- **Heading**: "Confirm Verification Code"
- **Sub-heading**: `"Enter 6-digit code sent to your email"` with recipient email displayed and a pencil (edit) icon to modify.
- **OTP Inputs**: 6 distinct square boxes with auto-advance, backspace navigation, and paste support.
- **Countdown Timer**: 26-second countdown timer (`"Resend OTP (26s)"`), switching to clickable `"Resend OTP"` upon expiry.
- **Primary CTA**: `"SUBMIT"` button.
- **Action**: Calls `POST /verify-otp` with `{ email, otp }`.
  - On 3 incorrect attempts: Locks attempt and invalidates the code.
  - On success: Consumes and deletes the OTP immediately to prevent replay attacks.
  - If existing rider: Automatically logs in, closes modal, and resumes pending booking.
  - If new rider: Advances to Screen 3.

### Screen 3: "Create account"
- **Heading**: "Create account"
- **Input 1**: `"Enter Name as per Aadhaar/Passport"`
- **Input 2**: `"Enter your phone number as WhatsApp"`
- **Primary CTA**: `"SUBMIT"` button (centered light-gray pill button with bold dark text).
- **Action**: Validates full name and 10-digit WhatsApp number, saves verified rider profile to storage, syncs with `/api/user/session`, updates navbar user avatar/pill with first name initial, and resumes any pending bike reservation.

---

## 3. Network Resilience & Error Prevention
- All authentication fetch requests use `safeJsonFetch` with dynamic port detection.
- Eliminates `Failed to execute 'json' on 'Response': Unexpected end of JSON input` by verifying network responses before parsing and providing clear feedback if the backend is restarting.
