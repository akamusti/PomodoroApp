/*
    SPDX-FileCopyrightText: 2026 PomodoroApp contributors
    SPDX-License-Identifier: GPL-3.0-or-later

    Popup representation: full readout, cycle progress and transport controls.
*/

pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Layouts

import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.kirigami as Kirigami

Item {
    id: full

    required property var applet

    readonly property color accent: applet.accentColor

    implicitWidth: Math.max(Math.round(Kirigami.Units.gridUnit * 16.5),
                            transportRow.implicitWidth + Kirigami.Units.gridUnit * 2)
    implicitHeight: Math.round(Kirigami.Units.gridUnit * 14.5)
    Layout.preferredWidth: implicitWidth
    Layout.preferredHeight: implicitHeight

    focus: true

    Keys.onPressed: (event) => {
        if (event.key === Qt.Key_Space) {
            full.applet.toggle();
            event.accepted = true;
        } else if (event.key === Qt.Key_R) {
            full.applet.reset();
            event.accepted = true;
        } else if (event.key === Qt.Key_S) {
            full.applet.skip();
            event.accepted = true;
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Kirigami.Units.gridUnit
        spacing: Math.round(Kirigami.Units.gridUnit * 0.75)

        // Phase badge and cycle position
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Rectangle {
                implicitWidth: phaseRow.implicitWidth + Kirigami.Units.smallSpacing * 2
                implicitHeight: phaseRow.implicitHeight + Math.round(Kirigami.Units.smallSpacing * 1.2)
                radius: height / 2
                color: Qt.rgba(full.accent.r, full.accent.g, full.accent.b, 0.16)

                RowLayout {
                    id: phaseRow
                    anchors.centerIn: parent
                    spacing: Kirigami.Units.smallSpacing

                    Rectangle {
                        implicitWidth: 7
                        implicitHeight: 7
                        radius: 3.5
                        color: full.accent
                    }

                    PlasmaComponents3.Label {
                        text: full.applet.phaseLabel
                        font.weight: Font.DemiBold
                    }
                }
            }

            Item {
                Layout.fillWidth: true
            }

            PlasmaComponents3.Label {
                text: "OTURUM " + full.applet.session + " / " + full.applet.interval
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                font.capitalization: Font.AllUppercase
                font.letterSpacing: 0.6
                opacity: 0.6
            }

            PlasmaComponents3.ToolButton {
                icon.name: "configure"
                Accessible.name: "Ayarlar"
                onClicked: {
                    full.applet.expanded = false;
                    const action = Plasmoid.internalAction("configure");
                    if (action) {
                        action.trigger();
                    }
                }
            }
        }

        // Countdown
        PlasmaComponents3.Label {
            Layout.fillWidth: true
            text: full.applet.timeText
            horizontalAlignment: Text.AlignHCenter
            font.pixelSize: Math.round(Kirigami.Units.gridUnit * 3)
            font.weight: Font.Light
            opacity: full.applet.running || !full.applet.started ? 1 : 0.6
        }

        // Phase progress
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 4

            Rectangle {
                anchors.fill: parent
                radius: 2
                color: Kirigami.Theme.textColor
                opacity: 0.12
            }

            Rectangle {
                width: Math.max(0, Math.min(1, full.applet.progress)) * parent.width
                height: parent.height
                radius: 2
                color: full.accent
            }
        }

        // Completed focus sessions in the current cycle
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: Kirigami.Units.smallSpacing

            Repeater {
                model: full.applet.interval

                delegate: Rectangle {
                    required property int index
                    implicitWidth: Math.round(Kirigami.Units.smallSpacing * 2.5)
                    implicitHeight: 3
                    radius: 1.5
                    color: index < full.applet.completedInCycle ? full.accent : Kirigami.Theme.textColor
                    opacity: index < full.applet.completedInCycle ? 1 : 0.18
                }
            }
        }

        Item {
            Layout.fillHeight: true
        }

        // Transport controls
        RowLayout {
            id: transportRow
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            PlasmaComponents3.Button {
                Layout.fillWidth: true
                text: "Sıfırla"
                icon.name: "view-refresh"
                onClicked: full.applet.reset()
            }

            PlasmaComponents3.Button {
                Layout.fillWidth: true
                text: full.applet.running ? "Duraklat" : "Başlat"
                icon.name: full.applet.running ? "media-playback-pause" : "media-playback-start"
                highlighted: true
                onClicked: full.applet.toggle()
            }

            PlasmaComponents3.Button {
                Layout.fillWidth: true
                text: "Atla"
                icon.name: "media-skip-forward"
                onClicked: full.applet.skip()
            }
        }
    }
}
