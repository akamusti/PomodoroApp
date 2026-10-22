import { PomodoroEngine } from "./timerEngine.js";
import { AmbientSoundEngine } from "./ambientEngine.js";
import { invoke } from "@tauri-apps/api/core";

const RADIUS = 106;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_COUNT = 60;

const TRACK_ICONS = {
  rain: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M8 19v2M12 18v3M16 19v2"></path></svg>`,
  storm: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="13 11 9 17 15 17 11 23"></polyline></svg>`,
  wind: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>`,
  waves: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path></svg>`,
  fire: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
  birds: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 14.6V18h1.4zM16 11l-3-3"></path></svg>`,
  cafe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"></path></svg>`,
  noise: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h-2"></path></svg>`,
  "waves-deep": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0M2 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0"></path></svg>`,
};

// Native acoustic cue player routed through the Tauri Rust audio backend
class SoundPlayer {
  playCue(kind) {
    if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
      invoke("play_cue", { kind }).catch((e) => {
        console.warn("Native cue playback warning:", e);
      });
    }
  }

  playStartSound() {
    this.playCue("start");
  }

  playCompleteSound() {
    this.playCue("complete");
  }
}

// Desktop Notification Handler (Tauri plugin with Web Notification fallback)
async function sendDesktopNotification(title, body) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    let permitted = await isPermissionGranted();
    if (!permitted) {
      const permission = await requestPermission();
      permitted = permission === "granted";
    }

    if (permitted) {
      sendNotification({ title, body });
      return;
    }
  } catch (_err) {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          new Notification(title, { body });
        }
      }
    }
  }
}

// Persistent preferences & daily stats
const prefs = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notifEnabled: true,
  autoStartBreaks: false,
  theme: "dark",
  taskNote: "",
};

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function loadPreferences() {
  try {
    const saved = localStorage.getItem("pomodoro_settings");
    if (saved) {
      Object.assign(prefs, JSON.parse(saved));
    }
  } catch (e) {
    console.error("Failed to load preferences:", e);
  }
}

function savePreferences() {
  try {
    localStorage.setItem("pomodoro_settings", JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to save preferences:", e);
  }
}

function getTodayMinutes() {
  try {
    const raw = localStorage.getItem("pomodoro_daily_minutes");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed.date === getTodayKey() ? parsed.minutes || 0 : 0;
  } catch (_e) {
    return 0;
  }
}

function addTodayMinutes(mins) {
  const total = getTodayMinutes() + mins;
  try {
    localStorage.setItem(
      "pomodoro_daily_minutes",
      JSON.stringify({ date: getTodayKey(), minutes: total })
    );
  } catch (_e) {
    // ignore storage errors
  }
  return total;
}

// DOM Elements
const statusLed = document.getElementById("statusLed");
const statusLabel = document.getElementById("statusLabel");
const quickSoundBtn = document.getElementById("quickSoundBtn");
const soundOnIcon = document.getElementById("soundOnIcon");
const soundOffIcon = document.getElementById("soundOffIcon");
const themeBtn = document.getElementById("themeBtn");
const sunIcon = document.getElementById("sunIcon");
const moonIcon = document.getElementById("moonIcon");

const dialTicksGroup = document.getElementById("dialTicks");
const progressCircle = document.getElementById("progressCircle");
const timeDisplay = document.getElementById("timeDisplay");
const modeBadge = document.getElementById("modeBadge");
const taskInput = document.getElementById("taskInput");

const cycleText = document.getElementById("cycleText");
const todayStat = document.getElementById("todayStat");
const cycleDots = document.getElementById("cycleDots");

const startBtn = document.getElementById("startBtn");
const startBtnText = document.getElementById("startBtnText");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const modeSegments = document.querySelectorAll(".segment");

// Preferences Sheet Elements
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const workInput = document.getElementById("workDuration");
const shortBreakInput = document.getElementById("shortBreakDuration");
const longBreakInput = document.getElementById("longBreakDuration");
const longBreakIntervalInput = document.getElementById("longBreakInterval");
const soundToggle = document.getElementById("soundToggle");
const notifToggle = document.getElementById("notifToggle");
const autoStartBreaksToggle = document.getElementById("autoStartBreaks");

// Ambient Sheet Elements (Blanket Mode)
const ambientBtn = document.getElementById("ambientBtn");
const ambientActiveDot = document.getElementById("ambientActiveDot");
const ambientModal = document.getElementById("ambientModal");
const closeAmbientBtn = document.getElementById("closeAmbientBtn");
const ambientMasterMuteBtn = document.getElementById("ambientMasterMuteBtn");
const ambientMuteOffIcon = document.getElementById("ambientMuteOffIcon");
const ambientMuteOnIcon = document.getElementById("ambientMuteOnIcon");
const ambientMasterSlider = document.getElementById("ambientMasterSlider");
const ambientMasterVolVal = document.getElementById("ambientMasterVolVal");
const ambientSyncToggle = document.getElementById("ambientSyncToggle");
const ambientTracksContainer = document.getElementById("ambientTracksContainer");
const presetPills = document.querySelectorAll(".preset-pill");

const soundPlayer = new SoundPlayer();
const ambientEngine = new AmbientSoundEngine();
const tickElements = [];

// Build 60 radial chronometer ticks in SVG
function buildDialTicks() {
  const cx = 130;
  const cy = 130;
  const outerRadius = 123;

  dialTicksGroup.innerHTML = "";
  tickElements.length = 0;

  for (let i = 0; i < TICK_COUNT; i++) {
    const isMajor = i % 5 === 0;
    const innerRadius = isMajor ? 114 : 117.5;
    const angleRad = (i * 6 * Math.PI) / 180;

    const x1 = cx + innerRadius * Math.cos(angleRad);
    const y1 = cy + innerRadius * Math.sin(angleRad);
    const x2 = cx + outerRadius * Math.cos(angleRad);
    const y2 = cy + outerRadius * Math.sin(angleRad);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1.toFixed(2));
    line.setAttribute("y1", y1.toFixed(2));
    line.setAttribute("x2", x2.toFixed(2));
    line.setAttribute("y2", y2.toFixed(2));
    line.setAttribute("stroke-width", isMajor ? "1.8" : "1.1");
    if (isMajor) line.classList.add("major");

    dialTicksGroup.appendChild(line);
    tickElements.push(line);
  }
}

progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
progressCircle.style.strokeDashoffset = "0";

function applyTheme(theme) {
  prefs.theme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", prefs.theme);
  sunIcon.classList.toggle("hidden", prefs.theme === "light");
  moonIcon.classList.toggle("hidden", prefs.theme === "dark");
}

function updateSoundIcon() {
  soundOnIcon.classList.toggle("hidden", !prefs.soundEnabled);
  soundOffIcon.classList.toggle("hidden", prefs.soundEnabled);
}

function updateTodayStatUI() {
  const mins = getTodayMinutes();
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    todayStat.textContent = `TODAY ${h}H ${m}M`;
  } else {
    todayStat.textContent = `TODAY ${mins}M`;
  }
}

function renderTickProgress(progressRatio) {
  const activeCount = Math.ceil(progressRatio * TICK_COUNT);
  for (let i = 0; i < TICK_COUNT; i++) {
    tickElements[i].classList.toggle("active-tick", i < activeCount);
  }
}

function renderCycleBars(currentCycle, maxCycles) {
  const curStr = String(currentCycle).padStart(2, "0");
  const maxStr = String(maxCycles).padStart(2, "0");
  cycleText.textContent = `SESSION ${curStr} / ${maxStr}`;

  cycleDots.innerHTML = "";
  for (let i = 1; i <= maxCycles; i++) {
    const seg = document.createElement("div");
    seg.className = "seg-pill";
    if (i < currentCycle) {
      seg.classList.add("completed");
    } else if (i === currentCycle) {
      seg.classList.add("current");
    }
    cycleDots.appendChild(seg);
  }
}

function renderTick(snapshot) {
  const minutes = Math.floor(snapshot.timeRemaining / 60);
  const seconds = snapshot.timeRemaining % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  timeDisplay.textContent = formatted;

  const offset = CIRCUMFERENCE * (1 - snapshot.progressRatio);
  progressCircle.style.strokeDashoffset = String(offset);
  renderTickProgress(snapshot.progressRatio);

  const modeTitle =
    snapshot.mode === "work"
      ? "Focus"
      : snapshot.mode === "shortBreak"
      ? "Short Break"
      : "Long Break";
  document.title = `${formatted} · ${modeTitle}`;
}

function renderState(snapshot) {
  const root = document.documentElement;
  if (snapshot.mode === "work") {
    root.style.setProperty("--current-accent", "var(--accent-work)");
    modeBadge.textContent = "FOCUS SESSION";
  } else if (snapshot.mode === "shortBreak") {
    root.style.setProperty("--current-accent", "var(--accent-short)");
    modeBadge.textContent = "SHORT BREAK";
  } else {
    root.style.setProperty("--current-accent", "var(--accent-long)");
    modeBadge.textContent = "LONG BREAK";
  }

  modeSegments.forEach((seg) => {
    seg.classList.toggle("active", seg.dataset.mode === snapshot.mode);
  });

  // Update status indicator & primary button
  statusLed.classList.toggle("running", snapshot.isRunning);
  if (snapshot.isRunning) {
    statusLabel.textContent = snapshot.mode === "work" ? "FOCUSING" : "ON BREAK";
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    startBtnText.textContent = "PAUSE";
  } else {
    const isAtStart = snapshot.timeRemaining === snapshot.totalDuration;
    statusLabel.textContent = isAtStart ? "STANDBY" : "PAUSED";
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    startBtnText.textContent = isAtStart ? "START" : "RESUME";
  }

  renderCycleBars(snapshot.currentCycle, snapshot.longBreakInterval);
  ambientEngine.handleTimerStateChange(snapshot);
}

// Initialize Preferences & Engine
loadPreferences();
buildDialTicks();
applyTheme(prefs.theme);
updateSoundIcon();
updateTodayStatUI();
taskInput.value = prefs.taskNote || "";

const engine = new PomodoroEngine({
  settings: {
    work: prefs.work,
    shortBreak: prefs.shortBreak,
    longBreak: prefs.longBreak,
    longBreakInterval: prefs.longBreakInterval,
    autoStartBreaks: prefs.autoStartBreaks,
  },
  onTick: renderTick,
  onStateChange: renderState,
  onPhaseComplete: ({ finishedMode, finishedMinutes }) => {
    if (prefs.soundEnabled) {
      soundPlayer.playCompleteSound();
    }

    if (finishedMode === "work") {
      addTodayMinutes(finishedMinutes);
      updateTodayStatUI();
      if (prefs.notifEnabled) {
        const note = prefs.taskNote ? ` (${prefs.taskNote})` : "";
        sendDesktopNotification(
          `Focus session complete${note}`,
          "Time to step back and take a break."
        );
      }
    } else if (prefs.notifEnabled) {
      sendDesktopNotification(
        "Break finished",
        "Ready to begin the next focus session."
      );
    }
  },
});

// Initial render
engine.setMode("work", false);

// Event Listeners
startBtn.addEventListener("click", () => {
  const wasRunning = engine.isRunning;
  engine.toggle();
  if (!wasRunning && engine.isRunning && prefs.soundEnabled) {
    soundPlayer.playStartSound();
  }
});

resetBtn.addEventListener("click", () => {
  engine.reset();
  renderState(engine.getSnapshot());
});

skipBtn.addEventListener("click", () => {
  engine.skip();
});

modeSegments.forEach((seg) => {
  seg.addEventListener("click", () => {
    engine.setMode(seg.dataset.mode, false);
  });
});

taskInput.addEventListener("input", () => {
  prefs.taskNote = taskInput.value.trim();
  savePreferences();
});

quickSoundBtn.addEventListener("click", () => {
  prefs.soundEnabled = !prefs.soundEnabled;
  soundToggle.checked = prefs.soundEnabled;
  updateSoundIcon();
  savePreferences();
});

themeBtn.addEventListener("click", () => {
  applyTheme(prefs.theme === "dark" ? "light" : "dark");
  savePreferences();
});

// Stepper buttons inside Preferences sheet
document.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const step = parseInt(btn.dataset.step, 10) || 1;
    const min = parseInt(input.min, 10) || 1;
    const max = parseInt(input.max, 10) || 120;
    const current = parseInt(input.value, 10) || min;
    input.value = String(Math.min(max, Math.max(min, current + step)));
  });
});

// Open / Close Preferences
settingsBtn.addEventListener("click", () => {
  workInput.value = prefs.work;
  shortBreakInput.value = prefs.shortBreak;
  longBreakInput.value = prefs.longBreak;
  longBreakIntervalInput.value = prefs.longBreakInterval;
  soundToggle.checked = prefs.soundEnabled;
  notifToggle.checked = prefs.notifEnabled;
  autoStartBreaksToggle.checked = prefs.autoStartBreaks;
  settingsModal.classList.remove("hidden");
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add("hidden");
  }
});

saveSettingsBtn.addEventListener("click", () => {
  prefs.work = Math.min(120, Math.max(1, parseInt(workInput.value, 10) || 25));
  prefs.shortBreak = Math.min(60, Math.max(1, parseInt(shortBreakInput.value, 10) || 5));
  prefs.longBreak = Math.min(90, Math.max(1, parseInt(longBreakInput.value, 10) || 15));
  prefs.longBreakInterval = Math.min(12, Math.max(1, parseInt(longBreakIntervalInput.value, 10) || 4));
  prefs.soundEnabled = soundToggle.checked;
  prefs.notifEnabled = notifToggle.checked;
  prefs.autoStartBreaks = autoStartBreaksToggle.checked;

  updateSoundIcon();
  savePreferences();
  engine.updateSettings({
    work: prefs.work,
    shortBreak: prefs.shortBreak,
    longBreak: prefs.longBreak,
    longBreakInterval: prefs.longBreakInterval,
    autoStartBreaks: prefs.autoStartBreaks,
  });
  settingsModal.classList.add("hidden");
});

// Ambient UI Logic
function updateAmbientActiveState() {
  const hasActive = Object.values(ambientEngine.settings.tracks).some((t) => t.enabled);
  ambientActiveDot.classList.toggle("hidden", !hasActive || ambientEngine.isMuted);
  ambientMasterMuteBtn.classList.toggle("muted", ambientEngine.isMuted);
  ambientMuteOffIcon.classList.toggle("hidden", ambientEngine.isMuted);
  ambientMuteOnIcon.classList.toggle("hidden", !ambientEngine.isMuted);
}

function renderAmbientUI() {
  ambientMasterSlider.value = String(Math.round(ambientEngine.settings.masterVolume * 100));
  ambientMasterVolVal.textContent = `${ambientMasterSlider.value}%`;
  ambientSyncToggle.checked = ambientEngine.settings.syncWithFocus;
  updateAmbientActiveState();

  ambientTracksContainer.innerHTML = "";
  ambientEngine.trackDefs.forEach((def) => {
    const trackCfg = ambientEngine.settings.tracks[def.id] || { enabled: false, volume: def.defaultVolume };
    const pct = Math.round(trackCfg.volume * 100);

    const card = document.createElement("div");
    card.className = `ambient-track-card${trackCfg.enabled ? " active" : ""}`;
    card.id = `ambientCard-${def.id}`;

    card.innerHTML = `
      <div class="ambient-track-header">
        <div class="ambient-track-info">
          <div class="ambient-track-icon">
            ${TRACK_ICONS[def.icon] || TRACK_ICONS.rain}
          </div>
          <div class="ambient-track-text">
            <span class="ambient-track-name">${def.name}</span>
            <span class="ambient-track-desc">${def.description}</span>
          </div>
        </div>
        <div class="ambient-track-controls">
          <button type="button" class="ambient-toggle-btn" aria-label="Toggle ${def.name}" title="Toggle ${def.name}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="${trackCfg.enabled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      </div>
      <div class="ambient-slider-row">
        <input type="range" min="0" max="100" value="${pct}" class="ambient-range ambient-track-slider" aria-label="${def.name} Volume" />
        <span class="ambient-track-pct">${pct}%</span>
      </div>
    `;

    const toggleBtn = card.querySelector(".ambient-toggle-btn");
    const slider = card.querySelector(".ambient-track-slider");
    const pctLabel = card.querySelector(".ambient-track-pct");

    toggleBtn.addEventListener("click", async () => {
      const active = await ambientEngine.toggleTrack(def.id);
      card.classList.toggle("active", active);
      const poly = toggleBtn.querySelector("polygon");
      if (poly) poly.setAttribute("fill", active ? "currentColor" : "none");
      updateAmbientActiveState();
    });

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      pctLabel.textContent = `${val}%`;
      ambientEngine.setTrackVolume(def.id, val / 100);
      if (!ambientEngine.settings.tracks[def.id].enabled && val > 0) {
        ambientEngine.toggleTrack(def.id, true).then(() => {
          card.classList.add("active");
          const poly = toggleBtn.querySelector("polygon");
          if (poly) poly.setAttribute("fill", "currentColor");
          updateAmbientActiveState();
        });
      }
    });

    ambientTracksContainer.appendChild(card);
  });
}

function syncAmbientUIValues() {
  ambientMasterSlider.value = String(Math.round(ambientEngine.settings.masterVolume * 100));
  ambientMasterVolVal.textContent = `${ambientMasterSlider.value}%`;
  ambientSyncToggle.checked = ambientEngine.settings.syncWithFocus;
  updateAmbientActiveState();

  ambientEngine.trackDefs.forEach((def) => {
    const card = document.getElementById(`ambientCard-${def.id}`);
    if (!card) return;
    const trackCfg = ambientEngine.settings.tracks[def.id] || { enabled: false, volume: def.defaultVolume };
    const pct = Math.round(trackCfg.volume * 100);

    card.classList.toggle("active", trackCfg.enabled);
    const poly = card.querySelector(".ambient-toggle-btn polygon");
    if (poly) poly.setAttribute("fill", trackCfg.enabled ? "currentColor" : "none");

    const slider = card.querySelector(".ambient-track-slider");
    if (slider) slider.value = String(pct);

    const pctLabel = card.querySelector(".ambient-track-pct");
    if (pctLabel) pctLabel.textContent = `${pct}%`;
  });
}

// Build once at load
renderAmbientUI();

// Ambient Event Listeners
ambientBtn.addEventListener("click", async () => {
  if (!ambientEngine.settings.syncWithFocus) {
    await ambientEngine.resumeAllEnabled();
  }
  syncAmbientUIValues();
  ambientModal.classList.remove("hidden");
});

closeAmbientBtn.addEventListener("click", () => {
  ambientModal.classList.add("hidden");
});

ambientModal.addEventListener("click", (e) => {
  if (e.target === ambientModal) {
    ambientModal.classList.add("hidden");
  }
});

ambientMasterMuteBtn.addEventListener("click", () => {
  ambientEngine.toggleMute();
  updateAmbientActiveState();
});

ambientMasterSlider.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  ambientMasterVolVal.textContent = `${val}%`;
  ambientEngine.setMasterVolume(val / 100);
});

ambientSyncToggle.addEventListener("change", () => {
  ambientEngine.setSyncWithFocus(ambientSyncToggle.checked);
  ambientEngine.handleTimerStateChange(engine.getSnapshot());
});

presetPills.forEach((pill) => {
  pill.addEventListener("click", async () => {
    presetPills.forEach((p) => p.classList.remove("active"));
    if (pill.dataset.preset !== "clear-all") {
      pill.classList.add("active");
    }
    await ambientEngine.applyPreset(pill.dataset.preset);
    syncAmbientUIValues();
    updateAmbientActiveState();
  });
});

// Keyboard shortcuts (ignored when typing in inputs)
window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") {
    if (e.key === "Escape") {
      document.activeElement.blur();
    }
    return;
  }

  if (e.key === "Escape") {
    let closedAny = false;
    if (!settingsModal.classList.contains("hidden")) {
      settingsModal.classList.add("hidden");
      closedAny = true;
    }
    if (!ambientModal.classList.contains("hidden")) {
      ambientModal.classList.add("hidden");
      closedAny = true;
    }
    if (closedAny) return;
  }

  if (!settingsModal.classList.contains("hidden") || !ambientModal.classList.contains("hidden")) return;

  if (e.code === "Space") {
    e.preventDefault();
    startBtn.click();
  } else if (e.key === "r" || e.key === "R") {
    resetBtn.click();
  } else if (e.key === "s" || e.key === "S") {
    skipBtn.click();
  } else if (e.key === "m" || e.key === "M") {
    quickSoundBtn.click();
  } else if (e.key === "b" || e.key === "B") {
    ambientBtn.click();
  } else if (e.key === "t" || e.key === "T") {
    themeBtn.click();
  }
});
