import {
  ELEMENTS,
  SHIPS,
  WEAPONS,
  ENGINES,
  MODULES,
  POWERUPS,
  getElectronShellCounts,
  getMarathonThresholds,
  findById,
} from './data.js';

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
    this.loadout = this.getLoadout(save);

    const marathon = mode === 'marathon' ? (marathonState || {}) : {};
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
    this.nuclear = [];
    this.powerups = [];
    this.activePowerups = Object.create(null);
    this.powerupSpawnClock = rnd(16, 24);
    this.particles = [];
    this.shake = 0;
    this.messageTimer = 0;
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
  }

  initShip() {
    const { ship, engine, stat, weapon } = this.loadout;
    this.ship = {
      x: 500,
      y: 115,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      r: 13 * stat.shipSize,
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
    const speedScale = this.loadout.stat.electronSpeed;

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
          hp: 1,
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
    if (!canFireWeapon({
      activeBullets: this.bullets.length,
      volleySize: weapon.bullets,
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
    ship.cooldown = 1 / weapon.rate;
    const center = (weapon.bullets - 1) / 2;
    const speed = weapon.speed * this.loadout.stat.bulletSpeed;
    const bigFire = this.hasPower('bigfire');
    const bulletSize = weapon.size * this.loadout.stat.bulletSize * (bigFire ? 1.7 : 1);
    const damage = weapon.damage + (bigFire ? 0.5 : 0);

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
      });
    }
    this.audio.shoot();
    return true;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.mode === 'marathon') this.marathonRunTime += dt;
    this.input(dt);

    const ship = this.ship;
    const weapon = this.loadout.weapon;
    ship.cooldown = Math.max(0, ship.cooldown - dt);
    ship.invuln = Math.max(0, ship.invuln - dt);
    this.emptySoundCooldown = Math.max(0, this.emptySoundCooldown - dt);
    ship.energy = Math.min(weapon.capacity, ship.energy + weapon.regen * dt);

    this.updatePowerups(dt);
    this.updatePhysics(dt);
    if (!this.running) return;
    this.updateElectronPositions(dt);
    this.updateBullets(dt);
    this.updateNuclear(dt);
    if (!this.running) return;
    this.updateParticles(dt);

    if (this.phase === 'electrons' && this.orbitingRemaining === 0) {
      this.phase = 'unstable';
      this.explosionTimer = 1.25;
      this.hooks.onObjective?.('The nucleus is unstable…');
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
      const base = (18 + this.element.z * 0.72) * this.loadout.stat.gravity;
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

    const nucleusRadius = 28 + Math.sqrt(this.element.z) * 2.4;
    if (this.phase !== 'post' && distance < nucleusRadius + ship.r) this.damageShip('nucleus');
  }

  updateElectronPositions(dt) {
    const ship = this.ship;
    const frozen = this.hasPower('electronstop');
    const timeScale = this.loadout.stat.time;
    const pickupBoost = this.hasPower('collect') ? 2.2 : 1;

    for (const electron of this.electrons) {
      electron.hitFlash = Math.max(0, (electron.hitFlash || 0) - dt * 5);
      if (electron.state === 'orbit') {
        if (!frozen) electron.angle += electron.speed * dt * timeScale;
        electron.x = 500 + Math.cos(electron.angle) * electron.radius;
        electron.y = 500 + Math.sin(electron.angle) * electron.radius;
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
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.ttl <= 0) continue;

      for (const electron of this.electrons) {
        if (electron.state !== 'orbit') continue;
        const radius = bullet.r + 10;
        if (dist2(bullet, electron) >= radius * radius) continue;

        electron.hp -= bullet.damage;
        electron.hitFlash = 1;
        bullet.pierce -= 1;
        if (bullet.pierce <= 0) bullet.ttl = 0;
        this.audio.hit();
        this.spark(electron.x, electron.y, 'electron');

        if (electron.hp <= 0) {
          electron.state = 'loose';
          this.orbitingRemaining = Math.max(0, this.orbitingRemaining - 1);
          const angle = electron.angle;
          electron.vx = Math.cos(angle) * rnd(55, 100);
          electron.vy = Math.sin(angle) * rnd(55, 100);
          electron.ttl = 8;
          this.addScore(40);
          if (!this.tutorial && Math.random() < 0.08) this.spawnPowerupAt(electron.x, electron.y);
        }

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
    this.shake = 12;
    this.nucleusBurst();

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
    this.hooks.onObjective?.(
      `Collect all ${this.neutronTotal} blue neutron${this.neutronTotal === 1 ? '' : 's'} or survive ${this.collectionDuration}s`,
    );
    this.emitHUD(true);
  }

  updateNuclear(dt) {
    if (this.phase !== 'post') return;
    const ship = this.ship;
    const motionScale = this.loadout.stat.time;
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
        this.save.neutrons += 1;
        this.addScore(250);
        this.audio.collect();
        this.collectionRing(particle.x, particle.y, '#2aa8d8');
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
      } else if (!this.hasPower('ghost')) {
        particle.dead = true;
        this.damageShip('proton');
      }
    }

    this.nuclear = this.nuclear.filter((particle) => !particle.dead && particle.ttl > 0);
  }

  remainingNeutrons() { return Math.max(0, this.neutronTotal - this.neutronCollected); }

  hasPower(id) { return Number(this.activePowerups?.[id] || 0) > 0; }

  updatePowerups(dt) {
    for (const [id, remaining] of Object.entries(this.activePowerups)) {
      const next = remaining - dt;
      if (next <= 0) delete this.activePowerups[id];
      else this.activePowerups[id] = next;
    }

    if (!this.tutorial && this.phase === 'electrons') {
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
    if (this.powerups.length >= 2) return;
    const definition = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
    this.powerups.push({ x, y, type: definition.id, ttl: 12, pulse: rnd(0, TAU) });
  }

  activatePowerup(id, x, y) {
    const definition = POWERUPS.find((item) => item.id === id);
    if (!definition) return;
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

  damageShip(reason) {
    const ship = this.ship;
    if (ship.invuln > 0 || !this.running || this.hasPower('ghost')) return;

    this.lives -= 1;
    this.audio.proton();
    this.shake = 8;
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
    };
  }

  emitMarathonState(force = false) {
    if (this.mode !== 'marathon') return;
    this.hooks.onMarathonState?.(this.getMarathonState(), force);
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
    for (let i = 0; i < 30; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(80, 235);
      this.pushParticle({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ttl: rnd(0.35, 0.85), type: 'ship' });
    }
  }

  spawnThruster() {
    if (Math.random() > 0.55) return;
    const ship = this.ship;
    const angle = ship.angle + Math.PI;
    this.pushParticle({
      x: ship.x + Math.cos(angle) * ship.r,
      y: ship.y + Math.sin(angle) * ship.r,
      vx: Math.cos(angle) * rnd(45, 100) - ship.vx * 0.1,
      vy: Math.sin(angle) * rnd(45, 100) - ship.vy * 0.1,
      ttl: rnd(0.15, 0.3),
      type: 'thrust',
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
    this.drawPowerups(c);
    this.drawParticles(c);
    this.drawBullets(c);
    this.drawShip(c);
    c.restore();
  }

  drawBackground(c) { c.drawImage(this.backgroundLayer, 0, 0); }

  drawAtom(c) {
    for (const radius of this.shellRadii) {
      c.beginPath();
      c.arc(500, 500, radius, 0, TAU);
      c.strokeStyle = this.hasPower('electronstop') ? 'rgba(47,141,216,.28)' : 'rgba(96,112,118,.16)';
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
      const pulse = this.phase === 'unstable' ? (1 + Math.sin(this.explosionTimer * 26) * .08) : 1;

      for (let i = 0; i < blobs; i += 1) {
        const angle = i * 2.399;
        const radial = (i % 4) / 4 * radius * 0.55;
        const x = 500 + Math.cos(angle) * radial;
        const y = 500 + Math.sin(angle) * radial;
        c.beginPath();
        c.arc(x, y, clamp(radius * 0.28, 9, 16) * pulse, 0, TAU);
        c.fillStyle = i % 2 ? '#ef355d' : '#2aa8d8';
        c.fill();
      }

      c.beginPath();
      c.arc(500, 500, (radius + 5) * pulse, 0, TAU);
      c.strokeStyle = this.phase === 'unstable' ? 'rgba(239,53,93,.9)' : 'rgba(255,255,255,.7)';
      c.lineWidth = 3;
      c.stroke();
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
      c.strokeStyle = this.hasPower('bigfire') ? 'rgba(239,107,53,.5)' : 'rgba(243,182,55,.35)';
      c.lineWidth = Math.max(2, bullet.r * .8);
      c.stroke();
      c.beginPath();
      c.arc(bullet.x, bullet.y, bullet.r, 0, TAU);
      c.fillStyle = this.hasPower('bigfire') ? '#ef6b35' : '#f3b637';
      c.fill();
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
      default:
        c.moveTo(0, -r * 1.45); c.lineTo(r * .9, r * 1.05); c.lineTo(0, r * .55); c.lineTo(-r * .9, r * 1.05); break;
    }
    c.closePath();
  }

  drawShipTexture(c, ship, r) {
    c.save();
    this.traceShipHull(c, ship.id, r);
    c.clip();
    c.fillStyle = '#f9fcfd';
    c.fillRect(-r * 1.5, -r * 1.8, r * 3, r * 3.2);
    c.fillStyle = '#ef355d';
    c.beginPath(); c.moveTo(0, -r * .75); c.lineTo(r * .32, r * .35); c.lineTo(-r * .32, r * .35); c.closePath(); c.fill();
    c.restore();
  }

  drawShip(c) {
    const shipState = this.ship;
    if (shipState.invuln > 0 && Math.floor(shipState.invuln * 12) % 2 === 0) return;
    const ship = this.loadout.ship;
    const r = shipState.r;
    const sprite = this.shipSprites.get(ship.id);

    c.save();
    c.translate(shipState.x, shipState.y);
    c.rotate(shipState.angle + Math.PI / 2);
    if (this.hasPower('ghost')) c.globalAlpha = .48;

    if (sprite?.complete && sprite.naturalWidth) {
      const size = r * 3.2;
      c.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      this.drawShipTexture(c, ship, r);
      this.traceShipHull(c, ship.id, r);
      c.strokeStyle = '#2e9ea7';
      c.lineWidth = Math.max(3, r * .25);
      c.lineJoin = 'round';
      c.stroke();
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
      c.globalAlpha = clamp(particle.ttl * 2, 0, 1);
      c.fillStyle = particle.type === 'electron'
        ? '#18aeb5'
        : particle.type === 'ship' || particle.type === 'nucleus-red'
          ? '#ef355d'
          : particle.type === 'nucleus-blue'
            ? '#2aa8d8'
            : '#f4b23e';
      c.beginPath();
      c.arc(particle.x, particle.y, particle.type === 'ship' ? 4.5 : 2.8, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}
