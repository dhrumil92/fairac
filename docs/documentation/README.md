# FairAC: A Decentralized AC Billing & Management Ecosystem

FairAC is a full-stack IoT and Software ecosystem designed to solve the problem of unfair electricity billing in university hostels. It integrates custom IoT hardware (ESP32), a cross-platform Mobile App (React Native), a web-based Admin Dashboard (React), and a robust backend (Node.js/PostgreSQL) to provide transparent, strictly monitored, and fair split-billing for air conditioning usage.

## 🚀 Key Features

*   **Pure Offline Architecture (BLE):** The ESP32 hardware operates completely offline using Bluetooth Low Energy (BLE), ensuring students can start and stop the AC even if the hostel Wi-Fi is down.
*   **Decentralized Syncing:** The mobile app acts as the bridge. It reads telemetry data from the offline hardware and syncs the billing session to the cloud backend.
*   **Real-time Power Monitoring:** Hardware integrates with the PZEM-004T sensor to track voltage, current, power, and exact kWh consumption.
*   **Transaction-Safe Billing:** Built with strict PostgreSQL database constraints, locking, and rollback mechanisms to prevent double-spending and ensure absolute financial accuracy.
*   **Power-Cut Recovery:** The hardware saves session state to Non-Volatile Storage (NVS). If a power outage occurs, the hardware instantly resumes the session and countdown upon boot.
*   **Push Notifications:** Firebase Cloud Messaging (FCM) alerts roommates instantly when a session is initiated, allowing them to accept invites and split the bill.

## 🏗️ Technology Stack

*   **Hardware / IoT:** ESP32 (C++), PZEM-004T v3.0, 5V Relay, Bluetooth Low Energy (BLE)
*   **Mobile Application:** React Native (Expo), BLE PLX, Firebase Cloud Messaging
*   **Backend Server:** Node.js, Express, PostgreSQL, node-cron
*   **Web Dashboard:** React, HTML/CSS (Future Admin UI)

## 📂 Project Structure

*   `/backend` - Node.js API server and PostgreSQL database configurations.
*   `/mobileApp` - React Native application for students (Wallet, Room, Session Control).
*   `/webApp` - Web dashboard for Hostel Management.
*   `/iot` - C++ firmware for the ESP32 microcontroller (`esp32_ble.ino`).

## ⚙️ How it Works

1.  **Booking:** A student uses the mobile app to "Book" an AC session (duration or energy limit). Funds are temporarily held in their digital wallet.
2.  **Handshake:** The mobile app connects to the ESP32 via BLE and sends a `START` command with the session parameters.
3.  **Autonomous Execution:** The ESP32 triggers the AC relay and autonomously tracks kWh using the PZEM sensor.
4.  **Completion & Sync:** When the limit is reached (or the user hits the E-Stop), the ESP32 drops the relay and broadcasts a `FINISHED` state. The mobile app picks this up and syncs the final kWh data back to the server for exact billing.

## 🔒 Security & Edge Cases Handled

*   **Financial Deadlocks:** Fixed race conditions where users could leave a room just before a session started to avoid paying.
*   **Hardware Fault Tolerance:** The hardware utilizes debounce logic on the E-Stop and saves critical states to flash memory every 60 seconds to prevent data loss.
