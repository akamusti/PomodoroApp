// Unit tests for the pure Pomodoro state machine used by the KDE Plasma widget.
// Run with: node --test tests/kde-plasmoid-engine.test.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engineSource = readFileSync(
    new URL("../kde-plasmoid/contents/code/pomodoroEngine.js", import.meta.url),
    "utf8",
);

// The engine is a QML-compatible script, not an ES module, so evaluate it in a
// tiny CommonJS shim instead of importing it.
const sandbox = { exports: {} };
new Function("module", "exports", engineSource)(sandbox, sandbox.exports);
const { createEngine } = sandbox.exports;

const MINUTE = 60000;
const START = 1_700_000_000_000;

test("starts ready with the default 25 minute focus phase", () => {
    const snapshot = createEngine().snapshot();

    assert.equal(snapshot.phase, "work");
    assert.equal(snapshot.remainingMs, 25 * MINUTE);
    assert.equal(snapshot.phaseTotalMs, 25 * MINUTE);
    assert.equal(snapshot.session, 1);
    assert.equal(snapshot.interval, 4);
    assert.equal(snapshot.completedInCycle, 0);
    assert.equal(snapshot.running, false);
    assert.equal(snapshot.started, false);
    assert.equal(snapshot.progress, 0);
});

test("counts down while running and freezes while paused", () => {
    const engine = createEngine();

    engine.start(START);
    assert.equal(engine.tick(START + 10_000), null);
    assert.equal(engine.snapshot().remainingMs, 25 * MINUTE - 10_000);
    assert.equal(engine.snapshot().running, true);

    engine.pause(START + 10_000);
    const frozen = engine.snapshot().remainingMs;
    assert.equal(frozen, 25 * MINUTE - 10_000);

    engine.tick(START + 5 * MINUTE);
    assert.equal(engine.snapshot().remainingMs, frozen);

    engine.start(START + 5 * MINUTE);
    engine.tick(START + 5 * MINUTE + 2000);
    assert.equal(engine.snapshot().remainingMs, frozen - 2000);
});

test("completing a focus session moves to a short break", () => {
    const engine = createEngine();
    engine.start(START);

    assert.equal(engine.tick(START + 25 * MINUTE), "work");

    const snapshot = engine.snapshot();
    assert.equal(snapshot.phase, "shortBreak");
    assert.equal(snapshot.remainingMs, 5 * MINUTE);
    assert.equal(snapshot.completedInCycle, 1);
    assert.equal(snapshot.session, 1);
    assert.equal(snapshot.running, false);
});

test("auto-starts breaks but leaves the next focus session paused", () => {
    const engine = createEngine({ autoStartBreaks: true });
    engine.start(START);

    engine.tick(START + 25 * MINUTE);
    let snapshot = engine.snapshot();
    assert.equal(snapshot.phase, "shortBreak");
    assert.equal(snapshot.running, true);
    assert.equal(snapshot.remainingMs, 5 * MINUTE);

    assert.equal(engine.tick(START + 30 * MINUTE), "shortBreak");
    snapshot = engine.snapshot();
    assert.equal(snapshot.phase, "work");
    assert.equal(snapshot.running, false);
    assert.equal(snapshot.remainingMs, 25 * MINUTE);
});

test("auto-start focus sessions when configured", () => {
    const engine = createEngine({ autoStartBreaks: true, autoStartWork: true });
    engine.start(START);

    engine.tick(START + 25 * MINUTE);
    engine.tick(START + 30 * MINUTE);

    const snapshot = engine.snapshot();
    assert.equal(snapshot.phase, "work");
    assert.equal(snapshot.running, true);
});

test("four focus sessions lead to a long break that resets the cycle", () => {
    const engine = createEngine({ longBreakInterval: 4 });
    let now = START;

    engine.start(now);
    for (let session = 1; session <= 3; session += 1) {
        now += 25 * MINUTE;
        assert.equal(engine.tick(now), "work");
        assert.equal(engine.snapshot().phase, "shortBreak");
        assert.equal(engine.snapshot().completedInCycle, session);

        engine.skip(now);
        assert.equal(engine.snapshot().phase, "work");
        engine.start(now);
    }

    now += 25 * MINUTE;
    assert.equal(engine.tick(now), "work");
    assert.equal(engine.snapshot().phase, "longBreak");
    assert.equal(engine.snapshot().completedInCycle, 4);

    engine.start(now);
    now += 15 * MINUTE;
    assert.equal(engine.tick(now), "longBreak");
    assert.equal(engine.snapshot().phase, "work");
    assert.equal(engine.snapshot().completedInCycle, 0);
});

test("skipping advances the phase without auto-starting it", () => {
    const engine = createEngine({ autoStartBreaks: true });

    assert.equal(engine.skip(START), "work");

    const snapshot = engine.snapshot();
    assert.equal(snapshot.phase, "shortBreak");
    assert.equal(snapshot.running, false);
    assert.equal(snapshot.completedInCycle, 1);
    assert.equal(snapshot.remainingMs, 5 * MINUTE);
});

test("reset returns the current phase to its full duration", () => {
    const engine = createEngine();
    engine.start(START);
    engine.tick(START + 3 * MINUTE);

    engine.reset();

    const snapshot = engine.snapshot();
    assert.equal(snapshot.running, false);
    assert.equal(snapshot.started, false);
    assert.equal(snapshot.remainingMs, 25 * MINUTE);
    assert.equal(snapshot.progress, 0);
});

test("new durations apply to untouched phases only", () => {
    const engine = createEngine();

    engine.setSettings({ work: 40 });
    assert.equal(engine.snapshot().remainingMs, 40 * MINUTE);

    engine.start(START);
    engine.setSettings({ work: 50 });
    assert.equal(engine.snapshot().remainingMs, 40 * MINUTE);
    assert.equal(engine.snapshot().phaseTotalMs, 40 * MINUTE);

    engine.skip(START);
    assert.equal(engine.snapshot().phase, "shortBreak");
    engine.setSettings({ shortBreak: 10 });
    assert.equal(engine.snapshot().remainingMs, 10 * MINUTE);
});

test("custom durations and interval are respected", () => {
    const engine = createEngine({
        work: 20,
        shortBreak: 3,
        longBreak: 10,
        longBreakInterval: 2,
    });
    engine.start(START);
    engine.tick(START + 20 * MINUTE);
    assert.equal(engine.snapshot().phase, "shortBreak");
    assert.equal(engine.snapshot().remainingMs, 3 * MINUTE);

    engine.skip(START + 20 * MINUTE);
    engine.start(START + 20 * MINUTE);
    engine.tick(START + 40 * MINUTE);
    assert.equal(engine.snapshot().phase, "longBreak");
    assert.equal(engine.snapshot().remainingMs, 10 * MINUTE);

    const clamped = createEngine({ longBreakInterval: 0 }).snapshot();
    assert.equal(clamped.interval, 1);
});

test("progress reports the elapsed share of the phase", () => {
    const engine = createEngine();
    engine.start(START);
    engine.tick(START + 12.5 * MINUTE);

    assert.equal(engine.snapshot().progress, 0.5);
});

test("a phase finishing after a long suspend still completes cleanly", () => {
    const engine = createEngine();
    engine.start(START);

    assert.equal(engine.tick(START + 10 * 60 * MINUTE), "work");
    assert.equal(engine.snapshot().phase, "shortBreak");
    assert.equal(engine.snapshot().progress, 0);
});
