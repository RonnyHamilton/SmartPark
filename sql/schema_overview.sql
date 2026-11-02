-- =====================================================================
-- SmartPark: Database Schema Overview & Integrity Verification
-- Purpose: Inspect all tables, column definitions, constraints, indexes,
--          and table storage statistics in PostgreSQL.
-- Target DB: smartpark (PostgreSQL 16)
-- =====================================================================

-- 1. List all tables in public schema with row count estimates
SELECT 
    schemaname,
    relname AS table_name,
    n_live_tup AS estimated_row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY relname ASC;

-- 2. Inspect all primary keys, foreign keys, and unique constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 3. Verify all PostgreSQL Indexes (including GiST and BTree)
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4. Verify Double-Booking GiST Exclusion Constraint Definition
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
WHERE contype = 'x' AND conrelid::regclass::text = 'bookings';

-- 5. Inspect Flyway Migration History
SELECT 
    installed_rank,
    version,
    description,
    type,
    script,
    installed_on,
    execution_time,
    success
FROM flyway_schema_history
ORDER BY installed_rank ASC;
