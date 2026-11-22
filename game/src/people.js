// People on foot: pedestrians strolling the sidewalks, police officers who chase
// and arrest the player, and gang members who fight during missions. All of them
// are simple steering agents with a mood (calm, fleeing, chasing, fighting).

import { WORLD, PEDS, POLICE } from './config.js';
import { clamp, dist, angleDelta, pick, gauss, shuffle } from './random.js';
import { collideBuildings, randomSidewalkPoint } from './world.js';

const SHIRTS = ['#d6455b', '#4a90d9', '#58b368', '#e8b23a', '#8e44ad', '#e67e22', '#1abc9c', '#ecf0f1'];

export function makePed(rng, x, y) {
  // Most peds stroll; a few are joggers (fast, beach-bound) or glued to their
  // phone (slow to notice danger).
  const roll = rng();
  const style = roll < 0.14 ? 'jogger' : roll < 0.3 ? 'phone' : 'walker';
  return {
    kind: 'ped',
    x, y,
    angle: rng() * Math.PI * 2,
    speed: style === 'jogger' ? PEDS.speed * 2.2 : PEDS.speed * (0.7 + rng() * 0.6),
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    mood: 'calm',
    style,
    target: null,
    wait: 0,
    dead: false,
    panic: 0,
    phoneDelay: 0,
    wallet: 8 + Math.floor(rng() * 20),
  };
}

/** A jogger: fast, keeps to the beach path and the park loop. */
export function makeJogger(rng, x, y) {
  const p = makePed(rng, x, y);
  p.style = 'jogger';
  p.speed = PEDS.speed * 2.2;
  return p;
}

export function makeCop(x, y) {
  return {
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 265,
    shirt: '#1c2f57',
    skin: '#e0ac69',
    mood: 'chase',
    target: null,
    punchTimer: 0,
    dead: false,
    panic: 0,
    // Cover state: when the player is armed, the cop holds a flanking
    // position instead of charging straight in.
    cover: null,
    coverTimer: 0,
  };
}

export function makeGangster(x, y, hp = 50) {
  return {
    kind: 'gang',
    x, y,
    angle: 0,
    speed: 200,
    shirt: '#8e44ad',
    skin: Math.random() < 0.5 ? '#f1c27d' : '#c68642',
    mood: 'fight',
    hp,
    shootTimer: 0.5 + Math.random(),
    target: null,
    dead: false,
    panic: 0,
  };
}

/** Pick a new strolling target on a nearby sidewalk. */
function retarget(ped, rng) {
  const p = randomSidewalkPoint(rng);
  ped.target = p;
}

export function stepPed(ped, dt, city, rng, danger) {
  if (ped.dead) return;
  if (danger) {
    const d = dist(ped.x, ped.y, danger.x, danger.y);
    if (d < 260) {
      // Phone zombies notice danger late: they keep staring for a beat.
      if (ped.style === 'phone' && ped.phoneDelay <= 0) {
        ped.phoneDelay = 0.8;
      } else if (ped.phoneDelay <= 0) {
        ped.mood = 'flee';
        ped.panic = 2.5;
      }
    }
  }
  if (ped.phoneDelay > 0) {
    ped.phoneDelay -= dt;
    if (ped.phoneDelay <= 0 && ped.mood !== 'flee') {
      ped.mood = 'flee';
      ped.panic = 2.5;
    }
  }
  if (ped.panic > 0) ped.panic -= dt;
  if (ped.mood === 'flee' && ped.panic <= 0) ped.mood = 'calm';

  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  if (!ped.target || ped.mood === 'flee') {
    if (ped.mood === 'flee' && danger) {
      const a = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.target = { x: ped.x + Math.cos(a) * 300, y: ped.y + Math.sin(a) * 300 };
    } else if (ped.style === 'jogger') {
      // Joggers loop along the beach and the park, not random sidewalks.
      const beach = { x: 300 + rng() * 3200, y: 2560 + rng() * 80 };
      const park = { x: 1440 + rng() * 320, y: 760 + rng() * 240 };
      ped.target = rng() < 0.6 ? beach : park;
    } else {
      retarget(ped, rng);
    }
  }
  const d = dist(ped.x, ped.y, ped.target.x, ped.target.y);
  if (d < 12) {
    ped.target = null;
    // Wait times cluster around a natural mean instead of a flat range.
    ped.wait = Math.max(0.2, 1.2 + gauss(rng) * 0.9);
    return;
  }
  const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  ped.angle += clamp(angleDelta(ped.angle, want), -6 * dt, 6 * dt);
  const speed = ped.mood === 'flee' ? ped.speed * 1.9 : ped.speed;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const pos = { x: nx, y: ny };
  collideBuildings(city, pos, 12);
  ped.x = clamp(pos.x, 20, WORLD.width - 20);
  ped.y = clamp(pos.y, 20, WORLD.height - 20);
}

export function stepCop(cop, dt, city, player) {
  if (cop.dead) return 0;
  const d = dist(cop.x, cop.y, player.x, player.y);
  const playerArmed = player.weapon && player.weapon !== 'fists';
  // Take cover: an armed player inside cover range makes the cop stop
  // charging and hold a flanking position off the line of fire instead.
  if (playerArmed && d < POLICE.coverRange && d > 40) {
    if (!cop.cover || cop.coverTimer <= 0) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = Math.atan2(player.y - cop.y, player.x - cop.x);
      const flank = a + (Math.PI / 2) * side;
      cop.cover = {
        x: clamp(player.x + Math.cos(flank) * POLICE.coverHold, 20, WORLD.width - 20),
        y: clamp(player.y + Math.sin(flank) * POLICE.coverHold, 20, WORLD.height - 20),
      };
      cop.coverTimer = 2.5 + Math.random() * 2;
    }
    cop.coverTimer -= dt;
    const cd = dist(cop.x, cop.y, cop.cover.x, cop.cover.y);
    if (cd > 24) {
      const want = Math.atan2(cop.cover.y - cop.y, cop.cover.x - cop.x);
      cop.angle += clamp(angleDelta(cop.angle, want), -7 * dt, 7 * dt);
      const pos = { x: cop.x + Math.cos(cop.angle) * cop.speed * 0.8 * dt, y: cop.y + Math.sin(cop.angle) * cop.speed * 0.8 * dt };
      collideBuildings(city, pos, 12);
      cop.x = pos.x;
      cop.y = pos.y;
    }
    // Crouched behind cover, the cop does not close in to punch.
    if (cop.punchTimer > 0) cop.punchTimer -= dt;
    return d;
  }
  cop.cover = null;
  const want = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.angle += clamp(angleDelta(cop.angle, want), -7 * dt, 7 * dt);
  const speed = d > 26 ? cop.speed : 0;
  const pos = { x: cop.x + Math.cos(cop.angle) * speed * dt, y: cop.y + Math.sin(cop.angle) * speed * dt };
  collideBuildings(city, pos, 12);
  cop.x = pos.x;
  cop.y = pos.y;
  if (cop.punchTimer > 0) cop.punchTimer -= dt;
  return d;
}

/** Gangster AI: keep a firing distance from the player and shoot. Returns true when it fires.
 * Gangsters now spawn at shuffled offsets (see missions) and strafe between
 * shots instead of standing still. */
export function stepGangster(g, dt, city, player, rng) {
  if (g.dead) return false;
  const d = dist(g.x, g.y, player.x, player.y);
  let move = 0;
  if (d > 320) move = 1;
  else if (d < 160) move = -0.7;
  const want = Math.atan2(player.y - g.y, player.x - g.x);
  g.angle += clamp(angleDelta(g.angle, want), -6 * dt, 6 * dt);
  if (move !== 0) {
    const pos = { x: g.x + Math.cos(g.angle) * g.speed * move * dt, y: g.y + Math.sin(g.angle) * g.speed * move * dt };
    collideBuildings(city, pos, 12);
    g.x = clamp(pos.x, 20, WORLD.width - 20);
    g.y = clamp(pos.y, 20, WORLD.height - 20);
  } else {
    // At firing range, strafe sideways so the player cannot just lead them.
    const strafe = Math.sin((g.strafeT || 0) * 1.7) > 0 ? 1 : -1;
    g.strafeT = (g.strafeT || 0) + dt;
    const sa = g.angle + (Math.PI / 2) * strafe;
    const pos = { x: g.x + Math.cos(sa) * g.speed * 0.45 * dt, y: g.y + Math.sin(sa) * g.speed * 0.45 * dt };
    collideBuildings(city, pos, 12);
    g.x = clamp(pos.x, 20, WORLD.width - 20);
    g.y = clamp(pos.y, 20, WORLD.height - 20);
  }
  g.shootTimer -= dt;
  if (g.shootTimer <= 0 && d < 480) {
    g.shootTimer = 0.9 + rng() * 0.9;
    return true;
  }
  return false;
}

/** Scatter: peds near a point panic (used when a shot is fired or a car crashes). */
export function panicNear(peds, x, y, radius = 280) {
  for (const p of peds) {
    if (!p.dead && dist(p.x, p.y, x, y) < radius) {
      p.mood = 'flee';
      p.panic = 3;
    }
  }
}
