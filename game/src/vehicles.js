// Vehicles: spawning, driving physics, traffic AI and police AI.
// Police coordinate: the closest unit chases, the next one cuts ahead
// of the player's velocity to block the escape route (wanted >= 2).
import { CAR_MODELS, BIKE, WORLD, WEATHER_KINDS } from './config.js';
import { clamp, angleDiff, dist2, angleTo } from './random.js';
import { circleHitsBuilding, onRoad, clampToWorld } from './world.js';

let nextId = 1;

export function makeVehicle(model, x, y, angle, driver) {
  return {
    id: nextId++,
    model,
    x, y, angle,
    speed: 0,
    health: 100,
    driver: driver || 'parked', // 'player' | 'traffic' | 'police' | 'parked'
    color: model.color,
    wobble: 0,
    target: null,
    role: null, // police: 'chase' | 'block'
    stuckT: 0,
    siren: 0,
  };
}

export function spawnParkedCars(G) {
  for (const s of G.world.carSpawns) {
    if (s.bike) {
      G.vehicles.push(makeVehicle(BIKE, s.x, s.y, s.angle, 'parked'));
    } else {
      const model = CAR_MODELS[Math.floor(G.rng() * (CAR_MODELS.length - 1))];
      G.vehicles.push(makeVehicle(model, s.x, s.y, s.angle, 'parked'));
    }
  }
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const s = G.world.carSpawns[Math.floor(G.rng() * G.world.carSpawns.length)];
    if (s.bike) continue;
    const model = CAR_MODELS[Math.floor(G.rng() * (CAR_MODELS.length - 1))];
    const v = makeVehicle(model, s.x + (G.rng() - 0.5) * 30, s.y + (G.rng() - 0.5) * 30, G.rng() * Math.PI * 2, 'traffic');
    v.speed = model.top * 0.45;
    G.vehicles.push(v);
  }
}

export function spawnPolice(G) {
  const p = G.player;
  const model = CAR_MODELS[CAR_MODELS.length - 1];
  const ang = G.rng() * Math.PI * 2;
  const d = 700 + G.rng() * 300;
  const x = clamp(p.x + Math.cos(ang) * d, 60, WORLD.w - 60);
  const y = clamp(p.y + Math.sin(ang) * d, 60, WORLD.h - 60);
  const v = makeVehicle(model, x, y, angleTo(x, y, p.x, p.y), 'police');
  v.speed = model.top * 0.6;
  G.vehicles.push(v);
  return v;
}

function drivePhysics(G, v, dt, throttle, steer) {
  const grip = WEATHER_KINDS[G.weather].grip * v.model.grip;
  const accel = v.model.accel * throttle * (throttle < 0 ? 0.6 : 1);
  v.speed = clamp(v.speed + accel * dt, -v.model.top * 0.35, v.model.top);
  // Drag and grip.
  v.speed -= v.speed * (v.model.bike ? 0.25 : 0.4) * dt;
  if (Math.abs(v.speed) < 4 && throttle === 0) v.speed = 0;
  const turnRate = (v.model.bike ? 2.6 : 2.1) * grip * clamp(Math.abs(v.speed) / 160, 0.25, 1);
  v.angle += steer * turnRate * dt * (v.speed >= 0 ? 1 : -1);
  // Bike wobble at top speed.
  if (v.model.bike) {
    const ratio = Math.abs(v.speed) / v.model.top;
    v.wobble = ratio > 0.75 ? Math.sin(G.time * 14) * (ratio - 0.75) * 0.9 : 0;
    v.angle += v.wobble * dt;
    if (ratio > 0.92 && G.rng() < dt * 0.4) {
      // Hard crash risk: damage and a speed cut.
      v.speed *= 0.55;
      v.health -= 6;
      G.particles.push({ x: v.x, y: v.y, kind: 'spark', t: 0.4, max: 0.4 });
    }
  }
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  if (!circleHitsBuilding(G.world, nx, ny, 16)) {
    v.x = nx; v.y = ny;
  } else {
    v.speed *= -0.25;
    v.health -= 2;
    G.particles.push({ x: v.x, y: v.y, kind: 'spark', t: 0.3, max: 0.3 });
  }
  const c = clampToWorld(v.x, v.y, 20);
  v.x = c.x; v.y = c.y;
}

function trafficSteer(G, v, dt) {
  // Follow the road: steer toward the nearest avenue/street direction.
  let best = null, bestD = Infinity;
  for (const r of G.world.roads) {
    const d = r.vertical ? Math.abs(v.x - r.x1) : Math.abs(v.y - r.y1);
    if (d < bestD) { bestD = d; best = r; }
  }
  let targetAngle = v.angle;
  if (best) {
    if (best.vertical) targetAngle = v.y < WORLD.h / 2 ? Math.PI / 2 : -Math.PI / 2;
    else targetAngle = v.x < WORLD.w / 2 ? 0 : Math.PI;
    // Keep to the right-hand lane.
    if (best.vertical) v.x += (best.x1 + 20 - v.x) * 0.5 * dt;
    else v.y += (best.y1 + 16 - v.y) * 0.5 * dt;
  }
  const diff = angleDiff(v.angle, targetAngle);
  const steer = clamp(diff * 2, -1, 1);
  // Slow for cars ahead.
  let throttle = 0.6;
  for (const o of G.vehicles) {
    if (o === v) continue;
    if (dist2(v.x, v.y, o.x, o.y) < 90 * 90 && Math.abs(angleDiff(v.angle, angleTo(v.x, v.y, o.x, o.y))) < 0.6) {
      throttle = 0.15;
    }
  }
  drivePhysics(G, v, dt, throttle, steer);
}

function policeSteer(G, v, dt) {
  const p = G.player;
  const pv = p.vehicle;
  const px = pv ? pv.x : p.x;
  const py = pv ? pv.y : p.y;
  const pvx = pv ? Math.cos(pv.angle) * pv.speed : p.vx;
  const pvy = pv ? Math.sin(pv.angle) * pv.speed : p.vy;
  let tx = px, ty = py;
  if (v.role === 'block') {
    // Cut ahead of the player's velocity vector.
    tx = px + pvx * 1.4;
    ty = py + pvy * 1.4;
  }
  const want = angleTo(v.x, v.y, tx, ty);
  const diff = angleDiff(v.angle, want);
  const steer = clamp(diff * 2.4, -1, 1);
  const throttle = Math.abs(diff) > 1.4 ? 0.3 : 1;
  drivePhysics(G, v, dt, throttle, steer);
  v.siren += dt;
  // Ram the player when close.
  const d2 = dist2(v.x, v.y, px, py);
  if (d2 < 46 * 46) {
    if (pv) { pv.health -= 14 * dt; pv.speed *= 0.92; }
    else { G.player.hp -= 10 * dt; }
    G.particles.push({ x: px, y: py, kind: 'spark', t: 0.25, max: 0.25 });
  }
}

export function assignPoliceRoles(G) {
  const cops = G.vehicles.filter((v) => v.driver === 'police');
  if (!cops.length) return;
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  cops.sort((a, b) => dist2(a.x, a.y, px, py) - dist2(b.x, b.y, px, py));
  cops[0].role = 'chase';
  for (let i = 1; i < cops.length; i++) cops[i].role = G.wanted >= 2 ? 'block' : 'chase';
}

export function updateVehicles(G, dt) {
  for (const v of G.vehicles) {
    if (v.driver === 'player') {
      const grip = WEATHER_KINDS[G.weather].grip;
      let throttle = 0, steer = 0;
      if (G.input.up) throttle = 1;
      if (G.input.downKey) throttle = -1;
      if (G.input.left) steer = -1;
      if (G.input.right) steer = 1;
      drivePhysics(G, v, dt, throttle, steer);
      if (v.health <= 0) {
        // Wreck: player is thrown out, car burns.
        exitVehicle(G, true);
        v.driver = 'wreck';
        G.particles.push({ x: v.x, y: v.y, kind: 'smoke', t: 2, max: 2 });
      }
    } else if (v.driver === 'traffic') {
      trafficSteer(G, v, dt);
    } else if (v.driver === 'police') {
      policeSteer(G, v, dt);
    }
  }
  // Remove wrecks far away after a while.
  G.vehicles = G.vehicles.filter((v) => v.driver !== 'wreck' || dist2(v.x, v.y, G.player.x, G.player.y) < 1400 * 1400);
}

export function nearestVehicle(G, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const v of G.vehicles) {
    if (v.driver === 'player' || v.driver === 'wreck') continue;
    const d = dist2(x, y, v.x, v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function enterVehicle(G, v) {
  const p = G.player;
  if (v.driver === 'traffic') {
    // Carjacking: the driver flees on foot, wanted rises.
    addWanted(G, 1);
    G.peds.push({ x: v.x + 30, y: v.y + 30, angle: 0, speed: 130, kind: 'flee', state: 'flee', t: 0, hp: 100 });
    G.hudMsg = 'Car stolen! The police noticed.';
    G.hudMsgT = 3;
  }
  v.driver = 'player';
  p.vehicle = v;
  p.onFoot = false;
  p.x = v.x; p.y = v.y;
}

export function exitVehicle(G, wrecked) {
  const p = G.player;
  const v = p.vehicle;
  if (!v) return;
  v.driver = wrecked ? 'wreck' : 'parked';
  v.speed = wrecked ? 0 : v.speed * 0.3;
  p.vehicle = null;
  p.onFoot = true;
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
  p.vx = 0; p.vy = 0;
}

export function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedTimer = 0;
  // Keep police numbers in step with the wanted level.
  const cops = G.vehicles.filter((v) => v.driver === 'police').length;
  const want = G.wanted === 0 ? 0 : Math.min(1 + G.wanted, 5);
  for (let i = cops; i < want; i++) spawnPolice(G);
  assignPoliceRoles(G);
}

export function decayWanted(G, dt) {
  if (G.wanted === 0) return;
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const sight = WEATHER_KINDS[G.weather].sight;
  let seen = false;
  for (const v of G.vehicles) {
    if (v.driver !== 'police') continue;
    const d = Math.hypot(v.x - px, v.y - py);
    if (d < sight && hasLineOfSight(G, v.x, v.y, px, py)) { seen = true; break; }
  }
  if (!seen) {
    for (const c of G.cops) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < sight * 0.7 && hasLineOfSight(G, c.x, c.y, px, py)) { seen = true; break; }
    }
  }
  if (seen) { G.wantedTimer = 0; return; }
  G.wantedTimer += dt;
  if (G.wantedTimer > 14) {
    G.wanted -= 1;
    G.wantedTimer = 0;
    if (G.wanted === 0) {
      // Police give up and drive off.
      G.vehicles = G.vehicles.filter((v) => v.driver !== 'police');
    }
  }
}

function hasLineOfSight(G, x1, y1, x2, y2) {
  // Local alias so police logic does not import world twice.
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleHitsBuilding(G.world, x1 + dx * t, y1 + dy * t, 2)) return false;
  }
  return true;
}
