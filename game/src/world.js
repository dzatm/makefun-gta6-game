// The city of Solmarina: roads, buildings, zones and collision helpers.
// Everything is generated from the seeded RNG so the map is identical
// on every load.
import { WORLD, PALETTE, SEED } from './config.js';
import { mulberry32, rfloat, rint, pick } from './random.js';

export function buildWorld() {
  const rng = mulberry32(SEED);
  const buildings = [];
  const roads = [];
  const props = [];

  // Avenue grid: vertical avenues every 480px, horizontal streets every 360px.
  const vAvenues = [];
  for (let x = 320; x < WORLD.w - 200; x += 480) vAvenues.push(x);
  const hStreets = [];
  for (let y = 280; y < WORLD.h - 200; y += 360) hStreets.push(y);
  for (const x of vAvenues) roads.push({ x1: x, y1: 0, x2: x, y2: WORLD.h, w: 64, vertical: true });
  for (const y of hStreets) roads.push({ x1: 0, y1: y, x2: WORLD.w, y2: y, w: 56, vertical: false });

  // Beach strip along the south edge, harbour at the south-east.
  const zones = {
    beach: { x: 0, y: WORLD.h - 260, w: 2300, h: 260 },
    harbour: { x: 2400, y: WORLD.h - 420, w: 1440, h: 420 },
    marina: { x: 2900, y: WORLD.h - 620, w: 700, h: 220 },
    park: { x: 480, y: 700, w: 560, h: 420 },
    lighthouse: { x: 3560, y: WORLD.h - 560 },
    pier: { x: 3100, y: WORLD.h - 300, w: 420, h: 40 },
  };

  // City blocks between avenues: fill with buildings, skipping the park.
  const roofColors = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3];
  for (let ai = 0; ai < vAvenues.length - 1; ai++) {
    for (let si = 0; si < hStreets.length - 1; si++) {
      const bx = vAvenues[ai] + 64;
      const by = hStreets[si] + 56;
      const bw = vAvenues[ai + 1] - vAvenues[ai] - 128;
      const bh = hStreets[si + 1] - hStreets[si] - 112;
      if (bw < 80 || bh < 60) continue;
      // Park block stays green.
      if (bx < zones.park.x + zones.park.w && bx + bw > zones.park.x &&
          by < zones.park.y + zones.park.h && by + bh > zones.park.y) continue;
      // Harbour blocks stay open.
      if (by + bh > zones.harbour.y - 40) continue;
      const n = rint(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = rfloat(rng, 70, Math.max(80, bw / n));
        const h = rfloat(rng, 60, Math.max(70, bh));
        const x = bx + (k * bw) / n + rfloat(rng, 4, 18);
        const y = by + rfloat(rng, 6, Math.max(8, bh - h - 4));
        buildings.push({ x, y, w: Math.min(w, bw / n - 8), h, color: pick(rng, roofColors), kind: pick(rng, ['flat', 'flat', 'shop', 'house']) });
      }
    }
  }

  // Palm trees along the beach, lamps and crates at the harbour.
  for (let x = 120; x < zones.beach.w; x += 150) {
    props.push({ x, y: zones.beach.y + 60 + rfloat(rng, 0, 140), kind: 'palm' });
  }
  for (let i = 0; i < 26; i++) {
    props.push({ x: rfloat(rng, zones.harbour.x + 40, zones.harbour.x + zones.harbour.w - 80), y: rfloat(rng, zones.harbour.y + 40, zones.harbour.y + zones.harbour.h - 80), kind: pick(rng, ['crate', 'crate', 'barrel', 'container']) });
  }
  props.push({ x: zones.lighthouse.x, y: zones.lighthouse.y, kind: 'lighthouse' });
  for (let i = 0; i < 6; i++) {
    props.push({ x: zones.pier.x + 40 + i * 64, y: zones.pier.y - 26, kind: 'boat' });
  }
  // Park trees.
  for (let i = 0; i < 18; i++) {
    props.push({ x: rfloat(rng, zones.park.x + 30, zones.park.x + zones.park.w - 30), y: rfloat(rng, zones.park.y + 30, zones.park.y + zones.park.h - 30), kind: 'tree' });
  }

  // Car spawn points: on avenues, facing along the road (north/south).
  const carSpawns = [];
  for (let i = 0; i < 26; i++) {
    const av = pick(rng, vAvenues);
    const st = pick(rng, hStreets);
    carSpawns.push({ x: av + (rng() < 0.5 ? -44 : 44), y: st + rfloat(rng, -140, 140), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
  }
  // A parked bike near the beach cafe.
  carSpawns.push({ x: 900, y: WORLD.h - 320, angle: Math.PI / 2, bike: true });

  return { buildings, roads, zones, props, carSpawns, seed: SEED };
}

export function pointHitsBuilding(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function circleHitsBuilding(world, x, y, r) {
  return pointHitsBuilding(world, x, y, r) !== null;
}

export function onRoad(world, x, y) {
  for (const r of world.roads) {
    if (r.vertical) {
      if (Math.abs(x - r.x1) < r.w / 2 + 8 && y >= r.y1 && y <= r.y2) return true;
    } else if (Math.abs(y - r.y1) < r.w / 2 + 8 && x >= r.x1 && x <= r.x2) return true;
  }
  return false;
}

export function inBeach(world, x, y) {
  const z = world.zones.beach;
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

// Line of sight: sample every 40px; a building blocks the view.
export function hasLineOfSight(world, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointHitsBuilding(world, x1 + dx * t, y1 + dy * t, 2)) return false;
  }
  return true;
}

export function clampToWorld(x, y, margin = 24) {
  return {
    x: Math.max(margin, Math.min(WORLD.w - margin, x)),
    y: Math.max(margin, Math.min(WORLD.h - margin, y)),
  };
}
