// HUD, minimap and menus: everything drawn on top of the world. The HUD shows
// health, cash, wanted stars, weapon and ammo, the current objective and a live
// minimap. Menus are the title screen, pause, game over and mission select.

import { PALETTE, VIEW, WEAPONS, WORLD, ZOOM, MINIMAP } from './config.js';
import { LANDMARKS } from './world.js';
import { MISSIONS, currentMission, currentStep } from './missions.js';

const MM_W = 196;
const MM_H = 148;

export function drawHUD(ctx, state) {
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health + cash panel.
  panel(ctx, 16, 14, 250, 64);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('DANA REYES', 30, 36);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(30, 44, 180, 12);
  ctx.fillStyle = p.health > 50 ? PALETTE.green : p.health > 25 ? PALETTE.gold : PALETTE.red;
  ctx.fillRect(30, 44, 180 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 216, 55);
  // Armour bar, shown only while the vest holds.
  if (p.armour > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(30, 58, 180, 6);
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(30, 58, 180 * Math.max(0, p.armour / 100), 6);
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${state.cash}`, 30, 72 - 2 + 0);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(p.inCar ? `${p.inCar.name}  •  ${Math.round(Math.abs(p.inCar.speed) * 0.12)} mph` : 'On foot', 120, 70);

  // Top-right: wanted stars.
  panel(ctx, VIEW.width - 216, 14, 200, 46);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('WANTED', VIEW.width - 202, 34);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? PALETTE.gold : 'rgba(255,255,255,0.18)';
    drawStar(ctx, VIEW.width - 140 + i * 26, 30, i < state.wanted);
  }

  // Top-centre: mission objective.
  const mm = state.missions;
  const step = currentStep(mm);
  if (mm.active && step) {
    const m = currentMission(mm);
    const text = `${m.title} — ${step.text}`;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = Math.min(620, ctx.measureText(text).width + 28);
    panel(ctx, (VIEW.width - w) / 2, 14, w, 34);
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 36);
    ctx.textAlign = 'left';
  } else if (mm.index === -1) {
    const text = 'Story complete — free roam. Press M for missions.';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 28;
    panel(ctx, (VIEW.width - w) / 2, 14, w, 34);
    ctx.fillStyle = PALETTE.green;
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 36);
    ctx.textAlign = 'left';
  }

  // Mission message banner.
  if (mm.messageT > 0 && mm.message) {
    ctx.font = '15px system-ui, sans-serif';
    const w = Math.min(760, ctx.measureText(mm.message).width + 32);
    panel(ctx, (VIEW.width - w) / 2, 58, w, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(mm.message, VIEW.width / 2, 78);
    ctx.textAlign = 'left';
  }

  // Bottom-right: weapon + ammo, controls hint.
  const w = WEAPONS[p.weapon];
  panel(ctx, VIEW.width - 216, VIEW.height - 66, 200, 52);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(w.name, VIEW.width - 202, VIEW.height - 44);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  const ammoText = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon] || 0} rounds`;
  ctx.fillText(ammoText, VIEW.width - 202, VIEW.height - 26);
  // Bottom hint, right of the minimap.
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive • E enter car • Space punch • Click shoot • Esc pause • P photo • N map zoom', 228, VIEW.height - 14);

  // Minimap (bottom-left).
  drawMinimap(ctx, state);

  // Interaction prompt.
  if (state.prompt) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w2 = ctx.measureText(state.prompt).width + 28;
    panel(ctx, (VIEW.width - w2) / 2, VIEW.height - 116, w2, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, VIEW.width / 2, VIEW.height - 93);
    ctx.textAlign = 'left';
  }

  // Clock + weather. The weather line warns when the roads are slick (rain)
  // or sight is short (fog) — both change how the game plays.
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(clockText(state.timeOfDay), VIEW.width - 16, 84);
  const weatherLabel = state.weather ? (state.weather.kind || 'clear') : 'clear';
  ctx.fillStyle = weatherLabel === 'clear' ? PALETTE.muted : weatherLabel === 'rain' ? '#7fb3e8' : '#c9cdd2';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(weatherLabel.toUpperCase(), VIEW.width - 16, 102);
  ctx.textAlign = 'left';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
}

function drawStar(ctx, x, y, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = lit ? PALETTE.gold : 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 11 : 5;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clockText(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const day = h >= 6 && h < 18 ? 'DAY' : 'NIGHT';
  return `${hh}:${mm}  ${day}`;
}

function drawMinimap(ctx, state) {
  const x0 = 16;
  const y0 = VIEW.height - MM_H - 16;
  // Zoom toggle (N): level 1 shows the whole city; level 2 zooms to the
  // streets around the player.
  const zoom = state.minimapZoom || 1;
  const viewW = WORLD.width / zoom;
  const viewH = WORLD.height / zoom;
  const p = state.player;
  const wx0 = zoom === 1 ? 0 : Math.max(0, Math.min(WORLD.width - viewW, p.x - viewW / 2));
  const wy0 = zoom === 1 ? 0 : Math.max(0, Math.min(WORLD.height - viewH, p.y - viewH / 2));
  const sx = MM_W / viewW;
  const sy = MM_H / viewH;
  const mx = (wx) => x0 + (wx - wx0) * sx;
  const my = (wy) => y0 + (wy - wy0) * sy;
  ctx.fillStyle = 'rgba(12,16,22,0.82)';
  ctx.beginPath();
  ctx.roundRect(x0 - 4, y0 - 4, MM_W + 8, MM_H + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MM_W, MM_H);
  ctx.clip();
  // Ground.
  ctx.fillStyle = '#5d8a4c';
  ctx.fillRect(x0, y0, MM_W, MM_H);
  // Sea.
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(x0, my(WORLD.seaY), MM_W, MM_H);
  // Roads.
  ctx.fillStyle = '#3a3d44';
  for (const rx of [320, 960, 1600, 2240, 2880, 3520]) ctx.fillRect(mx(rx) - 2, y0, 4, MM_H);
  for (const ry of [320, 880, 1440, 2000, 2440]) ctx.fillRect(x0, my(ry) - 2, MM_W, 4);
  // Landmarks.
  ctx.fillStyle = '#f5c518';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (lm.x < wx0 || lm.x > wx0 + viewW || lm.y < wy0 || lm.y > wy0 + viewH) continue;
    ctx.fillRect(mx(lm.x) - 2, my(lm.y) - 2, 4, 4);
  }
  // Mission marker.
  const step = currentStep(state.missions);
  if (state.missions.active && step && step.x !== undefined) {
    const pulse = 3 + Math.sin(state.now * 5) * 1.5;
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(mx(step.x), my(step.y), pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#3b82ff';
  for (const car of state.cars) {
    if (car.driver === 'police' && !car.dead) {
      ctx.beginPath();
      ctx.arc(mx(car.x), my(car.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx(p.x), my(p.y));
  ctx.rotate(p.inCar ? p.inCar.angle : p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport rectangle (through the camera zoom).
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx(state.camera.x - 640 / ZOOM), my(state.camera.y - 360 / ZOOM), (1280 / ZOOM) * sx, (720 / ZOOM) * sy);
  ctx.restore();
  // Zoom label so the player knows which level they are on.
  ctx.fillStyle = 'rgba(244,246,248,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(zoom === 1 ? 'MAP ×1 — N to zoom' : 'MAP ×2 — N to zoom out', x0 + MM_W, y0 - 6);
  ctx.textAlign = 'left';
}

/** Tiny hint shown while the HUD is hidden (photo mode), so the player can
 * find their way back to the interface. */
export function drawPhotoHint(ctx, state) {
  ctx.fillStyle = 'rgba(244,246,248,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Photo mode — P to restore the HUD', VIEW.width - 16, VIEW.height - 12);
  ctx.textAlign = 'left';
}

// ---- Menus ----

export function drawTitle(ctx, state) {
  const t = state.now;
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Sun-soaked gradient sky and skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, '#ff9e5e');
  grad.addColorStop(0.55, '#e85d75');
  grad.addColorStop(1, '#2b2d5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, 480);
  ctx.fillStyle = '#1c2340';
  const rngBuildings = [90, 150, 70, 190, 120, 210, 80, 160, 100, 140, 200, 90];
  let bx = 0;
  for (const h of rngBuildings) {
    ctx.fillRect(bx, 480 - h, 96, h);
    bx += 108;
  }
  ctx.fillStyle = '#f5c518';
  ctx.beginPath();
  ctx.arc(1020, 130, 46 + Math.sin(t) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMARINA', VIEW.width / 2, 210);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 34px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText('S T R E E T S   O F   G O L D', VIEW.width / 2, 258);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in a sun-soaked coastal city. Drive it, steal it, survive it.', VIEW.width / 2, 300);
  drawMenuItems(ctx, state.menu.items, state.menu.selected, 350);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move / drive  •  E enter & exit cars  •  Space punch  •  Mouse aim, click shoot  •  M mute  •  Esc pause  •  P photo  •  N map zoom', VIEW.width / 2, 640);
  ctx.fillText('A fully original game. No real city, person or game is copied.', VIEW.width / 2, 664);
  if (state.saveExists) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#58b368';
    ctx.fillText('A saved game was found — Continue picks up where you left off.', VIEW.width / 2, 596);
  }
}

export function drawPause(ctx, state) {
  dim(ctx);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 44px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW.width / 2, 180);
  drawMenuItems(ctx, state.menu.items, state.menu.selected, 250);
  ctx.textAlign = 'center';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#9aa5b1';
  const weatherLabel = state.weather ? state.weather.kind : 'clear';
  ctx.fillText(`Weather: ${weatherLabel.toUpperCase()} — pick "Weather" below to change it, or press R in play. Progress saves automatically at mission checkpoints.`, VIEW.width / 2, 620);
}

export function drawOver(ctx, state, kind) {
  dim(ctx);
  const title = kind === 'wasted' ? 'WASTED' : 'BUSTED';
  ctx.fillStyle = kind === 'wasted' ? '#e5534b' : '#4a90d9';
  ctx.font = 'bold 72px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.width / 2, 260);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(kind === 'wasted' ? 'Solmarina keeps your cash — half of it, anyway.' : 'Precinct 7 holds you overnight. The city waits.', VIEW.width / 2, 310);
  drawMenuItems(ctx, state.menu.items, state.menu.selected, 380);
}

export function drawMissionSelect(ctx, state) {
  dim(ctx);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 40px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSIONS', VIEW.width / 2, 130);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#9aa5b1';
  ctx.fillText('Dana Reyes — courier, driver, and now the person the Marlins and the Kings both want.', VIEW.width / 2, 164);
  const items = MISSIONS.map((m, i) => {
    const done = i < state.missions.index || state.missions.index === -1;
    const locked = i > 0 && state.missions.index !== -1 && i > state.missions.index && state.stats.missions < i;
    const label = `${done ? '✓ ' : locked ? '🔒 ' : '○ '}${i + 1}. ${m.title} — ${m.giver}`;
    return { label, action: locked ? null : `mission:${i}` };
  });
  items.push({ label: '← Back', action: 'back' });
  drawMenuItems(ctx, items, state.menu.selected, 210);
  state.menu.items = items;
}

export function drawControls(ctx, state) {
  dim(ctx);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 40px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', VIEW.width / 2, 130);
  const lines = [
    'WASD / Arrow keys — walk, or drive when you are in a car',
    'Shift — sprint on foot',
    'E — enter or exit the nearest car (stealing one draws the police)',
    'Space — punch  •  Mouse — aim  •  Click — shoot your weapon',
    '1 / 2 / 3 / 4 / 5 — switch weapon (fists, pistol, SMG, shotgun, rifle)',
    'Esc — pause  •  M — mute sound  •  Tab — hide the HUD',
    'P — photo mode (hides the HUD for a clean shot)',
    'N — minimap zoom  •  R — change the weather (clear, rain, fog)',
    '',
    'Earn cash from missions and pickups. Spend it at Clean Ride Garage',
    '(repair & repaint), Iron & Lead (weapons & ammo) and food stands (health).',
    'Wanted stars bring the police: hide, outrun them, or pay the garage to cool off.',
    'Rain makes the roads slick and fog cuts police sight — use the weather.',
    'Motorcycles are the fastest way across town, but crashes hurt the rider.',
    'Your progress saves automatically — Continue on the title screen resumes it.',
    'There are two save slots: the pause menu can save a copy to slot 2.',
  ];
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#e8ecf0';
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 182 + i * 26));
  drawMenuItems(ctx, [{ label: '← Back', action: 'back' }], 0, 640);
  state.menu.items = [{ label: '← Back', action: 'back' }];
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawMenuItems(ctx, items, selected, y0) {
  ctx.textAlign = 'center';
  items.forEach((item, i) => {
    const y = y0 + i * 46;
    const isSel = i === selected;
    if (isSel) {
      ctx.fillStyle = 'rgba(245,197,24,0.16)';
      const w = ctx.measureText(item.label).width + 44;
      ctx.beginPath();
      ctx.roundRect(VIEW.width / 2 - w / 2, y - 28, w, 40, 8);
      ctx.fill();
    }
    ctx.fillStyle = isSel ? '#f5c518' : '#e8ecf0';
    ctx.font = `${isSel ? 'bold ' : ''}21px system-ui, sans-serif`;
    ctx.fillText(item.label, VIEW.width / 2, y);
  });
  ctx.textAlign = 'left';
}
