# HiveTwin AI: IoT-Enabled Smart Beehive Monitoring & 3D Digital Twin Platform

**HiveTwin AI** is an advanced, practical smart beehive monitoring system built for Langstroth hives, specifically optimized for apiary management and field deployment in Musullakunta village. It combines edge IoT sensor data acquisition with a clean, streamlined 3D web-based digital twin dashboard to provide real-time telemetry, automated emergency SMS alerts, and actionable colony health insights.

---

## 🚀 Live Deployment
- **Live Dashboard URL:** [Insert Vercel Deployment Link Here].
---

## 🐝 Key Features & Architecture Highlights

- **Real-Time Environmental Tracking:** Continuously monitors internal hive micro-climate parameters including temperature and humidity.
- **Biomass & Swarm Detection:** Integrates precision load cells to track hive mass changes, honey production, and sudden weight drops indicating swarming events.
- **Air Quality & Respiration Monitoring:** Tracks internal $CO_2$ levels to evaluate colony ventilation, with automatic audio-visual alerts and SMS dispatches when thresholds exceed safe limits.
- **Automated Emergency SMS Alerts:** Dispatches consolidated emergency text messages to apiary managers via Twilio/Brevo when temperature, $CO_2$, or weight anomalies are detected, complete with a built-in anti-spam cooldown[cite: 3].
- **Streamlined Farmer-First Dashboard:** Built using React.js, Vite, and Three.js; features a simplified layout free of developer clutter, putting top-level status cards and clear AI predictions & actionable recommendations right at the fingertips of the apiarist.

---

## 🛠️ System Stack & Modules

- **Hardware & Edge Controller:** ESP32 NodeMCU Wi-Fi SoC (`firmware/HiveTwinAI.ino`)
- **Cloud Infrastructure:** Firebase Realtime Database (`src/firebaseConfig.js` for JSON Telemetry Synchronization)
- **Alert & Notification Services:** Client-side and backend SMS dispatch modules (`smsService.js`, `twilio_sms_service.js`, `sms_alert_service.py`, `twilio_alert_service.py`)
- **Frontend Dashboard:** React.js, Vite, and Three.js 3D Web Rendering (`src/components/`, `src/utils/`, `src/assets/`)

---

## 📂 Repository Structure

```text
HiveTwinAI/
│
├── firmware/                 # ESP32 microcontroller sensor acquisition code
│   └── HiveTwinAI.ino        # Main firmware for telemetry & Firebase RTDB sync
│
├── public/                   # Static assets, icons, and favicons
│   ├── favicon.svg
│   └── icons.svg
│
├── src/                      # React.js frontend source code
│   ├── assets/               # Visual assets and images
│   ├── components/           # UI and 3D digital twin components
│   ├── utils/                # Helper utilities and calculation logic
│   ├── App.css               # Main stylesheet
│   ├── App.jsx               # Root React component
│   ├── firebaseConfig.js     # Firebase RTDB connection configuration
│   ├── index.css             # Global styles
│   ├── main.jsx              # React app entry point
│   └── smsService.js         # Frontend SMS trigger module
│
├── .env.example              # Template for environment variables
├── .gitignore                # Git exclusion rules
├── LICENSE                   # Project license
├── package.json              # Project dependencies and script configurations
├── package-lock.json         # Locked dependency versions
├── README.md                 # Project documentation
├── sms_alert_service.py      # Python backend script for Brevo SMS alerts
├── twilio_alert_service.py   # Python backend script for Twilio alerts
├── twilio_sms_service.js     # JavaScript utility for Twilio messaging
└── vite.config.js            # Vite build configuration
