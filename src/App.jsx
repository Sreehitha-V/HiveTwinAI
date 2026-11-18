import React, { useState, useEffect, useRef } from 'react';
import HiveCanvas from './components/HiveCanvas';
import MetricsDashboard from './components/MetricsDashboard';
import { getTelemetryStatus } from './utils/telemetryUtils';
import { subscribeToSensorData, subscribeToHistoryData } from './firebaseConfig';
import {
  DEMO_PRESETS,
  generateDemoHistory,
  analyzeTelemetryTrends
} from './utils/predictionUtils';
import {
  startAlertLoop,
  stopAlertLoop,
  playTestBeep
} from './utils/audioAlert';
import { sendAlertToMultipleFarmers } from './smsService.js';

// Recipient phone numbers for emergency farmer notifications (E.164 format)
const farmerContacts = [
  "+918639707203", // Farmer 1 (Primary Apiary Manager)
  "+919390864498", // Farmer 2 (Field Technician)
  "+918978015426"  // Farmer 3 (Apiary Inspector)
];

export default function App() {
  const [isExploded, setIsExploded] = useState(false);

  // Simulation / Demo Mode State
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('NORMAL');

  // High-temperature audio alert configuration state
  const [isMuted, setIsMuted] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('hivetwin_audio_muted') === 'true';
  });
  const [alertThreshold, setAlertThreshold] = useState(() => {
    if (typeof window === 'undefined') return 36.0;
    const saved = localStorage.getItem('hivetwin_temp_threshold');
    return saved ? parseFloat(saved) : 36.0;
  });

  // Active telemetry state (null while waiting for live hardware or simulation)
  const [telemetry, setTelemetry] = useState(null);

  // Rolling time-series data for Recharts
  const [history, setHistory] = useState([]);

  // Store background live references so toggling back to Live Mode restores state immediately
  const liveTelemetryRef = useRef(null);
  const liveHistoryRef = useRef([]);

  // Live Firebase Realtime Database subscription (/HoneyHive/latest and /HoneyHive/history)
  useEffect(() => {
    const unsubSensors = subscribeToSensorData(
      (data) => {
        if (data) {
          liveTelemetryRef.current = data;

          if (!isSimulationMode) {
            setTelemetry((prev) => {
              const next = { ...(prev || {}), ...data };
              const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              setHistory((prevHist) => {
                const newPoint = {
                  time: timeStr,
                  temp: next.temperatureC !== undefined ? next.temperatureC : (next.temp ?? 0),
                  weight: next.weightKg !== undefined ? next.weightKg : (next.weight ?? 0),
                  co2: next.co2ppm !== undefined ? next.co2ppm : (next.co2 ?? 0)
                };
                const updated = [...prevHist.slice(-19), newPoint];
                liveHistoryRef.current = updated;
                return updated;
              });

              return next;
            });
          }
        }
      },
      (err) => {
        console.warn("RTDB sensor subscription warning:", err);
      }
    );

    const unsubHistory = subscribeToHistoryData(
      (historyPoints) => {
        if (historyPoints && historyPoints.length > 0) {
          liveHistoryRef.current = historyPoints;
          if (!isSimulationMode) {
            setHistory(historyPoints);
          }
        }
      },
      (err) => {
        console.warn("RTDB history subscription warning:", err);
      }
    );

    return () => {
      if (unsubSensors) unsubSensors();
      if (unsubHistory) unsubHistory();
    };
  }, [isSimulationMode]);

  // Handle switching between Live Hardware Data and Simulation / Demo Mode
  const handleToggleSimulationMode = () => {
    setIsSimulationMode((prev) => {
      const next = !prev;
      if (next) {
        // Entering simulation mode: initialize with NORMAL preset or current values
        setSelectedPreset('NORMAL');
        setTelemetry(DEMO_PRESETS.NORMAL.telemetry);
        setHistory(generateDemoHistory('NORMAL'));
      } else {
        // Exiting simulation mode: restore real live hardware stream
        if (liveTelemetryRef.current) {
          setTelemetry(liveTelemetryRef.current);
        } else {
          setTelemetry(null);
        }
        if (liveHistoryRef.current && liveHistoryRef.current.length > 0) {
          setHistory(liveHistoryRef.current);
        } else {
          setHistory([]);
        }
      }
      return next;
    });
  };

  // Handle selecting a preset emergency demo scenario
  const handleSelectPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    const preset = DEMO_PRESETS[presetKey];
    if (preset) {
      setTelemetry(preset.telemetry);
      setHistory(generateDemoHistory(presetKey));
    }
  };

  // Handle manual slider adjustments in simulation mode
  const handleUpdateSimulation = (field, value) => {
    const numVal = parseFloat(value);
    setTelemetry((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (field === 'temperatureC') {
        next.temperatureC = numVal;
        next.temp = numVal;
      } else if (field === 'co2ppm') {
        next.co2ppm = numVal;
        next.co2 = numVal;
      } else if (field === 'beeCount') {
        next.beeCount = numVal;
        next.traffic = numVal;
        next['bee traffic'] = numVal;
      } else if (field === 'weightKg') {
        next.weightKg = numVal;
        next.weight = numVal;
        next.honeyYield = Math.max(0, parseFloat((numVal - 25.0).toFixed(1)));
      }
      return next;
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory((prevHist) => [
      ...prevHist.slice(-19),
      {
        time: timeStr,
        temp: field === 'temperatureC' ? numVal : (telemetry?.temperatureC ?? telemetry?.temp ?? 34.8),
        weight: field === 'weightKg' ? numVal : (telemetry?.weightKg ?? telemetry?.weight ?? 42.5),
        co2: field === 'co2ppm' ? numVal : (telemetry?.co2ppm ?? telemetry?.co2 ?? 600)
      }
    ]);
  };

  const status = getTelemetryStatus(telemetry);

  // Predictive trend analysis evaluated over current telemetry & recent history
  const prediction = analyzeTelemetryTrends(history, telemetry);

  const currentTemp = telemetry ? (telemetry.temperatureC ?? telemetry.temp ?? 0) : 0;
  const currentCO2 = telemetry ? (telemetry.co2ppm ?? telemetry.co2 ?? 0) : 0;
  const isHighTempAlert = Boolean(telemetry && currentTemp > alertThreshold);
  const isCo2SpikeAlert = Boolean(telemetry && currentCO2 > 1200);
  const isAudioAlertActive = Boolean(isHighTempAlert || isCo2SpikeAlert);

  // Synthesized Web Audio alert loop for high-temperature and CO2 spike warnings
  useEffect(() => {
    if (isAudioAlertActive && !isMuted) {
      startAlertLoop(3000);
    } else {
      stopAlertLoop();
    }

    return () => {
      stopAlertLoop();
    };
  }, [isAudioAlertActive, isMuted]);

  // Tracking refs for automatic threshold monitoring and SMS dispatching
  const previousWeightRef = useRef(null);
  const lastAlertSignatureRef = useRef('');
  const lastAlertTimeRef = useRef(0);

  // AUTOMATIC THRESHOLD MONITORING & SMS ALERT DISPATCHER
  useEffect(() => {
    if (!telemetry) return;

    const sensorData = telemetry;
    const temp = sensorData.temperature !== undefined 
      ? sensorData.temperature 
      : (sensorData.temperatureC ?? sensorData.temp);
    const co2 = sensorData.co2ppm !== undefined 
      ? sensorData.co2ppm 
      : sensorData.co2;
    const currentWeight = sensorData.weight !== undefined 
      ? sensorData.weight 
      : (sensorData.weightKg ?? null);

    const warnings = [];

    // 1. Temperature Threshold: If sensorData.temperature > 37, flag a high temperature warning
    if (temp !== undefined && temp !== null && temp > 37) {
      warnings.push(`High Temperature Warning: ${Number(temp).toFixed(1)}°C (Exceeds 37°C safe limit)`);
    }

    // 2. CO2 / Air Quality Threshold: If sensorData.co2ppm > 1200, flag a critical high CO2 spike warning
    if (co2 !== undefined && co2 !== null && co2 > 1200) {
      warnings.push(`Critical High CO2 Spike Warning: ${Math.round(co2)} ppm (Exceeds 1200 ppm safe limit)`);
    }

    // 3. Weight Threshold: If a sudden weight drop/loss is detected, flag a swarming alert
    let isSwarmDrop = false;
    let weightLossAmount = 0;

    if (previousWeightRef.current !== null && currentWeight !== null) {
      const drop = previousWeightRef.current - currentWeight;
      if (drop >= 0.35) {
        isSwarmDrop = true;
        weightLossAmount = drop;
      }
    }

    // Fallbacks: trend analysis weight drop or mass loss alongside heavy traffic
    if (!isSwarmDrop && prediction?.metrics?.weightDelta <= -0.45) {
      isSwarmDrop = true;
      weightLossAmount = Math.abs(prediction.metrics.weightDelta);
    } else if (!isSwarmDrop && currentWeight !== null && currentWeight < 38.0 && ((sensorData.beeCount ?? 0) >= 400 || (sensorData.traffic ?? 0) >= 400)) {
      isSwarmDrop = true;
      weightLossAmount = 42.5 - currentWeight;
    }

    if (isSwarmDrop) {
      warnings.push(`Swarming Alert: Sudden Hive Weight Loss Detected (-${weightLossAmount.toFixed(2)} kg departure)`);
    }

    // Baseline weight update
    if (currentWeight !== null) {
      if (previousWeightRef.current === null || currentWeight >= previousWeightRef.current || !isSwarmDrop) {
        previousWeightRef.current = currentWeight;
      }
    }

    // 4. Construct consolidated emergency message and call sendAlertToMultipleFarmers
    if (warnings.length > 0) {
      const alertSignature = warnings.slice().sort().join('|');
      const now = Date.now();
      const COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown for identical active alerts

      if (alertSignature !== lastAlertSignatureRef.current || (now - lastAlertTimeRef.current) > COOLDOWN_MS) {
        lastAlertSignatureRef.current = alertSignature;
        lastAlertTimeRef.current = now;

        const alertMessage = (
          `[HiveTwinAI EMERGENCY ALERT] Langstroth Hive-01 Threshold Breach:\n` +
          warnings.map((w) => `• ${w}`).join('\n') +
          `\nImmediate apiary action required.`
        );

        console.warn("[Threshold Monitor] Safety threshold breached! Dispatching SMS alerts to farmers:", warnings);
        sendAlertToMultipleFarmers(farmerContacts, alertMessage);
      }
    } else {
      // Clear signature once all sensors normalize so subsequent breaches trigger immediately
      if (lastAlertSignatureRef.current) {
        lastAlertSignatureRef.current = '';
      }
    }
  }, [telemetry, prediction]);

  // Handle mute/unmute toggle
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hivetwin_audio_muted', String(next));
      }
      if (prev) {
        // If transitioning from muted to unmuted, play quick test sound
        playTestBeep();
      }
      return next;
    });
  };

  // Handle customizable threshold adjustment
  const handleChangeThreshold = (newThreshold) => {
    const clamped = Math.max(30.0, Math.min(45.0, parseFloat(newThreshold) || 36.0));
    setAlertThreshold(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hivetwin_temp_threshold', String(clamped));
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-row bg-slate-100 font-sans select-none">
      
      {/* SECTION 1: THE LEFT COLUMN (Interactive 3D Single-Chamber Langstroth Twin) */}
      <div className="w-1/2 h-full relative border-r border-slate-200">
        <HiveCanvas
          telemetry={telemetry}
          status={status}
          isExploded={isExploded}
          onToggleExplode={() => setIsExploded(!isExploded)}
        />
      </div>

      {/* SECTION 2: THE RIGHT COLUMN (Live Numerical Cards, Predictions, Simulations & Charts) */}
      <div className="w-1/2 h-full flex flex-col bg-slate-50/50 backdrop-blur-xs">
        <MetricsDashboard
          telemetry={telemetry}
          history={history}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          alertThreshold={alertThreshold}
          onChangeThreshold={handleChangeThreshold}
          isHighTempAlert={isHighTempAlert}
          isCo2SpikeAlert={isCo2SpikeAlert}
          isAudioAlertActive={isAudioAlertActive}
          onTestSound={playTestBeep}
          isSimulationMode={isSimulationMode}
          onToggleSimulationMode={handleToggleSimulationMode}
          selectedPreset={selectedPreset}
          onSelectPreset={handleSelectPreset}
          onUpdateSimulation={handleUpdateSimulation}
          prediction={prediction}
        />
      </div>

    </div>
  );
}
