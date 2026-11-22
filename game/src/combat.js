// Combat: firing, bullets, pickups and damage. Armour soaks 70% of
// incoming hits; the rifle has real recoil and camera shake.
import { WEAPONS } from './config.js';
import { clamp, dist2, angleTo } from './random.js';
import { circleHitsBuilding, clampToWorld } from './world.js';
import { addWanted } from './vehicles.js';

export function fireWeapon(G) {
  const p = G.player;
  if (!p.onFoot || p.hp <= 0) return;
  const w = WEAPONS[p.weapon];
  const now = G.time;
  if (now - (p.lastShot || -9) < w.rate) return;
  if (p.weapon !== 'fists' && (p.ammo[p.weapon] || 0) <= 0) {
    G.hudMsg = 'Out of ammo — find a gun shop (G)';
    G.hudMsgT = 2.5;
    return;
  }
  p.lastShot = now;
  const muzzle = { x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26 };
  if (p.weapon === 'fists') {
    // Melee arc: hurt anything close in front of the player.
    for (const ped of G.peds) {
      if (dist2(p.x, p.y, ped.x, ped.y) < 52 * 52 && Math.abs(((angleTo(p.x, p.y, ped.x, ped.y) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1) {
        ped.hp -= w.damage;
        if (ped.hp <= 0) ped.dead = true;
      }
    }
    for (const cop of G.cops) {
      if (dist2(p.x, p.y, cop.x, cop.y) < 52 * 52) cop.hp -= w.damage;
    }
    G.audio.punch();
    return;
  }
  p.ammo[p.weapon] -= 1;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    G.bullets.push({
      x: muzzle.x, y: muzzle.y,
      angle: p.angle + (G.rng() - 0.5) * w.spread * 2,
      speed: w.speed, damage: w.damage, from: 'player', t: w.range / w.speed,
    });
  }
  G.audio.gunshot(false);
  if (p.weapon === 'rifle') {
    // Recoil kick + camera shake.
    p.vx -= Math.cos(p.angle) * 60;
    p.vy -= Math.sin(p.angle) * 60;
    G.shake = Math.max(G.shake, 7);
  } else {
    G.shake = Math.max(G.shake, 2);
  }
  G.particles.push({ x: muzzle.x, y: muzzle.y, kind: 'muzzle', t: 0.08, max: 0.08 });
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.t -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (circleHitsBuilding(G.world, b.x, b.y, 2)) { b.dead = true; continue; }
    if (b.from === 'player') {
      // Hit peds, cops, police cars, gangsters.
      for (const ped of G.peds) {
        if (dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
          ped.hp -= b.damage; b.dead = true;
          if (ped.hp <= 0) { ped.dead = true; G.stats.kills += 1; }
          break;
        }
      }
      if (!b.dead) {
        for (const cop of G.cops) {
          if (dist2(b.x, b.y, cop.x, cop.y) < 16 * 16) {
            cop.hp -= b.damage; b.dead = true;
            if (cop.hp <= 0) { G.stats.kills += 1; }
            break;
          }
        }
      }
      if (!b.dead) {
        for (const v of G.vehicles) {
          if (v.driver === 'player' || v.driver === 'wreck') continue;
          if (dist2(b.x, b.y, v.x, v.y) < 24 * 24) {
            v.health -= b.damage * 0.6; b.dead = true;
            if (v.driver === 'police') addWanted(G, 1);
            break;
          }
        }
      }
      if (!b.dead) {
        for (const g of G.gangsters || []) {
          if (dist2(b.x, b.y, g.x, g.y) < 16 * 16) {
            g.hp -= b.damage; b.dead = true;
            if (g.hp <= 0) { g.dead = true; G.stats.kills += 1; }
            break;
          }
        }
      }
    } else {
      // Enemy bullets hit the player.
      const p = G.player;
      const d = p.vehicle ? dist2(b.x, b.y, p.vehicle.x, p.vehicle.y) : dist2(b.x, b.y, p.x, p.y);
      const hitR = p.vehicle ? 26 : 15;
      if (d < hitR * hitR) {
        damagePlayer(G, b.damage);
        b.dead = true;
      }
    }
    if (b.t <= 0) b.dead = true;
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
  G.peds = G.peds.filter((p) => !p.dead);
  G.gangsters = (G.gangsters || []).filter((g) => !g.dead);
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.hp <= 0) return;
  let rest = amount;
  if (p.armour > 0) {
    const soaked = Math.min(p.armour, rest * 0.7);
    p.armour -= soaked;
    rest -= soaked;
  }
  p.hp -= rest;
  G.shake = Math.max(G.shake, 4);
  if (p.hp <= 0) G.onWasted();
}

export function spawnPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, t: 0 });
}

export function updatePickups(G, dt) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist2(pk.x, pk.y, px, py) < 34 * 34) {
      pk.taken = true;
      if (pk.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + 40);
      if (pk.kind === 'cash') { p.cash += 50; G.stats.earned += 50; }
      if (pk.kind === 'armour') p.armour = Math.min(100, p.armour + 50);
      if (pk.kind === 'rifle') { p.ammo.rifle = (p.ammo.rifle || 0) + 12; G.hudMsg = 'Picked up a rifle'; G.hudMsgT = 2; }
      if (pk.kind === 'ammo') {
        for (const k of ['pistol', 'smg', 'shotgun']) p.ammo[k] = (p.ammo[k] || 0) + 24;
      }
      G.audio.pickup();
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);
}

export function spawnGangsters(G, x, y, n) {
  G.gangsters = G.gangsters || [];
  for (let i = 0; i < n; i++) {
    G.gangsters.push({
      x: x + (G.rng() - 0.5) * 160,
      y: y + (G.rng() - 0.5) * 160,
      angle: 0, speed: 120, hp: 60, shootT: G.rng(), strafe: G.rng() < 0.5 ? 1 : -1,
    });
  }
}

export function updateGangsters(G, dt) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  for (const g of G.gangsters || []) {
    const d = Math.hypot(g.x - px, g.y - py);
    // Strafing: circle the player while shooting.
    g.strafe += dt * 0.2;
    const orbit = angleTo(px, py, g.x, g.y) + Math.PI / 2 * g.strafe;
    const tx = px + Math.cos(orbit) * 260;
    const ty = py + Math.sin(orbit) * 260;
    const a = angleTo(g.x, g.y, tx, ty);
    g.angle = angleTo(g.x, g.y, px, py);
    const nx = g.x + Math.cos(a) * g.speed * dt;
    const ny = g.y + Math.sin(a) * g.speed * dt;
    if (!circleHitsBuilding(G.world, nx, ny, 10)) { g.x = nx; g.y = ny; }
    const c = clampToWorld(g.x, g.y, 16);
    g.x = c.x; g.y = c.y;
    g.shootT -= dt;
    if (g.shootT <= 0 && d < 480) {
      g.shootT = 1.1 + G.rng() * 0.5;
      G.bullets.push({
        x: g.x, y: g.y, angle: g.angle + (G.rng() - 0.5) * 0.14,
        speed: 760, damage: 8, from: 'gang', t: 1.0,
      });
      G.audio.gunshot(true);
    }
  }
  G.gangsters = (G.gangsters || []).filter((g) => !g.dead);
}
