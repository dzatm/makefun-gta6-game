// Seeded random numbers (mulberry32) so the city, the traffic and the staged
// screenshots are the same every run for a given seed, while live play can use
// a fresh seed each session.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

/** Approximately standard-normal sample (Box–Muller), for natural-looking
 * variation instead of flat uniform noise. */
export function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Pick one entry from [[value, weight], ...] by its relative weight. */
export function weighted(rng, pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let roll = rng() * total;
  for (const [value, w] of pairs) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

/** Fisher–Yates shuffle, in place, driven by the seeded rng. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Shortest signed turn from angle `from` toward angle `to`. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
