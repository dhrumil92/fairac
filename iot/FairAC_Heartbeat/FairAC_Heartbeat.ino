#include <WiFi.h>
#include <HTTPClient.h>

// ==========================================
// CONFIGURATION
// ==========================================

// WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend URL 
// IMPORTANT: Replace with the local IP of the computer running your Node.js backend.
// Do NOT use localhost or 127.0.0.1, because that points to the ESP32 itself.
const char* serverName = "http://192.168.1.5:5000/api/v1/iot/heartbeat"; 

// Device Details
const String deviceId = "room_305";

// Heartbeat interval (in milliseconds) - 30 seconds
const unsigned long heartbeatInterval = 30000;
unsigned long previousMillis = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println("FairAC IoT - Phase 1 (Heartbeat)");
  Serial.println("=================================");
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Send an immediate heartbeat on boot
  sendHeartbeat();
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= heartbeatInterval) {
    previousMillis = currentMillis;
    sendHeartbeat();
  }
}

void sendHeartbeat() {
  // Check WiFi connection status
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    Serial.print("Sending heartbeat to: ");
    Serial.println(serverName);

    // Initialize HTTP connection
    http.begin(serverName);
    
    // Set headers
    http.addHeader("Content-Type", "application/json");

    // Construct JSON payload manually (or use ArduinoJson library)
    // {"device_id": "room_305", "status": "online", "uptime": <millis>}
    String payload = "{";
    payload += "\"device_id\":\"" + deviceId + "\",";
    payload += "\"status\":\"online\",";
    payload += "\"uptime\":" + String(millis() / 1000);
    payload += "}";

    Serial.print("Payload: ");
    Serial.println(payload);

    // Send HTTP POST request
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      String response = http.getString();
      Serial.println("Response: " + response);
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }
    
    // Free resources
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Reconnecting...");
    WiFi.disconnect();
    WiFi.reconnect();
  }
}
