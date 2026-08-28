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
const POS = new Map(); for (const [row,cells] of ROWS) for (const [col,sym] of Object.entries(cells)) POS.set(sym,{row,col:+col});
for (const e of ELEMENTS) Object.assign(e,POS.get(e.symbol)||{row:1,col:1});

export const SHIPS = [
 {id:'pico',name:'Pico',costE:0,costN:0,mass:.72,size:.78,thrust:1.15,slots:0,pickup:1,gravity:1,desc:'The first quantum-sized vessel: very light, low inertia and easy to fly.'},
 {id:'nano',name:'Nano',costE:40,costN:3,mass:.85,size:.86,thrust:1.1,slots:1,pickup:1.05,gravity:.95,desc:'Slightly larger than Pico, with one upgrade slot and reduced nucleus pull.'},
 {id:'falcon',name:'Falcon',costE:110,costN:10,mass:1.0,size:1,thrust:1.08,slots:2,pickup:1.12,gravity:.9,desc:'A fast all-rounder with room for meaningful customization.'},
 {id:'behemoth',name:'Behemoth',costE:220,costN:24,mass:1.35,size:1.22,thrust:.92,slots:3,pickup:1.35,gravity:.88,desc:'A large vessel: slower to change direction, but excellent at collecting particles.'},
 {id:'hawk',name:'Hawk',costE:420,costN:48,mass:1.18,size:1.08,thrust:1.18,slots:3,pickup:1.23,gravity:.8,desc:'A compromise between Behemoth size and nimble handling.'},
 {id:'nano2',name:'Nano II',costE:700,costN:90,mass:.76,size:.82,thrust:1.28,slots:4,pickup:1.5,gravity:.72,desc:'Second-generation Nano with a built-in electron pickup field.'}
];
export const WEAPONS = [
 {id:'blaster2',name:'Blaster 2000',costE:0,costN:0,rate:3.4,speed:650,life:1.0,bullets:2,spread:.035,size:5,damage:1,desc:'The first nano weapon. Fires a tight two-particle shot.'},
 {id:'blaster3',name:'Blaster 3000',costE:55,costN:4,rate:3.7,speed:710,life:1.08,bullets:3,spread:.055,size:5.5,damage:1,desc:'Improved Blaster: three particles with higher range and velocity.'},
 {id:'blaster4',name:'Blaster 4000',costE:130,costN:12,rate:4.2,speed:760,life:1.14,bullets:4,spread:.07,size:6,damage:1,desc:'A rapid four-particle blaster for clearing busy shells.'},
 {id:'gatling',name:'Gatling Gun',costE:210,costN:24,rate:8.5,speed:690,life:.9,bullets:1,spread:.045,size:4.2,damage:1,desc:'High rate of fire with moderate dispersion.'},
 {id:'burster',name:'Burster',costE:330,costN:38,rate:2.4,speed:620,life:.95,bullets:5,spread:.18,size:5.2,damage:1,desc:'Bursts five particles. Brutal at short range.'},
 {id:'railgun',name:'Railgun',costE:560,costN:70,rate:1.8,speed:1050,life:1.25,bullets:1,spread:0,size:7.5,damage:2,desc:'A precise, extremely fast particle lance.'}
];
export const ENGINES = [
 {id:'project1',name:'Project L1',costE:0,costN:0,thrust:1,max:1,desc:'First-generation quantum engine.'},
 {id:'project2',name:'Project L2',costE:60,costN:5,thrust:1.12,max:1.08,desc:'More power helps larger ships escape nucleus gravity.'},
 {id:'project3',name:'Project L3',costE:150,costN:14,thrust:1.25,max:1.15,desc:'A stronger and more responsive propulsion package.'},
 {id:'vrocket',name:'V-Rocket',costE:280,costN:30,thrust:1.4,max:1.25,desc:'A forceful engine best suited to heavier vessels.'},
 {id:'solar',name:'Solar Ex2.0',costE:500,costN:62,thrust:1.58,max:1.36,desc:'Late-game engine with serious escape velocity.'}
];
export const MODULES = [
 {id:'collector',name:'Collector',costE:45,costN:3,effect:'pickup',value:1.3,desc:'Generates a small electron and neutron collecting field.'},
 {id:'lowgrav',name:'LowGrav',costE:90,costN:8,effect:'gravity',value:.9,desc:'Lowers nucleus gravity by 10%.'},
 {id:'fastfire',name:'FastFire25',costE:130,costN:12,effect:'rate',value:1.25,desc:'Raises weapon pulse frequency by 25%.'},
 {id:'projectile',name:'Q-Ray',costE:170,costN:18,effect:'bulletSpeed',value:1.25,desc:'Makes projectiles fly 25% faster.'},
 {id:'size',name:'Small',costE:210,costN:22,effect:'shipSize',value:.9,desc:'Makes the ship 10% smaller and harder to hit.'},
 {id:'slowel',name:'SLow El',costE:260,costN:28,effect:'electronSpeed',value:.85,desc:'Electrons orbit 15% slower.'},
 {id:'timewarp',name:'TimeWarp',costE:350,costN:42,effect:'time',value:.9,desc:'Slows hostile particle motion by 10%.'}
];

export function getElectronShellCounts(z){const orbitals=[[1,2],[2,2],[2,6],[3,2],[3,6],[4,2],[3,10],[4,6],[5,2],[4,10],[5,6],[6,2],[4,14],[5,10],[6,6],[7,2],[5,14],[6,10],[7,6]];const shells=[0,0,0,0,0,0,0];let left=z;for(const [n,cap] of orbitals){if(left<=0)break;const take=Math.min(left,cap);shells[n-1]+=take;left-=take}return shells;}
export function findById(list,id){return list.find(x=>x.id===id)||list[0]}
