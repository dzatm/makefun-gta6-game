// Solmarina: Streets of Gold — the game itself. One Game object owns the whole
// state (city, player, cars, people, missions, wanted level, time of day) and
// steps it at a fixed 60 Hz. Menus, HUD and rendering live in their own files;
// this file wires them together and owns the player's controls.

import { VIEW, STEP, WORLD, PLAYER, CAR, TRAFFIC, PEDS, POLICE, ECONOMY, TIME, WEAPONS, SAVE_KEY, BEST_KEY, ZOOM, WEATHER } from './config.js';
import { makeRng, clamp, dist, angleDelta, pick, weighted } from './random.js';
import { buildCity, LANDMARKS, collideBuildings, randomRoadPoint, randomSidewalkPoint, onRoad, hasLineOfSight } from './world.js';
import { makeCar, spawnTrafficCar, spawnParkedCar, spawnParkedBike, isBike, stepCar, stepTraffic, stepPolice, stepGangCar, collideCars } from './vehicles.js';
import { makePed, makeJogger, makeCop, stepPed, stepCop, stepGangster, panicNear } from './people.js';
import { stepBullets, stepPickups, fireWeapon, damagePlayer, addWanted, explodeCar, spawnPickup, dropCash, killEnemy } from './combat.js';
import { createMissionManager, startMission, updateMissions, failMission, currentMission, currentStep } from './missions.js';
import { SoundEngine } from './audio.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawOver, drawMissionSelect, drawControls, drawPhotoHint } from './hud.js';
import { createInput, axis, wasPressed, wasPressedAction, getBinding, endFrame } from './input.js';
import { saveGame, loadGame, clearSave, listSaves } from './save.js';
import { stageShot } from './shots.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = createInput(canvas);
    this.audio = new SoundEngine();
    this.rng = makeRng((Math.random() * 1e9) | 0);
    this.now = 0;
    this.acc = 0;
    this.last = 0;
    this.shotMode = null;
    this.resetWorld(1337);
    this.screen = 'title';
    this.saveExists = listSaves()[0];
    this.best = 0;
    try { this.best = Number(window.localStorage.getItem(BEST_KEY) || 0); } catch { /* no storage */ }
    this.menu = { items: this.titleItems(), selected: 0 };
    this.hudHidden = false;
    // Photo mode (P) hides the HUD for a clean shot; the minimap zoom (N)
    // toggles between the whole city and the streets around the player.
    this.photoMode = false;
    this.minimapZoom = 1;
    // Weather: clear, rain or fog. Rain makes roads slick, fog cuts sight.
    this.weather = { kind: 'clear', t: 0, nextChange: 100 };
    this.saveTimer = 0;
    this.autoStartTimer = 0;
    this.pendingMission = false;
    this.policeTimer = 0;
    this.copTimer = 0;
    this.shake = 0;
    this.prompt = '';
    this.shopAction = null;
    this.mouseWorld = { x: 0, y: 0 };
    this.pausedFrom = null;
    window.addEventListener('keydown', (e) => {
      if (e.code === getBinding('mute')) this.audio.setMuted(!this.audio.muted);
    });
  }

  titleItems() {
    const items = [];
    const saves = listSaves();
    if (saves[0]) items.push({ label: 'Continue', action: 'continue' });
    if (saves[1]) items.push({ label: 'Continue — Slot 2', action: 'continue2' });
    items.push({ label: 'New Game', action: 'new' });
    items.push({ label: 'Missions', action: 'missions' });
    items.push({ label: 'How to Play', action: 'controls' });
    return items;
  }

  resetWorld(seed) {
    this.city = buildCity(seed);
    this.cityBounds = { width: WORLD.width, height: WORLD.height };
    this.player = {
      x: 1600, y: 1300, angle: 0, health: PLAYER.health, armour: 0, invuln: 0,
      weapon: 'fists', weapons: { fists: true }, ammo: {},
      inCar: null, shootTimer: 0, punchTimer: 0, speed: 0, recoilKick: 0,
    };
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.effects = [];
    this.floaters = [];
    this.skids = [];
    this.cash = ECONOMY.startCash;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.timeOfDay = TIME.startHour;
    this.camera = { x: 1600, y: 1300 };
    this.missions = createMissionManager();
    this.stats = { kills: 0, missions: 0, carsStolen: 0, storyDone: false };
    this.missionStep = null;
    // Seed the streets: traffic, parked cars, parked motorcycles, pedestrians,
    // a few joggers on the beach path, and a few pickups.
    for (let i = 0; i < TRAFFIC.count; i += 1) this.cars.push(spawnTrafficCar(this.rng, this.city, this.player));
    for (let i = 0; i < 6; i += 1) this.cars.push(spawnParkedCar(this.rng, this.city, this.player));
    for (let i = 0; i < 2; i += 1) this.cars.push(spawnParkedBike(this.rng, this.city, this.player));
    for (let i = 0; i < PEDS.count; i += 1) {
      const p = randomSidewalkPoint(this.rng);
      this.peds.push(makePed(this.rng, p.x, p.y));
    }
    for (let i = 0; i < 4; i += 1) {
      this.peds.push(makeJogger(this.rng, 300 + this.rng() * 3200, 2560 + this.rng() * 80));
    }
    spawnPickup(this, 'health', 960, 760);
    spawnPickup(this, 'pistol', 2880, 820, 0);
    spawnPickup(this, 'ammo', 2240, 1380);
    spawnPickup(this, 'cash', 1600, 500, 60);
    spawnPickup(this, 'cash', 320, 2000, 80);
    // A rifle stashed at the docks and a vest by the hospital, for players
    // who go looking before the gun shop.
    spawnPickup(this, 'rifle', 3520, 1560, 0);
    spawnPickup(this, 'armour', 960, 420, 0);
  }

  applySave(data) {
    this.cash = data.cash;
    this.stats.missions = data.missionsDone || 0;
    this.stats.storyDone = !!data.storyDone;
    this.stats.kills = data.kills || 0;
    this.stats.carsStolen = data.carsStolen || 0;
    this.timeOfDay = data.timeOfDay ?? TIME.startHour;
    this.weather = { kind: data.weather || 'clear', t: 0, nextChange: 100 };
    this.minimapZoom = data.minimapZoom || 1;
    const p = data.player || {};
    this.player.x = p.x ?? 1600;
    this.player.y = p.y ?? 1300;
    this.player.angle = p.angle || 0;
    this.player.health = p.health ?? 100;
    this.player.armour = p.armour || 0;
    this.player.weapon = p.weapon || 'fists';
    this.player.weapons = p.weapons || { fists: true };
    this.player.ammo = p.ammo || {};
    this.missions.index = data.missionIndex ?? 0;
    this.missions.started = this.missions.index >= 0;
    if (this.missions.index >= 0) this.pendingMission = true;
    this.autoStartTimer = 1;
  }

  newGame() {
    this.resetWorld(1337 + Math.floor(Math.random() * 1000));
    this.screen = 'play';
    this.audio.ensure();
    this.audio.setRain(this.weather.kind === 'rain');
    startMission(this, 0);
  }

  continueGame(slot = 0) {
    const data = loadGame(slot);
    this.resetWorld(1337);
    if (data) this.applySave(data);
    this.screen = 'play';
    this.audio.ensure();
    this.audio.setRain(this.weather.kind === 'rain');
  }

  // ---- main loop ----
  start() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const weatherParam = params.get('weather');
    if (weatherParam && WEATHER.kinds.includes(weatherParam)) {
      this.weather.kind = weatherParam;
      this.weather.nextChange = 3600; // staged shots keep their weather
    }
    if (shot) {
      this.shotMode = shot;
      stageShot(shot, this);
      this.render();
      document.title = `Solmarina shot: ${shot}`;
      window.__shotReady = true;
      return;
    }
    this.last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.step(STEP, null);
        this.acc -= STEP;
        steps += 1;
      }
      if (steps === 5) this.acc = 0;
      this.render();
      // Only clear edge-triggered input after a frame that actually ran a
      // simulation step. A frame can arrive early (dt < STEP) and run zero
      // steps; clearing here would silently swallow a key pressed just
      // before that frame, before any step ever saw it.
      if (steps > 0) endFrame(this.input);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- one fixed step ----
  step(dt, pilot) {
    this.now += dt;
    const input = this.input;
    if (this.screen === 'title' || this.screen === 'missions' || this.screen === 'controls') {
      this.updateMenu(dt);
      return;
    }
    if (this.screen === 'pause') {
      this.updateMenu(dt);
      return;
    }
    if (this.screen === 'wasted' || this.screen === 'busted') {
      // The damage handler sets the screen but not the menu; make sure the
      // game-over menu is the one on screen.
      if (!this.menu.items.length || this.menu.items[0].action !== 'respawn') {
        this.menu = { items: this.overItems(), selected: 0 };
      }
      this.updateMenu(dt);
      return;
    }
    if (this.screen !== 'play') return;

    // Pause (rebindable key, see input.js).
    if (wasPressedAction(input, 'pause')) {
      this.screen = 'pause';
      this.menu = { items: this.pauseItems(), selected: 0 };
      saveGame(this);
      return;
    }
    // HUD, photo mode, minimap zoom and weather (all rebindable).
    if (wasPressedAction(input, 'hud')) this.hudHidden = !this.hudHidden;
    if (wasPressedAction(input, 'photo')) {
      this.photoMode = !this.photoMode;
      this.hudHidden = this.photoMode;
    }
    if (wasPressedAction(input, 'minimap')) {
      this.minimapZoom = this.minimapZoom === 1 ? 2 : 1;
    }
    if (wasPressedAction(input, 'weather')) this.cycleWeather();

    // Time of day.
    this.timeOfDay = (this.timeOfDay + dt * (24 / TIME.dayLength)) % 24;
    this.updateWeather(dt);
    this.missionStep = currentStep(this.missions);

    // Auto-start the next mission after a breather.
    if (this.pendingMission) {
      this.autoStartTimer -= dt;
      if (this.autoStartTimer <= 0) {
        this.pendingMission = false;
        if (this.missions.index >= 0) startMission(this, this.missions.index);
      }
    }

    this.updatePlayer(dt, pilot);
    this.updateCars(dt);
    this.updatePeople(dt);
    stepBullets(this, dt);
    stepPickups(this, dt);
    updateMissions(this, dt);
    this.updateWanted(dt);
    this.updateShops(dt);
    this.updateCamera(dt);

    // Effects and floaters age.
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.life);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < f.life);
    for (const s of this.skids) s.t += dt;
    this.skids = this.skids.filter((s) => s.t < s.life);
    if (this.skids.length > 220) this.skids.splice(0, this.skids.length - 220);

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      saveGame(this);
    }
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    // Engine sound follows the car (a bike revs higher than a car).
    const car = this.player.inCar;
    this.audio.setEngine(car ? Math.abs(car.speed) / 760 : 0, !!car, car ? isBike(car) : false);

    // Mission complete chains into the next one.
    if (!this.missions.active && this.missions.started && this.missions.index >= 0 && this.stats.missions > 0 && !this.pendingMission) {
      this.pendingMission = true;
      this.autoStartTimer = 4;
      this.missions.started = false; // only auto-chain once per completion
    }
  }

  /** Weather clock: the sky rolls over on its own every 90–150 seconds,
   * weighted toward clear skies. */
  updateWeather(dt) {
    const w = this.weather;
    w.t += dt;
    if (w.t >= w.nextChange) {
      this.setWeather(weighted(this.rng, WEATHER.weights));
    }
  }

  /** Switch the weather now (pause menu, R key, or a staged screenshot). */
  setWeather(kind) {
    const prev = this.weather.kind;
    this.weather = {
      kind,
      t: 0,
      nextChange: WEATHER.autoChange[0] + this.rng() * (WEATHER.autoChange[1] - WEATHER.autoChange[0]),
    };
    this.audio.setRain(kind === 'rain');
    if (kind !== prev) {
      this.floaters.push({
        x: this.player.x, y: this.player.y - 50,
        text: kind === 'rain' ? 'Rain — roads are slick' : kind === 'fog' ? 'Fog rolling in — sight is short' : 'Skies clear',
        t: 0, life: 2, color: '#9aa5b1',
      });
    }
  }

  cycleWeather() {
    const kinds = WEATHER.kinds;
    this.setWeather(kinds[(kinds.indexOf(this.weather.kind) + 1) % kinds.length]);
  }

  /** Current road grip from the weather (1 = dry). */
  weatherGrip() {
    return WEATHER.grip[this.weather.kind] ?? 1;
  }

  pauseItems() {
    return [
      { label: 'Resume', action: 'resume' },
      { label: `Weather: ${this.weather.kind}`, action: 'weather' },
      { label: 'Save to Slot 2', action: 'save2' },
      { label: 'Missions', action: 'missions' },
      { label: 'How to Play', action: 'controls' },
      { label: 'Save & Quit to Title', action: 'quit' },
    ];
  }

  overItems() {
    return [
      { label: 'Get back out there', action: 'respawn' },
      { label: 'Quit to Title', action: 'quit' },
    ];
  }

  updateMenu(dt) {
    const input = this.input;
    const items = this.menu.items;
    if (wasPressed(input, 'ArrowUp') || wasPressed(input, 'KeyW')) {
      this.menu.selected = (this.menu.selected - 1 + items.length) % items.length;
      this.audio.blip();
    }
    if (wasPressed(input, 'ArrowDown') || wasPressed(input, 'KeyS')) {
      this.menu.selected = (this.menu.selected + 1) % items.length;
      this.audio.blip();
    }
    if (wasPressed(input, 'Enter') || wasPressed(input, 'Space')) {
      this.activate(items[this.menu.selected]);
    }
    if (wasPressed(input, 'Escape') && (this.screen === 'pause' || this.screen === 'missions' || this.screen === 'controls')) {
      if (this.screen === 'pause') {
        this.screen = 'play';
      } else {
        this.screen = this.pausedFrom || 'title';
        this.menu = { items: this.screen === 'title' ? this.titleItems() : this.pauseItems(), selected: 0 };
      }
    }
  }

  activate(item) {
    if (!item || !item.action) return;
    const a = item.action;
    this.audio.ensure();
    this.audio.blip();
    if (a === 'new') {
      clearSave();
      this.newGame();
    } else if (a === 'continue') {
      this.continueGame(0);
    } else if (a === 'continue2') {
      this.continueGame(1);
    } else if (a === 'resume') {
      this.screen = 'play';
    } else if (a === 'weather') {
      // Cycle the weather from the pause menu and refresh the menu label.
      this.cycleWeather();
      this.menu = { items: this.pauseItems(), selected: this.menu.selected };
    } else if (a === 'save2') {
      saveGame(this, 1);
      this.audio.coin();
      this.floaters.push({ x: this.player.x, y: this.player.y - 50, text: 'Saved to slot 2', t: 0, life: 1.5, color: '#58b368' });
    } else if (a === 'missions') {
      this.pausedFrom = this.screen;
      this.screen = 'missions';
      this.menu = { items: [], selected: 0 };
    } else if (a === 'controls') {
      this.pausedFrom = this.screen;
      this.screen = 'controls';
      this.menu = { items: [{ label: '← Back', action: 'back' }], selected: 0 };
    } else if (a === 'back') {
      this.screen = this.pausedFrom || 'title';
      this.menu = { items: this.screen === 'title' ? this.titleItems() : this.pauseItems(), selected: 0 };
    } else if (a === 'quit') {
      saveGame(this);
      this.resetWorld(1337);
      this.screen = 'title';
      this.saveExists = listSaves()[0];
      this.menu = { items: this.titleItems(), selected: 0 };
    } else if (a === 'respawn') {
      this.respawn();
    } else if (a.startsWith('mission:')) {
      const idx = Number(a.split(':')[1]);
      this.resetWorld(1337 + idx);
      this.screen = 'play';
      startMission(this, idx);
    }
  }

  respawn() {
    const kind = this.screen;
    const lost = Math.floor(this.cash * 0.15);
    this.cash -= lost;
    const spot = kind === 'wasted' ? LANDMARKS.hospital : LANDMARKS.police;
    this.player.x = spot.x;
    this.player.y = spot.y + 60;
    this.player.health = 100;
    this.player.inCar = null;
    this.wanted = 0;
    this.cops = [];
    for (const car of this.cars) if (car.driver === 'police') car.dead = true;
    this.cars = this.cars.filter((c) => !c.dead);
    this.screen = 'play';
    if (this.missions.active) {
      failMission(this, kind === 'wasted' ? 'Dana was wasted' : 'Dana was busted');
      this.pendingMission = true;
      this.autoStartTimer = 3;
    }
  }

  // ---- player ----
  updatePlayer(dt, pilot) {
    const p = this.player;
    const input = this.input;
    if (p.shootTimer > 0) p.shootTimer -= dt;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.recoilKick > 0) p.recoilKick = Math.max(0, p.recoilKick - dt * 2);

    // Mouse aim in world coordinates (through the camera zoom).
    this.mouseWorld.x = this.camera.x + (input.mouseX - 640) / ZOOM;
    this.mouseWorld.y = this.camera.y + (input.mouseY - 360) / ZOOM;

    // Weapon switching.
    const switchKeys = { Digit1: 'fists', Digit2: 'pistol', Digit3: 'smg', Digit4: 'shotgun', Digit5: 'rifle' };
    for (const code of Object.keys(switchKeys)) {
      if (wasPressed(input, code) && p.weapons[switchKeys[code]]) p.weapon = switchKeys[code];
    }

    if (p.inCar) {
      this.updateDriving(dt, pilot);
      return;
    }

    // On foot: move with WASD / arrows.
    let mx = 0;
    let my = 0;
    if (pilot && pilot.move) {
      mx = pilot.move.x;
      my = pilot.move.y;
    } else {
      mx = axis(input, 'KeyA', 'KeyD') + axis(input, 'ArrowLeft', 'ArrowRight');
      my = axis(input, 'KeyW', 'KeyS') + axis(input, 'ArrowUp', 'ArrowDown');
    }
    const len = Math.hypot(mx, my);
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = (running ? PLAYER.runSpeed : PLAYER.walkSpeed) * (len > 0 ? 1 : 0);
    if (len > 0) {
      p.angle = Math.atan2(my / len, mx / len);
      const nx = p.x + (mx / len) * speed * dt;
      const ny = p.y + (my / len) * speed * dt;
      const pos = { x: nx, y: ny };
      collideBuildings(this.city, pos, PLAYER.radius);
      p.x = pos.x;
      p.y = pos.y;
    }
    p.speed = speed;

    // Aim: face the mouse while armed.
    if (p.weapon !== 'fists') {
      p.angle = Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x);
    }

    // Punch.
    if (wasPressed(input, 'Space') && p.punchTimer <= 0) {
      p.punchTimer = PLAYER.punchCooldown;
      this.audio.punch();
      const range = PLAYER.punchRange;
      const hitAt = (x, y) => dist(p.x, p.y, x, y) < range + 14;
      for (const g of this.enemies) {
        if (!g.dead && hitAt(g.x, g.y)) {
          g.hp -= PLAYER.punchDamage;
          if (g.hp <= 0) killEnemy(this, g);
        }
      }
      for (const ped of this.peds) {
        if (!ped.dead && hitAt(ped.x, ped.y)) {
          ped.dead = true;
          addWanted(this, 1);
          dropCash(this, ped.x, ped.y, ped.wallet);
          panicNear(this.peds, p.x, p.y);
        }
      }
      for (const cop of this.cops) {
        if (!cop.dead && hitAt(cop.x, cop.y)) {
          cop.dead = true;
          addWanted(this, 1);
        }
      }
    }

    // Shoot.
    const wantShoot = input.mouseDown || (pilot && pilot.shoot);
    if (wantShoot && p.weapon !== 'fists' && p.shootTimer <= 0) {
      const w = WEAPONS[p.weapon];
      const ammo = p.ammo[p.weapon] || 0;
      if (ammo > 0) {
        p.ammo[p.weapon] = ammo - 1;
        p.shootTimer = w.rate;
        fireWeapon(this, p, p.weapon, p.angle);
        panicNear(this.peds, p.x, p.y, 320);
        if (this.wanted === 0 && Math.random() < 0.5) addWanted(this, 1);
      } else {
        p.shootTimer = 0.3;
        this.audio.blip();
      }
    }

    // Enter a car.
    if (wasPressed(input, 'KeyE')) this.tryEnterCar();
  }

  updateDriving(dt, pilot) {
    const p = this.player;
    const car = p.inCar;
    const input = this.input;
    let throttle = 0;
    let steer = 0;
    let brake = false;
    if (pilot && pilot.car) {
      throttle = pilot.car.throttle;
      steer = pilot.car.steer;
      brake = pilot.car.brake;
    } else {
      throttle = axis(input, 'KeyS', 'KeyW') + axis(input, 'ArrowDown', 'ArrowUp');
      steer = axis(input, 'KeyA', 'KeyD') + axis(input, 'ArrowLeft', 'ArrowRight');
      brake = input.keys.has('Space');
    }
    const prevSpeed = car.speed;
    const hit = stepCar(car, dt, { throttle, steer, brake }, this.city, this.weatherGrip());
    if (hit && Math.abs(prevSpeed) > 260) {
      this.audio.crash();
      this.shake = Math.max(this.shake, 4);
      // A bike crash throws the rider: no roof, no crumple zone.
      if (isBike(car)) {
        damagePlayer(this, CAR.bikeCrashDamage);
        this.floaters.push({ x: car.x, y: car.y - 50, text: 'Bike crash!', t: 0, life: 1.2, color: '#e5534b' });
      }
      // Running over pedestrians while driving.
      for (const ped of this.peds) {
        if (!ped.dead && dist(car.x, car.y, ped.x, ped.y) < 36) {
          ped.dead = true;
          addWanted(this, 1);
          dropCash(this, ped.x, ped.y, ped.wallet);
        }
      }
    }
    // Skid marks when turning hard at speed.
    if (Math.abs(steer) > 0.7 && Math.abs(car.speed) > 300) {
      this.skids.push({ x1: car.x, y1: car.y, x2: car.x - Math.cos(car.angle) * 8, y2: car.y - Math.sin(car.angle) * 8, t: 0, life: 3 });
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (wasPressed(input, 'KeyE')) {
      // Step out beside the car.
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 60;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 60;
      const pos = { x: p.x, y: p.y };
      collideBuildings(this.city, pos, PLAYER.radius);
      p.x = pos.x;
      p.y = pos.y;
    }
    // Shooting from a car is not allowed; the wheel is the weapon.
  }

  tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = CAR.enterRange;
    for (const car of this.cars) {
      if (car.dead || car.health <= 0) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    const wasTraffic = best.driver === 'traffic' || best.driver === 'parked';
    if (wasTraffic && !best.missionTarget) {
      addWanted(this, 1);
      this.stats.carsStolen += 1;
      this.floaters.push({ x: best.x, y: best.y - 50, text: 'Stolen!', t: 0, life: 1.2, color: '#e5534b' });
    }
    best.driver = 'player';
    p.inCar = best;
    p.x = best.x;
    p.y = best.y;
    this.audio.blip();
  }

  // ---- cars, people, wanted ----
  updateCars(dt) {
    const p = this.player;
    const grip = this.weatherGrip();
    // Coordinate the police: the closest patrol car chases, the second cuts
    // ahead to block the escape route, the rest chase.
    const patrol = this.cars
      .filter((c) => c.driver === 'police' && !c.dead)
      .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    patrol.forEach((c, i) => {
      c.role = i === 1 && this.wanted >= 2 ? 'block' : 'chase';
    });
    for (const car of this.cars) {
      if (car.dead) continue;
      if (car.driver === 'traffic') {
        stepTraffic(car, dt, this.city, this.cars, p, grip);
      } else if (car.driver === 'police') {
        stepPolice(car, dt, this.city, p.inCar || p, this.cars, car.role || 'chase', grip);
        // Police ram the player's car.
        if (p.inCar && dist(car.x, car.y, p.inCar.x, p.inCar.y) < 60) {
          p.inCar.health -= 6 * dt;
          if (p.inCar.health <= 0) explodeCar(this, p.inCar);
        }
      } else if (car.driver === 'gang') {
        stepGangCar(car, dt, this.city, p.inCar || p, grip);
        if (p.inCar && dist(car.x, car.y, p.inCar.x, p.inCar.y) < 70) {
          p.inCar.health -= 4 * dt;
          if (p.inCar.health <= 0) explodeCar(this, p.inCar);
        }
      }
      if (car.health <= 0 && !car.dead) explodeCar(this, car);
    }
    // Car-car collisions.
    for (let i = 0; i < this.cars.length; i += 1) {
      for (let j = i + 1; j < this.cars.length; j += 1) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (a.dead || b.dead) continue;
        if (collideCars(a, b)) this.audio.crash();
      }
    }
    // Keep traffic topped up; remove wrecks far away.
    this.cars = this.cars.filter((c) => !c.dead || dist(c.x, c.y, p.x, p.y) < 900);
    const trafficCount = this.cars.filter((c) => c.driver === 'traffic').length;
    if (trafficCount < TRAFFIC.count) {
      this.cars.push(spawnTrafficCar(this.rng, this.city, p));
    }
    const parkedCount = this.cars.filter((c) => c.driver === 'parked').length;
    if (parkedCount < 5) this.cars.push(spawnParkedCar(this.rng, this.city, p));
  }

  updatePeople(dt) {
    const p = this.player;
    const danger = this.bullets.length > 0 ? { x: p.x, y: p.y } : null;
    for (const ped of this.peds) {
      stepPed(ped, dt, this.city, this.rng, danger);
    }
    this.peds = this.peds.filter((ped) => !ped.dead || dist(ped.x, ped.y, p.x, p.y) < 800);
    if (this.peds.length < PEDS.count) {
      const pt = randomSidewalkPoint(this.rng);
      this.peds.push(makePed(this.rng, pt.x, pt.y));
    }
    for (const cop of this.cops) {
      const d = stepCop(cop, dt, this.city, p);
      if (!p.inCar && d < 26) {
        cop.punchTimer -= dt;
        if (cop.punchTimer <= -POLICE.bustTime) {
          this.screen = 'busted';
          this.menu = { items: this.overItems(), selected: 0 };
          this.audio.wasted();
          return;
        }
      } else if (cop.punchTimer < 0) {
        cop.punchTimer = 0;
      }
    }
    this.cops = this.cops.filter((c) => !c.dead);
    // Gangsters shoot.
    for (const g of this.enemies) {
      if (g.dead) continue;
      const fired = stepGangster(g, dt, this.city, p, this.rng);
      if (fired) {
        const a = Math.atan2(p.y - g.y, p.x - g.x) + (Math.random() - 0.5) * 0.2;
        fireWeapon(this, g, 'pistol', a);
      }
    }
    this.enemies = this.enemies.filter((g) => !g.dead || dist(g.x, g.y, p.x, p.y) < 900);
  }

  updateWanted(dt) {
    const p = this.player;
    // Spawn police cars to match the wanted level.
    if (this.wanted > 0) {
      this.policeTimer -= dt;
      const wantCars = Math.min(POLICE.maxCars, this.wanted + (this.wanted >= 3 ? 1 : 0));
      const haveCars = this.cars.filter((c) => c.driver === 'police' && !c.dead).length;
      if (haveCars < wantCars && this.policeTimer <= 0) {
        this.policeTimer = 2.5;
        const spot = randomRoadPoint(this.rng);
        // Spawn at a distance so they do not pop in on top of the player.
        let tries = 0;
        while (dist(spot.x, spot.y, p.x, p.y) < POLICE.spawnDistance && tries < 12) {
          const s2 = randomRoadPoint(this.rng);
          spot.x = s2.x;
          spot.y = s2.y;
          tries += 1;
        }
        const car = makeCar(5, spot.x, spot.y, 0, '#1c2f57', 'police');
        this.cars.push(car);
      }
      // Foot cops when the player is on foot.
      if (!p.inCar) {
        this.copTimer -= dt;
        const wantCops = Math.min(3, this.wanted);
        if (this.cops.length < wantCops && this.copTimer <= 0) {
          this.copTimer = 3;
          const a = this.rng() * Math.PI * 2;
          this.cops.push(makeCop(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420));
        }
      }
      // Wanted decays only when no police can actually see the player:
      // close, with a clear line of sight. Fog shrinks the sight range hard.
      const sight = this.weather.kind === 'fog' ? POLICE.sightFog
        : this.weather.kind === 'rain' ? POLICE.sightRain : POLICE.sightClear;
      const nearPolice = this.cars.some((c) => c.driver === 'police' && !c.dead
          && dist(c.x, c.y, p.x, p.y) < sight && hasLineOfSight(this.city, c.x, c.y, p.x, p.y))
        || this.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 400 && hasLineOfSight(this.city, c.x, c.y, p.x, p.y));
      if (!nearPolice) {
        this.wantedTimer += dt;
        if (this.wantedTimer > POLICE.decayDelay) {
          this.wanted -= 1;
          this.wantedTimer = 0;
        }
      } else {
        this.wantedTimer = 0;
      }
    }
  }

  updateShops(dt) {
    const p = this.player;
    const input = this.input;
    this.prompt = '';
    this.shopAction = null;
    const near = (lm, r = 90) => dist(p.x, p.y, lm.x, lm.y) < r;
    if (near(LANDMARKS.garage, 110) && p.inCar) {
      this.shopAction = 'garage';
      this.prompt = 'G repair $60  •  R repaint $40  •  B cool off wanted $150';
      if (wasPressed(input, 'KeyG') && this.cash >= ECONOMY.repairCost && p.inCar.health < 100) {
        this.cash -= ECONOMY.repairCost;
        p.inCar.health = 100;
        this.audio.coin();
        this.floaters.push({ x: p.x, y: p.y - 50, text: 'Repaired', t: 0, life: 1.2, color: '#58b368' });
      }
      if (wasPressed(input, 'KeyR') && this.cash >= ECONOMY.repaintCost) {
        this.cash -= ECONOMY.repaintCost;
        const m = CAR.models[p.inCar.model];
        p.inCar.color = pick(this.rng, m.colors);
        this.audio.coin();
      }
      if (wasPressed(input, 'KeyB') && this.cash >= ECONOMY.bribeCost && this.wanted > 0) {
        this.cash -= ECONOMY.bribeCost;
        this.wanted = 0;
        this.cops = [];
        for (const c of this.cars) if (c.driver === 'police') c.dead = true;
        this.audio.coin();
        this.floaters.push({ x: p.x, y: p.y - 50, text: 'Heat is off', t: 0, life: 1.5, color: '#58b368' });
      }
    } else if (near(LANDMARKS.gunshop, 90) && !p.inCar) {
      this.shopAction = 'gunshop';
      if (!p.weapons.pistol) this.prompt = 'G buy P9 Pistol $220';
      else if (!p.weapons.smg) this.prompt = 'G buy Stinger SMG $650  •  H buy ammo $30';
      else if (!p.weapons.shotgun) this.prompt = 'G buy Boomstick $480  •  H buy ammo $30';
      else if (!p.weapons.rifle) this.prompt = 'G buy Longshot Rifle $900  •  H buy ammo $30';
      else this.prompt = 'H buy ammo $30';
      if (wasPressed(input, 'KeyG')) {
        if (!p.weapons.pistol && this.cash >= ECONOMY.pistolCost) {
          this.cash -= ECONOMY.pistolCost;
          p.weapons.pistol = true;
          p.weapon = 'pistol';
          p.ammo.pistol = WEAPONS.pistol.ammo;
          this.audio.coin();
        } else if (p.weapons.pistol && !p.weapons.smg && this.cash >= ECONOMY.smgCost) {
          this.cash -= ECONOMY.smgCost;
          p.weapons.smg = true;
          p.weapon = 'smg';
          p.ammo.smg = WEAPONS.smg.ammo;
          this.audio.coin();
        } else if (p.weapons.smg && !p.weapons.shotgun && this.cash >= ECONOMY.shotgunCost) {
          this.cash -= ECONOMY.shotgunCost;
          p.weapons.shotgun = true;
          p.weapon = 'shotgun';
          p.ammo.shotgun = WEAPONS.shotgun.ammo;
          this.audio.coin();
        } else if (p.weapons.shotgun && !p.weapons.rifle && this.cash >= ECONOMY.rifleCost) {
          this.cash -= ECONOMY.rifleCost;
          p.weapons.rifle = true;
          p.weapon = 'rifle';
          p.ammo.rifle = WEAPONS.rifle.ammo;
          this.audio.coin();
        }
      }
      if (wasPressed(input, 'KeyH') && this.cash >= ECONOMY.ammoCost && p.weapon !== 'fists') {
        this.cash -= ECONOMY.ammoCost;
        p.ammo[p.weapon] = (p.ammo[p.weapon] || 0) + 24;
        this.audio.coin();
      }
    } else if ((near(LANDMARKS.food1, 80) || near(LANDMARKS.food2, 80)) && !p.inCar) {
      this.shopAction = 'food';
      this.prompt = 'F eat $15 (+35 HP)';
      if (wasPressed(input, 'KeyF') && this.cash >= ECONOMY.foodCost && p.health < 100) {
        this.cash -= ECONOMY.foodCost;
        p.health = Math.min(100, p.health + ECONOMY.foodHeal);
        this.audio.coin();
      }
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const lookAhead = p.inCar ? 90 : 30;
    const tx = p.x + Math.cos(p.angle) * lookAhead;
    const ty = p.y + Math.sin(p.angle) * lookAhead;
    const k = 1 - Math.pow(0.001, dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
    this.camera.x = clamp(this.camera.x, 640, WORLD.width - 640);
    this.camera.y = clamp(this.camera.y, 360, WORLD.height - 360);
  }

  // ---- render ----
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (this.screen === 'title') {
      drawTitle(ctx, this);
      ctx.restore();
      return;
    }
    if (this.screen === 'missions') {
      drawWorld(ctx, this);
      drawMissionSelect(ctx, this);
      ctx.restore();
      return;
    }
    if (this.screen === 'controls') {
      drawWorld(ctx, this);
      drawControls(ctx, this);
      ctx.restore();
      return;
    }
    // World view with camera transform + shake, magnified by ZOOM.
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(640, 360);
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-this.camera.x + shx, -this.camera.y + shy);
    drawWorld(ctx, this);
    ctx.restore();
    if (!this.hudHidden && (this.screen === 'play' || this.screen === 'pause')) {
      drawHUD(ctx, this);
    }
    // Photo mode: the HUD is hidden, but a tiny hint keeps the way back.
    if (this.hudHidden && this.screen === 'play') {
      drawPhotoHint(ctx, this);
    }
    if (this.screen === 'pause') drawPause(ctx, this);
    if (this.screen === 'wasted') drawOver(ctx, this, 'wasted');
    if (this.screen === 'busted') drawOver(ctx, this, 'busted');
  }
}

function boot() {
  const canvas = $('game');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const game = new Game(canvas);
  window.__game = game;
  // The loading note is only for browsers with JavaScript off or failing.
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  game.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
