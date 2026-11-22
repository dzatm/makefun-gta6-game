// Story missions: seven missions, then free roam. Mission 7 (Harbour Run)
// is a timed smuggling run that chains automatically after mission 6.
import { MISSION_REWARDS } from './config.js';
import { dist2 } from './random.js';
import { spawnGangsters, spawnPickup } from './combat.js';
import { spawnFootCops } from './people.js';
import { addWanted } from './vehicles.js';

export const MISSIONS = [
  {
    name: 'First Delivery',
    intro: 'Dana needs cash. Deliver the package to the beach cafe.',
    steps: [
      { text: 'Pick up the package at the park kiosk', x: 700, y: 900, r: 60 },
      { text: 'Deliver it to the beach cafe', x: 900, y: 2560, r: 70 },
    ],
  },
  {
    name: 'Hot Wheels',
    intro: 'The Marlins want a Coupe. Steal one and bring it to the garage.',
    steps: [
      { text: 'Steal any Coupe (E to enter)', x: 0, y: 0, r: 0, kind: 'steal', model: 'Coupe' },
      { text: 'Deliver the Coupe to the garage', x: 1500, y: 640, r: 80, kind: 'deliverCar' },
    ],
  },
  {
    name: 'Dock Shootout',
    intro: 'Dockside Kings are moving product at the harbour. Clear them out.',
    steps: [
      { text: 'Go to the harbour', x: 2900, y: 2560, r: 90, kind: 'spawnGang', n: 4 },
      { text: 'Clear out the gangsters', x: 0, y: 0, r: 0, kind: 'clearGang' },
    ],
  },
  {
    name: 'Heat Run',
    intro: 'The cops are onto you. Lose a 3-star wanted level.',
    steps: [
      { text: 'Get the cops attention (steal a car or shoot)', x: 0, y: 0, r: 0, kind: 'getWanted', level: 3 },
      { text: 'Lose the heat — break line of sight until it fades', x: 0, y: 0, r: 0, kind: 'loseWanted' },
    ],
  },
  {
    name: 'The Exchange',
    intro: 'Meet the buyer at the marina. Expect trouble.',
    steps: [
      { text: 'Reach the marina meeting point', x: 3200, y: 2300, r: 70, kind: 'spawnGang', n: 3 },
      { text: 'Survive the ambush', x: 0, y: 0, r: 0, kind: 'clearGang' },
      { text: 'Collect the payment', x: 3200, y: 2300, r: 70, kind: 'collect' },
    ],
  },
  {
    name: 'Rico',
    intro: 'Rico runs the Dockside Kings. End it at the lighthouse.',
    steps: [
      { text: 'Go to the lighthouse', x: 3560, y: 2350, r: 90, kind: 'spawnGang', n: 5 },
      { text: 'Take down Rico and his crew', x: 0, y: 0, r: 0, kind: 'clearGang' },
    ],
  },
  {
    name: 'Harbour Run',
    intro: 'One last job: a timed smuggling run. 75 seconds on the clock.',
    timed: 75,
    steps: [
      { text: 'Reach the harbour stash', x: 2700, y: 2560, r: 70, kind: 'collect' },
      { text: 'Drive the stash to the marina', x: 3300, y: 2320, r: 80, kind: 'collect' },
      { text: 'Hand off to the boat crew', x: 3160, y: 2600, r: 70, kind: 'collect' },
    ],
  },
];

export function startMission(G, idx) {
  G.missionIdx = idx;
  G.missionStep = 0;
  G.missionTimer = MISSIONS[idx].timed || 0;
  G.missionState = 'active';
  const m = MISSIONS[idx];
  G.hudMsg = `Mission ${idx + 1}: ${m.name} — ${m.intro}`;
  G.hudMsgT = 5;
  G.audio.mission();
}

export function currentStep(G) {
  if (G.missionIdx < 0 || G.missionIdx >= MISSIONS.length) return null;
  return MISSIONS[G.missionIdx].steps[G.missionStep] || null;
}

export function missionMarker(G) {
  const s = currentStep(G);
  if (!s || !s.x) return null;
  return { x: s.x, y: s.y, r: s.r };
}

function advanceStep(G) {
  G.missionStep += 1;
  const m = MISSIONS[G.missionIdx];
  if (G.missionStep >= m.steps.length) {
    completeMission(G);
  } else {
    const s = currentStep(G);
    G.hudMsg = s.text;
    G.hudMsgT = 3;
    runStepEnter(G, s);
  }
}

function runStepEnter(G, s) {
  if (!s) return;
  if (s.kind === 'spawnGang') spawnGangsters(G, s.x, s.y, s.n || 3);
  if (s.kind === 'getWanted') addWanted(G, s.level || 3);
  if (s.kind === 'collect') spawnPickup(G, s.x, s.y, 'cash');
}

function completeMission(G) {
  const m = MISSIONS[G.missionIdx];
  const reward = MISSION_REWARDS[G.missionIdx] || 200;
  G.player.cash += reward;
  G.stats.earned += reward;
  G.hudMsg = `Mission complete: ${m.name} — earned $${reward}`;
  G.hudMsgT = 4;
  G.audio.win();
  G.missionIdx += 1;
  G.missionStep = 0;
  if (G.missionIdx >= MISSIONS.length) {
    G.missionIdx = -1;
    G.missionState = 'done';
    G.hudMsg = 'All missions done — Solmarina is yours. Free roam!';
    G.hudMsgT = 6;
  } else {
    startMission(G, G.missionIdx);
  }
}

export function updateMission(G, dt) {
  if (G.missionIdx < 0 || G.missionState !== 'active') return;
  const m = MISSIONS[G.missionIdx];
  if (m.timed) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) {
      G.hudMsg = 'Harbour Run failed — out of time. Try again from the pause menu.';
      G.hudMsgT = 4;
      G.missionState = 'failed';
      G.audio.lose();
      return;
    }
  }
  const s = currentStep(G);
  if (!s) return;
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;

  if (s.kind === 'steal') {
    if (p.vehicle && p.vehicle.model.name === s.model) advanceStep(G);
    return;
  }
  if (s.kind === 'deliverCar') {
    if (p.vehicle && p.vehicle.model.name === 'Coupe' && dist2(px, py, s.x, s.y) < s.r * s.r) {
      p.vehicle.driver = 'parked';
      p.vehicle = null; p.onFoot = true;
      advanceStep(G);
    }
    return;
  }
  if (s.kind === 'clearGang') {
    if ((G.gangsters || []).length === 0) advanceStep(G);
    return;
  }
  if (s.kind === 'getWanted') {
    if (G.wanted >= (s.level || 3)) advanceStep(G);
    return;
  }
  if (s.kind === 'loseWanted') {
    if (G.wanted === 0) advanceStep(G);
    return;
  }
  if (s.kind === 'collect') {
    if (dist2(px, py, s.x, s.y) < s.r * s.r) advanceStep(G);
    return;
  }
  // Plain go-to step.
  if (s.x && dist2(px, py, s.x, s.y) < s.r * s.r) {
    if (G.missionStep === 0) runStepEnter(G, s);
    advanceStep(G);
  }
}

export function retryMission(G) {
  if (G.missionIdx < 0) return;
  startMission(G, G.missionIdx);
}
