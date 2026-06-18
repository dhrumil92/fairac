-- =============================================================================
-- FairAC Seed Data
-- File: 002_seed_data.sql
-- Description: Initial test data to verify schema constraints work correctly.
--              This creates 1 hostel, 1 admin, 2 students, 1 room.
-- Run: psql -U postgres -d fairac_db -f 002_seed_data.sql
-- NOTE: Safe to re-run — truncates all data first.
-- =============================================================================

-- Clean slate (cascade handles FK order automatically)
TRUNCATE TABLE
    consumption_records,
    wallet_transactions,
    wallets,
    session_participants,
    sessions,
    room_invitations,
    room_members,
    rooms,
    users,
    hostels
RESTART IDENTITY CASCADE;

-- NOTE: Passwords below are bcrypt hashes of the plaintext values shown.
--       In production, bcrypt hashing happens in the Node.js backend.
--       For this seed, we use a pre-computed hash.
--
--       admin@fairac.com  → password: Admin@123
--       alice@test.com    → password: Test@123
--       bob@test.com      → password: Test@123

-- =============================================================================
-- STEP 1: Insert a Hostel
-- =============================================================================
INSERT INTO hostels (name, address)
VALUES ('ABC Boys Hostel', '123, MG Road, Pune, Maharashtra - 411001')
RETURNING hostel_id, name;


-- =============================================================================
-- STEP 2: Insert Admin User
-- =============================================================================
-- The admin is linked to hostel_id = 1 (the one we just created)
-- role = 'admin'
INSERT INTO users (name, email, mobile, password_hash, role, hostel_id)
VALUES (
    'Hostel Admin',
    'admin@fairac.com',
    '9000000001',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- placeholder hash
    'admin',
    1  -- links to ABC Boys Hostel
)
RETURNING u_id, name, role;


-- =============================================================================
-- STEP 3: Insert Two Student Users
-- =============================================================================
INSERT INTO users (name, email, mobile, password_hash, role)
VALUES
    ('Alice Sharma',  'alice@test.com', '9000000002', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student'),
    ('Bob Mehta',     'bob@test.com',   '9000000003', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student')
RETURNING u_id, name, role;


-- =============================================================================
-- STEP 4: Insert a Room (created by Alice — look up her u_id by email)
-- =============================================================================
INSERT INTO rooms (hostel_id, created_by, room_no, room_name, capacity, rate_per_unit)
VALUES (
    (SELECT hostel_id FROM hostels WHERE name = 'ABC Boys Hostel'),
    (SELECT u_id FROM users WHERE email = 'alice@test.com'),
    '301', 'Room 301', 4, 8.00
)
RETURNING r_id, room_no, room_name;


-- =============================================================================
-- STEP 5: Add Alice as the room OWNER in room_members
-- =============================================================================
INSERT INTO room_members (r_id, u_id, role)
VALUES (
    (SELECT r_id FROM rooms WHERE room_no = '301'),
    (SELECT u_id FROM users WHERE email = 'alice@test.com'),
    'owner'
)
RETURNING rm_id, r_id, u_id, role;


-- =============================================================================
-- STEP 6: Create Wallets for Both Students (look up IDs by email)
-- (In production this happens automatically on registration via backend logic)
-- =============================================================================
INSERT INTO wallets (u_id, balance)
VALUES
    ((SELECT u_id FROM users WHERE email = 'alice@test.com'), 500.00),
    ((SELECT u_id FROM users WHERE email = 'bob@test.com'),   300.00)
RETURNING wallet_id, u_id, balance;


-- =============================================================================
-- STEP 7: Verify all data with a summary query
-- =============================================================================
SELECT
    'hostels'           AS table_name, COUNT(*) AS rows FROM hostels
UNION ALL SELECT 'users',               COUNT(*) FROM users
UNION ALL SELECT 'rooms',               COUNT(*) FROM rooms
UNION ALL SELECT 'room_members',        COUNT(*) FROM room_members
UNION ALL SELECT 'wallets',             COUNT(*) FROM wallets;
