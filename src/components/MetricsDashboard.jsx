import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Scale,
  Wind,
  Activity,
  Zap,
  Database,
  Flame,
  AlertCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { PRESETS, PRESET_CONFIGS } from '../utils/simulationEngine';

export default function MetricsDashboard({
  telemetry,
  history,
  preset,
  onSelectPreset,
  isFirebase,
  onToggleMode
}) {
  // Status helper badges
  const getTempStatusBadge = (temp) => {
    if (temp >= 38.5) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">OVERHEAT CRITICAL</span>;
    } else if (temp >= 36.5) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">WARM</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">IDEAL</span>;
  };

  const getCO2StatusBadge = (co2) => {
    if (co2 >= 1500) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">POOR VENTILATION</span>;
    } else if (co2 >= 1000) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">ELEVATED</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">FRESH</span>;
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden text-slate-800">
      
      {/* HEADER BAR */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Telemetry & Tele-Diagnostics
          </h2>
          <p className="text-xs text-slate-500 font-medium">Real-time sensor telemetry & historical analytics</p>
        </div>

        {/* INTERACTIVE DATA MODE TOGGLE BUTTON */}
        <button
          onClick={onToggleMode}
          title="Click to toggle between Simulation Mode and Live Hardware Mode"
          className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none ${
            isFirebase
              ? 'bg-emerald-50/90 text-emerald-800 border-emerald-300 hover:bg-emerald-100 ring-2 ring-emerald-400/30'
              : 'bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/30'
          }`}
        >
          {isFirebase ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              </span>
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Live Hardware Mode</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>Simulation Mode Active</span>
            </>
          )}

          {/* TOGGLE SWITCH KNOB VISUAL */}
          <div
            className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ml-1 ${
              isFirebase ? 'bg-emerald-600 justify-end' : 'bg-amber-500 justify-start'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-2xs" />
          </div>
        </button>
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* SIMULATION PRESETS CONTROLLER */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" /> Preset Telemetry Simulations
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Click to test digital twin reaction</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.keys(PRESETS).map((key) => {
              const pKey = PRESETS[key];
              const cfg = PRESET_CONFIGS[pKey];
              const isActive = preset === pKey;

              // Scenario-specific active styling
              let activeStyle = 'bg-slate-900 text-white border-slate-900 shadow-md';
              let activeSubtext = 'text-slate-200';

              if (pKey === PRESETS.NORMAL) {
                activeStyle = 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-200';
                activeSubtext = 'text-emerald-100';
              } else if (pKey === PRESETS.OVERHEAT) {
                activeStyle = 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-200 animate-pulse';
                activeSubtext = 'text-rose-100';
              } else if (pKey === PRESETS.CO2_SPIKE) {
                activeStyle = 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-200';
                activeSubtext = 'text-purple-100';
              } else if (pKey === PRESETS.SWARM_BURST) {
                activeStyle = 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-200';
                activeSubtext = 'text-amber-100';
              }

              return (
                <button
                  key={pKey}
                  onClick={() => onSelectPreset(pKey)}
                  className={`p-2.5 rounded-xl text-left transition-all border text-xs font-semibold cursor-pointer ${
                    isActive
                      ? activeStyle
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-bold">{cfg.name.split(' ')[0]}</span>
                    {isActive && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                  </div>
                  <div className={`text-[10px] mt-0.5 font-normal truncate ${isActive ? activeSubtext : 'text-slate-500'}`}>
                    {cfg.name.split(' ').slice(1).join(' ')}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/90 flex items-start gap-2.5 shadow-2xs">
            <span className="p-1 rounded-md bg-amber-100 text-amber-800 text-xs shrink-0 font-bold">ACTIVE SCENARIO</span>
            <div className="leading-snug">
              <span className="font-bold text-slate-900">{PRESET_CONFIGS[preset]?.name}:</span>{' '}
              <span className="text-slate-600">{PRESET_CONFIGS[preset]?.description}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2A: LIVE NUMERICAL METRIC CARDS GRID */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Real-Time Metric Cards
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            
            {/* CARD 1: Core Temperature */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                  <Thermometer className="w-5 h-5" />
                </div>
                {getTempStatusBadge(telemetry.temp)}
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500 font-medium">Core Chamber Temp</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {telemetry.temp.toFixed(1)} <span className="text-base font-bold text-slate-500">°C</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Optimal Target: 34.5 - 35.5 °C</div>
              </div>
            </div>

            {/* CARD 2: Relative Humidity */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600">
                  <Droplets className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-700">BALANCED</span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500 font-medium">Relative Humidity</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {telemetry.humidity.toFixed(1)} <span className="text-base font-bold text-slate-500">%</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Brood incubation standard</div>
              </div>
            </div>

            {/* CARD 3: Hive Weight & Honey Yield */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                  <Scale className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  HONEY: {telemetry.honeyYield.toFixed(1)} kg
                </span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500 font-medium">Total Hive Mass</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {telemetry.weight.toFixed(2)} <span className="text-base font-bold text-slate-500">kg</span>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Net yield estimate active
                </div>
              </div>
            </div>

            {/* CARD 4: CO2 Concentration */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Wind className="w-5 h-5" />
                </div>
                {getCO2StatusBadge(telemetry.co2)}
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500 font-medium">CO₂ Concentration</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {telemetry.co2} <span className="text-base font-bold text-slate-500">ppm</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Internal airflow circulation</div>
              </div>
            </div>

            {/* CARD 5: Entrance Activity */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-2">
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                  <Activity className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                  OPTICAL COUNTER
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Entrance Bee Traffic</span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {telemetry.traffic} <span className="text-base font-bold text-slate-500">bees / min</span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="font-semibold text-slate-700">IR Beam Scanner</div>
                  <div className="text-[11px] text-slate-400">Directional throughput</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 2B: REAL-TIME HISTORICAL RECHARTS GRAPHS */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Real-Time Historical Trends (Rolling 60s)
          </h3>

          {/* CHART 1: Temperature & Weight Dual Axis */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Core Temperature (°C) & Weight (kg) Trend
              </h4>
              <span className="text-[10px] font-medium text-slate-400">Live 5s Polling</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="temp" domain={[30, 42]} tick={{ fontSize: 10, fill: '#f43f5e' }} />
                  <YAxis yAxisId="weight" orientation="right" domain={[30, 50]} tick={{ fontSize: 10, fill: '#d97706' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temp"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f43f5e' }}
                    name="Temp (°C)"
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#d97706' }}
                    name="Weight (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: CO2 Concentration Trend */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                CO₂ Air Quality Level (ppm)
              </h4>
              <span className="text-[10px] font-medium text-slate-400">Safety Threshold: 1200 ppm</span>
            </div>

            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[400, 2200]} tick={{ fontSize: 10, fill: '#10b981' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="co2"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#10b981' }}
                    name="CO₂ (ppm)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
