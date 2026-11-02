-- =====================================================================
-- SmartPark: Analytics, Reporting & Business Intelligence Queries
-- Purpose: Extract executive insights including revenue, peak occupancy,
--          top users, popular facilities, and duration distributions.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. Revenue & booking volume breakdown by Facility
SELECT 
    f.name AS facility_name,
    f.city,
    COUNT(b.id) AS total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED') AS completed_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'CANCELLED') AS cancelled_bookings,
    COALESCE(SUM(b.price_amount) FILTER (WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')), 0) AS total_revenue_inr
FROM facilities f
LEFT JOIN parking_floors fl ON fl.facility_id = f.id
LEFT JOIN parking_slots s ON s.floor_id = fl.id
LEFT JOIN bookings b ON b.slot_id = s.id
GROUP BY f.id, f.name, f.city
ORDER BY total_revenue_inr DESC;

-- 2. Daily revenue and booking volume trend (Last 30 Days)
SELECT 
    DATE_TRUNC('day', b.created_at)::DATE AS booking_date,
    COUNT(*) AS total_bookings_created,
    SUM(b.price_amount) AS daily_booked_value_inr,
    COUNT(*) FILTER (WHERE b.status = 'COMPLETED') AS completed_count
FROM bookings b
GROUP BY DATE_TRUNC('day', b.created_at)::DATE
ORDER BY booking_date DESC;

-- 3. Top 10 most frequent customers / parkers
SELECT 
    u.id AS user_id,
    u.name,
    u.email,
    COUNT(b.id) AS booking_count,
    COALESCE(SUM(b.price_amount), 0) AS total_spent_inr,
    MAX(b.created_at) AS last_booking_date
FROM users u
JOIN bookings b ON b.user_id = u.id
GROUP BY u.id, u.name, u.email
ORDER BY booking_count DESC, total_spent_inr DESC
LIMIT 10;

-- 4. Slot utilization rate per floor across facilities
SELECT 
    f.name AS facility_name,
    fl.name AS floor_name,
    COUNT(DISTINCT s.id) AS total_bay_count,
    COUNT(b.id) AS total_reservations_served
FROM facilities f
JOIN parking_floors fl ON fl.facility_id = f.id
JOIN parking_slots s ON s.floor_id = fl.id
LEFT JOIN bookings b ON b.slot_id = s.id
GROUP BY f.name, fl.name, fl.floor_number
ORDER BY f.name, fl.floor_number;

-- 5. Booking duration analysis (average, minimum, maximum reserved hours)
SELECT 
    f.name AS facility_name,
    ROUND(AVG(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600)::NUMERIC, 2) AS avg_duration_hours,
    ROUND(MIN(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600)::NUMERIC, 2) AS min_duration_hours,
    ROUND(MAX(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600)::NUMERIC, 2) AS max_duration_hours
FROM facilities f
JOIN parking_floors fl ON fl.facility_id = f.id
JOIN parking_slots s ON s.floor_id = fl.id
JOIN bookings b ON b.slot_id = s.id
GROUP BY f.id, f.name;
