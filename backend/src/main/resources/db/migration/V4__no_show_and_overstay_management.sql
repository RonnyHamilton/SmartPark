-- Flyway Migration V4: No-Show, Overstay and Conflict Management
-- PostgreSQL 16+

-- 1. Update bookings status check constraint to include OVERSTAY, NO_SHOW, CONFLICT_REQUIRES_ADMIN
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_status;
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status
    CHECK (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'OVERSTAY', 'NO_SHOW', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'CONFLICT_REQUIRES_ADMIN'));

-- 2. Update GiST exclusion constraint so OVERSTAY and CONFLICT_REQUIRES_ADMIN continue to prevent concurrent duplicate bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS excl_bookings_slot_time;
ALTER TABLE bookings
    ADD CONSTRAINT excl_bookings_slot_time
    EXCLUDE USING gist (
        slot_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'OVERSTAY', 'CONFLICT_REQUIRES_ADMIN'));

-- 3. Add configurable check-in grace period and overstay pricing multiplier to facilities
ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS check_in_grace_period_minutes INTEGER NOT NULL DEFAULT 15 CHECK (check_in_grace_period_minutes >= 0),
    ADD COLUMN IF NOT EXISTS overstay_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50 CHECK (overstay_multiplier >= 1.00);

-- 4. Add overstay, no-show, and conflict tracking columns to bookings
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS overstay_start_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS overstay_duration_minutes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overstay_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (overstay_charge >= 0),
    ADD COLUMN IF NOT EXISTS no_show_detected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reassigned_from_slot_id UUID REFERENCES parking_slots(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS conflict_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 5. Performance indexes for lifecycle monitoring and admin operations
CREATE INDEX IF NOT EXISTS idx_bookings_overstay ON bookings (status) WHERE status IN ('ACTIVE', 'OVERSTAY');
CREATE INDEX IF NOT EXISTS idx_bookings_conflict ON bookings (status) WHERE status = 'CONFLICT_REQUIRES_ADMIN';
CREATE INDEX IF NOT EXISTS idx_bookings_noshow ON bookings (status) WHERE status = 'NO_SHOW';
CREATE INDEX IF NOT EXISTS idx_bookings_slot_reassigned ON bookings (reassigned_from_slot_id);
