import fs from 'node:fs';
import {
  ELEMENTS,
  SHIPS,
  WEAPONS,
  ENGINES,
  MODULES,
  POWERUPS,
  getElectronShellCounts,
  getMarathonThresholds,
} from '../web/src/data.js';
import { getCollectionWindow, getCollectionResolution, getWeaponEnergyFraction, canFireWeapon } from '../web/src/game.js';
import { AudioSystem, MUSIC_TRACKS } from '../web/src/audio.js';
import { DEFAULT_SAVE, SAVE_SCHEMA, loadSave, normalizeSave, normalizeMarathonState } from '../web/src/save.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(ELEMENTS.length === 118, `Expected 118 elements, got ${ELEMENTS.length}`);
assert(SHIPS.length === 6, `Expected 6 ships, got ${SHIPS.length}`);
assert(WEAPONS.length === 10, `Expected starter Blaster plus 9 weapon upgrades, got ${WEAPONS.length}`);
assert(ENGINES.length === 5, `Expected 5 engines, got ${ENGINES.length}`);
assert(MODULES.length === 21, `Expected 21 module upgrades, got ${MODULES.length}`);
assert(POWERUPS.length === 6, `Expected 6 temporary power-ups, got ${POWERUPS.length}`);

assert(SHIPS.find((ship) => ship.id === 'behemoth')?.slots === 4, 'Behemoth must have four module slots');
assert(SHIPS.find((ship) => ship.id === 'nano2')?.slots === 0, 'Nano II must have zero module slots');
assert(SHIPS.find((ship) => ship.id === 'nano2')?.builtinPickup, 'Nano II must include its built-in pickup field');

assert(
  ENGINES.map((engine) => engine.name).join('|') === 'V-Rocket|V-Rocket X|V-Rocket DX|Q-Ray|Solar Ex2.0',
  'Engine progression must match the reference five-stage family',
);

const starterBlaster = WEAPONS.find((weapon) => weapon.id === 'blaster');
assert(starterBlaster?.name === 'Blaster', 'Base weapon must be named Blaster');
assert(starterBlaster?.bullets === 1, 'Base Blaster must fire exactly one projectile');
assert(starterBlaster?.costE === 0 && starterBlaster?.costN === 0, 'Base Blaster must be included for free');
assert(DEFAULT_SAVE.selectedWeapon === 'blaster', 'New saves must equip the base Blaster');
assert(DEFAULT_SAVE.purchased.weapons.includes('blaster'), 'New saves must own the base Blaster');
assert(DEFAULT_SAVE.settings.sfxVolume === 1 && DEFAULT_SAVE.settings.musicVolume === 1, 'New saves must default both volume controls to 100%');
assert(WEAPONS.find((weapon) => weapon.id === 'blaster2')?.requires === 'blaster', 'Blaster 2000 must upgrade from the base Blaster');

const gatling = WEAPONS.filter((weapon) => weapon.family === 'gatling');
assert(gatling.length === 3, 'Gatling family must contain three upgrades');
assert(gatling.map((weapon) => weapon.rate).join(',') === '6,10,20', 'Gatling family must use 6/10/20 rounds per second');
assert(gatling[2].damage === 0.5, 'Gatling Gun S must require two hits per electron');

const burster = WEAPONS.filter((weapon) => weapon.family === 'burster');
assert(burster.map((weapon) => weapon.bullets).join(',') === '5,7,10', 'Burster family must fire 5/7/10 particles');
assert(WEAPONS.every((weapon) => weapon.capacity > 0 && weapon.regen > 0 && weapon.cost > 0), 'Every weapon must have energy capacity, regeneration and shot cost');

const moduleFamilies = new Map();
for (const module of MODULES) {
  if (!moduleFamilies.has(module.family)) moduleFamilies.set(module.family, []);
  moduleFamilies.get(module.family).push(module);
}
assert(moduleFamilies.size === 7, `Expected seven module families, got ${moduleFamilies.size}`);
for (const [family, modules] of moduleFamilies) {
  assert(modules.length === 3, `${family} must have three upgrade tiers`);
  assert(modules.map((module) => module.tier).join(',') === '1,2,3', `${family} tiers must be 1/2/3`);
}
assert(moduleFamilies.get('project')?.every((module) => module.effect === 'bulletSize'), 'Project L1/L2/L3 must increase projectile size');
assert(moduleFamilies.get('fastfire')?.every((module) => module.effect === 'bulletSpeed'), 'FastFire25/50/75 must increase projectile velocity');

const thresholds = getMarathonThresholds(5);
assert(thresholds.join(',') === '10000,25000,45000,70000,100000', `Unexpected Marathon thresholds: ${thresholds.join(',')}`);
assert(getWeaponEnergyFraction(25, 100) === 0.25, 'Weapon energy fraction helper mismatch');
assert(getWeaponEnergyFraction(150, 100) === 1, 'Weapon energy fraction must clamp high values');
assert(canFireWeapon({ activeBullets: 44, volleySize: 4, bulletLimit: 48, energy: 20, cost: 7 }), 'A volley exactly reaching the projectile limit should be allowed');
assert(!canFireWeapon({ activeBullets: 47, volleySize: 4, bulletLimit: 48, energy: 20, cost: 7 }), 'A volley must not exceed the projectile limit');
assert(!canFireWeapon({ activeBullets: 0, volleySize: 2, bulletLimit: 48, energy: 4, cost: 5 }), 'A weapon must not fire without enough energy');
assert(!canFireWeapon({ activeBullets: 0, volleySize: 2, bulletLimit: 48, energy: 40, cost: 5, cooldown: 0.01 }), 'A weapon must respect pulse cooldown');

for (const family of ['blaster', 'gatling', 'burster']) {
  const items = WEAPONS.filter((item) => item.family === family);
  const expectedCount = family === 'blaster' ? 4 : 3;
  assert(items.length === expectedCount, `${family} must contain ${expectedCount} stages`);
  assert(items[0].requires == null, `${family} tier 1 must not require a prerequisite`);
  for (let i = 1; i < items.length; i += 1) {
    assert(items[i].requires === items[i - 1].id, `${family} weapon tiers must unlock sequentially`);
  }
}
for (let i = 1; i < ENGINES.length; i += 1) assert(ENGINES[i].requires === ENGINES[i - 1].id, 'Engine stages must unlock sequentially');
for (const modules of moduleFamilies.values()) {
  assert(modules[0].requires == null, `${modules[0].family} tier 1 must not require a prerequisite`);
  assert(modules[1].requires === modules[0].id && modules[2].requires === modules[1].id, `${modules[0].family} module tiers must unlock sequentially`);
}

const allThresholds = getMarathonThresholds(100);
assert(allThresholds.length === 100, 'Reference Marathon progression must contain 100 extra-ship thresholds');
for (let i = 1; i < allThresholds.length; i += 1) assert(allThresholds[i] > allThresholds[i - 1], 'Marathon thresholds must increase monotonically');
assert(normalizeMarathonState({ index: 7, score: 25000, lives: 2, nextExtraIndex: 2, runTime: 12.5, runNeutrons: 6 })?.index === 7, 'Valid Marathon resume state must survive normalization');
assert(normalizeMarathonState({ index: 7, score: 25000, lives: 0 }) === null, 'Dead Marathon state must not be resumable');

for (let z = 1; z <= 118; z += 1) {
  const electronCount = getElectronShellCounts(z).reduce((sum, count) => sum + count, 0);
  assert(electronCount === z, `Electron-shell count mismatch for element ${z}`);

  const collectionWindow = getCollectionWindow(z);
  assert(collectionWindow >= 20 && collectionWindow <= 60, `Collection window out of range for element ${z}`);
  if (z > 1) assert(collectionWindow <= getCollectionWindow(z - 1), `Collection window should not increase at element ${z}`);
}

assert(getCollectionWindow(1) === 60, 'Hydrogen should allow 60 seconds after the split');
assert(getCollectionWindow(10) === 60, 'Neon should still allow 60 seconds after the split');
assert(getCollectionWindow(20) === 54, 'Element 20 should be on the descending timer curve');
assert(getCollectionWindow(40) === 46, 'Element 40 should be on the descending timer curve');
assert(getCollectionWindow(60) === 39, 'Element 60 should be on the descending timer curve');
assert(getCollectionWindow(80) === 32, 'Element 80 should be on the descending timer curve');
assert(getCollectionWindow(100) === 26, 'Element 100 should be on the descending timer curve');
assert(getCollectionWindow(118) === 20, 'Element 118 should allow the 20 second minimum');
assert(getCollectionWindow(999) === 20, 'Collection timer must clamp values above the periodic table to 20 seconds');
assert(getCollectionWindow(-5) === 60, 'Collection timer must clamp invalid low element numbers to the easy-level maximum');
for (let z = 11; z <= 108; z += 1) {
  assert(getCollectionWindow(z + 10) < getCollectionWindow(z), `Collection window should be meaningfully lower ten levels later (${z} -> ${z + 10})`);
}
assert(getCollectionResolution({ timeLeft: 47, collected: 1, total: 3 }) === null, 'Partial blue collection must keep the collection phase running');
assert(getCollectionResolution({ timeLeft: 47, collected: 3, total: 3 }) === 'complete', 'Collecting every blue neutron must complete the level immediately');
assert(getCollectionResolution({ timeLeft: 0, collected: 0, total: 3 }) === 'complete', 'Surviving until timer expiry must complete the level');
assert(getCollectionResolution({ timeLeft: 0, collected: 2, total: 3 }) === 'complete', 'Timer expiry must complete the level after partial collection');

const requiredFiles = [
  'web/index.html',
  'web/styles.css',
  'web/src/save.js',
  'web/assets/icon.svg',
  'web/assets/icon-192.png',
  'web/assets/icon-512.png',
  'web/assets/atom-shooter-favicon.ico',
  'web/assets/atom-shooter-icon-192.png',
  'web/assets/atom-shooter-icon-512.png',
  'web/assets/audio/menu.wav',
  'web/assets/audio/level-loop.wav',
  'web/assets/audio/marathon-loop.wav',
  ...SHIPS.map((item) => `web/assets/ships/${item.id}.png`),
  ...new Set(WEAPONS.map((item) => `web/assets/weapons/${item.asset}.png`)),
  ...new Set(ENGINES.map((item) => `web/assets/engines/${item.asset}.png`)),
  ...new Set(MODULES.map((item) => `web/assets/modules/${item.asset}.png`)),
  'web/manifest.webmanifest',
  'build/icon.png',
  'build/icon.ico',
  'android/settings.gradle',
  'android/build.gradle',
  'android/gradle.properties',
  'android/app/build.gradle',
  'android/app/proguard-rules.pro',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/io/github/draconov/atomshooter/MainActivity.java',
  'android/app/src/main/res/drawable-nodpi/app_icon.png',
  '.github/workflows/android.yml',
];
for (const file of requiredFiles) assert(fs.existsSync(file), `Missing required file: ${file}`);

function readIcoSizes(file) {
  const data = fs.readFileSync(file);
  assert(data.length >= 6, `${file} is not a valid ICO header`);
  assert(data.readUInt16LE(0) === 0 && data.readUInt16LE(2) === 1, `${file} is not a Windows ICO file`);
  const count = data.readUInt16LE(4);
  assert(count > 0, `${file} contains no icon images`);
  assert(data.length >= 6 + count * 16, `${file} has a truncated ICO directory`);
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    sizes.push({
      width: data[offset] === 0 ? 256 : data[offset],
      height: data[offset + 1] === 0 ? 256 : data[offset + 1],
    });
  }
  return sizes;
}

const windowsIconSizes = readIcoSizes('build/icon.ico');
assert(
  windowsIconSizes.some(({ width, height }) => width >= 256 && height >= 256),
  `Windows ICO must contain at least one 256x256 image; found ${windowsIconSizes.map(({ width, height }) => `${width}x${height}`).join(', ')}`,
);

assert(MUSIC_TRACKS.menu?.src === 'assets/audio/menu.wav', 'Menu OST path must point to the bundled menu track');
assert(MUSIC_TRACKS.menu?.gain === 1.00, 'Menu OST must use the full selected music volume');
assert(MUSIC_TRACKS.level?.src === 'assets/audio/level-loop.wav', 'Classic/Tutorial must use the ambient level loop');
assert(MUSIC_TRACKS.marathon?.src === 'assets/audio/marathon-loop.wav', 'Marathon must use the faster remix loop');
assert(fs.statSync('web/assets/audio/menu.wav').size > 100000, 'Menu OST asset is unexpectedly small');
for (const loopFile of ['web/assets/audio/level-loop.wav', 'web/assets/audio/marathon-loop.wav']) {
  const wav = fs.readFileSync(loopFile);
  assert(wav.subarray(0, 4).toString('ascii') === 'RIFF' && wav.subarray(8, 12).toString('ascii') === 'WAVE', `${loopFile} must be a valid WAV file`);
  assert(wav.length > 500000, `${loopFile} is unexpectedly small`);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(packageJson.version === '1.2.0', `Expected package version 1.2.0, got ${packageJson.version}`);
assert(packageJson.build?.portable?.artifactName === 'Atom-Shooter.exe', 'Windows artifact must remain Atom-Shooter.exe');
JSON.parse(fs.readFileSync('web/manifest.webmanifest', 'utf8'));

const html = fs.readFileSync('web/index.html', 'utf8');
for (const id of ['screen-splash', 'setting-control', 'weapon-energy-fill', 'powerup-timers', 'aim-joystick', 'dpad-control', 'records-content']) {
  assert(html.includes(`id="${id}"`), `Missing parity UI element #${id}`);
}

const appSource = fs.readFileSync('web/src/app.js', 'utf8');
assert(html.includes('id="shop-tutorial"'), 'Shop tutorial overlay must exist');
assert(appSource.includes('marathonHistory'), 'App must expose Marathon history');
assert(appSource.includes('marathonResume'), 'App must persist Marathon resume state');
assert(!appSource.includes('Control mode: ${controlModeLabel(save.settings.controlMode)}'), 'Pause menu must not show a separate control-mode text line');
assert(appSource.includes("className: 'pause-controls'"), 'Pause menu must expose one dedicated controls button');
assert((appSource.match(/className: 'pause-game'/g) || []).length === 3, 'Pause menu must contain exactly three game-action buttons');
assert(appSource.includes("label: 'Restart'"), 'Pause menu restart action must use the compact Restart label');
assert(appSource.includes("audio.setMusicMode('menu')"), 'Non-game screens must select the menu OST');
assert(appSource.includes("mode === 'marathon' ? 'marathon' : 'level'"), 'Game startup must select Classic/Tutorial or Marathon music');

const rejectedLegacy = normalizeSave({
  version: SAVE_SCHEMA - 1,
  unlocked: 118,
  electrons: 999999,
  purchased: {
    ships: ['nano2'],
    weapons: ['railgun'],
    engines: ['project3'],
    modules: ['projectile'],
  },
  selectedShip: 'nano2',
  selectedWeapon: 'railgun',
  selectedEngine: 'project3',
});
assert(rejectedLegacy.version === SAVE_SCHEMA, 'Rejected old saves must return the current schema');
assert(rejectedLegacy.unlocked === DEFAULT_SAVE.unlocked, 'Old save schemas must start fresh instead of migrating progression');
assert(rejectedLegacy.electrons === 0, 'Old save schemas must not carry currency forward');
assert(rejectedLegacy.selectedWeapon === DEFAULT_SAVE.selectedWeapon, 'Old weapon IDs must not be translated forward');
assert(rejectedLegacy.selectedEngine === DEFAULT_SAVE.selectedEngine, 'Old engine IDs must not be translated forward');
assert(!rejectedLegacy.purchased.weapons.includes('blaster4'), 'Legacy Railgun must not migrate to Blaster 4000');

const currentSave = normalizeSave({
  ...structuredClone(DEFAULT_SAVE),
  unlocked: 17,
  electrons: 240,
  neutrons: 19,
  purchased: {
    ships: ['pico', 'falcon'],
    weapons: ['blaster', 'blaster2'],
    engines: ['vrocket'],
    modules: ['collector'],
  },
  selectedShip: 'falcon',
  selectedWeapon: 'blaster2',
  selectedEngine: 'vrocket',
  selectedModules: ['collector'],
});
assert(currentSave.unlocked === 17, 'Current-schema saves must retain progression');
assert(currentSave.selectedWeapon === 'blaster2', 'Current-schema saves must retain valid equipped weapons');
assert(currentSave.selectedModules.includes('collector'), 'Current-schema saves must retain valid modules');
const clampedVolumeSave = normalizeSave({
  ...structuredClone(DEFAULT_SAVE),
  settings: { ...DEFAULT_SAVE.settings, sfxVolume: 2, musicVolume: -0.5 },
});
assert(clampedVolumeSave.settings.sfxVolume === 1, 'SFX volume must clamp to 100%');
assert(clampedVolumeSave.settings.musicVolume === 0, 'Music volume must clamp to 0%');

const legacyStorage = {
  getItem() {
    return JSON.stringify({ version: SAVE_SCHEMA - 1, unlocked: 118, electrons: 999999 });
  },
};
const loadedLegacy = loadSave(legacyStorage);
assert(loadedLegacy.unlocked === DEFAULT_SAVE.unlocked && loadedLegacy.electrons === 0,
  'loadSave must reset incompatible schemas rather than migrate them');


const indexSource = fs.readFileSync('web/index.html', 'utf8');
assert(indexSource.includes('id="setting-sfx-volume"'), 'Options must expose a sound effects volume slider');
assert(indexSource.includes('id="setting-music-volume"'), 'Options must expose a music volume slider');
assert(!indexSource.includes('id="setting-sfx"'), 'Options must not expose a redundant SFX toggle');
assert(!indexSource.includes('id="setting-music"'), 'Options must not expose a redundant music toggle');
assert(!indexSource.includes('Adjust sound-effect loudness') && !indexSource.includes('Adjust soundtrack loudness'), 'Volume helper copy should stay removed');
assert(!indexSource.includes('Reference-style combined analog'), 'Control-mode helper copy should stay removed');
assert(appSource.includes("'setting-sfx-volume'") && appSource.includes("'setting-music-volume'"), 'Volume sliders must save live through the settings input handlers');
assert(indexSource.includes('atom-shooter-favicon.ico?v=120-flat'), 'Website must use the cache-breaking flat favicon');
assert(indexSource.includes('atom-shooter-icon-192.png?v=120-flat'), 'Website must use the cache-breaking flat app icon');
assert(appSource.includes('github.com/Draconov/Atom-Shooter/releases/latest'), 'About must link to latest releases');
assert(appSource.includes('github.com/Draconov'), 'About must link to the developer profile');
assert(appSource.includes('original 2013 Android game'), 'About must identify the original Android game as the remake source');

const workflow = fs.readFileSync('.github/workflows/windows.yml', 'utf8');
assert(workflow.includes('Atom-Shooter.exe'), 'Windows workflow must publish Atom-Shooter.exe');
assert(workflow.includes('Expected Windows build not found'), 'Windows workflow must fail if the EXE is missing');
assert(workflow.includes('gh release create'), 'Windows workflow must create a GitHub Release');
assert(workflow.includes('gh release upload') && workflow.includes('--clobber'), 'Windows workflow must update release assets safely');
assert(workflow.includes('releases/assets/$assetId'), 'Windows workflow must remove obsolete custom release assets');
assert(!workflow.includes('actions/upload-artifact'), 'Windows workflow must not publish duplicate Actions artifacts');
assert(workflow.includes('contents: write'), 'Release workflow requires contents: write');
assert(workflow.includes('cancel-in-progress: false'), 'Release workflow must not be cancelled while mutating a GitHub Release');
assert(workflow.includes("group: ${{ github.repository }}-release-assets"), 'Windows release must share the cross-platform release lock');
assert(workflow.includes('$assetName -like "*.exe"'), 'Windows cleanup must target EXE assets only');
const androidWorkflow = fs.readFileSync('.github/workflows/android.yml', 'utf8');
assert(androidWorkflow.includes('Atom-Shooter.apk'), 'Android workflow must publish Atom-Shooter.apk');
assert(androidWorkflow.includes(':app:assembleDebug'), 'Android workflow must build an installable APK');
assert(androidWorkflow.includes('app-debug.apk'), 'Android workflow must verify the expected Gradle APK output');
assert(androidWorkflow.includes('group: ${{ github.repository }}-release-assets'), 'Android release must share the cross-platform release lock');
assert(androidWorkflow.includes('[[ "$asset_name" == *.apk ]]'), 'Android cleanup must target APK assets only');
assert(androidWorkflow.includes('contents: write'), 'Android release workflow requires contents: write');

const androidGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
assert(androidGradle.includes("rootProject.file('../web')"), 'Android must package the canonical web directory directly');
assert(androidGradle.includes('packageJson.version'), 'Android version must derive from package.json');
assert(androidGradle.includes('compileSdk 35') && androidGradle.includes('targetSdk 35'), 'Android must build against API 35');

const androidActivity = fs.readFileSync('android/app/src/main/java/io/github/draconov/atomshooter/MainActivity.java', 'utf8');
assert(androidActivity.includes('WebViewAssetLoader'), 'Android shell must use WebViewAssetLoader for bundled ES modules');
assert(androidActivity.includes('setJavaScriptEnabled(true)'), 'Android shell must enable JavaScript');
assert(androidActivity.includes('setDomStorageEnabled(true)'), 'Android shell must enable DOM storage for saves');

for (const obsolete of ['web/assets/weapons/railgun.png', 'web/assets/modules/projectile.png', 'web/assets/modules/size.png']) {
  assert(!fs.existsSync(obsolete), `Obsolete 1.1 asset should be removed: ${obsolete}`);
}

class FakeAudioNode {
  constructor() {
    this.gain = {
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
    this.frequency = {
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = new FakeAudioNode();
  }
  createGain() { return new FakeAudioNode(); }
  createOscillator() { return new FakeAudioNode(); }
  async resume() { this.state = 'running'; }
}

globalThis.document = { hidden: false, addEventListener() {} };
globalThis.window = { AudioContext: FakeAudioContext, setInterval };

const audio = new AudioSystem();
audio.configure({ sfxVolume: 0.5, musicVolume: 0.25 });
audio.setMusicMode('level');
assert(audio.musicMode === 'level', 'Audio system must switch to the ambient level soundtrack');
audio.setMusicMode('marathon');
assert(audio.musicMode === 'marathon', 'Audio system must switch to the Marathon remix');
audio.setMusicMode('menu');
assert(audio.musicMode === 'menu', 'Audio system must switch back to the menu OST');
assert(await audio.unlock(), 'Audio system should unlock after a user-gesture resume');
assert(Math.abs(audio.sfxBus.gain.value - 0.36) < 1e-9, 'SFX volume must scale the SFX bus live');
assert(Math.abs(audio.musicBus.gain.value - 0.095) < 1e-9, 'Music volume must scale the music bus live');
audio.configure({ sfxVolume: 1, musicVolume: 1 });
assert(Math.abs(audio.sfxBus.gain.value - 0.72) < 1e-9, 'SFX volume must restore to full configured level');
assert(Math.abs(audio.musicBus.gain.value - 0.38) < 1e-9, 'Music volume must restore to full configured level');
assert(audio.musicRunning, 'Music scheduler should start after audio unlock when music volume is above zero');
audio.configure({ sfxVolume: 0, musicVolume: 0 });
assert(audio.sfxBus.gain.value === 0, 'SFX volume 0% must fully mute the SFX bus');
assert(audio.musicBus.gain.value === 0 && !audio.musicRunning, 'Music volume 0% must mute and stop music playback');
audio.powerup();
audio.extraLife();
audio.stopMusic();
assert(!audio.musicRunning, 'Music scheduler should stop cleanly');

console.log('Atom Shooter 1.2.0 parity smoke checks passed.');
