# FairAC: Project Report Structure (IEEE Format)

*This is a highly detailed structural outline for your final internship report. Copy these headings into Microsoft Word or Google Docs, and fill in the paragraphs based on the bullet points provided below. This merges the standard IEEE format with your college's specific requirements.*

---

## 1. Title Page
- **Project Title:** FairAC: A Decentralized IoT and Mobile Ecosystem for Fair Air Conditioning Billing in Shared Accommodations
- **Name, Enrollment Number, Internship Details**

## 2. Abstract
- Briefly state the problem: Unequal electricity billing in hostel rooms leading to disputes.
- State the proposed solution: A full-stack system integrating IoT (ESP32) for precise monitoring, a React Native mobile app for decentralized control, and a PostgreSQL backend for exact split-billing.
- Highlight key results: Successful offline-first execution, fault tolerance, and mathematically fair cost distribution.

## 3. Introduction
- **3.1 Background:** The current standard of dividing total room electricity bills equally regardless of individual usage.
- **3.2 Problem Statement:** Lack of transparency and fairness in billing.
- **3.3 Objectives:** 
  - To design an IoT hardware module capable of metering high-power appliances.
  - To develop a secure, offline-first communication protocol using BLE.
  - To build a transaction-safe backend to handle digital wallets and billing splits.
- **3.4 Literature Review / Existing Systems:**
  - Traditional sub-metering: Expensive, requires rewiring the building.
  - Smart Plugs: Require constant Wi-Fi, cannot handle high-amperage AC loads (16A+).
  - FairAC bridges both gaps: uses a robust PZEM-004T hardware sensor + offline BLE logic.

---

## 4. Context Diagram
> [!IMPORTANT]
> Use the Mermaid diagram from `PPT_SLIDES.md` here. Render it at [mermaid.live](https://mermaid.live/) and paste the exported image.

**Describe the ecosystem components in text:**
- The student is the primary actor. They interact with the system via the **Mobile App**.
- The Mobile App communicates with the **ESP32 Hardware** over BLE (offline) and the **Cloud Backend** over HTTPS (online).
- The ESP32 controls the **Physical AC** via a Relay, and measures consumption via the **PZEM-004T** sensor.
- The Cloud Backend manages **Wallets, Sessions, and Billing** in a PostgreSQL database and sends alerts via **Firebase (FCM)**.

---

## 5. Scope Statement
**In-Scope (What was built during this internship):**
- IoT hardware module: ESP32 + PZEM-004T + Relay + Emergency Stop + LCD Display.
- ESP32 Firmware (C++): Full offline BLE session management, NVS power-cut recovery, autonomous energy tracking.
- Backend REST API (Node.js/Express): Authentication, Wallets, Sessions, Billing, Push Notifications.
- PostgreSQL Database: Schema design, ACID-compliant transactions, financial constraints.
- Student Mobile App (React Native/Expo): Dashboard, BLE control, Wallet, Session History.

**Out-of-Scope (Planned for future):**
- Web-based Admin Dashboard for Hostel Wardens.
- iOS Mobile App.
- Actionable push notification buttons (Accept/Reject from lock screen).

---

## 6. Detailed Use Cases Implemented

### UC-01: Student Books an AC Session
- **Actor:** Student
- **Precondition:** Student is logged in, has ≥ ₹50 wallet balance, and is an assigned room member.
- **Flow:** Student selects booking type (Duration / Units / Amount) → Funds are blocked in wallet → App connects to ESP32 via BLE → `START` command is sent.
- **Postcondition:** AC relay activates. ESP32 starts tracking energy autonomously.

### UC-02: Roommate Joins a Session (Split Billing)
- **Actor:** Roommate
- **Precondition:** An active session exists in their room.
- **Flow:** Creator invites roommate → Roommate receives a push notification → Roommate accepts → Their `joined_at` timestamp is recorded → Final bill is split proportionally based on time spent.

### UC-03: Session Auto-Terminates (Limit Reached)
- **Actor:** ESP32 (Automated)
- **Flow:** ESP32's kWh counter crosses the `max_kwh` limit → Relay is shut off → ESP32 broadcasts `FINISHED` status over BLE → Mobile App receives `FINISHED` → App sends final kWh to server → Server calculates and deducts exact cost from all participants → Refunds unused blocked amount to creator.

### UC-04: Hardware Emergency Stop
- **Actor:** Physical Button on Hardware
- **Flow:** Student presses the E-Stop → ESP32 shuts off relay immediately → State is saved to NVS Flash → `FINISHED` broadcast is sent over BLE → App auto-syncs to server.

### UC-05: Power Cut Recovery
- **Actor:** ESP32 (Automated)
- **Flow:** Power is restored → ESP32 reads saved `session_kwh` and `remaining_duration` from NVS → Session automatically resumes → Countdown continues from where it left off.

### UC-06: Student Wallet Top-Up & History
- **Actor:** Student
- **Flow:** Student enters top-up amount → Wallet balance is credited → Student can view full transaction history with type filters (Recharge, Consumption).

---

## 7. Design Contribution

### 7.1 System Architecture
- Designed a **3-tier Offline-First Architecture**: IoT Edge Layer → Mobile Bridge Layer → Cloud Backend Layer.
- This design ensures the system functions even during complete network outages.

### 7.2 Database Schema Design
- Designed normalized PostgreSQL tables: `users`, `hostels`, `rooms`, `room_members`, `wallets`, `wallet_transactions`, `sessions`, `session_participants`, `consumption_records`.
- Added financial safety constraints: `CHECK (units_consumed >= 0)`, `CHECK (cost >= 0)`.

### 7.3 Fair Billing Algorithm
- Designed a time-proportional cost-sharing algorithm. If Student A used the AC for 2 hours and Roommate B joined after 1 hour, the costs are split 2:1 (67% / 33%) rather than equally.

### 7.4 Fault-Tolerant State Machine (ESP32)
- Designed a hardware state machine with states: `BOOTING → STANDBY → SESSION_ACTIVE → FINISHED → FAULT`.

---

## 8. Programming Contribution

### 8.1 Hardware Firmware (C++)
- Wrote ~590 lines of ESP32 firmware implementing: BLE GATT server/client, PZEM-004T telemetry, NVS power-cut recovery, LCD display, E-Stop debounce, and relay control.

### 8.2 Backend REST API (Node.js)
- Built ~15+ API endpoints for: Authentication (JWT), Wallet Management, Session Lifecycle (Book, Activate, Cancel, Sync, End), Participant Management (Invite, Accept, Reject, Leave, Approve), and Push Notifications.

### 8.3 Mobile Application (React Native)
- Built ~5 screens: Dashboard, Session Control (with live BLE telemetry), Session History, Wallet, and Profile.
- Implemented BLE connection management using `react-native-ble-plx`.
- Implemented push notification handling with `expo-notifications` and Firebase FCM V1.

---

## 9. Tools, Technologies, APIs and Libraries Used

| Category | Tool / Technology |
|---|---|
| **Hardware** | ESP32-WROOM-32, PZEM-004T v3.0, 5V AC Relay Module |
| **Firmware Language** | C++ (Arduino Framework) |
| **Mobile Framework** | React Native (Expo SDK 52) |
| **Backend Language** | Node.js v22, Express.js |
| **Database** | PostgreSQL 15 |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs |
| **Push Notifications** | Firebase Cloud Messaging (FCM V1), expo-notifications |
| **BLE Library** | react-native-ble-plx |
| **Firmware Libraries** | ArduinoJson, LiquidCrystal_I2C, PZEM004Tv30, ESP32 BLE Arduino |
| **Build Tool** | EAS (Expo Application Services) |
| **Version Control** | Git |

---

## 10. Testing Strategies and Reports

### 10.1 Hardware Testing
- Verified relay triggers correctly on `START`/`STOP`/`ESTOP` commands.
- Tested power-cut recovery: pulled the power plug mid-session and verified the session resumed correctly on boot.
- Load tested with high-draw appliances (electric iron ~1500W) to verify PZEM accuracy.

### 10.2 Backend API Testing
- Manually tested all API endpoints using Postman.
- Verified wallet balance deductions are mathematically correct after split billing.
- Verified that `CHECK` constraints on the database correctly reject negative kWh values.

### 10.3 Integration Testing (End-to-End)
- Ran full session flows: Book → BLE Start → Live Telemetry → Auto-finish → Auto-Sync → Wallet Deduction.
- Tested E-Stop flow: Button press → Relay off → FINISHED telemetry → App sync → Wallet settled.
- Tested roommate invite flow: Invite → FCM Push → Accept → Join → Time-based split on settlement.

---

## 11. Innovative Contribution
- **Offline-First BLE Architecture for IoT billing:** Using the student's phone as a "secure bridge" between offline hardware and cloud backend is an innovative approach not commonly seen in IoT billing systems.
- **NVS-based Power-Cut Recovery for financial data:** Persisting billing state to non-volatile flash memory every 60 seconds ensures zero financial data loss during power outages.
- **Time-Proportional Split Billing Algorithm:** Dynamic cost-splitting based on exact second-level participation time, not a simple equal split.

---

## 12. Lessons Learnt
- **System Design before coding matters:** Designing the 3-tier offline-first architecture upfront prevented many potential edge cases.
- **Never trust the client:** All financial calculations and validations are done on the server side, never on the mobile app.
- **Race conditions are real:** Learned to use PostgreSQL ACID transactions and row-level locks to solve real-world concurrency bugs.
- **Edge hardware is unpredictable:** Learned about power-cut scenarios, BLE connection drops, and sensor noise (PZEM NaN readings) that are never covered in textbooks.
- **Security as a first-class citizen:** Financial systems require thinking like an attacker. Fixed multiple loopholes such as leaving a room during an active session to avoid billing.

---

## 13. Future Scope
- Web-based Admin Dashboard for hostel management analytics.
- iOS (Apple) version of the mobile app.
- Actionable push notification buttons (Accept/Reject session without opening app).

---

## 14. References
- React Native Documentation: https://reactnative.dev/docs/getting-started
- Express.js Documentation: https://expressjs.com/
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Espressif ESP32 Datasheet & Arduino BLE Library
- PZEM-004T v3.0 Datasheet
- IEEE Papers on Smart Metering (search IEEE Xplore for "IoT-based energy metering", cite 2-3 papers)
