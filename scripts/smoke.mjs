import fs from 'node:fs';
import { ELEMENTS, SHIPS, getElectronShellCounts } from '../web/src/data.js';
import { getCollectionWindow } from '../web/src/game.js';
import { AudioSystem } from '../web/src/audio.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(ELEMENTS.length === 118, `Expected 118 elements, got ${ELEMENTS.length}`);
assert(SHIPS.length === 6, `Expected 6 ships, got ${SHIPS.length}`);
assert(new Set(SHIPS.map((ship) => ship.visual?.pattern)).size === SHIPS.length, 'Every ship should have a distinct visual pattern');

for (let z = 1; z <= 118; z += 1) {
  const electronCount = getElectronShellCounts(z).reduce((sum, count) => sum + count, 0);
  assert(electronCount === z, `Electron-shell count mismatch for element ${z}`);

  const collectionWindow = getCollectionWindow(z);
  assert(collectionWindow >= 20 && collectionWindow <= 60, `Collection window out of range for element ${z}`);
  if (z > 1) {
    assert(collectionWindow <= getCollectionWindow(z - 1), `Collection window should not increase at element ${z}`);
  }
}

assert(getCollectionWindow(1) === 60, 'Hydrogen should allow 60 seconds after the split');
assert(getCollectionWindow(10) === 60, 'Neon should still allow 60 seconds after the split');
assert(getCollectionWindow(118) === 20, 'Element 118 should allow the 20 second minimum');

for (const file of [
  'web/index.html',
  'web/styles.css',
  'web/assets/icon.svg',
  'web/assets/icon-192.png',
  'web/assets/icon-512.png',
  'web/manifest.webmanifest',
  'build/icon.png',
  'build/icon.ico',
]) {
  assert(fs.existsSync(file), `Missing required file: ${file}`);
}

const workflow = fs.readFileSync('.github/workflows/windows.yml', 'utf8');
assert(workflow.includes('Atom-Shooter-Windows.exe'), 'Windows workflow must create the stable release filename');
assert(workflow.includes('Expected Windows build not found'), 'Windows workflow must fail if the versioned EXE is missing');
assert(workflow.includes('gh release create'), 'Windows workflow must create a GitHub Release');
assert(workflow.includes('gh release upload') && workflow.includes('--clobber'), 'Windows workflow must update release assets safely');
assert(workflow.includes('contents: write'), 'Release workflow requires contents: write');


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

globalThis.document = {
  hidden: false,
  addEventListener() {},
};
globalThis.window = {
  AudioContext: FakeAudioContext,
  setInterval,
};

const audio = new AudioSystem();
audio.configure({ sfx: true, music: true });
assert(await audio.unlock(), 'Audio system should unlock after a user-gesture resume');
assert(audio.musicRunning, 'Music scheduler should start after audio unlock when music is enabled');
audio.stopMusic();
assert(!audio.musicRunning, 'Music scheduler should stop cleanly');

console.log('Atom Shooter smoke checks passed.');
