import {
  ELEMENTS,
  SHIPS,
  WEAPONS,
  ENGINES,
  MODULES,
  PAINTS,
  findById,
} from './data.js';
import { AudioSystem } from './audio.js';
import { AtomGame } from './game.js';
import { DEFAULT_SAVE, loadSave, normalizeMarathonState } from './save.js';
import {
  ACHIEVEMENTS,
  getAchievementProgress,
  evaluateAchievements,
  getElementMetadata,
  evaluateProgressionRewards,
  getProgressionRewardStatus,
} from './progression.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const CONTROL_MODES = ['combined', 'split', 'dpad'];

const SHOP_ASSET_PATHS = {
  ships: 'assets/ships',
  weapons: 'assets/weapons',
  engines: 'assets/engines',
  modules: 'assets/modules',
};

const CATEGORY_DATA = {
  ships: SHIPS,
  weapons: WEAPONS,
  engines: ENGINES,
  modules: MODULES,
  paints: PAINTS,
};

const unique = (values) => [...new Set(values.filter(Boolean))];

let save = loadSave();
evaluateProgressionRewards(save);
let currentScreen = 'splash';
let shopTab = 'ships';
let gameContext = null;
let toastTimer = null;
let tutorialTimer = null;
let shopTutorialStep = 0;

const audio = new AudioSystem();
audio.configure(save.settings);

const game = new AtomGame($('#game-canvas'), audio, {
  onHUD: updateHUD,
  onObjective: (text) => { $('#objective').textContent = text; },
  onCurrency: () => {
    const unlocked = checkAchievements();
    const rewards = evaluateProgressionRewards(save);
    persist();
    updateWallets();
    notifyAchievements(unlocked);
    notifyProgressionRewards(rewards);
  },
  onMessage: (message) => toast(message, 2600),
  onMarathonState: (state) => {
    if (game.mode !== 'marathon') return;
    save.marathonResume = normalizeMarathonState(state);
    if (state?.runTime && save.stats) save.stats.marathonBestTime = Math.max(save.stats.marathonBestTime || 0, state.runTime);
    const unlocked = checkAchievements();
    const rewards = evaluateProgressionRewards(save);
    persist();
    notifyAchievements(unlocked);
    notifyProgressionRewards(rewards);
  },
  onPause: showPause,
  onComplete: levelComplete,
  onGameOver: gameOver,
});

function persist() {
  evaluateProgressionRewards(save);
  localStorage.setItem('atom-shooter-save', JSON.stringify(save));
}

function checkAchievements() {
  return evaluateAchievements(save);
}

function notifyAchievements(unlocked) {
  if (!unlocked?.length) return;
  const names = unlocked.map((item) => item.title).join(', ');
  toast(`Achievement unlocked: ${names}`, 3200);
}

function achievementMarkup(unlocked) {
  if (!unlocked?.length) return '';
  return `<div class="unlock-summary"><b>Achievement unlocked</b><span>${unlocked.map((item) => item.title).join(', ')}</span></div>`;
}

function progressionRewardMarkup(unlocked) {
  if (!unlocked?.length) return '';
  return `<div class="unlock-summary reward"><b>Reward unlocked</b><span>${unlocked.map((item) => item.title).join(', ')}</span></div>`;
}

function notifyProgressionRewards(unlocked) {
  if (!unlocked?.length) return;
  toast(`Reward unlocked: ${unlocked.map((item) => item.title).join(', ')}`, 3400);
}

function getShopAssetPath(tab, itemOrId) {
  const item = typeof itemOrId === 'string'
    ? CATEGORY_DATA[tab].find((entry) => entry.id === itemOrId)
    : itemOrId;
  const asset = item?.asset || item?.id || String(itemOrId);
  return `${SHOP_ASSET_PATHS[tab]}/${asset}.png`;
}

function itemPreviewMarkup(tab, item, options = {}) {
  const className = options.small ? 'slot-icon' : 'shop-item-preview';
  if (tab === 'paints') {
    return `<div class="${className} paint-preview" aria-hidden="true" style="--paint-body:${item.body};--paint-accent:${item.accent};--paint-outline:${item.outline};--paint-glow:${item.glow || 'transparent'}"><span class="paint-ship">▲</span><i></i></div>`;
  }
  return `<div class="${className}" aria-hidden="true"><img src="${getShopAssetPath(tab, item)}" alt="" loading="lazy"></div>`;
}

function loadoutSlotMarkup(tab, item) {
  return `<span class="slot">${itemPreviewMarkup(tab, item, { small: true })}<span>${item.name}</span></span>`;
}

function showScreen(name) {
  currentScreen = name;
  if (name !== 'game') audio.setMusicMode('menu');
  if (name !== 'shop') closeShopTutorial();
  $$('.screen').forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === name));
  if (name === 'main') updateMain();
  if (name === 'table') renderTable();
  if (name === 'shop') renderShop();
  if (name === 'options') syncSettings();
  if (name === 'records') renderRecords();
  if (name === 'achievements') renderAchievements();
  if (name === 'codex') renderCodex();
  updateWallets();
}

function updateMain() {
  const unlocked = save.unlocked;
  $('#continue-hint').textContent = unlocked > 1
    ? `${unlocked - 1} / 118 elements cleared • ${ELEMENTS[Math.min(unlocked - 1, 117)].name} available`
    : '';
  const resume = normalizeMarathonState(save.marathonResume);
  const marathonButton = $('[data-action="marathon"]');
  if (marathonButton) marathonButton.innerHTML = resume ? '<span>∞</span> Marathon • Resume' : '<span>∞</span> Marathon';
}

function updateWallets() {
  for (const id of ['table-electrons', 'shop-electrons', 'game-electrons']) {
    const element = $(`#${id}`);
    if (element) element.textContent = Number(save.electrons || 0).toLocaleString();
  }
  for (const id of ['table-neutrons', 'shop-neutrons', 'game-neutrons']) {
    const element = $(`#${id}`);
    if (element) element.textContent = Number(save.neutrons || 0).toLocaleString();
  }
}

function recordSummary(z) {
  const record = save.records?.[z];
  if (!record) return '';
  const parts = [];
  if (record.score) parts.push(`Best ${Number(record.score).toLocaleString()} pts`);
  if (record.time) parts.push(formatTime(record.time));
  if (record.neutrons) parts.push(`${record.neutrons} n`);
  return parts.join(' • ');
}

function renderTable() {
  const root = $('#periodic-table');
  root.innerHTML = '';

  for (const element of ELEMENTS) {
    const button = document.createElement('button');
    const done = Boolean(save.completed[element.z]);
    const open = element.z <= save.unlocked;
    const summary = recordSummary(element.z);

    button.className = `element-cell ${done ? 'completed' : open ? 'available' : 'locked'} ${element.z === save.unlocked ? 'current' : ''}`;
    button.style.gridColumn = element.col;
    button.style.gridRow = element.row;
    button.disabled = !open;
    const medals = Array.isArray(save.challenges?.[element.z]?.completed) ? save.challenges[element.z].completed.length : 0;
    button.innerHTML = `<span class="z">${element.z}</span><b class="sym">${element.symbol}</b><span class="nm">${element.name}</span>${medals ? `<span class="challenge-medals">${medals}/3</span>` : ''}`;
    button.title = open
      ? `${element.z}. ${element.name}${done ? ` — ${save.completed[element.z]}★` : ''}${medals ? ` — ${medals}/3 challenges` : ''}${summary ? ` — ${summary}` : ''}`
      : 'Complete the previous element to unlock';

    if (open) button.addEventListener('click', () => startGame(element.z - 1, 'classic'));
    root.appendChild(button);
  }
}

function prerequisiteName(tab, item) {
  if (!item.requires) return '';
  return CATEGORY_DATA[tab].find((candidate) => candidate.id === item.requires)?.name || item.requires;
}

function shopStats(tab, item) {
  if (tab === 'ships') {
    const special = item.builtinPickup ? '<span class="chip">Built-in collector</span>' : '';
    return `<span class="chip">Mass ${item.mass.toFixed(2)}</span><span class="chip">Size ×${item.size}</span><span class="chip">Slots ${item.slots}</span><span class="chip">Nucleus pull ×${item.gravity}</span><span class="chip">Pickup ×${item.pickup}</span>${special}`;
  }
  if (tab === 'weapons') {
    const trigger = item.continuous ? 'Continuous' : 'Manual';
    const tierTotal = item.tierTotal || 3;
    if (item.kind === 'laser') return `<span class="chip">Continuous beam</span><span class="chip">Range ${item.range}</span><span class="chip">${item.rate.toFixed(1)} ticks/s</span><span class="chip">Energy ${item.capacity}</span><span class="chip">Restore ${item.regen}/s</span>`;
    if (item.kind === 'arc') return `<span class="chip">Chain ×${item.chains}</span><span class="chip">Range ${item.range}</span><span class="chip">Chain range ${item.chainRange}</span><span class="chip">Damage ${item.damage}</span><span class="chip">${trigger}</span>`;
    if (item.kind === 'pulse') return `<span class="chip">Radial ${item.range}px</span><span class="chip">Damage ${item.damage}</span><span class="chip">${item.rate.toFixed(2)}/s</span><span class="chip">Close range</span>`;
    const range = Math.round(item.speed * item.life);
    const special = item.kind === 'homing' ? '<span class="chip">Homing</span>' : item.kind === 'rail' ? '<span class="chip">Pierce ×8</span>' : '';
    return `<span class="chip">Tier ${item.tier}/${tierTotal}</span><span class="chip">${item.bullets} projectile${item.bullets === 1 ? '' : 's'}</span><span class="chip">${item.rate.toFixed(1)}/s</span><span class="chip">Speed ${Math.round(item.speed)}</span><span class="chip">Range ${range}</span><span class="chip">Damage ${item.damage}</span><span class="chip">Energy ${item.capacity}</span><span class="chip">Restore ${item.regen}/s</span>${special}`;
  }
  if (tab === 'engines') {
    const tier = ENGINES.indexOf(item) + 1;
    return `<span class="chip">Stage ${tier}/5</span><span class="chip">Force ×${item.thrust}</span><span class="chip">Max speed ×${item.max}</span>`;
  }
  if (tab === 'paints') return `<span class="chip">Cosmetic only</span><span class="chip">${item.unlock}</span>`;
  const effectLabels = {
    pickup: `Pickup field ×${item.value}`,
    gravity: `Nucleus pull ×${item.value}`,
    bulletSpeed: `Projectile speed ×${item.value}`,
    bulletSize: `Projectile size ×${item.value}`,
    shipSize: `Ship size ×${item.value}`,
    electronSpeed: `Electron speed ×${item.value}`,
    time: `Time speed ×${item.value}`,
  };
  return `<span class="chip">Tier ${item.tier}/3</span><span class="chip">${effectLabels[item.effect] || 'Passive module'}</span>`;
}

function renderShop() {
  $$('#shop-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === shopTab));
  const list = CATEGORY_DATA[shopTab];
  const root = $('#shop-grid');
  root.innerHTML = '';

  for (const item of list) {
    const paintTab = shopTab === 'paints';
    const owned = paintTab ? save.unlockedPaints.includes(item.id) : save.purchased[shopTab].includes(item.id);
    const selected = isSelected(shopTab, item.id);
    const rewardLocked = Boolean(item.rewardOnly && !owned);
    const canAfford = paintTab || (save.electrons >= item.costE && save.neutrons >= item.costN);
    const prerequisiteOwned = paintTab || !item.requires || save.purchased[shopTab].includes(item.requires);
    const card = document.createElement('article');
    card.className = `item-card ${selected ? 'selected' : ''} ${item.tier ? `tier-${item.tier}` : ''} ${rewardLocked ? 'reward-locked' : ''}`;

    let label = paintTab ? (owned ? (selected ? 'Equipped' : 'Equip paint') : item.unlock) : 'Buy';
    let disabled = paintTab ? !owned : false;
    if (!paintTab && rewardLocked) {
      label = item.reward || 'Progression reward';
      disabled = true;
    } else if (!paintTab && !owned && !prerequisiteOwned) {
      label = `Requires ${prerequisiteName(shopTab, item)}`;
      disabled = true;
    } else if (!paintTab && !owned && !canAfford) {
      label = 'Not enough particles';
      disabled = true;
    } else if (!paintTab && owned) {
      label = selected ? 'Equipped' : (shopTab === 'modules' ? 'Equip module' : 'Equip');
    }

    const family = item.family ? `<span class="family-label">${item.family.toUpperCase()} • ${item.tier}/${item.tierTotal || 3}</span>` : '';
    const price = paintTab || item.rewardOnly ? `<div class="price reward-price"><span>${owned ? 'Unlocked' : 'Reward'}</span></div>` : `<div class="price"><span><i class="e-dot"></i>${item.costE}</span><span><i class="n-dot"></i>${item.costN}</span></div>`;
    card.innerHTML = `${itemPreviewMarkup(shopTab, item)}${family}<h3>${item.name}</h3><p>${item.desc}</p><div class="stats">${shopStats(shopTab, item)}</div>${price}<button class="${!owned && !rewardLocked ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    card.querySelector('button').addEventListener('click', () => buyOrEquip(shopTab, item));
    root.appendChild(card);
  }

  renderLoadout();
}

function isSelected(tab, id) {
  if (tab === 'ships') return save.selectedShip === id;
  if (tab === 'weapons') return save.selectedWeapon === id;
  if (tab === 'engines') return save.selectedEngine === id;
  if (tab === 'paints') return save.selectedPaint === id;
  return save.selectedModules.includes(id);
}

function sanitizeSelectedModules() {
  const ship = findById(SHIPS, save.selectedShip);
  if (ship.slots <= 0) {
    save.selectedModules = [];
    return;
  }
  const families = new Map();
  for (const id of save.selectedModules) {
    const module = MODULES.find((item) => item.id === id);
    if (module) families.set(module.family, id);
  }
  save.selectedModules = [...families.values()].slice(0, ship.slots);
}

function buyOrEquip(tab, item) {
  if (tab === 'paints') {
    if (!save.unlockedPaints.includes(item.id)) return;
    save.selectedPaint = item.id;
    persist();
    renderShop();
    toast(`${item.name} equipped`);
    return;
  }
  const owned = save.purchased[tab].includes(item.id);
  if (item.rewardOnly && !owned) {
    toast(item.reward || 'Complete its progression reward first');
    return;
  }
  if (!owned) {
    if (item.requires && !save.purchased[tab].includes(item.requires)) {
      toast(`Buy ${prerequisiteName(tab, item)} first`);
      return;
    }
    if (save.electrons < item.costE || save.neutrons < item.costN) return;
    save.electrons -= item.costE;
    save.neutrons -= item.costN;
    save.purchased[tab].push(item.id);
    save.purchased[tab] = unique(save.purchased[tab]);
    toast(`${item.name} purchased`);
  }

  if (tab === 'ships') {
    save.selectedShip = item.id;
    sanitizeSelectedModules();
    if (item.slots === 0 && item.builtinPickup) toast(`${item.name}: built-in pickup field, no module slots`);
  } else if (tab === 'weapons') {
    save.selectedWeapon = item.id;
  } else if (tab === 'engines') {
    save.selectedEngine = item.id;
  } else {
    const ship = findById(SHIPS, save.selectedShip);
    const selectedIndex = save.selectedModules.indexOf(item.id);
    if (selectedIndex >= 0) {
      save.selectedModules.splice(selectedIndex, 1);
    } else {
      if (ship.slots <= 0) {
        toast(`${ship.name} has no module slots`);
        persist();
        renderShop();
        return;
      }
      const sameFamilyIndex = save.selectedModules.findIndex((id) => (
        MODULES.find((module) => module.id === id)?.family === item.family
      ));
      if (sameFamilyIndex >= 0) {
        save.selectedModules[sameFamilyIndex] = item.id;
      } else if (save.selectedModules.length < ship.slots) {
        save.selectedModules.push(item.id);
      } else {
        toast(`This ship has ${ship.slots} module slot${ship.slots === 1 ? '' : 's'}`);
        persist();
        renderShop();
        return;
      }
    }
  }

  const unlockedAchievements = checkAchievements();
  const unlockedRewards = evaluateProgressionRewards(save);
  persist();
  renderShop();
  updateWallets();
  notifyAchievements(unlockedAchievements);
  notifyProgressionRewards(unlockedRewards);
}

function renderLoadout() {
  const ship = findById(SHIPS, save.selectedShip);
  const weapon = findById(WEAPONS, save.selectedWeapon);
  const engine = findById(ENGINES, save.selectedEngine);
  const paint = findById(PAINTS, save.selectedPaint);
  const mods = save.selectedModules.map((id) => MODULES.find((module) => module.id === id)).filter(Boolean);
  const special = ship.builtinPickup
    ? '<span class="slot built-in"><span class="slot-plus">◎</span><span>Built-in Collector</span></span>'
    : '';
  $('#loadout-panel').innerHTML = `<b>${ship.name} • ${paint.name}</b><div class="slots">${loadoutSlotMarkup('engines', engine)}${loadoutSlotMarkup('weapons', weapon)}${special}${mods.map((module) => loadoutSlotMarkup('modules', module)).join('')}${Array.from({ length: Math.max(0, ship.slots - mods.length) }, () => '<span class="slot empty"><span class="slot-plus">+</span><span>Empty slot</span></span>').join('')}</div>`;
}

function startGame(index, mode, tutorial = false, marathonState = null) {
  audio.setMusicMode(mode === 'marathon' ? 'marathon' : 'level');
  audio.unlock();
  clearInterval(tutorialTimer);
  gameContext = { index, mode, tutorial, marathonState: normalizeMarathonState(marathonState) };
  showScreen('game');
  applyControlSettings();
  $('#tutorial-callout').classList.add('hidden');
  game.start({ elementIndex: index, mode, save, tutorial, marathonState: gameContext.marathonState });
  $('#objective').textContent = tutorial ? 'Shoot the orbiting electron.' : 'Shoot and collect the electrons';
  if (tutorial) runTutorial();
}

function beginMarathon() {
  const resume = normalizeMarathonState(save.marathonResume);
  if (!resume) {
    save.marathonResume = null;
    persist();
    startGame(0, 'marathon', false, null);
    return;
  }

  showModal(
    'Continue previous Marathon?',
    `<p>You reached <b>${ELEMENTS[resume.index].name}</b> with <b>${resume.score.toLocaleString()}</b> points and <b>${resume.lives}</b> ship${resume.lives === 1 ? '' : 's'} remaining.</p><p>Continue that run, or start a new Marathon from Hydrogen.</p>`,
    [
      {
        label: 'New Marathon',
        fn: () => {
          save.marathonResume = null;
          persist();
          closeModal();
          startGame(0, 'marathon', false, null);
        },
      },
      {
        label: 'Continue',
        primary: true,
        fn: () => {
          closeModal();
          startGame(resume.index, 'marathon', false, resume);
        },
      },
    ],
  );
}

function livesMarkup(hud) {
  if (hud.mode === 'marathon') {
    const visible = Math.min(hud.lives, 5);
    return `${Array.from({ length: visible }, () => '<span class="life-ship">▲</span>').join('')}${hud.lives > 5 ? `<span class="life-count">×${hud.lives}</span>` : ''}`;
  }
  return Array.from(
    { length: 3 },
    (_, index) => `<span class="life-ship ${index >= hud.lives ? 'lost' : ''}">▲</span>`,
  ).join('');
}

function updateHUD(hud) {
  if (!hud) return;
  $('#element-symbol').textContent = hud.element.symbol;
  $('#element-name').textContent = hud.element.name;
  $('#score').textContent = hud.score.toLocaleString();
  $('#life-indicator').innerHTML = livesMarkup(hud);

  const energyPercent = Math.round((hud.energyFraction || 0) * 100);
  $('#weapon-energy-fill').style.width = `${energyPercent}%`;
  $('#weapon-energy-fill').classList.toggle('low', energyPercent <= 20);
  $('#weapon-energy-text').textContent = `${Math.ceil(hud.energy)}/${Math.round(hud.energyCapacity)}`;

  $('#powerup-timers').innerHTML = hud.activePowerups.map((item) => (
    `<span class="powerup-chip" style="--power:${item.color}"><b>${item.symbol}</b>${item.name}<small>${item.remaining}s</small></span>`
  )).join('');

  const marathonNext = $('#marathon-next');
  if (hud.mode === 'marathon') {
    marathonNext.classList.remove('hidden');
    marathonNext.textContent = hud.marathonNextShip
      ? `Next ship ${(hud.marathonNextShip / 1000).toFixed(hud.marathonNextShip % 1000 ? 1 : 0)}k`
      : 'No more bonus ships';
  } else {
    marathonNext.classList.add('hidden');
  }

  const behavior = $('#element-behavior');
  if (hud.elementBehavior?.tags?.length) {
    behavior.classList.remove('hidden');
    behavior.textContent = `${hud.elementBehavior.label}: ${hud.elementBehavior.description}`;
  } else {
    behavior.classList.add('hidden');
    behavior.textContent = '';
  }

  const modifier = $('#marathon-modifier');
  if (hud.marathonModifier) {
    modifier.classList.remove('hidden');
    modifier.innerHTML = `<b>${hud.marathonModifier.name}</b><span>${hud.marathonModifier.description}</span>`;
  } else {
    modifier.classList.add('hidden');
    modifier.innerHTML = '';
  }

  const challengePanel = $('#challenge-panel');
  if (hud.challenges?.length) {
    challengePanel.classList.remove('hidden');
    challengePanel.innerHTML = `<b>Challenges</b>${hud.challenges.map((challenge) => `<div class="challenge-line ${challenge.state}"><span><strong>${challenge.title}</strong><em>${challenge.description}</em></span><small>${challenge.state === 'complete' ? 'DONE' : challenge.state === 'failed' ? 'MISSED' : 'ACTIVE'}</small></div>`).join('')}`;
  } else {
    challengePanel.classList.add('hidden');
    challengePanel.innerHTML = '';
  }

  if (hud.phase === 'electrons') {
    $('#objective').textContent = `Shoot electrons • ${hud.orbiting} remaining`;
  } else if (hud.phase === 'post') {
    $('#objective').textContent = `Blue ${hud.neutronCollected}/${hud.neutronTotal} • ${hud.neutronRemaining} left • ${formatTime(hud.collectionSeconds)} • collect all or survive`;
  }
}

function getExistingRecord(z) {
  const record = save.records?.[z];
  return record ? { ...record } : null;
}

function updateRecord(result) {
  const z = result.element.z;
  const previous = getExistingRecord(z);
  const current = save.records[z] || { score: 0, time: 0, neutrons: 0 };
  const time = Math.max(0, Number(result.time) || 0);
  save.records[z] = {
    score: Math.max(Number(current.score) || 0, Number(result.levelScore) || 0),
    time: !current.time ? time : (time ? Math.min(Number(current.time), time) : Number(current.time)),
    neutrons: Math.max(Number(current.neutrons) || 0, Number(result.neutrons) || 0),
  };
  return previous;
}

function comparisonMarkup(previous, score) {
  if (!previous?.score) return '<p class="muted">First recorded run for this element.</p>';
  const delta = Math.round(Number(score) - Number(previous.score));
  if (delta > 0) return `<p class="comparison ahead">You are <b>${delta.toLocaleString()} points ahead!</b></p>`;
  if (delta < 0) return `<p class="comparison behind">You are <b>${Math.abs(delta).toLocaleString()} points behind.</b></p>`;
  return '<p class="comparison">You matched your previous best score.</p>';
}

function affordableItemsMarkup() {
  const affordable = [];
  for (const [tab, items] of Object.entries(CATEGORY_DATA)) {
    if (tab === 'paints') continue;
    for (const item of items) {
      if (item.rewardOnly) continue;
      if (save.purchased[tab].includes(item.id)) continue;
      if (item.requires && !save.purchased[tab].includes(item.requires)) continue;
      if (save.electrons < item.costE || save.neutrons < item.costN) continue;
      affordable.push(item.name);
    }
  }
  if (!affordable.length) return '';
  const shown = affordable.slice(0, 6);
  const more = affordable.length > shown.length ? ` +${affordable.length - shown.length} more` : '';
  return `<p class="affordable-line"><b>You can now afford:</b> ${shown.join(', ')}${more}</p>`;
}

function applyChallengeRewards(result) {
  if (!result.challengeResults?.length) return '';
  const z = result.element.z;
  const stored = save.challenges[z] && typeof save.challenges[z] === 'object' ? save.challenges[z] : { completed: [] };
  const previous = new Set(Array.isArray(stored.completed) ? stored.completed : []);
  const passed = result.challengeResults.filter((item) => item.state === 'complete');
  const fresh = passed.filter((item) => !previous.has(item.id));
  const completed = unique([...previous, ...passed.map((item) => item.id)]);
  save.challenges[z] = { completed, medals: completed.length };

  if (fresh.length) {
    save.electrons += fresh.length * 50;
    save.neutrons += fresh.length * 2;
  }

  const rows = result.challengeResults.map((item) => (
    `<div class="challenge-result ${item.state}"><span><b>${item.title}</b><small>${item.description}</small></span><strong>${item.state === 'complete' ? 'Completed' : 'Missed'}</strong></div>`
  )).join('');
  const reward = fresh.length
    ? `<p class="challenge-reward">New medals: ${fresh.length} • Bonus ${fresh.length * 50} electrons / ${fresh.length * 2} neutrons</p>`
    : '';
  return `<section class="challenge-results"><h3>Challenges</h3>${rows}${reward}</section>`;
}

function levelComplete(result) {
  if (result.mode === 'marathon') {
    const nextIndex = result.element.z < 118 ? result.element.z : null;
    if (nextIndex !== null) {
      const nextState = normalizeMarathonState({ ...result.marathonState, index: nextIndex });
      save.marathonResume = nextState;
      persist();
      toast(`${result.element.symbol} cleared • Marathon continues`, 900);
      setTimeout(() => startGame(nextIndex, 'marathon', false, nextState), 650);
      return;
    }

    save.marathonResume = null;
    const comparison = finishMarathonRun(result.marathonState, true);
    const unlockedAchievements = checkAchievements();
    const unlockedRewards = evaluateProgressionRewards(save);
    persist();
    showModal(
      'Marathon Complete!',
      `<p>You cleared all 118 elements.</p><p><b>${result.score.toLocaleString()} points</b> • ${formatTime(result.marathonState?.runTime || result.time)} • ${result.marathonState?.runNeutrons || 0} neutrons</p>${comparison}${achievementMarkup(unlockedAchievements)}${progressionRewardMarkup(unlockedRewards)}`,
      [
        { label: 'Records', fn: () => { closeModal(); showScreen('records'); } },
        { label: 'Main menu', primary: true, fn: () => { closeModal(); showScreen('main'); } },
      ],
    );
    return;
  }

  if (result.mode === 'tutorial') {
    save.tutorialDone = true;
    persist();
    showModal(
      'Tutorial Complete!',
      `<p><b>${result.element.name}</b> destabilized.</p><p>You stripped the electron, survived the nucleus split, and collected the resulting particles.</p>`,
      [
        { label: 'Main menu', fn: () => { closeModal(); showScreen('main'); } },
        { label: 'Shop tutorial', primary: true, fn: () => { closeModal(); showScreen('shop'); runShopTutorial(); } },
      ],
    );
    return;
  }

  // Per-element score/time/neutron records and periodic-table completion are
  // Classic-mode progression, matching the APK's separate Marathon history.
  const previous = updateRecord(result);
  save.completed[result.element.z] = Math.max(save.completed[result.element.z] || 0, result.stars);
  save.unlocked = Math.max(save.unlocked, Math.min(118, result.element.z + 1));
  if (save.stats) {
    save.stats.levelsCompleted = Object.values(save.completed).filter(Boolean).length;
    if ((result.challengeMetrics?.shotsFired || Infinity) <= 12) save.stats.lowShotClear = true;
  }
  const challengeMarkup = applyChallengeRewards(result);
  const unlockedAchievements = checkAchievements();
  const unlockedRewards = evaluateProgressionRewards(save);
  persist();

  const next = result.element.z < 118 ? result.element.z : null;
  const record = save.records[result.element.z];
  showModal(
    'Level Completed!',
    `<p><b>${result.element.name}</b> destabilized.</p><p>${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} &nbsp; ${formatTime(result.time)} &nbsp; Score ${result.levelScore.toLocaleString()} &nbsp; Neutrons ${result.neutrons}</p>${comparisonMarkup(previous, result.levelScore)}<p class="best-line">Best: ${record.score.toLocaleString()} pts • ${formatTime(record.time)} • ${record.neutrons} neutrons</p>${challengeMarkup}${achievementMarkup(unlockedAchievements)}${progressionRewardMarkup(unlockedRewards)}${affordableItemsMarkup()}`,
    [
      { label: 'Main menu', fn: () => { closeModal(); showScreen('main'); } },
      ...(next !== null
        ? [{ label: 'Next element', primary: true, fn: () => { closeModal(); startGame(next, 'classic'); } }]
        : []),
    ],
  );
}

function bestMarathonBeforeCurrent() {
  if (!save.marathonHistory.length) return null;
  return save.marathonHistory.reduce((best, run) => (!best || run.score > best.score ? run : best), null);
}

function finishMarathonRun(state, completedAll = false) {
  const normalized = normalizeMarathonState(state, { allowDead: true }) || {
    index: 0, score: 0, lives: 0, nextExtraIndex: 0, runTime: 0, runNeutrons: 0,
  };
  const previousBest = bestMarathonBeforeCurrent();
  const run = {
    score: normalized.score,
    time: normalized.runTime,
    neutrons: normalized.runNeutrons,
    element: Math.min(118, normalized.index + 1),
    completed: Boolean(completedAll),
    at: Date.now(),
  };
  save.marathonHistory.push(run);
  save.marathonHistory = save.marathonHistory.slice(-10);
  if (save.stats) save.stats.marathonBestTime = Math.max(save.stats.marathonBestTime || 0, normalized.runTime || 0);

  if (!previousBest) return '<p class="muted">This is your first recorded Marathon.</p>';
  const delta = run.score - previousBest.score;
  if (delta > 0) return `<p class="comparison ahead">Comparing to your best run: <b>${delta.toLocaleString()} points ahead!</b></p>`;
  if (delta < 0) return `<p class="comparison behind">Comparing to your best run: <b>${Math.abs(delta).toLocaleString()} points behind.</b></p>`;
  return '<p class="comparison">Comparing to your best run: exact score tie.</p>';
}

function gameOver(result) {
  const explanation = `${result.element.name} won this round.`;

  if (result.mode === 'marathon') {
    save.marathonResume = null;
    const comparison = finishMarathonRun(result.marathonState, false);
    const unlockedAchievements = checkAchievements();
    const unlockedRewards = evaluateProgressionRewards(save);
    persist();
    showModal(
      'Marathon Over!',
      `<p>${explanation}</p><p>Score: <b>${result.score.toLocaleString()}</b> • Reached ${result.element.name}</p><p>${formatTime(result.marathonState?.runTime || result.time)} • ${result.marathonState?.runNeutrons || 0} neutrons</p>${comparison}${achievementMarkup(unlockedAchievements)}${progressionRewardMarkup(unlockedRewards)}`,
      [
        { label: 'Main menu', fn: () => { closeModal(); showScreen('main'); } },
        { label: 'New Marathon', primary: true, fn: () => { closeModal(); startGame(0, 'marathon', false, null); } },
      ],
    );
    return;
  }

  persist();
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
          startGame(gameContext.index, gameContext.mode, gameContext.tutorial, null);
        },
      },
    ],
  );
}

function nextControlMode() {
  const index = CONTROL_MODES.indexOf(save.settings.controlMode);
  save.settings.controlMode = CONTROL_MODES[(index + 1) % CONTROL_MODES.length];
  persist();
  applyControlSettings();
}

function controlModeLabel(mode) {
  if (mode === 'split') return 'Fly + Shoot + Aim';
  if (mode === 'dpad') return 'D-pad';
  return 'Shoot + Fly&Aim';
}

function showPause() {
  if (!game.running) return;
  if (!game.paused) game.setPaused(true);
  const state = game.mode === 'marathon' ? game.getMarathonState() : null;
  showModal(
    'Game Paused',
    `<p>${game.element.name} • Score ${game.score.toLocaleString()}${state ? ` • ${state.lives} ships` : ''}</p>`,
    [
      {
        label: `Controls: ${controlModeLabel(save.settings.controlMode)}`,
        className: 'pause-controls',
        fn: () => {
          nextControlMode();
          showPause();
        },
      },
      {
        label: 'Quit',
        className: 'pause-game',
        fn: () => {
          game.stop();
          closeModal();
          showScreen(game.mode === 'classic' ? 'table' : 'main');
        },
      },
      {
        label: 'Restart',
        className: 'pause-game',
        fn: () => {
          closeModal();
          if (game.mode === 'marathon') {
            save.marathonResume = null;
            persist();
            startGame(0, 'marathon', false, null);
          } else {
            startGame(gameContext.index, gameContext.mode, gameContext.tutorial, null);
          }
        },
      },
      { label: 'Resume', primary: true, className: 'pause-game', fn: () => { closeModal(); game.setPaused(false); } },
    ],
    false,
  );
  $('#modal').classList.add('pause-modal');
}

function runTutorial() {
  const box = $('#tutorial-callout');
  box.classList.remove('hidden');
  const steps = [
    'Welcome to Atom Shooter! This is your ship, flying inside the atom border.',
    'Pull the analog gently to aim. Pull it toward the border to fly.',
    'Tap FIRE on the other side — or press Space — to shoot. Weapons consume energy and recharge automatically.',
    'There are other control modes in Pause and Options. Give them a try!',
    'Shoot the orbiting electrons. Crossing inside the innermost orbit destroys your ship instantly until the nucleus explodes.',
    'Collect shot-down cyan electrons to earn shop currency.',
    'When every electron is stripped, the nucleus starts exploding.',
    'Avoid the red protons. Collect every blue neutron for an immediate win, or survive the timer.',
    'Starting from Beryllium, the nucleus pulls your ship. Take a moment to get used to flying against gravity.',
    'Temporary power-ups can restore ammo, stop electrons, suppress gravity, enhance collection, strengthen fire, or turn you into a ghost.',
    'After this level, the shop tutorial explains ships, weapon/engine stages, and module slots.',
  ];
  let index = 0;
  box.textContent = steps[0];
  clearInterval(tutorialTimer);
  tutorialTimer = setInterval(() => {
    if (currentScreen !== 'game' || !game.tutorial || !game.running) {
      clearInterval(tutorialTimer);
      return;
    }
    index += 1;
    if (index >= steps.length) {
      box.classList.add('hidden');
      clearInterval(tutorialTimer);
    } else {
      box.textContent = steps[index];
    }
  }, 4200);
}

function clearShopTutorialFocus() {
  $$('.tutorial-focus').forEach((element) => element.classList.remove('tutorial-focus'));
}

function closeShopTutorial() {
  const box = $('#shop-tutorial');
  if (!box) return;
  box.classList.add('hidden');
  box.innerHTML = '';
  clearShopTutorialFocus();
  shopTutorialStep = 0;
}

function runShopTutorial() {
  const box = $('#shop-tutorial');
  const steps = [
    { text: '<b>This is the shop.</b> Your current ship, weapon, engine, modules and particle wallet all meet here.', focus: '#shop-tabs' },
    { text: 'Use these category tabs to switch between Ships, Weapons, Engines, Modules and Paint.', focus: '#shop-tabs' },
    { text: 'Every item card shows its description, important stats and electron/neutron price. Upgrade stages must be bought in order.', focus: '#shop-grid .item-card' },
    { text: 'Weapon families and module families have upgrade tiers. A higher module tier replaces the lower equipped tier instead of stacking with it.', focus: '#shop-grid .item-card' },
    { text: 'The loadout bar shows what is equipped and how many module slots remain on the selected ship.', focus: '#loadout-panel' },
    { text: '<b>Shop tutorial complete.</b> Collect particles in levels, then come back here to build your loadout.', focus: null },
  ];
  shopTutorialStep = 0;
  box.classList.remove('hidden');

  const renderStep = () => {
    clearShopTutorialFocus();
    const step = steps[shopTutorialStep];
    const focus = step.focus ? $(step.focus) : null;
    focus?.classList.add('tutorial-focus');
    box.innerHTML = `<p>${step.text}</p><div class="tutorial-actions"><button data-shop-tutorial="skip">Skip</button><button class="primary" data-shop-tutorial="next">${shopTutorialStep === steps.length - 1 ? 'Done' : 'Next'}</button></div>`;
    box.querySelector('[data-shop-tutorial="skip"]').addEventListener('click', closeShopTutorial);
    box.querySelector('[data-shop-tutorial="next"]').addEventListener('click', () => {
      if (shopTutorialStep >= steps.length - 1) {
        closeShopTutorial();
        return;
      }
      shopTutorialStep += 1;
      renderStep();
    });
  };
  renderStep();
}

function renderRecords() {
  const root = $('#records-content');
  const records = ELEMENTS.filter((element) => save.records?.[element.z]);
  const bestMarathon = bestMarathonBeforeCurrent();
  const marathonRows = [...save.marathonHistory].reverse().slice(0, 10).map((run, index) => (
    `<tr><td>${index + 1}</td><td>${Number(run.score).toLocaleString()}</td><td>${run.completed ? '118 / 118' : `${run.element || 1} / 118`}</td><td>${formatTime(run.time)}</td><td>${run.neutrons || 0}</td></tr>`
  )).join('');
  const levelRows = records.map((element) => {
    const record = save.records[element.z];
    return `<tr><td>${element.z}</td><td><b>${element.symbol}</b> ${element.name}</td><td>${Number(record.score || 0).toLocaleString()}</td><td>${record.time ? formatTime(record.time) : '—'}</td><td>${record.neutrons || 0}</td></tr>`;
  }).join('');

  root.innerHTML = `
    <section class="record-summary">
      <article><small>ELEMENTS CLEARED</small><b>${Object.keys(save.completed).length} / 118</b></article>
      <article><small>BEST MARATHON</small><b>${bestMarathon ? Number(bestMarathon.score).toLocaleString() : '—'}</b></article>
      <article><small>MARATHON RUNS</small><b>${save.marathonHistory.length}</b></article>
    </section>
    <section class="records-card">
      <h3>Element bests</h3>
      ${levelRows ? `<div class="records-scroll"><table><thead><tr><th>#</th><th>Element</th><th>Best score</th><th>Best time</th><th>Neutrons</th></tr></thead><tbody>${levelRows}</tbody></table></div>` : '<p class="muted">Complete an element to create your first record.</p>'}
    </section>
    <section class="records-card">
      <h3>Marathon history</h3>
      ${marathonRows ? `<div class="records-scroll"><table><thead><tr><th>Run</th><th>Points</th><th>Progress</th><th>Time</th><th>Neutrons</th></tr></thead><tbody>${marathonRows}</tbody></table></div>` : '<p class="muted">No completed Marathon attempts yet.</p>'}
    </section>`;
}

function renderAchievements() {
  const root = $('#achievements-content');
  root.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const unlocked = Boolean(save.achievements?.[achievement.id]);
    const progress = getAchievementProgress(save, achievement);
    const percent = Math.round(progress.target ? progress.current / progress.target * 100 : 0);
    const progressLabel = achievement.id.startsWith('marathon-')
      ? `${formatTime(progress.current)} / ${formatTime(progress.target)}`
      : `${Math.round(progress.current).toLocaleString()} / ${Math.round(progress.target).toLocaleString()}`;
    return `<article class="achievement-card ${unlocked ? 'unlocked' : 'locked'}"><div class="achievement-mark">${unlocked ? '✓' : ''}</div><div><small>${unlocked ? 'UNLOCKED' : 'IN PROGRESS'}</small><h3>${achievement.title}</h3><p>${achievement.description}</p><div class="achievement-progress"><i style="width:${Math.min(100, percent)}%"></i></div><span>${progressLabel}</span></div></article>`;
  }).join('');
  const groups = getProgressionRewardStatus(save);
  root.insertAdjacentHTML('beforeend', `<section class="completion-rewards"><h3>Periodic-table rewards</h3>
    <div><b>Alkali metals</b><span>${groups.alkali.current}/${groups.alkali.target}</span><small>Alkali Stabilizer + paint</small></div>
    <div><b>Noble gases</b><span>${groups.noble.current}/${groups.noble.target}</span><small>Noble Aurora paint</small></div>
    <div><b>Transition metals</b><span>${groups.transition.current}/${groups.transition.target}</span><small>Rail Cannon</small></div>
    <div><b>Radioactive elements</b><span>${groups.radioactive.current}/${groups.radioactive.target}</span><small>Achievement + Radioactive Glow</small></div>
    <div><b>Entire table</b><span>${groups.full.current}/${groups.full.target}</span><small>Quark ship + Periodic Prism</small></div>
  </section>`);
}

function renderCodex() {
  const root = $('#codex-content');
  root.innerHTML = ELEMENTS.map((element) => {
    const unlocked = Boolean(save.completed?.[element.z]);
    if (!unlocked) return `<article class="codex-card locked"><span class="codex-number">${element.z}</span><b>${element.symbol}</b><p>Complete ${element.name} to unlock.</p></article>`;
    const metadata = getElementMetadata(element);
    const record = save.records?.[element.z];
    const mass = Number.isInteger(metadata.mass) && element.z >= 43 ? `[${metadata.mass}]` : metadata.mass;
    return `<article class="codex-card"><header><span class="codex-number">${element.z}</span><b>${element.symbol}</b><h3>${element.name}</h3></header><dl><div><dt>Atomic mass</dt><dd>${mass}</dd></div><div><dt>Category</dt><dd>${metadata.category}</dd></div></dl><p>${metadata.fact}</p><footer>${record ? `Best ${Number(record.score || 0).toLocaleString()} pts • ${formatTime(record.time || 0)}` : 'Completed'}</footer></article>`;
  }).join('');
}

function showModal(title, body, actions, allowBackdrop = true) {
  const modal = $('#modal');
  modal.classList.remove('pause-modal');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const actionRoot = $('#modal-actions');
  actionRoot.innerHTML = '';

  for (const action of actions) {
    const button = document.createElement('button');
    button.textContent = action.label;
    if (action.primary) button.classList.add('primary');
    if (action.className) button.classList.add(...action.className.split(/\s+/).filter(Boolean));
    button.addEventListener('click', action.fn);
    actionRoot.appendChild(button);
  }

  modal.classList.remove('hidden');
  modal.dataset.backdrop = allowBackdrop ? '1' : '0';
}

function closeModal() {
  const modal = $('#modal');
  modal.classList.add('hidden');
  modal.classList.remove('pause-modal');
  $('#modal-actions').innerHTML = '';
}

function showAbout() {
  showModal(
    'About Atom Shooter',
    `<div class="about-content">
      <section class="about-section">
        <h3>About the game</h3>
        <p><b>Atom Shooter</b> is an independent modern remake of the original 2013 Android game. Pilot a nano ship through all 118 elements, strip their electrons, break the nucleus, collect particles and upgrade your loadout.</p>
      </section>
      <section class="about-section">
        <h3>Updates & downloads</h3>
        <p>Get the newest Windows and Android builds, plus release notes, from the official GitHub Releases page.</p>
        <a class="about-link" href="https://github.com/Draconov/Atom-Shooter/releases/latest" target="_blank" rel="noreferrer">Download latest release ↗</a>
      </section>
      <section class="about-section">
        <h3>Developer</h3>
        <p>Developed and maintained by <b>Draconov</b>.</p>
        <a class="about-link secondary" href="https://github.com/Draconov" target="_blank" rel="noreferrer">About the developer ↗</a>
      </section>
    </div>`,
    [{ label: 'Close', primary: true, fn: closeModal }],
  );
}

function syncSettings() {
  const settings = save.settings;
  $('#setting-sfx-volume').value = Math.round(settings.sfxVolume * 100);
  $('#setting-music-volume').value = Math.round(settings.musicVolume * 100);
  $('#setting-sfx-volume-value').textContent = `${Math.round(settings.sfxVolume * 100)}%`;
  $('#setting-music-volume-value').textContent = `${Math.round(settings.musicVolume * 100)}%`;
  $('#setting-side').value = settings.side;
  $('#setting-stick').value = settings.stick;
  $('#setting-deadzone').value = settings.deadzone;
  $('#setting-control').value = settings.controlMode;
  $('#setting-effects').value = settings.effects || 'full';
}

function saveSettings() {
  save.settings = {
    sfxVolume: Number($('#setting-sfx-volume').value) / 100,
    musicVolume: Number($('#setting-music-volume').value) / 100,
    side: $('#setting-side').value,
    stick: $('#setting-stick').value,
    deadzone: Number($('#setting-deadzone').value),
    controlMode: $('#setting-control').value,
    effects: $('#setting-effects').value,
  };
  if (!CONTROL_MODES.includes(save.settings.controlMode)) save.settings.controlMode = 'combined';
  $('#setting-sfx-volume-value').textContent = `${Math.round(save.settings.sfxVolume * 100)}%`;
  $('#setting-music-volume-value').textContent = `${Math.round(save.settings.musicVolume * 100)}%`;
  audio.configure(save.settings);
  if (save.settings.musicVolume > 0) audio.unlock();
  persist();
  applyControlSettings();
}

function applyControlSettings() {
  const controls = $('#touch-controls');
  controls.classList.toggle('controls-left', save.settings.side === 'left');
  controls.classList.remove('stick-small', 'stick-medium', 'stick-large', 'mode-combined', 'mode-split', 'mode-dpad');
  controls.classList.add(`stick-${save.settings.stick}`, `mode-${save.settings.controlMode}`);
}

function toast(message, duration = 1800) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), duration);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function resetSave() {
  save = structuredClone(DEFAULT_SAVE);
  persist();
  audio.configure(save.settings);
  closeModal();
  syncSettings();
  updateWallets();
  toast('Progress reset');
}

$$('[data-action]').forEach((button) => button.addEventListener('click', () => {
  audio.unlock();
  const action = button.dataset.action;
  if (action === 'classic') showScreen('table');
  if (action === 'marathon') beginMarathon();
  if (action === 'tutorial') startGame(0, 'tutorial', true, null);
  if (action === 'shop') showScreen('shop');
  if (action === 'records') showScreen('records');
  if (action === 'achievements') showScreen('achievements');
  if (action === 'codex') showScreen('codex');
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
      '<p>This deletes unlocked elements, records, challenges, achievements, Marathon history, currency and purchases on this device.</p>',
      [
        { label: 'Cancel', fn: closeModal },
        { label: 'Reset', primary: true, fn: resetSave },
      ],
    );
  }
}));

$$('#shop-tabs button').forEach((button) => button.addEventListener('click', () => {
  shopTab = button.dataset.tab;
  renderShop();
}));

for (const id of ['setting-sfx-volume', 'setting-music-volume', 'setting-side', 'setting-stick', 'setting-deadzone', 'setting-control', 'setting-effects']) {
  $(`#${id}`).addEventListener('input', saveSettings);
}

$('#pause-btn').addEventListener('click', showPause);
$('#modal').addEventListener('click', (event) => {
  if (event.target === $('#modal') && $('#modal').dataset.backdrop === '1') closeModal();
});

function bindJoystick(element, knob, setter) {
  let pointer = null;
  const move = (event) => {
    if (event.pointerId !== pointer) return;
    const rect = element.getBoundingClientRect();
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
    setter(nx, ny, magnitude);
  };
  const release = (event) => {
    if (event?.pointerId !== undefined && event.pointerId !== pointer) return;
    pointer = null;
    knob.style.transform = 'translate(0,0)';
    setter(0, 0, 0);
  };
  element.addEventListener('pointerdown', (event) => {
    pointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    audio.unlock();
    move(event);
  });
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
}

bindJoystick($('#joystick'), $('#joystick-knob'), (x, y, mag) => game.setJoystick(x, y, mag));
bindJoystick($('#aim-joystick'), $('#aim-joystick-knob'), (x, y, mag) => game.setAimJoystick(x, y, mag));

const fire = $('#fire-control');
fire.addEventListener('pointerdown', (event) => {
  fire.setPointerCapture(event.pointerId);
  game.setFire(true);
});
fire.addEventListener('pointerup', () => game.setFire(false));
fire.addEventListener('pointercancel', () => game.setFire(false));

$$('[data-dpad]').forEach((button) => {
  const direction = button.dataset.dpad;
  button.addEventListener('pointerdown', (event) => {
    button.setPointerCapture(event.pointerId);
    audio.unlock();
    game.setDpad(direction, true);
  });
  button.addEventListener('pointerup', () => game.setDpad(direction, false));
  button.addEventListener('pointercancel', () => game.setDpad(direction, false));
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0) game.setDpad(direction, false);
  });
});

async function preloadGameAssets() {
  const paths = [
    'assets/icon-192.png',
    ...SHIPS.map((item) => getShopAssetPath('ships', item)),
    ...WEAPONS.map((item) => getShopAssetPath('weapons', item)),
    ...ENGINES.map((item) => getShopAssetPath('engines', item)),
    ...MODULES.map((item) => getShopAssetPath('modules', item)),
  ];
  const uniquePaths = unique(paths);
  let loaded = 0;
  const fill = $('#loading-fill');
  const label = $('#loading-label');

  const update = () => {
    const percent = Math.round((loaded / uniquePaths.length) * 100);
    fill.style.width = `${percent}%`;
    label.textContent = `Loading systems… ${percent}%`;
  };
  update();

  await Promise.allSettled(uniquePaths.map((src) => new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      loaded += 1;
      update();
      resolve();
    };
    image.onload = done;
    image.onerror = done;
    image.src = src;
    if (image.complete) queueMicrotask(done);
  })));
}

window.addEventListener('beforeunload', persist);

async function bootstrap() {
  applyControlSettings();
  persist();
  showScreen('splash');
  await preloadGameAssets();
  await new Promise((resolve) => setTimeout(resolve, 180));
  showScreen('main');
}

bootstrap();
