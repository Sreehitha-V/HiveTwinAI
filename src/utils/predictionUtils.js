/**
 * Preset emergency and demonstration scenarios for Simulation & Demo Mode
 */
export const DEMO_PRESETS = {
  NORMAL: {
    id: 'NORMAL',
    name: 'Normal Operating Baseline',
    shortName: 'Normal',
    description: 'Optimum brood box thermal regulation (34.8°C), healthy worker foraging, and stable mass.',
    telemetry: {
      isSimulated: true,
      temperatureC: 34.8,
      temp: 34.8,
      humidity: 56.0,
      co2ppm: 580,
      co2: 580,
      weightKg: 42.50,
      weight: 42.50,
      beeCount: 140,
      traffic: 140,
      'bee traffic': 140,
      mq135Raw: 210,
      mq135Voltage: 0.85,
      honeyYield: 17.5,
      status: 'OPTIMAL'
    }
  },
  TEMP_SURGE: {
    id: 'TEMP_SURGE',
    name: 'Sudden Temperature Surge (Overheat)',
    shortName: 'Thermal Surge',
    description: 'Extreme heatwave and internal overheating (39.4°C). Triggers 3D thermal core light & industrial sirens.',
    telemetry: {
      isSimulated: true,
      temperatureC: 39.4,
      temp: 39.4,
      humidity: 34.0,
      co2ppm: 820,
      co2: 820,
      weightKg: 41.30,
      weight: 41.30,
      beeCount: 380,
      traffic: 380,
      'bee traffic': 380,
      mq135Raw: 340,
      mq135Voltage: 1.45,
      honeyYield: 16.3,
      status: 'OVERHEAT CRITICAL'
    }
  },
  CO2_SPIKE: {
    id: 'CO2_SPIKE',
    name: 'High CO₂ Ventilation Hazard',
    shortName: 'CO₂ Spike',
    description: 'Chamber air circulation blocked (1850 ppm). Triggers 3D gas cloud visualizers and ventilation alert.',
    telemetry: {
      isSimulated: true,
      temperatureC: 35.8,
      temp: 35.8,
      humidity: 68.0,
      co2ppm: 1850,
      co2: 1850,
      weightKg: 42.10,
      weight: 42.10,
      beeCount: 95,
      traffic: 95,
      'bee traffic': 95,
      mq135Raw: 520,
      mq135Voltage: 2.15,
      honeyYield: 17.1,
      status: 'VENTILATION HAZARD'
    }
  },
  WEIGHT_DROP: {
    id: 'WEIGHT_DROP',
    name: 'Rapid Weight Drop (Colony Swarm)',
    shortName: 'Swarm / Weight Drop',
    description: 'Colony mass departure event! Hive loses > 6 kg rapidly with wild entrance flight bursts (560 bees/min).',
    telemetry: {
      isSimulated: true,
      temperatureC: 33.2,
      temp: 33.2,
      humidity: 45.0,
      co2ppm: 920,
      co2: 920,
      weightKg: 35.60,
      weight: 35.60,
      beeCount: 560,
      traffic: 560,
      'bee traffic': 560,
      mq135Raw: 280,
      mq135Voltage: 1.10,
      honeyYield: 10.6,
      status: 'COLONY SWARM EVENT'
    }
  }
};

/**
 * Generates synthetic historical trend points matching a demonstration scenario
 */
export const generateDemoHistory = (scenarioId) => {
  const history = [];
  const now = Date.now();
  const count = 12;

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 15000);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const progress = (count - 1 - i) / (count - 1); // 0.0 at start, 1.0 at end

    let pointTemp = 34.8;
    let pointWeight = 42.5;
    let pointCO2 = 580;

    if (scenarioId === 'TEMP_SURGE') {
      // Temperature climbing sharply from 34.8 up to 39.4
      pointTemp = 34.8 + progress * (39.4 - 34.8) + (Math.random() - 0.5) * 0.15;
      pointWeight = 42.5 - progress * 1.2 + (Math.random() - 0.5) * 0.05;
      pointCO2 = 600 + progress * 220 + (Math.random() - 0.5) * 15;
    } else if (scenarioId === 'CO2_SPIKE') {
      // CO2 spiking sharply from 600 up to 1850
      pointCO2 = 600 + progress * (1850 - 600) + (Math.random() - 0.5) * 30;
      pointTemp = 34.8 + progress * 1.0 + (Math.random() - 0.5) * 0.1;
      pointWeight = 42.5 - progress * 0.4 + (Math.random() - 0.5) * 0.05;
    } else if (scenarioId === 'WEIGHT_DROP') {
      // Weight dropping rapidly from 42.5 down to 35.6
      pointWeight = 42.5 - progress * (42.5 - 35.6) + (Math.random() - 0.5) * 0.05;
      pointTemp = 34.8 - progress * 1.6 + (Math.random() - 0.5) * 0.1;
      pointCO2 = 650 + progress * 270 + (Math.random() - 0.5) * 15;
    } else {
      // Stable normal fluctuations
      pointTemp = 34.8 + (Math.random() - 0.5) * 0.2;
      pointWeight = 42.5 + (Math.random() - 0.5) * 0.05;
      pointCO2 = 580 + Math.floor((Math.random() - 0.5) * 25);
    }

    history.push({
      time: timeStr,
      temp: parseFloat(pointTemp.toFixed(1)),
      weight: parseFloat(pointWeight.toFixed(2)),
      co2: Math.round(pointCO2)
    });
  }

  return history;
};

/**
 * Analyzes recent historical trend slope & current telemetry to predict abrupt situations
 * Evaluates rate of change over recent data points (15-min horizon extrapolation)
 */
export const analyzeTelemetryTrends = (history = [], currentTelemetry = null) => {
  if (!currentTelemetry) {
    return {
      hasAlert: false,
      primaryWarning: null,
      metrics: {
        tempSlope: 0,
        projectedTemp15m: 0,
        co2Slope: 0,
        projectedCO215m: 0,
        weightDelta: 0
      }
    };
  }

  const currentTemp = currentTelemetry.temperatureC ?? currentTelemetry.temp ?? 34.8;
  const currentCO2 = currentTelemetry.co2ppm ?? currentTelemetry.co2 ?? 600;
  const currentWeight = currentTelemetry.weightKg ?? currentTelemetry.weight ?? 42.5;
  const currentBees = currentTelemetry.beeCount ?? currentTelemetry['bee traffic'] ?? currentTelemetry.traffic ?? 140;

  let tempSlope = 0; // °C per measurement step
  let co2Slope = 0; // ppm per measurement step
  let weightDelta = 0; // total kg delta across window

  if (history.length >= 3) {
    const recent = history.slice(-6); // last 6 points
    const first = recent[0];
    const last = recent[recent.length - 1];
    const steps = recent.length - 1;

    if (steps > 0) {
      tempSlope = (last.temp - first.temp) / steps;
      co2Slope = (last.co2 - first.co2) / steps;
      weightDelta = last.weight - first.weight;
    }
  }

  // Extrapolate 15-minute projected values (assuming ~15 steps per 15 min window)
  const projectedTemp15m = parseFloat((currentTemp + tempSlope * 15).toFixed(1));
  const projectedCO215m = Math.round(currentCO2 + co2Slope * 15);

  const warnings = [];

  // 1. Temperature Surge / Overheat prediction
  if (currentTemp >= 38.5 || (tempSlope > 0.25 && currentTemp >= 36.5) || projectedTemp15m >= 38.5) {
    const estTime = currentTemp >= 38.5 ? 'Active Now' : Math.max(5, Math.min(25, Math.round((38.5 - currentTemp) / Math.max(0.1, tempSlope))));
    warnings.push({
      id: 'TEMP_SURGE_PREDICTION',
      level: 'CRITICAL',
      type: 'overheat',
      headline: '⚠️ Warning: Abrupt Temperature Surge Predicted',
      message: `Sharp upward temperature slope detected (+${(tempSlope * 4).toFixed(1)}°C/min). Brood chamber projected to reach ${Math.max(38.5, projectedTemp15m)}°C in ~${estTime} mins.`,
      recommendation: 'Deploy solar radiation reflective cover or verify upper ventilation escape hole immediately.',
      badgeText: 'THERMAL SURGE PREDICTED',
      accentColor: 'rose'
    });
  }

  // 2. CO2 Ventilation failure prediction
  if (currentCO2 >= 1500 || (co2Slope > 40 && currentCO2 >= 1100) || projectedCO215m >= 1500) {
    const estTime = currentCO2 >= 1500 ? 'Active Now' : Math.max(5, Math.min(20, Math.round((1500 - currentCO2) / Math.max(15, co2Slope))));
    warnings.push({
      id: 'CO2_VENTILATION_PREDICTION',
      level: 'WARNING',
      type: 'co2',
      headline: '⚠️ Warning: Possible Ventilation Issue Detected',
      message: `Rapid CO₂ accumulation (+${Math.round(co2Slope * 4)} ppm/min). Respiratory stifling hazard predicted within ~${estTime} mins if airflow remains restricted.`,
      recommendation: 'Inspect bottom entrance reducer screen for propolis clogging or deceased bee accumulation.',
      badgeText: 'VENTILATION ISSUE PREDICTED',
      accentColor: 'purple'
    });
  }

  // 3. Weight drop / Swarming behavior prediction
  if (weightDelta <= -0.45 || (currentWeight < 38.0 && currentBees >= 400)) {
    const lostKg = Math.abs(weightDelta).toFixed(2);
    warnings.push({
      id: 'SWARM_DEPARTURE_PREDICTION',
      level: 'CRITICAL',
      type: 'swarm',
      headline: '⚠️ Alert: Possible Swarming Behavior Detected',
      message: `Rapid hive mass loss detected (-${lostKg} kg recent drop) alongside heavy entrance flight surging (${currentBees} bees/min). Colony swarm exit underway.`,
      recommendation: 'Scout adjacent apiary trees and foliage immediately for virgin/prime queen cluster retrieval.',
      badgeText: 'SWARM EVENT PREDICTED',
      accentColor: 'amber'
    });
  }

  // If no critical alerts, provide optimal confirmation
  const primaryWarning = warnings.length > 0 ? warnings[0] : {
    id: 'STABLE_PREDICTION',
    level: 'OPTIMAL',
    type: 'stable',
    headline: 'AI Prediction & Recommendation',
    message: 'Telemetry trajectories indicate stable thermal balance (34.5 - 35.5°C) and clean ventilation over the next 60 minutes.',
    recommendation: 'All sensor trends within target brood incubation envelopes. Normal queen egg-laying active.',
    badgeText: 'STABLE FORECAST',
    accentColor: 'emerald'
  };

  return {
    hasAlert: warnings.length > 0,
    warnings,
    primaryWarning,
    metrics: {
      tempSlope: parseFloat((tempSlope * 4).toFixed(2)), // formatted as rate per minute
      projectedTemp15m,
      co2Slope: Math.round(co2Slope * 4),
      projectedCO215m,
      weightDelta: parseFloat(weightDelta.toFixed(2))
    }
  };
};
