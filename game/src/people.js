// Pedestrians: strollers, beach joggers, phone zombies, gangsters and
// foot cops. Foot cops take flanking cover against an armed player
// instead of charging straight in.
import { WORLD } from './config.js';
import { clamp, angleDiff, angleTo, dist2, pick } from './random.js';
import { circleHitsBuilding, hasLineOfSight, clampToWorld, onRoad } from './world.js';

export function spawnPeds(G, n) {
  const kinds = ['walker', 'walker', 'walker', 'jogger', 'zombie'];
  for (let i = 0; i < n; i++) {
    const x = 120 + G.rng() * (WORLD.w - 240);
    const y = 120 + G.rng() * (WORLD.h - 240);
    const kind = pick(G.rng, kinds);
    G.peds.push({
      x, y,
      angle: G.rng() * Math.PI * 2,
      speed: kind === 'jogger' ? 150 : kind === 'zombie' ? 55 : 75,
      kind,
      state: 'wander',
      t: G.rng() * 4,
      hp: 100,
      noticeT: kind === 'zombie' ? 1.2 : 0.35,
    });
  }
}

export function spawnFootCops(G, n, near) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    // Spawn outside the player's sight range so the wanted level can
    // still decay when the player breaks line of sight.
    const d = 560 + G.rng() * 320;
    G.cops.push({
      x: clamp(near.x + Math.cos(a) * d, 40, WORLD.w - 40),
      y: clamp(near.y + Math.sin(a) * d, 40, WORLD.h - 40),
      angle: 0, speed: 165, hp: 100, state: 'chase', t: 0,
      cover: null, shootT: 0,
    });
  }
}

function movePed(G, p, dt, tx, ty, speed) {
  const a = angleTo(p.x, p.y, tx, ty);
  p.angle += angleDiff(p.angle, a) * Math.min(1, 8 * dt);
  const nx = p.x + Math.cos(p.angle) * speed * dt;
  const ny = p.y + Math.sin(p.angle) * speed * dt;
  if (!circleHitsBuilding(G.world, nx, ny, 10)) {
    p.x = nx; p.y = ny;
  }
  const c = clampToWorld(p.x, p.y, 16);
  p.x = c.x; p.y = c.y;
}

function nearestCover(G, x, y) {
  // A building corner within 260px makes decent cover.
  let best = null, bestD = 260 * 260;
  for (const b of G.world.buildings) {
    for (const cx of [b.x, b.x + b.w]) {
      for (const cy of [b.y, b.y + b.h]) {
        const d = dist2(x, y, cx, cy);
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
      }
    }
  }
  return best;
}

export function updatePeds(G, dt) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;

  for (const ped of G.peds) {
    ped.t -= dt;
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    const danger = G.wanted >= 2 || (p.weapon !== 'fists' && dPlayer < 240) || ped.state === 'flee';
    if (danger && ped.state !== 'flee') {
      // Phone zombies are slow to notice danger.
      ped.noticeT -= dt;
      if (ped.noticeT <= 0) ped.state = 'flee';
    }
    if (ped.state === 'flee') {
      const a = angleTo(px, py, ped.x, ped.y);
      movePed(G, ped, dt, ped.x + Math.cos(a) * 200, ped.y + Math.sin(a) * 200, ped.speed * 1.7);
      if (dPlayer > 700) ped.state = 'wander';
    } else if (ped.kind === 'jogger') {
      // Joggers loop the beach and the park.
      const beach = G.world.zones.beach;
      const target = ped.t > 0
        ? { x: beach.x + 200 + ((ped.x - beach.x) % 1600), y: beach.y + 130 }
        : { x: G.world.zones.park.x + 280, y: G.world.zones.park.y + 210 };
      movePed(G, ped, dt, target.x, target.y, ped.speed);
      if (ped.t <= -6) ped.t = 6;
    } else {
      if (ped.t <= 0) {
        ped.t = 2 + G.rng() * 4;
        ped.angle = G.rng() * Math.PI * 2;
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!circleHitsBuilding(G.world, nx, ny, 10) && onRoad(G.world, nx, ny) === false) {
        ped.x = nx; ped.y = ny;
      } else {
        ped.angle += Math.PI / 2;
      }
      const c = clampToWorld(ped.x, ped.y, 16);
      ped.x = c.x; ped.y = c.y;
    }
  }

  // Foot cops.
  for (const cop of G.cops) {
    cop.t -= dt;
    const dPlayer = Math.hypot(cop.x - px, cop.y - py);
    const playerArmed = p.weapon !== 'fists';
    if (cop.state === 'chase') {
      if (playerArmed && dPlayer < 420) {
        const cover = nearestCover(G, cop.x, cop.y);
        if (cover) { cop.state = 'cover'; cop.cover = cover; }
      }
      movePed(G, cop, dt, px, py, cop.speed);
      if (dPlayer < 60) {
        // Arrest attempt / beatdown.
        p.hp -= 22 * dt;
        if (p.hp <= 0) G.onWasted();
      }
    } else if (cop.state === 'cover') {
      if (!cop.cover || dPlayer < 140) { cop.state = 'chase'; cop.cover = null; continue; }
      const cd = Math.hypot(cop.x - cop.cover.x, cop.y - cop.cover.y);
      if (cd > 26) {
        movePed(G, cop, dt, cop.cover.x, cop.cover.y, cop.speed);
      } else {
        // Shoot from cover, strafing sideways.
        cop.angle = angleTo(cop.x, cop.y, px, py);
        cop.shootT -= dt;
        if (cop.shootT <= 0 && hasLineOfSight(G.world, cop.x, cop.y, px, py)) {
          cop.shootT = 0.9;
          G.bullets.push({
            x: cop.x, y: cop.y, angle: cop.angle + (G.rng() - 0.5) * 0.1,
            speed: 780, damage: 9, from: 'cop', t: 1.2,
          });
          G.audio.gunshot(true);
        }
      }
      if (!playerArmed) cop.state = 'chase';
    }
    if (cop.hp <= 0) cop.dead = true;
  }
  G.cops = G.cops.filter((c) => !c.dead);
}
