// Pomodoro Timer Engine with Web Audio & Tauri Desktop Integration

// Circumference of r=130 SVG circle
const RADIUS = 130;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Sound synthesizer using Web Audio API (zero external assets needed)
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

  playChime(notes = [523.25, 659.25, 783.99]) {
    try {
      this.init();
      if (!this.ctx) return;
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.8);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.85);
      });
    } catch (e) {
      console.warn("Audio playback not supported:", e);
    }
  }

  playStartSound() {
    this.playChime([440, 554.37, 659.25]); // A major chime
  }

  playCompleteSound() {
    this.playChime([523.25, 659.25, 783.99, 1046.5]); // C major triumphant chime
  }
}

// Notification Handler (Tauri plugin fallback to Web Notification)
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
  } catch (err) {
    // If not in Tauri or plugin unavailable, fallback to Web API
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

// State
const state = {
  mode: "work", // "work", "shortBreak", "longBreak"
  timeRemaining: 25 * 60,
  totalDuration: 25 * 60,
  isRunning: false,
  timerId: null,
  currentCycle: 1,
  
  settings: {
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    soundEnabled: true,
    notifEnabled: true,
    autoStartBreaks: false,
  },
};

// Load saved settings
function loadSettings() {
  try {
    const saved = localStorage.getItem("pomodoro_settings");
    if (saved) {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem("pomodoro_settings", JSON.stringify(state.settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

// Elements
const timeDisplay = document.getElementById("timeDisplay");
const progressCircle = document.getElementById("progressCircle");
const modeBadge = document.getElementById("modeBadge");
const cycleText = document.getElementById("cycleText");
const cycleDots = document.getElementById("cycleDots");
const startBtn = document.getElementById("startBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const modeTabs = document.querySelectorAll(".mode-tab");

// Settings Elements
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

// Initialize Ring
progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
progressCircle.style.strokeDashoffset = "0";

function updateDisplay() {
  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = state.timeRemaining % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  
  timeDisplay.textContent = formatted;
  
  // Progress Ring
  const progressRatio = state.timeRemaining / state.totalDuration;
  const offset = CIRCUMFERENCE * (1 - progressRatio);
  progressCircle.style.strokeDashoffset = String(offset);

  // Window title
  const modeTitle = state.mode === "work" ? "Focus" : state.mode === "shortBreak" ? "Short Break" : "Long Break";
  document.title = `${formatted} - ${modeTitle} | Pomodoro`;
}

function updateTheme() {
  const root = document.documentElement;
  if (state.mode === "work") {
    root.style.setProperty("--current-accent", "var(--accent-work)");
    root.style.setProperty("--current-glow", "var(--accent-work-glow)");
    modeBadge.textContent = "Focus Time";
  } else if (state.mode === "shortBreak") {
    root.style.setProperty("--current-accent", "var(--accent-short)");
    root.style.setProperty("--current-glow", "var(--accent-short-glow)");
    modeBadge.textContent = "Short Break";
  } else {
    root.style.setProperty("--current-accent", "var(--accent-long)");
    root.style.setProperty("--current-glow", "var(--accent-long-glow)");
    modeBadge.textContent = "Long Break";
  }

  modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
  });
}

function updateCycleUI() {
  const max = state.settings.longBreakInterval;
  cycleText.textContent = `Cycle ${state.currentCycle} of ${max}`;

  cycleDots.innerHTML = "";
  for (let i = 1; i <= max; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (i <= state.currentCycle) {
      dot.classList.add("active");
    }
    cycleDots.appendChild(dot);
  }
}

function setMode(mode, autoStart = false) {
  state.mode = mode;
  pauseTimer();

  let minutes = state.settings.work;
  if (mode === "shortBreak") minutes = state.settings.shortBreak;
  if (mode === "longBreak") minutes = state.settings.longBreak;

  state.totalDuration = minutes * 60;
  state.timeRemaining = state.totalDuration;

  updateTheme();
  updateDisplay();

  if (autoStart) {
    startTimer();
  }
}

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  playIcon.classList.add("hidden");
  pauseIcon.classList.remove("hidden");

  if (state.settings.soundEnabled) {
    soundPlayer.playStartSound();
  }

  state.timerId = window.setInterval(() => {
    if (state.timeRemaining > 0) {
      state.timeRemaining--;
      updateDisplay();
    } else {
      handleTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.isRunning) return;

  state.isRunning = false;
  playIcon.classList.remove("hidden");
  pauseIcon.classList.add("hidden");

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function resetTimer() {
  pauseTimer();
  state.timeRemaining = state.totalDuration;
  updateDisplay();
}

function handleTimerComplete() {
  pauseTimer();

  if (state.settings.soundEnabled) {
    soundPlayer.playCompleteSound();
  }

  if (state.mode === "work") {
    if (state.settings.notifEnabled) {
      sendDesktopNotification("Work Session Finished! 🍅", "Take a well-deserved break!");
    }

    if (state.currentCycle >= state.settings.longBreakInterval) {
      state.currentCycle = 1;
      setMode("longBreak", state.settings.autoStartBreaks);
    } else {
      state.currentCycle++;
      setMode("shortBreak", state.settings.autoStartBreaks);
    }
    updateCycleUI();
  } else {
    // Break finished
    if (state.settings.notifEnabled) {
      sendDesktopNotification("Break Finished! ⚡", "Ready to focus again?");
    }
    setMode("work", false);
  }
}

function skipTimer() {
  if (confirm("Skip current session?")) {
    if (state.mode === "work") {
      if (state.currentCycle >= state.settings.longBreakInterval) {
        state.currentCycle = 1;
        setMode("longBreak", false);
      } else {
        state.currentCycle++;
        setMode("shortBreak", false);
      }
      updateCycleUI();
    } else {
      setMode("work", false);
    }
  }
}

// Event Listeners
startBtn.addEventListener("click", () => {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", resetTimer);
skipBtn.addEventListener("click", skipTimer);

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setMode(tab.dataset.mode, false);
  });
});

// Settings Modal
settingsBtn.addEventListener("click", () => {
  workInput.value = state.settings.work;
  shortBreakInput.value = state.settings.shortBreak;
  longBreakInput.value = state.settings.longBreak;
  longBreakIntervalInput.value = state.settings.longBreakInterval;
  soundToggle.checked = state.settings.soundEnabled;
  notifToggle.checked = state.settings.notifEnabled;
  autoStartBreaksToggle.checked = state.settings.autoStartBreaks;
  
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
  state.settings.work = Math.max(1, parseInt(workInput.value) || 25);
  state.settings.shortBreak = Math.max(1, parseInt(shortBreakInput.value) || 5);
  state.settings.longBreak = Math.max(1, parseInt(longBreakInput.value) || 15);
  state.settings.longBreakInterval = Math.max(1, parseInt(longBreakIntervalInput.value) || 4);
  state.settings.soundEnabled = soundToggle.checked;
  state.settings.notifEnabled = notifToggle.checked;
  state.settings.autoStartBreaks = autoStartBreaksToggle.checked;

  saveSettings();
  settingsModal.classList.add("hidden");
  
  setMode(state.mode, false);
  updateCycleUI();
});

// App Initialization
loadSettings();
setMode("work", false);
updateCycleUI();
updateDisplay();
