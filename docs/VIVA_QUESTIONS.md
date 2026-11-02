# SmartPark: Viva Voce & Review Jury Question Bank
## 65 Essential Technical Questions & Model Answers

This question bank prepares students for technical reviews, external examinations, and project viva voce for the **SmartPark** mini project.

---

### Category 1: Project Fundamentals & Motivation

#### Q1: What is the SmartPark project and what problem does it solve?
**Answer:** SmartPark is an enterprise-grade smart parking management platform that automates facility discovery, bay reservations, pricing calculation, gate arrival verification, and parking inventory management. It eliminates the 15–20 minutes drivers typically spend cruising for open spaces, reduces urban traffic congestion and emissions, and prevents parking disputes through deterministic slot allocations.

#### Q2: What makes SmartPark different from a standard parking management application?
**Answer:** Unlike simplistic CRUD parking mockups, SmartPark enforces **zero double-booking** at the PostgreSQL database kernel level using GiST exclusion constraints, features cryptographic JWT and rotating refresh-token security, models multi-level physical floor plans with dimensional bay matching, and provides a real-time reactive UI with zero mock data.

#### Q3: What were your primary objectives when developing this project?
**Answer:**
1. Provide a reliable, concurrent booking engine that mathematically prevents double bookings.
2. Build a secure, stateless REST API following Spring Security 6 best practices.
3. Design a normalized, constraint-driven PostgreSQL 16 database schema version-controlled via Flyway.
4. Deliver an intuitive, responsive React 19 single-page application with interactive 2D floor maps.

#### Q4: Who are the target users of SmartPark?
**Answer:** Two main personas:
1. **Registered Drivers/Commuters:** Search facilities, register multiple vehicles, reserve bays, receive digital QR tickets, and manage bookings.
2. **Facility Managers/Admins:** Monitor global parking inventory, configure multi-tier tariffs, toggle bay maintenance states, perform gate check-ins, and inspect audit logs.

#### Q5: What is the project scope and its boundaries?
**Answer:** The current scope covers commercial lots, airport parking, and corporate tech parks with hourly and daily booking schedules in urban centers (e.g., Pune). It includes gate check-in workflows and audit tracking, while automated physical hardware integrations (ANPR camera feeds and barrier gate relays) remain future extensions.

---

### Category 2: Architecture & Technology Stack

#### Q6: Explain the high-level architecture of SmartPark.
**Answer:** SmartPark employs a decoupled, three-tier client-server architecture:
1. **Presentation Layer:** React 19 SPA with TypeScript and Vite.
2. **Application Layer:** Stateless Spring Boot 3 REST API in Java 21 LTS with Spring Security 6 and Spring Data JPA.
3. **Data Layer:** PostgreSQL 16 relational database with Flyway migration management and Adminer web administration.

#### Q7: How many functional modules are implemented in your codebase?
**Answer:** Exactly **7 modules**:
1. Authentication & Identity Management
2. Parking Facility & Inventory Catalog
3. Reservation & Slot Allocation Engine
4. Gate Check-In & Departure Verification
5. Dynamic Pricing Engine
6. Vehicle Fleet Management
7. Administration, Monitoring & Audit System

#### Q8: Why did you choose Spring Boot for the backend?
**Answer:** Spring Boot 3 provides a production-grade, enterprise-ready Java ecosystem offering robust dependency injection, declarative transaction management (`@Transactional`), mature ORM integration with Hibernate 6, native Spring Security 6 integration, and high throughput on Java 21 virtual threads.

#### Q9: Why did you select React with TypeScript rather than plain HTML/JavaScript?
**Answer:** React's component-based model enables reusable UI components (e.g., interactive floor maps and reservation forms), while TypeScript provides compile-time static type safety ensuring the frontend strictly adheres to the backend REST API DTO contracts.

#### Q10: How do the frontend and backend communicate?
**Answer:** Via asynchronous HTTP RESTful JSON APIs using the Axios client. Axios is configured with an automated response interceptor that handles silent token refresh upon receiving HTTP 401 Unauthorized errors.

#### Q11: What is a REST API and what HTTP verbs do you utilize?
**Answer:** Representational State Transfer (REST) is an architectural style utilizing standard HTTP methods:
- `GET` — Retrieve resources (facilities, bookings, profile).
- `POST` — Create new resources (register user, create booking, execute check-in).
- `PUT` — Update or replace resources (toggle slot status, set default vehicle).
- `DELETE` — Remove resources (delete vehicle).

#### Q12: Why is your application server stateless?
**Answer:** A stateless server stores no client session data in JVM memory. Authentication is validated per request via JWT tokens and database-backed refresh tokens, enabling horizontal scaling across multiple instances without sticky sessions.

---

### Category 3: Database & Data Modeling

#### Q13: Which database engine did you select and why?
**Answer:** PostgreSQL 16. It offers superior concurrency control (MVCC), rich data types (UUID, JSONB, native timestamps with timezone, range types), and crucial extension capabilities—specifically the `btree_gist` module required to enforce temporal exclusion constraints.

#### Q14: Exactly how many tables are in your database?
**Answer:** Exactly **12 tables**: 11 application domain tables (`users`, `vehicles`, `facilities`, `parking_floors`, `parking_slots`, `pricing_rules`, `bookings`, `check_ins`, `refresh_tokens`, `password_reset_tokens`, `audit_logs`) and 1 Flyway migration history table (`flyway_schema_history`).

#### Q15: What is the purpose of the `flyway_schema_history` table?
**Answer:** It is Flyway's internal ledger that tracks applied database migration scripts (`V1__init.sql`, `V2__seed_catalogue.sql`, `V3__drop_unused_payments.sql`), recording execution timestamps, script checksums, and execution success status to prevent drift across environments.

#### Q16: What is a Primary Key and how are they represented in SmartPark?
**Answer:** A primary key is a unique identifier for a table record that cannot be null. SmartPark uses 128-bit **UUIDv4** (`gen_random_uuid()`) primary keys for domain entities to avoid sequential enumeration attacks (IDOR) and facilitate distributed data generation.

#### Q17: What is a Foreign Key and give an example from your project.
**Answer:** A foreign key establishes a referential constraint linking a column to a primary key in another table. In SmartPark, `vehicles.user_id` is a foreign key referencing `users.id` with `ON DELETE CASCADE`.

#### Q18: What is Database Normalization and to what normal form is your schema designed?
**Answer:** Normalization organizes columns and tables to reduce data redundancy and eliminate update/delete anomalies. The SmartPark schema is normalized to **Third Normal Form (3NF)**: all attributes depend on the key, the whole key, and nothing but the key.

#### Q19: Explain the relationship between `facilities`, `parking_floors`, and `parking_slots`.
**Answer:** It is a two-tier One-to-Many hierarchy: One facility contains many floors (`1:N`), and each floor contains many individual bays/slots (`1:N`).

#### Q20: Explain the relationship between `users` and `bookings`.
**Answer:** A One-to-Many (`1:N`) relationship: One registered user can create multiple bookings over time, while each booking belongs to exactly one user.

#### Q21: What database indexes exist in your schema and why?
**Answer:**
1. B-Tree indexes on foreign keys (`idx_vehicles_user`, `idx_floors_facility`, `idx_slots_floor`, `idx_bookings_user`) to optimize relational joins.
2. B-Tree indexes on query filter columns (`idx_facilities_status`, `idx_bookings_status`, `idx_audit_created`).
3. Unique B-Tree indexes on natural keys (`uk_users_email`, `uk_bookings_reference`).
4. **GiST index** on `(slot_id, tstzrange(start_time, end_time, '[)'))` for temporal range overlap queries.

#### Q22: What are database transactions and how are they managed in your backend?
**Answer:** Transactions group database operations into an atomic unit adhering to ACID properties (Atomicity, Consistency, Isolation, Durability). Managed declaratively in Spring using `@Transactional`, ensuring that if any step fails (e.g., pricing or audit logging), all database writes within that unit roll back.

#### Q23: What is Adminer and how does it connect to your database?
**Answer:** Adminer is a lightweight web-based database administration client running in a Docker container on port `8085`. It communicates over the internal Docker network with hostname `postgres` on port `5432`.

#### Q24: What command would you run to connect to PostgreSQL via terminal?
**Answer:**
```bash
docker exec -it smartpark-postgres psql -U smartpark -d smartpark
```

---

### Category 4: Parking Logic & Concurrency

#### Q25: What is a race condition in parking reservations?
**Answer:** A race condition occurs when two users query slot availability at nearly the same instant, both observe bay G-01 as free, and both submit simultaneous booking requests. If unhandled, both requests insert rows, causing a physical collision (double booking).

#### Q26: How does SmartPark mathematically prevent double bookings?
**Answer:** By combining application-level optimistic locking with a PostgreSQL **GiST Spatio-Temporal Exclusion Constraint** (`excl_bookings_slot_time`). Even if two application threads execute simultaneous inserts, the PostgreSQL storage engine evaluates range intersection (`&&`) and aborts the second insert with an `exclusion_violation` error (SQLSTATE `23P01`).

#### Q27: What is an exclusion constraint in PostgreSQL?
**Answer:** An exclusion constraint guarantees that if any two rows are compared on specified columns using specified operators, at least one of these operator comparisons will return false. SmartPark tests `slot_id WITH =` and `tstzrange(start_time, end_time, '[)') WITH &&`.

#### Q28: What is `tstzrange` in PostgreSQL?
**Answer:** It is a built-in range data type representing an interval between two `TIMESTAMPTZ` values. The notation `'[)'` represents a half-open interval where the start time is inclusive and the end time is exclusive.

#### Q29: What happens in the backend when an exclusion constraint violation occurs?
**Answer:** Spring Data JPA catches the database driver's `DataIntegrityViolationException`, which the `GlobalExceptionHandler` translates into an HTTP `409 Conflict` response with an explanatory message instructing the user to choose another bay.

#### Q30: How does the slot availability algorithm work?
**Answer:** Given a facility ID and a target time interval $[T_{start}, T_{end})$:
1. Query all bays belonging to the facility where maintenance status is `'AVAILABLE'`.
2. Subtract all bay IDs that have active reservations (`PENDING`, `CONFIRMED`, `ACTIVE`) whose stored time interval overlaps with the requested interval using the `&&` range operator.

#### Q31: How is parking pricing calculated?
**Answer:** Computed entirely on the backend in `PricingService`:
1. Calculate duration $D$ in minutes.
2. If $D \ge \text{daily threshold}$ (e.g., 720 mins) and a `DAILY` rule exists:
   $$\text{Fare} = \lceil D / 1440 \rceil \times \text{Daily Rate}$$
3. Otherwise, compute hourly fare:
   $$\text{Hours} = \lceil D / 60.0 \rceil$$
   $$\text{Fare} = \max(\text{Minimum Duration Charge}, \text{Hours} \times \text{Hourly Rate})$$

#### Q32: Why must the frontend never calculate the final booking price?
**Answer:** Client-side code runs in an untrusted browser environment. A malicious user can intercept HTTP traffic and tamper with the price payload (e.g., sending `price: 1.00`). Therefore, the backend calculates the fare and ignores any client-supplied amounts.

#### Q33: Explain the states of a booking lifecycle.
**Answer:** `PENDING → CONFIRMED → ACTIVE → COMPLETED`.
Terminal cancellation states: `CANCELLED` and `EXPIRED`.

#### Q34: Can a completed or cancelled booking be cancelled again?
**Answer:** No. The state machine strictly validates transitions. Attempting to cancel an already completed, cancelled, or expired booking throws a `BadRequestException`.

#### Q35: How does the gate check-in and check-out workflow operate?
**Answer:**
1. A driver presents their digital ticket with a dynamic QR code.
2. Gate scanners (or admin gate operators) send the booking reference to `/api/v1/bookings/{id}/check-in`.
3. The server validates that the booking is in `CONFIRMED` state and the current time is within the arrival window.
4. The server creates a `check_ins` record, sets `check_in_time = NOW()`, and transitions the booking to `ACTIVE`.
5. Upon exit, `/check-out` sets `check_out_time = NOW()` and transitions the booking to `COMPLETED`.

#### Q36: How does SmartPark handle vehicle dimensions?
**Answer:** Each slot defines physical dimensions (`width_m`, `length_m`). `AllocationService` verifies that the driver's registered vehicle does not exceed the bay's dimensions.

---

### Category 5: Authentication & Security

#### Q37: How does authentication work in SmartPark?
**Answer:**
1. User submits credentials to `/api/v1/auth/login`.
2. `AuthService` verifies credentials using BCrypt.
3. On success, server issues an ephemeral HMAC-SHA256 access JWT (15-minute validity) in the response JSON and sets a single-use refresh token in a secure `HttpOnly` cookie.

#### Q38: What is JWT and what does it contain?
**Answer:** JSON Web Token is a compact, URL-safe standard (RFC 7519) for transmitting claims. It consists of Header (algorithm `HS256`), Payload (subject UUID, user email, role claim, issued-at, expiration), and Signature (`HMACSHA256(header + payload, secret)`).

#### Q39: Why do you store refresh tokens hashed in the database?
**Answer:** If an attacker gains read-only access to the database (via backup breach or SQL injection), they cannot read or forge valid refresh token strings because the database only stores their **SHA-256 hashes**.

#### Q40: What is Refresh Token Rotation?
**Answer:** Every time a client exchanges a refresh token for a new access token, the presented refresh token is immediately invalidated/revoked and replaced with a newly generated one. If a revoked token is ever presented again, the system recognizes a replay attack.

#### Q41: Why is the refresh token placed in an `HttpOnly` cookie?
**Answer:** The `HttpOnly` flag prevents client-side scripts from reading the cookie via `document.cookie`, mitigating credential theft via Cross-Site Scripting (XSS).

#### Q42: What is BCrypt and why is it preferred over SHA-256 for passwords?
**Answer:** BCrypt is an adaptive cryptographic hash function based on the Blowfish cipher. It incorporates a random salt and a configurable work factor (cost) that makes brute-force hardware cracking computationally expensive. Plain SHA-256 is designed to be fast, making it vulnerable to GPU/ASIC rainbow table attacks.

#### Q43: How do you prevent brute-force login attacks?
**Answer:** SmartPark maintains a `failed_login_attempts` counter on the `users` table. If 5 consecutive failed attempts occur, the account is locked for 15 minutes by setting `locked_until = NOW() + 15 minutes`.

#### Q44: What is Insecure Direct Object Reference (IDOR) and how do you prevent it?
**Answer:** IDOR occurs when an application exposes a reference to an internal database object (like a booking UUID) without verifying that the caller owns it. SmartPark prevents IDOR by asserting that `booking.user_id == authenticatedUser.id` before returning details or modifying state.

#### Q45: How do you protect against SQL Injection?
**Answer:** All database operations utilize Spring Data JPA repositories with parameterized queries. Parameter values are bound separately from SQL query templates, preventing user input from altering query semantics.

#### Q46: What is Cross-Origin Resource Sharing (CORS) and how is it configured?
**Answer:** CORS is a browser security mechanism that restricts web applications from making requests to a domain different from the one serving the app. SmartPark's `WebConfig` explicitly permits requests only from trusted origins (`http://localhost:5173`) with allowed HTTP methods and credential sharing.

#### Q47: What is Role-Based Access Control (RBAC) and how is it enforced?
**Answer:** RBAC restricts resource access based on assigned roles (`ROLE_USER`, `ROLE_ADMIN`). Enforced in Spring Security via URL path matching (`.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`) and method annotations (`@PreAuthorize`).

#### Q48: What is audit logging and what events are tracked?
**Answer:** Audit logging provides an immutable history of security and operational mutations. SmartPark logs user registrations, logins, account lockouts, booking creations, cancellations, check-outs, and slot status overrides into `audit_logs` with JSONB metadata.

---

### Category 6: Demonstration & Practical Review

#### Q49: How do you start the entire SmartPark system from terminal?
**Answer:**
```cmd
:: 1. Start PostgreSQL 16 & Adminer containers:
docker compose up -d

:: 2. Launch Spring Boot Backend:
cd backend
java -jar target\smartpark-backend-1.0.0.jar

:: 3. Launch Vite Frontend:
cd frontend
npm run dev
```
*(Or simply execute the automated root launcher script `run-app.cmd`.)*

#### Q50: Where can we view the database tables visually during review?
**Answer:** In any browser at **[http://localhost:8085](http://localhost:8085)** (Adminer). Server: `postgres`, Username: `smartpark`, Password: `smartpark_dev_password`, Database: `smartpark`.

#### Q51: Which pre-seeded test accounts can you demonstrate right now?
**Answer:**
1. **Admin:** `admin@smartpark.local` / `Admin@12345!`
2. **User 1:** `demo@smartpark.local` / `Demo@12345!`
3. **User 2:** `rohan@smartpark.local` / `Demo@12345!`

#### Q52: Where are the ready-to-run demonstration SQL files located?
**Answer:** In the project root under `sql/`:
- `schema_overview.sql`
- `user_management.sql`
- `parking_inventory.sql`
- `booking_operations.sql`
- `conflict_demonstration.sql`
- `audit_trail.sql`
- `analytics_reporting.sql`

#### Q53: Show how you prove the double-booking exclusion constraint works.
**Answer:** Execute `sql/conflict_demonstration.sql` via `psql` or Adminer. The script inserts Booking A for bay G-01 between $[T, T+2\text{h}]$, then attempts to insert overlapping Booking B for bay G-01 between $[T+30\text{m}, T+2.5\text{h}]$. PostgreSQL immediately blocks Booking B and returns:
`ERROR: conflicting key value violates exclusion constraint "excl_bookings_slot_time" (SQLSTATE 23P01)`.

#### Q54: What happens if a driver cancels a booking 10 minutes before start time when facility cutoff is 30 minutes?
**Answer:** The backend calculates the difference between start time and current time. Because it is less than the facility's `cancellation_cutoff_minutes`, the API rejects the request with HTTP `400 Bad Request` ("Cancellation cutoff window has passed").

#### Q55: How do you demonstrate that dashboard statistics are real database records?
**Answer:** Open Adminer, execute `SELECT COUNT(*) FROM bookings;`, and cross-reference with the total count displayed on the Admin Dashboard. Then insert or cancel a booking and show the counter immediately increment.

#### Q56: What happens if the database container is restarted?
**Answer:** PostgreSQL data is stored in the persistent Docker volume `smartpark_pgdata`. All accounts, facilities, bookings, and audit logs remain intact across restarts.

#### Q57: How do you verify that automated tests pass?
**Answer:** Run `mvn test` in the `backend/` directory. All 40 automated unit, integration, and concurrency tests complete with 0 failures and 0 errors.

#### Q58: What is the purpose of the `version` column in the `bookings` table?
**Answer:** It implements JPA Optimistic Locking. Every time an update commits to a booking, Hibernate increments `version`. If another process attempted an update on stale data, Hibernate throws an `OptimisticLockException`.

#### Q59: How does the system handle EV (Electric Vehicle) charging bays?
**Answer:** Bays with `has_ev_charger = TRUE` are designated for EV vehicles. In the interactive floor map, they are visually differentiated with dedicated EV badges.

#### Q60: How does the system cater to accessible parking requirements?
**Answer:** Users can mark `accessibility_required = true` on their account profile. The allocation engine prioritizes ground-level stalls with `is_accessible = true` positioned nearest to facility entry/exit points.

#### Q61: What happens if a user submits an empty or invalid email?
**Answer:** Jakarta Validation annotations (`@Email`, `@NotBlank`) on the DTO reject the request before it reaches the service layer, returning HTTP 400 Bad Request with field-specific validation errors.

#### Q62: What is the function of the `normalized_registration` column in `vehicles`?
**Answer:** It strips all spaces and hyphens and converts the license plate to uppercase (e.g., `'mh-12 ab 3456'` becomes `'MH12AB3456'`), ensuring duplicate plates cannot be registered due to formatting variations.

#### Q63: Can an administrator mark an entire parking bay out of service?
**Answer:** Yes. In the Admin Dashboard or via `PUT /api/v1/admin/slots/{id}/status`, an administrator can set the slot status to `'OUT_OF_SERVICE'`. The availability engine immediately excludes it from search queries.

#### Q64: How does the interactive floor map render bay positions?
**Answer:** Each `parking_slot` record stores integer coordinates (`layout_x`, `layout_y`). The React frontend maps these coordinates into a responsive 2D grid matrix with color-coded bay status indicators.

#### Q65: What are the main takeaways from building SmartPark?
**Answer:** Building SmartPark reinforced that high-concurrency reservation systems require storage-layer mathematical guarantees rather than fragile application-level checks. It provided hands-on mastery of Spring Security 6, JWT/cookie rotation patterns, Flyway migration versioning, and full-stack TypeScript-Java engineering.
