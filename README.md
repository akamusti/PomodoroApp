# 🍅 PomodoroApp

[![GitHub Release](https://img.shields.io/github/v/release/akamusti/PomodoroApp?color=brightgreen&label=Release)](https://github.com/akamusti/PomodoroApp/releases/latest)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-orange?logo=linux&logoColor=white)](https://github.com/akamusti/PomodoroApp/releases/latest)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](https://github.com/akamusti/PomodoroApp/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

A sleek, modern, distraction-free Pomodoro timer built for **Linux and Windows** using **Tauri v2 (Rust)** and modern web technologies. Designed for zero-distraction focus, native desktop integration, rich ambient soundscapes, and ultra-low system resource consumption (~15-20 MB RAM).

Lightweight terminal (CLI) implementations (Python, Bash, C) are also preserved for CLI enthusiasts.

---

## 📥 Download & Quick Start

Ready-to-use binaries are automatically built and released on GitHub for 64-bit **Linux** (`x86_64` / `amd64`) and 64-bit **Windows** (`x64`).

👉 **[Download the latest release here](https://github.com/akamusti/PomodoroApp/releases/latest)**

### 🪟 Windows (Windows 10 / 11 64-bit)

1. Download the Windows installer (`Pomodoro_*_x64-setup.exe` or `.msi`) from the [Releases](https://github.com/akamusti/PomodoroApp/releases/latest) page.
2. Run the installer and launch Pomodoro from the Start menu or desktop shortcut.
3. Fully integrated with Windows system tray and desktop notifications.

---

### 🐧 Linux

#### Option 1: AppImage (Universal Linux - Recommended)
Compatible with almost all modern distributions (Fedora, Ubuntu, Arch Linux, Debian, openSUSE, Linux Mint, Manjaro, etc.).

1. Download `Pomodoro_*_amd64.AppImage` from the [Releases](https://github.com/akamusti/PomodoroApp/releases/latest) page.
2. Grant execution permission:
   ```bash
   chmod +x Pomodoro_*_amd64.AppImage
   ```
3. Run the application:
   ```bash
   ./Pomodoro_*_amd64.AppImage
   ```

> [!TIP]
> - If you use Ubuntu 22.04+ or a system without FUSE 2, install `libfuse2` if needed:
>   - **Ubuntu / Debian:** `sudo apt install libfuse2`
>   - **Fedora:** `sudo dnf install fuse-libs`
> - If your graphics driver (NVIDIA / Mesa on Wayland) encounters a WebKitGTK assertion crash, automatic fallback is enabled out of the box (`WEBKIT_DISABLE_DMABUF_RENDERER=1`).

#### Option 2: DEB Package (Debian / Ubuntu / Mint)

1. Download the `.deb` package from the [Releases](https://github.com/akamusti/PomodoroApp/releases/latest) page.
2. Install via terminal:
   ```bash
   sudo dpkg -i pomodoro_*_amd64.deb
   ```
   Or open with your distribution's Software Center / GDebi.

#### Option 3: RPM Package (Fedora / RHEL / openSUSE)

1. Download the `.rpm` package from the [Releases](https://github.com/akamusti/PomodoroApp/releases/latest) page.
2. Install via terminal:
   ```bash
   sudo rpm -i pomodoro-*.x86_64.rpm
   ```

---

## ✨ Features

- **Cross-Platform Desktop Integration:** Native support for both **Linux** (GNOME, KDE Plasma, XFCE via AppIndicator/libnotify) and **Windows** (System Tray, Toast Notifications).
- **Ambient Sounds (Blanket Mode):** Built-in procedural ambient noise synthesizer generating seamless audio loops. Play and mix soothing nature sounds (Rain, Storm & Thunder, Wind, Ocean Waves, Fireplace, Forest Birds, Coffee Shop, White & Deep Brown Noise) with individual volume sliders and quick presets (`B` shortcut). Zero CPU overhead, zero external audio dependencies.
- **Focus Session Sync:** Optional auto-sync to play ambient sounds only during active work periods and auto-pause during breaks.
- **Minimalist & Distraction-free Dark UI:** Clean circular countdown animation with dynamic mode indicators (Focus, Short Break, Long Break).
- **System Tray Integration:** Runs discreetly in your desktop tray. Minimize to tray on close to maintain your workflow without cluttering the taskbar.
- **Native Notifications:** Sends system notifications when focus or break sessions complete.
- **Harmonious Audio Cues:** Synthesized chime alerts — works out-of-the-box with zero missing external audio codecs or file dependencies.
- **Customizable Preferences:**
  - Adjustable Focus, Short Break, and Long Break durations
  - Long Break interval cycles (e.g. every 4 pomodoros)
  - Auto-start breaks and auto-start focus sessions toggles
  - Sound effect mute/unmute toggle
- **Ultra-Lightweight & Fast:** Built on Rust and Tauri v2, using minimal CPU cycles and only ~15–20 MB of RAM.

---

## 🛠️ Building From Source

If you prefer to compile from source or contribute to development:

### 1. Prerequisites

Ensure you have **Node.js 18+** and **Rust stable** (`rustup`) installed.

#### Linux Dependencies:
- **Fedora:**
  ```bash
  sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel patchelf
  ```
- **Debian / Ubuntu / Linux Mint:**
  ```bash
  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```
- **Arch Linux:**
  ```bash
  sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg patchelf
  ```

#### Windows Dependencies:
- **Visual Studio C++ Build Tools** (Select "Desktop development with C++")
- **WebView2 Runtime** (Pre-installed on modern Windows 10/11)

### 2. Development Mode

```bash
# Clone the repository
git clone https://github.com/akamusti/PomodoroApp.git
cd PomodoroApp

# Install dependencies
npm install

# Start in development mode (hot-reload enabled)
npm run tauri dev
```

### 3. Production Build

To produce standalone release installers locally:

```bash
npm run tauri build
```

The resulting packages will be generated under:
- **Linux:** `src-tauri/target/release/bundle/appimage/`, `deb/`, `rpm/`
- **Windows:** `src-tauri/target/release/bundle/nsis/` (`.exe`) and `msi/` (`.msi`)

---

## 💻 Terminal / CLI Versions (Legacy)

For minimalist terminal users, standalone command-line scripts are available in the [`cli/`](cli/) directory:

```bash
# Python CLI
python3 cli/pomodoro.py

# Bash CLI (zero dependencies)
bash cli/pomodoro.sh

# C CLI (high performance)
gcc -O2 -o pomodoro-bin cli/pomodoro.c
./pomodoro-bin
```

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
