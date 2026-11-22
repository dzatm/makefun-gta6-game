// Story missions for Solmarina. Dana Reyes, a courier scraping by in Solmarina,
// gets pulled into the turf war between the Marlins and the Dockside Kings. Seven
// missions, each a list of steps; the manager spawns what a step needs, watches
// the objective, and pays out on completion. Free roam resumes after the last one.

import { LANDMARKS } from './world.js';
import { ECONOMY } from './config.js';
import { dist, shuffle } from './random.js';
import { makeGangster } from './people.js';
import { makeCar } from './vehicles.js';
import { spawnPickup, addWanted } from './combat.js';

export const MISSIONS = [
  {
    id: 'delivery',
    title: 'First Delivery',
    giver: 'Lena (dispatch)',
    brief: 'Lena needs three parcels dropped around town. Grab any car or go on foot — just get them there.',
    steps: [
      { type: 'goto', x: 960, y: 880, radius: 60, text: 'Drop the parcel at the corner of 2nd & Palma' },
      { type: 'goto', x: 2240, y: 1440, radius: 60, text: 'Drop the parcel at the downtown plaza' },
      { type: 'goto', x: 2880, y: 2000, radius: 60, text: 'Drop the parcel by the south market' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Marco',
    brief: 'Marco wants a Falco GT, no questions asked. One is parked by the marina. Take it — and mind the cops.',
    steps: [
      { type: 'steal', model: 3, x: 480, y: 2360, text: 'Steal the black Falco GT by the marina' },
      { type: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 80, needCar: true, text: 'Bring the Falco to Clean Ride Garage' },
    ],
  },
  {
    id: 'docks',
    title: 'Dockside Trouble',
    giver: 'Lena (dispatch)',
    brief: 'The Dockside Kings grabbed one of our couriers at the docks. Go get him — and the package — back.',
    steps: [
      { type: 'goto', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, radius: 90, text: 'Head to the docks' },
      { type: 'fight', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, count: 5, text: 'Clear out the Dockside Kings (0/5)' },
      { type: 'collect', x: LANDMARKS.docks.x + 40, y: LANDMARKS.docks.y + 30, text: 'Pick up the package' },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway',
    giver: 'Marco',
    brief: 'Somebody talked. The whole precinct is after you. Lose them and get to the flat.',
    steps: [
      { type: 'escape', stars: 3, text: 'Escape the police — reach your flat' },
    ],
  },
  {
    id: 'exchange',
    title: 'The Exchange',
    giver: 'Lena (dispatch)',
    brief: 'Drive Marco to the marina meet. The Kings will try to run you off the road. Do not stop.',
    steps: [
      { type: 'goto', x: 1600, y: 1440, radius: 70, text: 'Pick up Marco downtown' },
      { type: 'chase', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, radius: 90, text: 'Drive Marco to the marina — the Kings are on you' },
    ],
  },
  {
    id: 'king',
    title: 'King of the Marina',
    giver: 'Marco',
    brief: 'Rico runs the Kings from the marina. End it tonight, and Solmarina is ours.',
    steps: [
      { type: 'goto', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, radius: 100, text: 'Go to the marina' },
      { type: 'fight', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, count: 8, boss: true, text: 'Take down Rico and his crew (0/8)' },
      { type: 'collect', x: LANDMARKS.marina.x + 60, y: LANDMARKS.marina.y, text: 'Take the Kings’ cash' },
    ],
  },
  {
    id: 'smuggle',
    title: 'Harbour Run',
    giver: 'Lena (dispatch)',
    brief: 'The Kings are finished, but their harbour stash is still sitting on the pier — and a boat is waiting at the marina. Grab the package at the harbour, then run it to the marina before the tide turns. You have 75 seconds once you pick it up.',
    steps: [
      { type: 'goto', x: LANDMARKS.harbour.x, y: LANDMARKS.harbour.y, radius: 90, text: "Get to Smuggler's Harbour" },
      { type: 'collect', x: LANDMARKS.harbour.x - 40, y: LANDMARKS.harbour.y + 20, text: 'Grab the harbour stash' },
      { type: 'timed', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, radius: 90, time: 75, needCar: true, text: 'Run the stash to the marina — 75s!' },
      { type: 'collect', x: LANDMARKS.marina.x + 60, y: LANDMARKS.marina.y + 30, text: 'Hand the stash to the boat crew' },
    ],
  },
];

export function createMissionManager() {
  return {
    index: 0, // which mission; -1 = story complete
    step: 0,
    active: false,
    started: false,
    spawned: [],
    targetCar: null,
    packageSpawned: false,
    escapeTimer: 0,
    killsNeeded: 0,
    killsDone: 0,
    // Countdown for 'timed' steps (seconds left); null outside them.
    timer: null,
    message: '',
    messageT: 0,
  };
}

export function currentMission(mm) {
  if (mm.index < 0 || mm.index >= MISSIONS.length) return null;
  return MISSIONS[mm.index];
}

export function currentStep(mm) {
  const m = currentMission(mm);
  if (!m) return null;
  return m.steps[mm.step] || null;
}

export function startMission(state, index) {
  const mm = state.missions;
  mm.index = index;
  mm.step = 0;
  mm.active = true;
  mm.started = true;
  mm.spawned = [];
  mm.targetCar = null;
  mm.packageSpawned = false;
  mm.killsDone = 0;
  const m = MISSIONS[index];
  mm.message = `Mission: ${m.title} — ${m.brief}`;
  mm.messageT = 6;
  state.audio?.mission();
  enterStep(state);
}

export function enterStep(state) {
  const mm = state.missions;
  const step = currentStep(mm);
  if (!step) return;
  if (step.type === 'steal') {
    // Park the target car at the step's spot if it is not there yet.
    const car = makeCar(step.model, step.x, step.y, 0, step.model === 3 ? '#22242c' : '#d6455b', 'parked');
    car.missionTarget = true;
    state.cars.push(car);
    mm.targetCar = car;
  } else if (step.type === 'fight') {
    mm.killsNeeded = step.count;
    mm.killsDone = 0;
    // Spawn offsets are shuffled so the gang is never in the same spots.
    const offsets = shuffle(Math.random, Array.from({ length: step.count }, (_, i) => i));
    for (let i = 0; i < step.count; i += 1) {
      const isBoss = step.boss && i === 0;
      const slot = offsets[i];
      const a = (slot / step.count) * Math.PI * 2;
      const r = 60 + (slot % 3) * 80;
      const g = makeGangster(
        step.x + Math.cos(a) * r,
        step.y + Math.sin(a) * r,
        isBoss ? 200 : 50,
      );
      g.boss = isBoss;
      g.name = isBoss ? 'Rico' : undefined;
      state.enemies.push(g);
      mm.spawned.push(g);
    }
  } else if (step.type === 'timed') {
    // The clock starts the moment the step begins.
    mm.timer = step.time;
  } else if (step.type === 'escape') {
    addWanted(state, step.stars);
    mm.escapeTimer = 0;
  } else if (step.type === 'chase') {
    for (let i = 0; i < 2; i += 1) {
      const car = makeCar(1, state.player.x + (i === 0 ? -260 : 260), state.player.y + 200, 0, '#8e44ad', 'gang');
      state.cars.push(car);
      mm.spawned.push(car);
    }
  } else if (step.type === 'collect') {
    if (!mm.packageSpawned) {
      spawnPickup(state, 'cash', step.x, step.y, 150);
      mm.packageSpawned = true;
    }
  }
}

function advanceStep(state) {
  const mm = state.missions;
  mm.step += 1;
  mm.spawned = [];
  mm.packageSpawned = false;
  const m = currentMission(mm);
  if (!m) return;
  if (mm.step >= m.steps.length) {
    completeMission(state);
    return;
  }
  const step = currentStep(mm);
  mm.message = step.text;
  mm.messageT = 4;
  state.audio?.blip();
  enterStep(state);
}

function completeMission(state) {
  const mm = state.missions;
  const m = currentMission(mm);
  const reward = ECONOMY.missionRewards[mm.index] || 250;
  state.cash += reward;
  state.stats.missions += 1;
  mm.active = false;
  mm.message = `Mission complete: ${m.title} — +$${reward}`;
  mm.messageT = 5;
  state.audio?.success();
  state.floaters.push({ x: state.player.x, y: state.player.y - 40, text: `+$${reward}`, t: 0, life: 2, color: '#f5c518' });
  // Clear wanted after a mission, like the heat cooling off.
  state.wanted = 0;
  mm.index += 1;
  mm.step = 0;
  if (mm.index >= MISSIONS.length) {
    mm.index = -1;
    mm.message = 'Story complete! Solmarina is yours — free roam, replay missions from the menu.';
    mm.messageT = 8;
    state.stats.storyDone = true;
  }
}

export function failMission(state, reason) {
  const mm = state.missions;
  if (!mm.active) return;
  mm.active = false;
  mm.message = `Mission failed: ${reason}. Restart from the pause menu.`;
  mm.messageT = 6;
  // Remove spawned gangsters/cars from the failed attempt.
  for (const g of mm.spawned) {
    if (g.kind === 'gang') g.dead = true;
    else if (g.kind === 'car') g.dead = true;
  }
  mm.spawned = [];
}

/** Per-tick mission logic. Returns nothing; sets messages and advances steps. */
export function updateMissions(state, dt) {
  const mm = state.missions;
  if (mm.messageT > 0) mm.messageT -= dt;
  if (!mm.active) return;
  const step = currentStep(mm);
  if (!step) return;
  const p = state.player;

  if (step.type === 'goto') {
    const d = dist(p.x, p.y, step.x, step.y);
    if (d < step.radius && (!step.needCar || p.inCar)) advanceStep(state);
  } else if (step.type === 'steal') {
    if (mm.targetCar && p.inCar === mm.targetCar) {
      state.floaters.push({ x: p.x, y: p.y - 40, text: 'Nice ride!', t: 0, life: 1.5, color: '#f5c518' });
      addWanted(state, 1);
      advanceStep(state);
    }
  } else if (step.type === 'fight') {
    const alive = mm.spawned.filter((g) => g.kind === 'gang' && !g.dead).length;
    mm.killsDone = mm.killsNeeded - alive;
    step.text = step.boss
      ? `Take down Rico and his crew (${mm.killsDone}/${mm.killsNeeded})`
      : `Clear out the Dockside Kings (${mm.killsDone}/${mm.killsNeeded})`;
    mm.message = step.text; // keep the banner in step with the count
    if (alive === 0) advanceStep(state);
  } else if (step.type === 'collect') {
    const d = dist(p.x, p.y, step.x, step.y);
    if (d < 40) {
      state.cash += 150;
      advanceStep(state);
    }
  } else if (step.type === 'escape') {
    mm.escapeTimer += dt;
    const sh = LANDMARKS.safehouse;
    if (dist(p.x, p.y, sh.x, sh.y) < 90) {
      state.wanted = 0;
      advanceStep(state);
    } else if (mm.escapeTimer > 120) {
      failMission(state, 'The police caught up with you');
    }
  } else if (step.type === 'chase') {
    const d = dist(p.x, p.y, step.x, step.y);
    if (d < step.radius) {
      for (const c of mm.spawned) if (c.kind === 'car') c.dead = true;
      advanceStep(state);
    }
  } else if (step.type === 'timed') {
    // Timed run: reach the marker before the clock hits zero. The timer only
    // ticks while the player is in a car (the stash run is a driving run).
    if (p.inCar && mm.timer !== null) mm.timer -= dt;
    const d = dist(p.x, p.y, step.x, step.y);
    mm.message = `${step.text} — ${Math.max(0, Math.ceil(mm.timer ?? step.time))}s left`;
    if (d < step.radius && (!step.needCar || p.inCar)) {
      mm.timer = null;
      advanceStep(state);
    } else if (mm.timer !== null && mm.timer <= 0) {
      mm.timer = null;
      failMission(state, 'Out of time — the boat left without you');
    }
  }
}
