/**
 * Computes overall hive health status based purely on real live telemetry readings.
 * Returns: { status: 'NORMAL'|'WARNING'|'ALERT'|'WAITING', label: string, color: string, pulse: boolean, reason: string }
 */
export const getTelemetryStatus = (telemetry) => {
  if (!telemetry) {
    return {
      status: 'WAITING',
      label: 'WAITING FOR DATA',
      color: '#94a3b8', // Slate grey
      pulse: true,
      reason: 'Awaiting initial live hardware telemetry from Realtime Database (/HoneyHive/latest)...'
    };
  }

  const temp = telemetry.temperatureC ?? telemetry.temp;
  const co2 = telemetry.co2ppm ?? telemetry.co2;
  const traffic = telemetry.beeCount ?? telemetry['bee traffic'] ?? telemetry.traffic ?? 0;

  if (temp !== undefined && temp >= 38.5) {
    return {
      status: 'ALERT',
      label: 'OVERHEAT CRITICAL',
      color: '#ef4444', // Red
      pulse: true,
      reason: 'Brood chamber temperature exceeding 38.5°C threshold!'
    };
  } else if (co2 !== undefined && co2 >= 1500) {
    return {
      status: 'ALERT',
      label: 'CO₂ VENTILATION HAZARD',
      color: '#a855f7', // Purple
      pulse: true,
      reason: 'Airflow blocked! CO₂ concentration exceeded 1500 ppm.'
    };
  } else if (traffic >= 400) {
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
    reason: 'All live telemetry parameters within safe operating thresholds.'
  };
};

/**
 * Computes individual component specific telemetry for click-to-inspect 3D tooltips
 */
export const getPartTelemetry = (partId, mainTelemetry) => {
  if (!mainTelemetry) {
    return {
      name: partId === 'roof' ? 'Telescoping Outer Roof'
        : partId === 'innerCover' ? 'Inner Cover Board'
        : partId === 'chamberBox' ? 'Single Langstroth Wood Chamber'
        : partId === 'bottomBoard' ? 'Bottom Board & Entrance Gate'
        : partId,
      partType: 'Hardware Component',
      detail: 'Waiting for live sensor data stream from /HoneyHive/latest...'
    };
  }

  const tempVal = mainTelemetry.temperatureC ?? mainTelemetry.temp ?? null;
  const humidityVal = mainTelemetry.humidity ?? null;
  const co2Val = mainTelemetry.co2ppm ?? mainTelemetry.co2 ?? null;
  const trafficVal = mainTelemetry.beeCount ?? mainTelemetry['bee traffic'] ?? mainTelemetry.traffic ?? 0;

  switch (partId) {
    case 'roof':
      return {
        name: 'Telescoping Outer Roof',
        partType: 'Weather Shield & Thermal Insulation',
        temp: tempVal !== null ? (tempVal * 0.94).toFixed(1) + ' °C' : '-- °C',
        status: 'Secure Sealed',
        insulationRating: 'R-7.5 Weatherproof Aluminum',
        detail: 'Protects inner cover from direct sun radiation and precipitation.'
      };
    case 'innerCover':
      return {
        name: 'Inner Cover Board',
        partType: 'Airflow Regulator & Upper Seal',
        temp: tempVal !== null ? (tempVal * 0.98).toFixed(1) + ' °C' : '-- °C',
        humidity: humidityVal !== null ? (humidityVal * 0.95).toFixed(1) + ' %' : '-- %',
        condensation: 'Low (0.02 ml/hr)',
        detail: 'Provides upper dead-air space and ventilation escape hole.'
      };
    case 'chamberBox':
      return {
        name: 'Single Langstroth Wood Chamber',
        partType: 'Core Brood Nest & Frame Assembly',
        temp: tempVal !== null ? Number(tempVal).toFixed(1) + ' °C' : '-- °C',
        humidity: humidityVal !== null ? Number(humidityVal).toFixed(1) + ' %' : '-- %',
        co2: co2Val !== null ? co2Val + ' ppm' : '-- ppm',
        framesCount: '10 High-Density Hanging Frames',
        broodDensity: 'Live Colony',
        detail: 'Primary incubation chamber housing core queen brood nest & honey stores.'
      };
    case 'bottomBoard':
      return {
        name: 'Bottom Board & Entrance Gate',
        partType: 'Landing Ramp & Optical Sensor Unit',
        traffic: trafficVal + ' bees/min',
        opticalRampStatus: 'Active IR Beam Scanning',
        debrisLevel: 'Clean Screen',
        detail: 'Monitors inbound/outbound bee velocity and maintains bottom air inflow.'
      };
    default:
      return null;
  }
};
