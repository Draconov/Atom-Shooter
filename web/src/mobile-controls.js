import { AtomGame } from './game.js';
import { DEFAULT_SAVE } from './save.js';

const TWO_CONTROL_MODES = new Set(['split', 'dpad']);
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// New installs start with Joystick + Shooting Joystick.
DEFAULT_SAVE.settings.controlMode = 'split';

// Migrate legacy Combined / invalid modes before app.js loads its save state.
try {
  const raw = localStorage.getItem('atom-shooter-save');
  if (raw) {
    const stored = JSON.parse(raw);
    if (stored?.settings && !TWO_CONTROL_MODES.has(stored.settings.controlMode)) {
      stored.settings.controlMode = 'split';
      localStorage.setItem('atom-shooter-save', JSON.stringify(stored));
    }
  }
} catch {
  // A malformed/localStorage-blocked save is already handled by save.js.
}

function shootingThreshold(game) {
  const deadzone = Number(game.save?.settings?.deadzone || 0.38);
  return Math.max(0.12, Math.min(0.28, deadzone * 0.55));
}

// Turn the former aim stick into a true aim + shoot stick.
AtomGame.prototype.setAimJoystick = function setAimJoystick(x, y, mag) {
  this.aimJoy = { x, y, mag };
  this.setFire(mag > shootingThreshold(this));
};

// Keep original movement behavior, but let the shooting stick aim in BOTH modes.
AtomGame.prototype.input = function input(dt) {
  const ship = this.ship;
  const controlMode = this.save.settings.controlMode === 'dpad' ? 'dpad' : 'split';
  let aim = null;
  let thrust = 0;
  let thrustVector = null;

  if (controlMode === 'split') {
    if (this.aimJoy.mag > 0.08) aim = Math.atan2(this.aimJoy.y, this.aimJoy.x);
    if (this.joy.mag > Number(this.save.settings.deadzone || 0.38)) {
      thrust = this.joy.mag;
      thrustVector = { x: this.joy.x, y: this.joy.y };
    }
  } else {
    let turn = 0;
    const touchLeft = this.dpad.left;
    const touchRight = this.dpad.right;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || touchLeft) turn -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || touchRight) turn += 1;
    ship.angle += turn * 2.65 * dt;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.dpad.up) thrust = 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.dpad.down) thrust = -0.38;

    if (this.aimJoy.mag > 0.08) {
      aim = Math.atan2(this.aimJoy.y, this.aimJoy.x);
    } else if (this.pointerAim) {
      const dx = this.pointerAim.x - ship.x;
      const dy = this.pointerAim.y - ship.y;
      if (this.fireHeld && !turn) aim = Math.atan2(dy, dx);
    }
  }

  // Desktop keyboard/mouse remains available while the joystick scheme is selected.
  if (controlMode === 'split') {
    let turn = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) turn -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) turn += 1;
    if (turn) ship.angle += turn * 2.65 * dt;
    if (!thrust && (this.keys.has('ArrowUp') || this.keys.has('KeyW'))) thrust = 1;
    if (!thrust && (this.keys.has('ArrowDown') || this.keys.has('KeyS'))) thrust = -0.38;
    if (this.pointerAim && this.fireHeld && !turn && this.aimJoy.mag <= 0.08 && this.joy.mag <= 0.08) {
      aim = Math.atan2(this.pointerAim.y - ship.y, this.pointerAim.x - ship.x);
    }
  }

  if (aim !== null) {
    const delta = ((aim - ship.angle + Math.PI * 3) % TAU) - Math.PI;
    ship.angle += clamp(delta, -3.4 * dt, 3.4 * dt);
  }

  if (thrust) {
    const ax = thrustVector ? thrustVector.x : Math.cos(ship.angle) * Math.sign(thrust);
    const ay = thrustVector ? thrustVector.y : Math.sin(ship.angle) * Math.sign(thrust);
    const amount = Math.abs(thrust);
    ship.vx += ax * ship.thrust * amount / ship.mass * dt;
    ship.vy += ay * ship.thrust * amount / ship.mass * dt;
    this.spawnThruster();
  }

  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > ship.max) {
    ship.vx *= ship.max / speed;
    ship.vy *= ship.max / speed;
  }

  const shootingStickActive = this.aimJoy.mag > shootingThreshold(this);
  const wantsContinuous = this.loadout.weapon.continuous && (this.fireHeld || this.keys.has('Space'));
  if (shootingStickActive || wantsContinuous || this.firePressed || this.keyFirePressed) this.fire();
  this.firePressed = false;
  this.keyFirePressed = false;
};

function modeLabel(mode) {
  return mode === 'dpad'
    ? 'D-pad + Shooting Joystick'
    : 'Joystick + Shooting Joystick';
}

function syncPauseControlLabel() {
  const button = document.querySelector('.pause-controls');
  const select = document.querySelector('#setting-control');
  if (button && select) {
    const label = `Controls: ${modeLabel(select.value)}`;
    if (button.textContent !== label) button.textContent = label;
  }
}

// app.js still contains the old 3-mode pause-cycle helper. Intercept that one button
// so only the two new schemes can ever be selected without rewriting the main app file.
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.pause-controls');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const select = document.querySelector('#setting-control');
  if (!select) return;
  select.value = select.value === 'dpad' ? 'split' : 'dpad';
  select.dispatchEvent(new Event('input', { bubbles: true }));
  syncPauseControlLabel();
}, true);

const tutorialReplacements = new Map([
  ['Pull the analog gently to aim. Pull it toward the border to fly.', 'Use the movement control on one side to fly. Drag the shooting joystick on the other side to aim and fire.'],
  ['Tap FIRE on the other side — or press Space — to shoot. Weapons consume energy and recharge automatically.', 'Keep the shooting joystick pulled toward a target to fire. Weapons consume energy and recharge automatically.'],
  ['There are other control modes in Pause and Options. Give them a try!', 'Switch between Joystick + Shooting Joystick and D-pad + Shooting Joystick in Pause or Options.'],
]);

function syncTutorialText() {
  const box = document.querySelector('#tutorial-callout');
  if (!box) return;
  const replacement = tutorialReplacements.get(box.textContent);
  if (replacement) box.textContent = replacement;
}

const modal = document.querySelector('#modal');
if (modal) {
  new MutationObserver(syncPauseControlLabel).observe(modal, { childList: true, subtree: true, characterData: true });
}

const tutorial = document.querySelector('#tutorial-callout');
if (tutorial) {
  new MutationObserver(syncTutorialText).observe(tutorial, { childList: true, subtree: true, characterData: true });
}

// Load the normal application only after the compatibility/control patches are in place.
await import('./app.js');

syncPauseControlLabel();
syncTutorialText();
