-- =====================================================================
-- SmartPark: Parking Inventory & Physical Catalog Queries
-- Purpose: Inspect parking facilities, floors, slots, EV capability,
--          accessibility compliance, and pricing rules.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. List all facilities with operational hours and slot counts
SELECT 
    f.id,
    f.name AS facility_name,
    f.city,
    f.address,
    f.opens_at,
    f.closes_at,
    f.status,
    f.min_duration_minutes,
    f.max_duration_minutes,
    COUNT(s.id) AS total_slots
FROM facilities f
LEFT JOIN parking_floors fl ON fl.facility_id = f.id
LEFT JOIN parking_slots s ON s.floor_id = fl.id
GROUP BY f.id, f.name, f.city, f.address, f.opens_at, f.closes_at, f.status, f.min_duration_minutes, f.max_duration_minutes
ORDER BY total_slots DESC;

-- 2. Breakdown of parking floors per facility
SELECT 
    f.name AS facility_name,
    fl.name AS floor_name,
    fl.floor_number,
    fl.display_order,
    COUNT(s.id) AS slot_count
FROM facilities f
JOIN parking_floors fl ON fl.facility_id = f.id
LEFT JOIN parking_slots s ON s.floor_id = fl.id
GROUP BY f.name, fl.name, fl.floor_number, fl.display_order
ORDER BY f.name, fl.floor_number;

-- 3. Inventory breakdown by Slot Type and EV Charger capability
SELECT 
    f.name AS facility_name,
    s.slot_type,
    s.has_ev_charger,
    s.is_accessible,
    s.status AS slot_maintenance_status,
    COUNT(*) AS slot_count
FROM parking_slots s
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
GROUP BY f.name, s.slot_type, s.has_ev_charger, s.is_accessible, s.status
ORDER BY f.name, s.slot_type;

-- 4. Pricing rules catalog per facility
SELECT 
    f.name AS facility_name,
    p.rate_type,
    p.amount,
    p.minimum_duration_minutes,
    p.maximum_duration_minutes,
    p.effective_from,
    p.effective_to,
    p.active
FROM pricing_rules p
JOIN facilities f ON f.id = p.facility_id
ORDER BY f.name, p.rate_type;

-- 5. List available EV-charging slots for quick reservation
SELECT 
    f.name AS facility_name,
    fl.name AS floor_name,
    s.slot_code,
    s.slot_type,
    s.width_m,
    s.length_m
FROM parking_slots s
JOIN parking_floors fl ON fl.id = s.floor_id
JOIN facilities f ON f.id = fl.facility_id
WHERE s.has_ev_charger = TRUE AND s.status = 'AVAILABLE'
ORDER BY f.name, s.slot_code;
