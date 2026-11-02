-- SmartPark: Seed Overstay, Conflict, and No-Show Operational Demo Data
-- PostgreSQL 16+

BEGIN;

-- 1. Ensure Ronny Hamilton has a registered vehicle
DO $$
DECLARE
    v_ronny_id UUID;
BEGIN
    SELECT id INTO v_ronny_id FROM users WHERE email = 'ronnyhamilton21@gmail.com';
    IF v_ronny_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM vehicles WHERE user_id = v_ronny_id) THEN
            INSERT INTO vehicles (id, user_id, registration_number, normalized_registration, vehicle_type, width_m, length_m, is_default)
            VALUES (gen_random_uuid(), v_ronny_id, 'MH 12 SP 2026', 'MH12SP2026', 'CAR', 1.80, 4.50, TRUE);
        END IF;
    END IF;
END $$;

-- 2. Clean up any previous demo overstay references to remain idempotent
DELETE FROM check_ins WHERE booking_id IN (
    SELECT id FROM bookings WHERE booking_reference IN ('SP-OVRST001', 'SP-OVRST002', 'SP-OVRST003', 'SP-CNFLCT01', 'SP-NOSHOW01')
);
DELETE FROM bookings WHERE booking_reference IN ('SP-OVRST001', 'SP-OVRST002', 'SP-OVRST003', 'SP-CNFLCT01', 'SP-NOSHOW01');

-- 3. Insert Overstay Record 1: Phoenix Marketcity Deck G-01 (Active Overstay by demo@smartpark.local)
DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
    v_booking_id UUID := gen_random_uuid();
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'demo@smartpark.local';
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    SELECT s.id INTO v_slot_id 
    FROM parking_slots s 
    JOIN parking_floors fl ON fl.id = s.floor_id 
    JOIN facilities f ON f.id = fl.facility_id 
    WHERE f.name ILIKE '%Phoenix%' AND s.slot_code = 'G-01';

    INSERT INTO bookings (
        id, booking_reference, user_id, slot_id, vehicle_id,
        start_time, end_time, status, price_amount, currency,
        allocation_reason, overstay_start_time, overstay_duration_minutes, overstay_charge,
        created_at, updated_at
    ) VALUES (
        v_booking_id, 'SP-OVRST001', v_user_id, v_slot_id, v_vehicle_id,
        NOW() - INTERVAL '3 hours', NOW() - INTERVAL '45 minutes', 'OVERSTAY', 120.00, 'INR',
        'Physical bay occupied — Customer exceeded reservation window by 45 minutes.',
        NOW() - INTERVAL '45 minutes', 45, 90.00,
        NOW() - INTERVAL '3 hours', NOW()
    );

    INSERT INTO check_ins (
        id, booking_id, check_in_time, check_out_time, verification_method, created_at
    ) VALUES (
        gen_random_uuid(), v_booking_id, NOW() - INTERVAL '2 hours 55 minutes', NULL, 'QR', NOW() - INTERVAL '2 hours 55 minutes'
    );
END $$;

-- 4. Insert Overstay Record 2: Airport Transit Hub G-01 (Severe Active Overstay by rohan@smartpark.local)
DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
    v_booking_id UUID := gen_random_uuid();
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'rohan@smartpark.local';
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    SELECT s.id INTO v_slot_id 
    FROM parking_slots s 
    JOIN parking_floors fl ON fl.id = s.floor_id 
    JOIN facilities f ON f.id = fl.facility_id 
    WHERE f.name ILIKE '%Airport%' AND s.slot_code = 'G-01';

    INSERT INTO bookings (
        id, booking_reference, user_id, slot_id, vehicle_id,
        start_time, end_time, status, price_amount, currency,
        allocation_reason, overstay_start_time, overstay_duration_minutes, overstay_charge,
        created_at, updated_at
    ) VALUES (
        v_booking_id, 'SP-OVRST002', v_user_id, v_slot_id, v_vehicle_id,
        NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour 45 minutes', 'OVERSTAY', 240.00, 'INR',
        'Physical bay occupied — Flight delay reported, 1.5x penalty tariff accumulating.',
        NOW() - INTERVAL '1 hour 45 minutes', 105, 240.00,
        NOW() - INTERVAL '5 hours', NOW()
    );

    INSERT INTO check_ins (
        id, booking_id, check_in_time, check_out_time, verification_method, created_at
    ) VALUES (
        gen_random_uuid(), v_booking_id, NOW() - INTERVAL '4 hours 58 minutes', NULL, 'QR', NOW() - INTERVAL '4 hours 58 minutes'
    );
END $$;

-- 5. Insert Conflict Record: Airport Transit Hub G-01 (Blocked downstream reservation requiring admin resolution)
DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'ronnyhamilton21@gmail.com';
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM users WHERE email = 'demo@smartpark.local';
    END IF;
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    SELECT s.id INTO v_slot_id 
    FROM parking_slots s 
    JOIN parking_floors fl ON fl.id = s.floor_id 
    JOIN facilities f ON f.id = fl.facility_id 
    WHERE f.name ILIKE '%Airport%' AND s.slot_code = 'G-01';

    INSERT INTO bookings (
        id, booking_reference, user_id, slot_id, vehicle_id,
        start_time, end_time, status, price_amount, currency,
        allocation_reason, conflict_reason, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), 'SP-CNFLCT01', v_user_id, v_slot_id, v_vehicle_id,
        NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '2 hours 15 minutes', 'CONFLICT_REQUIRES_ADMIN', 160.00, 'INR',
        'Pending manual reassignment by facility operations manager.',
        'Slot G-01 is physically blocked by an overstaying vehicle (MH 14 XY 9012). No compatible alternate slot was automatically available.',
        NOW() - INTERVAL '30 minutes', NOW()
    );
END $$;

-- 6. Insert Completed Historical Overstay (Checked out late with penalty settled)
DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
    v_booking_id UUID := gen_random_uuid();
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'demo@smartpark.local';
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    SELECT s.id INTO v_slot_id 
    FROM parking_slots s 
    JOIN parking_floors fl ON fl.id = s.floor_id 
    JOIN facilities f ON f.id = fl.facility_id 
    WHERE f.name ILIKE '%Koregaon%' AND s.slot_code = 'G-01';

    INSERT INTO bookings (
        id, booking_reference, user_id, slot_id, vehicle_id,
        start_time, end_time, status, price_amount, currency,
        allocation_reason, overstay_start_time, overstay_duration_minutes, overstay_charge,
        created_at, updated_at
    ) VALUES (
        v_booking_id, 'SP-OVRST003', v_user_id, v_slot_id, v_vehicle_id,
        NOW() - INTERVAL '26 hours', NOW() - INTERVAL '24 hours', 'COMPLETED', 140.00, 'INR',
        'Completed session — 75 min overstay surcharge of ₹135.00 settled at exit barrier.',
        NOW() - INTERVAL '24 hours', 75, 135.00,
        NOW() - INTERVAL '26 hours', NOW() - INTERVAL '22 hours 45 minutes'
    );

    INSERT INTO check_ins (
        id, booking_id, check_in_time, check_out_time, verification_method, created_at
    ) VALUES (
        gen_random_uuid(), v_booking_id, NOW() - INTERVAL '25 hours 55 minutes', NOW() - INTERVAL '22 hours 45 minutes', 'QR', NOW() - INTERVAL '25 hours 55 minutes'
    );
END $$;

-- 7. Insert Driver No-Show (Auto-cancelled after 15-min grace period)
DO $$
DECLARE
    v_user_id UUID;
    v_vehicle_id UUID;
    v_slot_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'rohan@smartpark.local';
    SELECT id INTO v_vehicle_id FROM vehicles WHERE user_id = v_user_id LIMIT 1;
    SELECT s.id INTO v_slot_id 
    FROM parking_slots s 
    JOIN parking_floors fl ON fl.id = s.floor_id 
    JOIN facilities f ON f.id = fl.facility_id 
    WHERE f.name ILIKE '%Hinjewadi%' AND s.slot_code = 'G-01';

    INSERT INTO bookings (
        id, booking_reference, user_id, slot_id, vehicle_id,
        start_time, end_time, status, price_amount, currency,
        allocation_reason, cancellation_reason, no_show_detected_at,
        created_at, updated_at
    ) VALUES (
        gen_random_uuid(), 'SP-NOSHOW01', v_user_id, v_slot_id, v_vehicle_id,
        NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', 'NO_SHOW', 70.00, 'INR',
        'Initial reservation hold.',
        'Customer did not arrive within the 15-minute check-in grace period. Bay liberated for other drivers.',
        NOW() - INTERVAL '3 hours 45 minutes',
        NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 45 minutes'
    );
END $$;

COMMIT;
