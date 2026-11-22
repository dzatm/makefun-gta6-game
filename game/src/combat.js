// Combat: bullets, melee, pickups (cash, health, ammo, weapons) and explosions.
// Bullets are simple point projectiles with a range; pickups are magnets that the
// player collects by walking or driving over them.

import { WEAPONS } from './config.js';
import { dist, clamp } from './random.js';
import { insideSolid } from './world.js';

export function makeBullet(x, y, angle, speed, damage, fromPlayer, range = 520) {
  return { x, y, angle, speed, damage, fromPlayer, range, traveled: 0, dead: false };
}

export function fireWeapon(state, shooter, weaponId, angle) {
  const w = WEAPONS[weaponId];
  if (!w) return;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = (Math.random() - 0.5) * 2 * (w.spread || 0);
    const a = angle + spread;
    const bx = shooter.x + Math.cos(a) * 24;
    const by = shooter.y + Math.sin(a) * 24;
    state.bullets.push(makeBullet(bx, by, a, w.speed, w.damage, shooter === state.player, w.range));
  }
  state.effects.push({ kind: 'flash', x: shooter.x + Math.cos(angle) * 26, y: shooter.y + Math.sin(angle) * 26, t: 0, life: 0.08 });
  state.audio?.shot();
  // Recoil: the shooter's aim kicks and the camera jolts, scaled by the
  // weapon — a rifle kick is a real jolt, an SMG barely moves.
  applyRecoil(state, shooter, w.recoil || 0);
}

/** Apply a weapon's recoil to its shooter: a small aim kick plus a camera
 * shake for the player. */
export function applyRecoil(state, shooter, recoil) {
  if (!recoil) return;
  shooter.recoilKick = (shooter.recoilKick || 0) + recoil;
  if (shooter === state.player) {
    shooter.angle += (Math.random() - 0.5) * recoil * 0.5;
    state.shake = Math.max(state.shake || 0, recoil * 6);
  }
}

export function stepBullets(state, dt) {
  for (const b of state.bullets) {
    if (b.dead) continue;
    const step = b.speed * dt;
    const px = b.x;
    const py = b.y;
    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.traveled += step;
    if (b.traveled > b.range || b.x < 0 || b.y < 0 || b.x > state.cityBounds.width || b.y > state.cityBounds.height) {
      b.dead = true;
      continue;
    }
    if (insideSolid(state.city, b.x, b.y)) {
      b.dead = true;
      state.effects.push({ kind: 'spark', x: b.x, y: b.y, t: 0, life: 0.25 });
      continue;
    }
    // Hit cars (segment vs circle, so fast bullets cannot tunnel past).
    for (const car of state.cars) {
      if (car.dead || car.health <= 0) continue;
      if (segHit(px, py, b.x, b.y, car.x, car.y, 34)) {
        b.dead = true;
        car.health -= b.damage;
        state.effects.push({ kind: 'spark', x: b.x, y: b.y, t: 0, life: 0.25 });
        if (car.health <= 0) explodeCar(state, car);
        break;
      }
    }
    if (b.dead) continue;
    if (b.fromPlayer) {
      // Hit gangsters and cops.
      for (const g of state.enemies) {
        if (g.dead) continue;
        if (segHit(px, py, b.x, b.y, g.x, g.y, 16)) {
          b.dead = true;
          g.hp -= b.damage;
          state.effects.push({ kind: 'hit', x: b.x, y: b.y, t: 0, life: 0.3 });
          if (g.hp <= 0) killEnemy(state, g);
          break;
        }
      }
      if (b.dead) continue;
      for (const c of state.cops) {
        if (c.dead) continue;
        if (segHit(px, py, b.x, b.y, c.x, c.y, 15)) {
          b.dead = true;
          c.dead = true;
          addWanted(state, 1);
          state.effects.push({ kind: 'hit', x: b.x, y: b.y, t: 0, life: 0.3 });
          break;
        }
      }
      if (b.dead) continue;
      for (const p of state.peds) {
        if (p.dead) continue;
        if (segHit(px, py, b.x, b.y, p.x, p.y, 14)) {
          b.dead = true;
          p.dead = true;
          addWanted(state, 1);
          dropCash(state, p.x, p.y, p.wallet);
          break;
        }
      }
    } else {
      // Enemy bullet: hit the player (on foot or in a car).
      const px2 = state.player.x;
      const py2 = state.player.y;
      const target = state.player.inCar || null;
      if (target) {
        if (segHit(px, py, b.x, b.y, target.x, target.y, 36)) {
          b.dead = true;
          target.health -= b.damage * 0.6;
          state.effects.push({ kind: 'spark', x: b.x, y: b.y, t: 0, life: 0.25 });
          if (target.health <= 0) explodeCar(state, target);
        }
      } else if (segHit(px, py, b.x, b.y, px2, py2, 15)) {
        b.dead = true;
        damagePlayer(state, b.damage);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

/** True when the segment (x1,y1)-(x2,y2) passes within r of (cx,cy). */
function segHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = clamp(((cx - x1) * dx + (cy - y1) * dy) / len2, 0, 1);
  const nx = x1 + dx * t;
  const ny = y1 + dy * t;
  return dist(nx, ny, cx, cy) < r;
}

export function damagePlayer(state, amount) {
  if (state.player.invuln > 0 || state.screen === 'over') return;
  // Armour soaks 70% of a hit until it is gone, then health takes it all.
  const p = state.player;
  if (p.armour > 0) {
    const soaked = Math.min(p.armour, amount * 0.7);
    p.armour -= soaked;
    amount -= soaked;
  }
  p.health -= amount;
  p.invuln = 0.25;
  state.audio?.hurt();
  if (p.health <= 0) {
    p.health = 0;
    state.screen = 'wasted';
    state.audio?.wasted();
  }
}

export function addWanted(state, stars) {
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.wantedTimer = 0;
  // The siren pattern escalates with the heat: a wail at 1–3 stars, a
  // frantic yelp at 4–5.
  state.audio?.siren(state.wanted || 1);
}

export function killEnemy(state, g) {
  g.dead = true;
  dropCash(state, g.x, g.y, 40);
  state.effects.push({ kind: 'poof', x: g.x, y: g.y, t: 0, life: 0.5 });
  state.stats.kills += 1;
  state.audio?.hit();
}

export function explodeCar(state, car) {
  if (car.dead) return;
  car.dead = true;
  car.health = 0;
  state.effects.push({ kind: 'explosion', x: car.x, y: car.y, t: 0, life: 0.9 });
  state.audio?.explosion();
  state.shake = Math.max(state.shake, 10);
  const d = dist(state.player.x, state.player.y, car.x, car.y);
  if (d < 130 && !state.player.inCar) damagePlayer(state, 40);
  if (state.player.inCar === car) {
    state.player.inCar = null;
    state.player.x = car.x + 60;
    state.player.y = car.y;
    damagePlayer(state, 30);
  }
  // Chain: nearby cars catch fire too.
  for (const other of state.cars) {
    if (other !== car && !other.dead && dist(other.x, other.y, car.x, car.y) < 110) {
      other.health = Math.min(other.health, 25);
    }
  }
}

export function dropCash(state, x, y, amount) {
  state.pickups.push({ kind: 'cash', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, amount, t: 0 });
}

export function spawnPickup(state, kind, x, y, amount = 0) {
  state.pickups.push({ kind, x, y, amount, t: 0 });
}

export function stepPickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (pk.dead) continue;
    pk.t += dt;
    const d = dist(p.x, p.y, pk.x, pk.y);
    const collectR = p.inCar ? 44 : 30;
    if (d < collectR) {
      pk.dead = true;
      if (pk.kind === 'cash') {
        state.cash += pk.amount;
        state.audio?.coin();
        state.floaters.push({ x: pk.x, y: pk.y, text: `+$${pk.amount}`, t: 0, life: 1, color: '#f5c518' });
      } else if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 35);
        state.floaters.push({ x: pk.x, y: pk.y, text: '+35 HP', t: 0, life: 1, color: '#58b368' });
        state.audio?.coin();
      } else if (pk.kind === 'ammo') {
        const w = p.weapon === 'fists' ? 'pistol' : p.weapon;
        p.ammo[w] = (p.ammo[w] || 0) + 24;
        state.floaters.push({ x: pk.x, y: pk.y, text: '+24 ammo', t: 0, life: 1, color: '#4a90d9' });
        state.audio?.coin();
      } else if (pk.kind === 'armour') {
        // A vest: +50 armour, which soaks 70% of incoming damage.
        p.armour = Math.min(100, (p.armour || 0) + 50);
        state.floaters.push({ x: pk.x, y: pk.y, text: '+50 Armour', t: 0, life: 1, color: '#4a90d9' });
        state.audio?.coin();
      } else if (pk.kind === 'pistol' || pk.kind === 'smg' || pk.kind === 'shotgun' || pk.kind === 'rifle') {
        p.weapons[pk.kind] = true;
        p.weapon = pk.kind;
        p.ammo[pk.kind] = (p.ammo[pk.kind] || 0) + WEAPONS[pk.kind].ammo;
        state.floaters.push({ x: pk.x, y: pk.y, text: WEAPONS[pk.kind].name, t: 0, life: 1.2, color: '#f5c518' });
        state.audio?.coin();
      }
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.dead);
}
