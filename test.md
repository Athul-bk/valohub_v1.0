Here is the corrected version of your request:

> "Please fix this issue and solve all related problems. Make sure everything is working and properly connected. Why does it happen that fixing one bug breaks something else? Please ensure the website works properly without any failures. Take your time—do not rush it. Build it with zero errors. Please review and correct all the statements mentioned in the following .md files: `database.md`, `gemini.md`, `guidelines.md`, `login_signup.md`, `otp.md`, `otpissues.md`, `payment.md`, and `paymentvia.md`. Make sure everything mentioned above is properly aligned. Then, test the system like a software tester, ensure everything works perfectly, and provide a test report. Lastly"

## Why Fixing One Bug Breaks Another (Regression)

What you are experiencing is called a **Software Regression**. It happens when code is "tightly coupled"—meaning the payment system relies on the same shared logic as the OTP system. When you change a variable to fix the OTP, the payment system unexpectedly receives the wrong data and crashes. The only way to stop this loop and achieve "zero errors" is to move slowly, decouple the components, and write automated tests that check every feature every time you save the code.

To build this slowly, systematically, and flawlessly, here is the corrected architectural alignment for your ValoHub documentation files, followed by a formal QA testing report structure.

## Master Documentation Alignment (.md Files)

To ensure nothing breaks, all of your documentation files must follow these strict, unified rules.

**1. Architecture & Rules (`guidelines.md`, `gemini.md`)**

* **The Golden Rule:** Every microservice must be isolated. The OTP service cannot directly modify the payment service. They must communicate only through strict API endpoints.
* **AI/Logic:** Any dynamic pricing algorithms (base rate + market demand) must return structured, predictable data (e.g., standard JSON) to the frontend.

**2. Database & Security (`database.md`)**

* **Zero Trust Enforcement:** No static passwords in the codebase. Use JIT (Just-In-Time) credentials.
* **Role-Based Access (RLS):** The application role can only `INSERT` or `UPDATE` its own transaction rows. Global `SELECT` operations are restricted to the multi-factor authenticated admin role.

**3. Authentication Lifecycle (`login&siginup.md`, `otp.md`, `otpissues.md`)**

* **State Management:** The frontend must never hold sensitive user data in local storage. Use secure, HttpOnly cookies for session tokens after OTP validation.
* **OTP Fail-safes:**
* Implement rate limiting (e.g., max 3 OTP requests per 5 minutes) to prevent SMS spam.
* OTP must expire precisely 60 seconds after generation.
* Fix for OTP Issues: The backend must invalidate the OTP immediately upon a single failed or successful entry to prevent replay attacks.



**4. Financial Engine (`payment.md`, `paymentvia.md`)**

* **Gateway Isolation:** Raw payment data (card numbers, UPI PINs) never touches ValoHub servers. Razorpay SDK handles everything.
* **Zero-Spoofing Webhooks:** Database payment status (`pending` to `captured`) is ONLY updated via server-to-server Razorpay webhooks validated with HMAC SHA-256 signatures. The frontend success screen cannot update the database.
* **GST Calculation:** The backend calculates the 18% GST server-side before generating the Razorpay `order_id` to prevent frontend manipulation.

---

## Software Tester QA Report: ValoHub Release Candidate

To ensure everything is connected and working, execute this rigorous testing checklist.

**Test Phase 1: Authentication (OTP & Login)**

* [ ] **Action:** Request OTP with a valid phone number.
* *Expected Result:* SMS arrives within 5 seconds. Database stores hashed OTP with a 1-minute expiration.


* [ ] **Action:** Enter incorrect OTP three times.
* *Expected Result:* System locks the attempt. Requires a fresh OTP request.


* [ ] **Action:** Enter expired OTP (after 61 seconds).
* *Expected Result:* System rejects with "OTP Expired" error.


* [ ] **Action:** Re-use a successfully verified OTP.
* *Expected Result:* System rejects. OTP was invalidated upon first successful use.



**Test Phase 2: Database Integrity (Zero Trust)**

* [ ] **Action:** Attempt to query `SELECT * FROM transactions` using the standard application API key.
* *Expected Result:* Database throws a `Permission Denied` error due to Row-Level Security.


* [ ] **Action:** Simulate a frontend request injecting a modified user ID.
* *Expected Result:* Database rejects the request; the session cookie does not match the modified ID.



**Test Phase 3: Payment Gateway (Razorpay & GST)**

* [ ] **Action:** Add a Himalayan 450 to the cart and intercept the frontend network request to change the price from ₹1500 to ₹10.
* *Expected Result:* Backend ignores frontend pricing, calculates base + 18% GST server-side, and initiates a Razorpay order for the correct ₹1500 amount.


* [ ] **Action:** Complete a successful UPI payment via Razorpay.
* *Expected Result:* Razorpay modal closes. Backend awaits the HMAC-verified webhook before updating the database status to `captured`.


* [ ] **Action:** Simulate a fake "Payment Success" payload from the frontend.
* *Expected Result:* Backend rejects the payload because it lacks the cryptographically signed Razorpay signature.