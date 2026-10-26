// Pure Pomodoro state machine shared by the Plasma widget and the unit tests.
// Time is injected as epoch milliseconds so the behaviour stays deterministic.

var DEFAULT_SETTINGS = {
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartWork: false,
};

function numberOr(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
}

function normalizeSettings(settings) {
    var source = settings || {};
    var result = {
        work: Math.max(1, Math.round(numberOr(source.work, DEFAULT_SETTINGS.work))),
        shortBreak: Math.max(1, Math.round(numberOr(source.shortBreak, DEFAULT_SETTINGS.shortBreak))),
        longBreak: Math.max(1, Math.round(numberOr(source.longBreak, DEFAULT_SETTINGS.longBreak))),
        longBreakInterval: Math.max(1, Math.round(numberOr(source.longBreakInterval, DEFAULT_SETTINGS.longBreakInterval))),
        autoStartBreaks: source.autoStartBreaks === undefined
            ? DEFAULT_SETTINGS.autoStartBreaks
            : Boolean(source.autoStartBreaks),
        autoStartWork: source.autoStartWork === undefined
            ? DEFAULT_SETTINGS.autoStartWork
            : Boolean(source.autoStartWork),
    };
    return result;
}

function PomodoroEngine(settings) {
    this.settings = normalizeSettings(settings);
    this.phase = "work";
    this.completedInCycle = 0;
    this.running = false;
    this.started = false;
    this.remainingMs = this.phaseDurationMs();
    this.phaseTotalMs = this.remainingMs;
    this.endAt = 0;
}

PomodoroEngine.prototype.phaseDurationMs = function (phase) {
    var target = phase || this.phase;
    var minutes = this.settings.work;
    if (target === "shortBreak") {
        minutes = this.settings.shortBreak;
    } else if (target === "longBreak") {
        minutes = this.settings.longBreak;
    }
    return Math.max(1000, Math.round(minutes * 60000));
};

PomodoroEngine.prototype.sessionNumber = function () {
    var raw = this.phase === "work" ? this.completedInCycle + 1 : this.completedInCycle;
    return Math.min(Math.max(1, raw), this.settings.longBreakInterval);
};

// Applies new preferences without disturbing a phase that is already in progress.
PomodoroEngine.prototype.setSettings = function (settings) {
    var merged = {};
    var key;
    for (key in this.settings) {
        merged[key] = this.settings[key];
    }
    var incoming = settings || {};
    for (key in incoming) {
        if (incoming[key] !== undefined) {
            merged[key] = incoming[key];
        }
    }
    this.settings = normalizeSettings(merged);

    if (this.completedInCycle > this.settings.longBreakInterval) {
        this.completedInCycle = this.settings.longBreakInterval;
    }

    if (!this.started && !this.running) {
        this.phaseTotalMs = this.phaseDurationMs();
        this.remainingMs = this.phaseTotalMs;
    }
};

PomodoroEngine.prototype.reset = function () {
    this.running = false;
    this.started = false;
    this.phaseTotalMs = this.phaseDurationMs();
    this.remainingMs = this.phaseTotalMs;
    this.endAt = 0;
};

PomodoroEngine.prototype.start = function (now) {
    if (this.running) {
        return false;
    }
    if (this.remainingMs <= 0) {
        this.reset();
    }
    this.running = true;
    this.started = true;
    this.endAt = now + this.remainingMs;
    return true;
};

PomodoroEngine.prototype.pause = function (now) {
    if (!this.running) {
        return false;
    }
    this.remainingMs = Math.max(0, this.endAt - now);
    this.running = false;
    return true;
};

PomodoroEngine.prototype.toggle = function (now) {
    if (this.running) {
        this.pause(now);
        return false;
    }
    this.start(now);
    return true;
};

PomodoroEngine.prototype.setPhase = function (phase, now, autoStart) {
    this.phase = phase;
    this.running = false;
    this.started = false;
    this.phaseTotalMs = this.phaseDurationMs();
    this.remainingMs = this.phaseTotalMs;
    if (autoStart) {
        this.start(now);
    }
};

PomodoroEngine.prototype.advance = function (now, allowAutoStart) {
    var nextPhase;
    var autoStart = false;

    if (this.phase === "work") {
        this.completedInCycle += 1;
        if (this.completedInCycle >= this.settings.longBreakInterval) {
            nextPhase = "longBreak";
        } else {
            nextPhase = "shortBreak";
        }
        autoStart = allowAutoStart && this.settings.autoStartBreaks;
    } else {
        if (this.phase === "longBreak") {
            this.completedInCycle = 0;
        }
        nextPhase = "work";
        autoStart = allowAutoStart && this.settings.autoStartWork;
    }

    this.setPhase(nextPhase, now, autoStart);
};

// Ends the phase without celebrating it (manual skip).
PomodoroEngine.prototype.skip = function (now) {
    var skipped = this.phase;
    this.running = false;
    this.started = false;
    this.advance(now, false);
    return skipped;
};

// Returns the name of the phase that just finished, or null while the phase is still running.
PomodoroEngine.prototype.tick = function (now) {
    if (!this.running) {
        return null;
    }
    var left = this.endAt - now;
    if (left > 0) {
        this.remainingMs = left;
        return null;
    }

    var finished = this.phase;
    this.running = false;
    this.started = false;
    this.remainingMs = 0;
    this.advance(now, true);
    return finished;
};

PomodoroEngine.prototype.snapshot = function () {
    var progress = 0;
    if (this.phaseTotalMs > 0) {
        progress = 1 - this.remainingMs / this.phaseTotalMs;
    }
    return {
        phase: this.phase,
        session: this.sessionNumber(),
        interval: this.settings.longBreakInterval,
        completedInCycle: this.completedInCycle,
        running: this.running,
        started: this.started,
        remainingMs: this.remainingMs,
        phaseTotalMs: this.phaseTotalMs,
        progress: Math.min(1, Math.max(0, progress)),
    };
};

function createEngine(settings) {
    return new PomodoroEngine(settings);
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        PomodoroEngine: PomodoroEngine,
        createEngine: createEngine,
        normalizeSettings: normalizeSettings,
    };
}
