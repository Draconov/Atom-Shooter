export const ELEMENTS = [
['H','Hydrogen'],['He','Helium'],['Li','Lithium'],['Be','Beryllium'],['B','Boron'],['C','Carbon'],['N','Nitrogen'],['O','Oxygen'],['F','Fluorine'],['Ne','Neon'],
['Na','Sodium'],['Mg','Magnesium'],['Al','Aluminium'],['Si','Silicon'],['P','Phosphorus'],['S','Sulfur'],['Cl','Chlorine'],['Ar','Argon'],['K','Potassium'],['Ca','Calcium'],
['Sc','Scandium'],['Ti','Titanium'],['V','Vanadium'],['Cr','Chromium'],['Mn','Manganese'],['Fe','Iron'],['Co','Cobalt'],['Ni','Nickel'],['Cu','Copper'],['Zn','Zinc'],
['Ga','Gallium'],['Ge','Germanium'],['As','Arsenic'],['Se','Selenium'],['Br','Bromine'],['Kr','Krypton'],['Rb','Rubidium'],['Sr','Strontium'],['Y','Yttrium'],['Zr','Zirconium'],
['Nb','Niobium'],['Mo','Molybdenum'],['Tc','Technetium'],['Ru','Ruthenium'],['Rh','Rhodium'],['Pd','Palladium'],['Ag','Silver'],['Cd','Cadmium'],['In','Indium'],['Sn','Tin'],
['Sb','Antimony'],['Te','Tellurium'],['I','Iodine'],['Xe','Xenon'],['Cs','Caesium'],['Ba','Barium'],['La','Lanthanum'],['Ce','Cerium'],['Pr','Praseodymium'],['Nd','Neodymium'],
['Pm','Promethium'],['Sm','Samarium'],['Eu','Europium'],['Gd','Gadolinium'],['Tb','Terbium'],['Dy','Dysprosium'],['Ho','Holmium'],['Er','Erbium'],['Tm','Thulium'],['Yb','Ytterbium'],
['Lu','Lutetium'],['Hf','Hafnium'],['Ta','Tantalum'],['W','Tungsten'],['Re','Rhenium'],['Os','Osmium'],['Ir','Iridium'],['Pt','Platinum'],['Au','Gold'],['Hg','Mercury'],
['Tl','Thallium'],['Pb','Lead'],['Bi','Bismuth'],['Po','Polonium'],['At','Astatine'],['Rn','Radon'],['Fr','Francium'],['Ra','Radium'],['Ac','Actinium'],['Th','Thorium'],
['Pa','Protactinium'],['U','Uranium'],['Np','Neptunium'],['Pu','Plutonium'],['Am','Americium'],['Cm','Curium'],['Bk','Berkelium'],['Cf','Californium'],['Es','Einsteinium'],['Fm','Fermium'],
['Md','Mendelevium'],['No','Nobelium'],['Lr','Lawrencium'],['Rf','Rutherfordium'],['Db','Dubnium'],['Sg','Seaborgium'],['Bh','Bohrium'],['Hs','Hassium'],['Mt','Meitnerium'],['Ds','Darmstadtium'],
['Rg','Roentgenium'],['Cn','Copernicium'],['Uut','Ununtrium'],['Fl','Flerovium'],['Uup','Ununpentium'],['Lv','Livermorium'],['Uus','Ununseptium'],['Uuo','Ununoctium']
].map((e,i)=>({z:i+1,symbol:e[0],name:e[1]}));

const ROWS = [
  [1,{1:'H',18:'He'}],
  [2,{1:'Li',2:'Be',13:'B',14:'C',15:'N',16:'O',17:'F',18:'Ne'}],
  [3,{1:'Na',2:'Mg',13:'Al',14:'Si',15:'P',16:'S',17:'Cl',18:'Ar'}],
  [4,{1:'K',2:'Ca',3:'Sc',4:'Ti',5:'V',6:'Cr',7:'Mn',8:'Fe',9:'Co',10:'Ni',11:'Cu',12:'Zn',13:'Ga',14:'Ge',15:'As',16:'Se',17:'Br',18:'Kr'}],
  [5,{1:'Rb',2:'Sr',3:'Y',4:'Zr',5:'Nb',6:'Mo',7:'Tc',8:'Ru',9:'Rh',10:'Pd',11:'Ag',12:'Cd',13:'In',14:'Sn',15:'Sb',16:'Te',17:'I',18:'Xe'}],
  [6,{1:'Cs',2:'Ba',4:'Hf',5:'Ta',6:'W',7:'Re',8:'Os',9:'Ir',10:'Pt',11:'Au',12:'Hg',13:'Tl',14:'Pb',15:'Bi',16:'Po',17:'At',18:'Rn'}],
  [7,{1:'Fr',2:'Ra',4:'Rf',5:'Db',6:'Sg',7:'Bh',8:'Hs',9:'Mt',10:'Ds',11:'Rg',12:'Cn',13:'Uut',14:'Fl',15:'Uup',16:'Lv',17:'Uus',18:'Uuo'}],
  [8,{3:'La',4:'Ce',5:'Pr',6:'Nd',7:'Pm',8:'Sm',9:'Eu',10:'Gd',11:'Tb',12:'Dy',13:'Ho',14:'Er',15:'Tm',16:'Yb',17:'Lu'}],
  [9,{3:'Ac',4:'Th',5:'Pa',6:'U',7:'Np',8:'Pu',9:'Am',10:'Cm',11:'Bk',12:'Cf',13:'Es',14:'Fm',15:'Md',16:'No',17:'Lr'}]
];
const POS = new Map();
for (const [row,cells] of ROWS) for (const [col,sym] of Object.entries(cells)) POS.set(sym,{row,col:+col});
for (const e of ELEMENTS) Object.assign(e,POS.get(e.symbol)||{row:1,col:1});

// Ship names/descriptions and upgrade-slot identities mirror the reference APK.
export const SHIPS = [
 {id:'pico',name:'Pico',costE:0,costN:0,mass:.72,size:.78,thrust:1.15,slots:0,pickup:1,gravity:1,visual:{pattern:'core'},desc:'The first ever quantum sized vessel. It is prone to nucleus pull force. On the other hand it is very light and low inertia makes this ship easy to fly.'},
 {id:'nano',name:'Nano',costE:40,costN:3,mass:.85,size:.86,thrust:1.1,slots:1,pickup:1.05,gravity:.95,visual:{pattern:'stripe'},desc:'Slightly larger than Pico! Still very light, fast and easy to handle. It has one upgrade slot and a slightly reduced nucleus pull.'},
 {id:'falcon',name:'Falcon',costE:110,costN:10,mass:1.0,size:1,thrust:1.08,slots:2,pickup:1.12,gravity:.9,visual:{pattern:'chevron'},desc:'A considerably large vessel. Its mass adds inertia, while two upgrade slots and a larger pickup footprint make it highly configurable.'},
 {id:'behemoth',name:'Behemoth',costE:220,costN:24,mass:1.35,size:1.22,thrust:.92,slots:4,pickup:1.35,gravity:.88,visual:{pattern:'armor'},desc:'The largest available ship — a real nano fortress. Heavy handling is compensated by four upgrade slots and excellent particle collection.'},
 {id:'hawk',name:'Hawk',costE:420,costN:48,mass:1.18,size:1.08,thrust:1.18,slots:3,pickup:1.23,gravity:.8,visual:{pattern:'panel'},desc:'A reasonable compromise between size, handling and features. Smaller and easier to handle than Behemoth without losing too much flexibility.'},
 {id:'nano2',name:'Nano II',costE:700,costN:90,mass:.76,size:.82,thrust:1.28,slots:0,pickup:1.6,gravity:.72,builtinPickup:true,visual:{pattern:'grid'},desc:'Second generation Nano. It has no module slots, but comes with a built-in electron pick-up field.'}
];

const ENERGY = {
  blaster:{capacity:40,regen:16,cost:4}, blaster2:{capacity:46,regen:17,cost:5}, blaster3:{capacity:52,regen:18,cost:6}, blaster4:{capacity:60,regen:20,cost:7},
  gatling:{capacity:70,regen:24,cost:3.2}, gatlingp:{capacity:78,regen:27,cost:3.1}, gatlings:{capacity:90,regen:31,cost:2.8},
  burster:{capacity:58,regen:18,cost:12}, bursterf:{capacity:66,regen:22,cost:14}, bursterr:{capacity:76,regen:25,cost:17},
};
const weapon = (data) => ({continuous:true,bulletLimit:48,manualFire:true,pierce:1,...ENERGY[data.id],...data});

// Blaster has a basic one-projectile starter before the APK-style 2000/3000/4000 upgrades.
// Gatling and Burster retain their three-stage reference progressions.
export const WEAPONS = [
 weapon({id:'blaster',family:'blaster',tier:1,tierTotal:4,asset:'blaster',name:'Blaster',costE:0,costN:0,rate:3.0,speed:620,life:.95,bullets:1,spread:0,size:4.5,damage:1,desc:'The standard starter weapon. Fires one fast particle at a time.'}),
 weapon({id:'blaster2',family:'blaster',tier:2,tierTotal:4,asset:'blaster2',requires:'blaster',name:'Blaster 2000',costE:30,costN:1,rate:3.4,speed:650,life:1.0,bullets:2,spread:.035,size:5,damage:1,desc:'Upgraded Blaster can shoot up to 2 particles at once.'}),
 weapon({id:'blaster3',family:'blaster',tier:3,tierTotal:4,asset:'blaster3',requires:'blaster2',name:'Blaster 3000',costE:55,costN:4,rate:3.7,speed:710,life:1.08,bullets:3,spread:.055,size:5.5,damage:1,desc:'Improved Blaster can shoot 3 particles with higher range and velocity.'}),
 weapon({id:'blaster4',family:'blaster',tier:4,tierTotal:4,asset:'blaster4',requires:'blaster3',name:'Blaster 4000',costE:130,costN:12,rate:4.2,speed:790,life:1.14,bullets:4,spread:.06,size:6,damage:1,pierce:2,desc:'Shoots up to 4 super fast particles. Each particle can destroy up to 2 electrons!'}),
 weapon({id:'gatling',family:'gatling',tier:1,asset:'gatling',name:'Gatling Gun',costE:210,costN:24,rate:6,speed:690,life:.9,bullets:1,spread:.075,size:4.2,damage:1,bulletLimit:60,desc:'Shooting 6 rounds per second is impressive, although it lacks a bit of precision.'}),
 weapon({id:'gatlingp',family:'gatling',tier:2,asset:'gatlingp',requires:'gatling',name:'Gatling Gun P',costE:320,costN:36,rate:10,speed:790,life:.94,bullets:1,spread:.04,size:4.1,damage:1,bulletLimit:72,desc:'Shoots 10 rounds per second. Increased precision and particle velocity.'}),
 weapon({id:'gatlings',family:'gatling',tier:3,asset:'gatlings',requires:'gatlingp',name:'Gatling Gun S',costE:470,costN:54,rate:20,speed:830,life:.95,bullets:1,spread:.025,size:4,damage:.5,bulletLimit:96,desc:'It takes 2 hits to destroy an electron — but with increased accuracy and 20 rounds per second it is hardly an issue.'}),
 weapon({id:'burster',family:'burster',tier:1,asset:'burster',name:'Burster',costE:330,costN:38,rate:1.85,speed:620,life:.95,bullets:5,spread:.18,size:5.2,damage:1,continuous:false,desc:'This weapon bursts 5 particles with little precision. Good for short range.'}),
 weapon({id:'bursterf',family:'burster',tier:2,asset:'bursterf',requires:'burster',name:'Burster F',costE:460,costN:55,rate:2.25,speed:675,life:1.0,bullets:7,spread:.14,size:5.1,damage:1,continuous:false,desc:'Fires 7 particles with more precision and slightly higher velocity. Faster reload times.'}),
 weapon({id:'bursterr',family:'burster',tier:3,asset:'bursterr',requires:'bursterf',name:'Burster R',costE:620,costN:78,rate:2.8,speed:710,life:1.04,bullets:10,spread:.115,size:5,damage:1,continuous:false,bulletLimit:80,desc:'Fires 10 particles. Good reload time and precision make it a great weapon.'})
];

export const ENGINES = [
 {id:'vrocket',asset:'vrocket',name:'V-Rocket',costE:0,costN:0,thrust:1,max:1,desc:'First generation quantum rocket. May not be enough for larger ships.'},
 {id:'vrocketx',asset:'vrocketx',requires:'vrocket',name:'V-Rocket X',costE:60,costN:5,thrust:1.12,max:1.08,desc:'More powerful engine control helps larger ships and makes it easier to escape nucleus force.'},
 {id:'vrocketdx',asset:'vrocketdx',requires:'vrocketx',name:'V-Rocket DX',costE:150,costN:14,thrust:1.25,max:1.15,desc:'As ships get larger and nucleus force stronger, the engine specifications are pushed even further.'},
 {id:'qray',asset:'qray',requires:'vrocketdx',name:'Q-Ray',costE:280,costN:30,thrust:1.4,max:1.25,desc:'Not recommended on the smallest ships: this much power can make them hard to handle.'},
 {id:'solar',asset:'solar',requires:'qray',name:'Solar Ex2.0',costE:500,costN:62,thrust:1.58,max:1.36,desc:'It is unbelievable how much force this little sub-atomic engine can provide.'}
];

const MODULE_FAMILIES = [
  {family:'collector',asset:'collector',names:['Collector','Collector L','Collector XL'],effects:[1.25,1.5,1.85],effect:'pickup',costs:[[45,3],[110,10],[240,25]],descs:['This module generates a small electron collecting field.','A stronger collecting field reaches farther around the ship.','The largest collector field in the module family.']},
  {family:'project',asset:'projectile',names:['Project L1','Project L2','Project L3'],effects:[1.25,1.5,1.75],effect:'bulletSize',costs:[[70,5],[150,14],[290,31]],descs:['Makes projectiles 25% larger.','Makes projectiles 50% larger.','Makes projectiles 75% larger.']},
  {family:'fastfire',asset:'fastfire',names:['FastFire25','FastFire50','FastFire75'],effects:[1.25,1.5,1.75],effect:'bulletSpeed',costs:[[95,8],[190,18],[350,38]],descs:['Makes projectiles fly 25% faster.','Makes projectiles fly 50% faster.','Makes projectiles fly 75% faster.']},
  {family:'small',asset:'size',names:['Small','Small R','Small EST'],effects:[.9,.8,.6],effect:'shipSize',costs:[[120,10],[230,24],[420,48]],descs:['Makes ship 10% smaller. Smaller ship is less likely to hit anything.','Makes ship 20% smaller. Smaller ship is less likely to hit anything.','Makes ship 40% smaller. Smaller ship is less likely to hit anything.']},
  {family:'lowgrav',asset:'lowgrav',names:['LowGrav','LowGrav2','LowGrav3'],effects:[.9,.85,.8],effect:'gravity',costs:[[90,8],[190,19],[360,41]],descs:['Lowers nucleus gravity by 10%.','Lowers nucleus gravity by 15%.','Lowers nucleus gravity by 20%.']},
  {family:'slowel',asset:'slowel',names:['SLow El','SLowR El','SLowST El'],effects:[.85,.7,.5],effect:'electronSpeed',costs:[[130,12],[250,27],[460,55]],descs:['Electrons orbit 15% slower.','Electrons orbit 30% slower.','Electrons orbit 50% slower.']},
  {family:'timewarp',asset:'timewarp',names:['TimeWarp','TimeWarp Mk2','TimeWarp Mk3'],effects:[.9,.85,.8],effect:'time',costs:[[170,16],[320,34],[560,70]],descs:['Slows down time by 10%. A subtle change.','Slows down time by 15%.','Slows down time by 20%. May not feel like much, but it can make a difference.']},
];

export const MODULES = MODULE_FAMILIES.flatMap((family) => family.names.map((name,index) => {
  const tier = index + 1;
  const id = tier === 1 ? family.family : `${family.family}${tier}`;
  return {
    id,
    family:family.family,
    tier,
    asset:id,
    name,
    costE:family.costs[index][0],
    costN:family.costs[index][1],
    effect:family.effect,
    value:family.effects[index],
    requires:tier > 1 ? (tier === 2 ? family.family : `${family.family}${tier-1}`) : null,
    desc:family.descs[index],
  };
}));

export const POWERUPS = [
  {id:'ammo',name:'Ammo',symbol:'A',color:'#f2b23b',duration:0,desc:'Instantly restores weapon energy.'},
  {id:'bigfire',name:'Big Fire',symbol:'F',color:'#ef6b35',duration:12,desc:'Temporarily increases projectile size and impact.'},
  {id:'collect',name:'Collector Boost',symbol:'C',color:'#20a99f',duration:12,desc:'Temporarily expands the pickup field.'},
  {id:'electronstop',name:'Electron Stop',symbol:'Ⅱ',color:'#2f8dd8',duration:8,desc:'Stops orbiting electrons for a short time.'},
  {id:'ghost',name:'Ghost',symbol:'G',color:'#8f6bd8',duration:9,desc:'Temporarily prevents collision damage.'},
  {id:'gravity',name:'Gravity Off',symbol:'↓',color:'#5ba7b4',duration:10,desc:'Temporarily suppresses nucleus gravity.'},
];

export function getElectronShellCounts(z){
  const orbitals=[[1,2],[2,2],[2,6],[3,2],[3,6],[4,2],[3,10],[4,6],[5,2],[4,10],[5,6],[6,2],[4,14],[5,10],[6,6],[7,2],[5,14],[6,10],[7,6]];
  const shells=[0,0,0,0,0,0,0];let left=z;
  for(const [n,cap] of orbitals){if(left<=0)break;const take=Math.min(left,cap);shells[n-1]+=take;left-=take}
  return shells;
}

export function getMarathonThresholds(count=100){
  const thresholds=[];let score=0;let increment=10000;
  for(let i=0;i<count;i+=1){score+=increment;thresholds.push(score);increment+=5000;}
  return thresholds;
}

export function findById(list,id){return list.find(x=>x.id===id)||list[0]}
export function findModuleFamily(family,tier=1){return MODULES.find((item)=>item.family===family&&item.tier===tier)}
