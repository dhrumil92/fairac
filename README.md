# FairAC: Decentralized IoT AC Billing & Management Ecosystem

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=flat&logo=espressif&logoColor=white)
![BLE](https://img.shields.io/badge/Bluetooth_LE-0082FC?style=flat&logo=bluetooth&logoColor=white)

**FairAC** is a full-stack, hardware-integrated ecosystem designed to solve the problem of unfair electricity billing in shared university accommodations. By combining a custom IoT edge device (ESP32) with a cross-platform React Native application and a transaction-safe Node.js/PostgreSQL backend, FairAC enables highly precise, pay-as-you-go split billing for high-power air conditioning units.

---

## 📖 The Problem vs. The Solution

**The Problem:** In shared dormitories, electricity bills are traditionally split equally. If Roommate A runs the AC all day while Roommate B is in class, Roommate B is unfairly forced to subsidize the cost. This leads to friction, lack of transparency, and massive energy wastage.

**The Solution:** FairAC introduces a decentralized, session-based smart billing system.
1. Students pre-load funds into a digital wallet on their mobile app.
2. They "Book" an AC session based on Duration, kWh Units, or Monetary Amount.
3. The mobile app connects to the Smart AC Controller (ESP32) via offline Bluetooth (BLE) to start the session.
4. The hardware autonomously tracks energy consumption using a PZEM-004T sensor.
5. Roommates receive push notifications and can instantly join the active session, dynamically splitting the cost in real-time based on their exact seconds of participation.

---

## ✨ Key Technical Achievements

*   **Offline-First Edge Architecture:** University Wi-Fi is notoriously unstable. FairAC bypasses this entirely by utilizing Bluetooth Low Energy (BLE). The ESP32 operates 100% offline, and the mobile app acts as a secure cryptographic bridge syncing telemetry data to the cloud.
*   **Hardware Fault Tolerance & State Recovery:** To prevent financial data loss during physical power outages, the ESP32 firmware writes the current `session_kwh` to its Non-Volatile Storage (NVS) flash memory every 60 seconds. Upon boot, it autonomously resumes the active session.
*   **Transaction-Safe Concurrency:** The backend employs strict PostgreSQL ACID transactions and `SELECT FOR UPDATE` row-level locking to prevent financial race conditions, double-spending, and deadlocks when multiple roommates interact with the system simultaneously.
*   **Time-Proportional Split Billing Algorithms:** Cost is not split equally; it is split dynamically based on the exact millisecond a participant joined and left the active session.

---

## 🏗️ Technology Stack

### 📱 Application Layer (Mobile App)
- **Framework:** React Native (Expo SDK)
- **State & UI:** React Hooks, Custom Glassmorphism UI
- **Hardware Integration:** `react-native-ble-plx` for Bluetooth GATT communication
- **Push Notifications:** Firebase Cloud Messaging (FCM V1) via `expo-notifications`

### ⚙️ Backend Layer (Cloud)
- **Runtime:** Node.js (v22), Express.js
- **Database:** PostgreSQL (Highly normalized schema with `CHECK` constraints)
- **Security:** JWT stateless authentication, bcrypt password hashing
- **Automation:** `node-cron` for asynchronous task management

### 🔌 Edge Layer (IoT Hardware)
- **Microcontroller:** ESP32-WROOM-32 (C++ / Arduino Framework)
- **Sensors:** PZEM-004T v3.0 (Voltage, Current, Power, Energy)
- **Actuators:** 5V AC Relay Module, Hardware Emergency Stop Button
- **Display:** 16x2 I2C LCD Display

---

## 📂 Project Structure

```text
FairAC/
├── backend/            # Node.js REST API, Database Schemas, Services, & Controllers
├── mobileApp/          # React Native application source code
├── iot/                # C++ firmware for the ESP32 Edge controller
│   ├── esp32_ble/      # Production offline-first BLE firmware
│   └── connect_ble/    # Diagnostics and testing firmware
└── docs/               # System Architecture, IEEE Reports, and Presentation decks
```

---

## 🚀 Getting Started

### 1. Hardware Setup (ESP32)
1. Wire the PZEM-004T RX/TX pins to the ESP32 `Serial2` hardware UART pins.
2. Connect the 5V Relay input to the designated GPIO pin.
3. Flash the `iot/esp32_ble/esp32_ble.ino` firmware using the Arduino IDE.

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=fairac_db
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json
```
Initialize the database and start the server:
```bash
node database/schema.sql
npm run dev
```

### 2.5 Cloud Deployment (Docker)
For deploying to a cloud VM (e.g., Oracle Cloud, AWS), FairAC includes a fully configured Docker setup that automatically provisions both the Node.js backend and a secure PostgreSQL container.
```bash
cd backend
# Edit the .env file with your production secrets
docker-compose up -d
```
*Note: The `docker-compose.yml` automatically locks down the database port so it is not exposed to the public internet.*

### 3. Mobile App Setup
```bash
cd mobileApp/application
npm install
```
Update the `baseURL` in `src/services/api.js` to point to your local backend IP address, then start the Expo server:
```bash
npx expo start
```
*Note: To test BLE and Push Notifications, you must build a native APK using EAS (`eas build -p android --profile preview`) as these features do not work in Expo Go.*

---

## 🔮 Future Roadmap

- **Version 2.0 Hardware:** Migrate from breadboard modules to a single custom-designed PCB containing the ESP32, SMPS, and dual PZEM/Relays to govern two adjacent rooms simultaneously, drastically reducing manufacturing BOM costs.
- **Actionable Notifications:** Allow roommates to accept/reject session split invites directly from their lock screen without opening the app.
- **iOS Deployment:** Expand the React Native build pipeline to support Apple App Store deployment.

---
*Designed and built with a focus on engineering excellence, hardware reliability, and mathematical fairness.*
