# SmartPark: Functional Modules & Component Catalog

This document details the **6 core verified primary modules** comprising the SmartPark software architecture. Every module is verified against the live source code and PostgreSQL 16 database schema, with all decorative and unintegrated features removed.

---

## Module Index

1. [Module 1: Authentication & User Management](#1-authentication--user-management)
2. [Module 2: Parking Facility Management](#2-parking-facility-management)
3. [Module 3: Parking Slot & Inventory Management](#3-parking-slot--inventory-management)
4. [Module 4: Vehicle Fleet Management](#4-vehicle-fleet-management)
5. [Module 5: Booking & Reservation Management](#5-booking--reservation-management)
6. [Module 6: Administration, Reporting & Audit System](#6-administration-reporting--audit-system)

---

## 1. Authentication & User Management

### Purpose
Provides secure identity lifecycle operations including account registration, credential authentication, JWT token issuance, refresh token rotation, and brute-force lockout protection.

### Main Functionalities
- Secure user registration with email format and uniqueness validation.
- BCrypt password hashing (strength 12) with zero plaintext credential persistence.
- Ephemeral HMAC-SHA256 access JWT issuance (15-minute validity).
- Cryptographic single-use refresh token generation, hashed storage in database, and delivery via `HttpOnly` cookie.
- Automatic account lockout for 15 minutes after 5 consecutive failed login attempts.
- In-session password updates verifying previous password validity.

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

### Database Tables Involved
- `users`: Accounts, password hashes, roles (`USER`, `ADMIN`), status (`ACTIVE`, `DISABLED`), lockout timers.
- `refresh_tokens`: Hashed active and revoked refresh tokens.
- `password_reset_tokens`: Time-limited recovery tokens.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Register new user account |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & issue tokens |
| `POST` | `/api/v1/auth/refresh` | Public (Cookie) | Rotate refresh token & issue new JWT |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke refresh token & clear cookie |
| `GET` | `/api/v1/auth/me` | Authenticated | Return currently logged-in user profile |
| `POST` | `/api/v1/auth/change-password` | Authenticated | Change user account password |

---

## 2. Parking Facility Management

### Purpose
Maintains physical infrastructure records for multi-level parking garages, floors, and facilities, providing public search and discovery APIs.

### Main Functionalities
- Browse facilities by city, address, operating hours, and amenities (EV Charging, CCTV, Accessible).
- Multi-floor breakdown showing level order and elevation hierarchy.
- Operational constraints: opening/closing hours, advance booking limit, cancellation cutoff thresholds.

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
- `facilities`: Facility metadata, coordinates, opening/closing hours, duration constraints.
- `parking_floors`: Multi-level floor definitions per facility.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/facilities` | Public | Search parking facilities with query filters |
| `GET` | `/api/v1/facilities/{id}` | Public | Get detailed facility metadata |
| `GET` | `/api/v1/facilities/{id}/floors` | Public | Get floors and associated slots |

---

## 3. Parking Slot & Inventory Management

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
  - `frontend/src/pages/Book.tsx` (Bay selection)

### Database Tables Involved
- `parking_slots`: Individual parking bays, physical dimensions, hardware features, and coordinates.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/facilities/{id}/availability` | Public | Query available bays for target time window |
| `PUT` | `/api/v1/admin/slots/{id}/status` | `ROLE_ADMIN` | Override slot status (`AVAILABLE` / `OUT_OF_SERVICE`) |

---

## 4. Vehicle Fleet Management

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
  - `frontend/src/pages/Profile.tsx` (Vehicles tab)

### Database Tables Involved
- `vehicles`: Vehicle attributes, dimensions, normalization, default flag, and foreign key to `users`.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/vehicles` | Authenticated | List all vehicles owned by authenticated user |
| `POST` | `/api/v1/vehicles` | Authenticated | Register a new vehicle |
| `DELETE` | `/api/v1/vehicles/{id}` | Authenticated | Delete a vehicle |
| `PUT` | `/api/v1/vehicles/{id}/default` | Authenticated | Set specified vehicle as default |

---

## 5. Booking & Reservation Management

### Purpose
Handles transactional booking creation, slot reservation conflict prevention, cancellation workflows, rescheduling, and dynamic tariff calculations.

### Main Functionalities
- Reservation creation with vehicle dimension validation against slot dimensions.
- **PostgreSQL GiST exclusion constraint** mathematically guaranteeing zero double-bookings.
- Optimistic locking protecting booking entities from simultaneous modifications.
- Booking cancellation before cutoff threshold with automated slot liberation.
- Rescheduling of upcoming bookings to alternative time windows.
- Backend deterministic tariff calculation based on hourly and daily pricing schedules.
- Official Reservation Pass generation with human-readable reference code (`SP-XXXXXXXX`).

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
- `bookings`: Core reservation ledger with references, timestamps, prices, and status.
- `pricing_rules`: Tariff schedules per facility.
- `parking_slots`: Target bay being reserved.
- `vehicles`: Vehicle linked to reservation.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/bookings` | Authenticated | Create reservation with server-computed fare |
| `GET` | `/api/v1/bookings` | Authenticated | List all bookings for authenticated user |
| `GET` | `/api/v1/bookings/{id}` | Authenticated (Owner/Admin)| Fetch details for specific booking |
| `POST` | `/api/v1/bookings/{id}/cancel` | Authenticated (Owner/Admin)| Cancel active or upcoming reservation |
| `POST` | `/api/v1/bookings/{id}/reschedule` | Authenticated (Owner/Admin)| Change reservation time window |

---

## 6. Administration, Reporting & Audit System

### Purpose
Provides administrative users with macro-level facility oversight, bay state maintenance control, user role management, revenue reporting, and security audit inspection.

### Main Functionalities
- Executive dashboard with live database metrics: total slots, active parkers, completed sessions, and revenue.
- Slot maintenance toggle (marking broken slots `OUT_OF_SERVICE`).
- Global booking inspection and administrative cancellation.
- User management: changing user roles (`USER` vs `ADMIN`) and account status (`ACTIVE` vs `DISABLED`).
- Immutable security audit logging trail tracking all critical system mutations.

### Key Source Files
- **Backend:**
  - `backend/src/main/java/com/smartpark/admin/AdminController.java`
  - `backend/src/main/java/com/smartpark/audit/AuditService.java`
  - `backend/src/main/java/com/smartpark/audit/AuditLog.java`
- **Frontend:**
  - `frontend/src/pages/Admin.tsx`

### Database Tables Involved
- `audit_logs`: Security and operational audit trail with JSONB metadata.
- `facilities`, `parking_slots`, `bookings`, `users`.

### REST Endpoints
| HTTP Method | Path | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | `ROLE_ADMIN` | Retrieve aggregated administrative statistics |
| `GET` | `/api/v1/admin/analytics` | `ROLE_ADMIN` | Retrieve daily revenue and booking trend metrics |
| `GET` | `/api/v1/admin/bookings` | `ROLE_ADMIN` | Search and filter all global bookings |
| `GET` | `/api/v1/admin/users` | `ROLE_ADMIN` | Search users and manage roles/status |
| `PUT` | `/api/v1/admin/slots/{id}/status` | `ROLE_ADMIN` | Override slot status (`AVAILABLE` / `OUT_OF_SERVICE`) |
| `GET` | `/api/v1/admin/audit-logs` | `ROLE_ADMIN` | Retrieve system-wide security audit logs |
