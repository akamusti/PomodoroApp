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
            Kirigami.FormData.label: "Odak süresi (dk):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: shortBreakSpin
            from: 1
            to: 60
            Kirigami.FormData.label: "Kısa mola (dk):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: longBreakSpin
            from: 1
            to: 90
            Kirigami.FormData.label: "Uzun mola (dk):"
            onValueModified: root.configurationChanged()
        }

        PlasmaComponents3.SpinBox {
            id: intervalSpin
            from: 1
            to: 12
            Kirigami.FormData.label: "Uzun moladan önceki oturum:"
            onValueModified: root.configurationChanged()
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Davranış"
        }

        PlasmaComponents3.CheckBox {
            id: autoStartBreaksCheck
            text: "Molalar otomatik başlasın"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: autoStartFocusCheck
            text: "Odak oturumları otomatik başlasın"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: notificationsCheck
            text: "Masaüstü bildirimleri"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: soundCheck
            text: "Sesli uyarı"
            onToggled: root.configurationChanged()
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Panel görünümü"
        }

        PlasmaComponents3.CheckBox {
            id: showSecondsCheck
            text: "Saniyeleri göster"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: showIconCheck
            text: "Simgeyi göster"
            onToggled: root.configurationChanged()
        }

        PlasmaComponents3.CheckBox {
            id: showProgressCheck
            text: "İlerleme çubuğunu göster"
            onToggled: root.configurationChanged()
        }
    }
}
