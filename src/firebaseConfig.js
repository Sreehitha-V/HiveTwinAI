import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, limitToLast } from 'firebase/database';

// Live Firebase configuration for HiveTwinAI project with Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyBz_gxQP6f_1kZsDsqBNOCa_AyJTMKRPc4",
  authDomain: "hivetwinai.firebaseapp.com",
  projectId: "hivetwinai",
  storageBucket: "hivetwinai.firebasestorage.app",
  messagingSenderId: "314959376364",
  appId: "1:314959376364:web:2cb27ca10418580f56dac9",
  measurementId: "G-Y5RQ3Z59VB",
  databaseURL: "https://hivetwinai-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let app = null;
let db = null;
let isFirebaseConfigured = false;

// Check if credentials are present (apiKey and projectId)
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getDatabase(app, "https://hivetwinai-default-rtdb.asia-southeast1.firebasedatabase.app");
    isFirebaseConfigured = true;
  } catch (error) {
    console.warn("Realtime Database initialization failed:", error);
    isFirebaseConfigured = false;
  }
} else {
  console.log("No Firebase configuration found.");
}

/**
 * Normalizes incoming Realtime Database JSON payload to match HiveTwin telemetry keys.
 * Handles incoming properties:
 * - temperatureC -> temperatureC & temp
 * - humidity -> humidity
 * - co2ppm -> co2ppm & co2
 * - weightKg -> weightKg & weight
 * - beeCount -> beeCount, traffic, 'bee traffic'
 * - mq135Raw -> mq135Raw
 * - mq135Voltage -> mq135Voltage
 * - honeyYield -> honeyYield (or calculated from weightKg)
 * - status -> status
 */
const normalizeSensorData = (raw) => {
  if (!raw) return null;
  const result = { ...raw };

  // 1. Temperature: temperatureC (or temp, temperature)
  const tempVal = raw.temperatureC ?? raw.temperature ?? raw.temp;
  if (tempVal !== undefined && tempVal !== null) {
    const parsed = typeof tempVal === 'string' ? parseFloat(tempVal) : Number(tempVal);
    if (!Number.isNaN(parsed)) {
      result.temperatureC = parsed;
      result.temp = parsed;
      result.temperature = parsed;
    }
  }

  // 2. Humidity
  if (raw.humidity !== undefined && raw.humidity !== null) {
    const parsed = typeof raw.humidity === 'string' ? parseFloat(raw.humidity) : Number(raw.humidity);
    if (!Number.isNaN(parsed)) {
      result.humidity = parsed;
    }
  }

  // 3. CO2: co2ppm (or co2)
  const co2Val = raw.co2ppm ?? raw.co2;
  if (co2Val !== undefined && co2Val !== null) {
    const parsed = typeof co2Val === 'string' ? parseFloat(co2Val) : Number(co2Val);
    if (!Number.isNaN(parsed)) {
      result.co2ppm = parsed;
      result.co2 = parsed;
    }
  }

  // 4. Weight: weightKg (or weight)
  const weightVal = raw.weightKg ?? raw.weight;
  if (weightVal !== undefined && weightVal !== null) {
    const parsed = typeof weightVal === 'string' ? parseFloat(weightVal) : Number(weightVal);
    if (!Number.isNaN(parsed)) {
      result.weightKg = parsed;
      result.weight = parsed;
    }
  }

  // 5. Bee Count / Traffic: beeCount (or 'bee traffic', beeTraffic, bee_traffic, traffic)
  const beeVal = raw.beeCount ?? raw['bee traffic'] ?? raw.beeTraffic ?? raw.bee_traffic ?? raw.traffic;
  if (beeVal !== undefined && beeVal !== null) {
    const parsed = typeof beeVal === 'string' ? parseFloat(beeVal) : Number(beeVal);
    if (!Number.isNaN(parsed)) {
      result.beeCount = parsed;
      result.traffic = parsed;
      result['bee traffic'] = parsed;
      result.beeTraffic = parsed;
      result.bee_traffic = parsed;
    }
  }

  // 6. MQ-135 Gas Sensor Raw ADC & Voltage
  if (raw.mq135Raw !== undefined && raw.mq135Raw !== null) {
    const parsed = typeof raw.mq135Raw === 'string' ? parseFloat(raw.mq135Raw) : Number(raw.mq135Raw);
    if (!Number.isNaN(parsed)) {
      result.mq135Raw = parsed;
    }
  }
  if (raw.mq135Voltage !== undefined && raw.mq135Voltage !== null) {
    const parsed = typeof raw.mq135Voltage === 'string' ? parseFloat(raw.mq135Voltage) : Number(raw.mq135Voltage);
    if (!Number.isNaN(parsed)) {
      result.mq135Voltage = parsed;
    }
  }

  // 7. Honey Yield (or estimate based on weight above tare)
  const honeyVal = raw.honeyYield ?? raw['honey yield'] ?? raw.honey;
  if (honeyVal !== undefined && honeyVal !== null) {
    const parsed = typeof honeyVal === 'string' ? parseFloat(honeyVal) : Number(honeyVal);
    if (!Number.isNaN(parsed)) {
      result.honeyYield = parsed;
    }
  } else if (result.weightKg !== undefined) {
    result.honeyYield = Math.max(0, parseFloat((result.weightKg - 25.0).toFixed(1)));
  }

  return result;
};

/**
 * Subscribes in real-time to Firebase Realtime Database at /HoneyHive/latest using onValue.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeToSensorData = (onDataReceived, onError) => {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  try {
    const hiveRef = ref(db, 'HoneyHive/latest');
    const unsubscribe = onValue(
      hiveRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const normalized = normalizeSensorData(val);
          if (normalized) {
            onDataReceived(normalized);
          }
        } else {
          console.log("Realtime Database: No data found at /HoneyHive/latest yet");
        }
      },
      (error) => {
        console.error("Firebase Realtime Database subscription error:", error);
        if (onError) onError(error);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.error("Error setting up Realtime Database listener for /HoneyHive/latest:", err);
    if (onError) onError(err);
    return null;
  }
};

/**
 * Subscribes to real-time historical logs from /HoneyHive/history (last 30 entries)
 */
export const subscribeToHistoryData = (onHistoryReceived, onError) => {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  try {
    const historyRef = query(ref(db, 'HoneyHive/history'), limitToLast(30));
    const unsubscribe = onValue(
      historyRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const points = [];
          if (Array.isArray(val)) {
            val.forEach((item, idx) => {
              if (item) {
                const norm = normalizeSensorData(item);
                const timeStr = item.time || item.timestamp || `T-${val.length - idx}`;
                points.push({
                  time: timeStr,
                  temp: norm.temperatureC !== undefined ? norm.temperatureC : (norm.temp ?? 0),
                  weight: norm.weightKg !== undefined ? norm.weightKg : (norm.weight ?? 0),
                  co2: norm.co2ppm !== undefined ? norm.co2ppm : (norm.co2 ?? 0)
                });
              }
            });
          } else if (typeof val === 'object') {
            Object.keys(val).forEach((k) => {
              const item = val[k];
              if (item) {
                const norm = normalizeSensorData(item);
                const timeStr = item.time || item.timestamp || k;
                points.push({
                  time: timeStr,
                  temp: norm.temperatureC !== undefined ? norm.temperatureC : (norm.temp ?? 0),
                  weight: norm.weightKg !== undefined ? norm.weightKg : (norm.weight ?? 0),
                  co2: norm.co2ppm !== undefined ? norm.co2ppm : (norm.co2 ?? 0)
                });
              }
            });
          }
          if (points.length > 0) {
            onHistoryReceived(points);
          }
        }
      },
      (error) => {
        console.warn("Realtime Database history subscription warning:", error);
        if (onError) onError(error);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.warn("Error setting up Realtime Database listener for /HoneyHive/history:", err);
    if (onError) onError(err);
    return null;
  }
};

export { isFirebaseConfigured, db };
