/*
    SPDX-FileCopyrightText: 2026 PomodoroApp contributors
    SPDX-License-Identifier: GPL-3.0-or-later
*/

import QtQuick

import org.kde.kcmutils as KCM
import org.kde.kirigami as Kirigami
import org.kde.plasma.components as PlasmaComponents3

KCM.SimpleKCM {
    id: root

    signal configurationChanged

    property alias cfg_workDuration: workSpin.value
    property alias cfg_shortBreakDuration: shortBreakSpin.value
    property alias cfg_longBreakDuration: longBreakSpin.value
    property alias cfg_longBreakInterval: intervalSpin.value
    property alias cfg_autoStartBreaks: autoStartBreaksCheck.checked
    property alias cfg_autoStartFocus: autoStartFocusCheck.checked
    property alias cfg_notificationsEnabled: notificationsCheck.checked
    property alias cfg_soundEnabled: soundCheck.checked
    property alias cfg_showSeconds: showSecondsCheck.checked
    property alias cfg_showIcon: showIconCheck.checked
    property alias cfg_showProgress: showProgressCheck.checked

    Kirigami.FormLayout {
        PlasmaComponents3.SpinBox {
            id: workSpin
            from: 1
            to: 180
            Kirigami.FormData.label: "Focus duration (min):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: shortBreakSpin
            from: 1
            to: 60
            Kirigami.FormData.label: "Short break (min):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: longBreakSpin
            from: 1
            to: 90
            Kirigami.FormData.label: "Long break (min):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: intervalSpin
            from: 1
            to: 12
            Kirigami.FormData.label: "Sessions before a long break:"
            onValueModified: root.configurationChanged()
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Behavior"
        }

        PlasmaComponents3.CheckBox {
            id: autoStartBreaksCheck
            text: "Start breaks automatically"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: autoStartFocusCheck
            text: "Start focus sessions automatically"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: notificationsCheck
            text: "Desktop notifications"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: soundCheck
            text: "Sound cue"
            onToggled: root.configurationChanged()
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Panel appearance"
        }

        PlasmaComponents3.CheckBox {
            id: showSecondsCheck
            text: "Show seconds"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: showIconCheck
            text: "Show icon"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: showProgressCheck
            text: "Show progress line"
            onToggled: root.configurationChanged()
        }
    }
}
