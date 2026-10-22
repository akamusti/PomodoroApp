/**
 * Ambient Sound Engine (Blanket-style)
 * Procedural ambient noise synthesizer. Loops are rendered once into in-memory
 * WAV blobs and played through looping HTMLAudioElements.
 *
 * Why not Web Audio? On Linux WebKitGTK, AudioContext.resume() may never settle
 * and buffer sources can stay silent. HTMLAudioElement goes through the
 * GStreamer playbin pipeline, which is reliable on WebKitGTK and WebView2.
 */

const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 8.0;

/**
 * Encodes mono Float32 samples into a 16-bit PCM WAV Blob.
 */
function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export class AmbientSoundEngine {
  constructor() {
    this.isMuted = false;
    this.activeTracks = new Map();
    this.samples = {};
    this.urls = {};
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
   * Pre-generates seamless, crossfaded looping sample arrays.
   * Runs once (lazily on first playback) in well under 100ms.
   */
  generateBuffers() {
    if (this.isGenerated) return;

    const sampleRate = SAMPLE_RATE;
    const duration = LOOP_SECONDS;
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

    // Seamless crossfade: blend the last 0.25s into the first 0.25s, then trim the
    // tail so the loop point (end -> start) is sample-continuous and click-free.
    const fadeLen = Math.floor(sampleRate * 0.25);
    const loopLen = len - fadeLen;
    const seamless = (arr) => {
      for (let i = 0; i < fadeLen; i++) {
        const t = i / fadeLen;
        arr[i] = arr[i] * t + arr[loopLen + i] * (1 - t);
      }
      return arr.subarray(0, loopLen);
    };

    this.samples = {
      rain: seamless(rainData),
      storm: seamless(stormData),
      wind: seamless(windData),
      waves: seamless(wavesData),
      fireplace: seamless(fireData),
      forest: seamless(forestData),
      cafe: seamless(cafeData),
      whiteNoise: seamless(whiteData),
      brownNoise: seamless(brownData),
    };

    this.isGenerated = true;
  }

  /**
   * Returns (and lazily creates) an object URL holding the WAV loop for a track.
   */
  getTrackUrl(trackId) {
    if (this.urls[trackId]) return this.urls[trackId];
    this.generateBuffers();
    const data = this.samples[trackId];
    if (!data) return null;
    const url = URL.createObjectURL(encodeWav(data, SAMPLE_RATE));
    this.urls[trackId] = url;
    return url;
  }

  effectiveVolume(trackId) {
    if (this.isMuted) return 0;
    const trackVol = this.settings.tracks[trackId]?.volume ?? 0.5;
    return Math.max(0, Math.min(1, trackVol * this.settings.masterVolume));
  }

  applyVolumes() {
    this.activeTracks.forEach(({ audio }, id) => {
      try {
        audio.volume = this.effectiveVolume(id);
      } catch (_) {}
    });
  }

  async startTrack(trackId) {
    if (this.activeTracks.has(trackId)) return;
    if (typeof Audio === "undefined") return;

    try {
      const url = this.getTrackUrl(trackId);
      if (!url) return;

      const audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.src = url;
      audio.volume = this.effectiveVolume(trackId);

      this.activeTracks.set(trackId, { audio });

      // Do not await: on some WebKitGTK builds the play() promise settles late.
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((e) => {
          console.warn(`Could not start ambient track ${trackId}:`, e);
        });
      }
    } catch (e) {
      console.warn(`Could not start ambient track ${trackId}:`, e);
      this.activeTracks.delete(trackId);
    }
  }

  stopTrack(trackId) {
    const active = this.activeTracks.get(trackId);
    if (active) {
      try {
        active.audio.pause();
        active.audio.removeAttribute("src");
        active.audio.load();
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
    if (active) {
      try {
        active.audio.volume = this.effectiveVolume(trackId);
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
    this.applyVolumes();
    this.saveSettings();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.applyVolumes();
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
