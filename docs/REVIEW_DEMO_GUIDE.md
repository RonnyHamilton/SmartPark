# SmartPark: Review-Day Demonstration Walkthrough
## Step-by-Step Viva & Defense Script for College Mini Project Review Jury

**Semester 3 Mini Project Review Guide**  
**Estimated Defense Duration:** 10–15 Minutes  
**Target Jury:** Computer Science & Engineering Faculty Evaluators  

---

## ⚡ Quick Start: Pre-Review System Launch

Execute the automated launcher from the project root:
```cmd
run-app.cmd
```
*(This automatically boots Docker containers, confirms PostgreSQL 16 health, executes versioned Flyway migrations up to V4, launches the Spring Boot 3 backend on port 8080, launches the Vite 7 frontend on port 5173, and opens your browser).*

---

## Chronological 15-Step Review Demonstration Walkthrough

---

### Step 1: System Boot & 3-Tier Architecture Overview
- **What to Demonstrate:** Show the running terminal windows: Docker containers (`smartpark-postgres`, `smartpark-adminer`), Spring Boot 3 backend logs, and Vite dev server.
- **Source Files to Reference:**
  - `docker-compose.yml`
  - `run-app.cmd`
- **What to Say to the Jury:**
  > *"SmartPark is an enterprise-grade three-tier system: a React 19 Single Page Application in TypeScript, communicating over REST with a stateless Spring Boot 3 backend on Java 21 LTS, backed by PostgreSQL 16 with version-controlled Flyway migrations (V1 through V4). Everything is deterministic and fully database-persisted."*

---

### Step 2: Authentication Architecture & Brute-Force Defense
- **What to Click:** Navigate to **[http://localhost:5173/login](http://localhost:5173/login)**.
- **What to Demonstrate:** 
  1. Input incorrect credentials (e.g., `test@smartpark.local` / `WrongPass!`) and show instant RFC 7807 validation feedback.
  2. Explain that 5 consecutive failures trigger an automated 15-minute account lockout (`users.locked_until`).
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/auth/AuthController.java`
  - `backend/src/main/java/com/smartpark/security/JwtAuthenticationFilter.java`
- **Database Tables Affected:** `users` (counter `failed_login_attempts` increments).
- **What to Say to the Jury:**
  > *"Passwords are never stored in plaintext—they are hashed with BCrypt (strength factor 12). Upon login, the server issues an ephemeral HMAC-SHA256 access JWT (15-min validity), while a rotating single-use refresh token is stored hashed in PostgreSQL and delivered inside an HttpOnly, SameSite=Strict cookie to eliminate XSS token theft."*

---

### Step 3: Log In as a Regular Driver
- **What to Click:** Enter demo credentials:
  - **Email:** `demo@smartpark.local`
  - **Password:** `Demo@12345!`
  - Click **Sign In**.
- **What to Demonstrate:** Instant redirect to Driver Dashboard (`/dashboard`). Point out the live user statistics: active booking countdown alert, upcoming reservations, completed trips, and total spend in INR.
- **What to Say to the Jury:**
  > *"Notice that all metrics on this dashboard are pulled directly from live PostgreSQL database records. There is zero hardcoded mock data."*

---

### Step 4: Register a Vehicle with Dimension Normalization
- **What to Click:** Go to **Profile** $\rightarrow$ **Vehicles** tab $\rightarrow$ click **+ Add Vehicle**.
- **What to Input:**
  - **Plate:** `MH 12 CR 9999`
  - **Type:** `EV` (Electric Vehicle)
  - **Width:** `1.85 m`, **Length:** `4.50 m`
  - Check **Set as Default Vehicle**.
  - Click **Save Vehicle**.
- **What to Demonstrate:** The vehicle immediately appears in the active vehicle list.
- **Database Tables Affected:** `vehicles` (stores display string `'MH 12 CR 9999'` and normalized alphanumeric string `'MH12CR9999'`).
- **What to Say to the Jury:**
  > *"Notice the backend normalization: spaces and special characters are stripped and converted to uppercase. A unique database constraint on (user_id, normalized_registration) prevents duplicate plate entries."*

---

### Step 5: Search for Parking Facilities
- **What to Click:** Click **Find Parking** (`/discover`) in the navigation bar.
- **What to Demonstrate:** 
  1. Filter by City: **Pune**.
  2. Select **Airport Transit Hub** (AeroMall Multilevel Parking).
  3. Show operating hours (`00:00 - 23:59`), amenities (EV Fast Charger, Covered, CCTV, Accessibility), and hourly rates.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/facility/FacilityController.java`
  - `frontend/src/pages/Discover.tsx`

---

### Step 6: Interactive 2D Floor Visualizer
- **What to Click:** On **Airport Transit Hub**, click **Book Slot**.
- **What to Select:**
  - Pick a date and time window (e.g., Tomorrow `10:00 AM` to `12:00 PM`).
  - View the interactive 2D floor visualizer.
- **What to Demonstrate:** 
  - Floor switcher: Toggle between **Ground** and **Level 1**.
  - Color-coded bays: Available (green), Reserved (slate), EV charging bays (blue icon), Accessible stalls (wheelchair icon).
  - Hover over a bay to see physical dimensions ($2.50\text{m} \times 5.00\text{m}$) and vehicle compatibility.
- **Database Tables Affected:** `parking_slots`, `parking_floors`.
- **What to Say to the Jury:**
  > *"The layout is backed by actual integer coordinate attributes (layout_x, layout_y) in the parking_slots table, allowing dynamic multi-floor visual mapping without hardcoded coordinates."*

---

### Step 7: Transparent Pre-Booking Fare Quote & Booking
- **What to Click:** Click bay **G-01**, review the calculated fare quote (e.g. ₹160.00 for 2 hours at ₹80/hr), and click **Confirm Reservation**.
- **What to Demonstrate:** Instant creation of a confirmed booking with an assigned reference (e.g. `SP-XXXXXX`) and immediate transition to the Booking Confirmation view.
- **Source Files Implementing It:**
  - `backend/src/main/java/com/smartpark/booking/BookingService.java`
  - `backend/src/main/java/com/smartpark/pricing/PricingService.java`
- **What to Say to the Jury:**
  > *"The fare was calculated strictly on the backend by PricingService using active pricing rules for the facility. The client never supplies the price. Furthermore, the booking row was inserted inside a strict ACID transaction."*

---

### Step 8: Inspect Database Record in Adminer Web Interface
- **What to Click/Run:** Open your browser to **Adminer**:
  👉 **[http://localhost:8085](http://localhost:8085)**
  - Server: `postgres`, Username: `smartpark`, Password: `smartpark_dev_password`, Database: `smartpark`.
  - Click on the `bookings` table, then click **Select data**.
- **What to Demonstrate:** Show the newly created row with matching `booking_reference`, `user_id`, `slot_id`, and status `'CONFIRMED'`.
- **What to Say to the Jury:**
  > *"Here is the raw database record in PostgreSQL 16. Notice the optimistic locking version column, the price in INR, and the exact UTC start and end timestamps."*

---

### Step 9: Execute Demonstration SQL Queries
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
- **What to Say to the Jury:**
  > *"All 7 SQL demonstration scripts are organized in the project root under the `sql/` directory, ready to verify user management, parking inventory, audit trails, and revenue analytics."*

---

### Step 10: Demonstrate Booking Cancellation & Slot Liberation
- **What to Click:** Return to the SmartPark frontend, open **Dashboard**, click on the newly created booking, and click **Cancel Booking**.
- **What to Input:** Enter reason: `"Schedule changed"` and confirm.
- **What to Demonstrate:** The status flips to `CANCELLED`. In Adminer, re-run `SELECT status, cancellation_reason FROM bookings;` and show that the record was updated in real time.
- **What to Say to the Jury:**
  > *"The slot is immediately liberated for other drivers. Terminal states like CANCELLED, COMPLETED, and EXPIRED cannot be cancelled again."*

---

### Step 11: Log In as Administrator & View Operations Command Center
- **What to Click:** Click **Sign Out**, then log in with administrator credentials:
  - **Email:** `admin@smartpark.local`
  - **Password:** `Admin@12345!`
- **What to Demonstrate:** Notice the top navigation bar displays the **Admin Portal** link (`/admin`), strictly protected by Spring Security `@PreAuthorize("hasRole('ADMIN')")`.
- **What to Click in Admin:**
  1. **Operations Overview:** Recharts revenue and occupancy trend charts.
  2. **No-Show & Overstay Operations Tab:** Show live tracking of active overstays, physical bay blockages, unresolved conflicts, and recent no-show audits.
  3. **Facilities & Bays Tab:** Live facility configuration and slot status toggling.
  4. **All Reservations Tab:** Paginated booking search with CSV export.
  5. **System Audit Log Tab:** Immutable audit trail with actor emails and JSONB metadata.

---

### Step 12: Demonstrate Automated Lifecycle Management (No-Show & Overstay)
- **What to Explain to the Jury:**
  > *"SmartPark implements an autonomous background engine in `BookingLifecycleJob.java` executing every 30 seconds:
  > 1. **No-Show Detection:** If a driver does not check in within the facility's 15-minute grace period, the booking automatically transitions to `NO_SHOW` and releases the bay.
  > 2. **Overstay Penalty Multiplier:** If a vehicle stays parked past its end time, status becomes `OVERSTAY` with a 1.5x penalty tariff.
  > 3. **Proactive Slot Reassignment:** When an overstay blocks a bay, incoming drivers are automatically reassigned to an alternate compatible bay. If none is available, it escalates to `CONFLICT_REQUIRES_ADMIN` for immediate operator resolution."*

---

### Step 13: Prove Concurrency Double-Booking Exclusion Constraint (The Killer Defense)
- **What to Demonstrate:** This is the most technically compelling live proof in your defense.
- **What to Run:** Open your terminal and run:
  ```cmd
  cmd /c "docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\conflict_demonstration.sql"
  ```
- **What Appears on the Screen:**
  ```
  NOTICE:  STEP A SUCCESS: Primary reservation confirmed for slot G-01...
  NOTICE:  STEP B: Attempting overlapping reservation on slot G-01...
  NOTICE:  ------------------------------------------------------------------------
  NOTICE:  VERIFICATION SUCCESSFUL:
  NOTICE:  PostgreSQL GiST exclusion constraint (excl_bookings_slot_time) REJECTED
  NOTICE:  the overlapping booking attempt with SQLSTATE 23P01 (exclusion_violation).
  NOTICE:  Mathematical zero double-booking guarantee confirmed at database kernel!
  NOTICE:  ------------------------------------------------------------------------
  ```
- **What to Say to the Jury:**
  > *"Most student projects use simple 'SELECT count(*)' checks, which fail under simultaneous requests. In SmartPark, we implemented a PostgreSQL GiST Spatio-Temporal Exclusion Constraint using the btree_gist extension. It mathematically prevents overlapping reservations directly inside the database storage engine."*

---

### Step 14: Run Automated Test Suites (48 Tests, 100% Pass)
- **What to Run:** In your terminal, execute:
  ```cmd
  mvn test
  ```
- **What to Demonstrate:** Show the live execution of all 48 automated JUnit integration and concurrency tests passing with:
  `[INFO] Tests run: 48, Failures: 0, Errors: 0, Skipped: 0`
  `[INFO] BUILD SUCCESS`
- **What to Say to the Jury:**
  > *"Our test suite executes 48 automated tests across 5 test suites, including a 10-thread simultaneous concurrency stress test where exactly 1 thread succeeds (HTTP 201) and 9 fail with HTTP 409 Conflict."*

---

### Step 15: Concluding Project Documentation Review
- **What to Open:** Present the comprehensive documentation suite:
  - `docs/MINI_PROJECT_REVIEW.md` — Complete engineering defense document.
  - `docs/DATABASE_DOCUMENTATION.md` — All 12 table schemas and constraints.
  - `docs/API_DOCUMENTATION.md` — REST API endpoint reference.
  - `docs/MODULE_DOCUMENTATION.md` — 9 functional modules breakdown.
  - `docs/TESTING_REPORT.md` — 48-test verification report.
