# ESP32 AC Controller Project - Chat History

## 1. Safety of Turning Off AC via MCB / Direct Power Interruption
* **User:** What if I don't turn off the AC through remote, instead I directly drip the MCB every time?
* **Assistant:** Directly tripping the MCB to turn off your AC is **not recommended** and can damage your system over time. 
    * **Arcing and Wear:** MCBs are designed as safety switches for overcurrent protection, not daily operational switches. Constantly flipping them under heavy load causes electrical arcing, wearing down contacts.
    * **Component Strain:** Modern ACs use a controlled shutdown sequence to safely power down the compressor and electronic control boards. Abruptly cutting power starves the system of this sequence, potentially causing voltage spikes that can fry circuit boards (PCBs) or damage the compressor over time.
    * **Data Loss:** Some smart or inverter ACs save operational data, errors, or custom settings when turned off via the remote. Cutting power abruptly can reset or corrupt these settings.

## 2. Refining the Approach using a Contactor & ESP32
* **User:** Actually, I am making my college project which is used. I am using contactor. So, from mobile, if I turn off, then it power off and cuts the power supply to the AC. So, in that context, I am asking you.
* **Assistant:** Using a **contactor** controlled by your mobile project is much safer for your electrical panel than flipping an MCB, but it **still poses the same risks** to the AC itself. Cutting the main power supply abruptly still starves the AC of its proper shutdown sequence.
    * **Solution:** Mimic the remote control signal instead using an **IR transmitter (like an IR blaster LED)** or an API. Turn the AC off safely via IR first, then cut the main power after a delay.

* **User:** Yes, I am using ESP 32 with attached 5 volt relay, which is then connected to the contactor.
* **Assistant:** Since you have an ESP32, you can add a **delayed shutdown logic** in your code:
    1. **Mobile App: OFF** received via ESP32.
    2. **ESP32 sends IR "Power Off" command** to the AC.
    3. **Delay:** Wait 3 to 5 minutes for the AC compressor and fan to safely spin down.
    4. **ESP32 drops the 5V Relay**, opening the contactor to completely isolate main grid power.

* **User:** I am using Bluetooth for sending the command from mobile phone to ESP 32.
* **Assistant:** Using Bluetooth (Classic or BLE) is a solid, low-latency choice. You can structure your logic inside the Bluetooth command handler using the `IRremoteESP32` library:
    ```cpp
    if (incomingCommand == "TURN_OFF") {
        // 1. Send the IR turn-off signal to the AC
        irsend.sendNEC(AC_OFF_HEX_CODE, 32); 
        
        // 2. Wait for the AC compressor and fan to safely spin down
        // (Use non-blocking timers like millis() in production so BT doesn't disconnect)
        delay(180000); // 3-minute delay
        
        // 3. Cut the main power via the relay and contactor
        digitalWrite(RELAY_PIN, LOW); 
    }
    ```

## 3. Recording the AC Remote Power Off Signal
* **User:** But how can I record the power of signal?
* **Assistant:** To record the "OFF" signal from your AC remote, connect an **IR Receiver module** (like the **TSOP38238** or **VS1838B**) to your ESP32.

### Hardware Setup
* **VCC/Vs** ──> ESP32 **3.3V** or **5V**
* **GND** ──> ESP32 **GND**
* **OUT/Data** ──> Any available GPIO pin (e.g., **GPIO 15**)

### Software Steps
1. Install the **IRremoteESP32** library via the Arduino IDE Library Manager.
2. Open the example sketch: **File** > **Examples** > **IRremoteESP32** > **IRrecvDumpV2** (or `IRrecvDumpV3`).
3. Set `const uint16_t kRecvPin = 15;` to match your data pin.
4. Upload the code, open the **Serial Monitor** at **115200 baud**, point your remote at the receiver, and press **Power OFF**.

### Parsing the Output
* **Supported Protocols:** If the library recognizes the brand (e.g., Daikin, LG, Panasonic), it will output a clean **Protocol** name and **Hex Code**.
* **Unknown Protocols:** If it shows `UNKNOWN`, the library provides a `uint16_t rawData[...]` array. Copy this array directly into your project code and use `irsend.sendRaw()` to reproduce the command.