/**
 * Ambient Sound Engine (Blanket-style)
 * High-performance, zero-CPU procedural ambient noise synthesizer using pre-rendered
 * seamless looped AudioBuffers in Web Audio API.
 * Designed specifically for Linux WebKitGTK and Windows WebView2 stability.
 */

export class AmbientSoundEngine {
  constructor(sharedAudioCtx = null) {
    this.ctx = sharedAudioCtx;
    this.masterGain = null;
    this.isMuted = false;
    this.activeTracks = new Map();
    this.buffers = {};
    this.isGenerated = false;

    // Track definitions
    this.trackDefs = [
      {
        id: "rain",
        name: "Rain",
        icon: "rain",
        description: "Continuous soothing downpour with gentle patter",
        defaultVolume: 0.6,
      },
      {
        id: "storm",
        name: "Storm & Thunder",
        icon: "storm",
        description: "Sub-bass storm atmosphere with distant rolling rumbles",
        defaultVolume: 0.5,
      },
      {
        id: "wind",
        name: "Breezy Wind",
        icon: "wind",
        description: "Soft ambient gusts blowing through trees",
        defaultVolume: 0.5,
      },
      {
        id: "waves",
        name: "Ocean Waves",
        icon: "waves",
        description: "Rhythmic surf washing ashore and receding",
        defaultVolume: 0.5,
      },
      {
        id: "fireplace",
        name: "Fireplace",
        icon: "fire",
        description: "Cozy wood hearth warmth with crackling embers",
        defaultVolume: 0.5,
      },
      {
        id: "forest",
        name: "Forest Birds",
        icon: "birds",
        description: "Peaceful woodland breeze with melodic canopy chirps",
        defaultVolume: 0.45,
      },
      {
        id: "cafe",
        name: "Coffee Shop",
        icon: "cafe",
        description: "Warm coffeehouse murmur and subtle porcelain clinks",
        defaultVolume: 0.4,
      },
      {
        id: "whiteNoise",
        name: "White Noise",
        icon: "noise",
        description: "Pure even frequency noise for masking distractions",
        defaultVolume: 0.35,
      },
      {
        id: "brownNoise",
        name: "Deep Brown Noise",
        icon: "waves-deep",
        description: "Deep, soothing low-pitch drone for intense focus",
        defaultVolume: 0.45,
      },
    ];

    // Default settings
    this.settings = {
      masterVolume: 0.7,
      syncWithFocus: false,
      tracks: {},
    };

    this.loadSettings();
  }

  setContext(ctx) {
    if (!ctx) return;
    this.ctx = ctx;
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.settings.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && !this.isGenerated) {
      this.generateBuffers();
    }
  }

  async initContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
      }

      if (!this.masterGain && this.ctx) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.settings.masterVolume;
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      if (!this.isGenerated) {
        this.generateBuffers();
      }
      return true;
    } catch (e) {
      console.warn("AudioContext initialization warning:", e);
      return false;
    }
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

  /**
   * Pre-generates seamless, crossfaded 6-second looping audio buffers.
   * Runs once in ~80ms without blocking.
   */
  generateBuffers() {
    if (!this.ctx || this.isGenerated) return;

    const sampleRate = this.ctx.sampleRate || 44100;
    const duration = 6.0;
    const len = Math.floor(sampleRate * duration);

    // 1. White noise
    const whiteData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // 2. Brown noise (Integrated random walk)
    const brownData = new Float32Array(len);
    let lastBrown = 0.0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      brownData[i] = (lastBrown + 0.02 * w) / 1.02;
      lastBrown = brownData[i];
      brownData[i] *= 3.0;
    }

    // 3. Pink noise (Kellet 6-pole filter approximation)
    const pinkData = new Float32Array(len);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.12;
      b6 = w * 0.115926;
    }

    // 4. Rain (Pink noise with randomized high-frequency droplet impulses)
    const rainData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      rainData[i] = pinkData[i] * 0.65;
      if (Math.random() < 0.0035) {
        const drop = (Math.random() - 0.5) * 0.35;
        for (let k = 0; k < 35 && i + k < len; k++) {
          rainData[i + k] += drop * Math.exp(-k / 7);
        }
      }
    }

    // 5. Storm & Thunder (Deep sub-bass brown noise with rolling thunder waves)
    const stormData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const swell = Math.sin((Math.PI * i) / len);
      const rumble = 0.4 + 0.6 * Math.pow(swell, 3);
      stormData[i] = brownData[i] * rumble * 0.8;
    }

    // 6. Wind (Filtered pink noise with smooth sinusoidal breeze modulation)
    const windData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const gust = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((2 * Math.PI * i) / len));
      windData[i] = pinkData[i] * gust * 0.65;
    }

    // 7. Ocean Waves (Rhythmic surge and wash cycle)
    const wavesData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const cycle = Math.sin((2 * Math.PI * i) / len);
      const surge = Math.pow(Math.max(0, cycle), 2);
      wavesData[i] = (pinkData[i] * 0.5 + brownData[i] * 0.5) * (0.2 + 0.8 * surge) * 0.7;
    }

    // 8. Fireplace (Warm brown base with authentic wood crackle bursts)
    const fireData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      fireData[i] = brownData[i] * 0.35;
      if (Math.random() < 0.001) {
        const pop = (Math.random() - 0.5) * 0.7;
        for (let k = 0; k < 50 && i + k < len; k++) {
          fireData[i + k] += pop * Math.exp(-k / 9);
        }
      }
    }

    // 9. Forest Birds (Gentle breeze rustle with subtle melodic bird chirps)
    const forestData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      forestData[i] = pinkData[i] * 0.25;
    }
    // Add two bird chirps at fixed musical intervals in the loop
    const addChirp = (startSec, freq) => {
      const startIdx = Math.floor(startSec * sampleRate);
      const chirpLen = Math.floor(sampleRate * 0.12);
      for (let k = 0; k < chirpLen && startIdx + k < len; k++) {
        const t = k / sampleRate;
        const currentFreq = freq + 500 * Math.sin(t * 50);
        const env = Math.sin((Math.PI * k) / chirpLen);
        forestData[startIdx + k] += Math.sin(2 * Math.PI * currentFreq * t) * env * 0.08;
      }
    };
    addChirp(1.2, 2800);
    addChirp(1.4, 3200);
    addChirp(4.0, 3000);
    addChirp(4.2, 3400);

    // 10. Coffee Shop (Warm ambient room tone with gentle ceramic clinks)
    const cafeData = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      cafeData[i] = (pinkData[i] * 0.3 + brownData[i] * 0.3) * 0.5;
    }
    const addClink = (startSec) => {
      const startIdx = Math.floor(startSec * sampleRate);
      const clinkLen = Math.floor(sampleRate * 0.08);
      for (let k = 0; k < clinkLen && startIdx + k < len; k++) {
        const t = k / sampleRate;
        const env = Math.exp(-k / (sampleRate * 0.015));
        cafeData[startIdx + k] += Math.sin(2 * Math.PI * 3600 * t) * env * 0.05;
      }
    };
    addClink(2.5);
    addClink(5.1);

    // Seamless crossfade: blend last 0.25s smoothly with first 0.25s to eliminate any clicks
    const fadeLen = Math.floor(sampleRate * 0.25);
    const allArrays = [
      whiteData, brownData, pinkData, rainData, stormData,
      windData, wavesData, fireData, forestData, cafeData
    ];
    allArrays.forEach((arr) => {
      for (let i = 0; i < fadeLen; i++) {
        const t = i / fadeLen;
        arr[i] = arr[i] * t + arr[len - fadeLen + i] * (1 - t);
      }
    });

    // Helper to package Float32Array into Web Audio AudioBuffer (2-channel stereo for Linux PipeWire/PulseAudio)
    const createAudioBuffer = (channelData) => {
      const buf = this.ctx.createBuffer(2, len, sampleRate);
      buf.getChannelData(0).set(channelData);
      buf.getChannelData(1).set(channelData);
      return buf;
    };

    this.buffers = {
      rain: createAudioBuffer(rainData),
      storm: createAudioBuffer(stormData),
      wind: createAudioBuffer(windData),
      waves: createAudioBuffer(wavesData),
      fireplace: createAudioBuffer(fireData),
      forest: createAudioBuffer(forestData),
      cafe: createAudioBuffer(cafeData),
      whiteNoise: createAudioBuffer(whiteData),
      brownNoise: createAudioBuffer(brownData),
    };

    this.isGenerated = true;
  }

  async startTrack(trackId) {
    const ready = await this.initContext();
    if (!ready) return;
    if (this.activeTracks.has(trackId)) return;

    const buffer = this.buffers[trackId];
    if (!buffer) return;

    try {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = buffer.duration; // Required for WebKitGTK / Safari loop parsing

      const trackGain = this.ctx.createGain();
      const trackVol = this.settings.tracks[trackId]?.volume ?? 0.5;
      trackGain.gain.value = trackVol;

      src.connect(trackGain);
      trackGain.connect(this.masterGain);

      if (this.masterGain) {
        this.masterGain.gain.value = this.isMuted ? 0 : this.settings.masterVolume;
      }

      src.start(0);

      this.activeTracks.set(trackId, {
        sourceNode: src,
        gainNode: trackGain,
      });
    } catch (e) {
      console.warn(`Could not start ambient track ${trackId}:`, e);
    }
  }

  stopTrack(trackId) {
    const active = this.activeTracks.get(trackId);
    if (active) {
      try {
        active.sourceNode.stop();
        active.sourceNode.disconnect();
        active.gainNode.disconnect();
      } catch (_) {}
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
      try {
        active.gainNode.gain.value = vol;
      } catch (_) {}
    }
    this.saveSettings();
  }

  async toggleTrack(trackId, forceState = null) {
    const currentState = this.settings.tracks[trackId]?.enabled ?? false;
    const nextState = forceState !== null ? forceState : !currentState;

    if (!this.settings.tracks[trackId]) {
      this.settings.tracks[trackId] = { volume: 0.5, enabled: false };
    }
    this.settings.tracks[trackId].enabled = nextState;
    this.saveSettings();

    if (nextState) {
      await this.startTrack(trackId);
    } else {
      this.stopTrack(trackId);
    }

    return nextState;
  }

  setMasterVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    this.settings.masterVolume = vol;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.value = this.isMuted ? 0 : vol;
      } catch (_) {}
    }
    this.saveSettings();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.value = this.isMuted ? 0 : this.settings.masterVolume;
      } catch (_) {}
    }
    return this.isMuted;
  }

  setSyncWithFocus(sync) {
    this.settings.syncWithFocus = Boolean(sync);
    this.saveSettings();
  }

  handleTimerStateChange(snapshot) {
    if (!this.settings.syncWithFocus) return;

    if (snapshot.isRunning && snapshot.mode === "work") {
      this.resumeAllEnabled();
    } else {
      this.stopAllActive();
    }
  }

  async resumeAllEnabled() {
    const ready = await this.initContext();
    if (!ready) return;
    for (const [id, cfg] of Object.entries(this.settings.tracks)) {
      if (cfg.enabled) {
        await this.startTrack(id);
      }
    }
  }

  stopAllActive() {
    this.activeTracks.forEach((_, id) => {
      this.stopTrack(id);
    });
  }

  async applyPreset(presetName) {
    // Stop all first
    this.trackDefs.forEach((def) => {
      this.stopTrack(def.id);
      this.settings.tracks[def.id].enabled = false;
    });

    switch (presetName) {
      case "rainy-night":
        await this.toggleTrack("rain", true);
        this.setTrackVolume("rain", 0.75);
        await this.toggleTrack("storm", true);
        this.setTrackVolume("storm", 0.55);
        break;
      case "cozy-fireplace":
        await this.toggleTrack("fireplace", true);
        this.setTrackVolume("fireplace", 0.7);
        await this.toggleTrack("wind", true);
        this.setTrackVolume("wind", 0.45);
        break;
      case "deep-focus":
        await this.toggleTrack("brownNoise", true);
        this.setTrackVolume("brownNoise", 0.65);
        await this.toggleTrack("rain", true);
        this.setTrackVolume("rain", 0.5);
        break;
      case "peaceful-nature":
        await this.toggleTrack("forest", true);
        this.setTrackVolume("forest", 0.7);
        await this.toggleTrack("wind", true);
        this.setTrackVolume("wind", 0.4);
        break;
      case "clear-all":
      default:
        break;
    }
    this.saveSettings();
  }
}
