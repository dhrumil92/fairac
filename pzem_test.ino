#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <PZEM004Tv30.h>

// --- PIN DEFINITIONS ---
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define PIN_PZEM_TX     32  // Connects to PZEM RX
#define PIN_PZEM_RX     35  // Connects to PZEM TX

// --- OBJECTS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
HardwareSerial PzemSerial(2);
PZEM004Tv30 pzem(PzemSerial, PIN_PZEM_RX, PIN_PZEM_TX);

void setup() {
  Serial.begin(115200);
  
  // Initialize LCD
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  
  lcd.setCursor(0, 0);
  lcd.print("PZEM Test Tool");
  lcd.setCursor(0, 1);
  lcd.print("Starting up...");
  delay(2000);
  lcd.clear();
}

void loop() {
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power = pzem.power();

  if (isnan(voltage)) {
    Serial.println("Error: PZEM Timeout!");
    lcd.setCursor(0, 0);
    lcd.print("PZEM ERROR      ");
    lcd.setCursor(0, 1);
    lcd.print("Check RX/TX!    ");
  } else {
    // Print to Serial Monitor
    Serial.print("V: "); Serial.print(voltage);
    Serial.print("V | I: "); Serial.print(current);
    Serial.print("A | P: "); Serial.print(power);
    Serial.println("W");

    // Print to LCD Screen
    lcd.setCursor(0, 0);
    lcd.print(voltage, 1); lcd.print("V   ");
    lcd.print(current, 2); lcd.print("A    ");
    
    lcd.setCursor(0, 1);
    lcd.print("Power: "); lcd.print(power, 1); lcd.print(" W    ");
  }
  
  delay(1000); // Read every 1 second
}
