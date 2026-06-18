-- =============================================================================
-- FairAC Database Schema
-- File: 001_create_schema.sql
-- Description: Complete PostgreSQL schema for the FairAC application.
--              Creates all tables, constraints, and indexes from scratch.
-- Run: psql -U postgres -d fairac_db -f 001_create_schema.sql
-- =============================================================================


-- =============================================================================
-- TABLE 1: hostels
-- =============================================================================
-- WHY: Every room belongs to a hostel/PG. Admins manage a specific hostel,
--      not all rooms system-wide. This boundary prevents data leakage between
--      different hostels using the same system.
-- NORMALIZATION: 1NF/2NF/3NF — single-topic table, no partial dependencies.
-- =============================================================================
CREATE TABLE hostels (
    hostel_id   BIGSERIAL       PRIMARY KEY,
    name        VARCHAR(150)    NOT NULL,
    address     TEXT            NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hostels IS 'Represents a hostel, PG, or flat managed by one admin.';
COMMENT ON COLUMN hostels.hostel_id IS 'Auto-incremented surrogate primary key.';
COMMENT ON COLUMN hostels.name IS 'Hostel/PG display name, e.g. "ABC Boys Hostel".';
COMMENT ON COLUMN hostels.address IS 'Optional physical address for reference.';


-- =============================================================================
-- TABLE 2: users
-- =============================================================================
-- WHY: A single unified table for all human actors in the system (students AND
--      admins). We differentiate them with a `role` column instead of a
--      separate `admins` table.
--
-- ARCHITECTURAL DECISION: Merging admins into users means:
--   - One login endpoint for everyone.
--   - One JWT payload structure.
--   - One middleware to protect routes (just check role).
--   - Easy to add 'super_admin' role later without new tables.
--
-- `hostel_id` is nullable because a student may not be attached to any hostel
--  directly (they join through a room). An admin MUST have a hostel_id.
--
-- NORMALIZATION: No repeating groups, all columns depend only on the PK.
-- =============================================================================
CREATE TABLE users (
    u_id            BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    mobile          VARCHAR(15)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'student',
    hostel_id       BIGINT          NULL,  -- Admins must have this; students optional
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_users_email   UNIQUE (email),
    CONSTRAINT uq_users_mobile  UNIQUE (mobile),
    CONSTRAINT chk_users_role   CHECK (role IN ('student', 'admin', 'super_admin')),
    CONSTRAINT fk_users_hostel  FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id)
                                ON DELETE SET NULL
);

COMMENT ON TABLE users IS 'All users: students and admins. Role differentiates them.';
COMMENT ON COLUMN users.role IS 'Values: student | admin | super_admin';
COMMENT ON COLUMN users.hostel_id IS 'Admins are bound to one hostel. Students: NULL until in a room.';
COMMENT ON COLUMN users.is_active IS 'Soft delete / suspend flag. False = suspended user.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash of password. Never store plaintext.';

-- Indexes for fast login lookups (login by email OR mobile)
CREATE INDEX idx_users_email    ON users (email);
CREATE INDEX idx_users_mobile   ON users (mobile);
CREATE INDEX idx_users_hostel   ON users (hostel_id);


-- =============================================================================
-- TABLE 3: rooms
-- =============================================================================
-- WHY: A room is the central entity. Sessions happen inside rooms. Roommates
--      share a room. Billing is room-scoped.
--
-- `created_by` tracks who is the room owner (the student who created the room).
--   They have special privileges: can invite, can start sessions.
--
-- `rate_per_unit` stores the electricity cost per kWh for THIS room.
--   Different hostels/states have different electricity tariffs.
--   Storing here allows per-room flexibility (e.g. ₹7/unit in Maharashtra,
--   ₹9/unit in Karnataka).
--
-- `capacity` limits how many students can join a room.
--
-- NORMALIZATION: Room-specific data only. No derived fields.
-- =============================================================================
CREATE TABLE rooms (
    r_id            BIGSERIAL       PRIMARY KEY,
    hostel_id       BIGINT          NOT NULL,
    created_by      BIGINT          NOT NULL,
    room_no         VARCHAR(20)     NOT NULL,
    room_name       VARCHAR(100)    NULL,
    capacity        SMALLINT        NOT NULL DEFAULT 4,
    rate_per_unit   DECIMAL(6,2)    NOT NULL DEFAULT 8.00,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_rooms_hostel      FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id)
                                    ON DELETE CASCADE,
    CONSTRAINT fk_rooms_created_by  FOREIGN KEY (created_by) REFERENCES users (u_id)
                                    ON DELETE RESTRICT,
    CONSTRAINT chk_rooms_capacity   CHECK (capacity BETWEEN 1 AND 20),
    CONSTRAINT chk_rooms_rate       CHECK (rate_per_unit > 0),
    -- Room number must be unique within the same hostel
    CONSTRAINT uq_rooms_no_per_hostel UNIQUE (hostel_id, room_no)
);

COMMENT ON TABLE rooms IS 'A physical room inside a hostel. Hub of all activity.';
COMMENT ON COLUMN rooms.created_by IS 'The student who created this room — the room owner.';
COMMENT ON COLUMN rooms.rate_per_unit IS 'Electricity tariff in ₹ per kWh for billing calculation.';
COMMENT ON COLUMN rooms.capacity IS 'Max number of students allowed in this room.';
-- Room number is unique per hostel: Room 301 can exist in Hostel A and Hostel B, but not twice in A.

CREATE INDEX idx_rooms_hostel ON rooms (hostel_id);


-- =============================================================================
-- TABLE 4: room_members
-- =============================================================================
-- WHY: A many-to-many relationship between users and rooms. One room has many
--      students; one student can theoretically be in many rooms (but we enforce
--      max 1 active room via application logic + partial index).
--
-- `role` distinguishes the room owner from regular members. This is important
--   because only OWNER can invite and manage the room.
--
-- DESIGN DECISION: We don't hard-delete room_members when someone leaves.
--   Instead, we set `left_at` to record departure time. This preserves history
--   for billing and reports. "Current members" = WHERE left_at IS NULL.
--
-- NORMALIZATION: Junction table implementing M:M. All columns depend on PK.
-- =============================================================================
CREATE TABLE room_members (
    rm_id       BIGSERIAL       PRIMARY KEY,
    r_id        BIGINT          NOT NULL,
    u_id        BIGINT          NOT NULL,
    role        VARCHAR(20)     NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ     NULL,  -- NULL = still in room

    -- Constraints
    CONSTRAINT fk_rm_room   FOREIGN KEY (r_id) REFERENCES rooms (r_id) ON DELETE CASCADE,
    CONSTRAINT fk_rm_user   FOREIGN KEY (u_id) REFERENCES users (u_id) ON DELETE CASCADE,
    CONSTRAINT chk_rm_role  CHECK (role IN ('owner', 'member')),
    -- A user can only appear ONCE as an active member per room
    CONSTRAINT uq_rm_active UNIQUE (r_id, u_id)
);

COMMENT ON TABLE room_members IS 'Tracks who is (or was) in a room. left_at = NULL means currently in room.';
COMMENT ON COLUMN room_members.role IS 'owner = room creator with management rights; member = regular roommate';
COMMENT ON COLUMN room_members.left_at IS 'When the student left the room. NULL = still active member.';

-- Performance: Finding active members of a room is the most frequent query
CREATE INDEX idx_rm_room         ON room_members (r_id);
CREATE INDEX idx_rm_user         ON room_members (u_id);
-- Partial index: quickly find active memberships (left_at IS NULL)
CREATE INDEX idx_rm_active       ON room_members (u_id) WHERE left_at IS NULL;


-- =============================================================================
-- TABLE 5: room_invitations
-- =============================================================================
-- WHY: Before a student can join a room, the room owner must invite them and
--      the invitee must accept. This creates a controlled entry workflow.
--
-- `sent_by` = room owner (inviter).
-- `sent_to` = student being invited.
-- `expires_at` = prevents stale invitations clogging the system.
--
-- WHY SEPARATE TABLE: An invitation has its own lifecycle (pending → accepted/
--   rejected). It's not the same as membership. Keeping it separate avoids
--   nullable columns on room_members.
--
-- NORMALIZATION: Each invitation is a distinct event. No repeating groups.
-- =============================================================================
CREATE TABLE room_invitations (
    invitation_id   BIGSERIAL       PRIMARY KEY,
    room_id         BIGINT          NOT NULL,
    sent_by         BIGINT          NOT NULL,
    sent_to         BIGINT          NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NULL,   -- Optional expiry (e.g. 48 hours)
    responded_at    TIMESTAMPTZ     NULL,   -- When accepted/rejected

    -- Constraints
    CONSTRAINT fk_ri_room       FOREIGN KEY (room_id)   REFERENCES rooms (r_id) ON DELETE CASCADE,
    CONSTRAINT fk_ri_sent_by    FOREIGN KEY (sent_by)   REFERENCES users (u_id) ON DELETE CASCADE,
    CONSTRAINT fk_ri_sent_to    FOREIGN KEY (sent_to)   REFERENCES users (u_id) ON DELETE CASCADE,
    CONSTRAINT chk_ri_status    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    -- Can't invite yourself
    CONSTRAINT chk_ri_no_self   CHECK (sent_by <> sent_to),
    -- Only one active (pending) invitation per user per room at a time
    CONSTRAINT uq_ri_pending    UNIQUE (room_id, sent_to)
);

COMMENT ON TABLE room_invitations IS 'Tracks room join invitations. One pending invite per user per room.';
COMMENT ON COLUMN room_invitations.expires_at IS 'Invitation auto-expires if not acted upon. NULL = no expiry.';

CREATE INDEX idx_ri_sent_to     ON room_invitations (sent_to);
CREATE INDEX idx_ri_room        ON room_invitations (room_id);
CREATE INDEX idx_ri_status      ON room_invitations (status);


-- =============================================================================
-- TABLE 6: sessions
-- =============================================================================
-- WHY: A session represents one "AC run" event. It has a start, an end, and
--      tracks who was present. Sessions are the heart of FairAC.
--
-- `session_type`: Unlimited / duration / unit / budget — controls when the
--   session auto-ends (in future with IoT hardware). For MVP, admin ends it
--   manually.
--
-- `target_value`: The numeric limit for duration/unit/budget type sessions.
--   NULL for unlimited sessions.
--
-- `total_units`: How many kWh were consumed during this session. In MVP this
--   is entered manually when ending the session. In future, read from device.
--
-- `rate_per_unit`: Snapshot of the room's electricity rate at time of session.
--   IMPORTANT: We copy it here so that even if the room rate changes later,
--   past billing calculations remain correct (immutable billing records).
--
-- `status` lifecycle: pending → active → completed | cancelled
--
-- NORMALIZATION: Session-specific data only. rate_per_unit is intentionally
--   denormalized here (snapshot) for billing integrity.
-- =============================================================================
CREATE TABLE sessions (
    session_id      BIGSERIAL       PRIMARY KEY,
    r_id            BIGINT          NOT NULL,
    created_by      BIGINT          NOT NULL,
    session_type    VARCHAR(20)     NOT NULL DEFAULT 'unlimited',
    target_value    DECIMAL(10,2)   NULL,   -- e.g. 2.5 hours, 5 kWh, ₹100
    total_units     DECIMAL(10,3)   NULL,   -- kWh used (entered on session end)
    rate_per_unit   DECIMAL(6,2)    NOT NULL DEFAULT 8.00,  -- ₹/kWh snapshot
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
    start_time      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    end_time        TIMESTAMPTZ     NULL,   -- NULL while session is active

    -- Constraints
    CONSTRAINT fk_sess_room         FOREIGN KEY (r_id)       REFERENCES rooms (r_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sess_created_by   FOREIGN KEY (created_by) REFERENCES users (u_id) ON DELETE RESTRICT,
    CONSTRAINT chk_sess_type        CHECK (session_type IN ('unlimited', 'duration', 'unit', 'budget')),
    CONSTRAINT chk_sess_status      CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    CONSTRAINT chk_sess_units       CHECK (total_units IS NULL OR total_units >= 0),
    CONSTRAINT chk_sess_rate        CHECK (rate_per_unit > 0),
    -- End time must be after start time (when set)
    CONSTRAINT chk_sess_time_order  CHECK (end_time IS NULL OR end_time > start_time)
);

COMMENT ON TABLE sessions IS 'One AC run = one session. Contains billing metadata.';
COMMENT ON COLUMN sessions.total_units IS 'kWh consumed. Entered manually in MVP, from IoT device in future.';
COMMENT ON COLUMN sessions.rate_per_unit IS 'Snapshot of rate at session creation. Immutable for billing integrity.';
COMMENT ON COLUMN sessions.target_value IS 'Limit value for duration/unit/budget session types.';

CREATE INDEX idx_sess_room      ON sessions (r_id);
CREATE INDEX idx_sess_status    ON sessions (status);
CREATE INDEX idx_sess_creator   ON sessions (created_by);
-- Enforce: only ONE active session per room at a time
CREATE UNIQUE INDEX uq_sess_one_active_per_room
    ON sessions (r_id)
    WHERE status IN ('pending', 'active');


-- =============================================================================
-- TABLE 7: session_participants
-- =============================================================================
-- WHY: Tracks exactly who participated in a session and for how long.
--      This is the critical table for the billing engine.
--
-- BILLING ENGINE uses:
--   joined_at → left_at = duration this person was present
--   SUM of all durations = total person-time
--   Each person's share = their duration / total duration
--
-- `status` lifecycle:
--   invited  → Person was invited but hasn't responded yet
--   accepted → Joined the session (AC running for them)
--   rejected → Refused to join (not charged)
--   left     → Was in session, then manually left
--
-- WHY left_at CAN BE NULL: A person in the session when it ends
--   will have left_at = NULL. The billing engine uses session.end_time
--   as their effective left_at.
--
-- NORMALIZATION: All columns depend entirely on sp_id (the PK).
-- =============================================================================
CREATE TABLE session_participants (
    sp_id       BIGSERIAL       PRIMARY KEY,
    session_id  BIGINT          NOT NULL,
    u_id        BIGINT          NOT NULL,
    status      VARCHAR(20)     NOT NULL DEFAULT 'invited',
    joined_at   TIMESTAMPTZ     NULL,   -- Set when status → accepted
    left_at     TIMESTAMPTZ     NULL,   -- NULL = still in session

    -- Constraints
    CONSTRAINT fk_sp_session    FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_user       FOREIGN KEY (u_id)       REFERENCES users (u_id)          ON DELETE CASCADE,
    CONSTRAINT chk_sp_status    CHECK (status IN ('invited', 'accepted', 'rejected', 'left')),
    -- A user can only appear once per session
    CONSTRAINT uq_sp_user_session UNIQUE (session_id, u_id),
    -- left_at must be after joined_at (when both are set)
    CONSTRAINT chk_sp_time_order CHECK (left_at IS NULL OR joined_at IS NULL OR left_at > joined_at)
);

COMMENT ON TABLE session_participants IS 'Per-person participation log. Drives billing calculation.';
COMMENT ON COLUMN session_participants.joined_at IS 'When they accepted/joined. NULL if still invited or rejected.';
COMMENT ON COLUMN session_participants.left_at IS 'When they left. NULL if still in session.';

CREATE INDEX idx_sp_session ON session_participants (session_id);
CREATE INDEX idx_sp_user    ON session_participants (u_id);
CREATE INDEX idx_sp_status  ON session_participants (status);


-- =============================================================================
-- TABLE 8: wallets
-- =============================================================================
-- WHY: Each student has exactly one wallet. Admins recharge it. Consumption
--      deducts from it. The wallet balance is the source of truth for a
--      student's available AC credit.
--
-- WHY NOT store balance as INTEGER: Money must be DECIMAL to avoid floating-
--   point precision errors in calculations (e.g. ₹0.33 per kWh share).
--   DECIMAL(10,2) = up to ₹99,999,999.99 with 2 decimal places.
--
-- DESIGN NOTE: The balance here is a derived value — it should always equal
--   SUM(credits) - SUM(debits) from wallet_transactions. We store it for
--   performance (no need to sum all transactions on every dashboard load).
--   Keep them in sync via application logic (always update both atomically).
--
-- NORMALIZATION: 1:1 with users. Balance is stored here (not on users table)
--   to follow Single Responsibility Principle.
-- =============================================================================
CREATE TABLE wallets (
    wallet_id       BIGSERIAL       PRIMARY KEY,
    u_id            BIGINT          NOT NULL,
    balance         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    total_recharged DECIMAL(10,2)   NOT NULL DEFAULT 0.00,  -- Lifetime recharge total
    total_spent     DECIMAL(10,2)   NOT NULL DEFAULT 0.00,  -- Lifetime consumption total
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_wallet_user   FOREIGN KEY (u_id) REFERENCES users (u_id) ON DELETE CASCADE,
    CONSTRAINT uq_wallet_user   UNIQUE (u_id),  -- Enforce 1:1
    CONSTRAINT chk_wallet_balance CHECK (balance >= 0)  -- Cannot go negative (prevent overdraft)
);

COMMENT ON TABLE wallets IS '1:1 with users. Tracks prepaid AC balance. Must stay non-negative.';
COMMENT ON COLUMN wallets.balance IS 'Current available balance. Kept in sync with transaction sum.';
COMMENT ON COLUMN wallets.total_recharged IS 'Lifetime total recharged by admin. Useful for reports.';
COMMENT ON COLUMN wallets.total_spent IS 'Lifetime total consumed. Useful for reports.';


-- =============================================================================
-- TABLE 9: wallet_transactions
-- =============================================================================
-- WHY: Every single credit and debit on a wallet is stored as an immutable
--      ledger record. This is the audit trail. Never delete, never update.
--      Only append.
--
-- `type` values:
--   recharge    = Admin added money (+)
--   consumption = Session billing deducted money (-)
--   adjustment  = Admin manual correction (+/-)
--   refund      = Session cancelled, money returned (+)
--
-- `amount` is ALWAYS positive. The `type` tells you if it's credit or debit.
--   (Simpler than using negative amounts for debits.)
--
-- `session_id` links the transaction to the session that caused it.
--   NULL for recharge/adjustment transactions.
--
-- NORMALIZATION: Every column depends entirely on txn_id. session_id is an
--   FK for referential integrity (not normalization violation — it's a fact
--   about this specific transaction).
-- =============================================================================
CREATE TABLE wallet_transactions (
    txn_id          BIGSERIAL       PRIMARY KEY,
    wallet_id       BIGINT          NOT NULL,
    session_id      BIGINT          NULL,    -- NULL for recharge/adjustment
    amount          DECIMAL(10,2)   NOT NULL,
    type            VARCHAR(20)     NOT NULL,
    description     TEXT            NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_txn_wallet    FOREIGN KEY (wallet_id)  REFERENCES wallets (wallet_id) ON DELETE CASCADE,
    CONSTRAINT fk_txn_session   FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE SET NULL,
    CONSTRAINT chk_txn_type     CHECK (type IN ('recharge', 'consumption', 'adjustment', 'refund')),
    CONSTRAINT chk_txn_amount   CHECK (amount > 0)  -- Amount is always positive
);

COMMENT ON TABLE wallet_transactions IS 'Immutable ledger of all wallet credits and debits. Never update/delete rows.';
COMMENT ON COLUMN wallet_transactions.amount IS 'Always positive. Use type field to know if credit or debit.';
COMMENT ON COLUMN wallet_transactions.session_id IS 'Set for consumption transactions. NULL for recharge/adjustment.';

CREATE INDEX idx_txn_wallet     ON wallet_transactions (wallet_id);
CREATE INDEX idx_txn_session    ON wallet_transactions (session_id);
CREATE INDEX idx_txn_type       ON wallet_transactions (type);
CREATE INDEX idx_txn_created    ON wallet_transactions (created_at DESC);


-- =============================================================================
-- TABLE 10: consumption_records
-- =============================================================================
-- WHY: After a session ends, the billing engine calculates each participant's
--      share and stores it here. This is the final billing record per
--      user per session.
--
-- This table is written ONCE per (session, user) pair when the session ends.
-- It is never updated after that.
--
-- WHY SEPARATE FROM wallet_transactions:
--   wallet_transactions = financial ledger (how much money moved)
--   consumption_records = physical usage ledger (how many kWh were used)
--   Keeping them separate allows energy auditing independently from billing.
--
-- NORMALIZATION: Records a specific billing event. All columns are facts about
--   this one (session, user) billing outcome.
-- =============================================================================
CREATE TABLE consumption_records (
    record_id       BIGSERIAL       PRIMARY KEY,
    session_id      BIGINT          NOT NULL,
    u_id            BIGINT          NOT NULL,
    units_consumed  DECIMAL(10,3)   NOT NULL,  -- kWh with 3 decimal precision
    cost            DECIMAL(10,2)   NOT NULL,
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_cr_session    FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_user       FOREIGN KEY (u_id)       REFERENCES users (u_id)          ON DELETE CASCADE,
    CONSTRAINT uq_cr_session_user UNIQUE (session_id, u_id),  -- One record per person per session
    CONSTRAINT chk_cr_units     CHECK (units_consumed >= 0),
    CONSTRAINT chk_cr_cost      CHECK (cost >= 0)
);

COMMENT ON TABLE consumption_records IS 'Final per-person billing outcome for each session. Written once, never updated.';
COMMENT ON COLUMN consumption_records.units_consumed IS 'kWh allocated to this user for this session.';
COMMENT ON COLUMN consumption_records.cost IS 'Cost in ₹ allocated to this user for this session.';

CREATE INDEX idx_cr_session ON consumption_records (session_id);
CREATE INDEX idx_cr_user    ON consumption_records (u_id);
CREATE INDEX idx_cr_date    ON consumption_records (recorded_at DESC);
