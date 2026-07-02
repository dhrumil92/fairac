// Exhaustive list of ALL safe output-capable GPIO pins on ESP32
// (Skipping 1 & 3 for Serial, 6-11 for internal Flash memory, and 34-39 which are input-only)
const int testPins[] = {0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
const int numPins = 20;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- ESP32 EXHAUSTIVE LED Pin Finder ---");
  Serial.println("Testing all 20 safe output pins.");
  Serial.println("Watch your board closely!");
  
  for (int i = 0; i < numPins; i++) {
    pinMode(testPins[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < numPins; i++) {
    int pin = testPins[i];
    
    Serial.print("Testing Pin GPIO ");
    Serial.print(pin);
    Serial.println(" -> HIGH (ON)");
    
    digitalWrite(pin, HIGH);
    delay(1500); // Wait 1.5 seconds
    
    Serial.println("                     -> LOW (OFF)");
    digitalWrite(pin, LOW);
    delay(250); // Brief pause before next pin
  }
  
  Serial.println("--- Restarting Cycle ---\n");
  delay(2000);
}
