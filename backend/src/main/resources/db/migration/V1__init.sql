-- SmartPark initial relational schema
-- PostgreSQL 16+. Overlapping reservations are prevented by a PostgreSQL
-- exclusion constraint (the authoritative concurrency guard).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'DISABLED')),
    accessibility_required BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT chk_users_email_lower CHECK (email = lower(email))
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registration_number VARCHAR(20) NOT NULL,
    normalized_registration VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('CAR', 'SUV', 'MOTORCYCLE', 'EV')),
    width_m NUMERIC(4,2),
    length_m NUMERIC(4,2),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_vehicles_user_registration UNIQUE (user_id, normalized_registration)
);

CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    address VARCHAR(255) NOT NULL,
    city VARCHAR(120) NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    operating_days VARCHAR(40) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI,SAT,SUN',
    amenities TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    min_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (min_duration_minutes >= 15),
    max_duration_minutes INTEGER NOT NULL DEFAULT 720 CHECK (max_duration_minutes <= 10080),
    advance_booking_days INTEGER NOT NULL DEFAULT 30 CHECK (advance_booking_days BETWEEN 1 AND 365),
    cancellation_cutoff_minutes INTEGER NOT NULL DEFAULT 60 CHECK (cancellation_cutoff_minutes >= 0),
    buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_facilities_hours CHECK (closes_at > opens_at),
    CONSTRAINT chk_facilities_durations CHECK (max_duration_minutes > min_duration_minutes)
);

CREATE TABLE parking_floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    floor_number INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_floors_facility_name UNIQUE (facility_id, name),
    CONSTRAINT uk_floors_facility_number UNIQUE (facility_id, floor_number)
);

CREATE TABLE parking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id UUID NOT NULL REFERENCES parking_floors(id) ON DELETE CASCADE,
    slot_code VARCHAR(20) NOT NULL,
    slot_type VARCHAR(20) NOT NULL CHECK (slot_type IN ('STANDARD', 'COMPACT', 'LARGE', 'EV', 'ACCESSIBLE', 'MOTORCYCLE')),
    supported_vehicle_types TEXT[] NOT NULL DEFAULT '{CAR,SUV}',
    is_accessible BOOLEAN NOT NULL DEFAULT false,
    has_ev_charger BOOLEAN NOT NULL DEFAULT false,
    width_m NUMERIC(4,2) NOT NULL DEFAULT 2.50,
    length_m NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OUT_OF_SERVICE')),
    layout_x INTEGER,
    layout_y INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_slots_floor_code UNIQUE (floor_id, slot_code)
);

CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN ('HOURLY', 'DAILY', 'FLAT')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    minimum_duration_minutes INTEGER NOT NULL DEFAULT 60,
    maximum_duration_minutes INTEGER NOT NULL DEFAULT 720,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pricing_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference VARCHAR(24) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES parking_slots(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
    price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    cancellation_reason VARCHAR(500),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    allocation_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_bookings_reference UNIQUE (booking_reference),
    CONSTRAINT chk_bookings_time CHECK (end_time > start_time)
);

-- Authoritative, database-level protection against double booking.
-- Applies to all live states; cancelled/completed rows do not block a slot.
ALTER TABLE bookings
    ADD CONSTRAINT excl_bookings_slot_time
    EXCLUDE USING gist (
        slot_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status IN ('PENDING', 'CONFIRMED', 'ACTIVE'));

CREATE INDEX idx_bookings_user ON bookings (user_id);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_slot_time ON bookings USING gist (slot_id, tstzrange(start_time, end_time, '[)'));
CREATE INDEX idx_bookings_reference ON bookings (booking_reference);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    provider VARCHAR(40) NOT NULL,
    provider_reference VARCHAR(120),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_payments_provider_reference
    ON payments (provider, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_out_time TIMESTAMPTZ,
    verification_method VARCHAR(30) NOT NULL CHECK (verification_method IN ('QR', 'MANUAL', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_check_ins_booking UNIQUE (booking_id)
);
CREATE INDEX idx_check_ins_booking ON check_ins (booking_id);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_password_reset_hash UNIQUE (token_hash)
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(60) NOT NULL,
    resource_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

CREATE INDEX idx_facilities_status ON facilities (status);
CREATE INDEX idx_floors_facility ON parking_floors (facility_id);
CREATE INDEX idx_slots_floor ON parking_slots (floor_id);
CREATE INDEX idx_slots_status ON parking_slots (status);
CREATE INDEX idx_pricing_facility ON pricing_rules (facility_id, active);
CREATE INDEX idx_vehicles_user ON vehicles (user_id);
