// Save & load through localStorage. Progress is written at mission
// checkpoints, when the player quits to the title screen, and every 20 seconds
// of play, so a closed tab never loses much.
//
// Two save slots: slot 0 is the autosave / Continue slot; slot 1 is a manual
// backup the player writes from the pause menu. Saves are versioned so an old
// (v1) save still loads, defaulting the fields it never had.

import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 2;

export const SAVE_SLOTS = [0, 1];

export function saveKey(slot = 0) {
  return slot === 0 ? SAVE_KEY : `${SAVE_KEY}.s${slot}`;
}

export function saveGame(state, slot = 0) {
  try {
    const p = state.player;
    const data = {
      version: SAVE_VERSION,
      slot,
      cash: state.cash,
      missionIndex: state.missions.index,
      missionsDone: state.stats.missions,
      storyDone: state.stats.storyDone,
      kills: state.stats.kills,
      carsStolen: state.stats.carsStolen,
      timeOfDay: state.timeOfDay,
      weather: state.weather ? state.weather.kind : 'clear',
      minimapZoom: state.minimapZoom || 1,
      player: {
        x: p.x, y: p.y, angle: p.angle, health: p.health,
        armour: p.armour || 0,
        weapon: p.weapon, weapons: p.weapons, ammo: p.ammo,
      },
      best: state.best,
    };
    window.localStorage.setItem(saveKey(slot), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 0) {
  try {
    const raw = window.localStorage.getItem(saveKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (data.version !== 1 && data.version !== 2)) return null;
    // Migrate a v1 save: it never stored weather, armour or the minimap zoom.
    if (data.version === 1) {
      data.weather = 'clear';
      data.minimapZoom = 1;
      if (data.player) data.player.armour = 0;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearSave(slot = 0) {
  try {
    window.localStorage.removeItem(saveKey(slot));
  } catch {
    // Storage may be unavailable; a fresh game is the fallback.
  }
}

/** Which slots currently hold a save (for the title screen's Continue line). */
export function listSaves() {
  return SAVE_SLOTS.map((slot) => {
    try {
      return !!window.localStorage.getItem(saveKey(slot));
    } catch {
      return false;
    }
  });
}
