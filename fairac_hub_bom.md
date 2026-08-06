# FairAC "Floor Hub" (15-Room) — The Ultimate Master Shopping List

> **Version:** 4.0 (Includes IR Soft-Shutdown, Latching Relays, and Custom PCB)  
> **Status:** Final Manufacturing Bill of Materials (BOM)

This is your exact shopping list. It includes every single microchip, passive component, socket, and heavy power module required to build one fully functional 15-Room Hub from scratch.

---

## 1. The Bare Integrated Circuits (ICs)
*These are the brains and drivers that you will push into the black plastic sockets on your custom PCB.*

*   **1× WT32-ETH01:** The main ESP32 brain with Ethernet. (This comes as a module, not a bare chip).
*   **1× DS3231 RTC Module:** The highly accurate Real-Time Clock with a battery holder. (Buy the module, not the bare chip, because soldering a coin-cell battery holder is annoying).
*   **1× LM2596 Buck Converter Module:** To step down the 12V power supply to 3.3V and 5V.
*   **2× MCP23017 (DIP-28):** The 16-channel I2C Port Expanders.
*   **1× MAX485 (DIP-8):** The RS485 communication chip. (Buy the bare chip, not the module).
*   **8× L293D (DIP-16):** Dual H-Bridge Motor Drivers. *(Note: We use the L293D here because it comes in a convenient DIP package, requires no heatsink, and easily handles the tiny 12V pulse required by latching relays. One L293D drives two relays).*
*   **2× ULN2803A (DIP-18):** Darlington Transistor Arrays to amplify power for the IR LEDs.
*   **15× PC817 (DIP-4):** Optocouplers to electrically isolate your 3.3V brain from the 12V relays.

---

## 2. IC Sockets & Headers
*You will solder these to your green PCB permanently. You will plug the chips from Section 1 into these.*

*   **2× 28-Pin Narrow DIP IC Sockets** (For the MCP23017s).
*   **8× 16-Pin DIP IC Sockets** (For the L293D H-Bridges).
*   **2× 18-Pin DIP IC Sockets** (For the ULN2803As).
*   **1× 8-Pin DIP IC Socket** (For the MAX485).
*   **15× 4-Pin DIP IC Sockets** (For the PC817 Optocouplers).
*   **4× Strips of 40-Pin Female Headers (2.54mm pitch):** You will cut these strips to size and solder them to the board to create plug-in slots for the WT32-ETH01, the RTC module, and the LM2596 module.

---

## 3. Passive Components (The Pennies)
*The tiny support components you will solder directly to the PCB.*

**For the I2C Bus & MCP23017s:**
*   **2× 4.7kΩ Resistors:** Pull-up resistors for the I2C SDA and SCL data lines.
*   **2× 10kΩ Resistors:** To tie the RESET pins of the two MCP23017s to 3.3V.
*   **2× 0.1µF (100nF) Ceramic Capacitors:** Decoupling capacitors placed next to the VDD pins of the two MCP23017s for power stability.

**For the MAX485 (RS485 Protection):**
*   **1× 120Ω Resistor:** A termination resistor placed across the A and B lines of the MAX485 to prevent signal echoes.
*   **1× PESD15VL2BT (or any RS485 TVS Diode):** A Transient Voltage Suppression diode placed across the A and B lines to protect the chip from lightning/surge noise. 
*   **1× 0.1µF (100nF) Ceramic Capacitor:** Decoupling capacitor for the MAX485 VCC pin.

**For the L293D / PC817 Optocouplers:**
*   **15× 1kΩ Resistors:** To safely limit the current going from the ESP32/MCP23017 into the LED side of the PC817 optocouplers.

---

## 4. The Heavy DIN-Rail Components (Inside the Metal Box)
*These parts deal with deadly 220V AC and mount to the metal rail, separate from your delicate PCB.*

*   **15× 80A or 100A Magnetic Latching Relays:** (Must have heavy screw or spade terminals).
*   **15× PZEM-016 (RS485 Modbus):** The digital energy meters.
*   **1× Mean Well HDR-30-12 (12V, 2.5A):** Industrial DIN-rail power supply.
*   **1× Weatherproof / Flame Retardant Distribution Box:** Large enough to hold all 15 relays, 15 PZEMs, and your custom PCB.

**The Relay Protection Snubbers (Wired directly to the relays):**
*   **15× 100Ω (5-Watt) Wirewound Resistors**
*   **15× 0.1µF (275VAC X2) Polypropylene Film Capacitors**

---

## 5. Version 4.0 End-Points (Inside the Student Rooms)
*The physical wiring for the IR Soft-Shutdown.*

*   **15× 940nm High-Power Infrared LEDs** (e.g., TSAL6200).
*   **15× Tiny 3D-Printed Plastic Domes** (To hide the LED on the wall/ceiling).
*   **1× Roll of Cat5e / Cat6 Ethernet Cable** (To run the physical wire from the Hub into the 15 rooms).
