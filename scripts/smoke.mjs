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
import { AudioSystem } from '../web/src/audio.js';
import { mergeSave, normalizeMarathonState } from '../web/src/save.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(ELEMENTS.length === 118, `Expected 118 elements, got ${ELEMENTS.length}`);
assert(SHIPS.length === 6, `Expected 6 ships, got ${SHIPS.length}`);
assert(WEAPONS.length === 9, `Expected 9 weapon upgrades, got ${WEAPONS.length}`);
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
  assert(items[0].requires == null, `${family} tier 1 must not require a prerequisite`);
  assert(items[1].requires === items[0].id && items[2].requires === items[1].id, `${family} weapon tiers must unlock sequentially`);
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
assert(getCollectionWindow(118) === 20, 'Element 118 should allow the 20 second minimum');
assert(getCollectionResolution({ timeLeft: 47, collected: 1, total: 3 }) === null, 'Partial blue collection must keep the collection phase running');
assert(getCollectionResolution({ timeLeft: 47, collected: 3, total: 3 }) === 'complete', 'Collecting every blue neutron must complete the level immediately');
assert(getCollectionResolution({ timeLeft: 0, collected: 0, total: 3 }) === 'complete', 'Surviving until timer expiry must complete the level');
assert(getCollectionResolution({ timeLeft: 0, collected: 2, total: 3 }) === 'complete', 'Timer expiry must complete the level after partial collection');

const requiredFiles = [
  'README.md',
  'CHANGELOG.md',
  'web/index.html',
  'web/styles.css',
  'web/src/save.js',
  'web/assets/icon.svg',
  'web/assets/icon-192.png',
  'web/assets/icon-512.png',
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

const migrated = mergeSave({
  version: 2,
  best: { 1: 1234 },
  purchased: {
    ships: ['pico', 'nano2'],
    weapons: ['blaster2', 'railgun'],
    engines: ['project1', 'project3'],
    modules: ['projectile', 'lowgrav'],
  },
  selectedShip: 'nano2',
  selectedWeapon: 'railgun',
  selectedEngine: 'project3',
  selectedModules: ['projectile', 'lowgrav'],
});
assert(migrated.version === 3, 'Pre-1.2 save must migrate to schema 3');
assert(migrated.selectedWeapon === 'blaster4', 'Legacy Railgun selection must migrate to Blaster 4000');
assert(migrated.selectedEngine === 'vrocketdx', 'Legacy Project L3 engine selection must migrate to V-Rocket DX');
assert(migrated.selectedModules.length === 0, 'Nano II migration must clear module slots');
assert(migrated.purchased.engines.includes('qray'), 'Legacy Q-Ray module ownership must grant the correctly reclassified Q-Ray engine');
assert(migrated.purchased.modules.includes('fastfire'), 'Legacy Q-Ray projectile-speed behavior must migrate to the FastFire family');
assert(migrated.records[1].score === 1234, 'Legacy best score must migrate to detailed records');

const migratedModuleLoadout = mergeSave({
  version: 2,
  purchased: { ships: ['behemoth'], weapons: ['blaster2'], engines: ['project1'], modules: ['projectile', 'lowgrav'] },
  selectedShip: 'behemoth',
  selectedWeapon: 'blaster2',
  selectedEngine: 'project1',
  selectedModules: ['projectile', 'lowgrav'],
});
assert(migratedModuleLoadout.selectedModules.includes('fastfire'), 'Equipped legacy Q-Ray module must retain its projectile-speed effect through FastFire migration');
assert(migratedModuleLoadout.selectedModules.includes('lowgrav'), 'Unrelated legacy modules must remain equipped when slots allow');

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
audio.configure({ sfx: true, music: true });
assert(await audio.unlock(), 'Audio system should unlock after a user-gesture resume');
assert(audio.musicRunning, 'Music scheduler should start after audio unlock when music is enabled');
audio.powerup();
audio.extraLife();
audio.stopMusic();
assert(!audio.musicRunning, 'Music scheduler should stop cleanly');

console.log('Atom Shooter 1.2.0 parity smoke checks passed.');
