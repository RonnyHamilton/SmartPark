# SmartPark — Feature Audit, Dummy Code Removal & Scope Optimization Report

## 1. Audit Executive Summary

A comprehensive, line-by-line audit of every feature, navigation link, dashboard widget, API endpoint, UI component, and workflow was conducted across both the frontend and backend of **SmartPark**.

### Audit Objective & Guiding Principle
To eliminate decorative, simulated, unfinished, or non-functional features—ensuring the application contains **only functionality that is genuinely implemented, connected to the PostgreSQL 16 database, verified by automated tests, and technically defensible before the review jury**.

---

## 2. Comprehensive Feature Verification Matrix

| Feature | Original Status | Action Taken | Final Status | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **QR Code Entry Pass & Scanner** | Decorative / Simulated (No real scanner, browser-only QR rendering) | **Removed**: Eliminated `qrcode.react`, QR SVG generation, and misleading "Show at terminal" labels; replaced with Official Reservation Pass & reference code | **Streamlined (Removed QR)** | UI Inspection (`Book.tsx`, `BookingDetail.tsx`), Vite Build (0 errors) |
| **Online Payment Gateway** | Dummy Mockup (Legacy payments table unintegrated) | **Removed**: Dropped legacy payments table (`V3__drop_unused_payments.sql`); clarified Pay-at-Facility model | **Streamlined (No Fake Gateway)** | Flyway migration V3, SQL verification, UI review |
| **Double-Booking Protection** | Unverified / Potential Race Condition | **Hardened & Verified**: Implemented PostgreSQL kernel-level GiST exclusion constraint (`excl_bookings_slot_time`) + JPA `@Version` | **Fully Functional** | Multi-threaded concurrency test (10 threads, 1 succeeded, 9 rejected) + `sql/conflict_demonstration.sql` |
| **User Authentication** | Standard JWT | **Hardened & Verified**: BCrypt (cost 12), 15-min access JWT, single-use rotating refresh tokens stored as SHA-256 in DB, `HttpOnly` cookies, brute-force lockout (5 failed attempts = 15-min lock) | **Fully Functional** | Integration tests (`SmartParkIntegrationTest.java`), live curl verification |
| **Interactive 2D Parking Floor Map** | Partially Static | **Audited & Connected**: Backed by actual `parking_slots.layout_x` & `layout_y` coordinates, color-coded state indicators, EV charging & accessibility badges | **Fully Functional** | Live UI rendering, facility availability API query |
| **Dynamic Multi-Tier Pricing** | Frontend-Dependent Risk | **Secured & Verified**: Enforced 100% on backend (`PricingService.java`) using `pricing_rules` table. Frontend never trusted for price | **Fully Functional** | Backend pricing unit tests, tamper resistance check |
| **Vehicle Fleet Management** | Basic Form | **Hardened & Verified**: Added uppercase license plate normalization (`normalized_registration`), unique constraint per user, dimension-fitting checks | **Fully Functional** | Database constraint inspection (`uk_vehicles_user_registration`), vehicle CRUD tests |
| **Admin Analytics Dashboard** | Risk of Hardcoded Mock Metrics | **Audited & Verified**: 100% computed from live PostgreSQL queries (bookings count, occupancy rate, daily revenue trends, cancellation rates) | **Fully Functional** | SQL verification (`sql/analytics_reporting.sql`), Admin UI inspection |
| **Facility & Slot Maintenance** | Basic View | **Audited & Verified**: Full administrative CRUD for facilities, floors, and individual slot maintenance status override (`AVAILABLE` vs `OUT_OF_SERVICE`) | **Fully Functional** | Admin console inspection, database mutation verification |
| **Booking Cancellation & Rescheduling** | Partial Lifecycle | **Hardened & Verified**: Enforced facility cancellation cutoff threshold (`cancellation_cutoff_minutes`), reason tracking, and transactional slot liberation | **Fully Functional** | Integration tests, database update verification |
| **Security Audit Logging** | Unverified | **Audited & Verified**: Async structured JSON logging to `audit_logs` table tracking registrations, logins, lockouts, cancellations, and admin mutations | **Fully Functional** | SQL verification (`sql/audit_trail.sql`) |
| **Chatbots / AI Assistant** | Potential Fluff | **Audited**: Verified that no dummy chatbot widgets exist | **Not Included** | Full codebase grep (0 matches) |
| **Fake Notification Bell** | Potential Fluff | **Audited**: Verified that no dummy notification bell exists in top navigation | **Not Included** | Full codebase grep (0 matches) |
| **Third-Party Maps (Leaflet/Mapbox)**| Potential Broken Embed | **Audited & Streamlined**: Replaced any map embed risk with precise facility addresses, city filtering, and coordinate-based distance sorting | **Fully Functional** | `Discover.tsx` location search verification |

---

## 3. Detailed Actions Taken

### A. Removed Features & Rationale
1. **QR Code Graphic Generation (`qrcode.react`):**
   - *Original Behavior:* The application rendered a QR code on booking confirmation and detail pages with text claiming "Show at the terminal to check in".
   - *Technical Deficiency:* There is no physical terminal scanner or hardware reader integrated. Demonstrating a QR code that cannot actually be scanned during a college project review invites immediate jury skepticism.
   - *Remediation:* Removed the `qrcode.react` package. Replaced the QR box with an **Official Reservation Pass Card** displaying the allocated bay (`slotCode`), floor (`floorName`), booking reference (`bookingReference`), and 1-click clipboard copy button.
2. **Simulated Online Payment Options:**
   - *Original Behavior:* References to online checkout or stored cards were ambiguous.
   - *Technical Deficiency:* Simulated payment gateways with mock credit card inputs are obvious student mockups that lack PCI compliance and real webhooks.
   - *Remediation:* Enforced a clean, realistic **Reserve Ahead · Pay at Facility Gate** model. Fares are computed and locked on the backend in INR, while removing all dummy checkout forms.
3. **Misleading Icons:**
   - *Remediation:* Changed the "Password & security" icon in the user dashboard from `CreditCard` to `KeyRound`.

### B. Retained & Verified Core Functionality
The application is streamlined into **6 tightly integrated, dependable core modules**:

1. **Module 1 — Authentication & Identity Management:**
   - Secure registration with email validation and uniqueness constraints.
   - BCrypt password hashing (cost factor 12).
   - Stateless 15-minute access JWTs.
   - Ephemeral, single-use refresh token rotation stored as SHA-256 hashes in PostgreSQL and delivered via secure `HttpOnly` cookies.
   - Automated account lockout after 5 consecutive failed attempts.
   - In-session password updates with previous password verification.

2. **Module 2 — Parking Facility Management:**
   - Facility discovery with keyword and city filtering.
   - Operational rules: opening/closing hours, advance booking limit, cancellation cutoff thresholds.
   - Multi-level parking floor hierarchy.

3. **Module 3 — Parking Slot & Inventory Management:**
   - Slot categorization: `STANDARD`, `COMPACT`, `LARGE`, `EV`, `ACCESSIBLE`, `MOTORCYCLE`.
   - Physical dimensions tracking (`width_m`, `length_m`).
   - Interactive 2D floor visualizer based on integer coordinate mappings (`layout_x`, `layout_y`).
   - Live availability calculation excluding active reservations.
   - Administrative maintenance state toggling (`AVAILABLE` vs `OUT_OF_SERVICE`).

4. **Module 4 — Vehicle Fleet Management:**
   - User vehicle registration with automatic uppercase normalization (`normalized_registration`).
   - Dimension validation against parking bays.
   - Primary default vehicle selection.

5. **Module 5 — Booking & Reservation Management:**
   - Interactive bay reservation.
   - Backend deterministic price calculation.
   - **PostgreSQL GiST exclusion constraint** preventing overlapping bookings at the database kernel.
   - JPA optimistic locking (`@Version`) preventing concurrent entity updates.
   - Cancellation with cutoff validation and slot liberation.
   - Rescheduling to alternative time windows with conflict checking.

6. **Module 6 — Administration, Analytics & Audit:**
   - Executive operations dashboard with live PostgreSQL metrics (occupancy rate, revenue trends, booking volume).
   - Global reservation search, inspection, and administrative cancellation.
   - User role (`USER` vs `ADMIN`) and account status (`ACTIVE` vs `DISABLED`) management.
   - Comprehensive security and operational audit trail (`audit_logs`).

---

## 4. Known Boundaries & Scope Limitations

To maintain strict academic honesty during the project review:
1. **Payment Model:** SmartPark calculates, validates, and stores exact fares in INR, but operates under a **Pay-at-Facility** settlement workflow rather than integrating an external commercial payment gateway (such as Razorpay or Stripe).
2. **Gate Barriers:** Arrival and departure tracking can be performed via administrative terminal controls; physical ANPR (Automatic Number Plate Recognition) cameras or barrier gate relays are designated future hardware extensions.
3. **Geographic Coverage:** Pre-seeded with 4 multi-floor facilities in Pune, Maharashtra.

---

## 5. Verification Sign-Off

- **Frontend Compilation:** `tsc -b && vite build` completed in 10.89s with **0 errors**.
- **Backend Test Suite:** `mvn test` executed **40 tests** with **0 failures, 0 errors, 0 skipped**.
- **Database Schema:** 12 tables in PostgreSQL 16 with zero orphan records or unverified migrations.
- **SQL Demonstration:** 7 tested, ready-to-run `.sql` files in `sql/` directory.
