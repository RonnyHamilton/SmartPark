-- Demo catalogue data. Safe for development; production administrators
-- should create their own facilities through the admin API.
-- Demo credentials are created by DemoDataSeeder (dev profile only).

INSERT INTO facilities (id, name, description, address, city, latitude, longitude, timezone,
                        opens_at, closes_at, operating_days, amenities, status,
                        min_duration_minutes, max_duration_minutes, advance_booking_days,
                        cancellation_cutoff_minutes, buffer_minutes)
VALUES
('11111111-1111-4111-8111-111111111111', 'Phoenix Marketcity Deck',
 'Covered multi-level parking beside the mall''s east atrium, with EV charging and 24-hour security patrols.',
 'Viman Nagar Road, Viman Nagar', 'Pune', 18.561900, 73.916900, 'Asia/Kolkata',
 '06:00', '23:30', 'MON,TUE,WED,THU,FRI,SAT,SUN',
 ARRAY['EV charging','CCTV','24/7 security','Wheelchair access','Elevator'], 'ACTIVE', 60, 720, 30, 60, 15),
('22222222-2222-4222-8222-222222222222', 'Koregaon Park Plaza',
 'Boutique open-air deck in the heart of Koregaon Park, steps from Lane 7 restaurants and offices.',
 'North Main Road, Koregaon Park', 'Pune', 18.536200, 73.894600, 'Asia/Kolkata',
 '07:00', '23:00', 'MON,TUE,WED,THU,FRI,SAT,SUN',
 ARRAY['CCTV','EV charging','Car wash','Wheelchair access'], 'ACTIVE', 30, 600, 21, 60, 10),
('33333333-3333-4333-8333-333333333333', 'Hinjewadi Tech Park Hub',
 'High-capacity commuter parking for the Rajiv Gandhi Infotech Park with covered walkways.',
 'Phase 2, Hinjewadi Rajiv Gandhi Infotech Park', 'Pune', 18.591300, 73.738900, 'Asia/Kolkata',
 '06:00', '22:00', 'MON,TUE,WED,THU,FRI,SAT',
 ARRAY['EV charging','CCTV','Covered walkway','Wheelchair access','Cafeteria'], 'ACTIVE', 60, 720, 45, 120, 20),
('44444444-4444-4444-8444-444444444444', 'Airport Transit Hub',
 'Premium short-stay and long-stay parking minutes from the terminal, with 24-hour shuttle access.',
 'Airport Road, Lohegaon', 'Pune', 18.579300, 73.908900, 'Asia/Kolkata',
 '00:00', '23:59', 'MON,TUE,WED,THU,FRI,SAT,SUN',
 ARRAY['24/7 security','CCTV','Shuttle','Wheelchair access','EV charging'], 'ACTIVE', 30, 1440, 60, 30, 0);

INSERT INTO parking_floors (id, facility_id, name, floor_number, display_order) VALUES
('11111111-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-111111111111', 'Ground', 0, 0),
('11111111-aaaa-4aaa-8aaa-000000000002', '11111111-1111-4111-8111-111111111111', 'Level 1', 1, 1),
('22222222-aaaa-4aaa-8aaa-000000000001', '22222222-2222-4222-8222-222222222222', 'P1 — Deck', 0, 0),
('22222222-aaaa-4aaa-8aaa-000000000002', '22222222-2222-4222-8222-222222222222', 'P2 — Roof', 1, 1),
('33333333-aaaa-4aaa-8aaa-000000000001', '33333333-3333-4333-8333-333333333333', 'Ground', 0, 0),
('33333333-aaaa-4aaa-8aaa-000000000002', '33333333-3333-4333-8333-333333333333', 'Level 1', 1, 1),
('33333333-aaaa-4aaa-8aaa-000000000003', '33333333-3333-4333-8333-333333333333', 'Level 2', 2, 2),
('44444444-aaaa-4aaa-8aaa-000000000001', '44444444-4444-4444-8444-444444444444', 'Ground', 0, 0),
('44444444-aaaa-4aaa-8aaa-000000000002', '44444444-4444-4444-8444-444444444444', 'Level 1', 1, 1);

-- Generate a realistic slot mix per floor. Layout coordinates feed the
-- visual floor plan; each slot is a real bookable row.
INSERT INTO parking_slots (floor_id, slot_code, slot_type, supported_vehicle_types,
                           is_accessible, has_ev_charger, width_m, length_m, status, layout_x, layout_y)
SELECT
    f.id,
    CASE WHEN f.floor_number = 0 THEN 'G' ELSE 'L' || f.floor_number END || '-' || lpad(i::text, 2, '0'),
    CASE
        WHEN i % 11 = 0 THEN 'MOTORCYCLE'
        WHEN i % 9 = 0 THEN 'ACCESSIBLE'
        WHEN i % 7 = 0 THEN 'EV'
        WHEN i % 5 = 0 THEN 'LARGE'
        ELSE 'STANDARD'
    END,
    CASE
        WHEN i % 11 = 0 THEN ARRAY['MOTORCYCLE']
        WHEN i % 9 = 0 THEN ARRAY['CAR','SUV','EV']
        WHEN i % 7 = 0 THEN ARRAY['CAR','SUV','EV']
        WHEN i % 5 = 0 THEN ARRAY['SUV','CAR']
        ELSE ARRAY['CAR','SUV']
    END,
    (i % 9 = 0),
    (i % 7 = 0),
    CASE WHEN i % 11 = 0 THEN 1.20 WHEN i % 5 = 0 THEN 2.80 ELSE 2.50 END,
    CASE WHEN i % 11 = 0 THEN 2.30 WHEN i % 5 = 0 THEN 5.40 ELSE 5.00 END,
    CASE WHEN i IN (4, 13) THEN 'OUT_OF_SERVICE' ELSE 'AVAILABLE' END,
    ((i - 1) % 6),
    ((i - 1) / 6)
FROM parking_floors f
CROSS JOIN LATERAL generate_series(1, 12) AS i
WHERE f.facility_id IN (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
);

INSERT INTO pricing_rules (facility_id, rate_type, amount, minimum_duration_minutes,
                           maximum_duration_minutes, effective_from, effective_to, active)
VALUES
('11111111-1111-4111-8111-111111111111', 'HOURLY', 60.00, 60, 720, CURRENT_DATE - 30, NULL, true),
('22222222-2222-4222-8222-222222222222', 'HOURLY', 45.00, 30, 600, CURRENT_DATE - 30, NULL, true),
('33333333-3333-4333-8333-333333333333', 'HOURLY', 35.00, 60, 720, CURRENT_DATE - 30, NULL, true),
('33333333-3333-4333-8333-333333333333', 'DAILY', 220.00, 480, 1440, CURRENT_DATE - 30, NULL, true),
('44444444-4444-4444-8444-444444444444', 'HOURLY', 80.00, 30, 1440, CURRENT_DATE - 30, NULL, true),
('44444444-4444-4444-8444-444444444444', 'DAILY', 480.00, 720, 2880, CURRENT_DATE - 30, NULL, true);
