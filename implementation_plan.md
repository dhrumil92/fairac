# FairAC — Full-Stack Architecture Review & Implementation Plan

> **Senior Full-Stack Architect Analysis**
> Read all 5 documents: Requirements, User Flow, ER Diagram, Database Design (original + improved), API Design.

---

## 1. What the Project Does (Plain English)

FairAC tracks AC electricity usage inside a hostel/PG room. Multiple roommates share one AC. Instead of splitting the electricity bill equally at the end of the month, FairAC tracks exactly **who was present during each "session"** (AC run-period) and bills each person only for the time they were actually there.

---

## 2. Document Cross-Check Results

### ✅ What is consistent across all documents
| Concern | Status |
|---|---|
| Core entities: users, rooms, sessions, wallets | Consistent |
| Billing based on participation time | Consistent |
| Admin can recharge wallets | Consistent |
| Session types: Unlimited / Duration / Unit / Budget | Consistent in Requirements, missing from DB |
| Session states: Pending / Active / Completed / Cancelled | Consistent |
| Participant join/leave tracking | Consistent |

### ⚠️ Inconsistencies & Gaps Found

#### A. Original DB Design vs Improved DB Design (the two Excel files)
The original `database design.xlsx` has several errors fixed in `FairAC_Improved_Database_Design.xlsx`. Both files were compared:

| Issue | Original | Improved |
|---|---|---|
| `mobile` type | `integer(10)` ❌ | `VARCHAR(15)` ✅ |
| `balance` / `cost` / `amount` type | `integer` ❌ | `DECIMAL(10,2)` ✅ |
| `units_consumed` type | `integer` ❌ | `DECIMAL(10,3)` ✅ |
| `session_id` type typo | `intiger` ❌ | `BIGINT` ✅ |
| `left_at` constraint | `NOT NULL` ❌ | `NULL` ✅ (can't be not null—session may be ongoing) |
| `end_time` | `NOT NULL` ❌ | `NULL` ✅ (ongoing session has no end_time) |
| `u_id` PK type | `integer` ❌ | `BIGSERIAL` ✅ (auto-increment) |
| `session_type` / `target_value` | Missing ❌ | Present ✅ |

> **Decision**: Use the **Improved DB Design** as the base. Discard the original.

---

## 3. Design Flaws & Missing Pieces Found

### 🔴 Critical Issues

#### Issue 1: No `hostel_id` / `hostel` Table
**Problem:** The requirements mention "hostel rector/PG owner" as the Admin, but there is NO `hostels` table and NO link between a `room` and a `hostel`, and NO link between an `admin` and the rooms/hostel they manage.

Right now, one admin can accidentally see or recharge wallets for students in a completely different hostel.

**Fix:** Add a `hostels` table. Link `rooms` to a hostel. Link `admins` to a hostel.

```
hostels (hostel_id PK, name, address, created_at)
rooms.hostel_id FK → hostels.hostel_id
admins.hostel_id FK → hostels.hostel_id
```

#### Issue 2: No `role` in `room_members` (Who is the Room Owner?)
**Problem:** Requirements say a student who creates a room becomes the "room owner" and can invite roommates. But `room_members` has no `role` field to distinguish owner from regular member.

Without this, the backend has no way to enforce: "only room owner can invite."

**Fix:** Add `role VARCHAR(20)` to `room_members`. Values: `OWNER` / `MEMBER`.

Alternatively, add `created_by FK → users.u_id` to the `rooms` table (simpler).

> **Recommended:** Add `created_by BIGINT FK → users.u_id` to `rooms` table. Clean and simple.

#### Issue 3: `wallet_transactions` missing a link to `session_id`
**Problem:** When a wallet deduction happens, we can see the `description` text (e.g. "Session 101"), but there is no actual FK to `sessions.session_id`. This makes it impossible to reliably generate session-level billing reports.

**Fix:** Add `session_id BIGINT NULL FK → sessions.session_id` to `wallet_transactions`.

#### Issue 4: No `rate_per_unit` — Where is the electricity cost stored?
**Problem:** The billing engine must calculate cost from `units_consumed`. But nowhere in the database is the electricity **rate per kWh (₹/unit)** stored. Right now you'd have to hardcode it in the application.

**Fix:** Add a `settings` table or store `rate_per_unit` in the `rooms` or `hostels` table.

> **Recommended:** Add `rate_per_unit DECIMAL(6,2)` to the `rooms` table (each room/hostel may have a different rate). Default: `8.00` (₹8/unit is common in India).

#### Issue 5: `admins` table is completely separate from `users` — Dual system problem
**Problem:** Admins and Students are in two completely separate tables. This means:
- Login endpoint must check **two** tables.
- If an admin wants to also be a student (possible in flat sharing), they need two accounts.
- It's harder to manage sessions, JWTs, and middleware.

**Fix (Recommended for MVP):** Add a `role` column to the `users` table. Values: `student` / `admin`. Drop the separate `admins` table.

**Why this is better:**
- Single login endpoint.
- One JWT middleware.
- One table to query.
- Admin is just a user with elevated role.
- Easy to add Super Admin later by adding `super_admin` as a role value.

> **⚠️ This is a significant architectural change. Please approve before I implement it.**

### 🟡 Medium Issues

#### Issue 6: `session_participants` — No `PENDING` / `INVITED` status
**Problem:** Requirements say: "Session creator selects roommates → Notification sent → Participants Accept/Reject." But `session_participants.status` only has `ACTIVE/LEFT`. There's no `INVITED`, `REJECTED`, or `PENDING` state.

**Fix:** Add status values: `INVITED`, `ACCEPTED` (= ACTIVE), `REJECTED`, `LEFT`.

#### Issue 7: `room_invitations` has no expiry
**Problem:** A pending room invitation could stay forever. If a student never responds, the invitation sits in the database permanently.

**Fix:** Add `expires_at TIMESTAMP NULL` to `room_invitations`. A background job or application logic can expire old invitations.

#### Issue 8: `consumption_records` — Per-session-per-user or per-session?
**Problem:** The current design has one record per `(session_id, u_id)`. This is correct for final billing. But the billing calculation needs intermediate data: **how long was each participant in the session?**

This data exists in `session_participants` (via `joined_at` and `left_at`). The billing engine will use both tables to compute cost. This is fine — just needs clear documentation.

#### Issue 9: No `total_units` / `rate_per_unit` stored on the `sessions` table
**Problem:** When a session ends, the total units consumed by the AC are entered manually (MVP). But where does this total go? Currently, it's only implied through `consumption_records`, but no single "source of truth" for total session units exists.

**Fix:** Add `total_units DECIMAL(10,3) NULL` and `rate_per_unit DECIMAL(6,2) NULL` to `sessions`. This captures the total energy used in the session before splitting.

### 🟢 Minor Issues

#### Issue 10: API Design — Missing endpoints
| Missing API | Reason Needed |
|---|---|
| `GET /rooms/my` — get my current room | Dashboard needs to show user's room |
| `PATCH /rooms/:id/leave` — leave a room | Mentioned in requirements, missing in API |
| `POST /sessions/join` — join a running session | Mentioned in requirements, missing in API |
| `GET /sessions/my` — my session history | Student dashboard needs this |
| `GET /wallet/balance` (already `GET /wallet` — good) | ✅ |
| `POST /admin/login` — admin login | Needs separate or shared login endpoint |
| `GET /admin/sessions/:id` — specific session details | Needed for admin monitoring |

#### Issue 11: API Design — `GET /rooms` is ambiguous
Does `GET /rooms` return ALL rooms or just the rooms I belong to? This needs clarification. For students, it should be `GET /rooms/my`. For admins, `GET /admin/rooms` already exists.

#### Issue 12: `admins` table missing `created_at`
Minor. Add `created_at TIMESTAMP DEFAULT NOW()` to `admins` for audit purposes.

---

## 4. Revised Entity List (After Fixes)

```
hostels          ← NEW
users            ← MODIFIED (add role, remove separate admins table)
rooms            ← MODIFIED (add hostel_id, created_by, rate_per_unit)
room_members     ← MODIFIED (add role: OWNER/MEMBER)
room_invitations ← MODIFIED (add expires_at)
sessions         ← MODIFIED (add session_type, target_value, total_units, rate_per_unit)
session_participants ← MODIFIED (status: INVITED/ACCEPTED/REJECTED/LEFT)
wallets          ← UNCHANGED
wallet_transactions ← MODIFIED (add session_id FK)
consumption_records ← UNCHANGED
```

---

## 5. Revised Relationships Map

```
hostels ──< rooms         (1 hostel has many rooms)
rooms ──< room_members    (1 room has many members)
users ──< room_members    (1 user can be in many rooms, but MVP: 1 room)
rooms ──< room_invitations
users ──< room_invitations (sent_by, sent_to)
rooms ──< sessions
users ──< sessions (created_by)
sessions ──< session_participants
users ──< session_participants
sessions ──< consumption_records
users ──< consumption_records
users ── wallets (1:1)
wallets ──< wallet_transactions
sessions ──< wallet_transactions (optional, for traceability)
```

---

## 6. Proposed Revised API List

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Student registration |
| POST | `/auth/login` | Unified login (student + admin via role) |

### Rooms
| Method | Endpoint | Description |
|---|---|---|
| POST | `/rooms` | Create room |
| GET | `/rooms/my` | Get my current room |
| GET | `/rooms/:id` | Get room by ID |
| DELETE | `/rooms/:id` | Delete room (admin/owner only) |
| PATCH | `/rooms/:id/leave` | Leave room |

### Room Invitations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/rooms/invite` | Send invitation |
| POST | `/rooms/invite/accept` | Accept invitation |
| POST | `/rooms/invite/reject` | Reject invitation |
| GET | `/rooms/invitations` | Get my pending invitations |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/start` | Start a session |
| POST | `/sessions/:id/end` | End a session |
| POST | `/sessions/:id/join` | Join a running session |
| GET | `/sessions/:id` | Get session details |
| GET | `/sessions/active` | Get active session in my room |
| GET | `/sessions/my` | My session history |

### Session Participants
| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/participants/invite` | Invite participants |
| POST | `/sessions/participants/accept` | Accept session invite |
| POST | `/sessions/participants/reject` | Reject session invite |
| POST | `/sessions/participants/leave` | Leave session |
| GET | `/sessions/:id/participants` | Get participants |

### Wallet
| Method | Endpoint | Description |
|---|---|---|
| GET | `/wallet` | Get wallet + balance |
| GET | `/wallet/transactions` | Get transaction history |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/recharge` | Recharge student wallet |
| POST | `/admin/deduct` | Deduct from wallet |
| GET | `/admin/students` | List all students |
| GET | `/admin/rooms` | List all rooms |
| GET | `/admin/sessions/active` | View active sessions |
| GET | `/admin/reports` | Generate reports |

---

## 7. Billing Engine Design (Core Logic)

This is the most important part of FairAC. Here's how the billing works:

```
Total kWh used in session = total_units (entered manually in MVP)
Total cost = total_units × rate_per_unit

For each participant:
  time_present = left_at (or session.end_time) - joined_at
  total_active_person_time = SUM of time_present for all participants

  share_ratio = time_present / total_active_person_time
  individual_cost = total_cost × share_ratio
  individual_units = total_units × share_ratio
```

**Example:**
- Session: 4 hours, 10 kWh, ₹8/unit → total cost = ₹80
- A was present full 4 hours (240 min)
- B joined at 2 hours, stayed 2 hours (120 min)
- Total person-minutes = 360
- A's share = 240/360 = 66.7% → ₹53.33, 6.67 kWh
- B's share = 120/360 = 33.3% → ₹26.67, 3.33 kWh

---

## 8. Implementation Phases (Approved Plan)

### Phase 1: Database Setup ← STARTING HERE
- Install PostgreSQL
- Create database `fairac_db`
- Create all 10 tables with constraints
- Set up indexes

### Phase 2: Backend Project Setup
- Node.js + Express.js project scaffold
- Folder structure
- Environment config (.env)
- Database connection (pg pool)

### Phase 3: Authentication Module
- Register (student)
- Login (unified, role-based)
- JWT middleware
- Admin seeding

### Phase 4: Room Management
- Create room
- Invite roommate
- Accept/Reject invitation
- Leave room

### Phase 5: Session Management
- Start session
- Invite participants
- Accept/Reject session invite
- Join running session
- Leave session
- End session + billing calculation

### Phase 6: Wallet Module
- View wallet
- View transaction history
- Admin recharge

### Phase 7: Admin Dashboard APIs
- Overview stats
- Student management
- Room management
- Session monitoring
- Reports

### Phase 8: Frontend (React)
- Auth pages
- Dashboard
- Room management
- Session management
- Wallet

---

## Open Questions (Need Your Approval)

> [!IMPORTANT]
> **Q1 — Merge admins into users table?**
> I strongly recommend adding a `role` field to `users` and removing the separate `admins` table. This simplifies login, JWT, and middleware significantly. **Do you approve this change?**

> [!IMPORTANT]
> **Q2 — Add `hostels` table?**
> Without a hostel entity, an admin has no boundary — they could see all rooms system-wide. For MVP, should we add a simple `hostels` table, or skip it and assume one hostel per deployment? **Your call.**

> [!WARNING]
> **Q3 — Can a student be in multiple rooms simultaneously?**
> The current design allows it (no restriction). Requirements don't mention this. For a hostel, a student should only be in ONE room at a time. Should I add a constraint for this?

> [!NOTE]
> **Q4 — Rate per unit (₹/kWh): Where to store it?**
> Options:
> - In the `rooms` table (each room has its own rate)
> - In a global `settings` table (one rate for the whole hostel)
> - In the `sessions` table (entered fresh each time)
> Which do you prefer?

