import { ELEMENTS, SHIPS, WEAPONS, ENGINES, MODULES, findById } from './data.js';
import { AudioSystem } from './audio.js';
import { AtomGame } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const DEFAULT_SAVE = {
  version: 2,
  unlocked: 1,
  completed: {},
  best: {},
  electrons: 0,
  neutrons: 0,
  purchased: {
    ships: ['pico'],
    weapons: ['blaster2'],
    engines: ['project1'],
    modules: [],
  },
  selectedShip: 'pico',
  selectedWeapon: 'blaster2',
  selectedEngine: 'project1',
  selectedModules: [],
  tutorialDone: false,
  settings: {
    sfx: true,
    music: true,
    side: 'right',
    stick: 'medium',
    deadzone: 0.38,
  },
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem('atom-shooter-save') || 'null');
    return stored ? mergeSave(stored) : structuredClone(DEFAULT_SAVE);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

function mergeSave(stored) {
  const settings = { ...DEFAULT_SAVE.settings, ...(stored.settings || {}) };

  // v1 shipped with music disabled by default and a nearly inaudible two-tone hum.
  // Enable the rebuilt soundtrack once when upgrading existing pre-release saves.
  if ((stored.version ?? 1) < 2) settings.music = true;

  return {
    ...structuredClone(DEFAULT_SAVE),
    ...stored,
    version: DEFAULT_SAVE.version,
    purchased: { ...DEFAULT_SAVE.purchased, ...(stored.purchased || {}) },
    settings,
    completed: stored.completed || {},
    best: stored.best || {},
    selectedModules: stored.selectedModules || [],
  };
}

let save = loadSave();
let currentScreen = 'main';
let shopTab = 'ships';
let gameContext = null;
let toastTimer = null;

const audio = new AudioSystem();
audio.configure(save.settings);

const game = new AtomGame($('#game-canvas'), audio, {
  onHUD: updateHUD,
  onObjective: (text) => { $('#objective').textContent = text; },
  onCurrency: () => {
    persist();
    updateWallets();
  },
  onPause: showPause,
  onComplete: levelComplete,
  onGameOver: gameOver,
  onLifeLost: () => updateHUD(),
});

function persist() {
  localStorage.setItem('atom-shooter-save', JSON.stringify(save));
}

function showScreen(name) {
  currentScreen = name;
  $$('.screen').forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === name));
  if (name === 'main') updateMain();
  if (name === 'table') renderTable();
  if (name === 'shop') renderShop();
  if (name === 'options') syncSettings();
  updateWallets();
}

function updateMain() {
  const unlocked = save.unlocked;
  $('#continue-hint').textContent = unlocked > 1
    ? `${unlocked - 1} / 118 elements cleared • ${ELEMENTS[Math.min(unlocked - 1, 117)].name} available`
    : '';
}

function updateWallets() {
  for (const id of ['table-electrons', 'shop-electrons', 'game-electrons']) {
    const element = $(`#${id}`);
    if (element) element.textContent = save.electrons;
  }
  for (const id of ['table-neutrons', 'shop-neutrons', 'game-neutrons']) {
    const element = $(`#${id}`);
    if (element) element.textContent = save.neutrons;
  }
}

function renderTable() {
  const root = $('#periodic-table');
  root.innerHTML = '';

  for (const element of ELEMENTS) {
    const button = document.createElement('button');
    const done = Boolean(save.completed[element.z]);
    const open = element.z <= save.unlocked;

    button.className = `element-cell ${done ? 'completed' : open ? 'available' : 'locked'} ${element.z === save.unlocked ? 'current' : ''}`;
    button.style.gridColumn = element.col;
    button.style.gridRow = element.row;
    button.disabled = !open;
    button.innerHTML = `<span class="z">${element.z}</span><b class="sym">${element.symbol}</b><span class="nm">${element.name}</span>`;
    button.title = open
      ? `${element.z}. ${element.name}${done ? ` — ${save.completed[element.z]}★` : ''}`
      : 'Complete the previous element to unlock';

    if (open) button.addEventListener('click', () => startGame(element.z - 1, 'classic'));
    root.appendChild(button);
  }
}

function shipPreviewMarkup(item) {
  if (!item.visual) return '';
  const visual = item.visual;
  return `<div class="ship-card-preview pattern-${visual.pattern || 'core'}" style="--ship-hull:${visual.hull};--ship-accent:${visual.accent};--ship-detail:${visual.detail};--ship-outline:${visual.outline}" aria-hidden="true"><span></span></div>`;
}

function renderShop() {
  const tabs = $$('#shop-tabs button');
  tabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === shopTab));

  const categories = { ships: SHIPS, weapons: WEAPONS, engines: ENGINES, modules: MODULES };
  const list = categories[shopTab];
  const root = $('#shop-grid');
  root.innerHTML = '';

  for (const item of list) {
    const owned = save.purchased[shopTab].includes(item.id);
    const selected = isSelected(shopTab, item.id);
    const canAfford = save.electrons >= item.costE && save.neutrons >= item.costN;
    const card = document.createElement('article');
    card.className = `item-card ${selected ? 'selected' : ''}`;

    let stats = '';
    if (shopTab === 'ships') {
      stats = `<span class="chip">Mass ${item.mass.toFixed(2)}</span><span class="chip">Slots ${item.slots}</span>`;
    } else if (shopTab === 'weapons') {
      stats = `<span class="chip">${item.bullets} projectile${item.bullets > 1 ? 's' : ''}</span><span class="chip">${item.rate.toFixed(1)}/s</span>`;
    } else if (shopTab === 'engines') {
      stats = `<span class="chip">Thrust ×${item.thrust}</span>`;
    } else {
      stats = '<span class="chip">Passive module</span>';
    }

    const label = owned
      ? (selected ? 'Equipped' : (shopTab === 'modules' ? 'Equip module' : 'Equip'))
      : 'Buy';

    card.innerHTML = `${shipPreviewMarkup(item)}<h3>${item.name}</h3><p>${item.desc}</p><div class="stats">${stats}</div><div class="price"><span><i class="e-dot"></i>${item.costE}</span><span><i class="n-dot"></i>${item.costN}</span></div><button class="${!owned ? 'primary' : ''}" ${!owned && !canAfford ? 'disabled' : ''}>${label}</button>`;
    card.querySelector('button').addEventListener('click', () => buyOrEquip(shopTab, item));
    root.appendChild(card);
  }

  renderLoadout();
}

function isSelected(tab, id) {
  if (tab === 'ships') return save.selectedShip === id;
  if (tab === 'weapons') return save.selectedWeapon === id;
  if (tab === 'engines') return save.selectedEngine === id;
  return save.selectedModules.includes(id);
}

function buyOrEquip(tab, item) {
  const owned = save.purchased[tab].includes(item.id);

  if (!owned) {
    if (save.electrons < item.costE || save.neutrons < item.costN) return;
    save.electrons -= item.costE;
    save.neutrons -= item.costN;
    save.purchased[tab].push(item.id);
    toast(`${item.name} purchased`);
  }

  if (tab === 'ships') save.selectedShip = item.id;
  else if (tab === 'weapons') save.selectedWeapon = item.id;
  else if (tab === 'engines') save.selectedEngine = item.id;
  else {
    const ship = findById(SHIPS, save.selectedShip);
    const index = save.selectedModules.indexOf(item.id);
    if (index >= 0) save.selectedModules.splice(index, 1);
    else if (save.selectedModules.length < ship.slots) save.selectedModules.push(item.id);
    else {
      toast(`This ship has ${ship.slots} module slot${ship.slots === 1 ? '' : 's'}`);
      persist();
      renderShop();
      return;
    }
  }

  persist();
  renderShop();
  updateWallets();
}

function renderLoadout() {
  const ship = findById(SHIPS, save.selectedShip);
  const weapon = findById(WEAPONS, save.selectedWeapon);
  const engine = findById(ENGINES, save.selectedEngine);
  const mods = save.selectedModules
    .map((id) => MODULES.find((module) => module.id === id)?.name)
    .filter(Boolean);

  $('#loadout-panel').innerHTML = `<b>${ship.name}</b><div class="slots"><span class="slot">⚡ ${engine.name}</span><span class="slot">◉ ${weapon.name}</span>${mods.map((name) => `<span class="slot">◇ ${name}</span>`).join('')}${Array.from({ length: Math.max(0, ship.slots - mods.length) }, () => '<span class="slot">+ Empty slot</span>').join('')}</div>`;
}

function startGame(index, mode, tutorial = false, marathonScore = 0) {
  audio.unlock();
  gameContext = { index, mode, tutorial, marathonScore };
  showScreen('game');
  applyControlSettings();
  $('#tutorial-callout').classList.add('hidden');
  game.start({ elementIndex: index, mode, save, tutorial, marathonScore });
  $('#objective').textContent = tutorial ? 'Shoot the orbiting electron.' : 'Shoot and collect the electrons';
  if (tutorial) runTutorial();
}

function updateHUD(hud) {
  if (!hud) return;
  $('#element-symbol').textContent = hud.element.symbol;
  $('#element-name').textContent = hud.element.name;
  $('#score').textContent = hud.score.toLocaleString();
  $('#life-indicator').innerHTML = Array.from(
    { length: 3 },
    (_, index) => `<span class="life-ship ${index >= hud.lives ? 'lost' : ''}">▲</span>`,
  ).join('');

  if (hud.phase === 'electrons') {
    $('#objective').textContent = `Shoot electrons • ${hud.orbiting} remaining`;
  } else if (hud.phase === 'post') {
    $('#objective').textContent = `Neutrons ${hud.neutronCollected}/${hud.neutronGoal} • ${formatTime(hud.collectionSeconds)} • avoid red protons`;
  }
}

function levelComplete(result) {
  save.completed[result.element.z] = Math.max(save.completed[result.element.z] || 0, result.stars);
  save.best[result.element.z] = Math.max(save.best[result.element.z] || 0, result.levelScore);
  if (result.mode === 'classic') {
    save.unlocked = Math.max(save.unlocked, Math.min(118, result.element.z + 1));
  }
  if (result.mode === 'tutorial') save.tutorialDone = true;
  persist();

  const next = result.element.z < 118 ? result.element.z : null;
  showModal(
    'Level Completed!',
    `<p><b>${result.element.name}</b> destabilized.</p><p>${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} &nbsp; ${formatTime(result.time)} &nbsp; Score ${result.levelScore.toLocaleString()}</p>`,
    [
      { label: 'Main menu', fn: () => { closeModal(); showScreen('main'); } },
      ...(result.mode === 'classic' && next !== null
        ? [{ label: 'Next element', primary: true, fn: () => { closeModal(); startGame(next, 'classic'); } }]
        : []),
      ...(result.mode === 'marathon' && next !== null
        ? [{ label: 'Continue', primary: true, fn: () => { closeModal(); startGame(next, 'marathon', false, result.score); } }]
        : []),
      ...(result.mode === 'tutorial'
        ? [{ label: 'Classic mode', primary: true, fn: () => { closeModal(); showScreen('table'); } }]
        : []),
    ],
  );
}

function gameOver(result) {
  const explanation = result.reason === 'collection-timeout'
    ? `The split nucleus particle field dissipated before you collected enough neutrons.`
    : `${result.element.name} won this round.`;

  showModal(
    'Game Over!',
    `<p>${explanation}</p><p>Score: <b>${result.score.toLocaleString()}</b></p>`,
    [
      { label: 'Main menu', fn: () => { closeModal(); showScreen('main'); } },
      {
        label: 'Restart',
        primary: true,
        fn: () => {
          closeModal();
          startGame(
            gameContext.index,
            gameContext.mode,
            gameContext.tutorial,
            gameContext.mode === 'marathon' ? 0 : gameContext.marathonScore,
          );
        },
      },
    ],
  );
}

function showPause() {
  if (!game.running) return;
  game.setPaused(true);
  showModal(
    'Game Paused',
    `<p>${game.element.name} • Score ${game.score.toLocaleString()}</p>`,
    [
      { label: 'Quit', fn: () => { game.stop(); closeModal(); showScreen(game.mode === 'classic' ? 'table' : 'main'); } },
      { label: 'Restart', fn: () => { closeModal(); startGame(gameContext.index, gameContext.mode, gameContext.tutorial, gameContext.marathonScore); } },
      { label: 'Resume', primary: true, fn: () => { closeModal(); game.setPaused(false); } },
    ],
    false,
  );
}

function runTutorial() {
  const box = $('#tutorial-callout');
  box.classList.remove('hidden');
  const steps = [
    'Welcome to Atom Shooter!',
    'This is your ship. Use WASD / arrows, or the analog stick, to aim.',
    'Push the stick farther to engage thrust. Inertia keeps you moving.',
    'Tap FIRE or press Space to shoot the orbiting electron.',
    'Collect the cyan electron after shooting it down.',
    'When the nucleus explodes, collect blue neutrons and avoid red protons.',
  ];
  let index = 0;
  box.textContent = steps[0];

  const timer = setInterval(() => {
    if (currentScreen !== 'game' || !game.tutorial || !game.running) {
      clearInterval(timer);
      return;
    }
    index += 1;
    if (index >= steps.length) {
      box.classList.add('hidden');
      clearInterval(timer);
    } else {
      box.textContent = steps[index];
    }
  }, 4300);
}

function showModal(title, body, actions, allowBackdrop = true) {
  const modal = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const actionRoot = $('#modal-actions');
  actionRoot.innerHTML = '';

  for (const action of actions) {
    const button = document.createElement('button');
    button.textContent = action.label;
    if (action.primary) button.classList.add('primary');
    button.addEventListener('click', action.fn);
    actionRoot.appendChild(button);
  }

  modal.classList.remove('hidden');
  modal.dataset.backdrop = allowBackdrop ? '1' : '0';
}

function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-actions').innerHTML = '';
}

function showAbout() {
  showModal(
    'About Atom Shooter',
    `<p>This is a clean-room browser/desktop recreation of the 2013 arcade concept: pilot a nano ship, strip electrons from each element, survive the nucleus explosion, and use collected particles to upgrade your loadout.</p><p>All code, vector-style graphics and synthesized audio in this repository are newly created. Original game names and historical references belong to their respective rights holders.</p><p><b>118 elements • Classic • Marathon • Tutorial • Shop • Touch + keyboard/mouse controls</b></p>`,
    [{ label: 'Close', primary: true, fn: closeModal }],
  );
}

function syncSettings() {
  const settings = save.settings;
  $('#setting-sfx').checked = settings.sfx;
  $('#setting-music').checked = settings.music;
  $('#setting-side').value = settings.side;
  $('#setting-stick').value = settings.stick;
  $('#setting-deadzone').value = settings.deadzone;
}

function saveSettings() {
  save.settings = {
    sfx: $('#setting-sfx').checked,
    music: $('#setting-music').checked,
    side: $('#setting-side').value,
    stick: $('#setting-stick').value,
    deadzone: Number($('#setting-deadzone').value),
  };

  audio.configure(save.settings);
  if (save.settings.music) audio.unlock();
  persist();
  applyControlSettings();
}

function applyControlSettings() {
  const controls = $('#touch-controls');
  controls.classList.toggle('controls-left', save.settings.side === 'left');
  controls.classList.remove('stick-small', 'stick-medium', 'stick-large');
  controls.classList.add(`stick-${save.settings.stick}`);
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), 1800);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

$$('[data-action]').forEach((button) => button.addEventListener('click', () => {
  audio.unlock();
  const action = button.dataset.action;
  if (action === 'classic') showScreen('table');
  if (action === 'marathon') startGame(0, 'marathon');
  if (action === 'tutorial') startGame(0, 'tutorial', true);
  if (action === 'shop') showScreen('shop');
  if (action === 'options') showScreen('options');
  if (action === 'about') showAbout();
  if (action === 'home') showScreen('main');
  if (action === 'shop-back') showScreen('main');
  if (action === 'reset-tutorial') {
    save.tutorialDone = false;
    persist();
    toast('Tutorial reset');
  }
  if (action === 'reset-save') {
    showModal(
      'Reset all progress?',
      '<p>This deletes unlocked elements, high scores, currency and purchases on this device.</p>',
      [
        { label: 'Cancel', fn: closeModal },
        {
          label: 'Reset',
          primary: true,
          fn: () => {
            save = structuredClone(DEFAULT_SAVE);
            persist();
            audio.configure(save.settings);
            audio.unlock();
            closeModal();
            syncSettings();
            toast('Progress reset');
          },
        },
      ],
    );
  }
}));

$$('#shop-tabs button').forEach((button) => button.addEventListener('click', () => {
  shopTab = button.dataset.tab;
  renderShop();
}));

for (const id of ['setting-sfx', 'setting-music', 'setting-side', 'setting-stick', 'setting-deadzone']) {
  $(`#${id}`).addEventListener('input', saveSettings);
}

$('#pause-btn').addEventListener('click', showPause);
$('#modal').addEventListener('click', (event) => {
  if (event.target === $('#modal') && $('#modal').dataset.backdrop === '1') closeModal();
});

const joystick = $('#joystick');
const knob = $('#joystick-knob');
let joyPointer = null;

function joyMove(event) {
  if (event.pointerId !== joyPointer) return;
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const max = rect.width * 0.34;
  const distance = Math.hypot(dx, dy);
  const magnitude = Math.min(1, distance / max);
  const nx = distance ? dx / distance : 0;
  const ny = distance ? dy / distance : 0;
  knob.style.transform = `translate(${nx * max * magnitude}px,${ny * max * magnitude}px)`;
  game.setJoystick(nx, ny, magnitude);
}

joystick.addEventListener('pointerdown', (event) => {
  joyPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  audio.unlock();
  joyMove(event);
});
joystick.addEventListener('pointermove', joyMove);
joystick.addEventListener('pointerup', (event) => {
  if (event.pointerId !== joyPointer) return;
  joyPointer = null;
  knob.style.transform = 'translate(0,0)';
  game.setJoystick(0, 0, 0);
});
joystick.addEventListener('pointercancel', () => {
  joyPointer = null;
  knob.style.transform = 'translate(0,0)';
  game.setJoystick(0, 0, 0);
});

const fire = $('#fire-control');
fire.addEventListener('pointerdown', (event) => {
  fire.setPointerCapture(event.pointerId);
  game.setFire(true);
});
fire.addEventListener('pointerup', () => game.setFire(false));
fire.addEventListener('pointercancel', () => game.setFire(false));

window.addEventListener('beforeunload', persist);
applyControlSettings();
persist();
showScreen('main');
