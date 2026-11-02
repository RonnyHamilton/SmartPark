# SmartPark: Functional Modules & Architectural Catalog
## Comprehensive Functional Component Catalog

**Semester 3 Mini Project Documentation**  
**Architecture:** Decoupled 3-Tier Enterprise Web Application  
**Runtime:** Spring Boot 3 (Java 21 LTS) & React 19 (TypeScript 5 / Vite 7)  

---

## Module Index

1. [Module 1: Authentication & Identity Management](#1-authentication--identity-management)
2. [Module 2: User Profile & Security Activity Log](#2-user-profile--security-activity-log)
3. [Module 3: Parking Facility & Infrastructure Catalog](#3-parking-facility--infrastructure-catalog)
4. [Module 4: Parking Bay Inventory & Interactive 2D Visualizer](#4-parking-bay-inventory--interactive-2d-visualizer)
5. [Module 5: Vehicle Fleet & Dimensional Compatibility](#5-vehicle-fleet--dimensional-compatibility)
6. [Module 6: Booking, Dynamic Pricing & Quotation Engine](#6-booking-dynamic-pricing--quotation-engine)
7. [Module 7: Gate Check-In, Check-Out & Cryptographic QR Verification](#7-gate-check-in-check-out--cryptographic-qr-verification)
8. [Module 8: Automated Lifecycle Management (No-Show, Overstay & Conflict Engine)](#8-automated-lifecycle-management-no-show-overstay--conflict-engine)
9. [Module 9: Administrative Oversight, Operations Dashboard & Audit System](#9-administrative-oversight-operations-dashboard--audit-system)

---

## 1. Authentication & Identity Management

### Purpose
Provides secure identity lifecycle operations including user registration, credential authentication, JWT token issuance, refresh token rotation, brute-force lockout protection, and self-service password recovery.

### Main Functionalities
- Secure user registration with email format validation and uniqueness check.
- BCrypt password encryption (strength factor 12) with zero plaintext credential persistence.
- Ephemeral HMAC-SHA256 access JWT issuance (15-minute validity).
- Cryptographic single-use refresh token generation, stored hashed (SHA-256) in the database and delivered via `HttpOnly`, `SameSite=Strict` cookies.
- Automatic account lockout for 15 minutes after 5 consecutive failed login attempts.
- Self-service password recovery flow utilizing time-limited hashed reset tokens.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/auth/AuthController.java`
  - `backend/src/main/java/com/smartpark/auth/AuthService.java`
  - `backend/src/main/java/com/smartpark/security/JwtService.java`
  - `backend/src/main/java/com/smartpark/security/JwtAuthenticationFilter.java`
  - `backend/src/main/java/com/smartpark/security/SecurityConfig.java`
- **Frontend:**
  - `frontend/src/context/AuthContext.tsx`
  - `frontend/src/pages/Login.tsx`
  - `frontend/src/pages/Register.tsx`
  - `frontend/src/pages/ForgotPassword.tsx`
  - `frontend/src/pages/ResetPassword.tsx`

### Database Tables Involved
- `users`: Accounts, password hashes, roles (`USER`, `ADMIN`), status (`ACTIVE`, `DISABLED`), lockout timers.
- `refresh_tokens`: Hashed active and revoked refresh tokens.
- `password_reset_tokens`: Time-limited recovery tokens.

---

## 2. User Profile & Security Activity Log

### Purpose
Allows drivers to manage account details, customize accessibility needs, review personal security activity trails, and update passwords.

### Main Functionalities
- Retrieve authenticated user profile with driver name, email, role, and accessibility preference.
- Patch user profile attributes (name update, accessibility assistance toggle).
- Personal activity feed: query recent audit log entries executed by the logged-in user (`GET /api/v1/users/me/activity`).
- In-session password change requiring verification of previous credentials.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/user/ProfileController.java`
  - `backend/src/main/java/com/smartpark/user/UserRepository.java`
  - `backend/src/main/java/com/smartpark/audit/AuditLogRepository.java`
- **Frontend:**
  - `frontend/src/pages/Profile.tsx`

### Database Tables Involved
- `users`, `audit_logs`

---

## 3. Parking Facility & Infrastructure Catalog

### Purpose
Maintains physical infrastructure records for multi-level parking garages, floors, and facilities, providing public search, operating policies, and discovery APIs.

### Main Functionalities
- Browse facilities by city, address, operating hours, and amenities (EV Charging, CCTV, Accessible).
- Multi-floor elevation hierarchy with display ordering.
- Operational policy enforcement: opening/closing hours, advance booking limit, cancellation cutoff thresholds, check-in grace period (15 min), and overstay pricing multiplier ($1.50\times$).

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/facility/FacilityController.java`
  - `backend/src/main/java/com/smartpark/facility/FacilityService.java`
  - `backend/src/main/java/com/smartpark/facility/Facility.java`
  - `backend/src/main/java/com/smartpark/facility/ParkingFloor.java`
- **Frontend:**
  - `frontend/src/pages/Discover.tsx`
  - `frontend/src/pages/FacilityDetail.tsx`

### Database Tables Involved
- `facilities`, `parking_floors`

---

## 4. Parking Bay Inventory & Interactive 2D Visualizer

### Purpose
Maintains individual parking bay records, dimensions, equipment capabilities, and real-time availability calculations.

### Main Functionalities
- Slot categorization: `STANDARD`, `COMPACT`, `LARGE`, `EV`, `ACCESSIBLE`, `MOTORCYCLE`.
- Physical dimensions tracking (`width_m`, `length_m`) for vehicle compatibility checking.
- Interactive 2D floor visualizer based on integer coordinate mappings (`layout_x`, `layout_y`).
- Live slot availability queries for arbitrary future time windows, excluding active reservations.
- Administrative maintenance status override (`AVAILABLE` vs `OUT_OF_SERVICE`).

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/facility/FacilityController.java`
  - `backend/src/main/java/com/smartpark/facility/FacilityService.java`
  - `backend/src/main/java/com/smartpark/facility/ParkingSlot.java`
- **Frontend:**
  - `frontend/src/pages/FacilityDetail.tsx`
  - `frontend/src/pages/Book.tsx` (Bay visualizer canvas)

### Database Tables Involved
- `parking_slots`

---

## 5. Vehicle Fleet & Dimensional Compatibility

### Purpose
Allows users to register multiple personal vehicles, assign primary defaults, and validate dimensions for parking allocation.

### Main Functionalities
- Vehicle registration with automatic uppercase license plate normalization (`normalized_registration`).
- Support for vehicle categories: `CAR`, `SUV`, `MOTORCYCLE`, `EV`.
- Physical width and length specification for bay fitting checks.
- Default vehicle selection for rapid 1-click booking.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/vehicle/VehicleController.java`
  - `backend/src/main/java/com/smartpark/vehicle/VehicleService.java`
  - `backend/src/main/java/com/smartpark/vehicle/Vehicle.java`
- **Frontend:**
  - `frontend/src/pages/Profile.tsx` (Vehicles Section)

### Database Tables Involved
- `vehicles`

---

## 6. Booking, Dynamic Pricing & Quotation Engine

### Purpose
Handles transactional booking creation, slot reservation conflict prevention, cancellation workflows, rescheduling, and dynamic tariff calculations.

### Main Functionalities
- Pre-booking price quotation (`POST /api/v1/bookings/quote`): itemized tariff preview and dimensional validation before reserving.
- Reservation creation with vehicle dimension validation against slot dimensions.
- **PostgreSQL GiST exclusion constraint** mathematically guaranteeing zero double-bookings.
- Optimistic locking protecting booking entities from simultaneous modifications (`@Version`).
- Booking cancellation before cutoff threshold with automated slot liberation.
- Rescheduling of upcoming bookings to alternative time windows.
- Backend deterministic tariff calculation based on hourly, daily, and flat pricing schedules.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/booking/BookingController.java`
  - `backend/src/main/java/com/smartpark/booking/BookingService.java`
  - `backend/src/main/java/com/smartpark/pricing/PricingService.java`
  - `backend/src/main/java/com/smartpark/booking/AllocationService.java`
  - `backend/src/main/java/com/smartpark/booking/Booking.java`
- **Frontend:**
  - `frontend/src/pages/Book.tsx`
  - `frontend/src/pages/Dashboard.tsx`
  - `frontend/src/pages/BookingDetail.tsx`

### Database Tables Involved
- `bookings`, `pricing_rules`, `parking_slots`, `facilities`

---

## 7. Gate Check-In, Check-Out & Cryptographic QR Verification

### Purpose
Provides contactless gate arrival and departure verification with cryptographic tickets and overstay calculation.

### Main Functionalities
- Generation of HMAC-SHA256 signed QR pass tokens encoding reference, user ID, slot ID, and timestamp window.
- Driver self-service or gate scanner arrival verification (`POST /api/v1/bookings/{id}/check-in`).
- Gate departure checkout (`POST /api/v1/bookings/{id}/check-out`): transitions booking to `COMPLETED`, evaluates overstay duration, calculates overstay surcharge, and logs final billing.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/booking/BookingController.java`
  - `backend/src/main/java/com/smartpark/booking/BookingService.java`
  - `backend/src/main/java/com/smartpark/booking/CheckIn.java`
- **Frontend:**
  - `frontend/src/pages/BookingDetail.tsx`

### Database Tables Involved
- `check_ins`, `bookings`

---

## 8. Automated Lifecycle Management (No-Show, Overstay & Conflict Engine)

### Purpose
Autonomous background service continuously inspecting reservations, marking no-shows, applying overstay penalties, and executing slot conflict reassignments.

### Main Functionalities
- **Asynchronous Execution:** `@Scheduled(fixedDelay = 30_000)` executes every 30 seconds.
- **No-Show Processing:** Marks `CONFIRMED` bookings as `NO_SHOW` when check-in is not registered within 15 minutes of scheduled start time, immediately releasing the slot.
- **Overstay Processing:** Detects vehicles remaining parked past scheduled departure, transitions status to `OVERSTAY`, and applies accumulating penalty tariffs ($1.50\times$).
- **Proactive Conflict Reassignment:** Identifies upcoming drivers whose assigned bays are blocked by overstaying vehicles and automatically reassigns them to a vacant compatible bay in the facility.
- **Conflict Escalation:** If no alternative bay is free, escalates the booking to `CONFLICT_REQUIRES_ADMIN` for immediate operator resolution.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/booking/BookingLifecycleJob.java`
  - `backend/src/main/java/com/smartpark/booking/BookingService.java`
  - `backend/src/main/java/com/smartpark/booking/BookingRepository.java`
- **Frontend:**
  - `frontend/src/pages/Admin.tsx` (Operations Tab)

### Database Tables Involved
- `bookings`, `facilities`, `parking_slots`, `check_ins`

---

## 9. Administrative Oversight, Operations Dashboard & Audit System

### Purpose
Provides facility managers and system operators with operational oversight, conflict resolution tools, user administration, and an immutable security audit trail.

### Main Functionalities
- **Operations Overview:** Aggregated KPIs (total slots, active parkers, completed sessions, revenue) and interactive Recharts daily trend charts.
- **No-Show & Overstay Operations:** Real-time overstay dashboard tracking vehicles currently overstaying, physical bay blockage indicators, unresolved conflicts, and recent no-show audit history.
- **Conflict Resolution Modal:** Allows administrators to select an unresolved conflict (`CONFLICT_REQUIRES_ADMIN`), pick an available slot in the facility, submit resolution notes, and atomically reassign the booking.
- **Infrastructure Management:** Full CRUD operations for facilities, multi-level floors, bays, and pricing schedules.
- **Global Booking Directory:** Paginated booking search with multi-parameter filtering (by status, facility, reference, customer email) and CSV report export.
- **User Directory:** Search user accounts, promote/demote roles (`USER` vs `ADMIN`), and toggle account status (`ACTIVE` vs `DISABLED`).
- **System Audit Log Viewer:** Searchable, immutable trail of all system mutations with JSONB metadata inspection.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/admin/AdminController.java`
  - `backend/src/main/java/com/smartpark/admin/AdminService.java`
  - `backend/src/main/java/com/smartpark/audit/AuditService.java`
- **Frontend:**
  - `frontend/src/pages/Admin.tsx`

### Database Tables Involved
- `audit_logs`, `facilities`, `parking_floors`, `parking_slots`, `pricing_rules`, `bookings`, `users`
