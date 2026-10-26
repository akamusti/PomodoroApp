# Pomodoro — KDE Plasma 6 panel widget

A native Plasma panel applet that shows how much time is left in the current Pomodoro phase.
The UI is Turkish and the timer is fully independent of the Tauri desktop app: it keeps
running while PomodoroApp is closed.

## Install

You only need KDE Plasma 6; there is no build step and no repository checkout.

### Option A — install the downloaded package (recommended)

1. Download [`io.github.akamusti.pomodoro.plasmoid`][plasmoid-release] (about 14 KB).
2. Install it, either from the panel or from a terminal.

   **From the panel (no terminal):**

   1. Right-click the panel → **Enter Edit Mode** (*Düzenleme Kipine Gir*).
   2. Click **Add or Manage Widgets…** (*Araç Takımları Ekle veya Yönet…*).
   3. Click **Get New…** (*Yeni Al…*) → **Install Widget From Local File…**
      (*Yerel Dosyadan Araç Takımı Kur…*) and choose the downloaded `.plasmoid` file.

   **From a terminal:**

   ```bash
   kpackagetool6 --type Plasma/Applet --install ~/Downloads/io.github.akamusti.pomodoro.plasmoid
   ```

   Or download and install in one go:

   ```bash
   curl -fL -o ~/Downloads/io.github.akamusti.pomodoro.plasmoid \
     https://github.com/akamusti/PomodoroApp/releases/download/plasmoid-v1.0.0/io.github.akamusti.pomodoro.plasmoid
   kpackagetool6 --type Plasma/Applet --install ~/Downloads/io.github.akamusti.pomodoro.plasmoid
   ```

3. Add it to the panel: **Add or Manage Widgets…** → search for **Pomodoro** → drag it onto the
   panel.

> **Double-clicking the file opens Ark — that is expected.** A `.plasmoid` file is really a ZIP
> archive, so Dolphin hands it to Ark. You do **not** need to extract it, and extracting it does
> not install anything. Close Ark and install the file as it is with the steps above.

> **Already extracted the archive?** The extracted folder is the same package and can be
> installed instead:
> `kpackagetool6 --type Plasma/Applet --install ~/Downloads/io.github.akamusti.pomodoro`.
> Installing the original `.plasmoid` file is still the simpler option.

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

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `kpackagetool6` reports that the widget is already installed | Use `--upgrade` instead of `--install` (see [Update](#update)). |
| **Pomodoro** is missing from the widget list | Reload the shell: `systemctl --user restart plasma-plasmashell.service`. |
| No notification or chime when a phase ends | Install the optional helpers, e.g. on Fedora `sudo dnf install libnotify libcanberra`. |
| The file opens in Ark / shows a ZIP icon | Expected, see the note above — do not extract it. |

### Requirements

- KDE Plasma 6.0 or newer (tested on Plasma 6.7).
- `notify-send` and `canberra-gtk-play` are optional; without them the widget still runs, it
  just cannot show desktop notifications or play the completion chime.

[plasmoid-release]: https://github.com/akamusti/PomodoroApp/releases/tag/plasmoid-v1.0.0

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
  `gh release create plasmoid-v<version> dist/io.github.akamusti.pomodoro.plasmoid --latest=false`
  (`--latest=false` keeps the desktop app release as the repository's latest release)
- The installed package is a copy, so rerun the install script after editing the sources and
  restart the shell to pick up QML changes:
  `systemctl --user restart plasma-plasmashell.service`
