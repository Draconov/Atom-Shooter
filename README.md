# Atom Shooter

A clean-room recreation of the classic **Atom Shooter** arcade concept, rebuilt for modern browsers and Windows.

- **GitHub Pages:** static HTML/CSS/JavaScript in `web/`
- **Windows:** Electron wrapper around the exact same game
- **118 element levels** laid out as the periodic table
- Classic, Marathon and Tutorial modes
- Inertia, thrust, nucleus gravity, electron shells and particle collection
- Nucleus explosion: collect blue neutrons, avoid red protons
- Six ships, weapons, engines and passive modules
- Persistent local progress, currency, unlocks and best scores
- Keyboard/mouse and touch controls
- No original APK binaries, sprites, music or proprietary assets are included

## Controls

Desktop:

- `W` / `↑` — thrust
- `A` / `D` or `←` / `→` — rotate
- `Space` — fire
- Mouse — aim while firing
- `Esc` — pause

Touch:

- Analog stick — aim; pull farther to engage thrust
- FIRE button — shoot

## Publish on GitHub Pages

This repository already contains `.github/workflows/pages.yml`.

1. Create a new GitHub repository under **Draconov**.
2. Upload/push the contents of this repository to the `main` branch.
3. Open **Settings → Pages** and make sure the source is **GitHub Actions**.
4. Push to `main`. The Pages workflow publishes the `web/` folder.

Because all asset paths are relative, the game works both at `https://draconov.github.io/<repo>/` and in Electron without changing a base URL.

## Build the Windows EXE

Install Node.js 22+, then:

```bash
npm install
npm run dist:win
```

The portable EXE is written to `dist/Atom-Shooter-1.0.0-Windows.exe`.

You can also open **Actions → Build Windows EXE → Run workflow** on GitHub. The resulting EXE is attached as a workflow artifact. Pushing a tag such as `v1.0.0` also triggers the build **and attaches the EXE to that GitHub Release**.

## Local browser test

The web build has no compile step. Serve the `web/` folder with any static server, for example:

```bash
npx serve web
```

Then open the printed local address.

## Project structure

```text
web/
  index.html        UI/screens
  styles.css        responsive visual design
  src/data.js       elements, ships, shop data
  src/game.js       canvas simulation + game loop
  src/audio.js      synthesized SFX/ambient audio
  src/app.js        menus, saves, shop, controls
  assets/icon.svg
electron/
  main.cjs          Windows desktop shell
.github/workflows/
  pages.yml         GitHub Pages deployment
  windows.yml       Windows EXE build
```

## Attribution / scope

This repository is a newly written implementation based on publicly described gameplay behavior and inspection of a user-supplied historical APK for compatibility/reference. It does **not** contain the original APK, original image/audio resources, or recovered original source code.

“Atom Shooter” and the original game remain associated with their original creators/rightsholders. If you intend to publish this publicly under the original name or branding, verify that you have the necessary rights; otherwise rename the project before release.
