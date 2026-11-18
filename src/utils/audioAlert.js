/**
 * Web Audio API synthesized alert sound generator for HiveTwinAI.
 * Synthesizes a deep, low-frequency industrial klaxon / machinery hazard warning pulse (150Hz - 250Hz).
 */

let audioCtx = null;
let pulseIntervalId = null;
let activePulseNodes = [];
let isLoopRunning = false;

/**
 * Lazily creates or returns the shared AudioContext instance.
 */
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

/**
 * Resumes audio context if it is in suspended state (browser autoplay policy).
 */
export const resumeAudioContext = async () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('AudioContext resume failed:', err);
    }
  }
  return ctx;
};

// Automatically resume AudioContext on first user interaction anywhere on the window
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    resumeAudioContext();
    window.removeEventListener('pointerdown', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
  };
  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });
}

/**
 * Plays a single authoritative, deep industrial klaxon pulse.
 * Uses a rich dual-oscillator core (190 Hz sawtooth + 235 Hz square)
 * lowpass-filtered at 800 Hz to completely eliminate high-pitched wailing
 * and produce a heavy, mechanical hazard horn thud.
 * 
 * @param {AudioContext} ctx
 * @param {number} startTime
 * @param {number} duration - Pulse duration in seconds (default: 0.22s)
 * @param {number} volume - Master volume gain (default: 0.32)
 */
const playKlaxonPulse = (ctx, startTime, duration = 0.22, volume = 0.32) => {
  try {
    const t0 = startTime || ctx.currentTime;

    // 1. Dual low-frequency oscillators for heavy industrial body
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(190, t0); // 190 Hz deep fundamental base

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(235, t0); // 235 Hz rich mechanical harmonic

    // 2. Steep lowpass filter: cuts all harsh frequencies above 800 Hz
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t0);
    filter.Q.setValueAtTime(2.0, t0); // Resonant industrial horn horn-body

    // 3. Punchy amplitude envelope: clean attack, sustained thud, rapid decay
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.linearRampToValueAtTime(volume, t0 + 0.015); // 15ms sharp attack
    gainNode.gain.setValueAtTime(volume, t0 + duration - 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration); // 40ms decay

    // 4. Routing: Oscillators -> Lowpass Filter -> Gain Envelope -> Output
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + duration + 0.03);
    osc2.stop(t0 + duration + 0.03);

    // Track active pulse for immediate cancellation if muted
    const pulseRecord = { osc1, osc2, filter, gainNode };
    activePulseNodes.push(pulseRecord);

    setTimeout(() => {
      const idx = activePulseNodes.indexOf(pulseRecord);
      if (idx !== -1) {
        activePulseNodes.splice(idx, 1);
      }
      try {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        gainNode.disconnect();
      } catch {
        // Already disconnected
      }
    }, (duration + 0.08) * 1000);
  } catch (err) {
    console.warn('Error playing klaxon pulse:', err);
  }
};

/**
 * Starts the continuous rhythmic industrial klaxon alert loop.
 * Repeats sharp, rhythmic warning pulses every 460ms as long as the condition is active.
 */
export const startAlertLoop = async () => {
  if (isLoopRunning) return;
  isLoopRunning = true;

  const ctx = await resumeAudioContext();
  if (!ctx) return;

  // Fire initial pulse immediately
  playKlaxonPulse(ctx, ctx.currentTime);

  // Pulse cadence: repeats every 460ms (~130 BPM steady industrial hazard pulse)
  pulseIntervalId = setInterval(() => {
    if (!isLoopRunning) return;
    playKlaxonPulse(ctx, ctx.currentTime);
  }, 460);
};

/**
 * Stops the industrial alert loop immediately and silences any active pulses in flight.
 */
export const stopAlertLoop = () => {
  isLoopRunning = false;
  if (pulseIntervalId) {
    clearInterval(pulseIntervalId);
    pulseIntervalId = null;
  }

  // Fast click-free fadeout for any active pulse sound currently sounding
  if (audioCtx && activePulseNodes.length > 0) {
    const now = audioCtx.currentTime;
    activePulseNodes.forEach(({ osc1, osc2, filter, gainNode }) => {
      try {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
            osc1.disconnect();
            osc2.disconnect();
            filter.disconnect();
            gainNode.disconnect();
          } catch {
            // Already stopped
          }
        }, 25);
      } catch {
        // Ignore
      }
    });
    activePulseNodes = [];
  }
};

/**
 * Triggers the industrial klaxon hazard alert.
 */
export const playHighTempAlarm = async () => {
  if (!isLoopRunning) {
    await startAlertLoop();
  }
};

/**
 * Plays a double-pulse preview of the industrial klaxon for testing/unmuting.
 */
export const playTestBeep = async () => {
  const ctx = await resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Pulse 1
  playKlaxonPulse(ctx, now, 0.20, 0.28);
  // Pulse 2 (160ms gap after pulse 1)
  playKlaxonPulse(ctx, now + 0.36, 0.20, 0.28);
};

/**
 * Returns whether the alert loop is currently running.
 */
export const isAlertLoopRunning = () => isLoopRunning;
