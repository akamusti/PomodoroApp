/*
    SPDX-FileCopyrightText: 2026 PomodoroApp contributors
    SPDX-License-Identifier: GPL-3.0-or-later

    Panel representation: a tomato/coffee icon plus the remaining time, so the
    countdown stays visible without opening the popup.
*/

import QtQuick
import QtQuick.Layouts

import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.kirigami as Kirigami

Item {
    id: compact

    required property var applet

    readonly property bool verticalPanel: Plasmoid.formFactor === PlasmaCore.Types.Vertical
    readonly property int padding: Kirigami.Units.smallSpacing
    readonly property int iconSize: verticalPanel
        ? Kirigami.Units.iconSizes.small
        : Kirigami.Units.iconSizes.smallMedium
    readonly property color accent: applet.accentColor

    // Reserve room for the widest possible readout so the panel never jiggles per tick.
    readonly property int minuteDigits: {
        const longest = Math.max(Plasmoid.configuration.workDuration,
                                 Plasmoid.configuration.shortBreakDuration,
                                 Plasmoid.configuration.longBreakDuration);
        return Math.max(2, String(longest).length);
    }
    readonly property string reservedText: applet.showSeconds
        ? "0".repeat(minuteDigits) + ":00"
        : "0".repeat(minuteDigits) + " min"

    implicitWidth: verticalPanel ? verticalContent.implicitWidth : horizontalContent.implicitWidth
    implicitHeight: verticalPanel ? verticalContent.implicitHeight : horizontalContent.implicitHeight

    Layout.minimumWidth: verticalPanel ? 0 : Math.ceil(implicitWidth + padding * 2)
    Layout.preferredWidth: verticalPanel ? 0 : Math.ceil(implicitWidth + padding * 2)
    Layout.maximumWidth: verticalPanel ? Infinity : Math.ceil(implicitWidth + padding * 2)
    Layout.fillWidth: verticalPanel

    Layout.minimumHeight: Math.ceil(implicitHeight)
    Layout.preferredHeight: Math.ceil(implicitHeight)
    Layout.maximumHeight: verticalPanel ? Math.ceil(implicitHeight) : Infinity
    Layout.fillHeight: !verticalPanel

    RowLayout {
        id: horizontalContent
        anchors.centerIn: parent
        visible: !compact.verticalPanel
        spacing: Kirigami.Units.smallSpacing

        Image {
            visible: compact.applet.showIcon
            source: Qt.resolvedUrl("../icons/" + compact.applet.iconName)
            sourceSize.width: compact.iconSize
            sourceSize.height: compact.iconSize
            fillMode: Image.PreserveAspectFit
            Layout.preferredWidth: compact.iconSize
            Layout.preferredHeight: compact.iconSize
            Layout.alignment: Qt.AlignVCenter
        }

        PlasmaComponents3.Label {
            id: horizontalLabel
            text: compact.applet.compactTimeText
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignHCenter
            opacity: compact.applet.running || !compact.applet.started ? 1 : 0.55
            Layout.preferredWidth: Math.ceil(horizontalMetrics.width)
            Layout.alignment: Qt.AlignVCenter
        }
    }

    ColumnLayout {
        id: verticalContent
        anchors.centerIn: parent
        visible: compact.verticalPanel
        spacing: Math.round(Kirigami.Units.smallSpacing / 2)

        Image {
            visible: compact.applet.showIcon
            source: Qt.resolvedUrl("../icons/" + compact.applet.iconName)
            sourceSize.width: compact.iconSize
            sourceSize.height: compact.iconSize
            fillMode: Image.PreserveAspectFit
            Layout.preferredWidth: compact.iconSize
            Layout.preferredHeight: compact.iconSize
            Layout.alignment: Qt.AlignHCenter
        }

        PlasmaComponents3.Label {
            text: compact.applet.compactTimeText
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            font.weight: Font.DemiBold
            opacity: compact.applet.running || !compact.applet.started ? 1 : 0.55
            Layout.alignment: Qt.AlignHCenter
        }
    }

    TextMetrics {
        id: horizontalMetrics
        font: horizontalLabel.font
        text: compact.reservedText
    }

    // Thin progress line on the panel edge.
    Item {
        anchors.fill: parent
        visible: compact.applet.showProgress && compact.applet.started

        Rectangle {
            visible: !compact.verticalPanel
            anchors {
                left: parent.left
                right: parent.right
                bottom: parent.bottom
            }
            height: 2
            radius: 1
            color: Kirigami.Theme.textColor
            opacity: 0.12
        }

        Rectangle {
            visible: !compact.verticalPanel
            anchors {
                left: parent.left
                bottom: parent.bottom
            }
            height: 2
            radius: 1
            width: Math.max(0, Math.min(1, compact.applet.progress)) * parent.width
            color: compact.accent
        }

        Rectangle {
            visible: compact.verticalPanel
            anchors {
                top: parent.top
                bottom: parent.bottom
                right: parent.right
            }
            width: 2
            radius: 1
            color: Kirigami.Theme.textColor
            opacity: 0.12
        }

        Rectangle {
            visible: compact.verticalPanel
            anchors {
                bottom: parent.bottom
                right: parent.right
            }
            width: 2
            radius: 1
            height: Math.max(0, Math.min(1, compact.applet.progress)) * parent.height
            color: compact.accent
        }
    }

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.MiddleButton
        cursorShape: Qt.PointingHandCursor

        onClicked: (mouse) => {
            if (mouse.button === Qt.MiddleButton) {
                compact.applet.toggle();
            } else {
                compact.applet.expanded = !compact.applet.expanded;
            }
        }
    }
}
