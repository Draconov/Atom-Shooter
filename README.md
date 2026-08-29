<div align="center">
  <img src="web/assets/icon-192.png" width="128" height="128" alt="Atom Shooter icon">

# ATOM SHOOTER

**A modern remake of the original 2013 Android arcade game.**

[![Play Web Version](https://img.shields.io/badge/PLAY-WEB%20VERSION-14a8b2?style=for-the-badge&logo=github)](https://draconov.github.io/Atom-Shooter/)
[![Download Atom-Shooter.exe](https://img.shields.io/badge/DOWNLOAD-ATOM--SHOOTER.EXE-ef355d?style=for-the-badge&logo=windows)](https://github.com/Draconov/Atom-Shooter/releases/latest/download/Atom-Shooter.exe)
[![Download Atom-Shooter.apk](https://img.shields.io/badge/DOWNLOAD-ATOM--SHOOTER.APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Draconov/Atom-Shooter/releases/latest/download/Atom-Shooter.apk)

[![Deploy GitHub Pages](https://github.com/Draconov/Atom-Shooter/actions/workflows/pages.yml/badge.svg)](https://github.com/Draconov/Atom-Shooter/actions/workflows/pages.yml)
[![Build Windows EXE](https://github.com/Draconov/Atom-Shooter/actions/workflows/windows.yml/badge.svg)](https://github.com/Draconov/Atom-Shooter/actions/workflows/windows.yml)
[![Build Android APK](https://github.com/Draconov/Atom-Shooter/actions/workflows/android.yml/badge.svg)](https://github.com/Draconov/Atom-Shooter/actions/workflows/android.yml)

</div>

---

## About

Atom Shooter is an independent remake of the original Android game, rebuilt from scratch for modern browsers, Windows, and Android.

The repository does not distribute original files like code, music, or proprietary artwork. Everything used in this project are newly created for the remake trying to keep the original game's core identity and progression.

## Platforms

The same game code is used across all supported platforms:

- Web through GitHub Pages
- Windows as a portable `Atom-Shooter.exe`
- Android as an installable `Atom-Shooter.apk`

Use the badges at the top of this README to play or download the latest builds.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop version:

```bash
npm start
```

Run the web version locally:

```bash
npx serve web
```

Run regression checks:

```bash
npm test
```

Build the portable Windows executable:

```bash
npm run dist:win
```

Windows output:

```text
dist/Atom-Shooter.exe
```

Build the Android APK locally with JDK 17, Android SDK API 35, Build Tools 35.0.0, and Gradle 8.11.1:

```bash
gradle -p android :app:assembleDebug --no-daemon
```

Android output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Repository layout

```text
Atom-Shooter/
├─ web/                  Browser game and shared game assets
│  ├─ assets/
│  └─ src/
├─ electron/             Windows desktop wrapper
├─ android/              Android WebView wrapper
├─ build/                Desktop build assets
├─ scripts/              Regression and smoke checks
├─ .github/workflows/    Web, Windows, and Android automation
├─ package.json
├─ CHANGELOG.md
└─ README.md
```

## Releases

GitHub Actions handles all three distribution targets.

The web workflow deploys the `web/` directory to GitHub Pages. The Windows workflow builds `Atom-Shooter.exe`, and the Android workflow builds `Atom-Shooter.apk`.

Both binary workflows use the version from `package.json` and update the matching GitHub Release without deleting the other platform's asset.

## Developer

Developed and maintained by **Draconov**.
