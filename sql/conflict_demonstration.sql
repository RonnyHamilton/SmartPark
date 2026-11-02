-- =====================================================================
-- SmartPark: Double-Booking Prevention & Concurrency Conflict Demo
-- Purpose: Demonstrate how PostgreSQL GiST Exclusion Constraint
--          `excl_bookings_slot_time` mathematically guarantees zero
--          double-bookings at the physical database storage layer.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- STEP 1: Inspect the GiST exclusion constraint on the bookings table
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
WHERE conname = 'excl_bookings_slot_time';

-- STEP 2: CONFLICT DEMONSTRATION TRANSACTION
-- We create Booking #1 for Slot G-01 between [T, T+2 hours].
-- Then we immediately attempt to insert Booking #2 for Slot G-01 between [T+1 hour, T+3 hours].
-- The database engine immediately blocks and rejects Booking #2 with an exclusion constraint violation.

DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
    v_slot_code VARCHAR(20);
    v_start TIMESTAMPTZ := NOW() + interval '1 day';
    v_end TIMESTAMPTZ := NOW() + interval '1 day' + interval '2 hours';
    v_initial_booking_id UUID;
BEGIN
    -- 1. Obtain a valid active user
    SELECT id INTO v_user_id FROM users WHERE role = 'USER' LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in users table. Please run seeds first.';
    END IF;

    -- 2. Obtain a registered vehicle for the user
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    IF v_vehicle_id IS NULL THEN
        -- Create a temporary vehicle for demonstration if none exists
        INSERT INTO vehicles (user_id, registration_number, normalized_registration, vehicle_type, is_default)
        VALUES (v_user_id, 'KA-01-AB-1234', 'KA01AB1234', 'CAR', TRUE)
        RETURNING id INTO v_vehicle_id;
    END IF;

    -- 3. Obtain a valid parking slot
    SELECT id, slot_code INTO v_slot_id, v_slot_code FROM parking_slots WHERE status = 'AVAILABLE' LIMIT 1;
    IF v_slot_id IS NULL THEN
        RAISE EXCEPTION 'No available parking slot found in parking_slots table.';
    END IF;

    -- 4. Insert Primary Baseline Reservation (Booking A)
    INSERT INTO bookings (
        booking_reference,
        user_id,
        slot_id,
        vehicle_id,
        start_time,
        end_time,
        status,
        price_amount,
        currency,
        version
    ) VALUES (
        'SP-CONCURRENCY-A',
        v_user_id,
        v_slot_id,
        v_vehicle_id,
        v_start,
        v_end,
        'CONFIRMED',
        100.00,
        'INR',
        0
    ) RETURNING id INTO v_initial_booking_id;

    RAISE NOTICE 'STEP A SUCCESS: Primary reservation SP-CONCURRENCY-A confirmed for slot % between % and %',
        v_slot_code, v_start, v_end;

    -- 5. Attempt Conflicting Overlapping Reservation (Booking B) on the same slot
    BEGIN
        RAISE NOTICE 'STEP B: Attempting overlapping reservation on slot % between % and %...',
            v_slot_code, v_start + interval '30 minutes', v_end + interval '1 hour';

        INSERT INTO bookings (
            booking_reference,
            user_id,
            slot_id,
            vehicle_id,
            start_time,
            end_time,
            status,
            price_amount,
            currency,
            version
        ) VALUES (
            'SP-CONCURRENCY-B',
            v_user_id,
            v_slot_id,
            v_vehicle_id,
            v_start + interval '30 minutes',  -- OVERLAPS WITH BOOKING A
            v_end + interval '1 hour',
            'CONFIRMED',
            120.00,
            'INR',
            0
        );

        RAISE EXCEPTION 'UNEXPECTED: Overlapping booking was allowed! Concurrency check failed.';
    EXCEPTION
        WHEN exclusion_violation THEN
            RAISE NOTICE '------------------------------------------------------------------------';
            RAISE NOTICE 'VERIFICATION SUCCESSFUL:';
            RAISE NOTICE 'PostgreSQL GiST exclusion constraint (excl_bookings_slot_time) REJECTED';
            RAISE NOTICE 'the overlapping booking attempt with SQLSTATE 23P01 (exclusion_violation).';
            RAISE NOTICE 'Mathematical zero double-booking guarantee confirmed at database kernel!';
            RAISE NOTICE '------------------------------------------------------------------------';
    END;

    -- Clean up test baseline booking
    DELETE FROM bookings WHERE id = v_initial_booking_id;
    RAISE NOTICE 'Cleaned up temporary demonstration booking record.';
END $$;
