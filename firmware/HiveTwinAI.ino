#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include "HX711.h"
#include <math.h>
#include <stdio.h>

// =====================================================
// WIFI SETTINGS
// =====================================================
const char* WIFI_SSID = "YOUR_NETWORK";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

// =====================================================
// FIREBASE REALTIME DATABASE
// Use your actual Realtime Database URL.
// Example: https://your-project-default-rtdb.firebaseio.com
// Do not add / at the end.
// =====================================================
const char* FIREBASE_DATABASE_URL =
  "YOUR_FIREBASE_URL";

// =====================================================
// PIN CONFIGURATION
// =====================================================
#define I2C_SDA       21
#define I2C_SCL       22
#define DHT_PIN       25
#define DHT_TYPE      DHT11
#define MQ135_PIN     34
#define HX711_DT      14
#define HX711_SCK     27
#define CO2_RX_PIN    16
#define CO2_TX_PIN    17
#define IR_PIN        26

#define IR_ACTIVE_LEVEL LOW

// =====================================================
// HX711 CALIBRATION
// Retains your original weight calculation.
// =====================================================
float CALIBRATION_FACTOR = -7050.0f;

// =====================================================
// TIMING
// =====================================================
const unsigned long FIREBASE_INTERVAL = 20000UL;
const unsigned long LCD_INTERVAL = 2000UL;
const unsigned long CO2_INTERVAL = 5000UL;
const unsigned long SENSOR_INTERVAL = 2000UL;

// =====================================================
// OBJECTS
// =====================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHT_PIN, DHT_TYPE);
HX711 scale;
HardwareSerial CO2Serial(2);

// =====================================================
// SENSOR VALUES
// =====================================================
float temperatureC = 0.0f;
float humidity = 0.0f;
float weightKg = 0.0f;

int co2ppm = 0;
int mq135Raw = 0;
float mq135Voltage = 0.0f;

unsigned long beeCount = 0;

// =====================================================
// STATUS FLAGS
// =====================================================
bool lcdAvailable = false;
bool dhtAvailable = false;
bool hx711Available = false;
bool hx711Initialized = false;
bool co2Available = false;

// =====================================================
// TIMERS
// =====================================================
unsigned long lastFirebaseUpload = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastCO2Read = 0;
unsigned long lastSensorRead = 0;
unsigned long lastHX711Retry = 0;

// =====================================================
// IR DEBOUNCE STATE
// =====================================================
int lastIRReading = HIGH;
int stableIRState = HIGH;
unsigned long lastIRChangeTime = 0;

// =====================================================
// MH-Z19E CO2 COMMAND
// =====================================================
const byte CO2_COMMAND[9] = {
  0xFF, 0x01, 0x86,
  0x00, 0x00, 0x00, 0x00, 0x00,
  0x79
};

// =====================================================
// LCD HELPER: EXACTLY 16 CHARACTERS
// =====================================================
void lcdPrintLine(byte row, const char* message) {
  if (!lcdAvailable) return;

  lcd.setCursor(0, row);

  for (int i = 0; i < 16; i++) {
    char c = (message != nullptr && message[i] != '\0')
             ? message[i] : ' ';
    lcd.print(c);
  }
}

// =====================================================
// WIFI CONNECTION
// =====================================================
void connectWiFi() {
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startTime < 15000UL) {
    delay(300);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected; monitoring continues.");
  }
}

// =====================================================
// MQ135
// =====================================================
void readMQ135() {
  const int samples = 20;
  unsigned long total = 0;

  for (int i = 0; i < samples; i++) {
    total += analogRead(MQ135_PIN);
    delay(2);
  }

  mq135Raw = total / samples;
  mq135Voltage = (mq135Raw * 3.3f) / 4095.0f;
}

// =====================================================
// DHT11
// =====================================================
void readDHT11() {
  float newHumidity = dht.readHumidity();
  float newTemperature = dht.readTemperature();

  if (!isnan(newHumidity) && !isnan(newTemperature)) {
    humidity = newHumidity;
    temperatureC = newTemperature;
    dhtAvailable = true;
  } else {
    dhtAvailable = false;
    Serial.println("DHT11 read failed; retaining previous values.");
  }
}

// =====================================================
// HX711 INITIALIZATION AND RETRY
// =====================================================
void tryInitializeHX711() {
  if (hx711Initialized) return;

  if (millis() - lastHX711Retry < 1000UL) return;
  lastHX711Retry = millis();

  if (!scale.is_ready()) {
    hx711Available = false;
    Serial.println("HX711 not ready: check DT, SCK, power and GND.");
    return;
  }

  scale.set_scale(CALIBRATION_FACTOR);

  Serial.println("HX711 detected. Remove all weight before tare.");

  scale.tare(10);

  hx711Initialized = true;
  hx711Available = true;
  weightKg = 0.0f;

  Serial.println("HX711 initialized and tared.");
}

// =====================================================
// READ HX711 LOAD CELL
// Original weight formula retained.
// =====================================================
void readWeight() {
  tryInitializeHX711();

  if (!hx711Initialized || !scale.is_ready()) {
    hx711Available = false;
    return;
  }

  long rawAverage = scale.read_average(5);
  float measured = scale.get_units(10);

  if (!isfinite(measured)) {
    hx711Available = false;
    Serial.println("HX711 invalid reading.");
    return;
  }

  if (fabsf(measured) < 0.005f) {
    measured = 0.0f;
  }

  weightKg = (measured * 40.0f) / 1000.0f;
  hx711Available = true;

  Serial.print("HX711 raw average: ");
  Serial.print(rawAverage);
  Serial.print(" | Weight: ");
  Serial.print(weightKg, 3);
  Serial.println(" kg");
}

// =====================================================
// MH-Z19E CO2 SENSOR
// =====================================================
bool readCO2Sensor(int &ppm) {
  while (CO2Serial.available()) {
    CO2Serial.read();
  }

  CO2Serial.write(CO2_COMMAND, sizeof(CO2_COMMAND));
  CO2Serial.flush();

  byte response[9];
  int received = 0;
  unsigned long startTime = millis();

  while (received < 9 &&
         millis() - startTime < 1000UL) {
    if (CO2Serial.available()) {
      response[received++] = (byte)CO2Serial.read();
    }
    delay(1);
  }

  if (received != 9) {
    Serial.println("MH-Z19E: no complete response.");
    return false;
  }

  if (response[0] != 0xFF || response[1] != 0x86) {
    Serial.println("MH-Z19E: invalid response header.");
    return false;
  }

  byte checksum = 0;

  for (int i = 1; i < 8; i++) {
    checksum += response[i];
  }

  checksum = 0xFF - checksum + 1;

  if (checksum != response[8]) {
    Serial.println("MH-Z19E: checksum error.");
    return false;
  }

  ppm = ((int)response[2] << 8) | response[3];
  return true;
}

// =====================================================
// UPDATE CO2
// =====================================================
void updateCO2() {
  int newPPM = 0;

  if (readCO2Sensor(newPPM)) {
    co2ppm = newPPM;
    co2Available = true;

    Serial.print("CO2: ");
    Serial.print(co2ppm);
    Serial.println(" ppm");
  } else {
    co2Available = false;
  }
}

// =====================================================
// IR BEE COUNTER WITH DEBOUNCE
// =====================================================
void updateBeeCounter() {
  int reading = digitalRead(IR_PIN);
  unsigned long now = millis();

  if (reading != lastIRReading) {
    lastIRReading = reading;
    lastIRChangeTime = now;
  }

  if ((now - lastIRChangeTime) >= 5UL &&
      reading != stableIRState) {
    stableIRState = reading;

    if (stableIRState == IR_ACTIVE_LEVEL) {
      beeCount++;

      Serial.print("Bee detected. Total: ");
      Serial.println(beeCount);
    }
  }
}

// =====================================================
// LCD: THREE ROTATING SCREENS
// =====================================================
void updateLCD() {
  static uint8_t screen = 2;

  if (!lcdAvailable) return;

  screen = (screen + 1) % 3;

  char line1[17] = {0};
  char line2[17] = {0};

  if (screen == 0) {
    snprintf(line1, sizeof(line1), "T:%2.0fC H:%2.0f%%",
             temperatureC, humidity);

    snprintf(line2, sizeof(line2), "BEES:%lu", beeCount);
  }
  else if (screen == 1) {
    snprintf(line1, sizeof(line1), "HONEY WEIGHT");

    if (!hx711Initialized || !hx711Available) {
      snprintf(line2, sizeof(line2), "HX711 NOT READY");
    } else {
      snprintf(line2, sizeof(line2), "W:%.3f kg", weightKg);
    }
  }
  else {
    snprintf(line1, sizeof(line1), "CO2:%d ppm", co2ppm);
    snprintf(line2, sizeof(line2), "MQ:%d %.2fV",
             mq135Raw, mq135Voltage);
  }

  lcdPrintLine(0, line1);
  lcdPrintLine(1, line2);
}

// =====================================================
// SERIAL READINGS
// =====================================================
void printReadings() {
  Serial.println();
  Serial.println("========== HONEY HIVE MONITOR ==========");

  Serial.print("Temperature: ");
  Serial.print(temperatureC, 1);
  Serial.println(" C");

  Serial.print("Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  Serial.print("DHT11 status: ");
  Serial.println(dhtAvailable ? "OK" : "READ FAILED");

  Serial.print("CO2: ");
  if (co2Available) {
    Serial.print(co2ppm);
    Serial.println(" ppm");
  } else {
    Serial.println("Sensor read failed");
  }

  Serial.print("Weight: ");
  Serial.print(weightKg, 3);
  Serial.println(" kg");

  Serial.print("HX711 status: ");
  if (!hx711Initialized) {
    Serial.println("NOT INITIALIZED");
  } else {
    Serial.println(hx711Available ? "OK" : "NOT READY");
  }

  Serial.print("MQ135 ADC: ");
  Serial.println(mq135Raw);

  Serial.print("MQ135 voltage: ");
  Serial.print(mq135Voltage, 2);
  Serial.println(" V");

  Serial.print("Bee count: ");
  Serial.println(beeCount);

  Serial.print("IR pin level: ");
  Serial.println(digitalRead(IR_PIN) == HIGH ? "HIGH" : "LOW");

  Serial.println("========================================");
}

// =====================================================
// FIREBASE REST DATABASE UPLOAD
//
// Latest values:
// /HoneyHive/latest.json
//
// Historical records:
// /HoneyHive/history.json
//
// No Firebase email/password or API key.
// Requires database rules that allow unauthenticated writes.
// =====================================================
String makeFirebaseJSON() {
  String json;
  json.reserve(400);

  json  = "{";
  json += "\"temperatureC\":" + String(temperatureC, 2);
  json += ",\"humidity\":" + String(humidity, 2);
  json += ",\"co2ppm\":" + String(co2ppm);
  json += ",\"weightKg\":" + String(weightKg, 4);
  json += ",\"weightGrams\":" + String(weightKg * 1000.0f, 1);
  json += ",\"mq135Raw\":" + String(mq135Raw);
  json += ",\"mq135Voltage\":" + String(mq135Voltage, 3);
  json += ",\"beeCount\":" + String(beeCount);
  json += ",\"dhtAvailable\":";
  json += (dhtAvailable ? "true" : "false");
  json += ",\"co2Available\":";
  json += (co2Available ? "true" : "false");
  json += ",\"hx711Available\":";
  json += (hx711Available ? "true" : "false");
  json += ",\"timestampMillis\":" + String(millis());
  json += "}";

  return json;
}

// =====================================================
// SEND JSON TO FIREBASE
// method = "PUT" for latest data
// method = "POST" for historical data
// =====================================================
bool sendFirebaseRequest(const String& path,
                         const String& payload,
                         const char* method) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Firebase request skipped: WiFi disconnected.");
    return false;
  }

  WiFiClientSecure client;

  // Encryption is used, but certificate verification is disabled.
  // For production, validate the server certificate.
  client.setInsecure();

  HTTPClient https;

  String url = String(FIREBASE_DATABASE_URL) + path + ".json";

  if (!https.begin(client, url)) {
    Serial.println("Could not start Firebase HTTPS request.");
    return false;
  }

  https.setConnectTimeout(10000);
  https.setTimeout(10000);
  https.addHeader("Content-Type", "application/json");

  int httpCode;

  if (strcmp(method, "POST") == 0) {
    httpCode = https.POST(payload);
  } else {
    httpCode = https.PUT(payload);
  }

  bool success = (httpCode >= 200 && httpCode < 300);

  if (success) {
    Serial.print("Firebase ");
    Serial.print(path);
    Serial.print(" upload successful. HTTP: ");
    Serial.println(httpCode);
  } else {
    Serial.print("Firebase upload failed. HTTP: ");
    Serial.println(httpCode);

    if (httpCode > 0) {
      Serial.println(https.getString());
    } else {
      Serial.println(https.errorToString(httpCode));
    }
  }

  https.end();
  client.stop();

  return success;
}

// =====================================================
// UPLOAD TO FIREBASE
// =====================================================
void uploadToFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Firebase upload skipped: WiFi disconnected.");
    return;
  }

  String payload = makeFirebaseJSON();

  // Replace the latest sensor record.
  bool latestOK = sendFirebaseRequest(
    "/HoneyHive/latest",
    payload,
    "PUT"
  );

  // Add a new historical record with an automatic Firebase key.
  bool historyOK = sendFirebaseRequest(
    "/HoneyHive/history",
    payload,
    "POST"
  );

  if (latestOK && historyOK) {
    Serial.println("Firebase upload completed successfully.");
  } else {
    Serial.println("One or more Firebase uploads failed.");
  }
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("ESP32 HONEY HIVE MONITOR");
  Serial.println("------------------------");

  // LCD
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(0x27);

  if (Wire.endTransmission() == 0) {
    lcd.init();
    lcd.backlight();
    lcdAvailable = true;

    lcdPrintLine(0, "Honey Hive");
    lcdPrintLine(1, "Starting...");
  } else {
    Serial.println("LCD not detected at 0x27.");
    lcdAvailable = false;
  }

  // DHT11
  dht.begin();
  delay(1500);
  readDHT11();

  // MQ135
  analogReadResolution(12);
  pinMode(MQ135_PIN, INPUT);

  // HX711
  scale.begin(HX711_DT, HX711_SCK);
  lastHX711Retry = millis() - 1000UL;
  tryInitializeHX711();

  // MH-Z19E
  CO2Serial.begin(9600, SERIAL_8N1, CO2_RX_PIN, CO2_TX_PIN);

  // IR bee counter
  pinMode(IR_PIN, INPUT_PULLUP);

  lastIRReading = digitalRead(IR_PIN);
  stableIRState = lastIRReading;
  lastIRChangeTime = millis();

  Serial.print("Initial IR level: ");
  Serial.println(stableIRState == HIGH ? "HIGH" : "LOW");

  // WiFi
  connectWiFi();

  lastFirebaseUpload = millis();
  lastLCDUpdate = millis();
  lastCO2Read = millis();
  lastSensorRead = millis();

  Serial.println("Monitoring started.");
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
  unsigned long now = millis();

  // Count bees continuously.
  updateBeeCounter();

  // Environmental sensors and load cell.
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;

    readDHT11();
    readMQ135();
    readWeight();
  }

  // CO2 every 5 seconds.
  if (now - lastCO2Read >= CO2_INTERVAL) {
    lastCO2Read = now;
    updateCO2();
  }

  // Rotate LCD screens.
  if (now - lastLCDUpdate >= LCD_INTERVAL) {
    lastLCDUpdate = now;
    updateLCD();
  }

  // Firebase upload every 20 seconds.
  if (now - lastFirebaseUpload >= FIREBASE_INTERVAL) {
    lastFirebaseUpload = now;

    printReadings();
    uploadToFirebase();
  }

  // Reconnect WiFi when disconnected.
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;

    if (millis() - lastReconnectAttempt >= 10000UL) {
      lastReconnectAttempt = millis();

      Serial.println("Attempting WiFi reconnection...");
      WiFi.reconnect();
    }
  }

  delay(2);
}
