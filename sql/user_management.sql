-- =====================================================================
-- SmartPark: User & Vehicle Management Queries
-- Purpose: Inspect user accounts, role allocations, failed login security
--          lockout statuses, and registered vehicles per user.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. List all registered users with their roles and security flags
SELECT 
    id,
    name,
    email,
    role,
    account_status,
    accessibility_required,
    failed_login_attempts,
    locked_until,
    created_at
FROM users
ORDER BY created_at ASC;

-- 2. Count users aggregated by role
SELECT 
    role,
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE account_status = 'ACTIVE') AS active_accounts,
    COUNT(*) FILTER (WHERE account_status = 'DISABLED') AS disabled_accounts
FROM users
GROUP BY role;

-- 3. Check for locked or high-risk accounts (brute-force defense)
SELECT 
    id,
    name,
    email,
    failed_login_attempts,
    locked_until,
    CASE 
        WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN 'LOCKED'
        ELSE 'UNLOCKED'
    END AS current_lock_status
FROM users
WHERE failed_login_attempts > 0 OR locked_until IS NOT NULL;

-- 4. List all vehicles with owner details and normalization verification
SELECT 
    v.id AS vehicle_id,
    u.name AS owner_name,
    u.email AS owner_email,
    v.registration_number,
    v.normalized_registration,
    v.vehicle_type,
    v.width_m,
    v.length_m,
    v.is_default
FROM vehicles v
JOIN users u ON u.id = v.user_id
ORDER BY u.name, v.registration_number;

-- 5. Count vehicles by vehicle type (CAR, SUV, MOTORCYCLE, EV)
SELECT 
    vehicle_type,
    COUNT(*) AS vehicle_count
FROM vehicles
GROUP BY vehicle_type
ORDER BY vehicle_count DESC;

-- 6. Active Refresh Tokens per user (session tracking)
SELECT 
    u.email,
    r.id AS token_id,
    r.expires_at,
    r.revoked_at,
    CASE 
        WHEN r.revoked_at IS NOT NULL THEN 'REVOKED'
        WHEN r.expires_at < NOW() THEN 'EXPIRED'
        ELSE 'ACTIVE'
    END AS session_status
FROM refresh_tokens r
JOIN users u ON u.id = r.user_id
ORDER BY r.created_at DESC;
