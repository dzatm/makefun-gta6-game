// Solmarina: Streets of Gold — entry point, game loop and wiring.
// Fixed-step simulation (60Hz) with consume-on-read input, so a key
// press fires exactly once even on frames that run several steps.
import { WORLD, SEED, WEAPONS, WEAPON_ORDER, WEATHER_ORDER, WEATHER_KINDS, CAR_MODELS } from './config.js';
import { mulberry32, clamp } from './random.js';
import { buildWorld } from './world.js';
import { spawnParkedCars, spawnTraffic, updateVehicles, nearestVehicle, enterVehicle, exitVehicle, decayWanted } from './vehicles.js';
import { spawnPeds, spawnFootCops, updatePeds } from './people.js';
import { fireWeapon, updateBullets, updatePickups, updateGangsters, spawnPickup, damagePlayer } from './combat.js';
import { MISSIONS, startMission, updateMission, retryMission } from './missions.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { saveSlot, loadSlot, hasSlot } from './save.js';
import { draw } from './render.js';
import { drawHUD } from './hud.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

function newGame(G) {
  G.rng = mulberry32(SEED);
  G.world = buildWorld();
  G.time = 0;
  G.dayT = 0.42;
  G.weather = 'clear';
  G.weatherTimer = 45;
  G.vehicles = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.pickups = [];
  G.gangsters = [];
  G.particles = [];
  G.wanted = 0;
  G.wantedTimer = 0;
  G.copSpawnT = 0;
  G.missionIdx = 0;
  G.missionStep = 0;
  G.missionTimer = 0;
  G.missionState = 'active';
  G.camera = { x: 1200, y: 1200 };
  G.shake = 0;
  G.photo = false;
  G.paused = false;
  G.hideHud = false;
  G.title = true;
  G.minimapZoom = 1;
  G.hudMsg = '';
  G.hudMsgT = 0;
  G.stats = { kills: 0, earned: 0 };
  G.slot1 = hasSlot(1);
  G.slot2 = hasSlot(2);
  G.player = {
    x: 1200, y: 1200, angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: 100, maxHp: 100, armour: 0, cash: 100,
    weapon: 'fists', ammo: { pistol: 24, smg: 0, shotgun: 0, rifle: 0 },
    vehicle: null, onFoot: true, lastShot: -9,
  };
  G.startMission = startMission;
  spawnParkedCars(G);
  spawnTraffic(G, 14);
  spawnPeds(G, 26);
  // Starter pickups near the player.
  spawnPickup(G, 1240, 1140, 'health');
  spawnPickup(G, 1150, 1260, 'cash');
  spawnPickup(G, 1330, 1230, 'armour');
  startMission(G, 0);
  G.title = true;
}

function updatePlayer(G, dt) {
  const p = G.player;
  if (p.hp <= 0) return;
  if (p.vehicle) {
    p.x = p.vehicle.x; p.y = p.vehicle.y;
    p.angle = p.vehicle.angle;
    return;
  }
  const speed = G.input.isDown('sprint') ? 260 : 165;
  let mx = 0, my = 0;
  if (G.input.up) my -= 1;
  if (G.input.downKey) my += 1;
  if (G.input.left) mx -= 1;
  if (G.input.right) mx += 1;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    p.vx = mx * speed; p.vy = my * speed;
  } else {
    p.vx *= 0.8; p.vy *= 0.8;
    if (Math.abs(p.vx) < 2) p.vx = 0;
    if (Math.abs(p.vy) < 2) p.vy = 0;
  }
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  // Inline collision: reuse the world building list directly.
  let blocked = false;
  for (const b of G.world.buildings) {
    if (nx > b.x - 10 && nx < b.x + b.w + 10 && ny > b.y - 10 && ny < b.y + b.h + 10) { blocked = true; break; }
  }
  if (!blocked) { p.x = nx; p.y = ny; }
  p.x = clamp(p.x, 24, WORLD.w - 24);
  p.y = clamp(p.y, 24, WORLD.h - 24);

  // Aim with the mouse.
  const m = G.input.mouse;
  const sx = p.x - G.camera.x + G.canvas.width / 2;
  const sy = p.y - G.camera.y + G.canvas.height / 2;
  if (Math.hypot(m.x - sx, m.y - sy) > 24) {
    p.angle = Math.atan2(m.y - sy, m.x - sx);
  }
  // Fire.
  if (G.input.mouse.down || G.input.mouse.clicked) {
    fireWeapon(G);
    G.input.mouse.clicked = false;
  }
}

function handleActions(G) {
  const p = G.player;
  const inp = G.input;

  if (inp.wasPressed('pause')) {
    G.paused = !G.paused;
    return;
  }
  if (G.paused) {
    if (inp.wasPressed('weather')) cycleWeather(G);
    if (inp.wasPressed('minimap')) { G.minimapZoom = G.minimapZoom === 1 ? 2 : 1; }
    if (inp.wasPressed('weapon1')) { saveSlot(G, 1); G.slot1 = true; }
    if (inp.wasPressed('weapon2')) { saveSlot(G, 2); G.slot2 = true; }
    if (G.missionState === 'failed' && inp.wasPressed('punch')) retryMission(G);
    return;
  }
  if (inp.wasPressed('mute')) {
    G.audio.setMuted(!G.audio.muted);
    G.hudMsg = G.audio.muted ? 'Muted' : 'Sound on';
    G.hudMsgT = 1.5;
  }
  if (inp.wasPressed('hideHud')) G.hideHud = !G.hideHud;
  if (inp.wasPressed('photo')) {
    G.photo = !G.photo;
    G.hudMsg = G.photo ? 'Photo mode — P to exit' : '';
    G.hudMsgT = 1.5;
  }
  if (inp.wasPressed('minimap')) G.minimapZoom = G.minimapZoom === 1 ? 2 : 1;
  if (inp.wasPressed('weather')) cycleWeather(G);

  // Weapon switching.
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    if (inp.wasPressed(`weapon${i + 1}`)) {
      const w = WEAPON_ORDER[i];
      if (w === 'fists' || (p.ammo[w] || 0) > 0 || p.weapon === w) {
        p.weapon = w;
      } else {
        G.hudMsg = `No ${WEAPONS[w].name} yet — buy it at a gun shop (H)`;
        G.hudMsgT = 2.5;
      }
    }
  }

  // Enter / exit vehicle.
  if (inp.wasPressed('enter') && p.hp > 0) {
    if (p.vehicle) {
      exitVehicle(G, false);
    } else {
      const v = nearestVehicle(G, p.x, p.y, 70);
      if (v) enterVehicle(G, v);
    }
  }

  // Punch on foot (Space) — also the brake while driving.
  if (inp.wasPressed('punch') && p.onFoot && p.hp > 0) {
    if (p.weapon === 'fists') fireWeapon(G);
  }

  // Shop actions near a shop building (G repair, H ammo, F eat).
  const nearShop = G.world.buildings.some((b) => b.kind === 'shop' && Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2)) < 130);
  if (nearShop) {
    if (inp.wasPressed('shopRepair') && p.vehicle && p.cash >= 120) {
      p.cash -= 120; p.vehicle.health = 100;
      G.hudMsg = 'Car repaired'; G.hudMsgT = 2;
    }
    if (inp.wasPressed('shopAmmo') && p.cash >= 60) {
      p.cash -= 60;
      p.ammo.pistol = (p.ammo.pistol || 0) + 24;
      p.ammo.smg = (p.ammo.smg || 0) + 30;
      G.hudMsg = 'Ammo bought'; G.hudMsgT = 2;
    }
    if (inp.wasPressed('shopEat') && p.cash >= 25) {
      p.cash -= 25; p.hp = Math.min(p.maxHp, p.hp + 30);
      G.hudMsg = 'Ate something. +30 HP'; G.hudMsgT = 2;
    }
  }
  // Horn while driving.
  if (inp.wasPressed('horn') && p.vehicle) G.audio.horn();
}

function cycleWeather(G) {
  const i = WEATHER_ORDER.indexOf(G.weather);
  G.weather = WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length];
  G.hudMsg = `Weather: ${WEATHER_KINDS[G.weather].label}`;
  G.hudMsgT = 2;
  G.audio.rain(G.weather === 'rain');
}

function step(G, dt) {
  G.time += dt;
  G.dayT = (G.dayT + dt / 240) % 1;
  // Weather drifts on its own.
  G.weatherTimer -= dt;
  if (G.weatherTimer <= 0) {
    cycleWeather(G);
    G.weatherTimer = 50 + G.rng() * 40;
  }
  if (G.hudMsgT > 0) G.hudMsgT -= dt;

  G.input.poll();
  handleActions(G);
  if (G.paused) return;

  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updateGangsters(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMission(G, dt);
  decayWanted(G, dt);

  // Foot cops arrive as the wanted level climbs, on a cooldown so
  // they do not respawn on top of the player forever.
  const wantCops = G.wanted >= 3 ? 2 : G.wanted >= 1 ? 1 : 0;
  G.copSpawnT -= dt;
  if (G.cops.length < wantCops && G.copSpawnT <= 0) {
    spawnFootCops(G, 1, G.player);
    G.copSpawnT = 8;
  }

  // Particles age.
  for (const pt of G.particles) pt.t -= dt;
  G.particles = G.particles.filter((pt) => pt.t > 0);

  // Camera follows the player.
  const p = G.player;
  const tx = p.vehicle ? p.vehicle.x : p.x;
  const ty = p.vehicle ? p.vehicle.y : p.y;
  G.camera.x += (tx - G.camera.x) * Math.min(1, 6 * dt);
  G.camera.y += (ty - G.camera.y) * Math.min(1, 6 * dt);

  // Audio follows the drive.
  const v = p.vehicle;
  G.audio.engine(v ? Math.abs(v.speed) / v.model.top : 0, !!(v && v.model.bike));
  if (G.wanted > 0) G.audio.siren(G.wanted);
  else G.audio.stopSiren();

  // Wasted check.
  if (p.hp <= 0) G.onWasted();
}

function drawTitle(G) {
  const ctx = G.ctx;
  const cw = G.canvas.width, ch = G.canvas.height;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, cw, ch);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('SOLMARINA', cw / 2, ch / 2 - 90);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Streets of Gold', cw / 2, ch / 2 - 52);
  ctx.font = '16px sans-serif';
  ctx.fillText('An open-world crime game — seven missions, then free roam.', cw / 2, ch / 2 - 16);
  ctx.fillText('WASD move / drive  •  E enter car  •  Mouse aim + click to shoot', cw / 2, ch / 2 + 16);
  ctx.fillText('Click to start. Missions, wanted stars, weather, photo mode and saves included.', cw / 2, ch / 2 + 44);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffe14a';
  ctx.fillText('CLICK TO PLAY', cw / 2, ch / 2 + 90);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawWasted(G) {
  const ctx = G.ctx;
  const cw = G.canvas.width, ch = G.canvas.height;
  ctx.save();
  ctx.fillStyle = 'rgba(120,0,0,0.55)';
  ctx.fillRect(0, 0, cw, ch);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('WASTED', cw / 2, ch / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillText('You lost $100 and woke up at the hospital. Click to respawn.', cw / 2, ch / 2 + 20);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function initGame(canvas) {
  const G = {
    canvas,
    ctx: canvas.getContext('2d'),
    audio: new AudioEngine(),
    input: new Input(),
    rng: mulberry32(SEED),
  };
  G.input.attach(canvas);
  G.onWasted = () => {
    const p = G.player;
    if (p.hp > 0) return;
    if (G.wasted) return;
    G.wasted = true;
    G.wanted = 0;
    G.vehicles = G.vehicles.filter((v) => v.driver !== 'police');
    p.cash = Math.max(0, p.cash - 100);
  };
  newGame(G);

  // Click to start / respawn.
  canvas.addEventListener('click', () => {
    G.audio.ensure();
    if (G.title) { G.title = false; G.hudMsg = 'Mission 1: First Delivery — pick up the package at the park kiosk'; G.hudMsgT = 5; }
    if (G.wasted) {
      G.wasted = false;
      const p = G.player;
      p.hp = p.maxHp; p.armour = 0;
      p.x = 1200; p.y = 1200; p.vx = 0; p.vy = 0;
      if (p.vehicle) { p.vehicle.driver = 'parked'; p.vehicle = null; p.onFoot = true; }
      G.camera.x = p.x; G.camera.y = p.y;
      G.hudMsg = 'Back on your feet. Stay out of trouble.';
      G.hudMsgT = 3;
    }
  });

  // Screenshot staging (?shot=0..3).
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot !== null) {
    const i = parseInt(shot, 10);
    if (!Number.isNaN(i) && i >= 0 && i <= 3) {
      G.title = false;
      stageShot(G, i);
    }
  }
  // Weather override for testing (?weather=rain|fog|clear).
  const wq = params.get('weather');
  if (wq && WEATHER_KINDS[wq]) G.weather = wq;

  let acc = 0, last = performance.now();
  let frames = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let stepped = false;
    let n = 0;
    while (acc >= STEP && n < 5) {
      if (!G.title && !G.wasted) step(G, STEP);
      acc -= STEP;
      stepped = true;
      n += 1;
    }
    if (acc > STEP * 5) acc = 0;
    // Input presses are consumed inside step(); endFrame only drops
    // stale ones, and only on frames that actually stepped.
    G.input.endFrame(stepped);
    draw(G);
    if (!G.hideHud && !G.photo && !G.title && !G.wasted) drawHUD(G);
    if (G.title) drawTitle(G);
    if (G.wasted) drawWasted(G);
    frames += 1;
  }
  requestAnimationFrame(frame);

  window.__game = G;
  window.__shotReady = window.__shotReady || false;
  return G;
}
