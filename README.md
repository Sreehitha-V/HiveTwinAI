# HiveTwin AI: IoT-Enabled Smart Beehive Monitoring & 3D Digital Twin Platform

**HiveTwin AI** is an advanced, data-driven smart beehive monitoring system built for Langstroth hives. It combines edge IoT sensor data acquisition with an interactive 3D web-based digital twin dashboard to provide real-time telemetry, environmental tracking, and colony health insights.

---

## 🚀 Key Features

* **Real-Time Environmental Tracking:** Monitors internal hive micro-climate parameters including temperature, humidity, and airflow.
* **Biomass & Yield Tracking:** Integrates precision weight sensors to monitor hive mass changes and honey production trends.
* **Air Quality & Respiration Monitoring:** Tracks internal $CO_2$ and volatile organic compounds (VOCs) to evaluate colony ventilation and stress levels.
* **Entrance Traffic Analysis:** Utilizes optical infrared (IR) gates to track bee movement and flight activity at the hive entrance.
* **Interactive 3D Digital Twin:** Built using React.js and Three.js to render a layered visualization of a Langstroth hive, dynamically mapping live sensor states to visual components.

---

## 🛠️ System Architecture & Tech Stack

* **Hardware & Edge Controller:** ESP32 NodeMCU Wi-Fi SoC[cite: 10]
* **Sensors:** 
  * DHT22 (Temperature & Humidity)
  * HX711 Amplifier & 100kg Load Cell (Weight/Biomass)
  * MH-Z19E NDIR Sensor ($CO_2$)
  * MQ135 Gas Sensor ($VOC$)
  * Infrared (IR) Obstacle Gate Sensors (Bee Counter)
* **Cloud Infrastructure:** Firebase Realtime Database (JSON Telemetry Synchronization)
* **Frontend Dashboard:** React.js, Vite, and 3D Web Rendering

---

## 📂 Repository Structure

```text
HiveTwinAI/
│
├── firmware/                 # Contains ESP32 / Arduino sensor acquisition code
│   └── HiveTwinAI.ino        # Main microcontroller script for telemetry & Firebase sync
│
├── src/                      # React.js frontend source code & components
├── public/                   # Static assets, icons, and 3D models
├── package.json              # Project dependencies and script configurations
├── vite.config.js            # Vite build configuration
└── README.md                 # Project documentation
