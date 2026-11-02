-- =====================================================================
-- SmartPark: Security & Compliance Audit Trail Queries
-- Purpose: Inspect audit log events, actor activities, authentication
--          failures, booking creations, cancellations, and metadata.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. Latest 25 security audit records with actor information
SELECT 
    a.id,
    a.created_at,
    u.name AS actor_name,
    u.email AS actor_email,
    u.role AS actor_role,
    a.action,
    a.resource_type,
    a.resource_id,
    a.metadata
FROM audit_logs a
LEFT JOIN users u ON u.id = a.actor_user_id
ORDER BY a.created_at DESC
LIMIT 25;

-- 2. Aggregate count of security actions performed across the system
SELECT 
    action,
    COUNT(*) AS event_count,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen
FROM audit_logs
GROUP BY action
ORDER BY event_count DESC;

-- 3. Filter security events related to authentication and account lockouts
SELECT 
    a.id,
    a.created_at,
    COALESCE(u.email, 'SYSTEM_OR_UNAUTHENTICATED') AS email,
    a.action,
    a.metadata
FROM audit_logs a
LEFT JOIN users u ON u.id = a.actor_user_id
WHERE a.action IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'USER_REGISTERED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET')
ORDER BY a.created_at DESC;

-- 4. Audit trail for specific booking lifecycle events
SELECT 
    a.id,
    a.created_at,
    u.email AS performed_by,
    a.action,
    a.resource_id AS booking_id,
    a.metadata->>'bookingReference' AS booking_reference,
    a.metadata
FROM audit_logs a
LEFT JOIN users u ON u.id = a.actor_user_id
WHERE a.resource_type = 'BOOKING'
ORDER BY a.created_at DESC;
