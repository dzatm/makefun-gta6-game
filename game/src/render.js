// Canvas renderer: city, vehicles, people, effects, day/night and weather.
import { WORLD, PALETTE, WEATHER_KINDS } from './config.js';
import { clamp } from './random.js';
import { missionMarker } from './missions.js';

function drawCar(ctx, x, y, angle, color, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = o.bike ? 34 : 44;
  const wid = o.bike ? 14 : 22;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  if (o.bike) {
    // Rider.
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b04a';
    ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    // Windows + roof.
    ctx.fillStyle = '#bcd6e8';
    ctx.fillRect(-8, -wid / 2 + 3, 16, wid - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(4, -wid / 2 + 3, 10, wid - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
    ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
  }
  if (o.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-len / 2 + 6, -wid / 2 + 2, 8, 5);
    ctx.fillRect(-len / 2 + 6, wid / 2 - 7, 8, 5);
    const flash = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath(); ctx.arc(-2, -wid / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.beginPath(); ctx.arc(-2, wid / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (o.smoke) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(-len / 2, 0, 8 + Math.random() * 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, kind, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color || '#e8b04a';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();
  if (kind === 'zombie') {
    // Phone glow.
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(8, -2, 6, 4);
  }
  ctx.restore();
}

export function draw(G) {
  const ctx = G.ctx;
  const cw = G.canvas.width, ch = G.canvas.height;
  const cam = G.camera;
  const shakeX = (Math.random() - 0.5) * (G.shake || 0);
  const shakeY = (Math.random() - 0.5) * (G.shake || 0);
  G.shake = Math.max(0, (G.shake || 0) - 0.6);

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw / 2 - cam.x + shakeX, ch / 2 - cam.y + shakeY);

  const view = { x1: cam.x - cw / 2 - 60, y1: cam.y - ch / 2 - 60, x2: cam.x + cw / 2 + 60, y2: cam.y + ch / 2 + 60 };
  const inView = (x, y) => x > view.x1 && x < view.x2 && y > view.y1 && y < view.y2;

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x1, view.y1, view.x2 - view.x1, view.y2 - view.y1);

  const z = G.world.zones;
  // Park.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(z.park.x, z.park.y, z.park.w, z.park.h);
  // Beach + water.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, z.beach.y + 200, WORLD.w, WORLD.h - z.beach.y - 200);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(z.beach.x, z.beach.y, z.beach.w, z.beach.h);
  // Harbour concrete + pier.
  ctx.fillStyle = PALETTE.harbour;
  ctx.fillRect(z.harbour.x, z.harbour.y, z.harbour.w, z.harbour.h);
  ctx.fillStyle = PALETTE.pier;
  ctx.fillRect(z.pier.x, z.pier.y, z.pier.w, z.pier.h);
  // Marina water.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(z.marina.x, z.marina.y, z.marina.w, z.marina.h);

  // Roads.
  for (const r of G.world.roads) {
    ctx.fillStyle = PALETTE.road;
    if (r.vertical) ctx.fillRect(r.x1 - r.w / 2, r.y1, r.w, r.y2 - r.y1);
    else ctx.fillRect(r.x1, r.y1 - r.w / 2, r.x2 - r.x1, r.w);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    if (r.vertical) {
      for (let y = r.y1; y < r.y2; y += 56) ctx.fillRect(r.x1 - 2, y, 4, 26);
    } else {
      for (let x = r.x1; x < r.x2; x += 56) ctx.fillRect(x, r.y1 - 2, 26, 4);
    }
  }

  // Props.
  for (const pr of G.world.props) {
    if (!inView(pr.x, pr.y)) continue;
    if (pr.kind === 'palm' || pr.kind === 'tree') {
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 4, pr.y - 26); ctx.stroke();
      ctx.fillStyle = pr.kind === 'palm' ? '#2e7d32' : '#3a8a3f';
      ctx.beginPath(); ctx.arc(pr.x + 4, pr.y - 30, 13, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'crate') {
      ctx.fillStyle = '#a8763e';
      ctx.fillRect(pr.x - 12, pr.y - 12, 24, 24);
      ctx.strokeStyle = '#6b4a22'; ctx.strokeRect(pr.x - 12, pr.y - 12, 24, 24);
    } else if (pr.kind === 'barrel') {
      ctx.fillStyle = '#c94f42';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 10, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'container') {
      ctx.fillStyle = '#4a7ac9';
      ctx.fillRect(pr.x - 26, pr.y - 12, 52, 24);
    } else if (pr.kind === 'lighthouse') {
      ctx.fillStyle = PALETTE.lighthouse;
      ctx.fillRect(pr.x - 12, pr.y - 46, 24, 46);
      ctx.fillStyle = '#c94f42';
      ctx.fillRect(pr.x - 12, pr.y - 46, 24, 10);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - 50, 6, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'boat') {
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath();
      ctx.moveTo(pr.x - 22, pr.y); ctx.lineTo(pr.x + 22, pr.y);
      ctx.lineTo(pr.x + 14, pr.y + 12); ctx.lineTo(pr.x - 14, pr.y + 12);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a4632';
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y - 22); ctx.stroke();
    }
  }

  // Buildings.
  for (const b of G.world.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.kind === 'shop') {
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(b.x + 6, b.y + b.h - 12, b.w - 12, 6);
    }
  }

  // Pickups.
  for (const pk of G.pickups) {
    if (!inView(pk.x, pk.y)) continue;
    const bob = Math.sin(pk.t * 4) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-8, -8, 16, 16); ctx.fillStyle = '#d42a2a'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
    else if (pk.kind === 'cash') { ctx.fillStyle = '#37b24d'; ctx.fillRect(-9, -6, 18, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('$', -3, 4); }
    else if (pk.kind === 'armour') { ctx.fillStyle = '#4a7ac9'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('A', -3, 3); }
    else if (pk.kind === 'rifle') { ctx.fillStyle = '#222'; ctx.fillRect(-12, -2, 24, 4); }
    else { ctx.fillStyle = '#e8c84a'; ctx.fillRect(-7, -7, 14, 14); }
    ctx.restore();
  }

  // Mission marker.
  const marker = missionMarker(G);
  if (marker) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.12;
    ctx.save();
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, marker.r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Vehicles.
  for (const v of G.vehicles) {
    if (!inView(v.x, v.y)) continue;
    drawCar(ctx, v.x, v.y, v.angle + (v.wobble || 0), v.color, {
      bike: !!v.model.bike,
      police: v.driver === 'police',
      smoke: v.health < 35,
    });
    if (v.health < 100 && v.health > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(v.x - 18, v.y - 30, 36, 5);
      ctx.fillStyle = v.health > 50 ? '#37b24d' : '#d42a2a';
      ctx.fillRect(v.x - 18, v.y - 30, 36 * (v.health / 100), 5);
    }
  }

  // Gangsters.
  for (const g of G.gangsters || []) {
    if (!inView(g.x, g.y)) continue;
    drawPerson(ctx, g.x, g.y, g.angle, 'gang', '#5a2a6a');
    ctx.fillStyle = '#222';
    ctx.fillRect(g.x - 10, g.y - 4, 20, 3);
  }

  // Foot cops.
  for (const c of G.cops) {
    if (!inView(c.x, c.y)) continue;
    drawPerson(ctx, c.x, c.y, c.angle, 'cop', '#2a4a8a');
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath(); ctx.arc(c.x, c.y - 2, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Pedestrians.
  for (const ped of G.peds) {
    if (!inView(ped.x, ped.y)) continue;
    const col = ped.kind === 'jogger' ? '#37b24d' : ped.kind === 'zombie' ? '#8a6a9a' : '#e8b04a';
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.kind, col);
  }

  // Player on foot.
  const p = G.player;
  if (p.onFoot && p.hp > 0) {
    drawPerson(ctx, p.x, p.y, p.angle, 'player', '#f2c9a0');
    // Weapon in hand.
    if (p.weapon !== 'fists') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 18, 4);
      ctx.restore();
    }
    // Armour vest hint.
    if (p.armour > 0) {
      ctx.fillStyle = '#4a7ac9';
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Bullets.
  ctx.fillStyle = '#ffe14a';
  for (const b of G.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  // Particles.
  for (const pt of G.particles) {
    const a = pt.t / pt.max;
    if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,80,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 6 * a + 2, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(70,70,70,${a * 0.6})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 18 * (1 - a) + 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Weather overlays.
  const wk = WEATHER_KINDS[G.weather];
  if (G.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,210,255,0.45)';
    ctx.lineWidth = 1;
    const off = (G.time * 900) % 40;
    for (let i = 0; i < 90; i++) {
      const rx = view.x1 + ((i * 137) % (view.x2 - view.x1));
      const ry = view.y1 + ((i * 89 + off) % (view.y2 - view.y1));
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
    }
    // Wet-road sheen.
    ctx.fillStyle = 'rgba(120,160,220,0.08)';
    ctx.fillRect(view.x1, view.y1, view.x2 - view.x1, view.y2 - view.y1);
  }
  if (G.weather === 'fog') {
    ctx.fillStyle = `rgba(200,205,215,${wk.fog * 0.5})`;
    ctx.fillRect(view.x1, view.y1, view.x2 - view.x1, view.y2 - view.y1);
  }

  // Day/night tint.
  const day = G.dayT; // 0 dawn, 0.5 noon, 1 dusk
  const darkness = day < 0.25 ? 0.35 - day : day > 0.75 ? (day - 0.75) * 1.4 : 0;
  if (darkness > 0.02) {
    ctx.fillStyle = `rgba(10,12,40,${clamp(darkness, 0, 0.42)})`;
    ctx.fillRect(view.x1, view.y1, view.x2 - view.x1, view.y2 - view.y1);
    // Headlight cone for the player vehicle.
    const px = p.vehicle ? p.vehicle.x : p.x;
    const py = p.vehicle ? p.vehicle.y : p.y;
    const pa = p.vehicle ? p.vehicle.angle : p.angle;
    const grad = ctx.createRadialGradient(px, py, 20, px, py, 320);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(px + Math.cos(pa) * 120, py + Math.sin(pa) * 120, 300, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}
