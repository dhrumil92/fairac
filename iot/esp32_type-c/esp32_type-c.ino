/**
 * FairAC Production Firmware - ESP32 30-pin Type-C
 * Pin Mapping: "VIN-Side Only" for clean breadboard layout.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <LiquidCrystal_I2C.h>
#include <PZEM004Tv30.h>
#include <WiFiManager.h>
#include <Ticker.h>

// --- PIN MAPPING (VIN Side Only) ---
#define PIN_BUZZER      13
#define PIN_RELAY       15
#define PIN_LED_RED     26
#define PIN_LED_YELLOW  25
#define PIN_LED_GREEN   33
#define PIN_PZEM_TX     32
#define PIN_PZEM_RX     35  // Input only
#define PIN_BTN_RESET   34  // Input only (requires external 10k pullup)
#define PIN_BTN_ESTOP   39  // Input only (requires external 10k pullup)

// Built-in Blue LED for WiFi status (usually on GPIO 2, opposite side)
#define PIN_LED_BLUE    2

// --- CONFIGURATION ---
String serverUrl = "http://10.202.106.220:5000/api/v1/iot";
String hardwareId = ""; // Generated from MAC address automatically
int roomId = 1;

// --- HARDWARE OBJECTS ---
LiquidCrystal_I2C lcd(0x27, 16, 2); // SDA=14, SCL=27 mapped via Wire.begin()
HardwareSerial PzemSerial(2);
PZEM004Tv30 pzem(PzemSerial, PIN_PZEM_RX, PIN_PZEM_TX);
Preferences preferences;

// --- STATE VARIABLES ---
Ticker ticker;

void tick() {
  int state = digitalRead(PIN_LED_BLUE);
  digitalWrite(PIN_LED_BLUE, !state);
}

enum SystemState { BOOTING, STANDBY, SESSION_ACTIVE, FAULT };
SystemState currentState = BOOTING;

float total_kwh = 0.0;
float session_kwh = 0.0;
float offline_kwh_buffer = 0.0;
long activeSessionId = -1;

float current_power = 0.0;
float current_voltage = 0.0;
float current_pf = 0.0;

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastDisplayTime = 0;
unsigned long lastWifiRetryTime = 0;
unsigned long wifiDisconnectTime = 0;
unsigned long faultStartTime = 0;
bool wifiWasConnected = false;
int displayScreen = 0;
String faultMessage = "";

// --- FUNCTION PROTOTYPES ---
void bootAnimation();
void beep(int duration, int count = 1, int interval = 100);
void connectWiFi();
void updateDisplay();
void handleTelemetry();
void sendHeartbeat();
void sendTelemetry();
void saveToFlash();
void startSession(bool silent = false);
void stopSession();

void setup() {
  Serial.begin(115200);
  Serial.println("\n[SYSTEM] FairAC ESP32 Booting...");

  // Initialize Pins
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_BLUE, OUTPUT);
  pinMode(PIN_BTN_RESET, INPUT);
  pinMode(PIN_BTN_ESTOP, INPUT);
  pinMode(0, INPUT_PULLUP); // BOOT button for WiFi Reset

  // Relay OFF by default
  digitalWrite(PIN_RELAY, LOW);

  // Initialize I2C for LCD on pins 14 (SDA) and 27 (SCL)
  Wire.begin(14, 27);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("FairAC System...");
  lcd.setCursor(0, 1);
  lcd.print("Booting up.");

  // Init NVS (Permanent Flash Memory)
  preferences.begin("fairac", false);
  total_kwh = preferences.getFloat("total_kwh", 0.0);
  session_kwh = preferences.getFloat("session_kwh", 0.0);
  bool wasActive = preferences.getBool("is_active", false);
  activeSessionId = preferences.getLong("session_id", -1);
  offline_kwh_buffer = preferences.getFloat("offline_kwh", 0.0);

  Serial.printf("[NVS] Loaded Total: %.3f kWh, Session: %.3f kWh\n", total_kwh, session_kwh);

  bootAnimation();

  connectWiFi();

  // Recover state if crashed during session
  if (wasActive) {
    Serial.println("[SYSTEM] Recovering active session from Flash!");
    startSession(true); // silent start
  } else {
    currentState = STANDBY;
  }
}

void loop() {
  unsigned long now = millis();

  // --- Wipe WiFi via Green Button (GPIO 34) ---
  if (digitalRead(PIN_BTN_RESET) == LOW) { 
    delay(3000); // Wait 3 seconds to confirm long press
    if (digitalRead(PIN_BTN_RESET) == LOW) {
      // Safety Lock: Only allow wipe if the ESP32 has been running for at least 5 seconds!
      // This prevents the annoying bug where it wipes itself randomly from static before you plug it in.
      if (now > 5000) {
        Serial.println("\n[WIFI] Reset requested via Green Button! Wiping credentials...");
        lcd.clear(); lcd.setCursor(0,0); lcd.print("Wiping WiFi...");
        digitalWrite(PIN_LED_BLUE, LOW);
        WiFiManager wm;
        wm.resetSettings();
        delay(1000);
        ESP.restart();
      }
    }
  }

  // --- E-Stop Button Logic (GPIO 39) ---
  if (digitalRead(PIN_BTN_ESTOP) == LOW) { // Assuming active LOW with pullup
    if (currentState == SESSION_ACTIVE) {
      // 1. Instant Press: Trigger Emergency Stop
      stopSession();
      currentState = FAULT;
      faultStartTime = now;
      faultMessage = "EMERGENCY STOP";
      digitalWrite(PIN_LED_RED, HIGH);
      Serial.println("[FAULT] E-Stop Pressed!");
      delay(1000); // debounce
    } 
    else if (currentState == FAULT) {
      // 2. Long Press (3 seconds): Recover from Emergency Stop
      delay(3000);
      if (digitalRead(PIN_BTN_ESTOP) == LOW) {
        Serial.println("\n[SYSTEM] Fault Cleared via E-Stop Long Press.");
        currentState = STANDBY;
        faultMessage = "";
        digitalWrite(PIN_LED_RED, LOW);
      }
    }
  }

  // --- WiFi Reconnect & Safety Logic ---
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      wifiDisconnectTime = now;
      wifiWasConnected = false;
      digitalWrite(PIN_LED_BLUE, LOW);
      Serial.println("[WIFI] Connection lost!");
    }
    
    // Auto-Stop / Reboot logic
    if (currentState == SESSION_ACTIVE && (now - wifiDisconnectTime > 5 * 60 * 1000)) { 
      // 5 Minutes anti-theft limit during active session
      Serial.println("[WIFI] Disconnected > 5 mins. Auto-stopping session for Anti-Theft!");
      stopSession();
      currentState = FAULT;
      faultMessage = "FAULT: No WiFi";
    } else if (currentState == STANDBY && (now - wifiDisconnectTime > 3 * 60 * 1000)) { 
      // 3 Minutes reboot limit during standby
      Serial.println("[WIFI] Disconnected > 3 mins in standby. Rebooting to clear stack.");
      ESP.restart();
    } else if (now - lastWifiRetryTime >= 30000) { // Retry every 30s
      lastWifiRetryTime = now;
      Serial.println("[WIFI] Attempting reconnect...");
      WiFi.reconnect();
    }
  } else {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      digitalWrite(PIN_LED_BLUE, HIGH);
      Serial.print("[WIFI] Reconnected. IP: ");
      Serial.println(WiFi.localIP());
      if (currentState == FAULT && faultMessage == "FAULT: No WiFi") {
        currentState = STANDBY;
      }
    }
    if (now - lastWifiRetryTime >= 30000) {
      lastWifiRetryTime = now;
      Serial.println("[WIFI] Connection stable. IP: " + WiFi.localIP().toString());
    }
  }

  // --- Heartbeat Logic (Every 30 seconds) ---
  if (now - lastHeartbeatTime >= 30000) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  // --- Telemetry & Server Sync (Every 10 seconds) ---
  if (now - lastTelemetryTime >= 10000) {
    lastTelemetryTime = now;
    handleTelemetry();
  }

  // --- Display Rotation (Every 4 seconds) ---
  if (now - lastDisplayTime >= 4000) {
    lastDisplayTime = now;
    displayScreen = (displayScreen + 1) % 2; // Toggle 0 and 1
    updateDisplay();
  }
}

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

void bootAnimation() {
  Serial.println("[SYSTEM] Playing boot animation...");
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_BLUE, HIGH);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  digitalWrite(PIN_LED_RED, HIGH);
  delay(2000);

  digitalWrite(PIN_LED_BLUE, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  delay(200);

  // Chaser
  digitalWrite(PIN_LED_BLUE, HIGH); delay(500); digitalWrite(PIN_LED_BLUE, LOW);
  digitalWrite(PIN_LED_YELLOW, HIGH); delay(500); digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, HIGH); delay(500); digitalWrite(PIN_LED_RED, LOW);
  
  beep(100, 2, 100);
}

void beep(int duration, int count, int interval) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(duration);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(interval);
  }
}

void connectWiFi() {
  Serial.println("[WIFI] Starting WiFiManager...");
  
  String apName = "FairAC_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi.");
  lcd.setCursor(0, 1);
  lcd.print("AP: " + apName.substring(0, 12));

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  
  ticker.attach(0.5, tick); // Start blinking Blue LED

  if (wm.autoConnect(apName.c_str())) {
    ticker.detach();
    digitalWrite(PIN_LED_BLUE, LOW);
    
    // 10 fast blinks on success
    for (int i = 0; i < 10; i++) {
      digitalWrite(PIN_LED_BLUE, HIGH); delay(50);
      digitalWrite(PIN_LED_BLUE, LOW); delay(50);
    }
    
    Serial.println("\n[WIFI] Connected!");
    digitalWrite(PIN_LED_BLUE, HIGH);
    wifiWasConnected = true;
    
    // Generate Device ID from MAC
    hardwareId = "ESP32_" + WiFi.macAddress();
    hardwareId.replace(":", "");
    Serial.println("DEVICE ID (MAC): " + hardwareId);
  } else {
    ticker.detach();
    Serial.println("\n[WIFI] Failed to connect / Timeout.");
    digitalWrite(PIN_LED_BLUE, LOW);
    wifiWasConnected = false;
    wifiDisconnectTime = millis();
  }
}

void startSession(bool silent) {
  currentState = SESSION_ACTIVE;
  preferences.putBool("is_active", true);
  preferences.putLong("session_id", activeSessionId);
  
  if (!silent) {
    session_kwh = 0.0; // Only reset if new session, not recovering
    preferences.putFloat("session_kwh", 0.0);
    
    // Start Animation
    for (int i=0; i<3; i++) {
      digitalWrite(PIN_LED_YELLOW, HIGH); delay(500);
      digitalWrite(PIN_LED_YELLOW, LOW); delay(500);
    }
    beep(500);
  }
  
  digitalWrite(PIN_LED_YELLOW, HIGH);
  digitalWrite(PIN_RELAY, HIGH); // Turn AC ON
  Serial.println("[SYSTEM] Session Started. Relay ON.");
}

void stopSession() {
  currentState = STANDBY;
  preferences.putBool("is_active", false);
  
  digitalWrite(PIN_RELAY, LOW); // Turn AC OFF
  digitalWrite(PIN_LED_YELLOW, LOW);
  beep(200, 3, 200);
  
  Serial.println("[SYSTEM] Session Ended. Relay OFF.");
  
  // Reset session kWh after saving
  saveToFlash();
}

void saveToFlash() {
  preferences.putFloat("total_kwh", total_kwh);
  preferences.putFloat("session_kwh", session_kwh);
  preferences.putFloat("offline_kwh", offline_kwh_buffer);
}

void handleTelemetry() {
  float v = pzem.voltage();
  if (isnan(v)) {
    Serial.println("[ERROR] PZEM Timeout - check serial wiring");
    current_voltage = 0.0;
    current_power = 0.0;
    current_pf = 0.0;
  } else {
    current_voltage = v;
    current_power = pzem.power();
    
    // Safety check for NaN on power/pf readings
    if (isnan(current_power)) current_power = 0.0;
    current_pf = pzem.pf();
    if (isnan(current_pf)) current_pf = 0.0;
    
    float consumed_kwh = (current_power / 1000.0) * (10.0 / 3600.0);
    if (currentState == SESSION_ACTIVE) {
      session_kwh += consumed_kwh;
      offline_kwh_buffer += consumed_kwh;
    }
    total_kwh += consumed_kwh;
    
    saveToFlash();
  }
  
  Serial.printf("[TELEMETRY] Power: %.1fW | Sess: %.3fkWh | Tot: %.3fkWh | Buf: %.3fkWh\n", current_power, session_kwh, total_kwh, offline_kwh_buffer);
  
  if (currentState == SESSION_ACTIVE) {
    sendTelemetry();
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(serverUrl + "/heartbeat");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["device_id"] = hardwareId;
  doc["mac_address"] = WiFi.macAddress();
  doc["status"] = (currentState == FAULT) ? "fault" : "online";
  doc["uptime"] = millis() / 1000;
  
  String payload;
  serializeJson(doc, payload);

  int httpResponseCode = http.POST(payload);
  if (httpResponseCode > 0) {
    String response = http.getString();
    StaticJsonDocument<500> respDoc;
    DeserializationError error = deserializeJson(respDoc, response);
    
    if (!error) {
      if (respDoc.containsKey("active_session_id") && !respDoc["active_session_id"].isNull()) {
        long newSessionId = respDoc["active_session_id"];
        if (currentState != FAULT && (currentState != SESSION_ACTIVE || activeSessionId != newSessionId)) {
          activeSessionId = newSessionId;
          startSession(false);
        }
      } else {
        if (currentState == SESSION_ACTIVE) {
          stopSession();
        }
      }
    }
  } else {
    Serial.printf("[HTTP] Heartbeat Error: %d\n", httpResponseCode);
  }
  http.end();
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED || offline_kwh_buffer <= 0.001) return; // Ignore noise

  // Safety check: The buffer should never exceed a few kWh. If it is 237 kWh, it's corrupted NVS memory!
  if (offline_kwh_buffer > 5.0) {
    Serial.println("[ERROR] Corrupted NVS Buffer detected! Resetting to 0.");
    offline_kwh_buffer = 0.0;
    saveToFlash();
    return;
  }

  HTTPClient http;
  http.begin(serverUrl + "/telemetry");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["device_id"] = hardwareId;
  doc["session_id"] = activeSessionId;
  doc["energy_kwh"] = offline_kwh_buffer;
  doc["power_w"] = current_power;

  String payload;
  serializeJson(doc, payload);

  int httpResponseCode = http.POST(payload);
  if (httpResponseCode > 0) {
    offline_kwh_buffer = 0.0;
    saveToFlash();
  } else {
    Serial.printf("[HTTP] Telemetry Error: %d\n", httpResponseCode);
  }
  http.end();
}

void updateDisplay() {
  lcd.clear();
  
  if (currentState == BOOTING) {
    lcd.setCursor(0, 0); lcd.print("FairAC System...");
    lcd.setCursor(0, 1); lcd.print("Connecting WiFi.");
  } 
  else if (currentState == FAULT) {
    lcd.setCursor(0, 0); lcd.print(faultMessage);
    lcd.setCursor(0, 1); lcd.print("AC Disabled");
    
    // Announce fault with buzzer, but stop after 30 seconds to prevent annoyance
    if (millis() - faultStartTime < 30000) {
      beep(100, 1, 0);
    }
  }
  else if (currentState == STANDBY) {
    if (displayScreen == 0) {
      lcd.setCursor(0, 0); lcd.print("Status: Standby ");
      lcd.setCursor(0, 1); lcd.print("Scan App to Start");
    } else {
      lcd.setCursor(0, 0); lcd.print("Tot: "); lcd.print(total_kwh, 2); lcd.print("kWh");
      lcd.setCursor(0, 1); lcd.print("IP: "); lcd.print(WiFi.localIP().toString());
    }
  }
  else if (currentState == SESSION_ACTIVE) {
    if (displayScreen == 0) {
      lcd.setCursor(0, 0); lcd.print("Power: "); lcd.print((int)current_power); lcd.print(" W   ");
      lcd.setCursor(0, 1); lcd.print("Sess: "); lcd.print(session_kwh, 3); lcd.print(" kWh ");
    } else {
      lcd.setCursor(0, 0); lcd.print("PF: "); lcd.print(current_pf, 2); 
      lcd.print("  "); lcd.print((int)current_voltage); lcd.print("V  ");
      lcd.setCursor(0, 1); lcd.print("Tot: "); lcd.print(total_kwh, 2); lcd.print(" kWh ");
    }
  }
}
