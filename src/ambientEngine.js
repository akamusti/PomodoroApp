/**
 * Ambient Sound Engine (Blanket-style)
 *
 * In the Tauri desktop app (Linux & Windows), all procedural synthesis and
 * real-time audio mixing runs natively in the Rust backend (`src-tauri/src/audio.rs`)
 * via PulseAudio/PipeWire/ALSA on Linux and WinMM on Windows.
 *
 * This completely avoids WebKitGTK's GStreamer WebAudio/HTMLMediaElement
 * pipeline, preventing WebKitWebProcess SIGABRT crashes inside AppImages and
 * guaranteeing zero-latency, zero-CPU playback across all distributions.
 */

import { invoke } from "@tauri-apps/api/core";

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export class AmbientSoundEngine {
  constructor() {
    this.isMuted = false;
    this.isTimerFocusing = false;

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
    this.syncToBackend();
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
      localStorage.setItem(
        "pomodoro_ambient_settings",
        JSON.stringify(this.settings)
      );
    } catch (e) {
      console.warn("Could not save ambient settings:", e);
    }
  }

  /**
   * Pushes the current mixer configuration to the native Rust audio engine.
   */
  syncToBackend() {
    if (!isTauriRuntime()) return;

    const shouldSilenceForSync =
      this.settings.syncWithFocus && !this.isTimerFocusing;
    const effectiveMuted = this.isMuted || shouldSilenceForSync;

    const tracksPayload = {};
    for (const def of this.trackDefs) {
      const cfg = this.settings.tracks[def.id];
      tracksPayload[def.id] = {
        enabled: Boolean(cfg?.enabled),
        volume: Number(cfg?.volume ?? def.defaultVolume),
      };
    }

    invoke("set_ambient_state", {
      tracks: tracksPayload,
      masterVolume: Number(this.settings.masterVolume),
      muted: Boolean(effectiveMuted),
    }).catch((err) => {
      console.warn("Failed to sync ambient state with native backend:", err);
    });
  }

  async startTrack(trackId) {
    if (!this.settings.tracks[trackId]) {
      this.settings.tracks[trackId] = { volume: 0.5, enabled: true };
    } else {
      this.settings.tracks[trackId].enabled = true;
    }
    this.saveSettings();
    this.syncToBackend();
  }

  stopTrack(trackId) {
    if (this.settings.tracks[trackId]) {
      this.settings.tracks[trackId].enabled = false;
    }
    this.saveSettings();
    this.syncToBackend();
  }

  setTrackVolume(trackId, volume) {
    const vol = Math.max(0, Math.min(1, volume));
    if (this.settings.tracks[trackId]) {
      this.settings.tracks[trackId].volume = vol;
    }
    this.saveSettings();
    this.syncToBackend();
  }

  async toggleTrack(trackId, forceState = null) {
    const currentState = this.settings.tracks[trackId]?.enabled ?? false;
    const nextState = forceState !== null ? forceState : !currentState;

    if (!this.settings.tracks[trackId]) {
      this.settings.tracks[trackId] = { volume: 0.5, enabled: false };
    }
    this.settings.tracks[trackId].enabled = nextState;
    this.saveSettings();
    this.syncToBackend();

    return nextState;
  }

  setMasterVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    this.settings.masterVolume = vol;
    this.saveSettings();
    this.syncToBackend();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.syncToBackend();
    return this.isMuted;
  }

  setSyncWithFocus(sync) {
    this.settings.syncWithFocus = Boolean(sync);
    this.saveSettings();
    this.syncToBackend();
  }

  handleTimerStateChange(snapshot) {
    this.isTimerFocusing = Boolean(
      snapshot && snapshot.isRunning && snapshot.mode === "work"
    );
    if (this.settings.syncWithFocus) {
      this.syncToBackend();
    }
  }

  async resumeAllEnabled() {
    this.syncToBackend();
  }

  stopAllActive() {
    this.syncToBackend();
  }

  async applyPreset(presetName) {
    // Disable all tracks first
    this.trackDefs.forEach((def) => {
      this.settings.tracks[def.id].enabled = false;
    });

    const enableWithVol = (id, vol) => {
      if (this.settings.tracks[id]) {
        this.settings.tracks[id].enabled = true;
        this.settings.tracks[id].volume = vol;
      }
    };

    switch (presetName) {
      case "rainy-night":
        enableWithVol("rain", 0.75);
        enableWithVol("storm", 0.55);
        break;
      case "cozy-fireplace":
        enableWithVol("fireplace", 0.7);
        enableWithVol("wind", 0.45);
        break;
      case "deep-focus":
        enableWithVol("brownNoise", 0.65);
        enableWithVol("rain", 0.5);
        break;
      case "peaceful-nature":
        enableWithVol("forest", 0.7);
        enableWithVol("wind", 0.4);
        break;
      case "clear-all":
      default:
        break;
    }

    this.saveSettings();
    this.syncToBackend();
  }
}
