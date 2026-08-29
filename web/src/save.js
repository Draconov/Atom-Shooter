import { SHIPS, WEAPONS, ENGINES, MODULES, findById } from './data.js';

export const SAVE_SCHEMA = 3;

export const DEFAULT_SAVE = {
  version: SAVE_SCHEMA,
  unlocked: 1,
  completed: {},
  records: {},
  electrons: 0,
  neutrons: 0,
  purchased: {
    ships: ['pico'],
    weapons: ['blaster'],
    engines: ['vrocket'],
    modules: [],
  },
  selectedShip: 'pico',
  selectedWeapon: 'blaster',
  selectedEngine: 'vrocket',
  selectedModules: [],
  tutorialDone: false,
  marathonHistory: [],
  marathonResume: null,
  settings: {
    sfx: true,
    music: true,
    side: 'right',
    stick: 'medium',
    deadzone: 0.38,
    controlMode: 'combined',
  },
};

const CONTROL_MODES = new Set(['combined', 'split', 'dpad']);
const CATEGORY_DATA = { ships: SHIPS, weapons: WEAPONS, engines: ENGINES, modules: MODULES };
const unique = (values) => [...new Set(values.filter(Boolean))];
const validIds = (tab) => new Set(CATEGORY_DATA[tab].map((item) => item.id));

function normalizeIdArray(values, valid) {
  return unique((Array.isArray(values) ? values : []).filter((id) => valid.has(id)));
}

function ensureOwned(purchased, tab, id) {
  if (id && !purchased[tab].includes(id)) purchased[tab].push(id);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeMarathonState(state, { allowDead = false } = {}) {
  if (!state || typeof state !== 'object') return null;
  const index = Math.max(0, Math.min(117, Number(state.index) || 0));
  const lives = Number(state.lives);
  if (!Number.isFinite(lives) || (!allowDead && lives <= 0)) return null;
  return {
    index,
    score: Math.max(0, Number(state.score) || 0),
    lives: allowDead ? Math.max(0, Math.floor(lives)) : Math.max(1, Math.floor(lives)),
    nextExtraIndex: Math.max(0, Math.floor(Number(state.nextExtraIndex) || 0)),
    runTime: Math.max(0, Number(state.runTime) || 0),
    runNeutrons: Math.max(0, Math.floor(Number(state.runNeutrons) || 0)),
  };
}

export function normalizeSave(stored) {
  if (!stored || typeof stored !== 'object' || Number(stored.version) !== SAVE_SCHEMA) {
    return structuredClone(DEFAULT_SAVE);
  }

  const purchased = {
    ships: normalizeIdArray(stored.purchased?.ships, validIds('ships')),
    weapons: normalizeIdArray(stored.purchased?.weapons, validIds('weapons')),
    engines: normalizeIdArray(stored.purchased?.engines, validIds('engines')),
    modules: normalizeIdArray(stored.purchased?.modules, validIds('modules')),
  };
  for (const tab of Object.keys(purchased)) {
    purchased[tab] = unique([...DEFAULT_SAVE.purchased[tab], ...purchased[tab]]);
  }

  const selectedShip = validIds('ships').has(stored.selectedShip) ? stored.selectedShip : DEFAULT_SAVE.selectedShip;
  const selectedWeapon = validIds('weapons').has(stored.selectedWeapon) ? stored.selectedWeapon : DEFAULT_SAVE.selectedWeapon;
  const selectedEngine = validIds('engines').has(stored.selectedEngine) ? stored.selectedEngine : DEFAULT_SAVE.selectedEngine;

  ensureOwned(purchased, 'ships', selectedShip);
  ensureOwned(purchased, 'weapons', selectedWeapon);
  ensureOwned(purchased, 'engines', selectedEngine);

  const settings = { ...DEFAULT_SAVE.settings, ...plainObject(stored.settings) };
  if (!CONTROL_MODES.has(settings.controlMode)) settings.controlMode = DEFAULT_SAVE.settings.controlMode;

  let selectedModules = normalizeIdArray(stored.selectedModules, validIds('modules'));
  selectedModules.forEach((id) => ensureOwned(purchased, 'modules', id));

  const familySlots = new Map();
  for (const id of selectedModules) {
    const module = MODULES.find((item) => item.id === id);
    if (module) familySlots.set(module.family, id);
  }
  selectedModules = [...familySlots.values()];
  const ship = findById(SHIPS, selectedShip);
  selectedModules = ship.slots > 0 ? selectedModules.slice(0, ship.slots) : [];

  const marathonHistory = Array.isArray(stored.marathonHistory)
    ? stored.marathonHistory.filter((run) => run && Number.isFinite(Number(run.score))).slice(-10)
    : [];

  return {
    version: SAVE_SCHEMA,
    unlocked: Math.max(1, Math.min(118, Math.floor(Number(stored.unlocked) || 1))),
    completed: plainObject(stored.completed),
    records: plainObject(stored.records),
    electrons: Math.max(0, Math.floor(Number(stored.electrons) || 0)),
    neutrons: Math.max(0, Math.floor(Number(stored.neutrons) || 0)),
    purchased,
    selectedShip,
    selectedWeapon,
    selectedEngine,
    selectedModules,
    tutorialDone: Boolean(stored.tutorialDone),
    marathonHistory,
    marathonResume: normalizeMarathonState(stored.marathonResume),
    settings,
  };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem?.('atom-shooter-save') || 'null');
    return stored ? normalizeSave(stored) : structuredClone(DEFAULT_SAVE);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}
