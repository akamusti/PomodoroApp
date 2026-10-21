# 🍅 PomodoroApp (Linux Desktop & CLI)

A sleek, modern, distraction-free Pomodoro timer built for Linux with **Tauri v2 (Rust)** and modern web technologies. Also includes lightweight terminal/CLI versions.

---

## ✨ Features (Desktop App)

- **Minimalist & Distraction-free Dark UI:** Designed with smooth circular SVG progress countdowns and mode badges.
- **Ultra-lightweight Resource Usage:** Powered by Tauri v2 and Rust (~15-20 MB RAM footprint).
- **System Tray Integration:** Runs discreetly in your KDE Plasma / GNOME tray bar with quick show/hide/quit controls. Minimize-to-tray keeps your workflow clean.
- **Native Linux Desktop Notifications:** Freedesktop / libnotify integration alerts you when focus sessions and breaks conclude.
- **Synthesized Audio Cues:** Harmonious chime alerts for session transitions built with Web Audio API (no missing codec/file errors).
- **Customizable Sessions:** Easily tweak Focus time, Short Break, Long Break, intervals, sound, and auto-start preferences.
- **Terminal (CLI) Versions:** Legacy Python, Bash, and C implementations preserved in the `cli/` directory.

---

## 🚀 Running the Desktop App

### Prerequisites (Fedora Linux)
```bash
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

### Development Mode
```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```
The compiled standalone binary and installer packages will be available in `src-tauri/target/release/bundle/`.

---

## 💻 Terminal / CLI Versions (Legacy)

If you prefer terminal-only timers:

```bash
# Python CLI
python3 cli/pomodoro.py

# Bash CLI
bash cli/pomodoro.sh

# C CLI
gcc -O2 -o pomodoro-bin cli/pomodoro.c && ./pomodoro-bin
```

---

## 📜 License
This project is licensed under the [GNU General Public License v3.0](LICENSE).
