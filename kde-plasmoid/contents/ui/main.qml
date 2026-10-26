/*
    SPDX-FileCopyrightText: 2026 PomodoroApp contributors
    SPDX-License-Identifier: GPL-3.0-or-later
*/

import QtQuick

import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasmoid

import "../code/pomodoroEngine.js" as PomodoroEngine

PlasmoidItem {
    id: root

    // Pure JS state machine; the properties below mirror its snapshot for QML bindings.
    readonly property var engine: PomodoroEngine.createEngine({})

    property string phase: "work"
    property int completedInCycle: 0
    property int session: 1
    property int interval: 4
    property bool running: false
    property bool started: false
    property real remainingMs: Plasmoid.configuration.workDuration * 60000
    property real phaseTotalMs: Plasmoid.configuration.workDuration * 60000

    readonly property bool showSeconds: Plasmoid.configuration.showSeconds
    readonly property bool showIcon: Plasmoid.configuration.showIcon
    readonly property bool showProgress: Plasmoid.configuration.showProgress

    readonly property string phaseLabel: phase === "shortBreak" ? "Kısa Mola"
                                       : phase === "longBreak" ? "Uzun Mola"
                                       : "Odak"
    readonly property color accentColor: phase === "shortBreak" ? "#3b8561"
                                       : phase === "longBreak" ? "#3d7294"
                                       : "#d94e34"
    readonly property string iconName: phase === "shortBreak" ? "break-short.svg"
                                     : phase === "longBreak" ? "break-long.svg"
                                     : "pomodoro.svg"

    readonly property real progress: phaseTotalMs > 0
        ? Math.min(1, Math.max(0, 1 - remainingMs / phaseTotalMs))
        : 0

    readonly property string timeText: root.formatClock(remainingMs)
    readonly property string compactTimeText: showSeconds
        ? timeText
        : Math.max(1, Math.ceil(remainingMs / 60000)) + " dk"
    readonly property string stateLabel: running ? "Devam ediyor"
                                       : started ? "Duraklatıldı"
                                       : "Hazır"

    // Re-evaluated whenever a preference changes, so the engine can adopt new durations.
    readonly property var engineSettings: ({
        work: Plasmoid.configuration.workDuration,
        shortBreak: Plasmoid.configuration.shortBreakDuration,
        longBreak: Plasmoid.configuration.longBreakDuration,
        longBreakInterval: Plasmoid.configuration.longBreakInterval,
        autoStartBreaks: Plasmoid.configuration.autoStartBreaks,
        autoStartWork: Plasmoid.configuration.autoStartFocus,
    })

    onEngineSettingsChanged: root.applySettings()

    toolTipMainText: "Pomodoro · " + root.phaseLabel
    toolTipSubText: root.timeText + " kaldı"
        + "\nOturum " + root.session + " / " + root.interval + " · " + root.stateLabel
        + "\nOrta tık: başlat / duraklat"
    toolTipTextFormat: Text.PlainText

    compactRepresentation: CompactRepresentation {
        applet: root
    }

    fullRepresentation: FullRepresentation {
        applet: root
    }

    Timer {
        id: ticker
        interval: 1000
        repeat: true
        running: root.running
        triggeredOnStart: true
        onTriggered: root.handleTick()
    }

    // Kept in a separate component so a missing plasma5support module cannot break the widget.
    Loader {
        id: commandRunner
        source: "SystemCommand.qml"
    }

    PlasmaCore.Action {
        id: toggleAction
        text: root.running ? "Duraklat" : "Başlat"
        icon.name: root.running ? "media-playback-pause" : "media-playback-start"
        onTriggered: root.toggle()
    }

    PlasmaCore.Action {
        id: resetAction
        text: "Sıfırla"
        icon.name: "view-refresh"
        onTriggered: root.reset()
    }

    PlasmaCore.Action {
        id: skipAction
        text: "Sonraki aşama"
        icon.name: "media-skip-forward"
        onTriggered: root.skip()
    }

    function formatClock(milliseconds) {
        var totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;
        return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    function sync() {
        var snapshot = root.engine.snapshot();
        root.phase = snapshot.phase;
        root.completedInCycle = snapshot.completedInCycle;
        root.session = snapshot.session;
        root.interval = snapshot.interval;
        root.running = snapshot.running;
        root.started = snapshot.started;
        root.remainingMs = snapshot.remainingMs;
        root.phaseTotalMs = snapshot.phaseTotalMs;
    }

    function applySettings() {
        root.engine.setSettings(root.engineSettings);
        root.sync();
    }

    function handleTick() {
        var finishedPhase = root.engine.tick(Date.now());
        root.sync();
        if (finishedPhase) {
            root.announce(finishedPhase);
        }
    }

    function toggle() {
        root.engine.toggle(Date.now());
        root.sync();
    }

    function start() {
        root.engine.start(Date.now());
        root.sync();
    }

    function pause() {
        root.engine.pause(Date.now());
        root.sync();
    }

    function reset() {
        root.engine.reset();
        root.sync();
    }

    function skip() {
        root.engine.skip(Date.now());
        root.sync();
    }

    function runCommand(command) {
        if (commandRunner.item) {
            commandRunner.item.run(command);
        }
    }

    function quote(text) {
        return "\"" + String(text).replace(/"/g, "'") + "\"";
    }

    function announce(finishedPhase) {
        var nextMinutes = Math.max(1, Math.round(root.phaseTotalMs / 60000));
        var title = finishedPhase === "work" ? "Odak oturumu tamamlandı" : "Mola tamamlandı";
        var body;

        if (finishedPhase === "work") {
            body = (root.phase === "longBreak" ? "Uzun mola" : "Kısa mola")
                + " zamanı (" + nextMinutes + " dk).";
        } else {
            body = "Yeni odak oturumu hazır (" + nextMinutes + " dk).";
        }

        if (Plasmoid.configuration.notificationsEnabled) {
            root.runCommand("notify-send -a Pomodoro -i chronometer "
                + root.quote(title) + " " + root.quote(body));
        }
        if (Plasmoid.configuration.soundEnabled) {
            root.runCommand("canberra-gtk-play -i complete");
        }
    }

    Component.onCompleted: {
        root.applySettings();
        Plasmoid.contextualActions.push(toggleAction);
        Plasmoid.contextualActions.push(resetAction);
        Plasmoid.contextualActions.push(skipAction);
    }
}
