import {
  ELEMENTS,
  SHIPS,
  WEAPONS,
  ENGINES,
  MODULES,
  getElectronShellCounts,
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
  // The first ten elements get a full minute. Difficulty then ramps smoothly
  // toward a 20 second minimum at element 118.
  if (atomicNumber <= 10) return 60;
  const progress = clamp((atomicNumber - 10) / 108, 0, 1);
  return Math.round(60 - 40 * Math.pow(progress, 0.82));
}

export function getCollectionResolution({ timeLeft, collected, goal }) {
  // The post-split timer is the actual phase duration. Reaching the minimum
  // quota (or even collecting every neutron) never shortens that duration.
  // Once the clock reaches zero, meeting the quota wins; otherwise it fails.
  if (timeLeft <= 0) return collected >= goal ? 'complete' : 'fail';
  return null;
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
    this.fireHeld = false;
    this.pointerAim = null;
    this.raf = 0;
    this.lastHudSignature = '';
    this.orbitingRemaining = 0;
    this.shellRadii = [];
    this.backgroundLayer = this.buildBackgroundLayer();
    this.bindDesktop();
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
      ) {
        event.preventDefault();
      }
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
      .filter(Boolean);

    const stat = {
      pickup: ship.pickup,
      gravity: ship.gravity,
      rate: 1,
      bulletSpeed: 1,
      shipSize: ship.size,
      electronSpeed: 1,
      time: 1,
    };

    for (const module of mods) {
      if (module.effect === 'pickup') stat.pickup *= module.value;
      if (module.effect === 'gravity') stat.gravity *= module.value;
      if (module.effect === 'rate') stat.rate *= module.value;
      if (module.effect === 'bulletSpeed') stat.bulletSpeed *= module.value;
      if (module.effect === 'shipSize') stat.shipSize *= module.value;
      if (module.effect === 'electronSpeed') stat.electronSpeed *= module.value;
      if (module.effect === 'time') stat.time *= module.value;
    }

    return { ship, weapon, engine, stat };
  }

  start({ elementIndex = 0, mode = 'classic', save, tutorial = false, marathonScore = 0 }) {
    this.mode = mode;
    this.save = save;
    this.tutorial = tutorial;
    this.elementIndex = clamp(elementIndex, 0, ELEMENTS.length - 1);
    this.element = ELEMENTS[this.elementIndex];
    this.loadout = this.getLoadout(save);
    this.score = marathonScore || 0;
    this.levelScore = 0;
    this.lives = 3;
    this.elapsed = 0;
    this.phase = 'electrons';
    this.explosionTimer = 0;
    this.collectionDuration = getCollectionWindow(this.element.z);
    this.collectionTimeLeft = this.collectionDuration;
    this.neutronCollected = 0;
    this.neutronGoal = Math.max(1, Math.ceil(this.element.z / 12));
    this.bullets = [];
    this.nuclear = [];
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
  }

  initShip() {
    const { ship, engine, stat } = this.loadout;
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
        });
      }
    }

    this.orbitingRemaining = this.electrons.length;
    this.updateElectronPositions(0);
  }

  setJoystick(x, y, mag) {
    this.joy = { x, y, mag };
  }

  setFire(value) {
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
  }

  loop(time) {
    if (!this.running || this.paused) return;
    const dt = Math.min(0.033, (time - this.last) / 1000 || 0.016);
    this.last = time;
    this.update(dt);
    this.draw();
    if (this.running && !this.paused) this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  input(dt) {
    const ship = this.ship;
    let aim = null;
    let thrust = 0;

    if (this.joy.mag > 0.08) {
      aim = Math.atan2(this.joy.y, this.joy.x);
      thrust = this.joy.mag > Number(this.save.settings.deadzone || 0.38) ? this.joy.mag : 0;
    } else {
      let turn = 0;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) turn -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) turn += 1;
      ship.angle += turn * 2.65 * dt;

      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) thrust = 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) thrust = -0.38;

      if (this.pointerAim) {
        const dx = this.pointerAim.x - ship.x;
        const dy = this.pointerAim.y - ship.y;
        if (this.fireHeld && !turn) aim = Math.atan2(dy, dx);
      }
    }

    if (aim !== null) {
      const delta = ((aim - ship.angle + Math.PI * 3) % TAU) - Math.PI;
      ship.angle += clamp(delta, -3.4 * dt, 3.4 * dt);
    }

    if (thrust) {
      ship.vx += Math.cos(ship.angle) * ship.thrust * thrust / ship.mass * dt;
      ship.vy += Math.sin(ship.angle) * ship.thrust * thrust / ship.mass * dt;
      this.spawnThruster();
    }

    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > ship.max) {
      ship.vx *= ship.max / speed;
      ship.vy *= ship.max / speed;
    }

    if (this.fireHeld || this.keys.has('Space')) this.fire();
  }

  fire() {
    const ship = this.ship;
    const weapon = this.loadout.weapon;
    const rate = weapon.rate * this.loadout.stat.rate;
    if (ship.cooldown > 0) return;

    ship.cooldown = 1 / rate;
    const center = (weapon.bullets - 1) / 2;
    const speed = weapon.speed * this.loadout.stat.bulletSpeed;

    for (let i = 0; i < weapon.bullets; i += 1) {
      const angle = ship.angle + (i - center) * weapon.spread;
      this.bullets.push({
        x: ship.x + Math.cos(angle) * ship.r * 1.4,
        y: ship.y + Math.sin(angle) * ship.r * 1.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: weapon.life,
        r: weapon.size,
        damage: weapon.damage,
      });
    }
    this.audio.shoot();
  }

  update(dt) {
    this.elapsed += dt;
    this.input(dt);

    const ship = this.ship;
    ship.cooldown = Math.max(0, ship.cooldown - dt);
    ship.invuln = Math.max(0, ship.invuln - dt);

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
        goal: this.neutronGoal,
      });
      if (resolution === 'complete') {
        this.completeLevel();
        return;
      }
      if (resolution === 'fail') {
        this.failCollectionWindow();
        return;
      }
    }

    if (this.messageTimer > 0) this.messageTimer -= dt;
    this.shake = Math.max(0, this.shake - dt * 22);
    this.emitHUD();
  }

  updatePhysics(dt) {
    const ship = this.ship;
    const dx = 500 - ship.x;
    const dy = 500 - ship.y;
    const distance = Math.max(50, Math.hypot(dx, dy));

    if (this.element.z >= 4 && this.phase !== 'post') {
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
    for (const electron of this.electrons) {
      if (electron.state === 'orbit') {
        electron.angle += electron.speed * dt;
        electron.x = 500 + Math.cos(electron.angle) * electron.radius;
        electron.y = 500 + Math.sin(electron.angle) * electron.radius;
        continue;
      }

      if (electron.state !== 'loose') continue;
      electron.ttl -= dt;
      electron.x += electron.vx * dt;
      electron.y += electron.vy * dt;

      const nucleusDistance = Math.hypot(electron.x - 500, electron.y - 500);
      if (nucleusDistance > 430 || electron.ttl <= 0) electron.state = 'gone';

      const pickup = 22 * this.loadout.stat.pickup + ship.r;
      if (electron.state === 'loose' && dist2(electron, ship) < pickup * pickup) {
        electron.state = 'collected';
        this.save.electrons += 1;
        this.addScore(100);
        this.audio.collect();
        this.hooks.onCurrency?.();
      }
    }
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.ttl -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.ttl <= 0) continue;

      for (const electron of this.electrons) {
        if (electron.state !== 'orbit') continue;
        const radius = bullet.r + 10;
        if (dist2(bullet, electron) >= radius * radius) continue;

        electron.hp -= bullet.damage;
        bullet.ttl = 0;
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
        }
        break;
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

    this.hooks.onObjective?.(
      `Collect ${this.neutronGoal} neutron${this.neutronGoal === 1 ? '' : 's'} — ${this.collectionDuration}s`,
    );
    this.emitHUD(true);
  }

  updateNuclear(dt) {
    if (this.phase !== 'post') return;
    const ship = this.ship;
    const motionScale = this.loadout.stat.time;

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

      const pickup = (particle.type === 'neutron' ? 22 * this.loadout.stat.pickup : 0)
        + ship.r
        + particle.r;

      if (dist2(particle, ship) >= pickup * pickup) continue;
      particle.dead = true;

      if (particle.type === 'neutron') {
        this.neutronCollected += 1;
        this.save.neutrons += 1;
        this.addScore(250);
        this.audio.collect();
        this.hooks.onCurrency?.();
        if (this.neutronCollected === this.neutronGoal) {
          this.hooks.onObjective?.('Quota reached — keep collecting bonus neutrons!');
        }
      } else {
        this.damageShip('proton');
      }
    }

    this.nuclear = this.nuclear.filter((particle) => !particle.dead && particle.ttl > 0);
  }

  remainingNeutrons() {
    let remaining = 0;
    for (const particle of this.nuclear) {
      if (!particle.dead && particle.ttl > 0 && particle.type === 'neutron') remaining += 1;
    }
    return remaining;
  }

  failCollectionWindow() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.hooks.onGameOver?.({
      score: this.score,
      reason: 'collection-timeout',
      element: this.element,
    });
  }

  damageShip(reason) {
    const ship = this.ship;
    if (ship.invuln > 0 || !this.running) return;

    this.lives -= 1;
    this.audio.proton();
    this.shake = 8;
    this.burst(ship.x, ship.y);

    if (this.lives <= 0) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.hooks.onGameOver?.({ score: this.score, reason, element: this.element });
      return;
    }

    this.initShip();
    this.emitHUD(true);
    this.hooks.onLifeLost?.(this.lives);
  }

  completeLevel() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.audio.complete();

    const timeBonus = Math.max(0, Math.round(2500 - this.elapsed * 20));
    const lifeBonus = this.lives * 500;
    this.addScore(timeBonus + lifeBonus);
    const stars = this.lives === 3 && this.elapsed < 90 ? 3 : this.lives >= 2 ? 2 : 1;

    this.hooks.onComplete?.({
      element: this.element,
      score: this.score,
      levelScore: this.levelScore,
      stars,
      lives: this.lives,
      time: this.elapsed,
      mode: this.mode,
    });
  }

  addScore(value) {
    const rounded = Math.round(value);
    this.score += rounded;
    this.levelScore += rounded;
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.ttl -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
    this.particles = this.particles.filter((particle) => particle.ttl > 0);
  }

  pushParticle(particle) {
    // Keeps long sessions from accumulating pathological particle counts.
    if (this.particles.length >= 480) this.particles.splice(0, 40);
    this.particles.push(particle);
  }

  spark(x, y, type) {
    for (let i = 0; i < 7; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(40, 130);
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: rnd(0.18, 0.45),
        type,
      });
    }
  }

  burst(x, y) {
    for (let i = 0; i < 22; i += 1) {
      const angle = rnd(0, TAU);
      const speed = rnd(80, 220);
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: rnd(0.35, 0.8),
        type: 'ship',
      });
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
    const hud = {
      lives: this.lives,
      score: this.score,
      element: this.element,
      phase: this.phase,
      orbiting: this.orbitingRemaining,
      total: this.electrons.length,
      neutronCollected: this.neutronCollected,
      neutronGoal: this.neutronGoal,
      neutronRemaining: this.phase === 'post' ? this.remainingNeutrons() : 0,
      collectionSeconds,
      collectionDuration: this.collectionDuration,
    };

    const signature = [
      hud.lives,
      hud.score,
      hud.phase,
      hud.orbiting,
      hud.neutronCollected,
      hud.neutronRemaining,
      hud.collectionSeconds,
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
    this.drawParticles(c);
    this.drawBullets(c);
    this.drawShip(c);
    c.restore();
  }

  drawBackground(c) {
    c.drawImage(this.backgroundLayer, 0, 0);
  }

  drawAtom(c) {
    for (const radius of this.shellRadii) {
      c.beginPath();
      c.arc(500, 500, radius, 0, TAU);
      c.strokeStyle = 'rgba(96,112,118,.16)';
      c.lineWidth = 14;
      c.stroke();
    }

    for (const electron of this.electrons) {
      if (electron.state === 'gone' || electron.state === 'collected') continue;
      c.save();
      c.translate(electron.x, electron.y);
      c.fillStyle = electron.state === 'orbit' ? '#19aab3' : 'rgba(25,170,179,.95)';
      c.shadowBlur = electron.state === 'loose' ? 15 : 7;
      c.shadowColor = '#26b8c0';
      c.beginPath();
      c.arc(0, 0, 10, 0, TAU);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,.8)';
      c.stroke();
      c.restore();
    }

    if (this.phase !== 'post') {
      const radius = 28 + Math.sqrt(this.element.z) * 2.4;
      const blobs = clamp(Math.round(Math.sqrt(this.element.z) * 2), 4, 20);

      for (let i = 0; i < blobs; i += 1) {
        const angle = i * 2.399;
        const radial = (i % 4) / 4 * radius * 0.55;
        const x = 500 + Math.cos(angle) * radial;
        const y = 500 + Math.sin(angle) * radial;
        c.beginPath();
        c.arc(x, y, clamp(radius * 0.28, 9, 16), 0, TAU);
        c.fillStyle = i % 2 ? '#ef355d' : '#2aa8d8';
        c.fill();
      }

      c.beginPath();
      c.arc(500, 500, radius + 5, 0, TAU);
      c.strokeStyle = 'rgba(255,255,255,.7)';
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
      c.shadowBlur = 0;
    }
  }

  drawBullets(c) {
    c.fillStyle = '#f3b637';
    for (const bullet of this.bullets) {
      c.beginPath();
      c.arc(bullet.x, bullet.y, bullet.r, 0, TAU);
      c.fill();
    }
  }

  traceShipHull(c, shipId, r) {
    c.beginPath();
    switch (shipId) {
      case 'nano':
        c.moveTo(0, -r * 1.5);
        c.lineTo(r * 0.72, r * 0.2);
        c.lineTo(r * 0.98, r * 1.0);
        c.lineTo(0, r * 0.58);
        c.lineTo(-r * 0.98, r * 1.0);
        c.lineTo(-r * 0.72, r * 0.2);
        break;
      case 'falcon':
        c.moveTo(0, -r * 1.55);
        c.lineTo(r * 1.18, r * 0.9);
        c.lineTo(r * 0.38, r * 0.62);
        c.lineTo(0, r * 0.85);
        c.lineTo(-r * 0.38, r * 0.62);
        c.lineTo(-r * 1.18, r * 0.9);
        break;
      case 'behemoth':
        c.moveTo(0, -r * 1.34);
        c.lineTo(r * 1.05, -r * 0.25);
        c.lineTo(r * 1.15, r * 0.95);
        c.lineTo(r * 0.45, r * 1.2);
        c.lineTo(0, r * 0.78);
        c.lineTo(-r * 0.45, r * 1.2);
        c.lineTo(-r * 1.15, r * 0.95);
        c.lineTo(-r * 1.05, -r * 0.25);
        break;
      case 'hawk':
        c.moveTo(0, -r * 1.55);
        c.lineTo(r * 0.62, -r * 0.08);
        c.lineTo(r * 1.3, r * 0.58);
        c.lineTo(r * 0.45, r * 0.55);
        c.lineTo(0, r * 1.0);
        c.lineTo(-r * 0.45, r * 0.55);
        c.lineTo(-r * 1.3, r * 0.58);
        c.lineTo(-r * 0.62, -r * 0.08);
        break;
      case 'nano2':
        c.moveTo(0, -r * 1.62);
        c.lineTo(r * 0.72, -r * 0.2);
        c.lineTo(r * 1.08, r * 0.95);
        c.lineTo(r * 0.28, r * 0.62);
        c.lineTo(0, r * 0.92);
        c.lineTo(-r * 0.28, r * 0.62);
        c.lineTo(-r * 1.08, r * 0.95);
        c.lineTo(-r * 0.72, -r * 0.2);
        break;
      default:
        c.moveTo(0, -r * 1.45);
        c.lineTo(r * 0.9, r * 1.05);
        c.lineTo(0, r * 0.55);
        c.lineTo(-r * 0.9, r * 1.05);
        break;
    }
    c.closePath();
  }

  drawShipTexture(c, ship, r) {
    const visual = ship.visual || {};
    c.save();
    this.traceShipHull(c, ship.id, r);
    c.clip();

    c.fillStyle = visual.hull || '#f9fcfd';
    c.fillRect(-r * 1.5, -r * 1.8, r * 3, r * 3.2);

    const accent = visual.accent || '#ef355d';
    const detail = visual.detail || '#2e9ea7';
    c.strokeStyle = detail;
    c.fillStyle = accent;
    c.lineWidth = Math.max(1.5, r * 0.12);

    switch (visual.pattern) {
      case 'stripe':
        c.fillRect(-r * 0.16, -r * 1.4, r * 0.32, r * 2.45);
        c.globalAlpha = 0.32;
        for (let y = -r; y < r; y += r * 0.34) {
          c.fillRect(-r, y, r * 2, r * 0.1);
        }
        break;
      case 'panel':
        c.globalAlpha = 0.85;
        c.fillRect(-r * 0.5, -r * 0.75, r, r * 0.42);
        c.globalAlpha = 0.28;
        for (let x = -r; x <= r; x += r * 0.42) {
          c.beginPath();
          c.moveTo(x, -r * 0.2);
          c.lineTo(x + r * 0.45, r * 0.95);
          c.stroke();
        }
        break;
      case 'chevron':
        c.globalAlpha = 0.8;
        for (let y = -r * 0.65; y < r * 0.75; y += r * 0.48) {
          c.beginPath();
          c.moveTo(-r * 0.72, y);
          c.lineTo(0, y + r * 0.28);
          c.lineTo(r * 0.72, y);
          c.stroke();
        }
        c.globalAlpha = 0.95;
        c.fillRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.65);
        break;
      case 'armor':
        c.globalAlpha = 0.65;
        for (let y = -r * 0.75; y < r; y += r * 0.38) {
          c.fillRect(-r * 0.9, y, r * 1.8, r * 0.14);
        }
        c.globalAlpha = 0.9;
        c.fillRect(-r * 0.22, -r * 1.25, r * 0.44, r * 1.95);
        break;
      case 'grid':
        c.globalAlpha = 0.35;
        for (let x = -r; x <= r; x += r * 0.32) {
          c.beginPath();
          c.moveTo(x, -r * 1.2);
          c.lineTo(x, r);
          c.stroke();
        }
        for (let y = -r; y <= r; y += r * 0.32) {
          c.beginPath();
          c.moveTo(-r, y);
          c.lineTo(r, y);
          c.stroke();
        }
        c.globalAlpha = 1;
        c.beginPath();
        c.arc(0, -r * 0.3, r * 0.24, 0, TAU);
        c.fill();
        break;
      default:
        c.beginPath();
        c.moveTo(0, -r * 0.75);
        c.lineTo(r * 0.32, r * 0.35);
        c.lineTo(-r * 0.32, r * 0.35);
        c.closePath();
        c.fill();
        break;
    }

    c.restore();
  }

  drawShip(c) {
    const shipState = this.ship;
    if (shipState.invuln > 0 && Math.floor(shipState.invuln * 12) % 2 === 0) return;

    const ship = this.loadout.ship;
    const visual = ship.visual || {};
    const r = shipState.r;

    c.save();
    c.translate(shipState.x, shipState.y);
    c.rotate(shipState.angle + Math.PI / 2);

    this.drawShipTexture(c, ship, r);
    this.traceShipHull(c, ship.id, r);
    c.strokeStyle = visual.outline || '#2e9ea7';
    c.lineWidth = Math.max(3, r * 0.25);
    c.lineJoin = 'round';
    c.stroke();

    c.beginPath();
    c.arc(0, -r * 0.18, Math.max(2.5, r * 0.18), 0, TAU);
    c.fillStyle = visual.canopy || '#34434a';
    c.fill();
    c.restore();
  }

  drawParticles(c) {
    for (const particle of this.particles) {
      c.globalAlpha = clamp(particle.ttl * 2, 0, 1);
      c.fillStyle = particle.type === 'electron'
        ? '#18aeb5'
        : particle.type === 'ship'
          ? '#ef355d'
          : '#f4b23e';
      c.beginPath();
      c.arc(particle.x, particle.y, particle.type === 'ship' ? 4 : 2.5, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}
