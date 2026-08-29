import {
  ELEMENTS,
  SHIPS,
  WEAPONS,
  ENGINES,
  MODULES,
  PAINTS,
  POWERUPS,
  getElectronShellCounts,
  getMarathonThresholds,
  findById,
} from './data.js';
import {
  getElementBehavior,
  getElementChallenges,
  getChallengeState,
  getMarathonModifier,
} from './progression.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist2 = (a, b) => {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y;
};
const rnd = (min, max) => min + Math.random() * (max - min);

export function getCollectionWindow(atomicNumber) {
  // User-requested modernization kept intentionally: elements 1–10 receive a
  // full minute, then the post-core survival window eases down continuously
  // to the 20-second minimum at element 118.
  const z = clamp(Math.round(Number(atomicNumber) || 1), 1, 118);
  if (z <= 10) return 60;
  const progress = (z - 10) / (118 - 10);
  return clamp(Math.round(60 - 40 * Math.pow(progress, 0.82)), 20, 60);
}

export function getCollectionResolution({ timeLeft, collected, total }) {
  // Two success routes: collect every blue neutron immediately, or survive
  // until the timer reaches zero. This is the intentional 1.2 modernization.
  if (total > 0 && collected >= total) return 'complete';
  if (timeLeft <= 0) return 'complete';
  return null;
}

export function getWeaponEnergyFraction(energy, capacity) {
  if (!capacity) return 1;
  return clamp(energy / capacity, 0, 1);
}

export function canFireWeapon({ activeBullets, volleySize, bulletLimit, energy, cost, cooldown = 0 }) {
  return cooldown <= 0
    && activeBullets + volleySize <= bulletLimit
    && energy + 1e-6 >= cost;
}

// The first electron shell is the visible inner safety boundary around the
// nucleus. The ship hull may touch it, but crossing inside destroys the ship.
export const CORE_EXCLUSION_RADIUS = 86;

export function isShipInsideCore({ x, y, r = 0 }, coreRadius = CORE_EXCLUSION_RADIUS) {
  const distance = Math.hypot(Number(x) - 500, Number(y) - 500);
  return distance < Math.max(0, Number(coreRadius) || CORE_EXCLUSION_RADIUS) + Math.max(0, Number(r) || 0);
}

export function isCoreLethalPhase(phase) {
  return phase !== 'post';
}

export function getNucleusDamageStage({ orbiting = 0, total = 0, phase = 'electrons' } = {}) {
  if (phase === 'post') return 'exploded';
  if (phase === 'unstable') return 'unstable';
  const safeTotal = Math.max(1, Number(total) || 1);
  const removed = clamp(1 - Math.max(0, Number(orbiting) || 0) / safeTotal, 0, 1);
  if (removed < .25) return 'intact';
  if (removed < .55) return 'cracked';
  if (removed < .82) return 'heavily-cracked';
  return 'unstable';
}

export class AtomGame {
  constructor(canvas, audio, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.hooks = hooks;
    this.running = false;
    this.paused = false;
    this.last = 0;
    this.keys = new Set();
    this.joy = { x: 0, y: 0, mag: 0 };
    this.aimJoy = { x: 0, y: 0, mag: 0 };
    this.dpad = { up: false, down: false, left: false, right: false };
    this.fireHeld = false;
    this.firePressed = false;
    this.keyFirePressed = false;
    this.pointerAim = null;
    this.raf = 0;
    this.lastHudSignature = '';
    this.orbitingRemaining = 0;
    this.shellRadii = [];
    this.backgroundLayer = this.buildBackgroundLayer();
    this.shipSprites = this.preloadShipSprites();
    this.marathonThresholds = getMarathonThresholds(100);
    this.marathonPersistClock = 0;
    this.emptySoundCooldown = 0;
    this.handleVisibilityChange = () => {
      // requestAnimationFrame pauses in hidden tabs. Reset the clock when the
      // game becomes visible again so time spent away from the game does not
      // consume the active collection window in one giant frame.
      if (!document.hidden && this.running && !this.paused) this.last = performance.now();
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.bindDesktop();
  }

  preloadShipSprites() {
    const sprites = new Map();
    for (const ship of SHIPS) {
      const image = new Image();
      image.decoding = 'async';
      image.src = `assets/ships/${ship.id}.png`;
      sprites.set(ship.id, image);
    }
    return sprites;
  }

  buildBackgroundLayer() {
    const layer = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1000, 1000)
      : document.createElement('canvas');
    layer.width = 1000;
    layer.height = 1000;
    const c = layer.getContext('2d');

    c.fillStyle = '#eef3f5';
    c.fillRect(0, 0, 1000, 1000);
    c.strokeStyle = 'rgba(124,151,160,.11)';
    c.lineWidth = 1;

    for (let i = 0; i < 24; i += 1) {
      const x = (i * 137) % 1000;
      const y = (i * 233) % 1000;
      c.beginPath();
      c.arc(x, y, 2, 0, TAU);
      c.fillStyle = 'rgba(96,155,164,.2)';
      c.fill();

      const x2 = ((i + 3) * 197) % 1000;
      const y2 = ((i + 7) * 89) % 1000;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x2, y2);
      c.stroke();
    }

    c.beginPath();
    c.arc(500, 500, 430, 0, TAU);
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(84,107,114,.22)';
    c.stroke();
    return layer;
  }

  bindDesktop() {
    window.addEventListener('keydown', (event) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD']
          .includes(event.code)
      ) event.preventDefault();

      if (event.code === 'Space' && !this.keys.has('Space')) this.keyFirePressed = true;
      this.keys.add(event.code);
      if (event.code === 'Escape' && this.running) this.hooks.onPause?.();
    }, { passive: false });

    window.addEventListener('keyup', (event) => this.keys.delete(event.code));

    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointerAim = {
        x: (event.clientX - rect.left) * 1000 / rect.width,
        y: (event.clientY - rect.top) * 1000 / rect.height,
      };
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button === 0) {
        this.fireHeld = true;
        this.firePressed = true;
        this.audio.unlock();
      }
    });

    window.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse' && event.button === 0) this.fireHeld = false;
    });
  }

  getLoadout(save) {
    const ship = findById(SHIPS, save.selectedShip);
    const weapon = findById(WEAPONS, save.selectedWeapon);
    const engine = findById(ENGINES, save.selectedEngine);
    const mods = (save.selectedModules || [])
      .map((id) => MODULES.find((module) => module.id === id))
      .filter(Boolean)
      .slice(0, ship.slots);

    const stat = {
      pickup: ship.pickup,
      gravity: ship.gravity,
      bulletSpeed: 1,
      bulletSize: 1,
      shipSize: ship.size,
      electronSpeed: 1,
      time: 1,
    };

    for (const module of mods) {
      if (module.effect === 'pickup') stat.pickup *= module.value;
      if (module.effect === 'gravity') stat.gravity *= module.value;
      if (module.effect === 'bulletSpeed') stat.bulletSpeed *= module.value;
      if (module.effect === 'bulletSize') stat.bulletSize *= module.value;
      if (module.effect === 'shipSize') stat.shipSize *= module.value;
      if (module.effect === 'electronSpeed') stat.electronSpeed *= module.value;
      if (module.effect === 'time') stat.time *= module.value;
    }

    return { ship, weapon, engine, mods, stat };
  }

  start({ elementIndex = 0, mode = 'classic', save, tutorial = false, marathonState = null }) {
    this.mode = mode;
    this.save = save;
    this.tutorial = tutorial;
    this.elementIndex = clamp(elementIndex, 0, ELEMENTS.length - 1);
    this.element = ELEMENTS[this.elementIndex];
    const marathon = mode === 'marathon' ? (marathonState || {}) : {};
    this.marathonSeed = mode === 'marathon'
      ? Math.max(1, Math.floor(Number(marathon.seed) || rnd(1, 1_000_000_000)))
      : 0;
    this.marathonModifier = mode === 'marathon'
      ? getMarathonModifier(this.elementIndex, this.marathonSeed)
      : null;
    this.elementBehavior = getElementBehavior(this.element.z);
    this.loadout = this.getLoadout(save);
    this.challenges = mode === 'classic' ? getElementChallenges(this.element.z) : [];

    this.score = mode === 'marathon' ? Number(marathon.score || 0) : 0;
    this.levelScore = 0;
    this.lives = mode === 'marathon' ? Math.max(1, Number(marathon.lives || 3)) : 3;
    const derivedExtraIndex = mode === 'marathon'
      ? this.marathonThresholds.findIndex((threshold) => threshold > this.score)
      : 0;
    const safeDerivedExtraIndex = derivedExtraIndex < 0 ? this.marathonThresholds.length : derivedExtraIndex;
    this.marathonNextExtraIndex = mode === 'marathon'
      ? Math.max(safeDerivedExtraIndex, Number(marathon.nextExtraIndex || 0))
      : 0;
    this.marathonRunTime = mode === 'marathon' ? Number(marathon.runTime || 0) : 0;
    this.marathonRunNeutrons = mode === 'marathon' ? Number(marathon.runNeutrons || 0) : 0;
    this.marathonPersistClock = 0;
    this.emptySoundCooldown = 0;
    this.musicSyncClock = 0;
    this.shieldFxCooldown = 0;

    this.elapsed = 0;
    this.phase = 'electrons';
    this.explosionTimer = 0;
    this.collectionDuration = getCollectionWindow(this.element.z);
    this.collectionTimeLeft = this.collectionDuration;
    this.neutronCollected = 0;
    this.levelNeutrons = 0;
    this.neutronGoal = Math.max(1, Math.ceil(this.element.z / 12));
    this.neutronTotal = 0;
    this.bullets = [];
    this.beams = [];
    this.nuclear = [];
    this.hazards = [];
    this.powerups = [];
    this.activePowerups = Object.create(null);
    this.powerupSpawnClock = rnd(16, 24);
    const protonInterval = this.getAmbientProtonInterval();
    this.protonEmissionClock = protonInterval ? rnd(protonInterval * .65, protonInterval * 1.15) : 0;
    this.particles = [];
    this.shake = 0;
    this.slowMoTimer = 0;
    this.screenFlash = { alpha: 0, color: '#ffffff' };
    this.messageTimer = 0;
    this.challengeMetrics = {
      livesLost: 0,
      powerupsUsed: 0,
      protonHits: 0,
      shotsFired: 0,
      electronClearTime: null,
      neutronCollected: 0,
      neutronTotal: 0,
      elapsed: 0,
      weaponId: this.loadout.weapon.id,
    };
    this.lastHudSignature = '';
    this.initShip();
    this.initElectrons();
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((time) => this.loop(time));
    this.emitHUD(true);
    this.emitMarathonState(true);
    this.syncMusicState(true);
    if (this.marathonModifier) this.hooks.onMessage?.(`${this.marathonModifier.name}: ${this.marathonModifier.description}`);
  }

  effectScale() {
    const mode = this.save?.settings?.effects || 'full';
    return mode === 'off' ? 0 : mode === 'reduced' ? 0.45 : 1;
  }

  triggerShake(amount) {
    this.shake = Math.max(this.shake, amount * this.effectScale());
  }

  flashScreen(color = '#ffffff', alpha = .18) {
    const scale = this.effectScale();
    if (!scale) return;
    this.screenFlash = { color, alpha: Math.max(this.screenFlash?.alpha || 0, alpha * scale) };
  }

  getAmbientProtonInterval() {
    const elementInterval = Number(this.elementBehavior?.protonInterval || 0);
    const modifierInterval = Number(this.marathonModifier?.protonInterval || 0);
    if (elementInterval && modifierInterval) return Math.min(elementInterval, modifierInterval);
    return elementInterval || modifierInterval || 0;
  }

  challengeSnapshot() {
    return {
      ...this.challengeMetrics,
      neutronCollected: this.neutronCollected,
      neutronTotal: this.neutronTotal,
      elapsed: this.elapsed,
    };
  }

  challengeStates(final = false) {
    const metrics = this.challengeSnapshot();
    return this.challenges.map((challenge) => ({
      ...challenge,
      state: getChallengeState(challenge, metrics, final),
    }));
  }

  syncMusicState(force = false) {
    if (!this.audio?.setGameplayState) return;
    if (!force && this.musicSyncClock > 0) return;
    this.musicSyncClock = .28;
    this.audio.setGameplayState({
      mode: this.mode,
      phase: this.phase,
      electronFraction: this.electrons?.length ? this.orbitingRemaining / this.electrons.length : 0,
      lives: this.lives,
    });
  }

  initShip() {
    const { ship, engine, stat, weapon } = this.loadout;
    this.ship = {
      x: 500,
      y: 115,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      r: 13 * stat.shipSize * (this.marathonModifier?.shipSize || 1),
      mass: ship.mass,
      thrust: 245 * ship.thrust * engine.thrust,
      max: 360 * engine.max,
      invuln: 1.1,
      cooldown: 0,
      energy: weapon.capacity,
    };
  }

  initElectrons() {
    this.electrons = [];
    this.shellRadii = [];
    const counts = getElectronShellCounts(this.element.z);
    const speedScale = this.loadout.stat.electronSpeed
      * this.elementBehavior.electronSpeed
      * (this.marathonModifier?.electronSpeed || 1)
      * (this.marathonModifier?.hostileTime || 1);

    for (let shell = 0; shell < counts.length; shell += 1) {
      const count = counts[shell];
      if (!count) continue;
      const radius = 86 + shell * 43;
      this.shellRadii.push(radius);

      for (let i = 0; i < count; i += 1) {
        this.electrons.push({
          shell: shell + 1,
          radius,
          angle: TAU * i / count + rnd(-0.06, 0.06),
          speed: (0.16 + 0.028 * (7 - shell)) * speedScale * (i % 2 ? 1 : -1),
          state: 'orbit',
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          ttl: 0,
          hp: this.elementBehavior.electronHp,
          radiusX: radius * (1 + this.elementBehavior.orbitEccentricity * (i % 2 ? .7 : -.35)),
          radiusY: radius * (1 - this.elementBehavior.orbitEccentricity * (i % 3 ? .45 : -.25)),
          precession: this.elementBehavior.orbitPrecession * (shell % 2 ? 1 : -1),
          precessionAngle: rnd(0, TAU),
          hitFlash: 0,
        });
      }
    }

    this.orbitingRemaining = this.electrons.length;
    this.updateElectronPositions(0);
  }

  setJoystick(x, y, mag) { this.joy = { x, y, mag }; }
  setAimJoystick(x, y, mag) { this.aimJoy = { x, y, mag }; }
  setDpad(key, value) { if (key in this.dpad) this.dpad[key] = Boolean(value); }

  setFire(value) {
    if (value && !this.fireHeld) this.firePressed = true;
    this.fireHeld = value;
    if (value) this.audio.unlock();
  }

  setPaused(value) {
    this.paused = value;
    if (!value && this.running) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((time) => this.loop(time));
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.emitMarathonState(true);
  }

  loop(time) {
    if (!this.running || this.paused) return;

    // Keep gameplay clocks tied to real active time rather than frame count.
    // Slow frames are split into stable <=33 ms simulation steps, so a
    // 60-second collection window still lasts 60 seconds at 20/30/60 FPS.
    const rawElapsed = (time - this.last) / 1000;
    let remaining = Math.min(0.5, Number.isFinite(rawElapsed) && rawElapsed > 0 ? rawElapsed : 0.016);
    this.last = time;

    while (remaining > 1e-6 && this.running && !this.paused) {
      const dt = Math.min(0.033, remaining);
      this.update(dt);
      remaining -= dt;
    }

    this.draw();
    if (this.running && !this.paused) this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  input(dt) {
    const ship = this.ship;
    const controlMode = this.save.settings.controlMode || 'combined';
    let aim = null;
    let thrust = 0;
    let thrustVector = null;

    if (controlMode === 'combined' && this.joy.mag > 0.08) {
      aim = Math.atan2(this.joy.y, this.joy.x);
      thrust = this.joy.mag > Number(this.save.settings.deadzone || 0.38) ? this.joy.mag : 0;
    } else if (controlMode === 'split') {
      if (this.aimJoy.mag > 0.08) aim = Math.atan2(this.aimJoy.y, this.aimJoy.x);
      if (this.joy.mag > Number(this.save.settings.deadzone || 0.38)) {
        thrust = this.joy.mag;
        thrustVector = { x: this.joy.x, y: this.joy.y };
      }
    } else {
      let turn = 0;
      const touchLeft = controlMode === 'dpad' && this.dpad.left;
      const touchRight = controlMode === 'dpad' && this.dpad.right;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || touchLeft) turn -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || touchRight) turn += 1;
      ship.angle += turn * 2.65 * dt;

      if (this.keys.has('ArrowUp') || this.keys.has('KeyW') || (controlMode === 'dpad' && this.dpad.up)) thrust = 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS') || (controlMode === 'dpad' && this.dpad.down)) thrust = -0.38;

      if (this.pointerAim) {
        const dx = this.pointerAim.x - ship.x;
        const dy = this.pointerAim.y - ship.y;
        if (this.fireHeld && !turn) aim = Math.atan2(dy, dx);
      }
    }

    // Desktop steering remains available in all touch-control modes.
    if (controlMode === 'combined' || controlMode === 'split') {
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

    const wantsContinuous = this.loadout.weapon.continuous && (this.fireHeld || this.keys.has('Space'));
    if (wantsContinuous || this.firePressed || this.keyFirePressed) this.fire();
    this.firePressed = false;
    this.keyFirePressed = false;
  }

  fire() {
    const ship = this.ship;
    const weapon = this.loadout.weapon;
    const directWeapon = ['laser', 'arc', 'pulse'].includes(weapon.kind);
    const volleySize = directWeapon ? 0 : weapon.bullets;
    if (!canFireWeapon({
      activeBullets: this.bullets.length,
      volleySize,
      bulletLimit: weapon.bulletLimit,
      energy: ship.energy,
      cost: weapon.cost,
      cooldown: ship.cooldown,
    })) {
      if (this.emptySoundCooldown <= 0) {
        this.audio.empty?.();
        this.emptySoundCooldown = .18;
      }
      return false;
    }

    ship.energy = Math.max(0, ship.energy - weapon.cost);
    ship.cooldown = 1 / (weapon.rate * (this.marathonModifier?.fireRate || 1));
    this.challengeMetrics.shotsFired += 1;
    if (this.save.stats) this.save.stats.totalShots += 1;
    const bigFire = this.hasPower('bigfire');
    const damageScale = bigFire ? 1.5 : 1;

    if (weapon.kind === 'laser') {
      this.fireLaser(weapon, damageScale);
    } else if (weapon.kind === 'arc') {
      this.fireArc(weapon, damageScale);
    } else if (weapon.kind === 'pulse') {
      this.firePulse(weapon, damageScale);
    } else {
      const center = (weapon.bullets - 1) / 2;
      const speed = weapon.speed * this.loadout.stat.bulletSpeed;
      const bulletSize = weapon.size * this.loadout.stat.bulletSize * (bigFire ? 1.7 : 1);
      const damage = weapon.damage * damageScale;
      for (let i = 0; i < weapon.bullets; i += 1) {
        const angle = this.ship.angle + (i - center) * weapon.spread;
        this.bullets.push({
          x: ship.x + Math.cos(angle) * ship.r * 1.4,
          y: ship.y + Math.sin(angle) * ship.r * 1.4,
          px: ship.x,
          py: ship.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ttl: weapon.life,
          r: bulletSize,
          damage,
          pierce: weapon.pierce || 1,
          kind: weapon.kind || weapon.family,
          homing: Number(weapon.homing || 0),
        });
      }
    }
    this.muzzleFlash();
    this.audio.shoot();
    return true;
  }

  rayTarget(maxRange = 400, tolerance = 28) {
    const ship = this.ship;
    const dx = Math.cos(ship.angle);
    const dy = Math.sin(ship.angle);
    let best = null;
    let bestAlong = Infinity;
    for (const electron of this.electrons) {
      if (electron.state !== 'orbit') continue;
      const ex = electron.x - ship.x;
      const ey = electron.y - ship.y;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along > maxRange) continue;
      const perpendicular = Math.abs(ex * dy - ey * dx);
      if (perpendicular > tolerance) continue;
      if (along < bestAlong) { best = electron; bestAlong = along; }
    }
    return best;
  }

  damageElectron(electron, damage, source = 'particle') {
    if (!electron || electron.state !== 'orbit') return false;
    electron.hp -= damage;
    electron.hitFlash = 1;
    this.audio.hit();
    this.spark(electron.x, electron.y, 'electron');
    this.hitRing(electron.x, electron.y, source === 'arc' ? '#8f6bd8' : source === 'laser' ? '#ef355d' : '#18aeb5');
    if (electron.hp > 0) return false;
    electron.state = 'loose';
    this.orbitingRemaining = Math.max(0, this.orbitingRemaining - 1);
    const angle = electron.angle;
    electron.vx = Math.cos(angle) * rnd(55, 100);
    electron.vy = Math.sin(angle) * rnd(55, 100);
    electron.ttl = 8;
    this.addScore(40);
    if (!this.tutorial && Math.random() < 0.08) this.spawnPowerupAt(electron.x, electron.y);
    return true;
  }

  addBeam(x1, y1, x2, y2, color, width = 4, ttl = .08) {
    this.beams.push({ x1, y1, x2, y2, color, width, ttl });
    if (this.beams.length > 36) this.beams.splice(0, this.beams.length - 36);
  }

  fireLaser(weapon, damageScale) {
    const ship = this.ship;
    const target = this.rayTarget(weapon.range, 22);
    const endX = target ? target.x : ship.x + Math.cos(ship.angle) * weapon.range;
    const endY = target ? target.y : ship.y + Math.sin(ship.angle) * weapon.range;
    this.addBeam(ship.x, ship.y, endX, endY, '#ef4868', 4.5, .075);
    if (target) this.damageElectron(target, weapon.damage * damageScale, 'laser');
  }

  fireArc(weapon, damageScale) {
    const first = this.rayTarget(weapon.range, 52);
    if (!first) {
      const ship = this.ship;
      this.addBeam(ship.x, ship.y, ship.x + Math.cos(ship.angle) * weapon.range * .55, ship.y + Math.sin(ship.angle) * weapon.range * .55, '#8f6bd8', 3, .1);
      return;
    }
    let current = first;
    let from = this.ship;
    const visited = new Set();
    for (let chain = 0; chain < weapon.chains && current; chain += 1) {
      visited.add(current);
      this.addBeam(from.x, from.y, current.x, current.y, chain ? '#a98cff' : '#7857d8', 4.5 - chain * .6, .14);
      this.damageElectron(current, weapon.damage * damageScale * Math.pow(.82, chain), 'arc');
      let next = null;
      let nextDistance = Infinity;
      for (const candidate of this.electrons) {
        if (candidate.state !== 'orbit' || visited.has(candidate)) continue;
        const d = Math.sqrt(dist2(current, candidate));
        if (d <= weapon.chainRange && d < nextDistance) { next = candidate; nextDistance = d; }
      }
      from = current;
      current = next;
    }
  }

  firePulse(weapon, damageScale) {
    const range = weapon.range * (this.hasPower('bigfire') ? 1.15 : 1);
    this.pushParticle({ x:this.ship.x, y:this.ship.y, ttl:.34, type:'ring', radius:this.ship.r * 1.25, growth:(range - this.ship.r) / .34, color:'#2aa8d8' });
    this.flashScreen('#2aa8d8', .025);
    for (const electron of this.electrons) {
      if (electron.state !== 'orbit') continue;
      if (Math.sqrt(dist2(electron, this.ship)) <= range + 10) this.damageElectron(electron, weapon.damage * damageScale, 'pulse');
    }
  }

  update(dt) {
    this.elapsed += dt;
    const worldDt = this.slowMoTimer > 0 ? dt * 0.34 : dt;
    this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);
    if (this.mode === 'marathon') this.marathonRunTime += dt;
    this.input(worldDt);

    const ship = this.ship;
    const weapon = this.loadout.weapon;
    ship.cooldown = Math.max(0, ship.cooldown - worldDt);
    ship.invuln = Math.max(0, ship.invuln - dt);
    this.emptySoundCooldown = Math.max(0, this.emptySoundCooldown - dt);
    this.shieldFxCooldown = Math.max(0, this.shieldFxCooldown - dt);
    this.musicSyncClock = Math.max(0, this.musicSyncClock - dt);
    this.challengeMetrics.elapsed = this.elapsed;
    ship.energy = Math.min(weapon.capacity, ship.energy + weapon.regen * (this.marathonModifier?.energyRegen || 1) * worldDt);

    this.updatePowerups(worldDt);
    this.updatePhysics(worldDt);
    this.updateHazards(worldDt);
    if (!this.running) return;
    this.updateElectronPositions(worldDt);
    this.updateBullets(worldDt);
    this.updateNuclear(worldDt);
    if (!this.running) return;
    this.updateParticles(worldDt);
    for (const beam of this.beams) beam.ttl -= dt;
    this.beams = this.beams.filter((beam) => beam.ttl > 0);

    if (this.phase === 'electrons' && this.orbitingRemaining === 0) {
      this.phase = 'unstable';
      this.challengeMetrics.electronClearTime ??= this.elapsed;
      this.unstableDuration = 1.25 * this.elementBehavior.instabilityTime;
      this.explosionTimer = this.unstableDuration;
      this.slowMoTimer = .8;
      this.hooks.onObjective?.('The nucleus is unstable…');
      this.pushParticle({ x:500, y:500, ttl:.5, type:'ring', radius:32, growth:280, color:'#ef355d' });
      for (let i = 0; i < 18; i += 1) {
        const angle = rnd(0, TAU);
        const speed = rnd(65, 190);
        this.pushParticle({x:500,y:500,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,ttl:rnd(.22,.5),type:i%2?'nucleus-red':'nucleus-blue'});
      }
      this.triggerShake(3.2);
      this.flashScreen('#ef355d', .06);
      this.syncMusicState(true);
    }

    if (this.phase === 'unstable') {
      this.explosionTimer -= dt;
      if (this.explosionTimer <= 0) this.explodeNucleus();
    }

    if (this.phase === 'post') {
      this.collectionTimeLeft = Math.max(0, this.collectionTimeLeft - dt);
      const resolution = getCollectionResolution({
        timeLeft: this.collectionTimeLeft,
        collected: this.neutronCollected,
        total: this.neutronTotal,
      });
      if (resolution === 'complete') {
        this.completeLevel();
        return;
      }
    }

    if (this.messageTimer > 0) this.messageTimer -= dt;
    this.shake = Math.max(0, this.shake - dt * 22);
    if (this.screenFlash?.alpha > 0) this.screenFlash.alpha = Math.max(0, this.screenFlash.alpha - dt * 1.7);
    this.syncMusicState();
    this.emitHUD();

    if (this.mode === 'marathon') {
      this.marathonPersistClock += dt;
      if (this.marathonPersistClock >= 2) {
        this.marathonPersistClock = 0;
        this.emitMarathonState();
      }
    }
  }

  updatePhysics(dt) {
    const ship = this.ship;
    const dx = 500 - ship.x;
    const dy = 500 - ship.y;
    const distance = Math.max(50, Math.hypot(dx, dy));

    if (this.element.z >= 4 && this.phase !== 'post' && !this.hasPower('gravity')) {
      const base = (18 + this.element.z * 0.72)
        * this.loadout.stat.gravity
        * this.elementBehavior.gravity
        * (this.marathonModifier?.gravity || 1);
      const acceleration = base * Math.pow(260 / distance, 1.15);
      ship.vx += dx / distance * acceleration * dt;
      ship.vy += dy / distance * acceleration * dt;
    }

    const drag = Math.pow(0.992, dt * 60);
    ship.vx *= drag;
    ship.vy *= drag;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    const boundaryDistance = Math.hypot(ship.x - 500, ship.y - 500);
    const limit = 420 - ship.r;
    if (boundaryDistance > limit) {
      const nx = (ship.x - 500) / boundaryDistance;
      const ny = (ship.y - 500) / boundaryDistance;
      ship.x = 500 + nx * limit;
      ship.y = 500 + ny * limit;
      const velocityNormal = ship.vx * nx + ship.vy * ny;
      if (velocityNormal > 0) {
        ship.vx -= 1.55 * velocityNormal * nx;
        ship.vy -= 1.55 * velocityNormal * ny;
      }
    }

    // The innermost visible orbit is lethal only while the nucleus still
    // exists. Once the core explodes and collection begins, its former area
    // becomes safe to fly through. Before that, the boundary bypasses Ghost
    // and temporary spawn invulnerability.
    if (isCoreLethalPhase(this.phase)) {
      const coreRadius = this.shellRadii[0] || CORE_EXCLUSION_RADIUS;
      if (isShipInsideCore(ship, coreRadius)) this.damageShip('core', { bypassProtection: true });
    }
  }

  updateElectronPositions(dt) {
    const ship = this.ship;
    const frozen = this.hasPower('electronstop');
    const timeScale = this.loadout.stat.time;
    const pickupBoost = this.hasPower('collect') ? 2.2 : 1;

    for (const electron of this.electrons) {
      electron.hitFlash = Math.max(0, (electron.hitFlash || 0) - dt * 5);
      if (electron.state === 'orbit') {
        if (!frozen) {
          electron.angle += electron.speed * dt * timeScale;
          electron.precessionAngle += electron.precession * dt * timeScale;
        }
        const rx = electron.radiusX || electron.radius;
        const ry = electron.radiusY || electron.radius;
        const ca = Math.cos(electron.angle);
        const sa = Math.sin(electron.angle);
        const cp = Math.cos(electron.precessionAngle || 0);
        const sp = Math.sin(electron.precessionAngle || 0);
        electron.x = 500 + ca * rx * cp - sa * ry * sp;
        electron.y = 500 + ca * rx * sp + sa * ry * cp;
        continue;
      }

      if (electron.state !== 'loose') continue;
      electron.ttl -= dt;
      electron.x += electron.vx * dt * timeScale;
      electron.y += electron.vy * dt * timeScale;

      const nucleusDistance = Math.hypot(electron.x - 500, electron.y - 500);
      if (nucleusDistance > 430 || electron.ttl <= 0) electron.state = 'gone';

      const pickup = 22 * this.loadout.stat.pickup * pickupBoost + ship.r;
      if (electron.state === 'loose' && dist2(electron, ship) < pickup * pickup) {
        electron.state = 'collected';
        this.save.electrons += 1;
        if (this.save.stats) this.save.stats.totalElectronsCollected += 1;
        this.addScore(100);
        this.audio.collect();
        this.collectionRing(electron.x, electron.y, '#18aeb5');
        this.hooks.onCurrency?.();
      }
    }
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.ttl -= dt;
      bullet.px = bullet.x;
      bullet.py = bullet.y;

      if (bullet.homing > 0) {
        let target = null;
        let targetD2 = Infinity;
        for (const electron of this.electrons) {
          if (electron.state !== 'orbit') continue;
          const d = dist2(bullet, electron);
          if (d < targetD2) { target = electron; targetD2 = d; }
        }
        if (target) {
          const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
          const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
          const current = Math.atan2(bullet.vy, bullet.vx);
          const delta = ((desired - current + Math.PI * 3) % TAU) - Math.PI;
          const turn = clamp(delta, -bullet.homing * dt, bullet.homing * dt);
          const angle = current + turn;
          bullet.vx = Math.cos(angle) * speed;
          bullet.vy = Math.sin(angle) * speed;
        }
      }

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.ttl <= 0) continue;

      for (const electron of this.electrons) {
        if (electron.state !== 'orbit') continue;
        const radius = bullet.r + 10;
        if (dist2(bullet, electron) >= radius * radius) continue;
        this.damageElectron(electron, bullet.damage, bullet.kind);
        bullet.pierce -= 1;
        if (bullet.pierce <= 0) bullet.ttl = 0;
        if (bullet.ttl <= 0) break;
      }
    }

    this.bullets = this.bullets.filter((bullet) => (
      bullet.ttl > 0
      && bullet.x > -30
      && bullet.y > -30
      && bullet.x < 1030
      && bullet.y < 1030
    ));
  }

  explodeNucleus() {
    this.phase = 'post';
    this.collectionDuration = getCollectionWindow(this.element.z);
    this.collectionTimeLeft = this.collectionDuration;
    this.audio.explode();
    this.triggerShake(4.2);
    this.flashScreen('#ffffff', .12);
    this.pushParticle({ x:500, y:500, ttl:.7, type:'ring', radius:24, growth:420, color:'#ffffff' });
    this.hazards = [];
    this.nucleusBurst();
    this.syncMusicState(true);

    const count = clamp(Math.round(Math.sqrt(this.element.z) * 2.2), 4, 28);
    const needed = this.neutronGoal;
    let neutrons = 0;

    for (let i = 0; i < count; i += 1) {
      const isNeutron = (i % 2 === 0) || (neutrons < needed && i >= count - needed);
      if (isNeutron) neutrons += 1;
      const angle = rnd(0, TAU);
      const speed = rnd(55, 150) + this.element.z * 0.35;
      this.nuclear.push({
        x: 500 + rnd(-8, 8),
        y: 500 + rnd(-8, 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: isNeutron ? 11 : 12,
        type: isNeutron ? 'neutron' : 'proton',
        ttl: this.collectionDuration,
      });
    }

    this.neutronTotal = neutrons;
    this.challengeMetrics.neutronTotal = neutrons;
    this.hooks.onObjective?.(
      `Collect all ${this.neutronTotal} blue neutron${this.neutronTotal === 1 ? '' : 's'} or survive ${this.collectionDuration}s`,
    );
    this.emitHUD(true);
  }

  updateNuclear(dt) {
    if (this.phase !== 'post') return;
    const ship = this.ship;
    const motionScale = this.loadout.stat.time * (this.marathonModifier?.hostileTime || 1);
    const pickupBoost = this.hasPower('collect') ? 2.2 : 1;

    for (const particle of this.nuclear) {
      if (particle.dead) continue;
      particle.ttl -= dt;
      particle.x += particle.vx * dt * motionScale;
      particle.y += particle.vy * dt * motionScale;

      const distance = Math.hypot(particle.x - 500, particle.y - 500);
      if (distance > 430 - particle.r) {
        const nx = (particle.x - 500) / distance;
        const ny = (particle.y - 500) / distance;
        const velocityNormal = particle.vx * nx + particle.vy * ny;
        particle.x = 500 + nx * (430 - particle.r);
        particle.y = 500 + ny * (430 - particle.r);
        particle.vx -= 1.7 * velocityNormal * nx;
        particle.vy -= 1.7 * velocityNormal * ny;
      }

      const pickup = (particle.type === 'neutron' ? 22 * this.loadout.stat.pickup * pickupBoost : 0)
        + ship.r
        + particle.r;

      if (dist2(particle, ship) >= pickup * pickup) continue;

      if (particle.type === 'neutron') {
        particle.dead = true;
        this.neutronCollected += 1;
        this.levelNeutrons += 1;
        if (this.mode === 'marathon') this.marathonRunNeutrons += 1;
        const neutronReward = this.mode === 'marathon' ? (this.marathonModifier?.neutronReward || 1) : 1;
        this.save.neutrons += neutronReward;
        if (this.save.stats) this.save.stats.totalNeutronsCollected += 1;
        this.challengeMetrics.neutronCollected = this.neutronCollected;
        this.challengeMetrics.neutronTotal = this.neutronTotal;
        this.addScore(250);
        this.audio.collect();
        this.collectionRing(particle.x, particle.y, '#2aa8d8');
        this.spark(particle.x, particle.y, 'nucleus-blue');
        this.flashScreen('#2aa8d8', .045);
        this.hooks.onCurrency?.();
        const remaining = Math.max(0, this.neutronTotal - this.neutronCollected);
        if (remaining <= 0) {
          // The user-requested early-win route is truly immediate: once the
          // final blue neutron is collected, later protons in this same frame
          // cannot steal the already-earned victory.
          this.completeLevel();
          return;
        }
        this.hooks.onObjective?.(`${remaining} blue neutron${remaining === 1 ? '' : 's'} left — collect all to finish early`);
      } else {
        particle.dead = true;
        this.damageShip('proton');
      }
    }

    this.nuclear = this.nuclear.filter((particle) => !particle.dead && particle.ttl > 0);
  }

  spawnAmbientProton() {
    const angle = rnd(0, TAU);
    const speed = rnd(85, 135) + this.element.z * .2;
    this.hazards.push({
      x: 500 + Math.cos(angle) * 24,
      y: 500 + Math.sin(angle) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 10,
      ttl: 9,
    });
    this.hooks.onMessage?.('Proton emission');
  }

  updateHazards(dt) {
    if (this.phase === 'post') {
      this.hazards = [];
      return;
    }
    const interval = this.getAmbientProtonInterval();
    if (interval) {
      this.protonEmissionClock -= dt;
      if (this.protonEmissionClock <= 0) {
        this.spawnAmbientProton();
        this.protonEmissionClock = rnd(interval * .75, interval * 1.2);
      }
    }

    const timeScale = this.loadout.stat.time * (this.marathonModifier?.hostileTime || 1);
    for (const proton of this.hazards) {
      if (proton.dead) continue;
      proton.ttl -= dt;
      proton.x += proton.vx * dt * timeScale;
      proton.y += proton.vy * dt * timeScale;
      const distance = Math.hypot(proton.x - 500, proton.y - 500);
      if (distance > 420 - proton.r) {
        const nx = (proton.x - 500) / distance;
        const ny = (proton.y - 500) / distance;
        const vn = proton.vx * nx + proton.vy * ny;
        proton.x = 500 + nx * (420 - proton.r);
        proton.y = 500 + ny * (420 - proton.r);
        proton.vx -= 1.75 * vn * nx;
        proton.vy -= 1.75 * vn * ny;
      }
      const hitRadius = proton.r + this.ship.r;
      if (dist2(proton, this.ship) < hitRadius * hitRadius) {
        proton.dead = true;
        this.damageShip('proton');
      }
    }
    this.hazards = this.hazards.filter((proton) => !proton.dead && proton.ttl > 0);
  }

  remainingNeutrons() { return Math.max(0, this.neutronTotal - this.neutronCollected); }

  hasPower(id) { return Number(this.activePowerups?.[id] || 0) > 0; }

  updatePowerups(dt) {
    for (const [id, remaining] of Object.entries(this.activePowerups)) {
      const next = remaining - dt;
      if (next <= 0) delete this.activePowerups[id];
      else this.activePowerups[id] = next;
    }

    if (!this.tutorial && !this.marathonModifier?.noPowerups && this.phase === 'electrons') {
      this.powerupSpawnClock -= dt;
      if (this.powerupSpawnClock <= 0) {
        const angle = rnd(0, TAU);
        const radius = rnd(145, 325);
        this.spawnPowerupAt(500 + Math.cos(angle) * radius, 500 + Math.sin(angle) * radius);
        this.powerupSpawnClock = rnd(18, 28);
      }
    }

    const ship = this.ship;
    for (const pickup of this.powerups) {
      if (pickup.dead) continue;
      pickup.ttl -= dt;
      pickup.pulse += dt * 4;
      if (pickup.ttl <= 0) {
        pickup.dead = true;
        continue;
      }
      const radius = ship.r + 25;
      if (dist2(pickup, ship) < radius * radius) {
        pickup.dead = true;
        this.activatePowerup(pickup.type, pickup.x, pickup.y);
      }
    }
    this.powerups = this.powerups.filter((pickup) => !pickup.dead);
  }

  spawnPowerupAt(x, y) {
    if (this.marathonModifier?.noPowerups || this.powerups.length >= 2) return;
    const definition = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
    this.powerups.push({ x, y, type: definition.id, ttl: 12, pulse: rnd(0, TAU) });
  }

  activatePowerup(id, x, y) {
    const definition = POWERUPS.find((item) => item.id === id);
    if (!definition) return;
    this.challengeMetrics.powerupsUsed += 1;
    if (id === 'ammo') {
      this.ship.energy = this.loadout.weapon.capacity;
    } else {
      this.activePowerups[id] = definition.duration;
    }
    this.audio.powerup?.();
    this.collectionRing(x, y, definition.color);
    this.hooks.onMessage?.(`${definition.name}!`);
    this.emitHUD(true);
  }

  damageShip(reason, { bypassProtection = false } = {}) {
    const ship = this.ship;
    if (!this.running || (!bypassProtection && ship.invuln > 0)) return;
    if (!bypassProtection && this.hasPower('ghost')) {
      this.shieldHit(ship.x, ship.y);
      ship.invuln = .16;
      return;
    }

    this.lives -= 1;
    this.challengeMetrics.livesLost += 1;
    if (reason === 'proton') this.challengeMetrics.protonHits += 1;
    this.audio.proton();
    this.triggerShake(8);
    this.flashScreen('#ef355d', .22);
    this.burst(ship.x, ship.y);

    if (this.lives <= 0) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      const marathonState = this.getMarathonState();
      this.emitMarathonState(true);
      this.hooks.onGameOver?.({
        score: this.score,
        levelScore: this.levelScore,
        reason,
        element: this.element,
        mode: this.mode,
        time: this.elapsed,
        neutrons: this.levelNeutrons,
        marathonState,
      });
      return;
    }

    this.initShip();
    this.emitHUD(true);
    this.emitMarathonState(true);
    this.hooks.onLifeLost?.(this.lives);
  }

  completeLevel() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.audio.complete();

    const timeBonus = Math.max(0, Math.round(2500 - this.elapsed * 20));
    const lifeBonus = Math.min(this.lives, 3) * 500;
    this.addScore(timeBonus + lifeBonus);
    const stars = this.lives >= 3 && this.elapsed < 90 ? 3 : this.lives >= 2 ? 2 : 1;
    const marathonState = this.getMarathonState();
    this.emitMarathonState(true);

    this.hooks.onComplete?.({
      element: this.element,
      score: this.score,
      levelScore: this.levelScore,
      stars,
      lives: this.lives,
      time: this.elapsed,
      neutrons: this.levelNeutrons,
      mode: this.mode,
      marathonState,
      challengeResults: this.challengeStates(true),
      challengeMetrics: this.challengeSnapshot(),
      marathonModifier: this.marathonModifier,
    });
  }

  addScore(value) {
    const rounded = Math.round(value);
    const previous = this.score;
    this.score += rounded;
    this.levelScore += rounded;

    if (this.mode !== 'marathon') return;
    while (
      this.marathonNextExtraIndex < this.marathonThresholds.length
      && previous < this.marathonThresholds[this.marathonNextExtraIndex]
      && this.score >= this.marathonThresholds[this.marathonNextExtraIndex]
    ) {
      const threshold = this.marathonThresholds[this.marathonNextExtraIndex];
      this.lives += 1;
      this.marathonNextExtraIndex += 1;
      this.audio.extraLife?.();
      const next = this.marathonThresholds[this.marathonNextExtraIndex];
      this.hooks.onMessage?.(
        next
          ? `Ship added for ${Math.round(threshold / 1000)}k points! Next at ${Math.round(next / 1000)}k points!`
          : `Ship added for ${Math.round(threshold / 1000)}k points! No more ships!`,
      );
      this.emitHUD(true);
    }
  }

  getMarathonState() {
    if (this.mode !== 'marathon') return null;
    return {
      index: this.elementIndex,
      score: this.score,
      lives: this.lives,
      nextExtraIndex: this.marathonNextExtraIndex,
      runTime: this.marathonRunTime,
      runNeutrons: this.marathonRunNeutrons,
      seed: this.marathonSeed,
    };
  }

  emitMarathonState(force = false) {
    if (this.mode !== 'marathon') return;
    this.hooks.onMarathonState?.(this.getMarathonState(), force);
  }

  hitRing(x, y, color) {
    this.pushParticle({ x, y, ttl: .18, type: 'ring', radius: 5, growth: 65, color });
  }

  muzzleFlash() {
    const family = this.loadout.weapon.family || 'blaster';
    const colors = { blaster:'#f3b637', gatling:'#18b7c4', burster:'#ef6b35' };
    const angle = this.ship.angle;
    this.pushParticle({
      x: this.ship.x + Math.cos(angle) * this.ship.r * 1.55,
      y: this.ship.y + Math.sin(angle) * this.ship.r * 1.55,
      ttl: .09,
      type: 'muzzle',
      radius: family === 'burster' ? 16 : 11,
      angle,
      color: colors[family] || '#f3b637',
    });
  }

  shieldHit(x, y) {
    if (this.shieldFxCooldown > 0) return;
    this.shieldFxCooldown = .14;
    this.collectionRing(x, y, '#8f6bd8');
    this.pushParticle({ x, y, ttl: .24, type:'ring', radius:this.ship.r * 1.2, growth:120, color:'#a98cff' });
    this.flashScreen('#8f6bd8', .07);
    this.audio.hit?.();
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.ttl -= dt;
      if (particle.type === 'ring') {
        particle.radius += particle.growth * dt;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
    this.particles = this.particles.filter((particle) => particle.ttl > 0);
  }

  pushParticle(particle) {
    if (this.particles.length >= 520) this.particles.splice(0, 48);
    this.particles.push(particle);
  }

  spark(x, y, type) {
    for (let i = 0; i < 8; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(40, 140);
      this.pushParticle({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ttl: rnd(0.18, 0.45), type });
    }
  }

  collectionRing(x, y, color) {
    this.pushParticle({ x, y, ttl: .42, type: 'ring', radius: 8, growth: 90, color });
  }

  nucleusBurst() {
    this.collectionRing(500, 500, '#ef355d');
    for (let i = 0; i < 54; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(75, 250);
      this.pushParticle({
        x: 500,
        y: 500,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: rnd(.35, .95),
        type: i % 2 ? 'nucleus-red' : 'nucleus-blue',
      });
    }
  }

  burst(x, y) {
    this.collectionRing(x, y, '#ef355d');
    this.pushParticle({ x, y, ttl:.58, type:'ring', radius:14, growth:170, color:'#f3b637' });
    for (let i = 0; i < 30; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(80, 235);
      this.pushParticle({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ttl: rnd(0.35, 0.85), type: 'ship' });
    }
    for (let i = 0; i < 9; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(70, 180);
      this.pushParticle({ x, y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, ttl:rnd(.45,.9), type:'debris', spin:rnd(-7,7), angle, color:i%2?'#f9fcfd':'#ef355d' });
    }
  }

  spawnThruster() {
    if (Math.random() > 0.55) return;
    const ship = this.ship;
    const angle = ship.angle + Math.PI;
    const engineStyle = {
      vrocket:['#f3b637', 2.8], vrocketx:['#ef7e35', 3.1], vrocketdx:['#18aeb5', 3.3],
      qray:['#8f6bd8', 3.6], solar:['#f5d74a', 4.0],
    }[this.loadout.engine.id] || ['#f3b637', 3];
    this.pushParticle({
      x: ship.x + Math.cos(angle) * ship.r,
      y: ship.y + Math.sin(angle) * ship.r,
      vx: Math.cos(angle) * rnd(45, 100) - ship.vx * 0.1,
      vy: Math.sin(angle) * rnd(45, 100) - ship.vy * 0.1,
      ttl: rnd(0.15, 0.3),
      type: 'thrust',
      color: engineStyle[0],
      size: engineStyle[1],
    });
  }

  emitHUD(force = false) {
    const collectionSeconds = this.phase === 'post' ? Math.ceil(this.collectionTimeLeft) : 0;
    const weapon = this.loadout.weapon;
    const activePowerups = Object.entries(this.activePowerups)
      .map(([id, remaining]) => {
        const definition = POWERUPS.find((item) => item.id === id);
        return definition ? { ...definition, remaining: Math.ceil(remaining) } : null;
      })
      .filter(Boolean);

    const hud = {
      mode: this.mode,
      lives: this.lives,
      score: this.score,
      element: this.element,
      phase: this.phase,
      orbiting: this.orbitingRemaining,
      total: this.electrons.length,
      neutronCollected: this.neutronCollected,
      neutronGoal: this.neutronGoal,
      neutronTotal: this.neutronTotal,
      neutronRemaining: this.phase === 'post' ? this.remainingNeutrons() : 0,
      collectionSeconds,
      collectionDuration: this.collectionDuration,
      energy: this.ship.energy,
      energyCapacity: weapon.capacity,
      energyFraction: getWeaponEnergyFraction(this.ship.energy, weapon.capacity),
      activePowerups,
      elementBehavior: this.elementBehavior,
      challenges: this.challengeStates(false),
      marathonModifier: this.marathonModifier,
      marathonNextShip: this.mode === 'marathon' ? this.marathonThresholds[this.marathonNextExtraIndex] || null : null,
    };

    const signature = [
      hud.lives,
      hud.score,
      hud.phase,
      hud.orbiting,
      hud.neutronCollected,
      hud.neutronRemaining,
      hud.collectionSeconds,
      Math.round(hud.energyFraction * 100),
      activePowerups.map((item) => `${item.id}:${item.remaining}`).join(','),
      hud.challenges.map((item) => `${item.id}:${item.state}`).join(','),
      hud.marathonModifier?.id || '',
    ].join('|');

    if (!force && signature === this.lastHudSignature) return;
    this.lastHudSignature = signature;
    this.hooks.onHUD?.(hud);
  }

  draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, 1000, 1000);
    const shake = this.shake ? rnd(-this.shake, this.shake) : 0;
    c.translate(shake, shake);
    this.drawBackground(c);
    this.drawAtom(c);
    this.drawHazards(c);
    this.drawPowerups(c);
    this.drawParticles(c);
    this.drawBullets(c);
    this.drawBeams(c);
    this.drawShip(c);
    c.restore();
    if (this.screenFlash?.alpha > 0) {
      c.save();
      c.globalAlpha = this.screenFlash.alpha;
      c.fillStyle = this.screenFlash.color;
      c.fillRect(0, 0, 1000, 1000);
      c.restore();
    }
  }

  drawBackground(c) { c.drawImage(this.backgroundLayer, 0, 0); }

  drawAtom(c) {
    const distortion = this.elementBehavior.gravityDistortion || 0;
    if (distortion && this.phase !== 'post') {
      for (let i = 0; i < 3; i += 1) {
        const radius = 48 + i * 20 + Math.sin(this.elapsed * 2.2 + i) * 4 * distortion;
        c.beginPath();
        c.arc(500, 500, radius, 0, TAU);
        c.strokeStyle = `rgba(83,106,150,${0.05 + distortion * .07})`;
        c.lineWidth = 5 - i;
        c.stroke();
      }
    }
    for (const radius of this.shellRadii) {
      c.beginPath();
      c.arc(500, 500, radius, 0, TAU);
      c.strokeStyle = this.hasPower('electronstop')
        ? 'rgba(47,141,216,.28)'
        : this.elementBehavior.tags.includes('Stable shell') ? 'rgba(96,112,160,.23)' : 'rgba(96,112,118,.16)';
      c.lineWidth = 14;
      c.stroke();
    }

    for (const electron of this.electrons) {
      if (electron.state === 'gone' || electron.state === 'collected') continue;
      c.save();
      c.translate(electron.x, electron.y);
      const flash = electron.hitFlash || 0;
      c.fillStyle = flash > .1 ? '#ffffff' : (electron.state === 'orbit' ? '#19aab3' : 'rgba(25,170,179,.95)');
      c.shadowBlur = electron.state === 'loose' ? 15 : 7;
      c.shadowColor = '#26b8c0';
      c.beginPath();
      c.arc(0, 0, 10 + flash * 2.5, 0, TAU);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,.8)';
      c.stroke();
      if (this.hasPower('electronstop') && electron.state === 'orbit') {
        c.beginPath();
        c.moveTo(-5, -5); c.lineTo(5, 5);
        c.moveTo(5, -5); c.lineTo(-5, 5);
        c.strokeStyle = '#d8f3ff';
        c.lineWidth = 2;
        c.stroke();
      }
      c.restore();
    }

    if (this.phase !== 'post') {
      const radius = 28 + Math.sqrt(this.element.z) * 2.4;
      const blobs = clamp(Math.round(Math.sqrt(this.element.z) * 2), 4, 20);
      const stage = getNucleusDamageStage({ orbiting:this.orbitingRemaining, total:this.electrons.length, phase:this.phase });
      const stageLevel = stage === 'intact' ? 0 : stage === 'cracked' ? 1 : stage === 'heavily-cracked' ? 2 : 3;
      const instabilityPulse = stageLevel >= 3 ? Math.sin(this.elapsed * 9.2) * .055 : 0;
      const pulse = 1 + instabilityPulse + (this.phase === 'unstable' ? Math.sin(this.explosionTimer * 24) * .045 : 0);
      const seed = this.element.z * .173;

      // Persistent red hazard glow while the unsplit nucleus still occupies the lethal core.
      // This is only a danger/readability cue; the visual damage stages never alter gameplay.
      const warningPulse = .72 + Math.sin(this.elapsed * (4.4 + stageLevel * .55)) * .16;
      const warningGlowRadius = radius + 24 + stageLevel * 3 + Math.sin(this.elapsed * 3.4) * 4;
      const glow = c.createRadialGradient(500, 500, radius * .2, 500, 500, warningGlowRadius);
      glow.addColorStop(0, `rgba(239,53,93,${.12 + warningPulse * .075 + stageLevel * .018})`);
      glow.addColorStop(.52, `rgba(239,53,93,${.08 + warningPulse * .052 + stageLevel * .015})`);
      glow.addColorStop(1, 'rgba(239,53,93,0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(500, 500, warningGlowRadius, 0, TAU);
      c.fill();

      c.beginPath();
      c.arc(500, 500, radius + 11 + Math.sin(this.elapsed * 4.2) * 1.8, 0, TAU);
      c.strokeStyle = `rgba(239,53,93,${.32 + warningPulse * .17 + stageLevel * .045})`;
      c.lineWidth = 4.5 + stageLevel * .35;
      c.stroke();

      // Exposed heat under the shell becomes visible only once the nucleus is seriously fractured.
      if (stageLevel >= 2) {
        const hotRadius = radius * (.72 + stageLevel * .06);
        const hot = c.createRadialGradient(500, 500, radius * .06, 500, 500, hotRadius);
        hot.addColorStop(0, stageLevel >= 3 ? 'rgba(255,247,220,.72)' : 'rgba(255,176,74,.34)');
        hot.addColorStop(.36, stageLevel >= 3 ? 'rgba(255,94,66,.42)' : 'rgba(239,53,93,.18)');
        hot.addColorStop(1, 'rgba(239,53,93,0)');
        c.fillStyle = hot;
        c.beginPath();
        c.arc(500, 500, hotRadius, 0, TAU);
        c.fill();
      }

      // Draw the nucleons as coherent shell plates. Heavy stages separate the plates slightly
      // rather than scribbling arbitrary lines over the surface.
      for (let i = 0; i < blobs; i += 1) {
        const angle = i * 2.399;
        const radial = (i % 4) / 4 * radius * .55;
        const plateGroup = i % 4;
        const separation = stageLevel === 1 ? .65 : stageLevel === 2 ? 2.4 : stageLevel >= 3 ? 4.4 : 0;
        const separationAngle = seed + plateGroup * (TAU / 4) + Math.sin(i * 1.7) * .12;
        const edgeFactor = .42 + radial / Math.max(1, radius);
        const x = 500 + Math.cos(angle) * radial + Math.cos(separationAngle) * separation * edgeFactor;
        const y = 500 + Math.sin(angle) * radial + Math.sin(separationAngle) * separation * edgeFactor;
        const blobRadius = clamp(radius * .28, 9, 16) * pulse;

        c.save();
        c.shadowBlur = stageLevel >= 3 ? 8 : 0;
        c.shadowColor = i % 2 ? 'rgba(239,53,93,.42)' : 'rgba(42,168,216,.38)';
        c.beginPath();
        c.arc(x, y, blobRadius, 0, TAU);
        c.fillStyle = i % 2 ? '#ef355d' : '#2aa8d8';
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = stageLevel >= 2 ? 'rgba(25,40,56,.58)' : 'rgba(255,255,255,.28)';
        c.lineWidth = stageLevel >= 2 ? 1.55 : 1.1;
        c.stroke();

        // Small consistent highlight gives the nucleus the same finished, toy-like surface as the UI art.
        c.beginPath();
        c.arc(x - blobRadius * .28, y - blobRadius * .3, Math.max(1.2, blobRadius * .16), 0, TAU);
        c.fillStyle = 'rgba(255,255,255,.28)';
        c.fill();
        c.restore();
      }

      // Clean fracture seams: curved, clipped, deterministic paths with a dark crevice and a
      // narrow hot inner edge. They remain inside the nucleus and grow with electron removal.
      if (stageLevel >= 1) {
        const crackCount = stageLevel === 1 ? 2 : stageLevel === 2 ? 4 : 6;
        c.save();
        c.beginPath();
        c.arc(500, 500, radius * .94, 0, TAU);
        c.clip();
        c.lineCap = 'round';
        c.lineJoin = 'round';

        for (let i = 0; i < crackCount; i += 1) {
          const angle = seed + i * (TAU / crackCount) + (i % 2 ? .13 : -.09);
          const bend = (i % 2 ? 1 : -1) * (.12 + stageLevel * .025);
          const r0 = radius * (.06 + (i % 3) * .025);
          const r1 = radius * (.34 + stageLevel * .035);
          const r2 = radius * (.62 + stageLevel * .045);
          const r3 = radius * (.78 + stageLevel * .045);
          const p = (rr, aa) => [500 + Math.cos(aa) * rr, 500 + Math.sin(aa) * rr];
          const a = p(r0, angle - bend * .35);
          const b = p(r1, angle + bend);
          const d = p(r2, angle - bend * .7);
          const e = p(r3, angle + bend * .4);

          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.bezierCurveTo(b[0], b[1], d[0], d[1], e[0], e[1]);
          c.strokeStyle = stageLevel >= 3 ? 'rgba(38,20,27,.92)' : 'rgba(29,39,50,.88)';
          c.lineWidth = 4.2 + stageLevel * 1.15;
          c.shadowBlur = stageLevel >= 2 ? 5 + stageLevel * 2 : 0;
          c.shadowColor = 'rgba(255,71,66,.48)';
          c.stroke();
          c.shadowBlur = 0;

          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.bezierCurveTo(b[0], b[1], d[0], d[1], e[0], e[1]);
          c.strokeStyle = stageLevel === 1
            ? 'rgba(255,164,126,.42)'
            : stageLevel === 2
              ? 'rgba(255,108,72,.72)'
              : 'rgba(255,232,194,.9)';
          c.lineWidth = 1.25 + stageLevel * .5;
          c.stroke();

          if (stageLevel >= 2 && i % 2 === 0) {
            const branchStart = p(radius * .48, angle - bend * .2);
            const branchEnd = p(radius * (.64 + stageLevel * .04), angle + bend * 1.7);
            c.beginPath();
            c.moveTo(branchStart[0], branchStart[1]);
            c.quadraticCurveTo(
              500 + Math.cos(angle + bend) * radius * .56,
              500 + Math.sin(angle + bend) * radius * .56,
              branchEnd[0], branchEnd[1],
            );
            c.strokeStyle = 'rgba(34,31,39,.8)';
            c.lineWidth = 2.6 + stageLevel * .45;
            c.stroke();
            c.beginPath();
            c.moveTo(branchStart[0], branchStart[1]);
            c.quadraticCurveTo(
              500 + Math.cos(angle + bend) * radius * .56,
              500 + Math.sin(angle + bend) * radius * .56,
              branchEnd[0], branchEnd[1],
            );
            c.strokeStyle = stageLevel >= 3 ? 'rgba(255,202,163,.74)' : 'rgba(255,105,76,.46)';
            c.lineWidth = 1.05;
            c.stroke();
          }
        }
        c.restore();
      }

      // A few clean shell chips sell the heavily-cracked/unstable stages without visual clutter.
      if (stageLevel >= 2) {
        const chipCount = stageLevel === 2 ? 3 : 5;
        for (let i = 0; i < chipCount; i += 1) {
          const angle = seed * .7 + i * (TAU / chipCount) + .22;
          const rr = radius + 6 + stageLevel * 2 + (i % 2) * 3;
          const x = 500 + Math.cos(angle) * rr;
          const y = 500 + Math.sin(angle) * rr;
          const tangent = angle + Math.PI / 2;
          const size = 3.2 + stageLevel * .8 + (i % 2);
          c.beginPath();
          c.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
          c.lineTo(x + Math.cos(tangent) * size * .7, y + Math.sin(tangent) * size * .7);
          c.lineTo(x - Math.cos(tangent) * size * .55, y - Math.sin(tangent) * size * .55);
          c.closePath();
          c.fillStyle = i % 2 ? '#ef355d' : '#2aa8d8';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,.55)';
          c.lineWidth = 1;
          c.stroke();
        }
      }

      c.beginPath();
      c.arc(500, 500, (radius + 5) * pulse, 0, TAU);
      c.strokeStyle = stageLevel >= 3 ? 'rgba(255,126,126,.96)' : 'rgba(255,255,255,.72)';
      c.lineWidth = 3 + stageLevel * .4;
      c.stroke();

      if (stageLevel >= 3) {
        const duration = Math.max(.01, this.unstableDuration || 1.25);
        const progress = this.phase === 'unstable' ? clamp(1 - this.explosionTimer / duration, 0, 1) : .28;
        const coreRadius = radius * (.18 + progress * .09);
        c.save();
        c.shadowBlur = 15 + progress * 18;
        c.shadowColor = 'rgba(255,78,65,.88)';
        c.beginPath();
        c.arc(500, 500, coreRadius, 0, TAU);
        c.fillStyle = `rgba(255,242,214,${.45 + progress * .45})`;
        c.fill();
        c.restore();
      }
    }

    for (const particle of this.nuclear) {
      c.beginPath();
      c.arc(particle.x, particle.y, particle.r, 0, TAU);
      c.fillStyle = particle.type === 'neutron' ? '#2aa8d8' : '#ef355d';
      c.shadowBlur = 9;
      c.shadowColor = c.fillStyle;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,.65)';
      c.stroke();
      c.shadowBlur = 0;
    }
  }

  drawHazards(c) {
    for (const proton of this.hazards) {
      c.save();
      c.shadowBlur = 12;
      c.shadowColor = '#ef355d';
      c.fillStyle = '#ef355d';
      c.beginPath();
      c.arc(proton.x, proton.y, proton.r, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.75)';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }
  }

  drawPowerups(c) {
    for (const pickup of this.powerups) {
      const definition = POWERUPS.find((item) => item.id === pickup.type);
      if (!definition) continue;
      const scale = 1 + Math.sin(pickup.pulse) * .08;
      c.save();
      c.translate(pickup.x, pickup.y);
      c.scale(scale, scale);
      c.fillStyle = definition.color;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-17, -17, 34, 34, 9);
      else c.rect(-17, -17, 34, 34);
      c.fill();
      c.stroke();
      c.fillStyle = '#ffffff';
      c.font = '900 18px system-ui,sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(definition.symbol, 0, 1);
      c.restore();
    }
  }

  drawBullets(c) {
    c.lineCap = 'round';
    for (const bullet of this.bullets) {
      c.beginPath();
      c.moveTo(bullet.px ?? bullet.x, bullet.py ?? bullet.y);
      c.lineTo(bullet.x, bullet.y);
      const rail = bullet.kind === 'rail';
      const homing = bullet.kind === 'homing';
      const trail = rail ? 'rgba(255,255,255,.72)' : homing ? 'rgba(143,107,216,.55)' : (this.hasPower('bigfire') ? 'rgba(239,107,53,.5)' : 'rgba(243,182,55,.35)');
      const fill = rail ? '#f8fcff' : homing ? '#8f6bd8' : (this.hasPower('bigfire') ? '#ef6b35' : '#f3b637');
      c.strokeStyle = trail;
      c.lineWidth = rail ? 3 : Math.max(2, bullet.r * .8);
      c.stroke();
      c.beginPath();
      c.arc(bullet.x, bullet.y, bullet.r, 0, TAU);
      c.fillStyle = fill;
      c.shadowBlur = rail ? 12 : homing ? 8 : 0;
      c.shadowColor = fill;
      c.fill();
      c.shadowBlur = 0;
    }
  }

  drawBeams(c) {
    for (const beam of this.beams) {
      c.save();
      c.globalAlpha = clamp(beam.ttl * 10, 0, 1);
      c.strokeStyle = beam.color;
      c.shadowColor = beam.color;
      c.shadowBlur = 12;
      c.lineWidth = beam.width;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(beam.x1, beam.y1);
      c.lineTo(beam.x2, beam.y2);
      c.stroke();
      c.restore();
    }
  }

  traceShipHull(c, shipId, r) {
    c.beginPath();
    switch (shipId) {
      case 'nano':
        c.moveTo(0, -r * 1.5); c.lineTo(r * .72, r * .2); c.lineTo(r * .98, r); c.lineTo(0, r * .58); c.lineTo(-r * .98, r); c.lineTo(-r * .72, r * .2); break;
      case 'falcon':
        c.moveTo(0, -r * 1.55); c.lineTo(r * 1.18, r * .9); c.lineTo(r * .38, r * .62); c.lineTo(0, r * .85); c.lineTo(-r * .38, r * .62); c.lineTo(-r * 1.18, r * .9); break;
      case 'behemoth':
        c.moveTo(0, -r * 1.34); c.lineTo(r * 1.05, -r * .25); c.lineTo(r * 1.15, r * .95); c.lineTo(r * .45, r * 1.2); c.lineTo(0, r * .78); c.lineTo(-r * .45, r * 1.2); c.lineTo(-r * 1.15, r * .95); c.lineTo(-r * 1.05, -r * .25); break;
      case 'hawk':
        c.moveTo(0, -r * 1.55); c.lineTo(r * .62, -r * .08); c.lineTo(r * 1.3, r * .58); c.lineTo(r * .45, r * .55); c.lineTo(0, r); c.lineTo(-r * .45, r * .55); c.lineTo(-r * 1.3, r * .58); c.lineTo(-r * .62, -r * .08); break;
      case 'nano2':
        c.moveTo(0, -r * 1.62); c.lineTo(r * .72, -r * .2); c.lineTo(r * 1.08, r * .95); c.lineTo(r * .28, r * .62); c.lineTo(0, r * .92); c.lineTo(-r * .28, r * .62); c.lineTo(-r * 1.08, r * .95); c.lineTo(-r * .72, -r * .2); break;
      case 'quark':
        c.moveTo(0, -r * 1.62); c.lineTo(r * .48, -r * .42); c.lineTo(r * 1.18, r * .38); c.lineTo(r * .46, r * .92); c.lineTo(0, r * .66); c.lineTo(-r * .46, r * .92); c.lineTo(-r * 1.18, r * .38); c.lineTo(-r * .48, -r * .42); break;
      default:
        c.moveTo(0, -r * 1.45); c.lineTo(r * .9, r * 1.05); c.lineTo(0, r * .55); c.lineTo(-r * .9, r * 1.05); break;
    }
    c.closePath();
  }

  drawShipTexture(c, ship, r, paint) {
    c.save();
    this.traceShipHull(c, ship.id, r);
    c.clip();
    c.fillStyle = paint?.body || '#f9fcfd';
    c.fillRect(-r * 1.5, -r * 1.8, r * 3, r * 3.2);
    c.fillStyle = paint?.accent || '#ef355d';
    c.beginPath(); c.moveTo(0, -r * .75); c.lineTo(r * .32, r * .35); c.lineTo(-r * .32, r * .35); c.closePath(); c.fill();
    if (paint?.dynamic === 'prism') {
      const hue = (this.element.z * 19 + this.elapsed * 24) % 360;
      c.globalAlpha = .28;
      c.fillStyle = `hsl(${hue} 78% 58%)`;
      c.fillRect(-r * 1.5, -r * 1.8, r * 3, r * 3.2);
    }
    c.restore();
  }

  drawShip(c) {
    const shipState = this.ship;
    if (shipState.invuln > 0 && Math.floor(shipState.invuln * 12) % 2 === 0) return;
    const ship = this.loadout.ship;
    const r = shipState.r;
    const sprite = this.shipSprites.get(ship.id);
    const paint = findById(PAINTS, this.save?.selectedPaint || 'standard');
    const dynamicTint = paint?.dynamic === 'prism'
      ? `hsl(${(this.element.z * 19 + this.elapsed * 24) % 360} 78% 58%)`
      : paint?.tint;

    c.save();
    c.translate(shipState.x, shipState.y);
    c.rotate(shipState.angle + Math.PI / 2);
    if (this.hasPower('ghost')) c.globalAlpha = .48;
    if (paint?.glow) {
      c.shadowColor = paint.glow;
      c.shadowBlur = paint.id === 'radioactive-glow' ? 22 : 12;
    }

    if (sprite?.complete && sprite.naturalWidth) {
      const size = r * 3.2;
      c.drawImage(sprite, -size / 2, -size / 2, size, size);
      if (dynamicTint && Number(paint.tintAlpha || 0) > 0) {
        c.save();
        c.globalCompositeOperation = 'source-atop';
        c.globalAlpha = Number(paint.tintAlpha || .18);
        c.fillStyle = dynamicTint;
        c.fillRect(-size / 2, -size / 2, size, size);
        c.restore();
      }
      this.traceShipHull(c, ship.id, r);
      c.strokeStyle = paint?.outline || '#2e9ea7';
      c.lineWidth = Math.max(2, r * .16);
      c.stroke();
    } else {
      this.drawShipTexture(c, ship, r, paint);
      this.traceShipHull(c, ship.id, r);
      c.strokeStyle = paint?.outline || '#2e9ea7';
      c.lineWidth = Math.max(3, r * .25);
      c.lineJoin = 'round';
      c.stroke();
    }

    if (paint?.id === 'radioactive-glow') {
      c.beginPath(); c.arc(0, 0, r * 1.55, 0, TAU); c.strokeStyle = 'rgba(156,232,81,.45)'; c.lineWidth = 2; c.stroke();
    }
    if (this.hasPower('collect')) {
      c.beginPath(); c.arc(0, 0, r * 2.2, 0, TAU); c.strokeStyle = 'rgba(32,169,159,.55)'; c.lineWidth = 2; c.stroke();
    }
    c.restore();
  }

  drawParticles(c) {
    for (const particle of this.particles) {
      if (particle.type === 'ring') {
        c.globalAlpha = clamp(particle.ttl * 2.5, 0, 1);
        c.beginPath();
        c.arc(particle.x, particle.y, particle.radius, 0, TAU);
        c.strokeStyle = particle.color || '#ffffff';
        c.lineWidth = 3;
        c.stroke();
        continue;
      }
      if (particle.type === 'muzzle') {
        c.globalAlpha = clamp(particle.ttl * 12, 0, 1);
        c.save();
        c.translate(particle.x, particle.y);
        c.rotate(particle.angle || 0);
        c.fillStyle = particle.color || '#f3b637';
        c.beginPath();
        c.moveTo(particle.radius, 0);
        c.lineTo(-particle.radius * .55, particle.radius * .5);
        c.lineTo(-particle.radius * .55, -particle.radius * .5);
        c.closePath();
        c.fill();
        c.restore();
        continue;
      }
      if (particle.type === 'debris') {
        c.globalAlpha = clamp(particle.ttl * 1.7, 0, 1);
        c.save();
        c.translate(particle.x, particle.y);
        c.rotate((particle.angle || 0) + (particle.spin || 0) * particle.ttl);
        c.fillStyle = particle.color || '#ffffff';
        c.fillRect(-4, -2, 8, 4);
        c.restore();
        continue;
      }
      c.globalAlpha = clamp(particle.ttl * 2, 0, 1);
      c.fillStyle = particle.color || (particle.type === 'electron'
        ? '#18aeb5'
        : particle.type === 'ship' || particle.type === 'nucleus-red'
          ? '#ef355d'
          : particle.type === 'nucleus-blue'
            ? '#2aa8d8'
            : '#f4b23e');
      c.beginPath();
      const particleRadius = particle.type === 'ship' ? 4.5 : particle.type === 'thrust' ? (particle.size || 3) : 2.8;
      c.arc(particle.x, particle.y, particleRadius, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}
