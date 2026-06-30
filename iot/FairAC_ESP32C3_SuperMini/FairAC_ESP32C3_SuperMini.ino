#include <WiFi.h>
#include <WiFiManager.h> // IMPORTANT: Install "WiFiManager" library by tzapu in Arduino IDE
#include <Ticker.h>      // Used to blink LED while WiFiManager is connecting
#include <HTTPClient.h>
#include <ArduinoJson.h> // IMPORTANT: Install "ArduinoJson" library in Arduino IDE

// ==========================================
// CONFIGURATION
// ==========================================

// Remove hardcoded SSID and Password! WiFiManager will handle this.
// const char* ssid = "YOUR_WIFI_SSID";
// const char* password = "YOUR_WIFI_PASSWORD";

// Replace with your Node.js backend IP
const String baseUrl = "http://192.168.0.107:5000/api/v1/iot"; 

const unsigned long heartbeatInterval = 30000; // 30 seconds
const unsigned long telemetryInterval = 10000; // 10 seconds

unsigned long previousHeartbeatMillis = 0;
unsigned long previousTelemetryMillis = 0;

String deviceId = "";

// State Variables
bool isAcOn = false;
long activeSessionId = -1;
float simulatedKwh = 0.0;
float simulatedPowerW = 1400.0; // 1.4 kW AC

bool wasConnected = false; // Tracks connection state for burst blink

// On the ESP32-C3 SuperMini, the onboard blue LED is typically connected to GPIO 8 (Active LOW)
const int WIFI_LED_PIN = 8; 

// The BOOT button is on GPIO 9 (Active LOW)
const int BOOT_BTN_PIN = 9;

Ticker ticker;

void tick() {
  // Toggle state
  int state = digitalRead(WIFI_LED_PIN);
  digitalWrite(WIFI_LED_PIN, !state);
}

void setup() {
  Serial.begin(115200);
  pinMode(WIFI_LED_PIN, OUTPUT);
  digitalWrite(WIFI_LED_PIN, HIGH); // Turn OFF initially (Active LOW)
  
  pinMode(BOOT_BTN_PIN, INPUT_PULLUP);
  
  delay(1000);

  Serial.println("\n=================================");
  Serial.println("FairAC IoT - ESP32-C3 SuperMini");
  Serial.println("=================================");
  
  Serial.print("Initializing WiFiManager...");

  // Use WiFiManager for Captive Portal Setup
  WiFiManager wm;
  
  // Custom styling/name for the Access Point
  String apName = "FairAC_Setup_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Set the timeout for the captive portal (e.g. 3 minutes)
  // If no one connects to configure it, it restarts and tries again
  wm.setConfigPortalTimeout(180);

  // Start blinking every 500ms while trying to connect or hosting AP
  ticker.attach(0.5, tick);

  // Try to connect to saved WiFi. If it fails, open the AP.
  if (!wm.autoConnect(apName.c_str())) {
    Serial.println("Failed to connect or hit timeout. Restarting...");
    delay(3000);
    ESP.restart();
  }

  // Connected! Stop the ticker
  ticker.detach();
  // Make sure it's off before doing the burst
  digitalWrite(WIFI_LED_PIN, HIGH); 

  // Connected successfully! Do 10 fast blinks (50ms)
  for (int i = 0; i < 10; i++) {
    digitalWrite(WIFI_LED_PIN, LOW);
    delay(50);
    digitalWrite(WIFI_LED_PIN, HIGH);
    delay(50);
  }

  wasConnected = true;

  // Turn solid ON when connected (Active LOW)
  digitalWrite(WIFI_LED_PIN, LOW); 

  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Generate Device ID from MAC Address automatically
  deviceId = "ESP32_" + WiFi.macAddress();
  deviceId.replace(":", "");
  Serial.println("DEVICE ID (MAC): " + deviceId);
  Serial.println("Please map this Device ID to your room in the backend!");

  // Send an immediate heartbeat on boot
  sendHeartbeat();
}

void loop() {
  unsigned long currentMillis = millis();

  // ---------------------------------------------------------
  // Manual Reset via BOOT Button (Wipe WiFi Credentials)
  // ---------------------------------------------------------
  // If the BOOT button (GPIO 9) is pressed (LOW) for 3 seconds, wipe WiFi settings and restart
  if (digitalRead(BOOT_BTN_PIN) == LOW) {
    delay(3000); // Wait 3 seconds to confirm it's a long press
    if (digitalRead(BOOT_BTN_PIN) == LOW) {
      Serial.println("\nWiFi Reset requested via button! Wiping credentials and restarting...");
      digitalWrite(WIFI_LED_PIN, HIGH); // Turn off LED
      
      WiFiManager wm;
      wm.resetSettings(); // Erase saved WiFi password
      
      delay(1000);
      ESP.restart();
    }
  }

  // ---------------------------------------------------------
  // WiFi LED Status Indicator 
  // ---------------------------------------------------------
  if (WiFi.status() == WL_CONNECTED) {
    if (!wasConnected) {
      // Just reconnected! Do 10 fast blinks
      for (int i = 0; i < 10; i++) {
        digitalWrite(WIFI_LED_PIN, LOW);
        delay(50);
        digitalWrite(WIFI_LED_PIN, HIGH);
        delay(50);
      }
      wasConnected = true;
    }
    // Solid continuously turned on light when connected (Active LOW)
    digitalWrite(WIFI_LED_PIN, LOW); 
  } else {
    wasConnected = false;
    // Blink when disconnected (e.g., 500ms ON / 500ms OFF)
    digitalWrite(WIFI_LED_PIN, (currentMillis / 500) % 2 ? LOW : HIGH); 
  }

  // 1. Heartbeat Logic
  if (currentMillis - previousHeartbeatMillis >= heartbeatInterval) {
    previousHeartbeatMillis = currentMillis;
    sendHeartbeat();
  }

  // 2. Telemetry Logic (Only if AC is ON)
  if (isAcOn && (currentMillis - previousTelemetryMillis >= telemetryInterval)) {
    previousTelemetryMillis = currentMillis;
    
    // Simulate consuming power (1.4 kW for 10 seconds)
    float timeHours = (telemetryInterval / 1000.0) / 3600.0;
    
    // ACCUMULATE locally in case WiFi is down
    simulatedKwh += (simulatedPowerW / 1000.0) * timeHours;
    
    if (WiFi.status() == WL_CONNECTED) {
      bool success = sendTelemetry();
      if (success) {
        simulatedKwh = 0.0; // Reset only after successfully sending to backend!
      }
    }
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = baseUrl + "/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["mac_address"] = WiFi.macAddress();
  doc["status"] = "online";
  doc["uptime"] = millis() / 1000;
  
  String payload;
  serializeJson(doc, payload);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    
    // Parse backend response to check for active session
    StaticJsonDocument<500> respDoc;
    DeserializationError error = deserializeJson(respDoc, response);
    
    if (!error) {
      if (respDoc.containsKey("active_session_id") && !respDoc["active_session_id"].isNull()) {
        long newSessionId = respDoc["active_session_id"];
        if (!isAcOn || activeSessionId != newSessionId) {
          isAcOn = true;
          activeSessionId = newSessionId;
          simulatedKwh = 0.0; // Reset counter for new session
          Serial.println("\n[RELAY] >>> AC TURNED ON (Simulated) <<<");
          Serial.println("Linked to Session ID: " + String(activeSessionId));
        }
      } else {
        if (isAcOn) {
          isAcOn = false;
          activeSessionId = -1;
          Serial.println("\n[RELAY] >>> AC TURNED OFF (Simulated) <<<");
        }
      }
    }
  } else {
    Serial.println("Error sending heartbeat: " + String(httpResponseCode));
  }
  http.end();
}

bool sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = baseUrl + "/telemetry";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["session_id"] = activeSessionId;
  doc["energy_kwh"] = simulatedKwh;
  doc["power_w"] = simulatedPowerW;
  
  String payload;
  serializeJson(doc, payload);

  Serial.print("Sending Telemetry: ");
  Serial.println(payload);

  int httpResponseCode = http.POST(payload);
  http.end();
  
  return (httpResponseCode > 0);
}
