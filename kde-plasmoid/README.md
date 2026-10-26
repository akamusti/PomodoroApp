# Pomodoro — KDE Plasma 6 panel widget

A native Plasma panel applet that shows how much time is left in the current Pomodoro phase.
The UI is Turkish and the timer is fully independent of the Tauri desktop app: it keeps
running while PomodoroApp is closed.

## Install

You only need KDE Plasma 6; you do **not** need to clone this repository or build the Tauri app.

### Option A — download the ready-made package (recommended)

Download [`io.github.akamusti.pomodoro.plasmoid`][latest-plasmoid] from the latest release and
install it with one command:

```bash
curl -fL -o ~/Downloads/io.github.akamusti.pomodoro.plasmoid \
  https://github.com/akamusti/PomodoroApp/releases/latest/download/io.github.akamusti.pomodoro.plasmoid

kpackagetool6 --type Plasma/Applet --install ~/Downloads/io.github.akamusti.pomodoro.plasmoid
```

Or install it without a terminal:

1. Right-click the panel → **Enter Edit Mode** → **Add or Manage Widgets…**
2. Open **Get New Widgets…** → **Install Widget From Local File…**
3. Pick the downloaded `.plasmoid` file, then drag **Pomodoro** from the list onto the panel.

### Option B — install from source

```bash
git clone https://github.com/akamusti/PomodoroApp.git
cd PomodoroApp
./scripts/install-plasmoid.sh
```

### After installing

Right-click the panel → **Add or Manage Widgets…** → search for **Pomodoro** and drag it onto
the panel. If the widget does not show up yet, reload the shell:

```bash
systemctl --user restart plasma-plasmashell.service
```

### Update

Download the new package the same way and replace the installed copy:

```bash
kpackagetool6 --type Plasma/Applet --upgrade ~/Downloads/io.github.akamusti.pomodoro.plasmoid
```

### Uninstall

```bash
kpackagetool6 --type Plasma/Applet --remove io.github.akamusti.pomodoro
```

### Requirements

- KDE Plasma 6.0 or newer (tested on Plasma 6.7).
- `notify-send` and `canberra-gtk-play` are optional; without them the widget still runs, it
  just cannot show desktop notifications or play the completion chime.

[latest-plasmoid]: https://github.com/akamusti/PomodoroApp/releases/latest/download/io.github.akamusti.pomodoro.plasmoid

## Features

- **Panel readout:** tomato / coffee icon plus `mm:ss` (or `NN dk` when seconds are hidden),
  with an optional thin progress line along the panel edge.
- **Popup:** phase badge, cycle position (`OTURUM 2 / 4`), large countdown, progress bar,
  cycle dots and `Sıfırla` / `Başlat` / `Duraklat` / `Atla` controls.
- **Settings page:** focus, short break and long break durations, sessions per cycle,
  auto-start for breaks and focus sessions, desktop notifications, sound, and panel display
  options.
- **Notifications and chime:** sent with `notify-send` and `canberra-gtk-play`, so they degrade
  silently when either helper is unavailable.
- **Sleep-safe countdown:** remaining time is derived from a wall-clock target, so suspending
  the machine does not stall the timer.
- **Vertical panels:** supported with a stacked icon and readout.

## Layout

```
metadata.json                     Plasma/Applet package metadata
contents/code/pomodoroEngine.js   Pure timer state machine (unit tested)
contents/config/main.xml          KConfigXT schema and defaults
contents/config/config.qml        Settings category
contents/ui/main.qml              PlasmoidItem: engine wiring, notifications, actions
contents/ui/CompactRepresentation.qml
contents/ui/FullRepresentation.qml
contents/ui/ConfigGeneral.qml
contents/ui/SystemCommand.qml      Lazily loaded executable data-engine wrapper
contents/icons/                   Panel icons
```

## Development

- Timer logic lives in `contents/code/pomodoroEngine.js` and takes `Date.now()` values as
  arguments, which keeps it deterministic and testable outside QML.
- Tests: `node --test tests/kde-plasmoid-engine.test.mjs`
- Install / upgrade from source: `../scripts/install-plasmoid.sh`
- Build the distributable archive: `../scripts/package-plasmoid.sh` (writes
  `dist/io.github.akamusti.pomodoro.plasmoid`)
- Publish a release so the download links above keep working:
  `gh release create plasmoid-v<version> dist/io.github.akamusti.pomodoro.plasmoid`
- The installed package is a copy, so rerun the install script after editing the sources and
  restart the shell to pick up QML changes:
  `systemctl --user restart plasma-plasmashell.service`
