// Simulation modes and preset configurations
export const PRESETS = {
  NORMAL: 'NORMAL',
  OVERHEAT: 'OVERHEAT',
  CO2_SPIKE: 'CO2_SPIKE',
  SWARM_BURST: 'SWARM_BURST'
};

export const PRESET_CONFIGS = {
  [PRESETS.NORMAL]: {
    name: 'Normal Operating Mode',
    targetTemp: 34.8,
    targetHumidity: 55.0,
    targetWeight: 42.5,
    targetHoneyYield: 18.2,
    targetCO2: 620,
    targetTraffic: 145,
    description: 'Optimum brood box thermal regulation and healthy bee traffic flow.'
  },
  [PRESETS.OVERHEAT]: {
    name: 'Overheat Thermal Alert',
    targetTemp: 39.4,
    targetHumidity: 38.0,
    targetWeight: 41.8,
    targetHoneyYield: 17.5,
    targetCO2: 890,
    targetTraffic: 340,
    description: 'Extreme heat warning! Internal brood chamber exceeding 37.0°C thermal threshold.'
  },
  [PRESETS.CO2_SPIKE]: {
    name: 'CO₂ Ventilation Spike',
    targetTemp: 35.6,
    targetHumidity: 68.0,
    targetWeight: 42.1,
    targetHoneyYield: 18.0,
    targetCO2: 1940,
    targetTraffic: 85,
    description: 'Poor ventilation detected. CO₂ level > 1200 ppm requires immediate gate check.'
  },
  [PRESETS.SWARM_BURST]: {
    name: 'Swarm Event / Hive Departure',
    targetTemp: 37.1,
    targetHumidity: 46.0,
    targetWeight: 35.8,
    targetHoneyYield: 12.2,
    targetCO2: 1050,
    targetTraffic: 520,
    description: 'Sudden colony mass departure! Rapid weight drop & entrance surge detected.'
  }
};

/**
 * Returns overall hive health status based on current telemetry
 * Returns: { status: 'NORMAL'|'WARNING'|'ALERT', label: string, color: string, pulse: boolean, reason: string }
 */
export const getTelemetryStatus = (telemetry, preset = PRESETS.NORMAL) => {
  const { temp, co2, traffic } = telemetry;
  
  if (temp >= 38.5 || preset === PRESETS.OVERHEAT) {
    return {
      status: 'ALERT',
      label: 'OVERHEAT CRITICAL',
      color: '#ef4444', // Red
      pulse: true,
      reason: 'Brood chamber temperature exceeding 38.5°C threshold!'
    };
  } else if (co2 >= 1500 || preset === PRESETS.CO2_SPIKE) {
    return {
      status: 'ALERT',
      label: 'CO₂ VENTILATION HAZARD',
      color: '#a855f7', // Purple
      pulse: true,
      reason: 'Airflow blocked! CO₂ concentration exceeded 1500 ppm.'
    };
  } else if (traffic >= 400 || preset === PRESETS.SWARM_BURST) {
    return {
      status: 'WARNING',
      label: 'COLONY SWARM EVENT',
      color: '#f59e0b', // Amber/Orange
      pulse: true,
      reason: 'Mass worker exit detected! Gate throughput > 400 bees/min.'
    };
  }
  
  return {
    status: 'NORMAL',
    label: 'OPTIMAL HEALTH',
    color: '#22c55e', // Green
    pulse: false,
    reason: 'All systems within optimal threshold'
  };
};

/**
 * Computes individual component specific telemetry for click-to-inspect tooltips
 */
export const getPartTelemetry = (partId, mainTelemetry) => {
  switch (partId) {
    case 'roof':
      return {
        name: 'Telescoping Outer Roof',
        partType: 'Weather Shield & Thermal Insulation',
        temp: (mainTelemetry.temp * 0.94).toFixed(1) + ' °C',
        status: 'Secure Sealed',
        insulationRating: 'R-7.5 Weatherproof Aluminum',
        detail: 'Protects inner cover from direct sun radiation and precipitation.'
      };
    case 'innerCover':
      return {
        name: 'Inner Cover Board',
        partType: 'Airflow Regulator & Upper Seal',
        temp: (mainTelemetry.temp * 0.98).toFixed(1) + ' °C',
        humidity: (mainTelemetry.humidity * 0.95).toFixed(1) + ' %',
        condensation: 'Low (0.02 ml/hr)',
        detail: 'Provides upper dead-air space and ventilation escape hole.'
      };
    case 'chamberBox':
      return {
        name: 'Single Langstroth Wood Chamber',
        partType: 'Core Brood Nest & Frame Assembly',
        temp: mainTelemetry.temp.toFixed(1) + ' °C',
        humidity: mainTelemetry.humidity.toFixed(1) + ' %',
        co2: mainTelemetry.co2 + ' ppm',
        framesCount: '10 High-Density Hanging Frames',
        broodDensity: '88% Active Worker Density',
        detail: 'Primary incubation chamber housing core queen brood nest & honey stores.'
      };
    case 'bottomBoard':
      return {
        name: 'Bottom Board & Entrance Gate',
        partType: 'Landing Ramp & Optical Sensor Unit',
        traffic: mainTelemetry.traffic + ' bees/min',
        opticalRampStatus: 'Active IR Beam Scanning',
        debrisLevel: 'Minimal (Clean Screen)',
        detail: 'Monitors inbound/outbound bee velocity and maintains bottom air inflow.'
      };
    default:
      return null;
  }
};

/**
 * Generates initial rolling historical data points (last 12 readings)
 */
export const generateInitialHistory = (mode = PRESETS.NORMAL) => {
  const config = PRESET_CONFIGS[mode];
  const history = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 5000);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Add minor realistic noise
    const noiseTemp = (Math.random() - 0.5) * 0.3;
    const noiseWeight = (Math.random() - 0.5) * 0.1;
    const noiseCO2 = Math.floor((Math.random() - 0.5) * 20);
    
    history.push({
      time: timeStr,
      temp: parseFloat((config.targetTemp + noiseTemp).toFixed(1)),
      weight: parseFloat((config.targetWeight + noiseWeight).toFixed(2)),
      co2: Math.round(config.targetCO2 + noiseCO2)
    });
  }
  
  return history;
};

/**
 * Computes next telemetry state step towards target preset
 */
export const stepTelemetry = (current, targetPreset) => {
  const config = PRESET_CONFIGS[targetPreset];
  const lerp = (start, end, amt) => start + (end - start) * amt;
  
  // Smoothly transition towards target with realistic micro-variations
  const newTemp = parseFloat(lerp(current.temp, config.targetTemp + (Math.random() - 0.5) * 0.2, 0.15).toFixed(1));
  const newHumidity = parseFloat(lerp(current.humidity, config.targetHumidity + (Math.random() - 0.5) * 0.5, 0.15).toFixed(1));
  const newWeight = parseFloat(lerp(current.weight, config.targetWeight + (Math.random() - 0.5) * 0.05, 0.1).toFixed(2));
  const newHoneyYield = parseFloat(lerp(current.honeyYield, config.targetHoneyYield, 0.1).toFixed(1));
  const newCO2 = Math.round(lerp(current.co2, config.targetCO2 + (Math.random() - 0.5) * 15, 0.15));
  const newTraffic = Math.round(lerp(current.traffic, config.targetTraffic + (Math.random() - 0.5) * 10, 0.2));

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    telemetry: {
      temp: newTemp,
      humidity: newHumidity,
      weight: newWeight,
      honeyYield: newHoneyYield,
      co2: newCO2,
      traffic: newTraffic
    },
    newHistoryPoint: {
      time: timeStr,
      temp: newTemp,
      weight: newWeight,
      co2: newCO2
    }
  };
};
