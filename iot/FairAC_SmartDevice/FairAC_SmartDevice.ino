#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // IMPORTANT: Install "ArduinoJson" library in Arduino IDE

// ==========================================
// CONFIGURATION
// ==========================================

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

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

const int WIFI_LED_PIN = 2; // Usually 2 on ESP32 DevKit V1. If no light, try 1 or 22.

void setup() {
  Serial.begin(115200);
  pinMode(WIFI_LED_PIN, OUTPUT);
  delay(1000);

  Serial.println("\n=================================");
  Serial.println("FairAC IoT - Phase 2 (Smart Device)");
  Serial.println("=================================");
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  bool ledState = false;
  while (WiFi.status() != WL_CONNECTED) {
    ledState = !ledState;
    digitalWrite(WIFI_LED_PIN, ledState ? HIGH : LOW); // Blink while connecting
    delay(500);
    Serial.print(".");
  }

  digitalWrite(WIFI_LED_PIN, HIGH); // Solid ON when connected

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

  // WiFi LED Status Indicator
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(WIFI_LED_PIN, HIGH); // Solid Blue
  } else {
    // Blink Blue rapidly if disconnected
    digitalWrite(WIFI_LED_PIN, (currentMillis / 250) % 2 ? HIGH : LOW); 
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
