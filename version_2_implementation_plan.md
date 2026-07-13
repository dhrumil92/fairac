# FairAC: Version 2.0 Architectural Implementation Plan

*This document outlines the advanced architectural upgrades planned for FairAC Version 2.0. These upgrades address extreme edge-cases discovered during Version 1.0 testing, focusing on strict financial fairness, mass-manufacturing cost reduction, and distributed system data integrity.*

---

## 1. Hardware Consolidation: Dual-Room Controller

### 1.1 Objective
Reduce the Bill of Materials (BOM) cost by ~50% per room by transitioning from single-room controllers to a dual-room shared controller.

### 1.2 Implementation Details
*   **Custom Unified PCB:** Move away from breadboard modules. Design a single PCB integrating the ESP32, 5V Switch Mode Power Supply (SMPS), two 5V Relays, and two PZEM-004T IC circuits.
*   **Microcontroller Selection:** Upgrade to the **ESP32-WROOM-32UE (Eco V3)**. 
    *   *Why:* Contains silicon bug fixes, better power efficiency, and critically uses a **U.FL (IPEX) connector** for an external antenna instead of a weak PCB trace antenna. This guarantees Bluetooth penetration through the physical wall dividing the two rooms.
*   **UART Utilization:** The ESP32 contains three hardware serial ports. `Serial0` is reserved for flashing/USB. `Serial1` will connect to PZEM A, and `Serial2` will connect to PZEM B, allowing simultaneous, non-blocking energy telemetry for both rooms.
*   **UX (User Experience):** Integrate two buzzers with distinct frequencies (e.g., High-pitch for Room A, Low-pitch for Room B) so students can audibly distinguish which AC unit received a command.

---

## 2. Advanced Billing: Delta-Billing (The Calculus Approach)

### 2.1 The Variable Load Problem
Version 1.0 utilizes *Time-Proportional Billing*. If Student A runs the AC at 26°C (low power) and Student B later joins and runs it at 16°C (high power), the total session cost is split purely by time. This unfairly penalizes Student A, who subsidizes Student B's heavy power draw.

### 2.2 The Solution
Migrate to **Delta-Billing** (calculating the area under the curve). We must record the exact `session_kwh` at the exact millisecond the participant list changes (someone joins or leaves). 

*   **Example Flow:**
    *   T=0: A starts session. 
    *   T=60: B joins. The exact kWh is recorded (e.g., 1.4 kWh). The backend immediately settles Student A's wallet for 1.4 kWh.
    *   T=120: Session ends at 4.0 kWh. The delta (4.0 - 1.4 = 2.6 kWh) is billed to Student B. Perfect fairness is achieved regardless of thermostat temperature.

### 2.3 The 24-Hour Maximum Booking Limit
To prevent abuse, accidental indefinite bookings, and memory overflow on the hardware, the system will enforce a hard **24-hour limit** on any single AC session. 
*   **Backend Validation:** The Node.js API will reject any booking request where the duration exceeds 1440 minutes.
*   **Hardware Safety:** The ESP32 firmware will automatically enforce a `STOP` command if any session timer reaches 24 hours, regardless of remaining wallet balance.

---

## 3. Hardware Safety & AC Protection

### 3.1 The Reality of Hard Power Cuts
In Version 2.0, the hardware will be mounted entirely outside the rooms, making IR Blasters and Buzzers physically useless. Therefore, the system will rely on **Hard Power Cuts** (dropping the contactor instantly) when a session ends.
*   **Is this safe?** Yes. Modern Inverter ACs (especially in India) are heavily over-engineered with internal discharge capacitors to survive sudden grid power failures. Electrically, dropping a contactor is indistinguishable from a standard grid outage. Commercial heavy-duty IoT switches (like Sonoff or Tuya) operate on this exact same hard-cut principle.

### 3.2 Compressor Short-Cycle Protection (The True Safeguard)
While turning an AC off abruptly is safe, **turning it back on too quickly** is what destroys compressors. When powered off, high-pressure refrigerant remains trapped. Attempting a restart immediately causes the motor to stall (Locked Rotor) and burn out.
*   **Backend Lockout (Already Implemented):** To guarantee 100% safety, the system enforces a strict **3-minute lockout** after any power-off event. This is calculated purely on the Node.js backend. By checking the end time of the last session in the database, the API will reject any new "Start Session" requests if 3 minutes have not passed, returning a 403 error: *"Compressor cooling down to prevent damage."* This completely offloads the logic from the ESP32 and protects the hardware from short-cycling.

---

## 4. The "Data Logger" Architecture (Solving the BLE Monopoly)

### 3.1 The BLE Constraint
By default, when a mobile phone connects to an ESP32 via BLE, the ESP32 stops broadcasting, preventing a second student from connecting to join the session. 

### 3.2 The Flash-Memory Solution
Transform the ESP32 from a "real-time streamer" into an **Offline Data Logger**.
*   Every 5 minutes, the ESP32 writes a new row to a 2D Array in its internal LittleFS/SPIFFS flash memory. 
*   **Data Structure:** `[Unix_Timestamp, current_session_kwh]`
*   **Memory Footprint for TWO Rooms:** Each row requires exactly 8 bytes (4 bytes for Timestamp `uint32_t`, 4 bytes for Energy `float`). Logging every 5 minutes requires 288 rows per day. 
    *   Room A (24 hours) = 288 rows × 8 bytes = **2.3 KB**
    *   Room B (24 hours) = 288 rows × 8 bytes = **2.3 KB**
    *   **Total Memory Needed:** **4.6 KB**. 
    *   *Conclusion:* The ESP32 has over 1,500 KB (1.5 MB) of available Flash memory. It can effortlessly store data for both rooms simultaneously for several months before needing to wipe the memory.

### 3.3 How it works in practice
1. Student B walks into a room where Student A started the AC hours ago. 
2. Student B taps "Join" on the app. The server records the exact Timestamp of the join request.
3. Student B does *not* need to connect to the hardware to read the data in real-time.
4. When the session finally ends (or when a phone eventually syncs), the server receives the massive 2D array of data. It looks up the exact 5-minute block corresponding to Student B's join timestamp and calculates the exact financial delta retroactively.

---

## 4. Zero Data-Loss: The Two-Step ACK Pattern

### 4.1 The Vulnerability
If the mobile app downloads the 2D array from the ESP32 and immediately commands the ESP32 to erase its memory, data loss will occur if the student's 4G/Wi-Fi connection drops before the app can forward the data to the Node.js backend.

### 4.2 The Implementation
Implement an enterprise-grade **Two-Step Acknowledgment (ACK)** sync pipeline:
1. **Pull:** Mobile app connects via BLE and downloads the array. (ESP32 retains data).
2. **Push:** Mobile app sends the payload to the Node.js backend.
3. **Commit:** Node.js executes an ACID transaction to securely save the array into PostgreSQL, then responds with HTTP `200 OK`.
4. **ACK:** The mobile app receives the `200 OK` and immediately sends a BLE command (`CLEAR_LOG_ACK`) to the ESP32.
5. **Wipe:** Only upon receiving the explicit ACK does the ESP32 format the file system, ensuring zero financial data is ever lost in transit.
