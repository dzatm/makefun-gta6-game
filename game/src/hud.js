// HUD: health/armour/cash/wanted/weapon/objective banner, weather label,
// pause menu and the live minimap (N toggles zoom).
import { WORLD, WEAPONS, WEATHER_KINDS } from './config.js';
import { MISSIONS, currentStep } from './missions.js';
import { clamp } from './random.js';

export function drawHUD(G) {
  const ctx = G.ctx;
  const cw = G.canvas.width, ch = G.canvas.height;
  if (G.hideHud || G.photo) return;
  const p = G.player;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';

  // Health + armour bars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 14, 220, 46);
  ctx.fillStyle = '#37b24d';
  ctx.fillRect(20, 20, 140 * clamp(p.hp / p.maxHp, 0, 1), 12);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 140, 12);
  ctx.fillStyle = '#4a7ac9';
  ctx.fillRect(20, 36, 140 * clamp(p.armour / 100, 0, 1), 8);
  ctx.strokeRect(20, 36, 140, 8);
  ctx.fillStyle = '#fff';
  ctx.fillText(`$${p.cash}`, 168, 31);
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 168, 48);

  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd43b' : 'rgba(255,255,255,0.25)';
    const sx = cw - 150 + i * 28;
    drawStar(ctx, sx, 32, 11);
  }

  // Weapon + ammo.
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(cw - 220, ch - 60, 206, 46);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${w.name} — Slot ${w.slot}`, cw - 210, ch - 40);
  ctx.font = '13px sans-serif';
  const ammo = p.weapon === 'fists' ? '∞' : `${p.ammo[p.weapon] || 0}`;
  ctx.fillText(`Ammo ${ammo}   (1-5 to switch)`, cw - 210, ch - 22);

  // Weather label, colour-coded.
  const wk = WEATHER_KINDS[G.weather];
  const wcol = G.weather === 'rain' ? '#7ab8ff' : G.weather === 'fog' ? '#c9c9c9' : '#ffd43b';
  ctx.fillStyle = wcol;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Weather: ${wk.label}  (R)`, 16, ch - 24);

  // Objective banner.
  const step = currentStep(G);
  if (G.missionIdx >= 0 && step) {
    const m = MISSIONS[G.missionIdx];
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = `Mission ${G.missionIdx + 1}/7 — ${m.name}: ${step.text}`;
    ctx.fillRect(14, 66, Math.min(cw - 28, ctx.measureText(label).width + 24), 28);
    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(label, 24, 85);
    if (m.timed) {
      ctx.fillStyle = G.missionTimer < 15 ? '#ff5a5a' : '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`⏱ ${Math.ceil(G.missionTimer)}s`, cw / 2 - 30, 90);
    }
  }

  // Toast message.
  if (G.hudMsg && G.hudMsgT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(cw / 2 - 260, ch - 110, 520, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.hudMsg, cw / 2, ch - 90);
    ctx.textAlign = 'left';
  }

  // Minimap.
  drawMinimap(G);

  // Pause menu.
  if (G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cw / 2, ch / 2 - 110);
    ctx.font = '16px sans-serif';
    const lines = [
      `Weather: ${wk.label}  (R to change)`,
      `Minimap zoom: ${G.minimapZoom === 1 ? 'whole city' : 'streets'}  (N)`,
      `Save slot 1: ${G.slot1 ? 'saved' : 'empty'}   Save slot 2: ${G.slot2 ? 'saved' : 'empty'}`,
      'Press 1 to save slot 1, 2 to save slot 2 (in pause)',
      'Esc resume   •   M mute   •   P photo mode',
      G.missionState === 'failed' ? 'Mission failed — press Space to retry it' : '',
    ];
    lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 - 70 + i * 26));
    ctx.textAlign = 'left';
  }

  // Title / wasted overlays are drawn by main.js.
  ctx.restore();
}

function drawStar(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMinimap(G) {
  const ctx = G.ctx;
  const size = 190;
  const x0 = G.canvas.width - size - 16;
  const y0 = 84;
  const zoom = G.minimapZoom;
  const scale = (size / WORLD.w) * (zoom === 1 ? 1 : 2.4);
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  let cx = WORLD.w / 2, cy = WORLD.h / 2;
  if (zoom !== 1) { cx = px; cy = py; }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  const ox = x0 + size / 2 - cx * scale;
  const oy = y0 + size / 2 - cy * scale;

  ctx.fillStyle = '#2e5a33';
  ctx.fillRect(x0, y0, size, size);
  const z = G.world.zones;
  ctx.fillStyle = '#e0c184';
  ctx.fillRect(ox + z.beach.x * scale, oy + z.beach.y * scale, z.beach.w * scale, z.beach.h * scale);
  ctx.fillStyle = '#1f6f8b';
  ctx.fillRect(ox + z.harbour.x * scale, oy + z.harbour.y * scale, z.harbour.w * scale, z.harbour.h * scale);
  ctx.fillStyle = '#3a3a40';
  for (const r of G.world.roads) {
    if (r.vertical) ctx.fillRect(ox + (r.x1 - r.w / 2) * scale, oy + r.y1 * scale, r.w * scale, (r.y2 - r.y1) * scale);
    else ctx.fillRect(ox + r.x1 * scale, oy + (r.y1 - r.w / 2) * scale, (r.x2 - r.x1) * scale, r.w * scale);
  }
  ctx.fillStyle = '#6b4a5a';
  for (const b of G.world.buildings) {
    ctx.fillRect(ox + b.x * scale, oy + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // Mission marker.
  const marker = currentStep(G);
  if (marker && marker.x) {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath(); ctx.arc(ox + marker.x * scale, oy + marker.y * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#5a8cff';
  for (const v of G.vehicles) {
    if (v.driver !== 'police') continue;
    ctx.beginPath(); ctx.arc(ox + v.x * scale, oy + v.y * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(ox + px * scale, oy + py * scale);
  ctx.rotate(p.vehicle ? p.vehicle.angle : p.angle);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(zoom === 1 ? 'MAP — N to zoom' : 'MAP — streets — N to zoom out', x0, y0 + size + 16);
}
