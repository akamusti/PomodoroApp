// Pure Pomodoro Timer Engine decoupled from DOM/UI

export class PomodoroEngine {
  constructor(options = {}) {
    this.settings = {
      work: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
      autoStartBreaks: false,
      ...options.settings,
    };

    this.mode = "work"; // "work" | "shortBreak" | "longBreak"
    this.totalDuration = this.settings.work * 60;
    this.timeRemaining = this.totalDuration;
    this.isRunning = false;
    this.currentCycle = 1;
    this.timerId = null;

    this.onTick = options.onTick || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onPhaseComplete = options.onPhaseComplete || (() => {});
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.isRunning) {
      this.setMode(this.mode, false);
    } else {
      this.emitState();
    }
  }

  getDurationForMode(mode) {
    if (mode === "shortBreak") return this.settings.shortBreak * 60;
    if (mode === "longBreak") return this.settings.longBreak * 60;
    return this.settings.work * 60;
  }

  setMode(mode, autoStart = false) {
    this.pause();
    this.mode = mode;
    this.totalDuration = this.getDurationForMode(mode);
    this.timeRemaining = this.totalDuration;
    this.emitState();
    this.onTick(this.getSnapshot());

    if (autoStart) {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return false;
    this.isRunning = true;
    this.emitState();

    this.timerId = window.setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining -= 1;
        this.onTick(this.getSnapshot());
      } else {
        this.completeCurrentPhase();
      }
    }, 1000);

    return true;
  }

  pause() {
    if (!this.isRunning) return false;
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.emitState();
    return true;
  }

  toggle() {
    return this.isRunning ? this.pause() : this.start();
  }

  reset() {
    this.pause();
    this.timeRemaining = this.totalDuration;
    this.onTick(this.getSnapshot());
  }

  skip() {
    this.advancePhase(false);
  }

  completeCurrentPhase() {
    const finishedMode = this.mode;
    const finishedMinutes = Math.round(this.totalDuration / 60);
    this.pause();

    this.onPhaseComplete({
      finishedMode,
      finishedMinutes,
      cycle: this.currentCycle,
    });

    const shouldAutoStart =
      finishedMode === "work" ? this.settings.autoStartBreaks : false;
    this.advancePhase(shouldAutoStart);
  }

  advancePhase(autoStart = false) {
    if (this.mode === "work") {
      if (this.currentCycle >= this.settings.longBreakInterval) {
        this.currentCycle = 1;
        this.setMode("longBreak", autoStart);
      } else {
        this.currentCycle += 1;
        this.setMode("shortBreak", autoStart);
      }
    } else {
      this.setMode("work", false);
    }
  }

  getSnapshot() {
    const progressRatio =
      this.totalDuration > 0 ? this.timeRemaining / this.totalDuration : 0;
    return {
      mode: this.mode,
      timeRemaining: this.timeRemaining,
      totalDuration: this.totalDuration,
      progressRatio,
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      longBreakInterval: this.settings.longBreakInterval,
    };
  }

  emitState() {
    this.onStateChange(this.getSnapshot());
  }
}
