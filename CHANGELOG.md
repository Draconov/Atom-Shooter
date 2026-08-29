# Changelog

## 1.2.0 — APK parity update

### Gameplay
- Added finite weapon energy, per-shot energy use, regeneration, and projectile limits.
- Added temporary Ammo, Big Fire, Collector Boost, Electron Stop, Ghost, and Gravity Off power-ups.
- Kept the modern post-core dual-win rule: collect all blue neutrons immediately or survive until the 60→20 second timer expires.
- Made the 60→20 second collection timer frame-rate independent: slower rendering is sub-stepped instead of stretching the countdown, while hidden tabs do not consume active play time.
- Added richer procedural electron-hit, collection, nucleus-split, thruster, and ship-destruction effects.

### Shop and progression
- Rebuilt weapons as three three-tier families: Blaster, Gatling, and Burster.
- Restored Gatling 6/10/20 rounds-per-second progression and Burster 5/7/10 projectile progression.
- Replaced the old engine layout with V-Rocket → V-Rocket X → V-Rocket DX → Q-Ray → Solar Ex2.0.
- Expanded modules from seven standalone items to seven three-tier families (21 upgrades total).
- Corrected Project L1/L2/L3 to projectile-size modules and FastFire25/50/75 to projectile-velocity modules.
- Corrected Behemoth to four module slots.
- Corrected Nano II to zero module slots with a built-in pickup field.
- Added prerequisite-aware upgrade purchasing and same-family module replacement.

### Marathon and records
- Marathon lives, score, time, neutrons, and extra-life progression now persist between elements.
- Added escalating extra-ship thresholds beginning at 10k, 25k, 45k, 70k, and 100k points.
- Added Marathon resume support, recent-run history, and best-run comparisons.
- Added per-element best score, best time, and best neutron statistics.
- Added a dedicated Records screen.

### Controls and UI
- Added Shoot + Fly&Aim, Fly + Shoot + Aim, and D-pad touch modes.
- Added control-mode switching in Options and Pause.
- Added startup loading/splash screen with asset preloading.
- Added weapon-energy HUD, active power-up timers, and Marathon next-life indicator.
- Expanded Tutorial messaging to cover the reference ship/border, aiming, shooting, electron collection, nucleus/proton/neutron, gravity, power-up, and alternate-control beats.
- Expanded shop cards with the reference-style weapon/ship/engine/module statistics and added the “You can now afford” result hint.
- Ensured shop artwork is fully contained inside every item card instead of being clipped at the preview edges.
- Replaced stale browser favicon URLs with cache-breaking flat-icon assets and refreshed the in-app About panel with concise game, updates/downloads, and developer links.

### Distribution
- Added a native Android WebView shell that packages the same canonical `web/` game used by GitHub Pages and Windows.
- Added an Android GitHub Actions build that publishes an installable `Atom-Shooter.apk` to the matching release.
- GitHub Releases now keep both project binaries: `Atom-Shooter.exe` and `Atom-Shooter.apk`.
- Windows and Android release jobs share one concurrency lock and replace only their own platform asset, preventing either workflow from deleting the other download.
- Android version name/code are derived from `package.json`, keeping the APK on version 1.2.0 without a separate version source.

### Compatibility
- Added automatic migration for pre-1.2 saves, including old engine/module IDs and the former Railgun slot.
- Reclassified legacy Q-Ray ownership safely: the named purchase is restored as the Q-Ray engine while its old projectile-speed behavior migrates to the FastFire family.
- Kept Classic per-element records isolated from Tutorial and Marathon history.
- Hardened multi-projectile weapon caps so a volley can never exceed its projectile limit.
- Made the collect-all-blue victory resolve immediately inside the pickup frame, before any later proton collision can override it.
- Serialized Windows Release publishing so an in-progress EXE upload is not cancelled by another ref.
- Windows distribution remains a single portable `Atom-Shooter.exe`; Android adds one separate `Atom-Shooter.apk` asset.
- Fixed the Windows `.ico` bundle to include a proper 256×256 entry required by `electron-builder`, and added a smoke regression check for Windows icon dimensions.
