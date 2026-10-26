# Pomodoro — KDE Plasma 6 panel widget

A native Plasma panel applet that shows how much time is left in the current Pomodoro phase.
The UI is Turkish and the timer is fully independent of the Tauri desktop app: it keeps
running while PomodoroApp is closed.

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
- Install / upgrade: `../scripts/install-plasmoid.sh`
- The installed package is a copy, so rerun the install script after editing the sources and
  restart the shell to pick up QML changes:
  `systemctl --user restart plasma-plasmashell.service`
