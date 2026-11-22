// Solmarina: Streets of Gold — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The world itself is much
// bigger (WORLD_W x WORLD_H) and the camera scrolls across it.

export const VIEW = { width: 1280, height: 720 };

/** Camera zoom: the world is drawn slightly magnified so cars and people read well. */
export const ZOOM = 1.25;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** World size in pixels. Roads form a grid; the south strip is beach and sea. */
export const WORLD = {
  width: 3840,
  height: 2880,
  roadWidth: 132,
  sidewalk: 26,
  beachY: 2520,
  seaY: 2700,
};

/** Vertical road centre-lines (x) and horizontal road centre-lines (y). */
export const ROADS_X = [320, 960, 1600, 2240, 2880, 3520];
export const ROADS_Y = [320, 880, 1440, 2000, 2440];

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 335,
  health: 100,
  armourMax: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.32,
};

export const CAR = {
  // Per-model tuning: top speed (px/s), acceleration, turn rate, size, colour set.
  models: [
    { name: 'Sardine', top: 520, accel: 420, turn: 2.9, w: 46, h: 84, colors: ['#e8b23a', '#7fb069', '#c96f4a'] },
    { name: 'Comet', top: 640, accel: 520, turn: 3.3, w: 44, h: 80, colors: ['#d6455b', '#4a90d9', '#f2f2f2'] },
    { name: 'Hauler', top: 470, accel: 330, turn: 2.4, w: 52, h: 108, colors: ['#8a7f8d', '#5b7a5e', '#b0893c'] },
    { name: 'Falco GT', top: 760, accel: 640, turn: 3.6, w: 46, h: 86, colors: ['#22242c', '#c0392b', '#f5c518'] },
    { name: 'Taxi', top: 560, accel: 460, turn: 3.1, w: 46, h: 84, colors: ['#f5c518'] },
    { name: 'Police', top: 700, accel: 600, turn: 3.5, w: 46, h: 86, colors: ['#1c2f57'] },
    // Model 6 is a motorcycle: narrow, very fast, sharp steering — but the
    // rider is exposed, so crashes hurt and the bike wobbles at top speed.
    { name: 'Corsaro 900', top: 820, accel: 780, turn: 4.4, w: 22, h: 66, colors: ['#c0392b', '#22242c', '#f5c518'], bike: true },
  ],
  enterRange: 70,
  health: 100,
  explosionDamage: 60,
  bikeCrashDamage: 15,
  bikeWobble: 0.35,
};

export const TRAFFIC = { count: 16, minGap: 90, cruise: 0.55 };
export const PEDS = { count: 26, speed: 70 };

export const POLICE = {
  maxCars: 6,
  spawnDistance: 700,
  ramDamage: 8,
  bustTime: 1.2,
  decayDelay: 14,
  starsForCar: [0, 1, 2, 3, 4, 5],
  // A blocking patrol car aims this many seconds ahead of the player's
  // velocity, cutting the escape route instead of tailing the player.
  blockAhead: 1.4,
  // How far police can spot the player (px). Fog shrinks it hard, rain a bit.
  sightClear: 600,
  sightRain: 500,
  sightFog: 320,
  // Foot cops hold a flanking position instead of charging an armed player.
  coverRange: 300,
  coverHold: 200,
};

/** Weather: kind, road grip, and how the sky looks. Rain makes roads slick;
 * fog cuts visibility (and police sight); clear is the baseline. */
export const WEATHER = {
  kinds: ['clear', 'rain', 'fog'],
  grip: { clear: 1, rain: 0.72, fog: 0.9 },
  labels: { clear: 'CLEAR', rain: 'RAIN · grip low', fog: 'FOG · visibility low' },
  // Seconds between automatic weather changes (randomised in this range).
  autoChange: [90, 150],
  // Weighted odds when the weather rolls over on its own.
  weights: [['clear', 0.5], ['rain', 0.3], ['fog', 0.2]],
};

/** Minimap zoom levels, toggled with N. */
export const MINIMAP = { zoomLevels: [1, 2] };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.32, range: 34, ammo: Infinity, auto: false, recoil: 0 },
  pistol: { name: 'P9 Pistol', damage: 26, rate: 0.24, range: 520, ammo: 12, auto: false, spread: 0.05, speed: 900, recoil: 0.08 },
  smg: { name: 'Stinger SMG', damage: 14, rate: 0.09, range: 460, ammo: 32, auto: true, spread: 0.11, speed: 1000, recoil: 0.03 },
  shotgun: { name: 'Boomstick', damage: 16, rate: 0.7, range: 300, ammo: 6, auto: false, spread: 0.16, speed: 800, pellets: 5, recoil: 0.3 },
  // Long-range rifle: one heavy round, a slow cycle, and a real kick.
  rifle: { name: 'Longshot Rifle', damage: 60, rate: 0.9, range: 720, ammo: 5, auto: false, spread: 0.012, speed: 1500, recoil: 0.35 },
};

export const ECONOMY = {
  startCash: 120,
  missionRewards: [250, 400, 600, 800, 1100, 2000, 3000],
  repairCost: 60,
  repaintCost: 40,
  pistolCost: 220,
  smgCost: 650,
  shotgunCost: 480,
  rifleCost: 900,
  ammoCost: 30,
  foodCost: 15,
  foodHeal: 35,
  bribeCost: 150,
  pedCashDrop: 12,
  gangCashDrop: 40,
};

export const TIME = {
  dayLength: 240, // seconds for a full day cycle
  startHour: 9.5, // morning
};

export const SAVE_KEY = 'solmarina.save.v1';
export const BEST_KEY = 'solmarina.best.v1';

export const PALETTE = {
  sky: '#87b7d9',
  grass: '#7fae62',
  grassDark: '#6f9e55',
  sand: '#e3cd96',
  sea: '#2f7fa8',
  seaDeep: '#256b8f',
  road: '#3a3d44',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a3',
  curb: '#6e7377',
  buildingRoof: ['#b5543f', '#4a6b8a', '#7a5c8a', '#3f7a5e', '#8a6a3f', '#5e6b7a'],
  buildingWall: '#c9c2b4',
  park: '#5d9b4a',
  water: '#2f7fa8',
  player: '#e8b23a',
  playerShirt: '#2e86c1',
  police: '#1c2f57',
  policeLight: '#ff3b30',
  gang: '#8e44ad',
  hud: '#11151c',
  hudPanel: 'rgba(12,16,22,0.78)',
  text: '#f4f6f8',
  muted: '#9aa5b1',
  gold: '#f5c518',
  red: '#e5534b',
  green: '#58b368',
  blue: '#4a90d9',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
