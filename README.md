<div align="center">
  <img src="web/assets/icon-192.png" width="128" height="128" alt="Atom Shooter icon">

# ATOM SHOOTER

**Asteroids-style nano combat meets the periodic table.**  
Strip electrons, crack the nucleus, collect neutrons, dodge protons, and upgrade your ship across all 118 elements.

[![Play Web Version](https://img.shields.io/badge/PLAY-WEB%20VERSION-14a8b2?style=for-the-badge&logo=github)](https://draconov.github.io/Atom-Shooter/)
[![Download Windows EXE](https://img.shields.io/badge/DOWNLOAD-WINDOWS%20EXE-ef355d?style=for-the-badge&logo=windows)](https://github.com/Draconov/Atom-Shooter/releases/latest/download/Atom-Shooter-Windows.exe)
[![Latest Release](https://img.shields.io/github/v/release/Draconov/Atom-Shooter?style=for-the-badge&label=RELEASE)](https://github.com/Draconov/Atom-Shooter/releases/latest)

[![Deploy GitHub Pages](https://github.com/Draconov/Atom-Shooter/actions/workflows/pages.yml/badge.svg)](https://github.com/Draconov/Atom-Shooter/actions/workflows/pages.yml)
[![Build Windows EXE](https://github.com/Draconov/Atom-Shooter/actions/workflows/windows.yml/badge.svg)](https://github.com/Draconov/Atom-Shooter/actions/workflows/windows.yml)

**Web • Windows • Keyboard/Mouse • Touch • 118 levels**
</div>

---

## Play

### 🌐 Web version

Play directly in your browser:

**https://draconov.github.io/Atom-Shooter/**

No installation is required. Progress, purchases, settings, and high scores are stored locally in the browser.

### 🪟 Windows version

Download the latest portable Windows build:

**https://github.com/Draconov/Atom-Shooter/releases/latest/download/Atom-Shooter-Windows.exe**

The EXE uses the same game code as the web version, wrapped with Electron. No installer is required.

---

## The game

You pilot a microscopic ship inside an atom. Every element is its own level.

1. **Shoot orbiting electrons** out of their shells.
2. **Collect loose electrons** to earn upgrade currency.
3. When the electron shells are cleared, the **nucleus destabilizes and splits**.
4. **Collect blue neutrons** before the particle field collapses.
5. **Avoid red protons** — touching them costs lives.
6. Spend collected particles on **ships, weapons, engines, and modules**.
7. Continue through the periodic table from **Hydrogen to element 118**.

The post-split collection window scales with difficulty: early elements give **60 seconds**, gradually falling to a **20 second minimum** for the hardest atoms. Reaching the minimum neutron quota no longer ends the level immediately. The full configured timer is honored: keep collecting bonus blue neutrons, and if you clear them all early, survive the remaining time against the red protons.

---

## Features

- 🧪 **118 periodic-table levels**
- 🎮 **Classic, Marathon, and Tutorial** modes
- 🚀 Asteroids-style **inertia, thrust, rotation, and nucleus gravity**
- 🔵 Shoot and collect **electrons**
- 💥 Dynamic **nucleus splitting**
- 🔷 Collect **neutrons** while dodging 🔴 **protons**
- ⏱️ Difficulty-scaled **60 → 20 second** post-split collection timer
- 🛸 **Six visually distinct ships** with different hull shapes, colors, and surface patterns
- 🔫 Multiple weapons, engines, and passive modules
- 🛒 Upgrade/equipment shop
- 🎵 Procedural Web Audio soundtrack and synthesized sound effects
- 💾 Persistent local progress and high scores
- ⌨️ Keyboard + mouse controls
- 📱 Touch controls with configurable joystick side, size, and dead zone
- 🌐 Static GitHub Pages build — no backend required
- 🪟 Portable Windows EXE built from the same source

---

## Controls

| Action | Keyboard / Mouse | Touch |
|---|---|---|
| Rotate / aim | `A` / `D`, `←` / `→`, mouse while firing | Analog stick |
| Thrust | `W` / `↑` | Push analog stick past dead zone |
| Reverse thrust | `S` / `↓` | — |
| Fire | `Space` or left mouse button | **FIRE** button |
| Pause | `Esc` | Pause button |

---

## Ships & upgrades

The ship roster is more than a stat swap. Each hull now has its own geometry and texture language:

| Ship | Character |
|---|---|
| **Pico** | Minimal starter hull |
| **Nano** | Central racing stripe |
| **Falcon** | Chevron flight markings |
| **Behemoth** | Heavy armor bands |
| **Hawk** | Panelled tactical hull |
| **Nano II** | High-tech grid pattern |

Weapons, engines, and passive modules can then change fire rate, projectile speed, pickup radius, gravity resistance, ship size, electron speed, and hostile-particle speed.

---

## Audio

Atom Shooter uses the browser's **Web Audio API** instead of shipping copied audio from the original Android game.

The soundtrack starts after the first click/tap/key interaction because browsers intentionally block audio autoplay before user interaction. The music option is enabled by default for new saves and can be changed under **Options → Ambient music**.

---

## Repository layout

```text
Atom-Shooter/
├─ web/
│  ├─ index.html              # UI and game screens
│  ├─ styles.css              # Responsive UI
│  ├─ manifest.webmanifest    # Installable web metadata
│  ├─ assets/                 # Web icons
│  └─ src/
│     ├─ app.js               # Menus, saves, shop, controls
│     ├─ audio.js             # Web Audio music + SFX
│     ├─ data.js              # Elements, ships, weapons, upgrades
│     └─ game.js              # Physics, simulation, rendering, game loop
├─ electron/
│  └─ main.cjs                # Windows desktop shell
├─ build/                     # Windows application icons
├─ .github/workflows/
│  ├─ pages.yml               # GitHub Pages deployment
│  └─ windows.yml             # Windows build + GitHub Release
├─ package.json
└─ README.md
```

---

## Development

The browser build has no compile step. Serve the `web/` directory with any local static server:

```bash
npx serve web
```

Then open the local address printed by the server.

To run the desktop wrapper:

```bash
npm install
npm start
```

To build the portable Windows executable locally:

```bash
npm install
npm run dist:win
```

The versioned output is:

```text
dist/Atom-Shooter-1.1.1-Windows.exe
```

---

## GitHub Pages deployment

`.github/workflows/pages.yml` deploys the `web/` directory whenever `main` is updated.

If Pages is not enabled yet, open:

**Repository → Settings → Pages → Source → GitHub Actions**

After that, pushes to `main` publish the game at:

**https://draconov.github.io/Atom-Shooter/**

---

## Windows Releases

`.github/workflows/windows.yml` builds the portable EXE on:

- every push to `main`;
- version tags such as `v1.1.1`;
- manual **Run workflow** launches.

The workflow uploads both:

```text
Atom-Shooter-1.1.1-Windows.exe
Atom-Shooter-Windows.exe
```

It then creates or updates the matching GitHub Release and marks it as the latest release. The stable second filename is intentional, so this README can always use one permanent download URL:

**https://github.com/Draconov/Atom-Shooter/releases/latest/download/Atom-Shooter-Windows.exe**

The workflow has `contents: write`, validates that the EXE exists before publishing, and fails instead of creating an empty release when the build artifact is missing.

---

## Performance notes

The game intentionally stays dependency-light. The v1.1 renderer/game-loop cleanup also:

- pre-renders the static arena background once instead of rebuilding it every frame;
- caches electron-shell radii instead of filtering and constructing a new `Set` during every draw;
- tracks remaining orbiting electrons directly instead of scanning the whole electron list each frame;
- suppresses unchanged HUD updates so the canvas loop does not rewrite DOM text 30–60 times per second;
- caps transient visual particles during long sessions;
- avoids running nuclear-particle logic before the nucleus actually splits;
- pauses procedural music scheduling while the page is hidden.

---

## Project scope

This repository is a newly written recreation based on the gameplay concept and compatibility/reference inspection of a user-supplied historical Android APK. It does **not** publish the original APK, recovered original source code, original music, or copied proprietary sprite resources.

“Atom Shooter” and the historical game remain associated with their original creators/rightsholders. If this project is distributed publicly under the original name or branding, make sure you have the necessary rights to do so.

---

<div align="center">
  <b>Built for modern browsers and Windows by Draconov.</b>
</div>
