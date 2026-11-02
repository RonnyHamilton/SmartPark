# SmartPark — Ready-to-Run SQL Query Catalog

This folder contains pre-tested, production-ready SQL demonstration files for the **SmartPark (PostgreSQL 16)** database. You can execute any of these files directly in **Adminer Web UI** or via the **psql CLI**.

---

## 📁 File Manifest

| File | Scenario / Focus | Primary Tables Involved |
| :--- | :--- | :--- |
| **`schema_overview.sql`** | Table catalog, primary/foreign keys, indexes, Flyway migrations | `information_schema`, `pg_indexes`, `flyway_schema_history` |
| **`user_management.sql`** | User credentials, roles, lockout security flags, vehicles, tokens | `users`, `vehicles`, `refresh_tokens` |
| **`parking_inventory.sql`** | Facilities, floors, bays, EV chargers, accessibility, pricing | `facilities`, `parking_floors`, `parking_slots`, `pricing_rules` |
| **`booking_operations.sql`** | Reservations ledger, live occupancy, cancellations, check-in QR | `bookings`, `check_ins`, `users`, `vehicles`, `parking_slots` |
| **`conflict_demonstration.sql`**| **GiST Double-Booking Prevention & Concurrency Proof** | `bookings`, `excl_bookings_slot_time` constraint |
| **`audit_trail.sql`** | Security audit trail, administrative actions, login failures | `audit_logs`, `users` |
| **`analytics_reporting.sql`** | Revenue totals, daily volume, top customers, bay utilization | `bookings`, `facilities`, `parking_slots`, `users` |

---

## 🚀 Execution Instructions

### Method 1: Interactive Web Interface (Adminer)
1. Open your browser: **[http://localhost:8085](http://localhost:8085)**
2. Connect with:
   - **System:** `PostgreSQL`
   - **Server:** `postgres`
   - **Username:** `smartpark`
   - **Password:** `smartpark_dev_password`
   - **Database:** `smartpark`
3. Click **SQL command** in the left sidebar.
4. Copy and paste the contents of any `.sql` file and click **Execute**.

### Method 2: Command Line via Docker (`psql`)
You can pipe any SQL script directly into the running database container without opening an interactive prompt:

```cmd
:: From the project root:
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\schema_overview.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\user_management.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\parking_inventory.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\booking_operations.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\conflict_demonstration.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\audit_trail.sql
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\analytics_reporting.sql
```

### Method 3: Interactive `psql` Session
```cmd
docker exec -it smartpark-postgres psql -U smartpark -d smartpark
```
Once connected:
- `\dt` — List all tables
- `\d+ bookings` — Detailed bookings schema with constraints and indexes
- `\q` — Exit
