import { SHIPS, WEAPONS, ENGINES, MODULES } from './data.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const set = (...values) => new Set(values);

const ALKALI = set(3, 11, 19, 37, 55, 87);
const ALKALINE = set(4, 12, 20, 38, 56, 88);
const NOBLE = set(2, 10, 18, 36, 54, 86, 118);
const HALOGEN = set(9, 17, 35, 53, 85, 117);
const METALLOID = set(5, 14, 32, 33, 51, 52);
const OTHER_NONMETAL = set(1, 6, 7, 8, 15, 16, 34);
const RADIOACTIVE = new Set([43, 61, ...Array.from({ length: 35 }, (_, i) => 84 + i)]);

const ATOMIC_MASSES = [
  1.008,4.0026,6.94,9.0122,10.81,12.011,14.007,15.999,18.998,20.180,
  22.990,24.305,26.982,28.085,30.974,32.06,35.45,39.948,39.098,40.078,
  44.956,47.867,50.942,51.996,54.938,55.845,58.933,58.693,63.546,65.38,
  69.723,72.630,74.922,78.971,79.904,83.798,85.468,87.62,88.906,91.224,
  92.906,95.95,98,101.07,102.906,106.42,107.868,112.414,114.818,118.710,
  121.760,127.60,126.904,131.293,132.905,137.327,138.905,140.116,140.908,144.242,
  145,150.36,151.964,157.25,158.925,162.500,164.930,167.259,168.934,173.045,
  174.967,178.49,180.948,183.84,186.207,190.23,192.217,195.084,196.967,200.592,
  204.38,207.2,208.980,209,210,222,223,226,227,232.038,
  231.036,238.029,237,244,243,247,247,251,252,257,
  258,259,266,267,268,269,270,277,278,281,
  282,285,286,289,290,293,294,294,
];

const FACTS = {
  1:'Hydrogen is the lightest and most abundant element in the universe.',
  2:'Helium was identified in the Sun before it was found on Earth.',
  3:'Lithium is widely used in rechargeable batteries.',
  6:'Carbon forms the backbone of known biological molecules.',
  7:'Nitrogen makes up most of Earth’s atmosphere.',
  8:'Oxygen is essential to aerobic respiration and supports combustion.',
  10:'Neon is famous for the bright red-orange glow of neon signs.',
  11:'Sodium reacts vigorously with water and is part of common table salt.',
  13:'Aluminium is lightweight, corrosion-resistant and widely used in aircraft.',
  14:'Silicon is a central material in modern semiconductor electronics.',
  17:'Chlorine is used to disinfect drinking water and swimming pools.',
  18:'Argon is an inert gas often used to shield welding from the atmosphere.',
  19:'Potassium is an essential electrolyte for nerves and muscles.',
  20:'Calcium is a major structural component of bones and teeth.',
  26:'Iron is the main metal in steel and a key element in hemoglobin.',
  27:'Cobalt is used in high-performance alloys and many rechargeable batteries.',
  28:'Nickel improves corrosion resistance in stainless steel.',
  29:'Copper is valued for its excellent electrical conductivity.',
  30:'Zinc is commonly used to protect steel from corrosion by galvanizing.',
  35:'Bromine is one of only two elements that are liquid near room temperature.',
  36:'Krypton is a noble gas used in specialized lighting and lasers.',
  47:'Silver has the highest electrical conductivity of any element.',
  50:'Tin has long been used in alloys such as bronze and solder.',
  53:'Iodine is required by the thyroid to make important hormones.',
  54:'Xenon is used in high-intensity lamps and some ion-thruster systems.',
  55:'Caesium is used in highly precise atomic clocks.',
  74:'Tungsten has the highest melting point of any pure metal.',
  78:'Platinum is valued both as a catalyst and as a corrosion-resistant metal.',
  79:'Gold is extremely malleable and resists corrosion exceptionally well.',
  80:'Mercury is the only metallic element that is liquid at room temperature.',
  82:'Lead is dense, soft and effective at absorbing ionizing radiation.',
  92:'Uranium is the heaviest naturally abundant element used as nuclear fuel.',
  94:'Plutonium is a radioactive element used in nuclear energy and space power systems.',
  95:'Americium is used in small quantities in many ionization smoke detectors.',
  118:'Oganesson is a synthetic superheavy element with only a few atoms ever produced.',
};

export function getElementCategory(z) {
  const atomicNumber = clamp(Math.round(Number(z) || 1), 1, 118);
  if (NOBLE.has(atomicNumber)) return 'Noble gas';
  if (ALKALI.has(atomicNumber)) return 'Alkali metal';
  if (ALKALINE.has(atomicNumber)) return 'Alkaline earth metal';
  if (HALOGEN.has(atomicNumber)) return 'Halogen';
  if (OTHER_NONMETAL.has(atomicNumber)) return 'Nonmetal';
  if (METALLOID.has(atomicNumber)) return 'Metalloid';
  if (atomicNumber >= 57 && atomicNumber <= 71) return 'Lanthanide';
  if (atomicNumber >= 89 && atomicNumber <= 103) return 'Actinide';
  if ((atomicNumber >= 21 && atomicNumber <= 30)
    || (atomicNumber >= 39 && atomicNumber <= 48)
    || (atomicNumber >= 72 && atomicNumber <= 80)
    || (atomicNumber >= 104 && atomicNumber <= 112)) return 'Transition metal';
  return 'Post-transition metal';
}

export function getElementMetadata(elementOrZ) {
  const z = clamp(Math.round(Number(elementOrZ?.z ?? elementOrZ) || 1), 1, 118);
  const category = getElementCategory(z);
  return {
    z,
    mass: ATOMIC_MASSES[z - 1],
    category,
    fact: FACTS[z] || `Atomic number ${z} is classified as a ${category.toLowerCase()} in the periodic table.`,
  };
}

export function getElementBehavior(elementOrZ) {
  const z = clamp(Math.round(Number(elementOrZ?.z ?? elementOrZ) || 1), 1, 118);
  const tags = [];
  const descriptions = [];
  const profile = {
    electronSpeed: 1,
    electronHp: 1,
    orbitEccentricity: 0,
    orbitPrecession: 0,
    gravity: 1,
    instabilityTime: 1,
    protonInterval: 0,
    gravityDistortion: 0,
  };

  if (ALKALI.has(z)) {
    tags.push('Unstable alkali');
    descriptions.push('Fast, restless electrons');
    profile.electronSpeed *= 1.34;
    profile.instabilityTime *= 0.9;
  }
  if (NOBLE.has(z)) {
    tags.push('Stable shell');
    descriptions.push('Electron shells take extra punishment');
    profile.electronHp *= 1.35;
    profile.electronSpeed *= 0.92;
  }
  if ((z >= 21 && z <= 30) || (z >= 39 && z <= 48) || (z >= 72 && z <= 80)) {
    tags.push('Dense orbitals');
    descriptions.push('Elliptical, precessing electron paths');
    profile.orbitEccentricity = 0.14;
    profile.orbitPrecession = 0.06;
  }
  if (RADIOACTIVE.has(z)) {
    tags.push('Radioactive');
    descriptions.push('The nucleus can emit stray protons');
    profile.protonInterval = clamp(12 - Math.max(0, z - 84) * 0.11, 6.5, 12);
  }
  if (z >= 104) {
    tags.push('Superheavy');
    descriptions.push('Extreme gravity and rapid nucleus instability');
    profile.gravity *= 1.38;
    profile.instabilityTime *= 0.72;
    profile.gravityDistortion = 1;
    profile.protonInterval = profile.protonInterval ? Math.min(profile.protonInterval, 6.5) : 7.5;
  } else if (z >= 70) {
    profile.gravityDistortion = (z - 69) / 49;
  }

  return {
    ...profile,
    tags,
    label: tags.length ? tags.join(' • ') : getElementCategory(z),
    description: descriptions.join(' · ') || 'Standard orbital behavior',
  };
}

const CHALLENGE_TYPES = ['no-life-loss', 'all-neutrons', 'electron-time', 'no-powerups', 'weapon', 'no-proton-damage'];
const WEAPON_NAMES = Object.fromEntries(WEAPONS.map((item) => [item.id, item.name]));

function challengeWeaponFor(z) {
  if (z <= 18) return 'blaster';
  if (z <= 36) return 'blaster2';
  if (z <= 54) return 'blaster3';
  if (z <= 72) return 'gatling';
  if (z <= 90) return 'burster';
  return 'blaster4';
}

export function getElementChallenges(elementOrZ) {
  const z = clamp(Math.round(Number(elementOrZ?.z ?? elementOrZ) || 1), 1, 118);
  const electronTimeTarget = Math.round(20 + z * 0.65);
  const requiredWeapon = challengeWeaponFor(z);
  const catalogue = {
    'no-life-loss': { type:'no-life-loss', title:'Untouched', description:'Finish without losing a life.' },
    'all-neutrons': { type:'all-neutrons', title:'Clean Sweep', description:'Collect every blue neutron.' },
    'electron-time': { type:'electron-time', title:'Fast Strip', description:`Clear all electrons within ${electronTimeTarget}s.`, target:electronTimeTarget },
    'no-powerups': { type:'no-powerups', title:'Pure Skill', description:'Finish without collecting a power-up.' },
    weapon: { type:'weapon', title:'Weapon Trial', description:`Finish using ${WEAPON_NAMES[requiredWeapon] || requiredWeapon}.`, weaponId:requiredWeapon },
    'no-proton-damage': { type:'no-proton-damage', title:'Proton Proof', description:'Take no proton damage.' },
  };
  const start = (z - 1) % CHALLENGE_TYPES.length;
  return [0, 2, 4].map((offset) => {
    const base = catalogue[CHALLENGE_TYPES[(start + offset) % CHALLENGE_TYPES.length]];
    return { ...base, id:`${z}:${base.type}` };
  });
}

export function getChallengeState(challenge, metrics = {}, final = false) {
  const failed = 'failed';
  const complete = 'complete';
  const pending = 'pending';
  if (!challenge) return pending;

  if (challenge.type === 'no-life-loss') {
    if ((metrics.livesLost || 0) > 0) return failed;
    return final ? complete : pending;
  }
  if (challenge.type === 'all-neutrons') {
    const total = Number(metrics.neutronTotal || 0);
    const collected = Number(metrics.neutronCollected || 0);
    if (total > 0 && collected >= total) return complete;
    return final ? failed : pending;
  }
  if (challenge.type === 'electron-time') {
    if (Number.isFinite(metrics.electronClearTime)) return metrics.electronClearTime <= challenge.target ? complete : failed;
    if ((metrics.elapsed || 0) > challenge.target) return failed;
    return pending;
  }
  if (challenge.type === 'no-powerups') {
    if ((metrics.powerupsUsed || 0) > 0) return failed;
    return final ? complete : pending;
  }
  if (challenge.type === 'weapon') {
    if (metrics.weaponId !== challenge.weaponId) return failed;
    return final ? complete : pending;
  }
  if (challenge.type === 'no-proton-damage') {
    if ((metrics.protonHits || 0) > 0) return failed;
    return final ? complete : pending;
  }
  return pending;
}

export const MARATHON_MODIFIERS = Object.freeze([
  { id:'strong-gravity', name:'Strong Gravity', description:'Nucleus pull is 55% stronger.', gravity:1.55 },
  { id:'hyper-electrons', name:'Hyper Electrons', description:'Electrons orbit 45% faster.', electronSpeed:1.45 },
  { id:'proton-storm', name:'Proton Storm', description:'The nucleus emits frequent stray protons.', protonInterval:4.25 },
  { id:'tiny-ship', name:'Tiny Ship', description:'Your ship is 28% smaller.', shipSize:0.72 },
  { id:'rapid-fire', name:'Rapid Fire', description:'Weapons cycle 50% faster.', fireRate:1.5, energyRegen:1.3 },
  { id:'no-powerups', name:'No Power-Ups', description:'Temporary power-ups do not spawn.', noPowerups:true },
  { id:'double-neutrons', name:'Double Neutrons', description:'Collected neutrons award double currency.', neutronReward:2 },
  { id:'time-distortion', name:'Time Distortion', description:'Hostile orbital motion runs 25% faster.', hostileTime:1.25 },
]);

export function getMarathonModifier(elementIndex, seed = 0) {
  const index = clamp(Math.floor(Number(elementIndex) || 0), 0, 117);
  if ((index + 1) % 3 !== 0) return null;
  const cycle = Math.floor((index + 1) / 3);
  const safeSeed = Math.abs(Math.floor(Number(seed) || 0));
  return MARATHON_MODIFIERS[(safeSeed + cycle * 7) % MARATHON_MODIFIERS.length];
}

export const ACHIEVEMENTS = Object.freeze([
  { id:'hydrogen', title:'First Split', description:'Complete Hydrogen.', target:1 },
  { id:'uranium', title:'Into the Heavy End', description:'Reach Uranium.', target:92 },
  { id:'full-table', title:'Periodic Master', description:'Complete all 118 elements.', target:118 },
  { id:'marathon-10', title:'Long Run', description:'Survive 10 minutes in Marathon.', target:600 },
  { id:'marathon-30', title:'Endurance', description:'Survive 30 minutes in Marathon.', target:1800 },
  { id:'marathon-60', title:'Infinite Focus', description:'Survive 60 minutes in Marathon.', target:3600 },
  { id:'neutron-1000', title:'Neutron Hoard', description:'Collect 1,000 neutrons across all runs.', target:1000 },
  { id:'precision', title:'Trigger Discipline', description:'Complete a level using no more than 12 shots.', target:1 },
  { id:'arsenal', title:'Fully Equipped', description:'Own every ship, weapon, engine and module.', target:1 },
]);

function completedCount(save) {
  return Object.values(save.completed || {}).filter(Boolean).length;
}

function ownsEverything(save) {
  const purchased = save.purchased || {};
  return (purchased.ships?.length || 0) >= SHIPS.length
    && (purchased.weapons?.length || 0) >= WEAPONS.length
    && (purchased.engines?.length || 0) >= ENGINES.length
    && (purchased.modules?.length || 0) >= MODULES.length;
}

export function getAchievementProgress(save, achievement) {
  const stats = save.stats || {};
  let current = 0;
  switch (achievement.id) {
    case 'hydrogen': current = save.completed?.[1] ? 1 : 0; break;
    case 'uranium': current = Math.min(92, Number(save.unlocked || 1)); break;
    case 'full-table': current = completedCount(save); break;
    case 'marathon-10':
    case 'marathon-30':
    case 'marathon-60': current = Number(stats.marathonBestTime || 0); break;
    case 'neutron-1000': current = Number(stats.totalNeutronsCollected || 0); break;
    case 'precision': current = stats.lowShotClear ? 1 : 0; break;
    case 'arsenal': current = ownsEverything(save) ? 1 : 0; break;
    default: current = 0;
  }
  return { current:Math.min(current, achievement.target), target:achievement.target };
}

export function evaluateAchievements(save, now = Date.now()) {
  if (!save.achievements || typeof save.achievements !== 'object') save.achievements = {};
  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (save.achievements[achievement.id]) continue;
    const progress = getAchievementProgress(save, achievement);
    if (progress.current >= progress.target) {
      save.achievements[achievement.id] = now;
      unlocked.push(achievement);
    }
  }
  return unlocked;
}
