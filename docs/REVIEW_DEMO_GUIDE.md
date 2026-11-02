# SmartPark: Review-Day Demonstration Walkthrough
## Step-by-Step Script for College Mini Project Review Jury

Follow this chronological 15-step script during your project viva/review to confidently demonstrate the live application, database queries, and architectural defense.

---

## ⚡ Quick Start: Launching the System Before the Jury Arrives

Execute the automated launcher from the project root:
```cmd
run-app.cmd
```
*(This automatically boots Docker containers, waits for PostgreSQL to be healthy, verifies Flyway migrations, launches the Spring Boot backend on port 8080, launches the Vite dev server on port 5173, and opens your browser.)*

---

## 15-Step Review Demonstration Walkthrough

---

### Step 1: Start the Application & Architecture Overview
- **What to Demonstrate:** Show the three running system components: Docker containers (`smartpark-postgres`, `smartpark-adminer`), Spring Boot backend (terminal window / logs), and React Vite frontend.
- **Source Files to Reference:**
  - `docker-compose.yml`
  - `run-app.cmd`
- **What to Explain to the Jury:**
  > *"SmartPark is structured as an enterprise three-tier system: a React 19 Single Page Application communicating over REST with a stateless Spring Boot 3 backend on Java 21, backed by PostgreSQL 16 with versioned Flyway migrations. Everything runs locally in reproducible Docker containers."*

---

### Step 2: Open Login Page & Demonstrate Authentication Architecture
- **What to Click:** Navigate to **[http://localhost:5173/login](http://localhost:5173/login)**.
- **What to Demonstrate:** 
  1. Show the clean authentication UI.
  2. Input invalid credentials (e.g., `wrong@smartpark.local` / `WrongPass!`) and demonstrate the instant validation feedback.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/auth/AuthController.java`
  - `backend/src/main/java/com/smartpark/security/JwtAuthenticationFilter.java`
  - `frontend/src/pages/Login.tsx`
- **Database Tables Affected:** `users` (counter `failed_login_attempts` increments).
- **What to Explain to the Jury:**
  > *"Passwords are never stored in plaintext—they are hashed using BCrypt (strength 12). Upon successful login, the server issues an ephemeral HMAC-SHA256 access JWT in the JSON body, while a cryptographically random, single-use refresh token is delivered inside an HttpOnly, SameSite=Lax cookie to eliminate XSS token theft."*

---

### Step 3: Log In as a Regular User
- **What to Click:** Enter default demo credentials:
  - **Email:** `demo@smartpark.local`
  - **Password:** `Demo@12345!`
  - Click **Sign In**.
- **What to Demonstrate:** Instant redirect to the User Dashboard (`/dashboard`). Point out the live user statistics: total bookings, active parking status, and registered vehicle quick-select.
- **Source Files Implementing It:**
  - `frontend/src/context/AuthContext.tsx`
  - `frontend/src/pages/Dashboard.tsx`
- **Database Tables Affected:** `users`, `refresh_tokens`, `bookings`.
- **What to Explain to the Jury:**
  > *"Notice that all numbers and statistics on this dashboard are pulled directly from live PostgreSQL database records. There are zero hardcoded mock values."*

---

### Step 4: Register a New Vehicle
- **What to Click:** Click **Profile** in the top navigation, select the **Vehicles** tab, and click **+ Add Vehicle**.
- **What to Input:**
  - **Plate:** `MH 12 CR 9999`
  - **Type:** `EV` (Electric Vehicle)
  - **Width:** `1.85 m`, **Length:** `4.50 m`
  - Check **Set as Default Vehicle**.
  - Click **Save Vehicle**.
- **What to Demonstrate:** The vehicle immediately appears in the active vehicle list.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/vehicle/VehicleController.java`
  - `backend/src/main/java/com/smartpark/vehicle/VehicleService.java`
- **Database Tables Affected:** `vehicles` (stores both original registration `'MH 12 CR 9999'` and normalized registration `'MH12CR9999'`).
- **What to Explain to the Jury:**
  > *"Notice the backend normalization: spaces and special characters are stripped and converted to uppercase. A unique database constraint on (user_id, normalized_registration) prevents duplicate plate entries."*

---

### Step 5: Search for a Parking Facility
- **What to Click:** Click **Find Parking** (`/discover`) in the navigation bar.
- **What to Demonstrate:** 
  1. Filter by City: Select **Pune**.
  2. Search for: **Airport Transit Hub**.
  3. Show operating hours, capacity count, and available amenities (EV Charging, CCTV).
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/facility/FacilityController.java`
  - `frontend/src/pages/Discover.tsx`
- **Database Tables Affected:** `facilities`, `parking_floors`, `parking_slots`.
- **What to Explain to the Jury:**
  > *"Facilities are queried dynamically with operational constraints: opening/closing hours, minimum/maximum duration rules, and turnaround buffers."*

---

### Step 6: Show Interactive 2D Parking Layout
- **What to Click:** On **Airport Transit Hub**, click **Book Slot**.
- **What to Select:**
  - Pick a date and time window (e.g., Tomorrow from `10:00 AM` to `12:00 PM`).
  - View the interactive 2D floor visualizer.
- **What to Demonstrate:** 
  - Floor switcher: Toggle between **Ground** and **Level 1**.
  - Color-coded slots: Available (green/slate), EV bays (blue badge), Accessible stalls (wheelchair badge).
  - Hover over a slot to see physical dimensions ($2.4\text{m} \times 5.0\text{m}$).
- **Source Files Implementing It:**
  - `frontend/src/components/ParkingFloorMap.tsx`
  - `backend/src/main/java/com/smartpark/facility/FacilityService.java`
- **Database Tables Affected:** `parking_slots`, `parking_floors`.
- **What to Explain to the Jury:**
  > *"The layout is backed by actual integer coordinate attributes (layout_x, layout_y) in the parking_slots table, allowing dynamic multi-floor visual mapping without hardcoded coordinates."*

---

### Step 7: Create a Real-Time Booking
- **What to Click:** Click on an available bay (e.g., **G-01**), verify the selected vehicle, review the calculated fare (e.g., **₹160.00** for 2 hours), and click **Confirm Reservation**.
- **What to Demonstrate:** Instant creation of a confirmed booking with an assigned reference (e.g., `SP-XXXXXX`) and immediate transition to the Booking Confirmation view.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/booking/BookingService.java`
  - `backend/src/main/java/com/smartpark/pricing/PricingService.java`
- **Database Tables Affected:** `bookings`, `audit_logs`.
- **What to Explain to the Jury:**
  > *"The fare was calculated strictly on the backend by PricingService using active pricing rules for the facility. The client never supplies the price. Furthermore, the booking row was inserted inside a strict ACID transaction."*

---

### Step 8: Show the Booking Record in the Database
- **What to Click/Run:** Open your browser to **Adminer**:
  👉 **[http://localhost:8085](http://localhost:8085)**
  - Server: `postgres`, Username: `smartpark`, Password: `smartpark_dev_password`, Database: `smartpark`.
  - Click on the `bookings` table, then click **Select data**.
- **What to Demonstrate:** Show the newly created row with matching `booking_reference`, `user_id`, `slot_id`, and status `'CONFIRMED'`.
- **What to Explain to the Jury:**
  > *"Here is the raw database record in PostgreSQL 16. Notice the optimistic locking version column, the price in INR, and the exact UTC start and end timestamps."*

---

### Step 9: Execute Ready-to-Run SQL Demonstration Queries
- **What to Click/Run:** In Adminer, click **SQL command** on the left menu.
- **What to Execute:** Open `sql/booking_operations.sql` in your editor, copy Query 1, and paste it into Adminer:
```sql
SELECT 
    b.booking_reference,
    u.name AS user_name,
    v.registration_number,
    f.name AS facility_name,
    s.slot_code,
    b.start_time,
    b.end_time,
    b.status,
    b.price_amount
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN vehicles v ON v.id = b.vehicle_id
JOIN parking_slots s ON s.id = b.slot_id
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
ORDER BY b.start_time DESC;
```
- **What to Demonstrate:** Click **Execute**. Show the jury the resulting joined data displaying driver, vehicle, facility, bay, and fare.
- **What to Explain to the Jury:**
  > *"All 7 SQL demonstration scripts are organized in the project root under the `sql/` directory, ready to verify user management, parking inventory, audit trails, and revenue analytics."*

---

### Step 10: Demonstrate Booking Cancellation
- **What to Click:** Return to the SmartPark frontend, open **Dashboard**, click on the newly created booking, and click **Cancel Booking**.
- **What to Input:** Enter reason: `"Schedule changed"` and confirm.
- **What to Demonstrate:** The status flips to `CANCELLED`. In Adminer, re-run `SELECT status, cancellation_reason FROM bookings;` and show that the record was updated in real time.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/booking/BookingService.java` (`cancelBooking()`)
- **Database Tables Affected:** `bookings`, `audit_logs`.
- **What to Explain to the Jury:**
  > *"The slot is immediately liberated for other drivers. Terminal states like CANCELLED and COMPLETED cannot be cancelled again."*

---

### Step 11: Log In as an Administrator
- **What to Click:** Click **Sign Out**, then log in with administrator credentials:
  - **Email:** `admin@smartpark.local`
  - **Password:** `Admin@12345!`
- **What to Demonstrate:** Notice the top navigation bar displays the **Admin Portal** link (`/admin`), which is hidden from standard users.
- **Source Files Implementing It:**
  - `frontend/src/components/AdminRoute.tsx`
  - `backend/src/main/java/com/smartpark/security/SecurityConfig.java`
- **What to Explain to the Jury:**
  > *"Role-Based Access Control is enforced at both frontend route boundaries and backend Spring Security filters using @PreAuthorize('hasRole(\"ADMIN\")'). Unauthorized callers receive HTTP 403 Forbidden."*

---

### Step 12: Demonstrate Administrative Slot Maintenance & Global Overview
- **What to Click:** Open the **Admin Portal** (`/admin`).
- **What to Demonstrate:**
  1. **Executive Metrics:** View total facilities (4), total slots (108), total bookings, and aggregate revenue.
  2. **Slot Status Override:** Locate bay **G-01**, click **Set Out of Service**.
  3. **Verification:** Point out that bay G-01 is now marked `OUT_OF_SERVICE`. Return to the driver booking page and demonstrate that bay G-01 can no longer be booked.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/admin/AdminController.java`
- **Database Tables Affected:** `parking_slots.status`.

---

### Step 13: Prove Concurrency Double-Booking Exclusion Constraint
- **What to Demonstrate:** This is the most impressive technical defense in your review.
- **What to Run:** Open your terminal and run:
  ```cmd
  cmd /c "docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\conflict_demonstration.sql"
  ```
- **What Appears on the Screen:**
  ```
  NOTICE:  STEP A SUCCESS: Primary reservation SP-CONCURRENCY-A confirmed for slot G-01 between ...
  NOTICE:  STEP B: Attempting overlapping reservation on slot G-01 between ...
  NOTICE:  ------------------------------------------------------------------------
  NOTICE:  VERIFICATION SUCCESSFUL:
  NOTICE:  PostgreSQL GiST exclusion constraint (excl_bookings_slot_time) REJECTED
  NOTICE:  the overlapping booking attempt with SQLSTATE 23P01 (exclusion_violation).
  NOTICE:  Mathematical zero double-booking guarantee confirmed at database kernel!
  NOTICE:  ------------------------------------------------------------------------
  ```
- **What to Explain to the Jury:**
  > *"Most student projects use simple 'SELECT count(*)' checks, which fail under simultaneous requests. In SmartPark, we implemented a PostgreSQL GiST Spatio-Temporal Exclusion Constraint using the btree_gist extension. It mathematically prevents overlapping reservations directly inside the database storage engine."*

---

### Step 14: Demonstrate Automated Concurrency & Integration Tests
- **What to Run:** In your PowerShell/terminal, execute:
  ```cmd
  powershell -Command "& 'C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\plugins\maven\lib\maven3\bin\mvn.cmd' test"
  ```
- **What to Demonstrate:** Show the live execution of all 40 automated JUnit integration and concurrency tests passing with:
  `[INFO] Tests run: 40, Failures: 0, Errors: 0, Skipped: 0`
  `[INFO] BUILD SUCCESS`
- **What to Explain to the Jury:**
  > *"This test suite runs real multi-threaded concurrency simulations, testing 10 simultaneous threads competing for the same slot. Exactly 1 succeeds and 9 receive HTTP 409 Conflict."*

---

### Step 15: Present Project Documentation & ER Diagram
- **What to Open:** In your code editor or browser, open:
  - `docs/MINI_PROJECT_REVIEW.md`
  - `docs/PROJECT_ARCHITECTURE.md`
  - `docs/DATABASE_DOCUMENTATION.md`
- **What to Explain to the Jury:**
  > *"Every module, database table, ER diagram, API contract, and security mechanism is comprehensively documented and ready for faculty inspection."*
