// Save slots (v2 format): cash, missions, weapons, weather, position,
// minimap zoom and armour. Migrates v1 saves by treating them as slot 1.
import { SAVE_KEY } from './config.js';

export function readSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { version: 2, slots: {} };
    const data = JSON.parse(raw);
    if (data.version !== 2) return { version: 2, slots: { 1: data } };
    return data;
  } catch (e) {
    return { version: 2, slots: {} };
  }
}

export function writeSaveData(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function saveSlot(G, slot) {
  const data = readSaveData();
  const p = G.player;
  data.slots[slot] = {
    cash: p.cash,
    hp: p.hp,
    armour: p.armour,
    weapon: p.weapon,
    ammo: p.ammo,
    missionIdx: G.missionIdx,
    x: p.vehicle ? p.vehicle.x : p.x,
    y: p.vehicle ? p.vehicle.y : p.y,
    weather: G.weather,
    minimapZoom: G.minimapZoom,
    time: G.time,
    earned: G.stats.earned,
    kills: G.stats.kills,
    savedAt: Date.now(),
  };
  writeSaveData(data);
  G.hudMsg = `Saved to slot ${slot}`;
  G.hudMsgT = 2;
}

export function loadSlot(G, slot) {
  const data = readSaveData();
  const s = data.slots[slot];
  if (!s) return false;
  const p = G.player;
  p.cash = s.cash; p.hp = s.hp; p.armour = s.armour;
  p.weapon = s.weapon; p.ammo = s.ammo || p.ammo;
  p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0;
  G.weather = s.weather || 'clear';
  G.minimapZoom = s.minimapZoom || 1;
  G.missionIdx = s.missionIdx == null ? -1 : s.missionIdx;
  G.missionStep = 0;
  G.missionState = G.missionIdx >= 0 ? 'active' : 'done';
  G.stats.earned = s.earned || 0;
  G.stats.kills = s.kills || 0;
  if (G.missionIdx >= 0) {
    // Mission (re)start is wired by main.js through G.startMission.
    if (G.startMission) G.startMission(G.missionIdx);
  }
  G.hudMsg = `Loaded slot ${slot}`;
  G.hudMsgT = 2;
  return true;
}

export function hasSlot(slot) {
  return !!readSaveData().slots[slot];
}
