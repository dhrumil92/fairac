/**
 * FairAC Simulation Firmware - ESP32 (BLE Only)
 * Pure Offline Architecture - Phase 3 (SIMULATOR)
 *
 * This firmware acts EXACTLY like esp32_ble.ino (NVS recovery, auto shutoff, offline billing)
 * BUT it simulates power consumption (1400W - 1600W) instead of requiring actual PZEM/LCD hardware.
 */

#include <esp_mac.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// --- PIN MAPPING ---
#define PIN_BUZZER      13
#define PIN_RELAY       15
#define PIN_LED_RED     26
#define PIN_LED_YELLOW  25
#define PIN_LED_GREEN   33
#define PIN_LED_BLUE    2

// --- BLE UUIDs ---
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID_RX "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // Phone -> ESP32
#define CHARACTERISTIC_UUID_TX "8b368725-7b58-45e3-979f-6893e414c5b3"  // ESP32 -> Phone

// --- BLE Objects ---
BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

String hardwareId = "";

// --- Hardware Objects ---
Preferences preferences;

// --- State Machine ---
enum SystemState { BOOTING, STANDBY, SESSION_ACTIVE, FINISHED, FAULT };
SystemState currentState = BOOTING;

// --- Session Data (all stored in NVS for power-cut recovery) ---
float session_kwh = 0.0;      // Energy consumed THIS session (NVS: "session_kwh")
float total_kwh = 0.0;        // Lifetime total (NVS: "total_kwh")
float max_kwh_limit = 0.0;    // 0 = no kWh limit (NVS: "max_kwh")
long remaining_duration_sec = 0; // Countdown timer in seconds. 0 = no time limit (NVS: "remain_dur")
long activeSessionId = -1;    // (NVS: "session_id")

// --- Live Sensor Readings ---
float current_power = 0.0;
float current_voltage = 0.0;
float current_pf = 0.0;

// --- Timing ---
unsigned long lastTelemetryTime = 0;
unsigned long lastSaveTime = 0;
unsigned long sessionStartTime = 0;
unsigned long lastDurationTickTime = 0; // For the 1-second duration countdown
unsigned long faultStartTime = 0;

String faultMessage = "";

// --- Function Prototypes ---
void bootAnimation();
void beep(int duration, int count = 1, int interval = 100);
void handleTelemetry();
void sendBleTelemetry();
void saveToFlash();
void startSession(bool silent = false);
void finishSession(String reason);
void stopSession();

// ─────────────────────────────────────────────────────────────────────────────
// BLE Server Callbacks
// ─────────────────────────────────────────────────────────────────────────────
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      digitalWrite(PIN_LED_BLUE, HIGH);
      Serial.println("[BLE] Phone Connected!");
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      digitalWrite(PIN_LED_BLUE, LOW);
      Serial.println("[BLE] Phone Disconnected. Session continues autonomously.");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// BLE Command Receiver
// ─────────────────────────────────────────────────────────────────────────────
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, rxValue);
        
        if (!error) {
          String cmd = doc["cmd"];

          if (cmd == "START") {
            // Accept limits from mobile app
            max_kwh_limit = doc["max_kwh"] | 0.0f;
            remaining_duration_sec = doc["max_duration_sec"] | 0L;
            activeSessionId = doc["session_id"] | (long)(millis() / 1000);

            Serial.printf("[BLE] START: max_kwh=%.2f, max_dur=%ld sec, session_id=%ld\n",
                          max_kwh_limit, remaining_duration_sec, activeSessionId);
            startSession(false);

          } else if (cmd == "STOP") {
            // Manual early stop by user
            Serial.println("[BLE] STOP command received from phone.");
            finishSession("MANUAL_STOP");

          } else if (cmd == "SYNC_ACK") {
            // Mobile confirms it successfully synced the final data to the server
            // Now it's safe to clear the session from flash and go to STANDBY
            Serial.println("[BLE] Sync acknowledged by server. Clearing session from flash.");
            preferences.putBool("is_active", false);
            preferences.putFloat("session_kwh", 0.0);
            preferences.putFloat("max_kwh", 0.0);
            preferences.putLong("remain_dur", 0);
            preferences.putLong("session_id", -1);
            session_kwh = 0.0;
            max_kwh_limit = 0.0;
            remaining_duration_sec = 0;
            activeSessionId = -1;
            currentState = STANDBY;
            digitalWrite(PIN_LED_RED, LOW);
          }
        }
      }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(3000); // Give serial monitor time to open before printing
  Serial.println("\n[SYSTEM] FairAC Simulation Firmware Booting...");

  // Initialize Pins
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_BLUE, OUTPUT);

  // Relay OFF by default (HIGH = off for active-low relay)
  digitalWrite(PIN_RELAY, HIGH);

  // ── Load from NVS ──────────────────────────────────────────────────────────
  preferences.begin("fairac", false);
  total_kwh             = preferences.getFloat("total_kwh", 0.0);
  session_kwh           = preferences.getFloat("session_kwh", 0.0);
  max_kwh_limit         = preferences.getFloat("max_kwh", 0.0);
  remaining_duration_sec = preferences.getLong("remain_dur", 0);
  activeSessionId       = preferences.getLong("session_id", -1);
  bool wasActive        = preferences.getBool("is_active", false);
  bool wasFinished      = preferences.getBool("is_finished", false);

  Serial.printf("[NVS] Total=%.3f kWh | Session=%.3f kWh | MaxKwh=%.2f | RemainDur=%ld sec\n",
                total_kwh, session_kwh, max_kwh_limit, remaining_duration_sec);

  bootAnimation();

  // ── Init BLE ───────────────────────────────────────────────────────────────
  uint8_t mac_arr[6];
  esp_read_mac(mac_arr, ESP_MAC_BT);
  char macStr[13];
  sprintf(macStr, "%02x%02x%02x%02x%02x%02x",
          mac_arr[0], mac_arr[1], mac_arr[2], mac_arr[3], mac_arr[4], mac_arr[5]);
  String mac = String(macStr);
  hardwareId = "FAIRAC-" + mac.substring(mac.length() - 5);
  
  Serial.println("==================================================");
  Serial.println("[BLE] Device ID: " + hardwareId);
  Serial.println("[IMPORTANT] Ensure this ID is in your Postgres 'devices' table!");
  Serial.println("==================================================");

  BLEDevice::init(hardwareId.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising started. Waiting for phone...");

  // ── Power-Cut Recovery ─────────────────────────────────────────────────────
  if (wasFinished) {
    // Session already ended before power cut, waiting for sync
    Serial.println("[SYSTEM] Recovering FINISHED session. Waiting for BLE sync.");
    currentState = FINISHED;
    digitalWrite(PIN_LED_RED, HIGH); // Red LED = waiting for sync
  } else if (wasActive) {
    // Session was running before power cut — resume it!
    Serial.println("[SYSTEM] Recovering ACTIVE session after power cut!");
    startSession(true); // silent = don't reset kWh or animate
  } else {
    currentState = STANDBY;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── BLE LED Status & Re-advertising ───────────────────────────────────────
  if (!deviceConnected) {
    if (oldDeviceConnected) {
      delay(500);
      BLEDevice::startAdvertising();
      Serial.println("[BLE] Restarting advertising...");
      oldDeviceConnected = false;
    }
    // Blink when disconnected (e.g., 500ms ON / 500ms OFF)
    digitalWrite(PIN_LED_BLUE, (now / 500) % 2 ? HIGH : LOW);
  } else {
    if (!oldDeviceConnected) {
      // Just connected! Do 10 fast blinks
      for (int i = 0; i < 10; i++) {
        digitalWrite(PIN_LED_BLUE, HIGH);
        delay(50);
        digitalWrite(PIN_LED_BLUE, LOW);
        delay(50);
      }
      oldDeviceConnected = true;
    }
    // Solid continuously turned on light when connected
    digitalWrite(PIN_LED_BLUE, HIGH);
  }

  // (E-Stop code removed as per user request — hardware button handles main power cut directly)

  // ── Duration Countdown (1 second tick) ───────────────────────────────────
  if (currentState == SESSION_ACTIVE && remaining_duration_sec > 0) {
    if (now - lastDurationTickTime >= 1000) {
      lastDurationTickTime = now;
      remaining_duration_sec--;

      // Auto-shutdown when timer reaches zero
      if (remaining_duration_sec <= 0) {
        remaining_duration_sec = 0;
        Serial.println("[SYSTEM] Duration limit reached! Auto-shutting off AC.");
        finishSession("DURATION_LIMIT");
      }
    }
  }

  // ── Telemetry (every 5 seconds) ──────────────────────────────────────────
  if (now - lastTelemetryTime >= 5000) {
    lastTelemetryTime = now;
    handleTelemetry();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// START SESSION
// ─────────────────────────────────────────────────────────────────────────────
void startSession(bool silent) {
  currentState = SESSION_ACTIVE;
  sessionStartTime = millis();
  lastDurationTickTime = millis();

  preferences.putBool("is_active", true);
  preferences.putBool("is_finished", false);
  preferences.putLong("session_id", activeSessionId);
  preferences.putFloat("max_kwh", max_kwh_limit);
  preferences.putLong("remain_dur", remaining_duration_sec);

  if (!silent) {
    // New session: reset energy counter
    session_kwh = 0.0;
    current_power = 0.0;
    preferences.putFloat("session_kwh", 0.0);

    // Visual/audio animation
    for (int i = 0; i < 3; i++) {
      digitalWrite(PIN_LED_YELLOW, HIGH); delay(300);
      digitalWrite(PIN_LED_YELLOW, LOW); delay(300);
    }
    beep(500);
  }

  // Turn AC ON
  digitalWrite(PIN_RELAY, LOW);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  Serial.printf("[SYSTEM] Session Started. max_kwh=%.2f, max_dur=%ld sec\n",
                max_kwh_limit, remaining_duration_sec);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINISH SESSION (auto-stop or manual stop — save data, wait for BLE sync)
// ─────────────────────────────────────────────────────────────────────────────
void finishSession(String reason) {
  // Turn AC OFF immediately
  digitalWrite(PIN_RELAY, HIGH);
  digitalWrite(PIN_LED_YELLOW, LOW);
  beep(200, 3, 200);

  Serial.printf("[SYSTEM] Session FINISHED. Reason: %s | Final kWh: %.4f\n",
                reason.c_str(), session_kwh);

  // Save final state to NVS — this is the "parcel" waiting to be delivered
  preferences.putBool("is_active", true);   // Keep locked so no new session starts
  preferences.putBool("is_finished", true); // New flag: session done, needs sync
  preferences.putFloat("session_kwh", session_kwh);
  preferences.putFloat("total_kwh", total_kwh);
  preferences.putLong("remain_dur", 0);

  currentState = FINISHED;
  digitalWrite(PIN_LED_RED, HIGH); // Red = waiting for sync
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLE TELEMETRY (SIMULATED POWER + kWh accumulation + auto-stop check)
// ─────────────────────────────────────────────────────────────────────────────
void handleTelemetry() {
  current_voltage = 230.1;
  
  if (currentState == SESSION_ACTIVE) {
    // Simulate AC power randomly between 1400W and 1600W
    current_power = random(1400, 1600) + (random(0, 100) / 100.0); 
  } else {
    current_power = 0.0;
  }
  
  current_pf = 0.95;

  // Accumulate energy (power over 5 seconds = kWh)
  float consumed_kwh = (current_power / 1000.0) * (5.0 / 3600.0);
  if (currentState == SESSION_ACTIVE) {
    session_kwh += consumed_kwh;
    total_kwh += consumed_kwh;

    // ── kWh Limit Check ─────────────────────────────────────────────────
    if (max_kwh_limit > 0 && session_kwh >= max_kwh_limit) {
      Serial.printf("[SYSTEM] kWh limit reached! (%.3f / %.3f)\n", session_kwh, max_kwh_limit);
      finishSession("KWH_LIMIT");
      sendBleTelemetry(); // Immediately notify phone
      return;
    }

    // ── Periodic Flash Save (every 60 seconds) ──────────────────────────
    if (millis() - lastSaveTime > 60000) {
      saveToFlash();
      lastSaveTime = millis();
    }
  }

  Serial.printf("[TELEMETRY] State=%s | Power=%.1fW | Session=%.4f kWh | Remain=%ld sec\n",
                currentState == SESSION_ACTIVE ? "ACTIVE" : (currentState == FINISHED ? "FINISHED" : "STANDBY"),
                current_power, session_kwh, remaining_duration_sec);

  sendBleTelemetry();
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND BLE TELEMETRY
// ─────────────────────────────────────────────────────────────────────────────
void sendBleTelemetry() {
  if (!deviceConnected || pTxCharacteristic == NULL) return;

  StaticJsonDocument<256> doc;
  doc["power"]           = current_power;
  doc["units_consumed"]  = session_kwh;
  doc["voltage"]         = current_voltage;
  doc["current"]         = (current_power > 0 && current_voltage > 0)
                            ? (current_power / current_voltage) : 0.0;
  doc["remain_sec"]      = remaining_duration_sec;
  doc["max_kwh"]         = max_kwh_limit;

  // Status field — mobile app uses this to trigger auto-sync
  if (currentState == FINISHED) {
    doc["status"] = "FINISHED";
  } else if (currentState == SESSION_ACTIVE) {
    doc["status"] = "ACTIVE";
  } else {
    doc["status"] = "IDLE";
  }

  String payload;
  serializeJson(doc, payload);

  pTxCharacteristic->setValue(payload.c_str());
  pTxCharacteristic->notify();
  Serial.println("[BLE] Telemetry sent: " + payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE TO FLASH (called every 60s or on session end)
// ─────────────────────────────────────────────────────────────────────────────
void saveToFlash() {
  preferences.putFloat("total_kwh", total_kwh);
  preferences.putFloat("session_kwh", session_kwh);
  preferences.putLong("remain_dur", remaining_duration_sec);
  Serial.printf("[NVS] Saved: session=%.4f kWh, remain=%ld sec\n", session_kwh, remaining_duration_sec);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
void bootAnimation() {
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  delay(800);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  beep(100, 2, 100);
}

void beep(int duration, int count, int interval) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH); delay(duration);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(interval);
  }
}


