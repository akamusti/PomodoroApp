#!/usr/bin/env bash
# Installs, upgrades or removes the KDE Plasma panel widget bundled with PomodoroApp.
#
# Usage:
#   scripts/install-plasmoid.sh            # install or upgrade
#   scripts/install-plasmoid.sh --remove   # uninstall

set -euo pipefail

PLUGIN_ID="io.github.akamusti.pomodoro"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../kde-plasmoid" && pwd)"

if ! command -v kpackagetool6 >/dev/null 2>&1; then
    echo "kpackagetool6 is missing. Install the Plasma desktop (plasma-workspace) first." >&2
    exit 1
fi

if [[ ! -f "$PACKAGE_DIR/metadata.json" ]]; then
    echo "Package metadata not found in $PACKAGE_DIR" >&2
    exit 1
fi

case "${1:-install}" in
    install|--install)
        if kpackagetool6 --type Plasma/Applet --list 2>/dev/null | grep -qx "$PLUGIN_ID"; then
            kpackagetool6 --type Plasma/Applet --upgrade "$PACKAGE_DIR"
            echo "Upgraded the Pomodoro panel widget."
        else
            kpackagetool6 --type Plasma/Applet --install "$PACKAGE_DIR"
            echo "Installed the Pomodoro panel widget."
        fi
        echo "Add it from the panel: right-click the panel -> 'Add or Manage Widgets' -> search 'Pomodoro'."
        echo "If it does not show up yet, reload plasmashell: systemctl --user restart plasma-plasmashell.service"
        ;;
    remove|--remove|uninstall|--uninstall)
        kpackagetool6 --type Plasma/Applet --remove "$PLUGIN_ID"
        echo "Removed the Pomodoro panel widget."
        ;;
    *)
        echo "Usage: $0 [install|--remove]" >&2
        exit 2
        ;;
esac
