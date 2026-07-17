# FairAC Custom PCB Specifications

Below are the industry-standard visual mockups and physical dimensions for the custom printed circuit boards (PCBs) required for the FairAC hardware nodes. These diagrams and specifications can be included directly in your funding proposal to demonstrate the physical architecture and readiness for mass manufacturing.

## 1. Single-Room IoT Node

This board is designed to handle a single hostel room. It contains the central logic controller alongside a single set of monitoring and switching hardware.

![Single Room PCB Design](/C:/Users/dhrum/.gemini/antigravity-ide/brain/4ee4dcfb-4003-4498-b695-643142f1936c/pcb_single_room_1784282704183.png)

### Bill of Materials (BOM)
- **1x ESP32 Microcontroller:** The core logic and WiFi/Bluetooth communication brain.
- **1x PZEM-004T:** Non-invasive AC voltage, current, and energy (kWh) monitor.
- **1x Solid State / 5V Relay Module:** Low-voltage trigger for the main contactor.
- **1x OLED Display (0.96"):** For local status readout and error codes.
- **1x E-Stop Terminal:** Header for the physical red Emergency Stop button.
- **Status LEDs:** Network, Power, and Active Session indicators.

### Physical Dimensions
- **Overall PCB Size:** `100 mm x 120 mm` (10 cm x 12 cm)
- **Contactor Empty Space Reserve:** `45 mm x 65 mm` (Designed to accommodate a standard PCB-mounted 30A heavy-duty contactor or screw terminal blocks for an external DIN-rail contactor).

---

## 2. Dual-Room (Shared) IoT Node

To significantly reduce manufacturing costs and maximize the ESP32's processing capabilities, this board is designed to handle two adjacent rooms simultaneously. It features a symmetrical layout utilizing a single brain to control two independent AC units.

![Two Room PCB Design](/C:/Users/dhrum/.gemini/antigravity-ide/brain/4ee4dcfb-4003-4498-b695-643142f1936c/pcb_two_room_1784282724283.png)

### Bill of Materials (BOM)
- **1x ESP32 Microcontroller:** Dual-core processor handling both rooms concurrently.
- **2x PZEM-004T:** Independent energy monitoring for Room A and Room B.
- **2x Solid State / 5V Relay Modules:** Independent triggers.
- **2x OLED Displays (0.96"):** Dedicated readouts for each room.
- **2x E-Stop Terminals:** Dedicated safety shutdowns.
- **Status LEDs:** Mirrored indicators for both AC units.

### Physical Dimensions
- **Overall PCB Size:** `150 mm x 180 mm` (15 cm x 18 cm)
- **Contactor Empty Space Reserve (x2):** `45 mm x 65 mm` (Two distinct spaces routed for high-voltage isolation to prevent cross-interference between Room A and Room B AC loads).

> [!TIP]
> **Funding Pitch Note:** Highlighting the **Dual-Room Node** in your pitch is highly recommended. It cuts the microcontroller cost, WiFi connection overhead, and PCB manufacturing base cost by nearly 50%, demonstrating excellent scalability and financial efficiency to investors.
