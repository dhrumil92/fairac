# FairAC Phase 4: Mobile App & BLE Offline Architecture

## 1. Overview
Phase 4 transitions FairAC from a WiFi-dependent web application to a robust, offline-capable Mobile Application. The mobile app will communicate directly with the ESP32 hardware via Bluetooth Low Energy (BLE) and use cellular data (4G/5G) to sync with the backend server.

## 2. Core Questions & Answers

### Do we need to recreate the backend/server?
**NO.** We will reuse 90% of the existing Node.js backend. The databases for users, hostels, rooms, and wallets remain completely unchanged. We only need to add a few new API endpoints (e.g., `/sessions/ble/start` and `/sessions/ble/sync`) to handle the "estimated wallet locks" and "deferred offline receipts."

### Do we need to redesign the SRS (Requirements)?
**Partially.** We don't need to throw away the old SRS, but we must add a new section called **"Offline & BLE Architecture."** This section will document the new Hybrid Sync logic (Mobile App acting as the bridge between the ESP32 and the Server) and the Wallet Pre-Authorization (locking funds).

### Can you build the mobile application?
**YES.** I am fully capable of writing the entire mobile application using **React Native (Expo)**. I can guide you step-by-step through setting up the mobile development environment on your computer.

### Should we build Android first, or iPhone?
**BOTH SIMULTANEOUSLY!** Because we are using React Native, we write the code exactly once in JavaScript. The React Native engine automatically translates that single codebase into a native `.apk` for Android and a native `.ipa` for iOS. 

---

## 3. Implementation Plan

### Step 1: Backend API Upgrades
- Add Wallet "Lock/Reserve" logic so a student's balance is safely frozen during a session.
- Add an endpoint to receive cryptographically signed BLE receipts from the mobile app to finalize offline sessions.

### Step 2: ESP32 Firmware Upgrades (BLE)
- Strip out the heavy WiFi and HTTP libraries from the ESP32.
- Implement BLE Server capabilities on the ESP32.
- Program the ESP32 to securely hold offline session ledgers in its flash memory until a phone connects to grab them.

### Step 3: Mobile App Initialization (React Native)
- Initialize a new Expo project.
- Migrate the existing React Web UI components (TailwindCSS/CSS) into React Native `<View>` components.
- Integrate `react-native-ble-plx` for Bluetooth communication.

### Step 4: The Hybrid Sync Engine
- Build the core logic where the app sends a "Start" command to the ESP32 via BLE, while simultaneously sending an HTTP "Start" request to the Node.js server via 4G.
- Build the background synchronization tool to silently upload old receipts when the student enters their room.
