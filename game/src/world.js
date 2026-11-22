// Solmarina — the city itself. A seeded grid city: roads on fixed centre-lines,
// blocks between them filled with buildings, a park, a beach and sea along the
// south edge, a harbour on the east edge and a marina in the south-west. Every
// building is a solid rectangle the player and cars collide with; shops and
// story places are named landmarks with a door position and a colour.

import { WORLD, ROADS_X, ROADS_Y, PALETTE } from './config.js';
import { makeRng, range, int, pick, clamp } from './random.js';

export const LANDMARKS = {
  hospital: { name: 'Solmarina General', x: 960, y: 320, kind: 'hospital' },
  police: { name: 'Precinct 7', x: 2240, y: 320, kind: 'police' },
  garage: { name: 'Clean Ride Garage', x: 1600, y: 2000, kind: 'garage' },
  gunshop: { name: 'Iron & Lead', x: 2880, y: 880, kind: 'gunshop' },
  safehouse: { name: "Dana's Flat", x: 320, y: 1440, kind: 'safehouse' },
  docks: { name: 'Dockside', x: 3520, y: 1440, kind: 'docks' },
  marina: { name: 'Marina del Sol', x: 320, y: 2440, kind: 'marina' },
  food1: { name: 'Taco Luna', x: 960, y: 2000, kind: 'food' },
  food2: { name: 'Burger Bay', x: 2240, y: 880, kind: 'food' },
  park: { name: 'Palma Park', x: 1600, y: 880, kind: 'park' },
  // Smuggler's Harbour on the south-east beach: a pier, a boat and a
  // lighthouse at the edge of the sea. Home of the new seventh mission.
  harbour: { name: "Smuggler's Harbour", x: 3680, y: 2580, kind: 'harbour' },
  lighthouse: { name: 'Punta Oro Light', x: 3760, y: 2620, kind: 'lighthouse' },
};

/** Build the city from a seed. Returns { buildings, trees, props, zones }. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const props = [];
  const rw = WORLD.roadWidth;
  const sw = WORLD.sidewalk;

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.beachY];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + (bi === 0 ? 0 : rw / 2 + sw);
      const x1 = xs[bi + 1] - (bi + 1 >= xs.length - 1 ? 0 : rw / 2 + sw);
      const y0 = ys[bj] + (bj === 0 ? 0 : rw / 2 + sw);
      const y1 = ys[bj + 1] - (bj + 1 >= ys.length - 1 ? 0 : rw / 2 + sw);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // The park block and the marina block stay open.
      if (Math.abs(cx - 1600) < 200 && Math.abs(cy - 880) < 200) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: range(rng, x0 + 30, x1 - 30), y: range(rng, y0 + 30, y1 - 30), r: range(rng, 12, 20) });
        }
        props.push({ kind: 'pond', x: cx, y: cy, w: 150, h: 90 });
        continue;
      }
      if (Math.abs(cx - 320) < 200 && Math.abs(cy - 2440) < 200) {
        props.push({ kind: 'boats', x: cx, y: cy + 40, w: 260, h: 120 });
        continue;
      }
      // Harbour block: containers instead of buildings.
      if (cx > 3200 && Math.abs(cy - 1440) < 200) {
        for (let c = 0; c < 8; c += 1) {
          props.push({
            kind: 'container',
            x: x0 + 40 + (c % 4) * 130,
            y: y0 + 50 + Math.floor(c / 4) * 90,
            w: 110, h: 60,
            color: pick(rng, ['#b5543f', '#4a6b8a', '#3f7a5e', '#c96f2e']),
          });
        }
        continue;
      }
      // 1-4 buildings per block, placed on a rough grid inside the block.
      const cols = int(rng, 1, 2);
      const rows = int(rng, 1, 2);
      const bw = (x1 - x0) / cols;
      const bh = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rng() < 0.18) continue; // empty lot: a car park or yard
          const w = range(rng, bw * 0.45, bw * 0.72);
          const h = range(rng, bh * 0.45, bh * 0.72);
          const x = x0 + c * bw + (bw - w) / 2 + range(rng, -8, 8);
          const y = y0 + r * bh + (bh - h) / 2 + range(rng, -8, 8);
          const downtown = Math.abs(cx - 1600) < 700 && Math.abs(cy - 1440) < 700;
          buildings.push({
            x, y, w, h,
            height: downtown ? int(rng, 3, 7) : int(rng, 1, 3),
            roof: pick(rng, PALETTE.buildingRoof),
            downtown,
          });
        }
      }
      // A few trees along the block edges.
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 10, 16) });
      }
    }
  }
  // Palm trees along the beach.
  for (let x = 80; x < WORLD.width; x += 130) {
    trees.push({ x: x + range(rng, -20, 20), y: WORLD.beachY + 40 + range(rng, 0, 60), r: 14, palm: true });
  }
  // Smuggler's Harbour: a pier jutting into the sea, a moored boat, and the
  // lighthouse at the south-east corner. The pier and boat are scenery; the
  // lighthouse is a solid obstacle cars and people walk around.
  props.push({ kind: 'pier', x: 3540, y: 2540, w: 260, h: 64 });
  props.push({ kind: 'boat', x: 3660, y: 2660, w: 120, h: 46 });
  props.push({ kind: 'lighthouse', x: 3760, y: 2620, r: 26 });
  return { buildings, trees, props, seed };
}

/** True when the point is on a road (including the intersection squares). */
export function onRoad(x, y) {
  const rw = WORLD.roadWidth / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) < rw) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < rw) return true;
  return false;
}

/** Nearest road centre-line point to (x, y), used to snap traffic onto lanes. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 0, WORLD.height), axis: 'v' }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 0, WORLD.width), y: ry, axis: 'h' }; }
  }
  return best;
}

/** Push a circle (x, y, r) out of every building it overlaps. Returns true if it hit anything. */
export function collideBuildings(city, pos, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(pos.x, b.x, b.x + b.w);
    const cy = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
      } else {
        pos.y = b.y - r;
      }
    }
  }
  // Containers are solid too.
  for (const p of city.props) {
    if (p.kind !== 'container') continue;
    const cx = clamp(pos.x, p.x, p.x + p.w);
    const cy = clamp(pos.y, p.y, p.y + p.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      hit = true;
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.y = cy + (dy / d) * r;
    }
  }
  // The lighthouse tower is round and solid.
  for (const p of city.props) {
    if (p.kind !== 'lighthouse') continue;
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = p.r + r;
    if (d < min && d > 0.01) {
      hit = true;
      pos.x = p.x + (dx / d) * min;
      pos.y = p.y + (dy / d) * min;
    }
  }
  pos.x = clamp(pos.x, 16, WORLD.width - 16);
  pos.y = clamp(pos.y, 16, WORLD.height - 16);
  return hit;
}

/** True when the point is inside a building or container. */
export function insideSolid(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  for (const p of city.props) {
    if (p.kind === 'container' && x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return true;
  }
  // The lighthouse is a round, solid tower.
  for (const p of city.props) {
    if (p.kind === 'lighthouse' && dist(x, y, p.x, p.y) < p.r) return true;
  }
  return false;
}

/** Line of sight between two points: false when a building, container or the
 * lighthouse stands between them. Police use it to decide whether the player
 * is actually visible before the wanted level decays. */
export function hasLineOfSight(city, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (insideSolid(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

/** Distance helper kept local so this module needs no extra imports. */
function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** A random point on a road, for spawning cars and pedestrians. */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, ROADS_X);
    return { x: rx + range(rng, -40, 40), y: range(rng, 100, WORLD.beachY - 100) };
  }
  const ry = pick(rng, ROADS_Y);
  return { x: range(rng, 100, WORLD.width - 100), y: ry + range(rng, -40, 40) };
}

/** A random sidewalk point (just off a road), for pedestrians. */
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const rw = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
  if (Math.abs(p.x - ROADS_X.reduce((a, b) => (Math.abs(p.x - a) < Math.abs(p.x - b) ? a : b))) < 10) {
    p.x += rng() < 0.5 ? -rw : rw;
  } else {
    p.y += rng() < 0.5 ? -rw : rw;
  }
  return { x: clamp(p.x, 20, WORLD.width - 20), y: clamp(p.y, 20, WORLD.beachY - 20) };
}
