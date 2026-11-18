import React from 'react';
import {
  Thermometer,
  Droplets,
  Scale,
  Wind,
  Activity,
  Database,
  TrendingUp,
  Volume2,
  VolumeX,
  Sliders,
  Radio,
  Gauge,
  AlertTriangle,
  Sparkles,
  BrainCircuit,
  CheckCircle2
} from 'lucide-react';
import { DEMO_PRESETS } from '../utils/predictionUtils';

export default function MetricsDashboard({
  telemetry,
  history = [],
  isMuted = false,
  onToggleMute,
  alertThreshold = 36.0,
  onChangeThreshold,
  isHighTempAlert = false,
  isCo2SpikeAlert = false,
  isAudioAlertActive = false,
  onTestSound,
  isSimulationMode = false,
  onToggleSimulationMode,
  selectedPreset = 'NORMAL',
  onSelectPreset,
  onUpdateSimulation,
  prediction = null
}) {

  // Safe resolved values
  const currentTemp = telemetry ? (telemetry.temperatureC ?? telemetry.temp ?? 0) : 0;
  const currentHumidity = telemetry ? (telemetry.humidity ?? 0) : 0;
  const currentWeight = telemetry ? (telemetry.weightKg ?? telemetry.weight ?? 0) : 0;
  const currentCO2 = telemetry ? (telemetry.co2ppm ?? telemetry.co2 ?? 0) : 0;
  const currentBeeCount = telemetry ? (telemetry.beeCount ?? telemetry['bee traffic'] ?? telemetry.traffic ?? 0) : 0;
  const currentMQ135Raw = telemetry?.mq135Raw;
  const currentMQ135Voltage = telemetry?.mq135Voltage;
  const currentHoneyYield = telemetry?.honeyYield ?? Math.max(0, currentWeight - 25.0);

  // Effective alert active flag (Temp > threshold OR CO2 > 1200 ppm)
  const isAlarmSounding = Boolean(isAudioAlertActive || isHighTempAlert || isCo2SpikeAlert);

  // Status helper badges
  const getTempStatusBadge = (temp) => {
    if (temp >= 38.5) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100/90 text-red-700 border border-red-200">OVERHEAT CRITICAL</span>;
    } else if (temp >= 36.5) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-700 border border-amber-200">WARM</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-700 border border-emerald-200">IDEAL</span>;
  };

  const getCO2StatusBadge = (co2) => {
    if (co2 >= 1500) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100/90 text-red-700 border border-red-200">POOR VENTILATION</span>;
    } else if (co2 >= 1200) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100/90 text-rose-700 border border-rose-300">CRITICAL SPIKE</span>;
    } else if (co2 >= 1000) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-700 border border-amber-200">ELEVATED</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-700 border border-emerald-200">FRESH</span>;
  };

  const getGasStatusBadge = (rawVal) => {
    if (rawVal === undefined || rawVal === null) return null;
    if (rawVal > 500) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-800 border border-amber-200">HIGH VOC</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-700 border border-emerald-200">NORMAL AIR</span>;
  };

  return (
    <div className="w-full h-full bg-slate-50/70 backdrop-blur-lg flex flex-col overflow-hidden text-slate-800">
      
      {/* HEADER BAR WITH GLASSMORPHISM & MODE CONTROLS */}
      <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white/75 backdrop-blur-md sticky top-0 z-10 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Telemetry & Tele-Diagnostics
          </h2>
          <p className="text-xs text-slate-500 font-medium">Real-time RTDB stream, predictive AI warnings & stage simulation</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* MUTE / UNMUTE AUDIO ALERT TOGGLE BUTTON */}
          <button
            onClick={onToggleMute}
            type="button"
            title={isMuted ? "Unmute hazard audio alarm" : "Mute hazard audio alarm"}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none ${
              isAlarmSounding && !isMuted
                ? 'bg-rose-50/90 text-rose-700 border-rose-300 ring-2 ring-rose-400/40 animate-pulse backdrop-blur-sm'
                : isMuted
                ? 'bg-white/80 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700 backdrop-blur-sm'
                : 'bg-emerald-50/80 text-emerald-800 border-emerald-300 hover:bg-emerald-100 backdrop-blur-sm'
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                <span>Audio Muted</span>
              </>
            ) : isAlarmSounding ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                </span>
                <Volume2 className="w-4 h-4 text-rose-600 animate-bounce" />
                <span className="text-rose-700">Alarm Beeping</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>Audio Alert Active</span>
              </>
            )}
          </button>

          {/* SIMULATION / LIVE DATA TOGGLE SWITCH BUTTON */}
          <button
            onClick={onToggleSimulationMode}
            type="button"
            title="Click to toggle between Live Realtime Database and Simulation & Demo Mode"
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none backdrop-blur-sm ${
              isSimulationMode
                ? 'bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/30'
                : 'bg-emerald-50/90 text-emerald-800 border-emerald-300 hover:bg-emerald-100 ring-2 ring-emerald-400/30'
            }`}
          >
            {isSimulationMode ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600" />
                </span>
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Simulation & Demo Mode</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                </span>
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Live Data (/HoneyHive/latest)</span>
              </>
            )}

            {/* TOGGLE KNOB VISUAL */}
            <div
              className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ml-1 ${
                isSimulationMode ? 'bg-amber-500 justify-end' : 'bg-emerald-600 justify-start'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-white shadow-2xs" />
            </div>
          </button>
        </div>
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* LOADING STATE WHEN WAITING FOR INITIAL LIVE HARDWARE DATA */}
        {!telemetry && !isSimulationMode ? (
          <div className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[460px] bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-600 shadow-sm mb-4">
              <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-amber-300 opacity-60" />
              <Radio className="w-8 h-8 relative z-10 animate-pulse text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              Waiting for hardware telemetry...
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Connected to Firebase Realtime Database endpoint <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">/HoneyHive/latest</span>.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Awaiting live hardware payload or switch to Simulation Mode to test scenarios on stage.
            </p>
            
            <button
              onClick={onToggleSimulationMode}
              type="button"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Launch Stage Simulation Mode
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-lg">
              {['temperatureC', 'humidity', 'co2ppm', 'weightKg', 'beeCount', 'mq135Raw', 'mq135Voltage'].map((field) => (
                <span key={field} className="px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 text-slate-600 text-[11px] font-mono flex items-center gap-1.5 shadow-2xs backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 1. TOP SECTION: LIVE DATA / SIMULATION STATUS INDICATOR CARD */}
            <div className="space-y-3">
              <div className="bg-white/85 backdrop-blur-md rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    isSimulationMode ? 'bg-amber-100/90 text-amber-700' : 'bg-emerald-100/90 text-emerald-700'
                  }`}>
                    {isSimulationMode ? <Sparkles className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>{isSimulationMode ? 'Stage Simulation Mode: Running' : 'ESP32 Hardware Stream: Live Connected'}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        isSimulationMode ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isSimulationMode ? `Preset: ${selectedPreset}` : '/HoneyHive/latest'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {isSimulationMode
                        ? 'Simulated telemetry driving 3D Three.js canvas, audio hazard siren, and predictive AI'
                        : 'Live bi-directional telemetry synchronized via Firebase Realtime Database'}
                    </p>
                  </div>
                </div>
                {telemetry?.status && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
                    Colony: {telemetry.status}
                  </span>
                )}
              </div>

              {/* SIMULATION & DEMO CONTROLS PANEL (Visible in Simulation Mode) */}
              {isSimulationMode && (
                <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-amber-300 p-4 space-y-3.5 shadow-sm ring-2 ring-amber-400/20 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                        Stage Demonstration & Scenario Controls
                      </h3>
                      <p className="text-[11px] text-slate-500">Trigger emergency scenarios to test 3D twin reactions & hazard sirens</p>
                    </div>
                  </div>

                  {/* PRESET EMERGENCY SCENARIO BUTTONS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.keys(DEMO_PRESETS).map((key) => {
                      const preset = DEMO_PRESETS[key];
                      const isActive = selectedPreset === key;

                      let activeClass = 'bg-slate-900 text-white border-slate-900 shadow-md';
                      if (key === 'NORMAL') activeClass = 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300';
                      else if (key === 'TEMP_SURGE') activeClass = 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300 animate-pulse';
                      else if (key === 'CO2_SPIKE') activeClass = 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300 animate-pulse';
                      else if (key === 'WEIGHT_DROP') activeClass = 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300';

                      return (
                        <button
                          key={key}
                          onClick={() => onSelectPreset(key)}
                          type="button"
                          className={`p-2.5 rounded-xl text-left transition-all border text-xs font-semibold cursor-pointer ${
                            isActive
                              ? activeClass
                              : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">{preset.shortName}</span>
                            {isActive && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                          </div>
                          <div className={`text-[10px] mt-0.5 truncate font-normal ${isActive ? 'text-white/90' : 'text-slate-500'}`}>
                            {key === 'NORMAL' ? '34.8°C | 580ppm' : key === 'TEMP_SURGE' ? '39.4°C Alert' : key === 'CO2_SPIKE' ? '1850ppm Haze' : 'Swarm Exit'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* SCENARIO DESCRIPTION SUMMARY */}
                  <div className="text-xs bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 flex items-start gap-2 text-amber-900">
                    <span className="font-bold shrink-0 text-[10px] uppercase bg-amber-200/80 px-1.5 py-0.5 rounded">Scenario:</span>
                    <span>{DEMO_PRESETS[selectedPreset]?.description}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. ACTIVE AUDIBLE HAZARD ALERT BANNER (High Temp OR Critical CO2 Spike) */}
            {(isHighTempAlert || isCo2SpikeAlert) && (
              <div
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-xs backdrop-blur-md ${
                  isMuted
                    ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                    : 'bg-rose-50/90 border-rose-300 text-rose-900 ring-2 ring-rose-400/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isMuted ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-bold text-xs tracking-tight">
                      <span className={isMuted ? 'text-amber-900' : 'text-rose-900'}>
                        {isHighTempAlert && isCo2SpikeAlert
                          ? 'CRITICAL HAZARD: HIGH-TEMP & CO₂ SPIKE ALARM ACTIVE'
                          : isHighTempAlert
                          ? 'HIGH-TEMPERATURE THERMAL ALERT ACTIVE'
                          : 'CRITICAL CO₂ SPIKE AIR QUALITY ALERT ACTIVE'}
                      </span>
                      {isHighTempAlert && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border border-current shadow-2xs">
                          {currentTemp.toFixed(1)}°C &gt; {alertThreshold.toFixed(1)}°C Limit
                        </span>
                      )}
                      {isCo2SpikeAlert && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border border-current shadow-2xs">
                          {Math.round(currentCO2)} ppm &gt; 1200 ppm Limit
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {isMuted
                        ? 'Audio alarm is muted. Brood chamber overheating or suffocation risk detected!'
                        : 'Audible hazard siren is sounding. Immediate ventilation or apiary intervention required.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {onTestSound && (
                    <button
                      onClick={onTestSound}
                      type="button"
                      title="Test synthesized alert beep"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                    >
                      Test Sound
                    </button>
                  )}
                  <button
                    onClick={onToggleMute}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                      isMuted
                        ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                        : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-rose-200'
                    }`}
                  >
                    {isMuted ? 'Unmute Audio' : 'Mute Alarm'}
                  </button>
                </div>
              </div>
            )}

            {/* 3. AI PREDICTION & RECOMMENDATION BLOCK */}
            {prediction && (
              <div
                className={`p-4 rounded-2xl border transition-all shadow-xs backdrop-blur-md ${
                  prediction.primaryWarning?.level === 'CRITICAL'
                    ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/25 text-rose-950'
                    : prediction.primaryWarning?.level === 'WARNING'
                    ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-400/25 text-purple-950'
                    : 'bg-emerald-50/85 border-emerald-300/80 text-emerald-950'
                }`}
              >
                {/* Header: Clean Title "AI Prediction & Recommendation" + Core Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-current/15">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        prediction.primaryWarning?.level === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 animate-pulse'
                          : prediction.primaryWarning?.level === 'WARNING'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {prediction.primaryWarning?.level === 'CRITICAL' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : prediction.primaryWarning?.level === 'WARNING' ? (
                        <BrainCircuit className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      AI Prediction & Recommendation
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs self-start sm:self-auto ${
                      prediction.primaryWarning?.level === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : prediction.primaryWarning?.level === 'WARNING'
                        ? 'bg-purple-600 text-white border-purple-700'
                        : 'bg-emerald-600 text-white border-emerald-700'
                    }`}
                  >
                    {prediction.primaryWarning?.badgeText || 'STABLE FORECAST'}
                  </span>
                </div>

                {/* Derivation Directly from Recent Metric Trends */}
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Derived from Recent 15m Metric Trends:</span>
                    <span className="font-mono text-[9px] text-slate-400">Rolling Trajectory</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-200/80 shadow-2xs flex flex-col justify-center">
                      <span className="text-slate-500 font-sans text-[10px]">15m Temp:</span>
                      <span className="font-bold text-slate-900 text-xs mt-0.5">{prediction.metrics?.projectedTemp15m}°C</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-200/80 shadow-2xs flex flex-col justify-center">
                      <span className="text-slate-500 font-sans text-[10px]">15m CO₂:</span>
                      <span className="font-bold text-slate-900 text-xs mt-0.5">{prediction.metrics?.projectedCO215m} ppm</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-200/80 shadow-2xs flex flex-col justify-center">
                      <span className="text-slate-500 font-sans text-[10px]">Weight Trend:</span>
                      <span className={`font-bold text-xs mt-0.5 ${prediction.metrics?.weightDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {prediction.metrics?.weightDelta >= 0 ? '+' : ''}{prediction.metrics?.weightDelta} kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Actionable Practical Recommendation */}
                <div className="mt-3 p-2.5 rounded-xl bg-white/85 border border-current/20 flex items-start gap-2 text-xs">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-700 shrink-0 mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    Recommendation:
                  </span>
                  <span className="font-medium text-slate-800 leading-relaxed">
                    {prediction.primaryWarning?.recommendation || 'All sensor trends within target brood incubation envelopes. Normal queen egg-laying active.'}
                  </span>
                </div>
              </div>
            )}

            {/* 4. LIVE NUMERICAL METRIC CARDS (GLASSMORPHISM 3x2 GRID) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Real-Time Telemetry Cards
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                
                {/* CARD 1: Core Temperature */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentTemp >= 38.5 || isHighTempAlert
                    ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/25'
                    : currentTemp >= 36.5
                    ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/20'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentTemp >= 38.5 || isHighTempAlert
                        ? 'bg-rose-100 text-rose-600 animate-pulse'
                        : currentTemp >= 36.5
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-50 text-rose-600'
                    }`}>
                      <Thermometer className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getTempStatusBadge(currentTemp)}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Core Temperature (temperatureC)</span>
                      {isHighTempAlert && (
                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                          {isMuted ? <VolumeX className="w-3 h-3 text-slate-400" /> : <Volume2 className="w-3 h-3 text-rose-600 animate-bounce" />}
                          ALERT ACTIVE
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentTemp >= 38.5 ? 'text-rose-700' : currentTemp >= 36.5 ? 'text-amber-800' : 'text-slate-900'
                    }`}>
                      {currentTemp.toFixed(1)} <span className="text-base font-bold text-slate-500">°C</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Optimal Target: 34.5 - 35.5 °C</div>
                  </div>

                  {/* ALARM THRESHOLD CUSTOMIZATION CONTROL */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      <span>Alert Trigger:</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onChangeThreshold && onChangeThreshold(alertThreshold - 0.5)}
                        title="Lower safe threshold by 0.5°C"
                        type="button"
                        className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-800 text-xs px-1">&gt; {alertThreshold.toFixed(1)}°C</span>
                      <button
                        onClick={() => onChangeThreshold && onChangeThreshold(alertThreshold + 0.5)}
                        title="Raise safe threshold by 0.5°C"
                        type="button"
                        className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Relative Humidity */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentHumidity >= 70.0
                    ? 'bg-sky-50/90 border-sky-300 ring-2 ring-sky-400/25'
                    : currentHumidity < 45.0 && currentHumidity > 0
                    ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/20'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentHumidity >= 70.0
                        ? 'bg-sky-100 text-sky-700 animate-pulse'
                        : currentHumidity < 45.0 && currentHumidity > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-sky-50 text-sky-600'
                    }`}>
                      <Droplets className="w-5 h-5" />
                    </div>
                    {currentHumidity >= 70.0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-300">
                        HIGH HUMIDITY
                      </span>
                    ) : currentHumidity < 45.0 && currentHumidity > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        DRY CHILL
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 border border-sky-200">
                        OPTIMAL (50-65%)
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="text-xs text-slate-500 font-medium">Relative Humidity (humidity)</span>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentHumidity >= 70.0 ? 'text-sky-900' : currentHumidity < 45.0 && currentHumidity > 0 ? 'text-amber-900' : 'text-slate-900'
                    }`}>
                      {currentHumidity.toFixed(1)} <span className="text-base font-bold text-slate-500">%</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Brood incubation standard: 50 - 65%</div>
                  </div>
                </div>

                {/* CARD 3: Hive Weight & Honey Yield */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentWeight < 38.0 && currentWeight > 0
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/25'
                    : currentWeight >= 44.0
                    ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/20'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentWeight < 38.0 && currentWeight > 0
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : currentWeight >= 44.0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      <Scale className="w-5 h-5" />
                    </div>
                    {currentWeight < 38.0 && currentWeight > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        RAPID LOSS / SWARM
                      </span>
                    ) : currentWeight >= 44.0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                        HONEY SURPLUS: {currentHoneyYield.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        HONEY: {currentHoneyYield.toFixed(1)} kg
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="text-xs text-slate-500 font-medium">Total Hive Mass (weightKg)</span>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentWeight < 38.0 && currentWeight > 0 ? 'text-amber-900' : 'text-slate-900'
                    }`}>
                      {currentWeight.toFixed(2)} <span className="text-base font-bold text-slate-500">kg</span>
                    </div>
                    <div className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                      currentWeight < 38.0 && currentWeight > 0 ? 'text-amber-700' : 'text-emerald-600'
                    }`}>
                      <TrendingUp className="w-3 h-3" /> Live load-cell reading
                    </div>
                  </div>
                </div>

                {/* CARD 4: CO2 Concentration */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentCO2 >= 1500 || isCo2SpikeAlert
                    ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-400/30'
                    : currentCO2 >= 1000
                    ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/20'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentCO2 >= 1500 || isCo2SpikeAlert
                        ? 'bg-purple-100 text-purple-700 animate-pulse'
                        : currentCO2 >= 1000
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <Wind className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getCO2StatusBadge(currentCO2)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">CO₂ Concentration (co2ppm)</span>
                      {isCo2SpikeAlert && (
                        <span className="text-[10px] font-bold text-purple-700 flex items-center gap-1">
                          {isMuted ? <VolumeX className="w-3 h-3 text-slate-400" /> : <Volume2 className="w-3 h-3 text-purple-600 animate-bounce" />}
                          SIREN ACTIVE
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentCO2 >= 1200 ? 'text-purple-900' : currentCO2 >= 1000 ? 'text-amber-900' : 'text-slate-900'
                    }`}>
                      {Math.round(currentCO2)} <span className="text-base font-bold text-slate-500">ppm</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Airflow circulation safety limit: 1200 ppm</div>
                  </div>
                </div>

                {/* CARD 5: Entrance Bee Count / Traffic */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentBeeCount >= 400
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/30'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentBeeCount >= 400
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : currentBeeCount >= 100
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-slate-50 text-slate-600'
                    }`}>
                      <Activity className="w-5 h-5" />
                    </div>
                    {currentBeeCount >= 400 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        SWARM SURGE
                      </span>
                    ) : currentBeeCount >= 100 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                        ACTIVE FORAGING
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        RESTING COLONY
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="text-xs text-slate-500 font-medium">Entrance Activity (beeCount)</span>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentBeeCount >= 400 ? 'text-amber-900' : 'text-slate-900'
                    }`}>
                      {Math.round(currentBeeCount)} <span className="text-base font-bold text-slate-500">bees / min</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Optical IR directional gate counter</div>
                  </div>
                </div>

                {/* CARD 6: MQ-135 Gas / Air Quality Sensor */}
                <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all backdrop-blur-md ${
                  currentMQ135Raw !== undefined && (currentMQ135Raw > 500 || currentMQ135Voltage > 2.0)
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/25'
                    : 'bg-white/85 border-slate-200/90'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${
                      currentMQ135Raw !== undefined && (currentMQ135Raw > 500 || currentMQ135Voltage > 2.0)
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-teal-50 text-teal-600'
                    }`}>
                      <Gauge className="w-5 h-5" />
                    </div>
                    {getGasStatusBadge(currentMQ135Raw)}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">MQ-135 Air Quality Sensor</span>
                    </div>
                    <div className={`text-2xl font-black mt-0.5 tracking-tight ${
                      currentMQ135Raw !== undefined && (currentMQ135Raw > 500 || currentMQ135Voltage > 2.0)
                        ? 'text-amber-900'
                        : 'text-slate-900'
                    }`}>
                      {currentMQ135Raw !== undefined ? currentMQ135Raw : '--'}
                      <span className="text-base font-bold text-slate-500 ml-1">ADC Raw</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                      <span>Voltage (mq135Voltage):</span>
                      <span className="font-bold text-slate-800">
                        {currentMQ135Voltage !== undefined ? Number(currentMQ135Voltage).toFixed(2) + ' V' : '--'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </>
        )}

      </div>
    </div>
  );
}
