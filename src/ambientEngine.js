/**
 * Ambient Sound Generator and Mixer (Blanket-style)
 * Procedural, zero-dependency, ultra-low CPU audio synthesis using Web Audio API.
 */

export class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.activeTracks = new Map();
    this.noiseBuffers = {};
    this.intervals = [];

    // Track definitions
    this.trackDefs = [
      {
        id: "rain",
        name: "Rain",
        icon: "rain",
        description: "Gentle continuous downpour with droplet patter",
        defaultVolume: 0.6,
      },
      {
        id: "storm",
        name: "Storm & Thunder",
        icon: "storm",
        description: "Deep rolling thunder rumbles and heavy ambiance",
        defaultVolume: 0.5,
      },
      {
        id: "wind",
        name: "Breezy Wind",
        icon: "wind",
        description: "Soothing wind gusts through trees",
        defaultVolume: 0.5,
      },
      {
        id: "waves",
        name: "Ocean Waves",
        icon: "waves",
        description: "Rhythmic oceanic surf and ebb tides",
        defaultVolume: 0.5,
      },
      {
        id: "fireplace",
        name: "Fireplace",
        icon: "fire",
        description: "Crackling wood embers and cozy warmth",
        defaultVolume: 0.5,
      },
      {
        id: "forest",
        name: "Forest Birds",
        icon: "birds",
        description: "Serene woodland canopy with gentle bird calls",
        defaultVolume: 0.4,
      },
      {
        id: "cafe",
        name: "Coffee Shop",
        icon: "cafe",
        description: "Muffled café chatter and subtle ambient clinks",
        defaultVolume: 0.4,
      },
      {
        id: "whiteNoise",
        name: "White Noise",
        icon: "noise",
        description: "Crisp static noise for masking distractions",
        defaultVolume: 0.35,
      },
      {
        id: "brownNoise",
        name: "Deep Brown Noise",
        icon: "waves-deep",
        description: "Heavy low-frequency drone for deep focus",
        defaultVolume: 0.45,
      },
    ];

    // State management
    this.settings = {
      masterVolume: 0.7,
      syncWithFocus: false, // auto-play only when focus timer is running
      tracks: {},
    };

    this.loadSettings();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.generateNoiseBuffers();
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return true;
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem("pomodoro_ambient_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings.masterVolume = parsed.masterVolume ?? 0.7;
        this.settings.syncWithFocus = parsed.syncWithFocus ?? false;
        if (parsed.tracks) {
          this.settings.tracks = parsed.tracks;
        }
      }
    } catch (e) {
      console.warn("Could not load ambient settings:", e);
    }

    // Ensure defaults exist for all tracks
    this.trackDefs.forEach((def) => {
      if (!this.settings.tracks[def.id]) {
        this.settings.tracks[def.id] = {
          enabled: false,
          volume: def.defaultVolume,
        };
      }
    });
  }

  saveSettings() {
    try {
      localStorage.setItem("pomodoro_ambient_settings", JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Could not save ambient settings:", e);
    }
  }

  // Pre-generate 5-second seamless noise loops for zero-CPU looping
  generateNoiseBuffers() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 5.0;
    const bufferSize = sampleRate * duration;

    // 1. White Noise Buffer
    const whiteBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const whiteData = whiteBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.white = whiteBuf;

    // 2. Pink Noise Buffer (Kellet filter approximation)
    const pinkBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const pinkData = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.noiseBuffers.pink = pinkBuf;

    // 3. Brown Noise Buffer (Integrated random walk)
    const brownBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const brownData = brownBuf.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      brownData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = brownData[i];
      brownData[i] *= 3.5; // Gain compensation
    }
    this.noiseBuffers.brown = brownBuf;
  }

  createLoopedSource(buffer) {
    if (!this.ctx || !buffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  startTrack(trackId) {
    if (!this.initContext()) return;
    if (this.activeTracks.has(trackId)) return;

    const trackGain = this.ctx.createGain();
    const trackVolume = this.settings.tracks[trackId]?.volume ?? 0.5;
    trackGain.gain.setValueAtTime(trackVolume, this.ctx.currentTime);
    trackGain.connect(this.masterGain);

    const cleanupFns = [];

    // Synthesize based on track type
    switch (trackId) {
      case "rain": {
        // High quality rain: pink noise base + bandpass + droplet texture
        const pinkSrc = this.createLoopedSource(this.noiseBuffers.pink);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2200, this.ctx.currentTime);

        const filter2 = this.ctx.createBiquadFilter();
        filter2.type = "highpass";
        filter2.frequency.setValueAtTime(350, this.ctx.currentTime);

        pinkSrc.connect(filter);
        filter.connect(filter2);
        filter2.connect(trackGain);
        pinkSrc.start();
        cleanupFns.push(() => pinkSrc.stop());

        // Droplet patter pulses
        const dropInterval = setInterval(() => {
          if (!this.ctx || this.ctx.state !== "running") return;
          if (Math.random() > 0.4) return;
          try {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = "sine";
            const freq = 1400 + Math.random() * 1200;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.4, this.ctx.currentTime + 0.04);

            g.gain.setValueAtTime(0.04 * Math.random(), this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);

            osc.connect(g);
            g.connect(trackGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.045);
          } catch (_) {}
        }, 120);
        cleanupFns.push(() => clearInterval(dropInterval));
        break;
      }

      case "storm": {
        // Deep lowpass brown rumble
        const brownSrc = this.createLoopedSource(this.noiseBuffers.brown);
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(160, this.ctx.currentTime);

        const baseGain = this.ctx.createGain();
        baseGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

        brownSrc.connect(lowpass);
        lowpass.connect(baseGain);
        baseGain.connect(trackGain);
        brownSrc.start();
        cleanupFns.push(() => brownSrc.stop());

        // Thunder strikes
        const triggerThunder = () => {
          if (!this.ctx || this.ctx.state !== "running") return;
          try {
            const thunderSrc = this.createLoopedSource(this.noiseBuffers.brown);
            const thunderFilter = this.ctx.createBiquadFilter();
            thunderFilter.type = "lowpass";
            thunderFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

            const thunderGain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            thunderGain.gain.setValueAtTime(0, now);
            thunderGain.gain.linearRampToValueAtTime(1.2, now + 0.9);
            thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 5.5);

            thunderSrc.connect(thunderFilter);
            thunderFilter.connect(thunderGain);
            thunderGain.connect(trackGain);
            thunderSrc.start();
            thunderSrc.stop(now + 6.0);
          } catch (_) {}
        };

        const thunderTimer = setInterval(() => {
          if (Math.random() < 0.35) {
            triggerThunder();
          }
        }, 14000);
        cleanupFns.push(() => clearInterval(thunderTimer));
        break;
      }

      case "wind": {
        // Bandpass noise modulated by slow LFO for breezy gusts
        const pinkSrc = this.createLoopedSource(this.noiseBuffers.pink);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);
        filter.Q.setValueAtTime(2.2, this.ctx.currentTime);

        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime); // slow wave

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(220, this.ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        pinkSrc.connect(filter);
        filter.connect(trackGain);

        pinkSrc.start();
        lfo.start();
        cleanupFns.push(() => {
          pinkSrc.stop();
          lfo.stop();
        });
        break;
      }

      case "waves": {
        // Slow rhythmic ebb and surge
        const pinkSrc = this.createLoopedSource(this.noiseBuffers.pink);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);

        const swellGain = this.ctx.createGain();
        swellGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // 12-second cycle

        const lfoMod = this.ctx.createGain();
        lfoMod.gain.setValueAtTime(0.35, this.ctx.currentTime);

        lfo.connect(lfoMod);
        lfoMod.connect(swellGain.gain);

        pinkSrc.connect(filter);
        filter.connect(swellGain);
        swellGain.connect(trackGain);

        pinkSrc.start();
        lfo.start();
        cleanupFns.push(() => {
          pinkSrc.stop();
          lfo.stop();
        });
        break;
      }

      case "fireplace": {
        // Warm brown glow + crackle pops
        const brownSrc = this.createLoopedSource(this.noiseBuffers.brown);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);

        brownSrc.connect(filter);
        filter.connect(trackGain);
        brownSrc.start();
        cleanupFns.push(() => brownSrc.stop());

        // Spark and wood crackle bursts
        const crackleInterval = setInterval(() => {
          if (!this.ctx || this.ctx.state !== "running") return;
          if (Math.random() > 0.45) return;
          try {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(700 + Math.random() * 1800, this.ctx.currentTime);
            g.gain.setValueAtTime(0.06 * Math.random(), this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);

            osc.connect(g);
            g.connect(trackGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.035);
          } catch (_) {}
        }, 150);
        cleanupFns.push(() => clearInterval(crackleInterval));
        break;
      }

      case "forest": {
        // Gentle rustle background
        const pinkSrc = this.createLoopedSource(this.noiseBuffers.pink);
        const rustle = this.ctx.createBiquadFilter();
        rustle.type = "bandpass";
        rustle.frequency.setValueAtTime(800, this.ctx.currentTime);
        rustle.Q.setValueAtTime(0.8, this.ctx.currentTime);

        const rustleGain = this.ctx.createGain();
        rustleGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

        pinkSrc.connect(rustle);
        rustle.connect(rustleGain);
        rustleGain.connect(trackGain);
        pinkSrc.start();
        cleanupFns.push(() => pinkSrc.stop());

        // Periodic bird chirps
        const chirpInterval = setInterval(() => {
          if (!this.ctx || this.ctx.state !== "running") return;
          if (Math.random() > 0.5) return;
          try {
            const count = 1 + Math.floor(Math.random() * 3);
            for (let c = 0; c < count; c++) {
              const startDelay = c * 0.16;
              const osc = this.ctx.createOscillator();
              const g = this.ctx.createGain();
              osc.type = "sine";

              const baseFreq = 2400 + Math.random() * 1200;
              const now = this.ctx.currentTime + startDelay;
              osc.frequency.setValueAtTime(baseFreq, now);
              osc.frequency.linearRampToValueAtTime(baseFreq + 600, now + 0.06);
              osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, now + 0.12);

              g.gain.setValueAtTime(0, now);
              g.gain.linearRampToValueAtTime(0.035, now + 0.02);
              g.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);

              osc.connect(g);
              g.connect(trackGain);
              osc.start(now);
              osc.stop(now + 0.13);
            }
          } catch (_) {}
        }, 3200);
        cleanupFns.push(() => clearInterval(chirpInterval));
        break;
      }

      case "cafe": {
        // Filtered rumble mimicking café room tone
        const pinkSrc = this.createLoopedSource(this.noiseBuffers.pink);
        const murmur = this.ctx.createBiquadFilter();
        murmur.type = "bandpass";
        murmur.frequency.setValueAtTime(550, this.ctx.currentTime);
        murmur.Q.setValueAtTime(1.4, this.ctx.currentTime);

        pinkSrc.connect(murmur);
        murmur.connect(trackGain);
        pinkSrc.start();
        cleanupFns.push(() => pinkSrc.stop());

        // Subtle ceramic cup clinks
        const clinkInterval = setInterval(() => {
          if (!this.ctx || this.ctx.state !== "running") return;
          if (Math.random() > 0.3) return;
          try {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = "sine";
            const freq = 3200 + Math.random() * 800;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            g.gain.setValueAtTime(0.03 * Math.random(), this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

            osc.connect(g);
            g.connect(trackGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.09);
          } catch (_) {}
        }, 4000);
        cleanupFns.push(() => clearInterval(clinkInterval));
        break;
      }

      case "whiteNoise": {
        const whiteSrc = this.createLoopedSource(this.noiseBuffers.white);
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(8000, this.ctx.currentTime);

        whiteSrc.connect(lowpass);
        lowpass.connect(trackGain);
        whiteSrc.start();
        cleanupFns.push(() => whiteSrc.stop());
        break;
      }

      case "brownNoise": {
        const brownSrc = this.createLoopedSource(this.noiseBuffers.brown);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);

        brownSrc.connect(filter);
        filter.connect(trackGain);
        brownSrc.start();
        cleanupFns.push(() => brownSrc.stop());
        break;
      }
    }

    this.activeTracks.set(trackId, {
      gainNode: trackGain,
      cleanup: () => {
        cleanupFns.forEach((fn) => fn());
        try {
          trackGain.disconnect();
        } catch (_) {}
      },
    });
  }

  stopTrack(trackId) {
    const track = this.activeTracks.get(trackId);
    if (track) {
      track.cleanup();
      this.activeTracks.delete(trackId);
    }
  }

  setTrackVolume(trackId, volume) {
    const vol = Math.max(0, Math.min(1, volume));
    if (this.settings.tracks[trackId]) {
      this.settings.tracks[trackId].volume = vol;
    }
    const active = this.activeTracks.get(trackId);
    if (active && this.ctx) {
      active.gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  toggleTrack(trackId, forceState = null) {
    const currentState = this.settings.tracks[trackId]?.enabled ?? false;
    const nextState = forceState !== null ? forceState : !currentState;

    if (!this.settings.tracks[trackId]) {
      this.settings.tracks[trackId] = { volume: 0.5, enabled: false };
    }
    this.settings.tracks[trackId].enabled = nextState;
    this.saveSettings();

    if (nextState) {
      this.startTrack(trackId);
    } else {
      this.stopTrack(trackId);
    }

    return nextState;
  }

  setMasterVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    this.settings.masterVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : vol, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.settings.masterVolume,
        this.ctx.currentTime
      );
    }
    return this.isMuted;
  }

  setSyncWithFocus(sync) {
    this.settings.syncWithFocus = Boolean(sync);
    this.saveSettings();
  }

  // Called when Pomodoro state updates
  handleTimerStateChange(snapshot) {
    if (!this.settings.syncWithFocus) return;

    if (snapshot.isRunning && snapshot.mode === "work") {
      // Resume or start enabled tracks
      this.resumeAllEnabled();
    } else {
      // Pause ambient sounds during break or standby/pause
      this.suspend();
    }
  }

  resumeAllEnabled() {
    if (!this.initContext()) return;
    Object.entries(this.settings.tracks).forEach(([id, cfg]) => {
      if (cfg.enabled) {
        this.startTrack(id);
      }
    });
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend();
    }
  }

  applyPreset(presetName) {
    // Reset all tracks first
    this.trackDefs.forEach((def) => {
      this.stopTrack(def.id);
      this.settings.tracks[def.id].enabled = false;
    });

    switch (presetName) {
      case "rainy-night":
        this.toggleTrack("rain", true);
        this.setTrackVolume("rain", 0.7);
        this.toggleTrack("storm", true);
        this.setTrackVolume("storm", 0.4);
        break;
      case "cozy-fireplace":
        this.toggleTrack("fireplace", true);
        this.setTrackVolume("fireplace", 0.65);
        this.toggleTrack("wind", true);
        this.setTrackVolume("wind", 0.35);
        break;
      case "deep-focus":
        this.toggleTrack("brownNoise", true);
        this.setTrackVolume("brownNoise", 0.55);
        this.toggleTrack("rain", true);
        this.setTrackVolume("rain", 0.4);
        break;
      case "peaceful-nature":
        this.toggleTrack("forest", true);
        this.setTrackVolume("forest", 0.6);
        this.toggleTrack("wind", true);
        this.setTrackVolume("wind", 0.3);
        break;
      case "clear-all":
      default:
        // Already cleared
        break;
    }
    this.saveSettings();
  }
}
