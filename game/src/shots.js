// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (drive toward the waypoint, ride the new motorcycle, run
// the harbour mission against the clock), so the frame is what real play looks
// like and the same seed always gives the same frame. The shots are real
// renders of the game's own code in a browser.

import { STEP, WORLD } from './config.js';
import { makeRng } from './random.js';
import { LANDMARKS } from './world.js';
import { makeCar } from './vehicles.js';
import { makeGangster } from './people.js';
import { startMission } from './missions.js';

const SAMPLE = STEP;

/** Steer a car toward a point; returns { throttle, steer }. */
function driveToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = (want - car.angle) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return { throttle: 1, steer: Math.max(-1, Math.min(1, d * 2.4)), brake: false };
}

/** Run the simulation forward `seconds`, calling `pilot(state)` each step for input. */
function runForward(state, seconds, pilot) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    state.step(SAMPLE, pilot ? pilot(state) : null);
  }
}

/** A staged shot must show play, never a game-over screen: if the autopilot
 * died or its car blew up mid-scene, put the player back on their feet. */
function ensureAlive(state) {
  if (state.screen === 'wasted' || state.screen === 'busted') {
    state.screen = 'play';
    state.player.health = 100;
    state.wanted = Math.min(state.wanted, 3);
  }
  const p = state.player;
  if (p.inCar && (p.inCar.dead || p.inCar.health <= 0)) {
    const car = makeCar(1, p.x, p.y, p.angle, '#d6455b', 'player');
    state.cars.push(car);
    p.inCar = car;
  }
}

export function stageShot(name, state) {
  const rng = makeRng(20261122);
  state.resetWorld(1337);
  state.timeOfDay = 10.5;
  state.screen = 'play';
  state.hudHidden = false;

  if (name === 'start') {
    // Title screen over a downtown vista at golden hour.
    state.timeOfDay = 17.8;
    state.camera.x = 1600;
    state.camera.y = 1440;
    state.screen = 'title';
    return { screen: 'title' };
  }

  if (name === 'drive') {
    // Dana riding the Corsaro 900 motorcycle down the main avenue, traffic
    // around her — the new bike is the fastest way across Solmarina.
    const bike = makeCar(6, 1600, 1100, Math.PI / 2, '#c0392b', 'player');
    state.cars.push(bike);
    state.player.inCar = bike;
    state.player.x = bike.x;
    state.player.y = bike.y;
    state.cash = 1250;
    runForward(state, 6, (s) => {
      const c = s.player.inCar;
      return c ? { car: driveToward(c, 1600, 2000) } : null;
    });
    ensureAlive(state);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Three-star police chase in the rain: one patrol car tails her, a second
    // cuts ahead to block the avenue, and the wet roads make it slippery.
    state.setWeather('rain');
    const car = makeCar(3, 1600, 900, Math.PI / 2, '#22242c', 'player');
    state.cars.push(car);
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.cash = 2400;
    state.wanted = 3;
    // Two patrol cars right on her tail so the chase is in the frame, plus a
    // blocker ahead on the avenue cutting the escape route.
    for (const [dx, dy] of [[-40, -260], [60, -320]]) {
      const pc = makeCar(5, car.x + dx, car.y + dy, Math.PI / 2, '#1c2f57', 'police');
      pc.role = 'chase';
      state.cars.push(pc);
    }
    const blocker = makeCar(5, 1600, 2000, -Math.PI / 2, '#1c2f57', 'police');
    blocker.role = 'block';
    state.cars.push(blocker);
    startMission(state, 3); // Getaway — escape to the flat
    runForward(state, 6, (s) => {
      const c = s.player.inCar;
      if (!c) return null;
      return { car: driveToward(c, 1600, 2440) };
    });
    ensureAlive(state);
    return { screen: 'play' };
  }

  // 'mission': the new seventh mission — Harbour Run in the fog. Dana picks
  // up the harbour stash and runs it to the marina against the clock.
  state.timeOfDay = 16.2;
  state.setWeather('fog');
  state.player.x = LANDMARKS.harbour.x - 120;
  state.player.y = LANDMARKS.harbour.y + 40;
  state.player.angle = 0;
  state.player.weapons.pistol = true;
  state.player.weapons.smg = true;
  state.player.weapons.rifle = true;
  state.player.weapon = 'rifle';
  state.player.ammo.rifle = 20;
  state.player.ammo.smg = 120;
  state.player.ammo.pistol = 48;
  state.cash = 1850;
  // A car at the harbour so the timed run can start the moment she grabs
  // the stash.
  const harbourCar = makeCar(3, LANDMARKS.harbour.x - 60, LANDMARKS.harbour.y - 40, 0, '#22242c', 'player');
  state.cars.push(harbourCar);
  startMission(state, 6); // Harbour Run
  runForward(state, 8, (s) => {
    // Drive toward the current objective; grab the stash on the way.
    const p = s.player;
    const step = s.missionStep;
    let tx = LANDMARKS.marina.x;
    let ty = LANDMARKS.marina.y;
    if (step && step.x !== undefined) { tx = step.x; ty = step.y; }
    if (!p.inCar) {
      // On foot: walk to the objective (or to the harbour car first).
      const car = s.cars.find((c) => c.driver === 'player' && !c.dead);
      if (car && Math.hypot(car.x - p.x, car.y - p.y) < 120) {
        p.inCar = car;
        p.x = car.x;
        p.y = car.y;
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / len, y: dy / len } };
    }
    const c = p.inCar;
    return { car: driveToward(c, tx, ty) };
  });
  ensureAlive(state);
  return { screen: 'play' };
}
