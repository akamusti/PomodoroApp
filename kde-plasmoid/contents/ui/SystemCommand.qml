/*
    SPDX-FileCopyrightText: 2026 PomodoroApp contributors
    SPDX-License-Identifier: GPL-3.0-or-later

    Runs shell commands through Plasma's executable data engine. Loaded lazily so the
    widget keeps working (without notifications or sound) when the module is missing.
*/

import QtQuick

import org.kde.plasma.plasma5support as Plasma5Support

Item {
    id: runner

    visible: false

    function run(command) {
        try {
            executable.connectSource(command);
        } catch (error) {
            // Missing helper binaries or a broken data engine must never crash the widget.
        }
    }

    Plasma5Support.DataSource {
        id: executable
        engine: "executable"
        connectedSources: []

        onNewData: (sourceName, data) => {
            executable.disconnectSource(sourceName);
        }
    }
}
