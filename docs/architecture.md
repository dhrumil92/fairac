# FairAC — Complete System Architecture

> **Version 1.0 (Current Production Build)**
> Last Updated: July 2026

This document is the single source of truth for the entire FairAC system architecture. It covers every layer — hardware, firmware, mobile app, backend API, database, and admin frontend — including every data flow, billing rule, and design decision made during development.

---

## 1. System Overview

FairAC is an **Offline-First IoT billing system** for shared AC units in hostels/PGs. It ensures fair, proportional electricity billing among roommates who share a single AC unit.

```
┌─────────────────────────────────────────────────────────────┐
│                     FAIRAC ECOSYSTEM                        │
├─────────────────┬───────────────┬──────────────┬───────────┤
│  ESP32 Hardware │  Mobile App   │   Backend    │  Admin    │
│  (Edge Layer)   │  (React Native│   (Node.js / │ Frontend  │
│                 │  / Expo)      │  PostgreSQL)  │  (React)  │
└────────┬────────┴──────┬────────┴──────┬───────┴─────┬─────┘
         │               │  BLE           │ HTTPS/REST  │
         └───────────────┘                └─────────────┘
```

### 1.1 The Core Problem Solved
Traditional hostel AC billing is binary: the whole room's bill is split equally at month end, regardless of who used it, for how long, or how much. FairAC solves this by tracking:
- **Who** started the AC
- **Who** joined the session (and when)
- **Who** left early (and when)
- **How much energy (kWh)** was actually consumed
- And then splitting the bill **proportionally by participation time**

---

## 2. Hardware Layer — ESP32 + PZEM-004T

### 2.1 Components
| Component | Purpose |
|---|---|
| **ESP32 (30-pin Type-C)** | Main microcontroller, BLE communication, logic |
| **PZEM-004T** | Non-invasive AC power meter (Voltage, Current, Power, kWh) |
| **Solid State Relay (5V)** | Switches the high-voltage AC power circuit |
| **LCD Display (16x2 I2C)** | Shows live power, session kWh, remaining time |
| **LED (Yellow)** | Session Active indicator |
| **LED (Green)** | Power / Boot indicator |
| **LED (Red)** | Fault / FINISHED state indicator |
| **LED (Blue, on-board)** | BLE connection state (blink = searching, solid = connected) |
| **Buzzer** | Audio alerts on session start, stop, fault |
| **Emergency Stop Button (GPIO 39)** | Physical hardware kill switch |

### 2.2 Pin Mapping
```
GPIO 13 → Buzzer
GPIO 15 → Relay (HIGH=OFF, LOW=ON — Active Low)
GPIO 26 → LED Red
GPIO 25 → LED Yellow
GPIO 33 → LED Green
GPIO 32 → PZEM TX
GPIO 35 → PZEM RX (input only)
GPIO 39 → E-Stop Button (input only)
GPIO  2 → On-board Blue LED (BLE status)
SDA 14 / SCL 27 → I2C LCD
```

### 2.3 State Machine
```
BOOTING ──→ STANDBY ──→ SESSION_ACTIVE ──→ FINISHED
                  ↑                │              │
                  │   (SYNC_ACK)   │              │
                  └────────────────┘              │
                                                  │
FAULT (from SESSION_ACTIVE via E-Stop or AUTO_OFF)│
  └────────────────────────────────────────────────
```

### 2.4 BLE UUIDs
```
Service UUID:        4fafc201-1fb5-459e-8fcc-c5c9c331914b
RX Characteristic:   beb5483e-36e1-4688-b7f5-ea07361b26a8  (Phone → ESP32)
TX Characteristic:   8b368725-7b58-45e3-979f-6893e414c5b3  (ESP32 → Phone)
```

### 2.5 Firmware Logic — `iot/esp32_ble/esp32_ble.ino`

#### Session Lifecycle on the Hardware
1. **STANDBY:** Relay is OFF. BLE is advertising. Waiting for phone connection.
2. **START Command Received:** Phone sends:
   ```json
   { "cmd": "START", "max_kwh": 2.0, "max_duration_sec": 3600, "session_id": 84 }
   ```
   ESP32 immediately turns relay ON, starts kWh accumulator and countdown timer. Saves all state to NVS flash.
3. **SESSION_ACTIVE:** Every **5 seconds**, PZEM is polled. Energy is accumulated as:
   ```cpp
   consumed_kwh += (power_watts / 1000.0) * (5.0 / 3600.0);
   ```
4. **Auto-Stop Triggers (work even with phone disconnected):**
   - **Duration Limit:** `remaining_duration_sec` counts down 1 tick/second. At 0 → `finishSession("DURATION_LIMIT")`.
   - **kWh Limit:** If `session_kwh >= max_kwh_limit` → `finishSession("KWH_LIMIT")`.
   - **Low Power Auto-Off:** If power < 20W for 3 consecutive minutes (AC turned off via physical remote) → `finishSession("AUTO_OFF")`.
   - **E-Stop Button:** Physical press of GPIO 39 → `finishSession("ESTOP")`.
5. **FINISHED State:** Relay turns OFF. Final kWh saved to NVS. Red LED turns ON. ESP32 waits for phone.
6. **BLE Telemetry (sent every 5s when phone is connected):**
   ```json
   {
     "power": 1450.2,
     "units_consumed": 0.832,
     "voltage": 231.5,
     "current": 6.27,
     "remain_sec": 2834,
     "max_kwh": 2.0,
     "status": "ACTIVE"
   }
   ```
   When session ends: `"status": "FINISHED"` triggers automatic sync in the mobile app.
7. **SYNC_ACK Received:** Once mobile app confirms the backend accepted the data, ESP32 clears NVS flash and returns to STANDBY.

#### Power-Cut / Crash Recovery
Critical state is saved to NVS every 60 seconds:
| NVS Key | Type | Description |
|---|---|---|
| `is_active` | bool | Session is running |
| `is_finished` | bool | Session ended, waiting for sync |
| `session_id` | long | Active session ID |
| `session_kwh` | float | kWh consumed this session |
| `total_kwh` | float | Lifetime total kWh |
| `max_kwh` | float | Session kWh limit |
| `remain_dur` | long | Remaining duration in seconds |

On boot: `is_finished=true` → go to FINISHED (await sync). `is_active=true` → silently resume session (don't reset kWh).

---

## 3. Mobile App Layer — React Native (Expo)

### 3.1 Tech Stack
- **Framework:** React Native (via Expo)
- **Language:** JavaScript
- **BLE:** `react-native-ble-plx` or Expo BLE library
- **Push Notifications:** `expo-notifications` (Expo Push Service)
- **API:** Axios with JWT auth headers
- **State:** React Context API (`AuthContext`)
- **Navigation:** React Navigation (Stack + Bottom Tab)

### 3.2 Screens
| Screen | Purpose |
|---|---|
| **LoginScreen / RegisterScreen** | Authentication |
| **DashboardScreen** | Overview: wallet balance, room info, active session widget |
| **RoomScreen** | Create/join room, invite roommates, manage members, leave room |
| **SessionScreen** | **Main control hub** — connect BLE, book AC, start/stop, live readings |
| **WalletScreen** | Balance, recharge history, consumption history |
| **ProfileScreen** | User details, change password |

### 3.3 Complete Session Flow (BLE)

```
Student              Mobile App           ESP32              Backend
   │                     │                  │                   │
   ├── Tap "Book AC" ───→│                  │                   │
   │                     │── POST /sessions/book ──────────────→│
   │                     │                  │     Pre-auth,      │
   │                     │←── {session_id, max_kwh, max_dur} ───│
   │                     │                  │                   │
   │                     │── BLE: START ───→│                   │
   │                     │                  │ Relay ON           │
   │                     │←─ Telemetry/5s ──│                   │
   │                     │                  │                   │
   │    [Student disconnects BLE — AC keeps running autonomously]│
   │                     │                  │ Auto-stop on limit │
   │                     │                  │ NVS saves final kWh│
   │    [Next day — student reconnects]      │                   │
   │                     │←─ status:FINISHED│                   │
   │                     │── POST /sessions/sync ──────────────→│
   │                     │   {session_id, total_units}           │
   │                     │                  │   Bills calculated │
   │                     │←── billing data ──────────────────────│
   │                     │── BLE: SYNC_ACK ─→│                  │
   │                     │                  │ Clear NVS → STANDBY│
```

### 3.4 BLE Commands (Phone → ESP32)
| Command | Payload | Effect |
|---|---|---|
| `START` | `{ max_kwh, max_duration_sec, session_id }` | Turns relay ON, starts session |
| `STOP` | _(none)_ | Finishes session, turns relay OFF |
| `SYNC_ACK` | _(none)_ | Clears NVS, returns to STANDBY |

### 3.5 Push Notification Architecture
- **Expo Push Token** registered with backend on login (`POST /auth/push-token`).
- Backend uses `expo-server-sdk` to send notifications.
- **Actionable Notification Categories:**

| Category | Action Buttons | When Sent |
|---|---|---|
| `SESSION_INVITE` | ✅ Accept, ❌ Reject | Roommate invites you to share AC session |
| `LEAVE_REQUEST` | ✅ Approve, ❌ Reject | Roommate requests to leave session early |
| `ROOM_INVITE` | ✅ Accept, ❌ Decline | Room owner invites you to join their room |

- **Auto-dismiss:** After any button is tapped, `Notifications.dismissNotificationAsync()` is called to immediately remove it from the phone's notification tray.
- **Response handler:** `usePushNotifications.js` handles all notification responses and calls the corresponding backend API endpoints.

### 3.6 BLE Auto-Sync Hook
The `SessionScreen.js` monitors the `telemetryData.status` field in real-time. The moment the ESP32 reports `status: "FINISHED"`, the app automatically calls `POST /sessions/sync` without any user interaction needed. This handles the case where the student is connected when the timer runs out.

---

## 4. Backend Layer — Node.js / Express

### 4.1 Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** Raw `pg` (PostgreSQL driver, no ORM)
- **Authentication:** JWT (`jsonwebtoken`) + Password hashing (`bcryptjs`)
- **Push:** `expo-server-sdk`
- **Validation:** `express-validator`
- **Architecture:** `routes → controller → service` (3-layer)

### 4.2 Module Structure
```
backend/src/
├── app.js                    ← Express app, middleware, route mounts
├── config/db.js              ← PostgreSQL connection pool
├── middleware/
│   ├── auth.js               ← JWT verification middleware
│   └── errorHandler.js       ← Global error handler
├── utils/
│   └── pushNotifications.js  ← Expo push helper
└── modules/
    ├── auth/                 ← Login, Register, push-token
    ├── sessions/             ← Core billing engine
    ├── rooms/                ← Room CRUD, invitations
    ├── wallet/               ← Balance, recharge, history
    ├── admin/                ← Admin dashboard operations
    ├── iot/                  ← ESP32 heartbeat (legacy WiFi)
    └── support/              ← Support tickets
```

### 4.3 All API Endpoints

#### Auth
```
POST   /api/v1/auth/register              — Register new student
POST   /api/v1/auth/login                 — Login (returns JWT)
POST   /api/v1/auth/push-token            — Register Expo push token
PATCH  /api/v1/auth/change-password       — Change own password
GET    /api/v1/auth/me                    — Get own profile
```

#### Sessions (Core)
```
POST   /api/v1/sessions/book                        — Pre-authorize, lock funds, create session
POST   /api/v1/sessions/sync                        — Settle BLE offline session (MAIN BILLING PATH)
GET    /api/v1/sessions/active                      — Get active session for user's room
GET    /api/v1/sessions/my                          — Session history (pagination + scope filter)
GET    /api/v1/sessions/ac-status/:r_id             — Get IoT device live status for a room
GET    /api/v1/sessions/:id                         — Get session by ID
POST   /api/v1/sessions/:id/end                     — End session (legacy WiFi/worker flow)
POST   /api/v1/sessions/:id/join                    — Auto-join an active session
POST   /api/v1/sessions/:id/emergency-stop          — Emergency stop from hardware event
POST   /api/v1/sessions/participants/invite         — Invite roommate to active session
POST   /api/v1/sessions/participants/accept         — Accept session invite
POST   /api/v1/sessions/participants/reject         — Reject session invite
POST   /api/v1/sessions/participants/leave          — Request to leave session early
POST   /api/v1/sessions/participants/leave/approve  — Approve a leave request
POST   /api/v1/sessions/participants/leave/reject   — Reject a leave request
```

#### Rooms
```
GET    /api/v1/rooms/my              — Get user's room with all members
GET    /api/v1/rooms/hostels         — List all hostels (for room creation form)
POST   /api/v1/rooms                 — Create a new room
POST   /api/v1/rooms/invite          — Invite someone to the room
POST   /api/v1/rooms/invite/accept   — Accept room invitation
POST   /api/v1/rooms/invite/reject   — Reject room invitation
POST   /api/v1/rooms/leave           — Leave current room
```

#### Wallet
```
GET    /api/v1/wallet/me              — Own wallet balance + stats
GET    /api/v1/wallet/transactions    — Transaction history
POST   /api/v1/wallet/recharge        — Admin: recharge student wallet
```

#### Admin
```
GET    /api/v1/admin/dashboard            — Stats overview
GET    /api/v1/admin/users               — List students (with search/filters)
GET    /api/v1/admin/rooms               — List all rooms
GET    /api/v1/admin/sessions            — All sessions (with filters)
GET    /api/v1/admin/sessions/active     — Only active sessions
PATCH  /api/v1/admin/users/:id/wallet    — Recharge student wallet
PATCH  /api/v1/admin/users/:id/toggle    — Enable/disable account
```

### 4.4 Billing Engine A — `syncSession` (BLE Offline Flow)

> This is the **primary billing path** used by the Mobile App.

**Triggered by:** `POST /api/v1/sessions/sync`
**Used when:** Student taps "Stop AC" OR when the auto-sync hook detects `status: FINISHED` from the ESP32.

**Step-by-Step:**
```
1. Fetch session from DB — validate it is active/booked
2. Get max_kwh (target_value) and blocked_amount (max_kwh × rate)
3. actual_consumed = MIN(total_units_from_ESP32, max_kwh)
4. [MINIMUM CHARGE] If actual_consumed < 0.100 kWh:
       actual_consumed = 0.100 kWh  ← Anti-spam/masti penalty
5. actual_total_cost = actual_consumed × rate_per_unit
6. Fetch all ACCEPTED + LEFT participants with timestamps
7. For each participant:
   a. [JOIN GRACE] if (joined_at - session.start_time) ≤ 5 min:
          effectiveJoinTime = session.start_time
   b. [LEAVE GRACE] if (session.end_time - left_at) ≤ 5 min:
          effectiveLeaveTime = session.end_time
   c. participationMs = effectiveLeaveTime - effectiveJoinTime
8. totalMs = Σ(all participationMs)
9. sharePercent[i] = participationMs[i] / totalMs
10. cost[i] = actual_total_cost × sharePercent[i]
    (Last participant absorbs rounding remainder)
11. BEGIN TRANSACTION:
    ├── UPDATE sessions: status='completed', end_time=NOW(), total_units=actual_consumed
    ├── FOR EACH participant:
    │   ├── INSERT consumption_records (units, cost)
    │   ├── UPDATE wallets: balance -= cost, total_spent += cost
    │   └── INSERT wallet_transactions (type='consumption')
    └── Creator refund:
        ├── refund = blocked_amount - creator_cost
        ├── UPDATE wallets: balance += refund
        └── INSERT wallet_transactions (type='refund')
    COMMIT
12. Return full billing breakdown
```

<!--
> [!CAUTION]
> **Known Bug:** `sessionEnd` is currently `new Date()` (server clock at sync time). If the phone syncs 24 hours after the AC turned off, participants' timelines are stretched to 24 hours, destroying the proportional ratio. **Fix: pass `active_duration_sec` from ESP32, calculate `sessionEnd = start_time + active_duration_sec`.**

> [!WARNING]
> **Known Gap:** `syncSession` currently does NOT apply the 5-minute grace periods or the 100W minimum charge. Both are only in `endSession` (the legacy WiFi path). **Fix: port both rules into `syncSession`.**
-->

### 4.5 Billing Engine B — `endSession` (Legacy WiFi Flow)

> This path is used by the background `sessions.worker.js` which polls for expired WiFi-connected sessions. It is **NOT used by the mobile app.**

Contains: 100W minimum charge + 5-minute grace periods (fully implemented).

### 4.6 Booking Engine — `createSession` (`POST /sessions/book`)

Called by mobile app BEFORE sending the BLE START command.

```
1. Validate user is a current active room member
2. Check no other active session exists for this room (unique partial index enforces this at DB level)
3. Validate wallet balance is sufficient:
   - budget type:   target_value (₹) ≤ balance
   - unit type:     (target_value × rate) ≤ balance
   - duration type: (target_value hours × 4.5 kW × rate) ≤ balance
4. Convert booking to max_kwh and max_duration_sec
5. Block full session cost from creator's wallet upfront
6. INSERT session record (status='active')
7. INSERT creator as accepted participant (joined_at=NOW())
8. Return { session_id, max_kwh, max_duration_sec } to mobile app
```

### 4.7 Session Participant Leave Flow
```
Participant presses "Leave" →
   POST /sessions/participants/leave
   └── participant.status = 'leave_requested', pending approval

Push notification sent to ALL other accepted participants:
   [LEAVE_REQUEST] "X wants to leave early — Approve or Reject?"

Any other participant taps "Approve" →
   POST /sessions/participants/leave/approve
   └── participant.status = 'left'
   └── participant.left_at = NOW()
   └── Billing for this person stops at left_at

Any other participant taps "Reject" →
   POST /sessions/participants/leave/reject
   └── participant.status = 'accepted' (restored)
   └── Billing continues for this person
```

### 4.8 Billing Rules Summary

| Rule | Value | Applied In |
|---|---|---|
| **Minimum Charge** | 0.100 kWh (100W) | `syncSession` (pending fix), `endSession` |
| **Join Grace Period** | 5 minutes | `syncSession` (pending fix), `endSession` |
| **Leave Grace Period** | 5 minutes | `syncSession` (pending fix), `endSession` |
| **Maximum Charge** | Capped at `max_kwh` (booked limit) | Both engines |
| **Cost Rate** | Snapshot of `rate_per_unit` at booking time | Both engines |

### 4.9 Financial Safety Mechanisms

| Mechanism | Protects Against |
|---|---|
| **Pre-blocking wallet at booking** | Overspending — funds reserved before AC turns on |
| **Cap at max_kwh** | Overcharging beyond what was booked |
| **ACID PostgreSQL transactions** | Partial billing writes on server crash |
| **Immutable ledger** | Data tampering — `wallet_transactions` rows are never updated |
| **Auto-refund on BLE fail** | If BLE START fails, `sync` is called with `total_units: 0` to immediately refund |
| **100W minimum charge** | AC toggling abuse ("masti") |

---

## 5. Database Layer — PostgreSQL

### 5.1 Entity Relationship Overview
```
hostels
  └── rooms (hostel_id FK)
        ├── room_members (r_id FK + u_id FK)
        ├── room_invitations (room_id FK)
        └── sessions (r_id FK)
              └── session_participants (session_id FK + u_id FK)
              └── consumption_records (session_id FK + u_id FK)

users
  ├── wallets (u_id FK, 1:1)
  │     └── wallet_transactions (wallet_id FK)
  ├── room_members
  ├── room_invitations
  └── support_tickets

devices (r_id FK → rooms)
```

### 5.2 All Tables

| # | Table | Key Columns | Purpose |
|---|---|---|---|
| 1 | `hostels` | `hostel_id`, `name`, `hostel_code` | Hostel/PG entities |
| 2 | `users` | `u_id`, `email`, `mobile`, `role`, `hostel_id` | All users (students + admins) |
| 3 | `rooms` | `r_id`, `hostel_id`, `room_no`, `rate_per_unit`, `capacity` | Physical rooms |
| 4 | `room_members` | `r_id`, `u_id`, `role`, `joined_at`, `left_at` | Who is in which room |
| 5 | `room_invitations` | `room_id`, `sent_by`, `sent_to`, `status` | Room join invites |
| 6 | `sessions` | `session_id`, `r_id`, `session_type`, `target_value`, `total_units`, `rate_per_unit`, `status` | One AC run |
| 7 | `session_participants` | `session_id`, `u_id`, `status`, `joined_at`, `left_at` | Per-person participation |
| 8 | `wallets` | `u_id`, `balance`, `total_recharged`, `total_spent` | Prepaid balance |
| 9 | `wallet_transactions` | `wallet_id`, `session_id`, `amount`, `type` | Financial ledger |
| 10 | `consumption_records` | `session_id`, `u_id`, `units_consumed`, `cost` | Final billing output |
| 11 | `devices` | `device_id`, `r_id`, `status`, `current_power_w` | ESP32 device registry |
| 12 | `support_tickets` | `u_id`, `subject`, `message`, `status` | Support queries |

### 5.3 Key Constraints & Indexes
```sql
-- Only ONE active session per room at a time
CREATE UNIQUE INDEX uq_sess_one_active_per_room
    ON sessions(r_id) WHERE status IN ('pending', 'active');

-- Each user can only appear once per session
CONSTRAINT uq_sp_user_session UNIQUE (session_id, u_id);

-- Rate snapshot (immutable billing)
sessions.rate_per_unit -- copied from rooms.rate_per_unit at session creation

-- Soft deletes (room members)
room_members.left_at -- NULL = active, timestamp = left

-- Immutable ledger
wallet_transactions -- rows are NEVER updated or deleted (append-only)
consumption_records -- written ONCE per (session, u_id), never updated
```

### 5.4 Session Type → Hardware Mapping

| Session Type | `target_value` | `max_kwh` sent to ESP32 | `max_duration_sec` sent |
|---|---|---|---|
| `unlimited` | NULL | 0 (no limit) | 0 (no limit) |
| `budget` (₹) | ₹ amount | `target_value / rate_per_unit` | 0 |
| `unit` (kWh) | kWh amount | `target_value` | 0 |
| `duration` (hours) | Hours | `hours × 4.5 kW` | `hours × 3600` |

---

## 6. Admin Frontend — React (Web)

### 6.1 Tech Stack
- **Framework:** React 19 + Vite
- **Language:** JavaScript + JSX
- **Styling:** Vanilla CSS (glassmorphism, dark mode)
- **Routing:** React Router DOM
- **HTTP:** Axios + JWT interceptors
- **Charts:** Recharts

### 6.2 Pages
| Page | Features |
|---|---|
| **Admin Login** | Separate portal for admin accounts |
| **Dashboard** | Total users, revenue, active sessions count, top consumers |
| **Student Management** | List, search, filter, toggle active status, recharge wallet |
| **Room Management** | List all rooms, view current members, manage rates |
| **Active Sessions** | Live table of all running AC sessions across all hostels |
| **Reports** | Revenue charts, per-student consumption history |

---

## 7. Security Architecture

### 7.1 Password Security
- Passwords hashed with **bcrypt (10 salt rounds)** before storage.
- Plaintext passwords are never stored anywhere.

### 7.2 JWT Authentication
- All protected routes pass through `authMiddleware`.
- JWT payload includes `u_id` and `role`.
- Admin routes additionally check `role === 'admin'`.

### 7.3 Input Validation
- All API inputs validated with `express-validator` before reaching service layer.
- Type coercion: `hostel_id` always parsed to integer, monetary values to float, etc.

### 7.4 Authorization Rules
- Session actions (end, invite, leave) verify the user is an active participant.
- Room actions (invite) verify the user is the room owner.
- Leave approval verifies the approver is a different active participant.
- Wallet recharge is admin-only.

---

## 8. Version 2.0 — Planned Upgrades

### 8.1 Delta-Billing (True Variable-Load Fairness)
**Problem V1:** If Student A runs AC at 26°C (1,400W) for 1 hour, then Student B runs at 16°C (2,600W) for 1 hour, V1 splits the 4 kWh 50/50. This is unfair — B used more power.

**V2 Fix:** When participant list changes (join/leave), the joining phone reads the current `session_kwh` from the ESP32 and passes it to the backend. The backend immediately settles the leaving person's share based on the actual kWh delta since the last settlement.

### 8.2 IoT Time-Series Data Logger
**Problem:** BLE can only hold one connection at a time. If Student A is connected, Student B can't read the kWh for delta-billing.

**V2 Fix:** ESP32 records `[timestamp, kwh]` rows to LittleFS flash every 5 minutes. Session end syncs the entire log. Backend reconstructs the exact kWh at each join/leave timestamp from the log.

**Memory:** 8 bytes/row × 288 rows/24h = 2.3 KB. ESP32 has 1.5 MB flash. Two rooms = 4.6 KB total.

### 8.3 Two-Step ACK Data Integrity
**Download** from ESP32 → **Upload** to backend → **DB saves** → **200 OK** → **Phone sends SYNC_ACK** → **ESP32 clears memory**. Ensures no financial data is ever lost, even if the phone battery dies mid-sync.

### 8.4 Dual-Room PCB
Single ESP32 managing two adjacent rooms simultaneously. Dual PZEM, dual relays, dual displays, dual E-Stop. Cost per room is halved. PCB dimensions: 150mm × 180mm.

### 8.5 Phase 3 Scaling (MQTT + WebSockets + Redis)
- **ESP32 → MQTT Broker:** Replaces HTTP POST (10× less bandwidth, persistent connection)
- **Backend → Mobile/Web:** WebSockets for real-time push (eliminates polling lag)
- **Redis:** In-memory cache for high-frequency telemetry writes (PostgreSQL only touched at session end)

---

## 9. Known Issues & Pending Fixes

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `syncSession` uses `new Date()` as end time — causes 24h billing stretch if phone syncs late | **Critical** | Pending (add `active_duration_sec` from ESP32) |
| 2 | `syncSession` missing 5-minute join/leave grace periods | **High** | Pending (port from `endSession`) |
| 3 | `syncSession` missing 100W minimum charge rule | **Medium** | Pending (port from `endSession`) |

---

## 10. Repository Structure

```
FairAC/
├── backend/                         ← Node.js/Express API Server
│   ├── server.js                    ← Entry point
│   └── src/
│       ├── app.js                   ← Express setup
│       ├── config/db.js             ← PostgreSQL pool
│       ├── middleware/
│       ├── utils/pushNotifications.js
│       └── modules/
│           ├── auth/
│           ├── sessions/
│           │   ├── sessions.routes.js
│           │   ├── sessions.controller.js
│           │   ├── sessions.service.js  ← THE BILLING ENGINE
│           │   └── sessions.worker.js   ← Legacy WiFi background poller
│           ├── rooms/
│           ├── wallet/
│           ├── admin/
│           ├── iot/
│           └── support/
├── database/
│   └── 001_create_schema.sql        ← Full PostgreSQL schema (12 tables)
├── docs/
│   ├── architecture.md              ← THIS FILE
│   └── fairac_pitch.html            ← Investor pitch page
├── frontend/                        ← React (Vite) Admin Web Dashboard
│   └── src/
│       ├── pages/auth/
│       ├── pages/student/
│       └── pages/admin/
├── iot/
│   └── esp32_ble/
│       └── esp32_ble.ino            ← PRODUCTION ESP32 firmware
├── mobileApp/
│   └── application/
│       └── src/
│           ├── context/AuthContext.js
│           ├── hooks/
│           │   ├── useBLE.js
│           │   └── usePushNotifications.js
│           ├── navigation/AppNavigator.js
│           └── screens/
│               ├── auth/
│               └── student/
│                   ├── SessionScreen.js     ← Main BLE control screen
│                   ├── RoomScreen.js
│                   ├── WalletScreen.js
│                   ├── DashboardScreen.js
│                   └── ProfileScreen.js
├── README.md
├── phase_3_architecture.md          ← MQTT/WS/Redis scaling blueprint
├── version_2_implementation_plan.md ← Delta-billing V2 design
├── security_audit.md
├── timesheet.md
└── to_do.md
```
