// Solmarina: Streets of Gold — configuration and tuning data.
// All numbers are original tuning values for this game.
export const WORLD = { w: 3840, h: 2880 };

export const SEED = 20261123;

export const PALETTE = {
  grass: '#3f7d44',
  grassDark: '#356b3a',
  park: '#4c8a3f',
  sand: '#e0c184',
  water: '#1f6f8b',
  waterDeep: '#155a75',
  road: '#3a3a40',
  roadLine: '#e8c84a',
  sidewalk: '#8d8d94',
  buildingRoof: '#6b4a5a',
  buildingRoof2: '#4a5a6b',
  buildingRoof3: '#7a6a4a',
  harbour: '#5a4632',
  pier: '#8a6a42',
  lighthouse: '#e8e4d8',
};

export const WEATHER_KINDS = {
  clear: { label: 'Clear', grip: 1.0, sight: 620, fog: 0 },
  rain: { label: 'Rain', grip: 0.72, sight: 500, fog: 0.12 },
  fog: { label: 'Fog', grip: 0.9, sight: 320, fog: 0.55 },
};
export const WEATHER_ORDER = ['clear', 'rain', 'fog'];

export const WEAPONS = {
  fists: { name: 'Fists', slot: 1, damage: 12, rate: 0.45, range: 42, spread: 0, speed: 0, auto: false, price: 0, ammo: Infinity },
  pistol: { name: 'Pistol', slot: 2, damage: 22, rate: 0.32, range: 420, spread: 0.05, speed: 900, auto: false, price: 250, ammo: 120 },
  smg: { name: 'SMG', slot: 3, damage: 13, rate: 0.09, range: 380, spread: 0.11, speed: 1000, auto: true, price: 550, ammo: 240 },
  shotgun: { name: 'Shotgun', slot: 4, damage: 16, rate: 0.8, range: 260, spread: 0.22, speed: 760, auto: false, price: 700, ammo: 48, pellets: 6 },
  rifle: { name: 'Rifle', slot: 5, damage: 48, rate: 0.9, range: 720, spread: 0.01, speed: 1600, auto: false, price: 900, ammo: 60 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export const CAR_MODELS = [
  { name: 'Pinto', top: 380, accel: 260, grip: 0.9, color: '#c94f42', price: 0, size: 1 },
  { name: 'Sedan', top: 430, accel: 300, grip: 1.0, color: '#4a7ac9', price: 0, size: 1 },
  { name: 'Coupe', top: 500, accel: 360, grip: 1.05, color: '#e8c84a', price: 0, size: 1 },
  { name: 'Van', top: 340, accel: 220, grip: 0.85, color: '#8d8d94', price: 0, size: 1.2 },
  { name: 'Muscle', top: 560, accel: 420, grip: 1.0, color: '#7a3fa0', price: 0, size: 1 },
  { name: 'Interceptor', top: 620, accel: 480, grip: 1.1, color: '#22252c', price: 0, size: 1, police: true },
];
export const BIKE = { name: 'Corsaro 900', top: 820, accel: 560, grip: 0.95, color: '#d42a6a', price: 0, bike: true };

export const PRICES = {
  repair: 120,
  repaint: 80,
  armour: 200,
  pistolAmmo: 60,
  smgAmmo: 90,
  shotgunAmmo: 70,
  rifleAmmo: 110,
  food: 25,
};

export const MISSION_REWARDS = [150, 220, 300, 380, 450, 600, 750];

export const WANTED_DECAY_SECONDS = 14;
export const POLICE_SIGHT = { clear: 600, rain: 500, fog: 320 };

export const SAVE_KEY = 'solmarina-save-v2';
export const BINDINGS_KEY = 'solmarina-bindings-v1';
