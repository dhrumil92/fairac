# FairAC — Full System Architecture Diagram

> **Version 1.0 — With Pending Bug Fixes Applied**
> Assumes: `active_duration_sec` fix, grace periods, and 100W minimum in `syncSession`.

---

## Diagram 1 — High-Level System Overview

```mermaid
graph TB
    subgraph EDGE["⚙️ Edge Layer (Hardware)"]
        ESP32["ESP32<br/>BLE Firmware"]
        PZEM["PZEM-004T<br/>Power Meter"]
        RELAY["SSR Relay<br/>AC Switch"]
        LCD["16×2 LCD<br/>Display"]
        LEDS["LEDs + Buzzer<br/>Status Indicators"]
        ESTOP["E-Stop Button<br/>GPIO 39"]
        NVS["NVS Flash<br/>Crash Recovery"]
    end

    subgraph MOBILE["📱 Mobile Layer (React Native / Expo)"]
        BLESTACK["BLE Stack<br/>react-native-ble-plx"]
        SCREENS["Screens<br/>Session / Room / Wallet"]
        PUSHCLIENT["Push Notifications<br/>expo-notifications"]
        AUTHCTX["Auth Context<br/>JWT Store"]
        AXIOS["Axios HTTP Client"]
    end

    subgraph BACKEND["🖥️ Backend Layer (Node.js / Express)"]
        API["REST API<br/>Express.js"]
        BILLING["Billing Engine<br/>syncSession"]
        BOOKING["Booking Engine<br/>createSession"]
        PUSHSRV["Push Service<br/>expo-server-sdk"]
        WORKER["Sessions Worker<br/>Legacy WiFi Poller"]
    end

    subgraph DB["🗄️ Database Layer (PostgreSQL)"]
        SESSIONS[("sessions")]
        USERS[("users")]
        WALLETS[("wallets")]
        TXNS[("wallet_transactions")]
        RECORDS[("consumption_records")]
        PARTICIPANTS[("session_participants")]
        ROOMS[("rooms")]
    end

    subgraph ADMIN["🖥️ Admin Frontend (React / Vite)"]
        ADMINDASH["Admin Dashboard"]
        REPORTS["Reports & Analytics"]
        USERMGMT["User Management"]
    end

    %% Hardware internal
    PZEM -->|"Voltage / Power / kWh"| ESP32
    ESP32 -->|"HIGH/LOW signal"| RELAY
    ESP32 -->|"I2C"| LCD
    ESP32 -->|"GPIO"| LEDS
    ESTOP -->|"interrupt"| ESP32
    ESP32 <-->|"read/write"| NVS

    %% Mobile ↔ Hardware
    BLESTACK <-->|"BLE (GATT)<br/>Commands + Telemetry"| ESP32

    %% Mobile internal
    BLESTACK --> SCREENS
    SCREENS --> AXIOS
    SCREENS --> PUSHCLIENT
    AUTHCTX --> AXIOS

    %% Mobile ↔ Backend
    AXIOS <-->|"HTTPS / REST"| API
    PUSHSRV -->|"Expo Push Gateway"| PUSHCLIENT

    %% Backend internal
    API --> BILLING
    API --> BOOKING
    API --> PUSHSRV
    API --> WORKER

    %% Backend ↔ DB
    BILLING <-->|"ACID Transactions"| DB
    BOOKING <-->| | DB
    WORKER <-->| | DB

    %% Admin ↔ Backend
    ADMINDASH <-->|"HTTPS / REST"| API
    REPORTS <-->| | API
    USERMGMT <-->| | API

    style EDGE fill:#1a1a2e,stroke:#e94560,color:#fff
    style MOBILE fill:#16213e,stroke:#0f3460,color:#fff
    style BACKEND fill:#0f3460,stroke:#533483,color:#fff
    style DB fill:#533483,stroke:#e94560,color:#fff
    style ADMIN fill:#16213e,stroke:#e94560,color:#fff
```

---

## Diagram 2 — Complete BLE Session Flow (Happy Path)

```mermaid
sequenceDiagram
    actor Student as 🧑 Student
    participant App as 📱 Mobile App
    participant ESP32 as ⚙️ ESP32
    participant API as 🖥️ Backend API
    participant DB as 🗄️ PostgreSQL

    Note over Student,DB: ── PHASE 1: BOOKING ──────────────────────────────────

    Student->>App: Taps "Book AC"<br/>(type: duration, value: 1hr)
    App->>API: POST /sessions/book<br/>{r_id, booking_type, booking_value}
    API->>DB: Validate room, check wallet balance
    DB-->>API: ✅ Balance sufficient
    API->>DB: INSERT session (status='active')
    API->>DB: DEBIT wallet (block full cost)
    API->>DB: INSERT creator as participant (joined_at=NOW)
    API-->>App: {session_id: 84, max_kwh: 1.5, max_duration_sec: 3600}

    Note over Student,DB: ── PHASE 2: HARDWARE START ───────────────────────────

    App->>ESP32: BLE WRITE: {"cmd":"START",<br/>"max_kwh":1.5,<br/>"max_duration_sec":3600,<br/>"session_id":84}
    ESP32->>ESP32: Relay ON ⚡
    ESP32->>ESP32: Save state to NVS flash
    ESP32-->>App: BLE NOTIFY: {"status":"ACTIVE","power":1450,...}

    Note over Student,DB: ── PHASE 3: ACTIVE SESSION ───────────────────────────

    loop Every 5 seconds (while connected)
        ESP32->>ESP32: Poll PZEM<br/>Accumulate kWh<br/>Tick down timer
        ESP32-->>App: BLE NOTIFY: {power, units_consumed, remain_sec}
        App->>App: Update live UI display
    end

    Note over Student,DB: ── PHASE 4: SESSION END ──────────────────────────────

    Student->>App: Taps "Stop AC"
    App->>ESP32: BLE WRITE: {"cmd":"STOP"}
    ESP32->>ESP32: Relay OFF 🔴<br/>Save final kWh to NVS<br/>State = FINISHED
    ESP32-->>App: BLE NOTIFY: {"status":"FINISHED",<br/>"units_consumed":1.23}

    Note over Student,DB: ── PHASE 5: BILLING SYNC ────────────────────────────

    App->>API: POST /sessions/sync<br/>{session_id:84,<br/>total_units:1.23,<br/>active_duration_sec:3592}
    API->>API: Cap: actual = MIN(1.23, 1.5)<br/>Apply 100W minimum if needed<br/>Reconstruct timeline using active_duration_sec
    API->>API: Calculate each person's share<br/>Apply grace periods
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE session (status='completed')
    API->>DB: INSERT consumption_records
    API->>DB: DEBIT each wallet
    API->>DB: INSERT wallet_transactions
    API->>DB: REFUND creator surplus
    API->>DB: COMMIT
    API-->>App: {billing_breakdown, each_persons_cost}

    Note over Student,DB: ── PHASE 6: HARDWARE CLEAR ───────────────────────────

    App->>ESP32: BLE WRITE: {"cmd":"SYNC_ACK"}
    ESP32->>ESP32: Clear NVS flash 🗑️<br/>State = STANDBY
    App->>App: Refresh wallet balance + history
```

---

## Diagram 3 — Autonomous Session (Phone Disconnects, Syncs Later)

```mermaid
sequenceDiagram
    actor A as 🧑 Student A
    participant App as 📱 Mobile App
    participant ESP32 as ⚙️ ESP32
    participant API as 🖥️ Backend API

    A->>App: Book 1-hour session
    App->>API: POST /sessions/book
    API-->>App: {session_id, max_kwh, max_duration_sec:3600}
    App->>ESP32: BLE: START command
    ESP32->>ESP32: Relay ON ⚡<br/>Countdown starts: 3600s
    A->>App: Disconnects Bluetooth<br/>(goes to class)

    Note over A,API: ── 1 HOUR PASSES — NO PHONE CONNECTED ──

    ESP32->>ESP32: remaining_duration_sec = 0
    ESP32->>ESP32: finishSession("DURATION_LIMIT")<br/>Relay OFF 🔴
    ESP32->>ESP32: active_duration_sec = 3597s<br/>Save to NVS flash
    Note right of ESP32: NVS holds:<br/>session_kwh = 1.432<br/>active_duration_sec = 3597<br/>is_finished = true

    Note over A,API: ── 24 HOURS LATER — STUDENT RECONNECTS ──

    A->>App: Opens app next day
    App->>ESP32: BLE connects
    ESP32-->>App: NOTIFY: {status:"FINISHED",<br/>units_consumed:1.432,<br/>active_sec:3597}
    App->>App: Auto-sync triggered!

    App->>API: POST /sessions/sync<br/>{session_id, total_units:1.432,<br/>active_duration_sec:3597}
    API->>API: sessionEnd = start_time + 3597s<br/>(NOT now() — BUG FIXED ✅)<br/>Billing calculated on correct 1-hour window
    API-->>App: Billing settled correctly ✅
    App->>ESP32: BLE: SYNC_ACK
    ESP32->>ESP32: Clear NVS → STANDBY
```

---

## Diagram 4 — Multi-Participant Session with Leave Flow

```mermaid
sequenceDiagram
    actor A as 🧑 Student A (Creator)
    actor B as 🧑 Student B
    participant App as 📱 Mobile App
    participant API as 🖥️ Backend API
    participant DB as 🗄️ PostgreSQL
    participant Push as 🔔 Push Service

    Note over A,Push: ── SESSION START ────────────────────────────────────

    A->>API: POST /sessions/book
    API->>DB: INSERT session, block A's wallet
    A->>API: [BLE Start sent to ESP32]

    Note over A,Push: ── INVITE PARTICIPANT ───────────────────────────────

    A->>API: POST /sessions/participants/invite<br/>{session_id, invitee_id: B}
    API->>DB: INSERT participant (B, status='invited')
    API->>Push: Send push to B
    Push-->>B: 🔔 "A invited you to share AC cost"<br/>[✅ Accept] [❌ Reject]

    B->>API: POST /sessions/participants/accept
    API->>DB: UPDATE participant:<br/>status='accepted', joined_at=NOW()
    Note right of DB: Grace period: if joined<br/>within 5min of start,<br/>bill from session start

    Note over A,Push: ── B REQUESTS EARLY LEAVE ───────────────────────────

    B->>API: POST /sessions/participants/leave
    API->>DB: UPDATE participant: status='leave_requested'
    API->>Push: Send push to A
    Push-->>A: 🔔 "B wants to leave early"<br/>[✅ Approve] [❌ Reject]

    A->>API: POST /sessions/participants/leave/approve
    API->>DB: UPDATE participant:<br/>status='left', left_at=NOW()
    Note right of DB: Grace period: if left<br/>within 5min of session end,<br/>bill until session end

    Note over A,Push: ── SESSION END + BILLING ────────────────────────────

    A->>API: POST /sessions/sync<br/>{session_id, total_units, active_duration_sec}
    
    API->>API: Reconstruct timeline:<br/>A: full session (0 → end)<br/>B: joined_at → left_at
    API->>API: totalMs = A_ms + B_ms<br/>A_share = A_ms/totalMs<br/>B_share = B_ms/totalMs
    API->>API: Apply 100W minimum if needed<br/>Apply grace periods

    API->>DB: BEGIN TRANSACTION
    API->>DB: ✅ Debit A's wallet (A_share cost)
    API->>DB: ✅ Debit B's wallet (B_share cost)
    API->>DB: ✅ Refund A's surplus (blocked - A_share)
    API->>DB: ✅ INSERT consumption_records (A + B)
    API->>DB: ✅ INSERT wallet_transactions (A + B)
    API->>DB: COMMIT
    
    API-->>App: {A_cost, B_cost, total_cost}
    Push->>B: 🔔 "Session ended — You were charged ₹X"
```

---

## Diagram 5 — ESP32 Internal State Machine

```mermaid
stateDiagram-v2
    [*] --> BOOTING

    BOOTING --> STANDBY : NVS: no active session
    BOOTING --> SESSION_ACTIVE : NVS: was_active=true<br/>(power cut recovery — resume silently)
    BOOTING --> FINISHED : NVS: was_finished=true<br/>(power cut after session end — await sync)

    STANDBY --> SESSION_ACTIVE : BLE command: START<br/>{max_kwh, max_duration_sec, session_id}<br/>→ Relay ON ⚡

    state SESSION_ACTIVE {
        [*] --> Accumulating
        Accumulating --> Accumulating : Every 5s:<br/>Poll PZEM<br/>Accumulate kWh<br/>Tick timer<br/>Send BLE telemetry
        Accumulating --> AutoStop_kWh : session_kwh ≥ max_kwh
        Accumulating --> AutoStop_Time : remaining_sec = 0
        Accumulating --> AutoStop_LowPower : power < 20W<br/>for 3 consecutive minutes
    }

    SESSION_ACTIVE --> FINISHED : finishSession("KWH_LIMIT")
    SESSION_ACTIVE --> FINISHED : finishSession("DURATION_LIMIT")
    SESSION_ACTIVE --> FINISHED : finishSession("AUTO_OFF")
    SESSION_ACTIVE --> FINISHED : BLE command: STOP<br/>(manual stop by user)
    SESSION_ACTIVE --> FAULT : E-Stop button pressed<br/>GPIO 39

    FAULT --> STANDBY : Long press E-Stop (3s)<br/>to clear fault

    state FINISHED {
        [*] --> WaitingForSync
        WaitingForSync : Relay OFF 🔴<br/>Red LED ON<br/>NVS holds final kWh<br/>BLE advertising<br/>LCD: "Open App 2 Sync"
    }

    FINISHED --> STANDBY : BLE command: SYNC_ACK<br/>(phone confirms server got data)<br/>→ Clear NVS flash
```

---

## Diagram 6 — Billing Engine Flow (syncSession — Fixed Version)

```mermaid
flowchart TD
    START([📥 POST /sessions/sync\nReceived]) --> FETCH[Fetch session from DB\nValidate status = active/booked]
    FETCH -->|Not found| ERR404[❌ 404 Error\nAlready settled]
    FETCH -->|Found| CALCMAX[max_kwh = session.target_value\nblocked_amount = max_kwh × rate]

    CALCMAX --> CAP["actual_consumed =\nMIN(total_units_from_esp32, max_kwh)"]
    CAP --> MINCHECK{actual_consumed\n< 0.100 kWh?}
    MINCHECK -->|Yes — Anti-spam| SETMIN["actual_consumed = 0.100 kWh\n⚠️ Minimum charge applied"]
    MINCHECK -->|No| CALCOST
    SETMIN --> CALCOST["actual_total_cost =\nactual_consumed × rate_per_unit"]

    CALCOST --> TIMELINE["Reconstruct Session Timeline\nsessionEnd = start_time + active_duration_sec\n✅ BUG FIXED — no longer uses NOW()"]

    TIMELINE --> FETCHPARTS[Fetch all ACCEPTED + LEFT\nparticipants with timestamps]

    FETCHPARTS --> GRACELOOP

    subgraph GRACELOOP["For Each Participant"]
        JOINGRACE{joined_at − start_time\n≤ 5 minutes?}
        JOINGRACE -->|Yes| SETJOIN[effectiveJoin = session.start_time]
        JOINGRACE -->|No| USEJOIN[effectiveJoin = joined_at]

        LEAVEGRACE{sessionEnd − left_at\n≤ 5 minutes?}
        LEAVEGRACE -->|Yes — or still in session| SETLEAVE[effectiveLeave = sessionEnd]
        LEAVEGRACE -->|No| USELEAVE[effectiveLeave = left_at]

        CALCMS["participationMs =\neffectiveLeave − effectiveJoin"]
    end

    GRACELOOP --> TOTALMS["totalMs = Σ all participationMs"]
    TOTALMS --> SHARES["sharePercent[i] = participationMs[i] / totalMs\ncost[i] = actual_total_cost × sharePercent[i]\n(Last person absorbs rounding remainder)"]

    SHARES --> TXNBEGIN[(🏦 BEGIN TRANSACTION)]
    TXNBEGIN --> UPDATESESS[UPDATE sessions:\nstatus = 'completed'\nend_time = sessionEnd\ntotal_units = actual_consumed]

    UPDATESESS --> PERPART

    subgraph PERPART["For Each Participant"]
        INS_CR[INSERT consumption_records\nunits_consumed, cost]
        UPD_WAL[UPDATE wallets:\nbalance -= cost\ntotal_spent += cost]
        INS_TXN[INSERT wallet_transactions\ntype = 'consumption']
    end

    PERPART --> REFUND["Creator Refund:\nrefund = blocked_amount − creator_cost\nUPDATE wallet: balance += refund\nINSERT wallet_transaction type='refund'"]

    REFUND --> COMMIT[(✅ COMMIT)]
    COMMIT --> RETURN["Return billing breakdown to app\n{each_person: {cost, units, share_pct}}"]

    ERR404 --> ENDF([End])
    RETURN --> ENDF
```

---

## Diagram 7 — Database Entity Relationship

```mermaid
erDiagram
    hostels {
        bigserial hostel_id PK
        varchar name
        varchar hostel_code
        text address
    }

    users {
        bigserial u_id PK
        varchar name
        varchar email UK
        varchar mobile UK
        varchar role
        bigint hostel_id FK
        boolean is_active
    }

    rooms {
        bigserial r_id PK
        bigint hostel_id FK
        bigint created_by FK
        varchar room_no
        smallint capacity
        decimal rate_per_unit
    }

    room_members {
        bigserial rm_id PK
        bigint r_id FK
        bigint u_id FK
        varchar role
        timestamptz joined_at
        timestamptz left_at
    }

    room_invitations {
        bigserial invitation_id PK
        bigint room_id FK
        bigint sent_by FK
        bigint sent_to FK
        varchar status
        timestamptz expires_at
    }

    sessions {
        bigserial session_id PK
        bigint r_id FK
        bigint created_by FK
        varchar session_type
        decimal target_value
        decimal total_units
        decimal rate_per_unit
        varchar status
        timestamptz start_time
        timestamptz end_time
    }

    session_participants {
        bigserial sp_id PK
        bigint session_id FK
        bigint u_id FK
        varchar status
        timestamptz joined_at
        timestamptz left_at
    }

    wallets {
        bigserial wallet_id PK
        bigint u_id FK
        decimal balance
        decimal total_recharged
        decimal total_spent
    }

    wallet_transactions {
        bigserial txn_id PK
        bigint wallet_id FK
        bigint session_id FK
        decimal amount
        varchar type
        timestamptz created_at
    }

    consumption_records {
        bigserial record_id PK
        bigint session_id FK
        bigint u_id FK
        decimal units_consumed
        decimal cost
        timestamptz recorded_at
    }

    devices {
        varchar device_id PK
        bigint r_id FK
        varchar status
        double current_power_w
        timestamptz last_heartbeat
    }

    support_tickets {
        serial ticket_id PK
        bigint u_id FK
        varchar subject
        text message
        varchar status
    }

    hostels ||--o{ rooms : "contains"
    hostels ||--o{ users : "manages"
    users ||--o{ rooms : "creates"
    rooms ||--o{ room_members : "has"
    users ||--o{ room_members : "joins"
    rooms ||--o{ room_invitations : "sends"
    users ||--o{ room_invitations : "receives"
    rooms ||--o{ sessions : "runs"
    users ||--o{ sessions : "creates"
    sessions ||--o{ session_participants : "has"
    users ||--o{ session_participants : "participates"
    sessions ||--o{ consumption_records : "generates"
    users ||--o{ consumption_records : "billed"
    users ||--|| wallets : "owns"
    wallets ||--o{ wallet_transactions : "records"
    sessions ||--o{ wallet_transactions : "causes"
    rooms ||--o| devices : "has"
    users ||--o{ support_tickets : "submits"
```

---

## Diagram 8 — Wallet Money Flow

```mermaid
flowchart LR
    ADMIN["👤 Admin"] -->|"POST /wallet/recharge\n+₹500"| W_CREDIT["Wallet Credit\n+balance\n+total_recharged"]
    W_CREDIT --> TXN_R["wallet_transactions\ntype: 'recharge'"]

    BOOK["📱 Book Session"] -->|"Lock max cost"| W_BLOCK["Wallet Debit\n−blocked_amount\n(upfront hold)"]
    W_BLOCK --> TXN_B["wallet_transactions\ntype: 'consumption'\n(blocked)"]

    SYNC["✅ Session Ends\nsyncSession"] -->|"Debit actual share"| W_DEBIT["Wallet Debit\n−actual_cost\n−total_spent"]
    W_DEBIT --> TXN_C["wallet_transactions\ntype: 'consumption'"]
    W_DEBIT --> CR["consumption_records\nunits_consumed, cost"]

    SYNC -->|"Refund surplus\n(blocked − actual)"| W_REFUND["Wallet Credit\n+refund\n+balance"]
    W_REFUND --> TXN_F["wallet_transactions\ntype: 'refund'"]

    BLESTART["⚡ BLE START fails"] -->|"Cancel: total_units=0"| W_REFUND
```

---

## Diagram 9 — Push Notification Flow

```mermaid
flowchart TD
    EVENT["🎯 Backend Event Triggered\n(invite / leave request / session end)"]

    EVENT --> PUSHLOOKUP["Lookup recipient's\nExpo Push Token\nfrom users table"]
    PUSHLOOKUP --> EXPOGW["📡 Expo Push Gateway\napi.expo.dev/v2/push/send"]
    EXPOGW --> PHONE["📱 Student's Phone\nOS Notification Tray"]

    PHONE --> CATEGORY{Notification\nCategory?}

    CATEGORY -->|"SESSION_INVITE"| BTNS1["Buttons:\n✅ Accept\n❌ Reject"]
    CATEGORY -->|"LEAVE_REQUEST"| BTNS2["Buttons:\n✅ Approve\n❌ Reject"]
    CATEGORY -->|"ROOM_INVITE"| BTNS3["Buttons:\n✅ Accept\n❌ Decline"]
    CATEGORY -->|"Info only"| NONE["No action buttons\n(session ended, etc.)"]

    BTNS1 -->|"Tap Accept"| API1["POST /sessions/participants/accept"]
    BTNS1 -->|"Tap Reject"| API2["POST /sessions/participants/reject"]
    BTNS2 -->|"Tap Approve"| API3["POST /sessions/participants/leave/approve"]
    BTNS2 -->|"Tap Reject"| API4["POST /sessions/participants/leave/reject"]
    BTNS3 -->|"Tap Accept"| API5["POST /rooms/invite/accept"]
    BTNS3 -->|"Tap Decline"| API6["POST /rooms/invite/reject"]

    API1 & API2 & API3 & API4 & API5 & API6 --> DISMISS["dismissNotificationAsync()\n🗑️ Remove from tray immediately"]
```

---

## Diagram 10 — Session Type Conversion to Hardware Values

```mermaid
flowchart TD
    INPUT["📱 Student Books Session\ntype + value"] --> SWITCH{Session Type}

    SWITCH -->|"budget\n₹100"| B1["max_kwh = 100 ÷ rate_per_unit\nmax_duration_sec = 0"]
    SWITCH -->|"unit\n2.5 kWh"| B2["max_kwh = 2.5\nmax_duration_sec = 0"]
    SWITCH -->|"duration\n2 hours"| B3["max_kwh = 2h × 1.5kW = 3.0\nmax_duration_sec = 7200"]
    SWITCH -->|"unlimited"| B4["max_kwh = 0 (no limit)\nmax_duration_sec = 0"]

    B1 & B2 & B3 & B4 --> VALIDATE["Backend validates:\nblocked_amount ≤ wallet_balance"]

    VALIDATE -->|"Balance OK"| BLOCK["Debit blocked_amount from wallet"]
    VALIDATE -->|"Insufficient"| REJECT["❌ 400 Error — Cannot book"]

    BLOCK --> BLE["BLE START Command to ESP32:\n{max_kwh, max_duration_sec, session_id}"]

    BLE --> ESP32["ESP32 enforces limits:\n• kWh limit via PZEM accumulation\n• Timer limit via 1s countdown\n• Low-power auto-off (AC remote)"]
```
