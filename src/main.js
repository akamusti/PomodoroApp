import { PomodoroEngine } from "./timerEngine.js";

const RADIUS = 106;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_COUNT = 60;

// Subtle acoustic synthesizer using Web Audio API
class SoundPlayer {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playToneSequence(notes) {
    try {
      this.init();
      if (!this.ctx) return;

      notes.forEach(({ freq, delay, duration = 0.45 }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);

        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.14, this.ctx.currentTime + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration + 0.05);
      });
    } catch (e) {
      console.warn("Audio playback unavailable:", e);
    }
  }

  playStartSound() {
    this.playToneSequence([
      { freq: 587.33, delay: 0, duration: 0.18 },
      { freq: 880.0, delay: 0.09, duration: 0.28 },
    ]);
  }

  playCompleteSound() {
    this.playToneSequence([
      { freq: 523.25, delay: 0, duration: 0.35 },
      { freq: 659.25, delay: 0.12, duration: 0.35 },
      { freq: 783.99, delay: 0.24, duration: 0.5 },
      { freq: 1046.5, delay: 0.38, duration: 0.75 },
    ]);
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

const soundPlayer = new SoundPlayer();
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

// Keyboard shortcuts (ignored when typing in inputs)
window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") {
    if (e.key === "Escape") {
      document.activeElement.blur();
    }
    return;
  }

  if (e.key === "Escape" && !settingsModal.classList.contains("hidden")) {
    settingsModal.classList.add("hidden");
    return;
  }

  if (!settingsModal.classList.contains("hidden")) return;

  if (e.code === "Space") {
    e.preventDefault();
    startBtn.click();
  } else if (e.key === "r" || e.key === "R") {
    resetBtn.click();
  } else if (e.key === "s" || e.key === "S") {
    skipBtn.click();
  } else if (e.key === "m" || e.key === "M") {
    quickSoundBtn.click();
  } else if (e.key === "t" || e.key === "T") {
    themeBtn.click();
  }
});
