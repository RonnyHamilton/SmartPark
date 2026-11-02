-- =====================================================================
-- SmartPark: Booking Operations & Lifecycle Management Queries
-- Purpose: Inspect reservations, check-ins, lifecycle transitions,
--          and user/vehicle associations in the active booking ledger.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. Detailed booking ledger with User, Vehicle, Facility, and Slot details
SELECT 
    b.booking_reference,
    u.name AS user_name,
    u.email AS user_email,
    v.registration_number,
    v.vehicle_type,
    f.name AS facility_name,
    fl.name AS floor_name,
    s.slot_code,
    b.start_time,
    b.end_time,
    b.status,
    b.price_amount,
    b.currency,
    b.version AS optimistic_lock_version,
    b.created_at
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN vehicles v ON v.id = b.vehicle_id
JOIN parking_slots s ON s.id = b.slot_id
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
ORDER BY b.start_time DESC;

-- 2. Count bookings by lifecycle status (PENDING, CONFIRMED, ACTIVE, COMPLETED, CANCELLED, EXPIRED)
SELECT 
    status,
    COUNT(*) AS total_count,
    ROUND(AVG(price_amount), 2) AS average_fare,
    SUM(price_amount) AS total_revenue
FROM bookings
GROUP BY status
ORDER BY total_count DESC;

-- 3. Currently ACTIVE reservations (cars currently parked in bays)
SELECT 
    b.booking_reference,
    u.name AS driver,
    v.registration_number,
    f.name AS facility,
    s.slot_code,
    b.start_time,
    b.end_time,
    ci.check_in_time,
    ci.verification_method
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN vehicles v ON v.id = b.vehicle_id
JOIN parking_slots s ON s.id = b.slot_id
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
LEFT JOIN check_ins ci ON ci.booking_id = b.id
WHERE b.status = 'ACTIVE';

-- 4. Cancelled bookings with reason and actor
SELECT 
    b.booking_reference,
    u.name AS booked_by,
    b.cancellation_reason,
    b.cancelled_at,
    cb.email AS cancelled_by_email
FROM bookings b
JOIN users u ON u.id = b.user_id
LEFT JOIN users cb ON cb.id = b.cancelled_by
WHERE b.status = 'CANCELLED'
ORDER BY b.cancelled_at DESC;

-- 5. Verified Check-In and Check-Out timestamps
SELECT 
    b.booking_reference,
    u.email AS customer_email,
    s.slot_code,
    ci.check_in_time,
    ci.check_out_time,
    ci.verification_method,
    CASE 
        WHEN ci.check_out_time IS NOT NULL THEN 'CHECKED_OUT'
        WHEN ci.check_in_time IS NOT NULL THEN 'CHECKED_IN'
        ELSE 'PENDING_ARRIVAL'
    END AS bay_occupancy_status
FROM check_ins ci
JOIN bookings b ON b.id = ci.booking_id
JOIN users u ON u.id = b.user_id
JOIN parking_slots s ON s.id = b.slot_id
ORDER BY ci.check_in_time DESC;
