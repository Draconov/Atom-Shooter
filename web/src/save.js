import { SHIPS, WEAPONS, ENGINES, MODULES, findById } from './data.js';

export const SAVE_SCHEMA = 3;

export const DEFAULT_SAVE = {
  version: SAVE_SCHEMA,
  unlocked: 1,
  completed: {},
  best: {},
  records: {},
  electrons: 0,
  neutrons: 0,
  purchased: {
    ships: ['pico'],
    weapons: ['blaster2'],
    engines: ['vrocket'],
    modules: [],
  },
  selectedShip: 'pico',
  selectedWeapon: 'blaster2',
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
const OLD_ENGINE_MAP = {
  project1: 'vrocket',
  project2: 'vrocketx',
  project3: 'vrocketdx',
  vrocket: 'qray',
  solar: 'solar',
};
const OLD_WEAPON_MAP = { railgun: 'blaster4' };
const OLD_MODULE_MAP = {
  collector: 'collector',
  lowgrav: 'lowgrav',
  fastfire: 'fastfire',
  projectile: 'fastfire',
  size: 'small',
  slowel: 'slowel',
  timewarp: 'timewarp',
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const validIds = (tab) => new Set(CATEGORY_DATA[tab].map((item) => item.id));

function migrateIdArray(values, map, valid) {
  return unique((values || []).map((id) => map[id] || id).filter((id) => valid.has(id)));
}

function ensureOwned(purchased, tab, id) {
  if (id && !purchased[tab].includes(id)) purchased[tab].push(id);
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

export function mergeSave(stored) {
  const incoming = stored && typeof stored === 'object' ? stored : {};
  const oldSchema = Number(incoming.version ?? 1);
  const isLegacy = oldSchema < SAVE_SCHEMA;

  const purchased = {
    ships: migrateIdArray(incoming.purchased?.ships, {}, validIds('ships')),
    weapons: migrateIdArray(incoming.purchased?.weapons, isLegacy ? OLD_WEAPON_MAP : {}, validIds('weapons')),
    engines: migrateIdArray(incoming.purchased?.engines, isLegacy ? OLD_ENGINE_MAP : {}, validIds('engines')),
    modules: migrateIdArray(incoming.purchased?.modules, isLegacy ? OLD_MODULE_MAP : {}, validIds('modules')),
  };
  for (const tab of Object.keys(purchased)) {
    purchased[tab] = unique([...DEFAULT_SAVE.purchased[tab], ...purchased[tab]]);
  }

  // In 1.1.x Q-Ray was incorrectly implemented as a projectile-speed module.
  // 1.2.0 restores Q-Ray to the engine chain. Preserve both the old module's
  // functional benefit (FastFire = projectile velocity in the APK) and the
  // named Q-Ray purchase when migrating an existing save.
  const legacyQRayOwned = isLegacy && (
    incoming.purchased?.modules?.includes?.('projectile')
    || incoming.selectedModules?.includes?.('projectile')
  );
  if (legacyQRayOwned && !purchased.engines.includes('qray')) purchased.engines.push('qray');

  const selectedShip = validIds('ships').has(incoming.selectedShip) ? incoming.selectedShip : DEFAULT_SAVE.selectedShip;
  const migratedWeapon = isLegacy ? (OLD_WEAPON_MAP[incoming.selectedWeapon] || incoming.selectedWeapon) : incoming.selectedWeapon;
  const migratedEngine = isLegacy ? (OLD_ENGINE_MAP[incoming.selectedEngine] || incoming.selectedEngine) : incoming.selectedEngine;
  const selectedWeapon = validIds('weapons').has(migratedWeapon) ? migratedWeapon : DEFAULT_SAVE.selectedWeapon;
  const selectedEngine = validIds('engines').has(migratedEngine) ? migratedEngine : DEFAULT_SAVE.selectedEngine;

  ensureOwned(purchased, 'ships', selectedShip);
  ensureOwned(purchased, 'weapons', selectedWeapon);
  ensureOwned(purchased, 'engines', selectedEngine);

  const settings = { ...DEFAULT_SAVE.settings, ...(incoming.settings || {}) };
  if ((incoming.version ?? 1) < 2) settings.music = true;
  if (!CONTROL_MODES.has(settings.controlMode)) settings.controlMode = 'combined';

  const records = { ...(incoming.records || {}) };
  for (const [z, score] of Object.entries(incoming.best || {})) {
    const current = records[z] || {};
    records[z] = {
      score: Math.max(Number(current.score) || 0, Number(score) || 0),
      time: Math.max(0, Number(current.time) || 0),
      neutrons: Math.max(0, Number(current.neutrons) || 0),
    };
  }

  let selectedModules = migrateIdArray(
    incoming.selectedModules,
    isLegacy ? OLD_MODULE_MAP : {},
    validIds('modules'),
  );
  selectedModules.forEach((id) => ensureOwned(purchased, 'modules', id));

  const familySlots = new Map();
  for (const id of selectedModules) {
    const module = MODULES.find((item) => item.id === id);
    if (module) familySlots.set(module.family, id);
  }
  selectedModules = [...familySlots.values()];
  const ship = findById(SHIPS, selectedShip);
  selectedModules = ship.slots > 0 ? selectedModules.slice(0, ship.slots) : [];

  const history = Array.isArray(incoming.marathonHistory)
    ? incoming.marathonHistory.filter((run) => run && Number.isFinite(Number(run.score))).slice(-10)
    : [];

  return {
    ...structuredClone(DEFAULT_SAVE),
    ...incoming,
    version: SAVE_SCHEMA,
    purchased,
    selectedShip,
    selectedWeapon,
    selectedEngine,
    selectedModules,
    settings,
    records,
    completed: incoming.completed || {},
    best: incoming.best || {},
    marathonHistory: history,
    marathonResume: normalizeMarathonState(incoming.marathonResume),
  };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem?.('atom-shooter-save') || 'null');
    return stored ? mergeSave(stored) : structuredClone(DEFAULT_SAVE);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}
