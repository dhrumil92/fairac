# FairAC Hardware Bill of Materials (BOM)

Based on the `FairAC_Hardware_Requirements_Specification_v1.2`, here is the complete list of components you need to buy for the final product prototype. 

> [!NOTE]
> We are using the **ESP32 DevKit V1** instead of the C3 SuperMini for the final product, as the C3 does not have enough GPIO pins to support all the peripherals required in your spec document.

## 1. Core Processing & Connectivity
- **Microcontroller:** ESP32 DevKit V1 (ESP-WROOM-32 30-pin or 38-pin version)

## 2. Power Measurement (IoT)
- **Energy Meter Module:** PZEM-004T V3.0 (AC Version, 100A with split-core or solid-core CT coil)
  *(This connects via Serial RX/TX to the ESP32 and measures Voltage, Current, Power, Energy, Frequency, and Power Factor with 99% accuracy).*

## 3. High Voltage AC Switching
- **AC Contactor:** 25A 2-Pole AC Contactor (Coil Voltage: 220V/230V AC)
  *(Recommended Brands: Schneider Electric, L&T, Siemens, or Chint for budget)*
- **Driver Relay:** 5V 1-Channel Opto-isolated Relay Module (High/Low Level Trigger)
  *(This 5V relay is driven by the ESP32, which in turn switches the 220V coil of the heavy-duty 25A AC Contactor).*

## 4. Power Supply & Protection
- **Power Supply (SMPS):** 5V 2A SMPS (Switch Mode Power Supply) module (PCB mount or enclosed)
  *(Required to step down 220V AC to a stable 5V DC for the ESP32 and the 5V Driver Relay).*
- **Circuit Breaker:** 16A or 20A MCB (Miniature Circuit Breaker)
  *(For short-circuit and overload protection of the AC unit).*

## 5. User Interface (Display & Indicators)
- **Display:** 16x2 LCD Display with I2C Backpack Module
  *(The I2C backpack is critical, as it reduces the required ESP32 pins from 6 down to just 2: SDA and SCL).*
- **Push Buttons:**
  - 1x Momentary Push Button (Normally Open) - For System Reset
  - 1x Heavy Duty Mushroom Emergency Stop Button (Normally Closed) - For hardware manual override/safety.
- **LED Indicators (5mm or Panel Mount):**
  - 1x Green LED (System Power Status)
  - 1x Blue LED (WiFi Connection Status)
  - 1x Yellow LED (Active Session Indicator)
  - 1x Red LED (Fault/Error Indicator)
- **Resistors:** 220 ohm or 330 ohm resistors (Qty: 4)
  *(Required for the LEDs to prevent them from drawing too much current from the ESP32).*

## 6. Enclosure & Wiring
- **Enclosure:** PVC/ABS Electrical Distribution Box (Minimum 8-Way or 10-Way size)
  *(Needs to be large enough to safely house the MCB, the Contactor, the SMPS, and the ESP32 circuitry).*
- **Wiring:**
  - Heavy Duty AC Wire (2.5 sq mm or 4.0 sq mm) for the AC Load circuit.
  - Jumper wires / thin gauge wires for 5V/3.3V logic connections.
- **PCB:** A blank zero-PCB (perfboard) or custom printed PCB to neatly solder the ESP32, Relay Module, and SMPS together.

---

### Total GPIO Pins Required on ESP32:
- PZEM-004T RX
- PZEM-004T TX
- LCD I2C SDA
- LCD I2C SCL
- Contactor Relay Pin
- Reset Button Pin
- Emergency Stop Pin
- WiFi LED Pin
- Session LED Pin
- Fault LED Pin
*(Total: 10 Pins. The ESP32 DevKit V1 provides plenty of pins, leaving room for future additions like a Temperature Sensor or Buzzer).*
