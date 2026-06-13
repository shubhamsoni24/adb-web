<div align="center">

# 📱 adb-web

**A beautiful, browser-based ADB APK installer and Android device manager.**  
No Electron. No heavy desktop app. Just Node.js + a browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## ✨ Features

- 📦 **Drag & drop APK installer** — drop your `.apk` and install in one click
- 📱 **Auto device detection** — lists all connected ADB devices, auto-refreshes
- 🔴 **Live log console** — real-time WebSocket output from ADB
- 🗂️ **Package manager** — list, search, and uninstall installed apps
- ⚡ **Quick actions** — reboot, recovery, bootloader, logcat, kill/start server
- ✅ **Confirm prompts** — animated modal before every destructive action
- ⚙️ **Configurable ADB path** — works even if ADB is not in your system PATH
- 🌙 **Dark UI** — premium glassmorphism design, fully responsive

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v16 or higher
- [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (for `adb`)
- Android phone with **USB Debugging** enabled

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/adb-web.git
cd adb-web
npm install
npm start
```

Then open **http://localhost:3737** in your browser.

---

## 📱 Enable USB Debugging on Your Phone

1. **Settings** → **About Phone** → tap **Build Number** 7 times
2. **Settings** → **Developer Options** → enable **USB Debugging**
3. Connect phone via USB cable
4. Accept the **"Allow USB Debugging?"** prompt on your phone

---

## ⚙️ Configure ADB Path

If `adb` is not in your system PATH, go to the **⚙️ Settings** tab in the app and set the full path:

```
C:\platform-tools\adb.exe          # Windows
/usr/local/bin/adb                 # macOS/Linux
```

---

## 🖼️ Screenshots

> _Coming soon — contributions welcome!_

---

## 📁 Project Structure

```
adb-web/
├── server.js       # Express + WebSocket backend, ADB integration
├── index.html      # Full frontend (vanilla HTML/CSS/JS)
├── package.json
├── .gitignore
└── LICENSE
```

---

## 🔒 Security Notes

- ADB shell commands are **whitelisted** — only safe read-only commands are allowed via the UI
- Uploaded APKs are stored **locally only** on your machine
- The server binds to `localhost` only by default — not exposed to the network

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 💡 Roadmap

- [ ] Batch APK installation (multiple files)
- [ ] Screenshot & screen recording support
- [ ] File push/pull from device storage
- [ ] Wireless ADB (connect over Wi-Fi)
- [ ] Dark/light theme toggle

---

## 📄 License

[MIT](LICENSE) © 2026 sonys
