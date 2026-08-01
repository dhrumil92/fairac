# FairAC Version 3.0 — The Universal Hardware Architecture

> **Status:** Architecture Blueprint  
> **Concept:** A scalable, tiered hardware ecosystem supporting both **Offline BLE** (budget/retrofits) and **Online WiFi** (premium/institutional) environments simultaneously.

## 1. The Core Philosophy
FairAC is evolving from a single hardware product into an **Energy Management Ecosystem**. 

By maintaining support for both the **Legacy Online (WiFi)** architecture and the **Current Offline (BLE)** architecture, FairAC can be deployed in any environment:
- **Offline BLE Mode:** For standard PGs and older hostels where WiFi is patchy or non-existent. The smartphone acts as the data bridge.
- **Online WiFi/Ethernet Mode:** For modern institutions, hotels, and premium hostels where reliable network infrastructure exists. Allows for real-time admin monitoring and remote control.

Crucially, **both architectures share the exact same Cloud Server Backend and PostgreSQL Database.** The API is designed to accept session data regardless of whether it was synced via a BLE smartphone payload or directly from an ESP32 over WiFi.

---

## 2. The Three-Tier Hardware Lineup

To cover every possible installation scenario, the hardware is split into three distinct models:

### 2.1 FairAC "Micro" (1 Room / 1 Device)
**The Entry-Level Retrofit Solution**
- **Use Case:** Individual flats, small PGs, or buildings with completely decentralized electrical wiring.
- **Microcontroller:** 1× ESP32 (Standard)
- **Sensors:** 1× PZEM-004T (UART)
- **Control:** 1× Solid State Relay / Contactor
- **Connectivity:** Offline BLE (Primary) / WiFi (Optional Fallback)
- **Advantage:** Total isolation. A hardware failure only affects a single room. Easiest to install for aftermarket clients.

### 2.2 FairAC "Duo" (2 Rooms / 1 Device)
**The Cost-Optimized Wall-Sharer**
- **Use Case:** Hostels where adjacent rooms share a common wall or electrical conduit.
- **Microcontroller:** 1× ESP32 (Standard)
- **Sensors:** 2× PZEM-004T (Utilizing the ESP32's two available hardware UART ports: `Serial1` and `Serial2`)
- **Control:** 2× Solid State Relays
- **Connectivity:** Offline BLE / WiFi
- **Advantage:** Cuts the cost of the microcontroller, power supply (HLK-PM01), and custom PCB housing by 50% per room, with minimal changes to firmware logic.

### 2.3 FairAC "Floor Hub" (10–15 Rooms / 1 Device)
**The Enterprise Centralized Panel**
- **Use Case:** New hostel constructions, hotels, or large commercial buildings where all room AC wiring routes back to a central Distribution Board (DB) on each floor.
- **Microcontroller:** 1× ESP32 with built-in Ethernet (e.g., WT32-ETH01)
- **Sensors:** 10 to 15× **PZEM-016 (RS485 Modbus)**. All meters are daisy-chained on a single 2-wire bus, eliminating UART port limits.
- **Control:** 10 to 15× Contactors driven by an **I2C IO Expander** (e.g., MCP23017), which provides 16 output pins using only 2 pins (SDA/SCL) on the ESP32.
- **Connectivity:** **Strictly Online (Ethernet/WiFi)**. Real-time MQTT telemetry.
- **Advantage:** Massive cost reduction at scale. Rock-solid network reliability (no weak WiFi in rooms). Centralized maintenance for electricians. Capping at 15 rooms prevents a single point of failure from taking down the entire building.

---

## 3. Server Architecture Convergence

How does a single Node.js backend support both Offline BLE phones and Online WiFi ESP32s?

### 3.1 The Unified Billing Engine
The core database tables (`sessions`, `wallets`, `consumption_records`) do not care how the data arrives.

- **Offline BLE Route:** The ESP32 tracks the kWh. When the session ends, the ESP32 waits. When the student opens the app, the phone downloads the final kWh via BLE and POSTs it to `/api/v1/sessions/sync`.
- **Online WiFi Route:** The ESP32 tracks the kWh. When the session ends (or reaches a limit), the ESP32 directly POSTs the final kWh to the exact same `/api/v1/sessions/sync` endpoint (using a device-specific JWT token).

### 3.2 Real-Time Monitoring (Online Mode)
For the "Floor Hub" or WiFi-connected "Micro" units, the ESP32 sends a heartbeat every 5 seconds.
- **Endpoint:** `POST /api/v1/iot/heartbeat`
- **Data:** `power_watts`, `voltage`, `current`, `session_kwh`
- **Admin Benefit:** The React Admin Dashboard can view live power consumption across the entire hostel in real-time, which is impossible in the purely offline BLE architecture.

---

## 4. Hardware Requirements Checklist

### For the "Floor Hub" PCB Design:
- [ ] **WT32-ETH01 Module:** Replaces standard ESP32 for wired LAN reliability.
- [ ] **RS485 to TTL Module (MAX485):** To interface the ESP32 with the Modbus network of PZEM-016s.
- [ ] **MCP23017 I2C Expander:** To provide 16 GPIO pins for driving the relay optocouplers.
- [ ] **ULN2803A Darlington Arrays:** To safely drive the relay coils from the MCP23017 pins.
- [ ] **Heavy Duty Terminal Blocks:** For the centralized 220V AC wiring.
- [ ] **DIN Rail Enclosure:** The PCB must be designed to snap into a standard electrical breaker box.

### For Firmware Development:
- [ ] **ModbusMaster Library:** Integration for reading multiple PZEM-016s in a round-robin loop.
- [ ] **Adafruit_MCP23X17 Library:** Integration for controlling the expanded relay pins.
- [ ] **Device Authentication:** Implement JWT generation or static API keys on the ESP32 so it can securely POST data directly to the Cloud Backend without a smartphone.
