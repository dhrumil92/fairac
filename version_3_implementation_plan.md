# FairAC Version 3.0 — The Universal Architecture Plan

> **Status:** Architecture Blueprint  
> **Concept:** A scalable, tiered hardware ecosystem supporting both **Offline BLE** (budget/retrofits) and **Online Ethernet/WiFi** (premium/institutional) environments simultaneously.

## 1. The Core Philosophy
FairAC is evolving from a single hardware product into an **Energy Management Ecosystem**. 

By maintaining support for both the **Legacy Online** architecture and the **Current Offline (BLE)** architecture, FairAC can be deployed in any environment. Crucially, **both architectures share the exact same Cloud Server Backend and PostgreSQL Database.** The API is designed to accept session data regardless of whether it was synced via a BLE smartphone payload or directly from an ESP32 over the internet.

---

## 2. The Three-Tier Hardware Lineup

### 2.1 FairAC "Micro" (1 Room / 1 Device)
**The Entry-Level Retrofit Solution**
- **Use Case:** Individual flats, small PGs, or buildings with completely decentralized electrical wiring.
- **Microcontroller:** 1× ESP32 (Standard)
- **Sensors:** 1× PZEM-004T (UART)
- **Control:** 1× Solid State Relay / Contactor
- **Connectivity:** Offline BLE (Primary)

### 2.2 FairAC "Duo" (2 Rooms / 1 Device)
**The Cost-Optimized Wall-Sharer**
- **Use Case:** Hostels where adjacent rooms share a common wall or electrical conduit.
- **Microcontroller:** 1× ESP32 (Standard)
- **Sensors:** 2× PZEM-004T (Utilizing the ESP32's two available hardware UART ports: `Serial1` and `Serial2`)
- **Control:** 2× Solid State Relays
- **Connectivity:** Offline BLE / WiFi

### 2.3 FairAC "Floor Hub" (10–15 Rooms / 1 Device)
**The Enterprise Centralized Panel**
- **Use Case:** New hostel constructions, hotels, or large commercial buildings where all room AC wiring routes back to a central Distribution Board (DB) on each floor.
- **Microcontroller:** 1× **WT32-ETH01** (ESP32 with built-in Ethernet for rock-solid reliability).
- **Sensors:** 10 to 15× **PZEM-016 (RS485 Modbus)**. All meters are daisy-chained on a single 2-wire bus. The ESP32 can poll all 15 meters in just 1.5 seconds.
- **Control:** 10 to 15× Contactors driven by an **MCP23017 I2C IO Expander** (which provides 16 output pins using only 2 pins on the ESP32).
- **Connectivity:** **Strictly Online (Ethernet)**. Real-time MQTT telemetry.

---

## 3. Floor Hub: Breadboard vs Custom PCB

When transitioning from the prototype phase to mass manufacturing the 15-room Hub, the design becomes significantly cleaner.

**The Breadboard Phase:**
During prototyping, you use off-the-shelf breakout modules (like an 8-channel blue relay board) connected by messy jumper wires.

**The Custom PCB Phase:**
When designing the final FairAC motherboard, you eliminate the jumper wires. You extract the individual components from the generic modules (Optocouplers, **ULN2803A Darlington Transistor Arrays**, and bare Solid State Relays) and solder them flat directly onto your custom green fiberglass board.

**Two-Stage Switching in the Hub:**
1. **The Brain:** WT32-ETH01 sends a tiny I2C data signal to the MCP23017 expander.
2. **The Buffer:** The expander triggers the ULN2803A chip, which allows a dedicated 5V power supply to activate the onboard Solid State Relay.
3. **The Heavy Lift:** The onboard relay sends 220V out of a green screw terminal directly into the coil of a massive Industrial Contactor on the DIN rail. 

> [!NOTE]
> The ESP32 does 0% of the heavy lifting. It only handles data logic, meaning it will never overheat, even when switching 15 massive Air Conditioners simultaneously.

### PCB Concept Visualizations

**FairAC Hub (10 Room Configuration)**
![FairAC Hub 10 Rooms](C:/Users/dhrum/.gemini/antigravity-ide/brain/4ee4dcfb-4003-4498-b695-643142f1936c/fairac_hub_10_rooms_1785594506437.png)

**FairAC Hub (15 Room Configuration)**
![FairAC Hub 15 Rooms](C:/Users/dhrum/.gemini/antigravity-ide/brain/4ee4dcfb-4003-4498-b695-643142f1936c/fairac_hub_15_rooms_1785594533921.png)

**Complete Internal Panel Layout (PCB + DIN Rail)**
![FairAC Full System Mockup](C:/Users/dhrum/.gemini/antigravity-ide/brain/4ee4dcfb-4003-4498-b695-643142f1936c/fairac_full_system_mockup_1785595660144.png)


---

## 4. Disaster Recovery: LittleFS Flash Backup

If the hostel's internet router dies, the "Floor Hub" must not lose any billing data. To solve this, the WT32-ETH01 acts as a black box flight recorder using its onboard flash memory.

### How LittleFS Backup Works:
The WT32-ETH01 has 4MB of Flash Memory. We allocate 1.5MB of this to **LittleFS** (a built-in File System).

1. **Internet Goes Down:** The ESP32 detects the server is unreachable. It keeps all active AC sessions running normally.
2. **Local Logging:** Every 5 minutes, the ESP32 opens a hidden text file (e.g., `/room101.csv`) and appends the latest reading:
   ```csv
   1722515000,0.080
   1722515300,0.160
   ```
3. **Memory Capacity:** 
   - 1 reading = ~20 bytes.
   - 1 room (24 hours) = 288 readings = 5.7 KB.
   - 15 rooms (24 hours) = 86 KB per day.
   - **Total Capacity:** With 1.5MB (1,500 KB) of free space, the Hub can survive an internet outage for **17 consecutive days** with 15 ACs running 24/7 without running out of memory.
4. **Auto-Recovery:** The millisecond the internet comes back online, the ESP32 reads the `.csv` files, uploads the missing telemetry rows to the backend Node.js server, and deletes the files to free up space. No billing data is ever lost.
