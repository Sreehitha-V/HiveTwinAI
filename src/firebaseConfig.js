import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// Firebase configuration placeholder. Replace with your actual credentials.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

let db = null;
let isFirebaseConfigured = false;

// Check if credentials are present
if (firebaseConfig.databaseURL && firebaseConfig.apiKey) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    isFirebaseConfigured = true;
  } catch (error) {
    console.warn("Firebase initialization failed, using simulation mode:", error);
    isFirebaseConfigured = false;
  }
} else {
  console.log("No Firebase configuration found. Initializing HiveTwin AI in Simulation Fallback Mode.");
}

/**
 * Subscribes to real-time sensor updates from `/hive/sensor_data` if Firebase is connected.
 * Returns an unsubscribe function or null if relying on simulator fallback.
 */
export const subscribeToSensorData = (onDataReceived, onError) => {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const sensorRef = ref(db, 'hive/sensor_data');
  const unsubscribe = onValue(
    sensorRef,
    (snapshot) => {
      const data = snapshot.val();
      if (data) {
        onDataReceived(data);
      }
    },
    (err) => {
      console.error("Firebase Realtime Database error:", err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
};

export { isFirebaseConfigured };
