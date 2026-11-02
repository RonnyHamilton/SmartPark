# SmartPark - Database Access & Management Instructions

This guide provides instructions on how to access, inspect, and manage the PostgreSQL database tables for the SmartPark application.

---

## 1. Quick Connection Reference

| Parameter | Value (Default Development) | Notes |
| :--- | :--- | :--- |
| **Database Engine** | PostgreSQL 16 (Alpine) | Running via Docker container `smartpark-postgres` |
| **Host (from Host OS / Desktop GUI)** | `localhost` or `127.0.0.1` | Mapped to host port 5432 |
| **Host (from Adminer Web UI)** | `postgres` | Service name inside the Docker compose network |
| **Port** | `5432` | Standard PostgreSQL port |
| **Database Name** | `smartpark` | Configured in `docker-compose.yml` & `.env` |
| **Username** | `smartpark` | Default application user |
| **Password** | `smartpark_dev_password` | Set in `.env` / default in `docker-compose.yml` |
| **Adminer Web UI** | [http://localhost:8085](http://localhost:8085) | Zero-installation web interface |

---

## 2. Access Methods

You can access the database using any of the following 3 methods:

### Method 1: Web Browser via Adminer (Recommended - Zero Installation)

The project includes an **Adminer** database management container running alongside PostgreSQL.

1. Ensure the Docker containers are running:
   ```cmd
   docker compose up -d
   ```
2. Open your web browser and navigate to:
   👉 **[http://localhost:8085](http://localhost:8085)**
3. In the login form, enter the following exact credentials:
   - **System:** `PostgreSQL` *(select from dropdown)*
   - **Server:** `postgres` *(Note: use `postgres`, which is the Docker network hostname)*
   - **Username:** `smartpark`
   - **Password:** `smartpark_dev_password`
   - **Database:** `smartpark`
4. Click **Login**.
5. You can now browse all tables, run custom SQL queries, export data, and inspect table schemas and foreign key relationships visually.

---

### Method 2: Command Line using Docker (`psql`)

You do not need PostgreSQL installed locally on Windows; you can jump directly into the interactive `psql` shell inside the Docker container:

#### Connect to the `psql` interactive prompt:
```cmd
docker exec -it smartpark-postgres psql -U smartpark -d smartpark
```

#### Useful `psql` Commands:
- `\dt` — List all tables
- `\d+ <table>` — Inspect a table schema, column types, constraints, and indexes
- `\l` — List all databases
- `\du` — List database roles / users
- `\x` — Toggle expanded display mode (very helpful for wide tables like `bookings` or `facilities`)
- `\q` — Exit the `psql` shell

#### Run a one-line SQL query from PowerShell or CMD:
```cmd
docker exec smartpark-postgres psql -U smartpark -d smartpark -c "SELECT email, role, account_status FROM users;"
```

---

### Method 3: Desktop GUI Clients (DBeaver, pgAdmin, DataGrip, VS Code)

If you prefer desktop database software like **DBeaver**, **pgAdmin 4**, **DataGrip**, **TablePlus**, or the **VS Code Database Client** extension:

1. Create a new **PostgreSQL** connection.
2. Fill in the connection settings:
   - **Host:** `localhost`
   - **Port:** `5432`
   - **Database:** `smartpark`
   - **Username:** `smartpark`
   - **Password:** `smartpark_dev_password`
   - **SSL Mode:** `disable` (or `allow`)
3. Click **Test Connection**, then **Save/Connect**.

---

## 3. Database Table Catalog & Schema Overview

The SmartPark database schema is version-controlled via **Flyway** migrations (`classpath:db/migration`). Here is an overview of each table:

### 1. `users`
Stores user and administrative accounts.
- `id` (UUID, Primary Key)
- `name` (VARCHAR(120)) — Full name
- `email` (VARCHAR(255), Unique, Lowercase constraint)
- `password_hash` (VARCHAR(120)) — BCrypt hashed password
- `role` (VARCHAR(20)) — `'USER'` or `'ADMIN'`
- `account_status` (VARCHAR(20)) — `'ACTIVE'` or `'DISABLED'`
- `accessibility_required` (BOOLEAN) — Indicates need for accessible parking slots
- `failed_login_attempts` (INTEGER) — Brute-force protection counter
- `locked_until` (TIMESTAMPTZ) — Account lockout timestamp
- `created_at` / `updated_at` (TIMESTAMPTZ)

### 2. `vehicles`
Stores vehicles registered to users.
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK -> `users.id` ON DELETE CASCADE)
- `registration_number` (VARCHAR(20)) — Original license plate string
- `normalized_registration` (VARCHAR(20)) — Normalized uppercase license plate
- `vehicle_type` (VARCHAR(20)) — `'CAR'`, `'SUV'`, `'MOTORCYCLE'`, `'EV'`
- `width_m`, `length_m` (NUMERIC(4,2)) — Physical dimensions
- `is_default` (BOOLEAN) — Default vehicle for quick booking

### 3. `facilities`
Stores parking facilities, garages, and lots.
- `id` (UUID, Primary Key)
- `name` (VARCHAR(160)), `description` (TEXT), `address` (VARCHAR(255)), `city` (VARCHAR(120))
- `latitude`, `longitude` (NUMERIC(9,6))
- `timezone` (VARCHAR(64)) — Default: `'Asia/Kolkata'`
- `opens_at`, `closes_at` (TIME) — Facility operating hours
- `operating_days` (VARCHAR(40)) — e.g., `'MON,TUE,WED,THU,FRI,SAT,SUN'`
- `amenities` (TEXT[]) — Array of amenities (e.g., CCTV, Valet, EV Charging)
- `status` (VARCHAR(20)) — `'ACTIVE'`, `'INACTIVE'`, `'MAINTENANCE'`
- `min_duration_minutes` / `max_duration_minutes` — Booking duration constraints
- `advance_booking_days` — How far in advance slots can be reserved
- `cancellation_cutoff_minutes` / `buffer_minutes` — Turnaround buffer between reservations

### 4. `parking_floors`
Multi-level parking facility floors.
- `id` (UUID, Primary Key)
- `facility_id` (UUID, FK -> `facilities.id` ON DELETE CASCADE)
- `name` (VARCHAR(80)) — e.g., `'Ground Floor'`, `'Level B1'`
- `floor_number` (INTEGER), `display_order` (INTEGER)

### 5. `parking_slots`
Individual parking bays within a floor.
- `id` (UUID, Primary Key)
- `floor_id` (UUID, FK -> `parking_floors.id` ON DELETE CASCADE)
- `slot_code` (VARCHAR(20)) — e.g., `'G-01'`, `'B1-12'`
- `slot_type` (VARCHAR(20)) — `'STANDARD'`, `'COMPACT'`, `'LARGE'`, `'EV'`, `'ACCESSIBLE'`, `'MOTORCYCLE'`
- `supported_vehicle_types` (TEXT[]) — Array of supported vehicle types
- `is_accessible` (BOOLEAN), `has_ev_charger` (BOOLEAN)
- `width_m`, `length_m` (NUMERIC(4,2))
- `status` (VARCHAR(20)) — `'AVAILABLE'` or `'OUT_OF_SERVICE'`
- `layout_x`, `layout_y` (INTEGER) — Interactive 2D grid coordinates

### 6. `pricing_rules`
Dynamic and static pricing models per facility.
- `id` (UUID, Primary Key)
- `facility_id` (UUID, FK -> `facilities.id` ON DELETE CASCADE)
- `rate_type` (VARCHAR(20)) — `'HOURLY'`, `'DAILY'`, `'FLAT'`
- `amount` (NUMERIC(10,2)) — Rate charged
- `minimum_duration_minutes` / `maximum_duration_minutes`
- `effective_from` / `effective_to` (DATE), `active` (BOOLEAN)

### 7. `bookings`
Core reservation ledger.
- `id` (UUID, Primary Key)
- `booking_reference` (VARCHAR(24), Unique) — Human-readable reference (e.g., `'SP-UMUGDWFZ'`)
- `user_id` (UUID, FK -> `users.id`)
- `slot_id` (UUID, FK -> `parking_slots.id`)
- `vehicle_id` (UUID, FK -> `vehicles.id`)
- `start_time`, `end_time` (TIMESTAMPTZ)
- `status` (VARCHAR(20)) — `'PENDING'`, `'CONFIRMED'`, `'ACTIVE'`, `'COMPLETED'`, `'CANCELLED'`, `'EXPIRED'`
- `price_amount` (NUMERIC(10,2)), `currency` (VARCHAR(3), Default `'INR'`)
- `cancellation_reason`, `cancelled_at`, `cancelled_by`
- `version` (BIGINT) — Optimistic locking counter

> [!IMPORTANT]
> **Double Booking Prevention:**
> The `bookings` table enforces a database-level PostgreSQL GiST exclusion constraint (`excl_bookings_slot_time`). It mathematically prevents overlapping reservations for the same slot during overlapping time ranges (`tstzrange(start_time, end_time, '[)')`) for any active booking states (`PENDING`, `CONFIRMED`, `ACTIVE`).

### 8. `check_ins`
Arrival and departure verification records.
- `id` (UUID, Primary Key)
- `booking_id` (UUID, Unique, FK -> `bookings.id`)
- `check_in_time` (TIMESTAMPTZ)
- `check_out_time` (TIMESTAMPTZ)
- `verification_method` (VARCHAR(30)) — `'QR'`, `'MANUAL'`, `'ADMIN'`

### 9. `refresh_tokens`
Cryptographically hashed JWT refresh tokens.
- `id` (UUID, Primary Key), `user_id` (UUID, FK -> `users.id` ON DELETE CASCADE)
- `token_hash` (VARCHAR(128), Unique), `expires_at`, `revoked_at`, `replaced_by`

### 10. `password_reset_tokens`
Tokens for the password recovery flow.
- `id` (UUID, Primary Key), `user_id` (UUID, FK -> `users.id` ON DELETE CASCADE)
- `token_hash` (VARCHAR(128), Unique), `expires_at`, `used_at`

### 11. `audit_logs`
Security and audit event trail.
- `id` (BIGSERIAL, Primary Key)
- `actor_user_id` (UUID, FK -> `users.id`)
- `action` (VARCHAR(80)) — e.g., `'BOOKING_CREATED'`, `'BOOKING_CANCELLED'`, `'LOGIN_FAILED'`
- `resource_type` (VARCHAR(60)), `resource_id` (VARCHAR(64))
- `metadata` (JSONB) — Arbitrary JSON event payload
- `created_at` (TIMESTAMPTZ)

### 12. `flyway_schema_history`
Tracks applied database migrations, checksums, execution times, and success status.

---

## 4. Pre-seeded Demo Accounts

When the application boots in `dev` mode (`SEED_DEMO_DATA=true`), the following test accounts are automatically seeded into the `users` table:

| Account Type | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@smartpark.local` | `Admin@12345!` | `ADMIN` |
| **Demo User 1** | `demo@smartpark.local` | `Demo@12345!` | `USER` |
| **Demo User 2** | `rohan@smartpark.local` | `Demo@12345!` | `USER` |

---

## 5. Sample SQL Queries

You can execute these directly in Adminer (under **SQL command**) or via the `psql` terminal:

### 1. List all registered users and roles:
```sql
SELECT id, name, email, role, account_status, failed_login_attempts, created_at
FROM users
ORDER BY created_at ASC;
```

### 2. View all active parking facilities and slot counts:
```sql
SELECT 
    f.name AS facility_name,
    f.city,
    f.status,
    COUNT(s.id) AS total_slots
FROM facilities f
LEFT JOIN parking_floors fl ON fl.facility_id = f.id
LEFT JOIN parking_slots s ON s.floor_id = fl.id
GROUP BY f.id, f.name, f.city, f.status
ORDER BY total_slots DESC;
```

### 3. View live or upcoming bookings with user and vehicle details:
```sql
SELECT 
    b.booking_reference,
    u.name AS user_name,
    u.email,
    v.registration_number,
    s.slot_code,
    b.start_time,
    b.end_time,
    b.status,
    b.price_amount
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN vehicles v ON v.id = b.vehicle_id
JOIN parking_slots s ON s.id = b.slot_id
ORDER BY b.start_time DESC;
```

### 4. Check available slots with EV charging:
```sql
SELECT 
    f.name AS facility_name,
    fl.name AS floor_name,
    s.slot_code,
    s.slot_type,
    s.status
FROM parking_slots s
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
WHERE s.has_ev_charger = true AND s.status = 'AVAILABLE';
```

### 5. Inspect the latest 20 security and system audit logs:
```sql
SELECT 
    a.id,
    a.created_at,
    u.email AS actor_email,
    a.action,
    a.resource_type,
    a.resource_id,
    a.metadata
FROM audit_logs a
LEFT JOIN users u ON u.id = a.actor_user_id
ORDER BY a.created_at DESC
LIMIT 20;
```

---

## 6. Maintenance & Troubleshooting

### Reset the Database to a Clean State
If you want to wipe test records and have Flyway recreate and re-seed all tables from scratch:
```cmd
docker compose down -v
docker compose up -d
```
*(The `-v` flag removes the `smartpark_pgdata` Docker volume, giving you a fresh database.)*

### Port Conflicts
- **Port 5432 in use?**
  If you have a local PostgreSQL server already using port 5432, you can change `POSTGRES_PORT` in your `.env` file (e.g., `POSTGRES_PORT=5433`).
- **Port 8085 in use?**
  Change `ADMINER_PORT` in `.env` (e.g., `ADMINER_PORT=8086`).

### View Container Logs
```cmd
docker logs smartpark-postgres --tail 100
docker logs smartpark-adminer --tail 100
```
