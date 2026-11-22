// Rendering: everything the player sees of Solmarina, drawn on one canvas in
// top-down view. Ground, roads and markings, buildings with a fake 3D edge,
// trees, the sea and beach, cars, people, bullets and particles, then the
// day/night light. Only what the camera can see is drawn.

import { WORLD, ROADS_X, ROADS_Y, PALETTE, CAR } from './config.js';
import { clamp } from './random.js';
import { LANDMARKS } from './world.js';

function inView(cam, x, y, margin = 120) {
  return x > cam.x - 640 - margin && x < cam.x + 640 + margin && y > cam.y - 360 - margin && y < cam.y + 360 + margin;
}

export function drawWorld(ctx, state) {
  const cam = state.camera;
  const city = state.city;
  const time = state.timeOfDay; // 0..24 hours
  const night = nightFactor(time);

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x - 640, cam.y - 360, 1280, 720);
  // Mow stripes for the grass.
  ctx.fillStyle = PALETTE.grassDark;
  const stripeY0 = Math.floor((cam.y - 360) / 90) * 90;
  for (let y = stripeY0; y < cam.y + 360; y += 180) {
    ctx.fillRect(cam.x - 640, y, 1280, 90);
  }

  // Beach and sea (south strip).
  if (cam.y + 360 > WORLD.beachY) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cam.x - 640, WORLD.beachY, 1280, WORLD.seaY - WORLD.beachY);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(cam.x - 640, WORLD.seaY, 1280, WORLD.height - WORLD.seaY);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = Math.floor((cam.x - 640) / 90) * 90; x < cam.x + 640; x += 90) {
      ctx.fillRect(x, WORLD.seaY + 8 + Math.sin(state.now * 0.8 + x * 0.05) * 4, 46, 3);
    }
  }

  // Park.
  const park = LANDMARKS.park;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(park.x - 260, park.y - 200, 520, 400);

  // Sidewalks (light border around each road).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) ctx.fillRect(rx - WORLD.roadWidth / 2 - WORLD.sidewalk, cam.y - 360, WORLD.roadWidth + WORLD.sidewalk * 2, 720);
  for (const ry of ROADS_Y) ctx.fillRect(cam.x - 640, ry - WORLD.roadWidth / 2 - WORLD.sidewalk, 1280, WORLD.roadWidth + WORLD.sidewalk * 2);

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - WORLD.roadWidth / 2, cam.y - 360, WORLD.roadWidth, 720);
  for (const ry of ROADS_Y) ctx.fillRect(cam.x - 640, ry - WORLD.roadWidth / 2, 1280, WORLD.roadWidth);

  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of ROADS_X) {
    if (Math.abs(rx - cam.x) > 700) continue;
    for (let y = Math.floor((cam.y - 360) / 56) * 56; y < cam.y + 360; y += 56) {
      ctx.fillRect(rx - 3, y, 6, 28);
    }
  }
  for (const ry of ROADS_Y) {
    if (Math.abs(ry - cam.y) > 420) continue;
    for (let x = Math.floor((cam.x - 640) / 56) * 56; x < cam.x + 640; x += 56) {
      ctx.fillRect(x, ry - 3, 28, 6);
    }
  }

  // Props: pond, boats, containers, harbour pier, boat and lighthouse.
  for (const p of city.props) {
    if (!inView(cam, p.x, p.y, 200)) continue;
    if (p.kind === 'pond') {
      ctx.fillStyle = '#3f8fb5';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'boats') {
      for (let i = 0; i < 3; i += 1) {
        const bx = p.x - 80 + i * 80;
        const by = p.y + (i % 2) * 40;
        ctx.fillStyle = '#e8e4da';
        ctx.beginPath();
        ctx.ellipse(bx, by, 34, 14, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d6455b';
        ctx.fillRect(bx - 3, by - 26, 6, 26);
      }
    } else if (p.kind === 'pier') {
      // Wooden pier planks jutting toward the sea.
      ctx.fillStyle = '#8a6a3f';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let lx = p.x + 14; lx < p.x + p.w; lx += 18) {
        ctx.beginPath();
        ctx.moveTo(lx, p.y);
        ctx.lineTo(lx, p.y + p.h);
        ctx.stroke();
      }
      ctx.fillStyle = '#5e4630';
      for (let lx = p.x + 8; lx < p.x + p.w; lx += 60) {
        ctx.fillRect(lx, p.y - 4, 8, 10);
        ctx.fillRect(lx, p.y + p.h - 6, 8, 10);
      }
      ctx.lineWidth = 1;
    } else if (p.kind === 'boat') {
      // A moored smuggler's boat: hull, cabin and mast.
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2f57';
      ctx.fillRect(p.x - 24, p.y - 14, 48, 22);
      ctx.fillStyle = '#d6455b';
      ctx.fillRect(p.x - 3, p.y - 44, 6, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.h / 2 + 6, p.w / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'lighthouse') {
      // Striped tower with a lamp that glows at night.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x + 5, p.y + 7, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f6f8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, Math.PI * 0.15, Math.PI * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (night > 0.3) {
        ctx.fillStyle = `rgba(255,240,180,${0.12 * night})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 320, p.y - 60);
        ctx.lineTo(p.x + 320, p.y + 60);
        ctx.closePath();
        ctx.fill();
      }
    } else if (p.kind === 'container') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.beginPath();
      for (let lx = p.x + 12; lx < p.x + p.w; lx += 14) {
        ctx.moveTo(lx, p.y + 4);
        ctx.lineTo(lx, p.y + p.h - 4);
      }
      ctx.stroke();
    }
  }

  // Buildings: shadow, wall edge (fake height), roof, roof details.
  for (const b of city.buildings) {
    if (!inView(cam, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    const h = b.height * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = '#8f887a';
    ctx.fillRect(b.x, b.y - h, b.w, b.h + h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y - h, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y - h + 1, b.w - 2, b.h - 2);
    // Roof furniture: vents and a pool on tall towers.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 8, b.y - h + 8, 14, 10);
    ctx.fillRect(b.x + b.w - 26, b.y - h + 8, 14, 10);
    if (b.downtown && b.height >= 5) {
      ctx.fillStyle = '#3f8fb5';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y - h + b.h / 2, b.w * 0.22, b.h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1;
  }

  // Landmark labels and door markers.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (key === 'park') continue;
    if (!inView(cam, lm.x, lm.y, 60)) continue;
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    const w = ctx.measureText(lm.name).width + 16;
    ctx.fillRect(lm.x - w / 2, lm.y - 46, w, 22);
    ctx.fillStyle = '#f5c518';
    ctx.fillText(lm.name, lm.x, lm.y - 30);
  }

  // Trees.
  for (const t of city.trees) {
    if (!inView(cam, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + 6, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.palm ? '#5d9b4a' : '#3f7a3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups.
  for (const pk of state.pickups) {
    if (!inView(cam, pk.x, pk.y, 30)) continue;
    const bob = Math.sin(state.now * 4 + pk.x) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d00';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('$', pk.x, pk.y + bob + 5);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#4a90d9';
      ctx.fillRect(pk.x - 9, pk.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#f4f6f8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('AMMO', pk.x, pk.y + 4 + bob);
    } else if (pk.kind === 'armour') {
      // A blue vest: a rounded plate with a chest strap.
      ctx.fillStyle = '#2e5fa3';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(pk.x - 7, pk.y - 2 + bob, 14, 4);
      ctx.fillRect(pk.x - 2, pk.y - 7 + bob, 4, 14);
    } else {
      ctx.fillStyle = '#22242c';
      ctx.fillRect(pk.x - 14, pk.y - 5 + bob, 28, 10);
      ctx.fillStyle = '#f5c518';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(pk.kind.toUpperCase(), pk.x, pk.y + 4 + bob);
    }
  }

  // Cars.
  for (const car of state.cars) {
    if (car.dead) continue;
    if (!inView(cam, car.x, car.y, 90)) continue;
    drawCar(ctx, car, state, car === state.player.inCar);
  }

  // People.
  for (const p of state.peds) {
    if (p.dead) continue;
    if (!inView(cam, p.x, p.y, 40)) continue;
    drawPerson(ctx, p, state);
  }
  for (const c of state.cops) {
    if (c.dead) continue;
    if (!inView(cam, c.x, c.y, 40)) continue;
    drawPerson(ctx, c, state, true);
  }
  for (const g of state.enemies) {
    if (g.dead) continue;
    if (!inView(cam, g.x, g.y, 40)) continue;
    drawPerson(ctx, g, state, false, true);
  }

  // Player.
  const pl = state.player;
  if (!pl.inCar) drawPerson(ctx, { x: pl.x, y: pl.y, angle: pl.angle, shirt: PALETTE.playerShirt, skin: '#e0ac69', kind: 'player' }, state);

  // Bullets.
  ctx.fillStyle = '#ffe08a';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEffects(ctx, state);

  // Mission waypoint marker (pulsing diamond + beam).
  const step = state.missionStep;
  if (step && (step.type === 'goto' || step.type === 'chase' || step.type === 'collect' || step.type === 'escape' || step.type === 'timed')) {
    const tx = step.type === 'escape' ? LANDMARKS.safehouse.x : step.x;
    const ty = step.type === 'escape' ? LANDMARKS.safehouse.y : step.y;
    const pulse = 1 + Math.sin(state.now * 5) * 0.15;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(-14 * pulse, -14 * pulse, 28 * pulse, 28 * pulse);
    ctx.restore();
    ctx.strokeStyle = 'rgba(245,197,24,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 34 + Math.sin(state.now * 5) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Night overlay: blue tint + headlight cones.
  if (night > 0.02) {
    ctx.fillStyle = `rgba(8, 16, 44, ${night * 0.42})`;
    ctx.fillRect(cam.x - 640, cam.y - 360, 1280, 720);
    // Headlights for the player's car.
    if (pl.inCar) {
      const car = pl.inCar;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      const grad = ctx.createRadialGradient(40, 0, 10, 40, 0, 260);
      grad.addColorStop(0, 'rgba(255,240,180,0.35)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(30, -14);
      ctx.lineTo(270, -70);
      ctx.lineTo(270, 70);
      ctx.lineTo(30, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawWeather(ctx, state);
}

/** Weather overlay: rain streaks and wet-road sheen, or a fog bank that
 * closes in around the camera. Called last so it veils the whole scene. */
export function drawWeather(ctx, state) {
  const w = state.weather;
  if (!w || w.kind === 'clear') return;
  const cam = state.camera;
  const x0 = cam.x - 640;
  const y0 = cam.y - 360;
  if (w.kind === 'rain') {
    // Slanted streaks, seeded by position so they do not flicker randomly.
    ctx.strokeStyle = 'rgba(180,200,220,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 90; i += 1) {
      const sx = x0 + ((i * 173 + Math.floor(state.now * 900)) % 1280);
      const sy = y0 + ((i * 97 + Math.floor(state.now * 1400)) % 720);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 8, sy + 26);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    // Wet roads reflect: a faint sheen over the road strips.
    ctx.fillStyle = 'rgba(200,220,240,0.06)';
    for (const rx of ROADS_X) ctx.fillRect(rx - WORLD.roadWidth / 2, y0, WORLD.roadWidth, 720);
    for (const ry of ROADS_Y) ctx.fillRect(x0, ry - WORLD.roadWidth / 2, 1280, WORLD.roadWidth);
  } else if (w.kind === 'fog') {
    // A radial fog bank centred on the camera: clear nearby, white at the edges.
    const grad = ctx.createRadialGradient(cam.x, cam.y, 180, cam.x, cam.y, 720);
    grad.addColorStop(0, 'rgba(210,215,220,0)');
    grad.addColorStop(0.6, 'rgba(210,215,220,0.35)');
    grad.addColorStop(1, 'rgba(210,215,220,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, 1280, 720);
  }
}

function drawCar(ctx, car, state, isPlayer = false) {
  const m = CAR.models[car.model];
  // Motorcycles draw as a slim bike with a rider, not a car body.
  if (m.bike) {
    drawBike(ctx, car, state, isPlayer);
    return;
  }
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // A soft gold ring marks the player's car.
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(245,197,24,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.w / 2 + 12, m.h / 2 + 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-m.w / 2 + 4, -m.h / 2 + 6, m.w, m.h);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.w / 2, -m.h / 2, m.w, m.h, 10);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  roundRect(ctx, -m.w / 2 + 7, -m.h / 2 + 20, m.w - 14, 26, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,230,0.5)';
  ctx.fillRect(-m.w / 2 + 9, -m.h / 2 + 22, m.w - 18, 8);
  // Headlights and taillights.
  ctx.fillStyle = '#fff7c0';
  ctx.fillRect(m.w / 2 - 4, -m.h / 2 + 6, 4, 10);
  ctx.fillRect(m.w / 2 - 4, m.h / 2 - 16, 4, 10);
  ctx.fillStyle = '#e5534b';
  ctx.fillRect(-m.w / 2, -m.h / 2 + 6, 4, 10);
  ctx.fillRect(-m.w / 2, m.h / 2 - 16, 4, 10);
  // Police livery.
  if (car.driver === 'police') {
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-m.w / 2 + 4, -8, m.w - 8, 16);
    ctx.fillStyle = '#1c2f57';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    // Flashing light bar.
    const on = Math.floor(state.now * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-8, -m.h / 2 - 4, 16, 8);
  }
  if (car.driver === 'gang') {
    ctx.fillStyle = '#8e44ad';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KINGS', 0, m.h / 2 - 22);
  }
  if (car.missionTarget) {
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 3;
    ctx.strokeRect(-m.w / 2 - 5, -m.h / 2 - 5, m.w + 10, m.h + 10);
    ctx.lineWidth = 1;
  }
  // Damage smoke.
  if (car.health < 40) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(-m.w / 4 + Math.sin(state.now * 9) * 4, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBike(ctx, bike, state, isPlayer = false) {
  const m = CAR.models[bike.model];
  ctx.save();
  ctx.translate(bike.x, bike.y);
  // Lean into the turn: the bike tilts with its steering.
  ctx.rotate(bike.angle);
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(245,197,24,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.w / 2 + 12, m.h / 2 + 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-m.w / 2 + 3, -m.h / 2 + 5, m.w, m.h);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -m.h / 2 + 6, 9, 0, Math.PI * 2);
  ctx.arc(0, m.h / 2 - 6, 9, 0, Math.PI * 2);
  ctx.fill();
  // Frame + tank in the bike's colour.
  ctx.fillStyle = bike.color;
  roundRect(ctx, -m.w / 2, -m.h / 2 + 14, m.w, m.h - 28, 6);
  ctx.fill();
  // Headlight.
  ctx.fillStyle = '#fff7c0';
  ctx.fillRect(-4, -m.h / 2, 8, 5);
  // Rider: torso and helmet, leaning with the bike.
  ctx.fillStyle = isPlayer ? '#2e86c1' : '#3a3d44';
  ctx.beginPath();
  ctx.arc(0, 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242c';
  ctx.beginPath();
  ctx.arc(0, -6, 6.5, Math.PI, 0);
  ctx.fill();
  // Damage smoke.
  if (bike.health < 40) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(Math.sin(state.now * 9) * 4, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, p, state, isCop = false, isGang = false) {
  const walking = p.kind === 'ped' || p.kind === 'player';
  const bob = walking ? Math.sin(state.now * 10 + (p.x + p.y) * 0.05) * 1.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.rotate(p.angle + Math.PI / 2);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = p.skin || '#e0ac69';
  ctx.beginPath();
  ctx.arc(0, -2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Facing: gun or fists.
  ctx.fillStyle = '#22242c';
  if (isGang || p.weapon) ctx.fillRect(8, -3, 10, 4);
  // Cop hat / gang bandana.
  if (isCop) {
    ctx.fillStyle = '#0f1c33';
    ctx.beginPath();
    ctx.arc(0, -2, 7.5, Math.PI, 0);
    ctx.fill();
  } else if (isGang) {
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(-7, -8, 14, 4);
  }
  // Boss crown.
  if (p.boss) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RICO', 0, -22);
  }
  // Health bar for gangsters.
  if (isGang && p.hp !== undefined) {
    ctx.rotate(-(p.angle + Math.PI / 2));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-14, -24, 28, 5);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-14, -24, 28 * Math.max(0, p.hp / (p.boss ? 200 : 50)), 5);
  }
  ctx.restore();
}

function drawEffects(ctx, state) {
  for (const e of state.effects) {
    const age = e.t / e.life;
    if (e.kind === 'explosion') {
      const r = 20 + age * 70;
      ctx.fillStyle = `rgba(255, ${Math.floor(160 - age * 120)}, 40, ${1 - age})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(60,60,60,${(1 - age) * 0.7})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y - r * 0.4, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'poof' || e.kind === 'spark') {
      ctx.fillStyle = e.kind === 'poof' ? `rgba(200,200,200,${1 - age})` : `rgba(255,220,120,${1 - age})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4 + age * 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'flash') {
      ctx.fillStyle = `rgba(255,240,150,${1 - age})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 * (1 - age) + 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'hit') {
      ctx.fillStyle = `rgba(229,83,75,${1 - age})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3 + age * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Skid marks, fading with age.
  for (const s of state.skids) {
    ctx.strokeStyle = `rgba(20,20,20,${0.35 * (1 - s.t / s.life)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  // Floating texts.
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    const age = f.t / f.life;
    ctx.fillStyle = f.color;
    ctx.globalAlpha = 1 - age;
    ctx.fillText(f.text, f.x, f.y - age * 40);
    ctx.globalAlpha = 1;
  }
}

/** 0 at noon, 1 at deep night. */
export function nightFactor(hour) {
  if (hour >= 7 && hour <= 18) return 0;
  if (hour >= 19 && hour <= 23) return (hour - 18) / 5;
  if (hour >= 0 && hour < 5) return 1;
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2;
  return 0.6;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
