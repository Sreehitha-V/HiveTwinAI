import React, { useState, useEffect } from 'react';
import HiveCanvas from './components/HiveCanvas';
import MetricsDashboard from './components/MetricsDashboard';
import {
  PRESETS,
  PRESET_CONFIGS,
  getTelemetryStatus,
  generateInitialHistory,
  stepTelemetry
} from './utils/simulationEngine';
import { subscribeToSensorData, isFirebaseConfigured } from './firebaseConfig';

export default function App() {
  const [preset, setPreset] = useState(PRESETS.NORMAL);
  const [isExploded, setIsExploded] = useState(false);
  const [isFirebase, setIsFirebase] = useState(isFirebaseConfigured);

  // Initial telemetry state based on NORMAL preset
  const [telemetry, setTelemetry] = useState({
    temp: PRESET_CONFIGS[PRESETS.NORMAL].targetTemp,
    humidity: PRESET_CONFIGS[PRESETS.NORMAL].targetHumidity,
    weight: PRESET_CONFIGS[PRESETS.NORMAL].targetWeight,
    honeyYield: PRESET_CONFIGS[PRESETS.NORMAL].targetHoneyYield,
    co2: PRESET_CONFIGS[PRESETS.NORMAL].targetCO2,
    traffic: PRESET_CONFIGS[PRESETS.NORMAL].targetTraffic
  });

  // Rolling time-series data for Recharts
  const [history, setHistory] = useState(() => generateInitialHistory(PRESETS.NORMAL));

  // Firebase or Simulation polling loop
  useEffect(() => {
    let unsubscribeFirebase = null;

    if (isFirebase) {
      // Subscribe to real live data path /hive/sensor_data
      unsubscribeFirebase = subscribeToSensorData(
        (data) => {
          if (data) {
            setTelemetry((prev) => ({ ...prev, ...data }));
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setHistory((prevHist) => [
              ...prevHist.slice(-14),
              {
                time: timeStr,
                temp: data.temp || prev.temp,
                weight: data.weight || prev.weight,
                co2: data.co2 || prev.co2
              }
            ]);
          }
        },
        () => {
          // If error occurs, fall back to simulator
          setIsFirebase(false);
        }
      );
    }

    // Interval ticker for continuous live simulation updates
    const interval = setInterval(() => {
      if (!isFirebase) {
        setTelemetry((prev) => {
          const { telemetry: nextTelemetry, newHistoryPoint } = stepTelemetry(prev, preset);
          setHistory((prevHist) => [...prevHist.slice(-14), newHistoryPoint]);
          return nextTelemetry;
        });
      }
    }, 2500);

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      clearInterval(interval);
    };
  }, [preset, isFirebase]);

  // Handle toggling between Simulation Mode and Live Hardware Mode
  const handleToggleMode = () => {
    setIsFirebase((prev) => !prev);
  };

  // Handle simulation preset switch with instant dynamic state reset
  const handleSelectPreset = (newPreset) => {
    setPreset(newPreset);
    const cfg = PRESET_CONFIGS[newPreset];
    if (cfg) {
      setTelemetry({
        temp: cfg.targetTemp,
        humidity: cfg.targetHumidity,
        weight: cfg.targetWeight,
        honeyYield: cfg.targetHoneyYield,
        co2: cfg.targetCO2,
        traffic: cfg.targetTraffic
      });
      // Instantly generate fresh historical trend chart data matching the new scenario
      setHistory(generateInitialHistory(newPreset));
    }
  };

  const status = getTelemetryStatus(telemetry, preset);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-row bg-slate-100 font-sans select-none">
      
      {/* SECTION 1: THE LEFT COLUMN (Interactive 3D Single-Chamber Langstroth Twin) */}
      <div className="w-1/2 h-full relative border-r border-slate-200">
        <HiveCanvas
          telemetry={telemetry}
          status={status}
          preset={preset}
          isExploded={isExploded}
          onToggleExplode={() => setIsExploded(!isExploded)}
        />
      </div>

      {/* SECTION 2: THE RIGHT COLUMN (Live Numerical Cards & Recharts Graphs) */}
      <div className="w-1/2 h-full flex flex-col bg-white">
        <MetricsDashboard
          telemetry={telemetry}
          history={history}
          preset={preset}
          onSelectPreset={handleSelectPreset}
          isFirebase={isFirebase}
          onToggleMode={handleToggleMode}
        />
      </div>

    </div>
  );
}
