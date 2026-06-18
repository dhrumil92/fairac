-- =============================================================================
-- FairAC Constraint Validation Tests
-- File: 003_constraint_tests.sql
-- Description: Tests that all CHECK constraints and UNIQUE constraints
--              correctly REJECT invalid data. Each statement should FAIL.
-- Run: psql -U postgres -d fairac_db -f 003_constraint_tests.sql
-- =============================================================================

\echo '--- TEST 1: Invalid role value should fail ---'
INSERT INTO users (name, email, mobile, password_hash, role)
VALUES ('Bad User', 'bad@test.com', '9999999999', 'hash', 'superuser');
-- Expected: ERROR - violates check constraint "chk_users_role"

\echo '--- TEST 2: Duplicate email should fail ---'
INSERT INTO users (name, email, mobile, password_hash)
VALUES ('Dupe User', 'alice@test.com', '9111111111', 'hash');
-- Expected: ERROR - duplicate key violates unique constraint "uq_users_email"

\echo '--- TEST 3: Duplicate mobile should fail ---'
INSERT INTO users (name, email, mobile, password_hash)
VALUES ('Dupe Mobile', 'new@test.com', '9000000002', 'hash');
-- Expected: ERROR - duplicate key violates unique constraint "uq_users_mobile"

\echo '--- TEST 4: Negative wallet balance should fail ---'
UPDATE wallets SET balance = -100.00 WHERE u_id = 2;
-- Expected: ERROR - violates check constraint "chk_wallet_balance"

\echo '--- TEST 5: Zero or negative rate_per_unit in room should fail ---'
INSERT INTO rooms (hostel_id, created_by, room_no, rate_per_unit)
VALUES (1, 2, '302', -5.00);
-- Expected: ERROR - violates check constraint "chk_rooms_rate"

\echo '--- TEST 6: session end_time before start_time should fail ---'
INSERT INTO sessions (r_id, created_by, start_time, end_time, status)
VALUES (
    1, 2,
    NOW(),
    NOW() - INTERVAL '1 hour',   -- end before start
    'completed'
);
-- Expected: ERROR - violates check constraint "chk_sess_time_order"

\echo '--- TEST 7: Room invitation to yourself should fail ---'
INSERT INTO room_invitations (room_id, sent_by, sent_to)
VALUES (1, 2, 2);   -- Alice inviting herself
-- Expected: ERROR - violates check constraint "chk_ri_no_self"

\echo '--- TEST 8: Duplicate (session_id, u_id) in session_participants should fail ---'
-- First insert a session
INSERT INTO sessions (r_id, created_by, status)
VALUES (1, 2, 'active')
RETURNING session_id;

-- Add Bob to session (u_id = 3)
INSERT INTO session_participants (session_id, u_id, status)
VALUES (1, 3, 'accepted');

-- Try to add Bob again
INSERT INTO session_participants (session_id, u_id, status)
VALUES (1, 3, 'invited');
-- Expected: ERROR - duplicate key violates unique constraint "uq_sp_user_session"

\echo '--- TEST 9: Two active sessions in same room should fail ---'
-- Try to start a second active session in room 1
INSERT INTO sessions (r_id, created_by, status)
VALUES (1, 2, 'active');
-- Expected: ERROR - unique index "uq_sess_one_active_per_room" prevents two active sessions

\echo '--- ALL CONSTRAINT TESTS COMPLETE ---'
\echo 'If you see only ERRORs above (no successful INSERTs), all constraints are working correctly.'

-- Cleanup: remove the test session we inserted in TEST 8
DELETE FROM sessions WHERE r_id = 1 AND created_by = 2;
