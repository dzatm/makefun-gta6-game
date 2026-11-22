// Cars: arcade physics (acceleration, steering, drift, damage, smoke) plus the
// traffic AI that drives them along the road grid and the police AI that hunts
// the player. A car is driven by the player, by traffic, or by the police.

import { CAR, WORLD, ROADS_X, ROADS_Y, POLICE } from './config.js';
import { clamp, angleDelta, dist, pick, gauss } from './random.js';
import { collideBuildings, nearestRoadPoint, randomRoadPoint, onRoad } from './world.js';

let nextId = 1;

/** True for the motorcycle model: narrow, fast, and the rider is exposed. */
export function isBike(car) {
  return !!CAR.models[car.model].bike;
}

export function makeCar(modelIndex, x, y, angle, color, driver = 'traffic') {
  const m = CAR.models[modelIndex];
  return {
    id: nextId,
    kind: 'car',
    model: modelIndex,
    name: m.name,
    x, y, angle,
    speed: 0,
    steer: 0,
    color,
    driver, // 'player' | 'traffic' | 'police' | 'gang' | 'parked'
    health: CAR.health,
    wanted: false,
    // traffic AI state
    lane: 0,
    dir: 0, // 0 = along +x/+y, 1 = -x/-y; axis: 'h' | 'v'
    axis: 'h',
    targetSpeed: 0,
    wait: 0,
    smoke: 0,
    brake: false,
    dead: false,
    // Police coordination role, assigned by the game each tick: 'chase' tails
    // the player, 'block' cuts ahead of them. Null for other drivers.
    role: null,
    // Motorcycle wobble clock; bikes sway a little at speed.
    wobbleT: 0,
  };
}

export function spawnTrafficCar(rng, city, minDistTo) {
  let p;
  let tries = 0;
  do {
    p = randomRoadPoint(rng);
    tries += 1;
  } while (tries < 20 && minDistTo && dist(p.x, p.y, minDistTo.x, minDistTo.y) < 500);
  const model = pick(rng, [0, 0, 1, 1, 2, 3, 4, 6]);
  const car = makeCar(model, p.x, p.y, 0, pick(rng, CAR.models[model].colors), 'traffic');
  const rp = nearestRoadPoint(p.x, p.y);
  car.axis = rp.axis;
  car.dir = rng() < 0.5 ? 0 : 1;
  car.angle = car.axis === 'h' ? (car.dir === 0 ? 0 : Math.PI) : (car.dir === 0 ? Math.PI / 2 : -Math.PI / 2);
  car.lane = rng() < 0.5 ? -1 : 1;
  car.targetSpeed = CAR.models[model].top * 0.45;
  return car;
}

export function spawnParkedCar(rng, city, minDistTo) {
  let p;
  let tries = 0;
  do {
    p = randomRoadPoint(rng);
    tries += 1;
  } while (tries < 20 && minDistTo && dist(p.x, p.y, minDistTo.x, minDistTo.y) < 420);
  const model = pick(rng, [0, 1, 2, 3]);
  const car = makeCar(model, p.x, p.y, rng() < 0.5 ? 0 : Math.PI / 2, pick(rng, CAR.models[model].colors), 'parked');
  // Parked cars sit at the road edge, not in the lane.
  const rp = nearestRoadPoint(p.x, p.y);
  if (rp.axis === 'h') {
    car.y = rp.y + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 14);
    car.angle = rng() < 0.5 ? 0 : Math.PI;
  } else {
    car.x = rp.x + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 14);
    car.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  return car;
}

/** A parked motorcycle at the road edge, ready to steal. */
export function spawnParkedBike(rng, city, minDistTo) {
  let p;
  let tries = 0;
  do {
    p = randomRoadPoint(rng);
    tries += 1;
  } while (tries < 20 && minDistTo && dist(p.x, p.y, minDistTo.x, minDistTo.y) < 420);
  const bike = makeCar(6, p.x, p.y, rng() < 0.5 ? 0 : Math.PI / 2, pick(rng, CAR.models[6].colors), 'parked');
  const rp = nearestRoadPoint(p.x, p.y);
  if (rp.axis === 'h') {
    bike.y = rp.y + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 14);
    bike.angle = rng() < 0.5 ? 0 : Math.PI;
  } else {
    bike.x = rp.x + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 14);
    bike.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  return bike;
}

/** Arcade car step. `input` is { throttle: -1..1, steer: -1..1, brake } for the player; traffic passes its own.
 * `grip` (0..1) is the weather's road grip: rain makes acceleration, turning
 * and braking all weaker, so wet roads feel slick. */
export function stepCar(car, dt, input, city, grip = 1) {
  const m = CAR.models[car.model];
  const accel = input.throttle * m.accel * grip;
  const drag = 0.6 + Math.abs(car.speed) * 0.0011;
  car.speed += accel * dt;
  car.speed -= car.speed * drag * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * 900 * grip * dt;
  car.speed = clamp(car.speed, -m.top * 0.45, m.top);
  if (Math.abs(car.speed) < 4 && input.throttle === 0) car.speed = 0;

  const steerAmount = input.steer * m.turn * (0.55 + 0.45 * grip) * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steerAmount * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
  // Motorcycles wobble: a small sinusoidal sway plus gaussian jitter that
  // grows with speed, so a bike at full tilt needs constant correction.
  if (isBike(car)) {
    car.wobbleT += dt;
    const wob = Math.sin(car.wobbleT * 9) * CAR.bikeWobble * (Math.abs(car.speed) / m.top);
    car.angle += wob * dt * 2 + gauss(Math.random) * 0.004 * (Math.abs(car.speed) / m.top);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const old = { x: car.x, y: car.y };
  car.x = nx;
  car.y = ny;
  const pos = { x: car.x, y: car.y };
  const hit = collideBuildings(city, pos, Math.max(m.w, m.h) / 2 - 6);
  car.x = pos.x;
  car.y = pos.y;
  if (hit) {
    car.speed *= 0.45;
    if (Math.abs(car.speed) > 200) car.health -= 2;
    // A bike has no roof or crumple zone: hard crashes hurt the machine more.
    if (isBike(car) && Math.abs(car.speed) > 200) car.health -= 4;
    // slide along the wall instead of sticking
    if (Math.abs(car.x - old.x) < 0.5 && Math.abs(car.y - old.y) < 0.5) {
      car.angle += 0.4 * dt * 10;
    }
  }
  car.x = clamp(car.x, 20, WORLD.width - 20);
  car.y = clamp(car.y, 20, WORLD.height - 20);
  if (car.health < 40) car.smoke = Math.min(1, car.smoke + dt * 0.5);
  return hit;
}

/** Traffic AI: follow the road grid, turn at intersections, slow for cars ahead. */
export function stepTraffic(car, dt, city, cars, player, grip = 1) {
  const m = CAR.models[car.model];
  if (car.wait > 0) {
    car.wait -= dt;
    return stepCar(car, dt, { throttle: 0, steer: 0, brake: true }, city, grip);
  }
  // Stay in lane: target point is the road centre offset by the lane side.
  const rp = nearestRoadPoint(car.x, car.y);
  const laneOff = 30 * car.lane;
  let tx;
  let ty;
  if (car.axis === 'h') {
    tx = car.x + (car.dir === 0 ? 200 : -200);
    ty = rp.y + laneOff;
  } else {
    tx = rp.x - laneOff;
    ty = car.y + (car.dir === 0 ? 200 : -200);
  }
  // At an intersection, sometimes turn.
  const nearX = ROADS_X.some((rx) => Math.abs(car.x - rx) < 46);
  const nearY = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 46);
  if (nearX && nearY && Math.random() < dt * 0.35) {
    const turn = Math.random();
    if (turn < 0.5) {
      // Switch axis at this intersection.
      if (car.axis === 'h') {
        car.axis = 'v';
        car.dir = Math.random() < 0.5 ? 0 : 1;
      } else {
        car.axis = 'h';
        car.dir = Math.random() < 0.5 ? 0 : 1;
      }
    } else {
      car.dir = 1 - car.dir; // U-turn is rare; keep it simple: reverse direction
      car.dir = 1 - car.dir;
    }
  }
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  const dAngle = angleDelta(car.angle, wantAngle);
  const steer = clamp(dAngle * 2.2, -1, 1);
  // Slow down if a car is close ahead.
  let ahead = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 110) {
      const a = Math.atan2(other.y - car.y, other.x - car.x);
      if (Math.abs(angleDelta(car.angle, a)) < 0.6) { ahead = true; break; }
    }
  }
  if (player && player.inCar === car) ahead = false;
  const throttle = ahead ? 0 : 1;
  stepCar(car, dt, { throttle, steer, brake: ahead }, city, grip);
  // Keep traffic on the road: if it drifted off, steer back.
  if (!onRoad(car.x, car.y)) {
    const rp2 = nearestRoadPoint(car.x, car.y);
    car.angle += angleDelta(car.angle, Math.atan2(rp2.y - car.y, rp2.x - car.x)) * dt * 2;
  }
}

/** Police AI: chase the player's car or the player on foot, ramming to stop them.
 * The game assigns each patrol car a role: 'chase' tails the player, 'block'
 * cuts ahead of their velocity and parks across the escape route, and the cars
 * spread out instead of piling onto the same bumper. */
export function stepPolice(car, dt, city, target, cars, role = 'chase', grip = 1) {
  const d = dist(car.x, car.y, target.x, target.y);
  let tx = target.x;
  let ty = target.y;
  if (role === 'block') {
    // Aim ahead of where the player is heading, not where they are.
    const tvx = Math.cos(target.angle || 0) * (target.speed || 0);
    const tvy = Math.sin(target.angle || 0) * (target.speed || 0);
    tx = target.x + tvx * POLICE.blockAhead;
    ty = target.y + tvy * POLICE.blockAhead;
  }
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  const dAngle = angleDelta(car.angle, wantAngle);
  const steer = clamp(dAngle * 2.6, -1, 1);
  const arriveD = role === 'block' ? Math.hypot(tx - car.x, ty - car.y) : d;
  const throttle = arriveD > 60 ? 1 : 0.4;
  const hit = stepCar(car, dt, { throttle, steer, brake: arriveD < 40 }, city, grip);
  if (hit && d < 120) car.speed *= 0.8;
  // Police push other traffic aside by slowing near them.
  for (const other of cars) {
    if (other === car || other.driver !== 'traffic') continue;
    if (dist(car.x, car.y, other.x, other.y) < 90) other.wait = Math.max(other.wait, 0.5);
  }
  // Spread out: a patrol car eases off when another patrol car is on its bumper.
  for (const other of cars) {
    if (other === car || other.driver !== 'police' || other.dead) continue;
    const od = dist(car.x, car.y, other.x, other.y);
    if (od < 70 && od > 0.01) {
      const push = (70 - od) / 70;
      car.x += ((car.x - other.x) / od) * push * 20 * dt;
      car.y += ((car.y - other.y) / od) * push * 20 * dt;
    }
  }
  return d;
}

/** Gang chase car: like police but tries to stay beside the player and shoot. */
export function stepGangCar(car, dt, city, target, grip = 1) {
  const d = dist(car.x, car.y, target.x, target.y);
  const side = car.id % 2 === 0 ? 1 : -1;
  const tx = target.x + Math.cos((target.angle ?? 0) + side * 1.2) * 90;
  const ty = target.y + Math.sin((target.angle ?? 0) + side * 1.2) * 90;
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  const dAngle = angleDelta(car.angle, wantAngle);
  const steer = clamp(dAngle * 2.6, -1, 1);
  stepCar(car, dt, { throttle: d > 120 ? 1 : 0.55, steer, brake: false }, city, grip);
  return d;
}

/** Simple circle collision between two cars; pushes them apart and damages both. */
export function collideCars(a, b) {
  const ma = CAR.models[a.model];
  const mb = CAR.models[b.model];
  const ra = Math.max(ma.w, ma.h) / 2 - 4;
  const rb = Math.max(mb.w, mb.h) / 2 - 4;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = ra + rb - 18;
  if (d > 0.01 && d < min) {
    const push = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    const impact = Math.abs(a.speed - b.speed);
    if (impact > 120) {
      a.health -= impact * 0.02;
      b.health -= impact * 0.02;
      a.speed *= 0.7;
      b.speed *= 0.7;
      return true;
    }
  }
  return false;
}
