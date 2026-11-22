// Staged screenshot setups (?shot=0..3). Each stages a scene and sets
// window.__shotReady so the capture harness knows the frame is done.
import { BIKE } from './config.js';
import { makeVehicle } from './vehicles.js';
import { spawnGangsters } from './combat.js';
import { startMission } from './missions.js';

export const SHOTS = [
  { name: 'title', desc: 'Title screen over the city' },
  { name: 'drive', desc: 'Riding the Corsaro 900 motorcycle' },
  { name: 'chase', desc: 'Three-star police chase in the rain' },
  { name: 'mission', desc: 'Harbour Run in the fog, rifle in hand' },
];

export function stageShot(G, i) {
  const p = G.player;
  G.shotMode = i;
  if (i === 0) {
    // Title: player on foot at the beach overlook, day.
    G.title = true;
    p.x = 1200; p.y = 2500; p.angle = -Math.PI / 2;
    G.weather = 'clear';
    G.dayT = 0.42;
  } else if (i === 1) {
    G.title = false;
    // Put the player on the bike on a long avenue, with traffic around.
    const bike = makeVehicle(BIKE, 1600, 1000, 0, 'player');
    bike.speed = 590;
    G.vehicles.push(bike);
    const t1 = makeVehicle({ name: 'Sedan', top: 430, accel: 300, grip: 1.0, color: '#4a7ac9' }, 1420, 960, 0, 'traffic');
    t1.speed = 200;
    const t2 = makeVehicle({ name: 'Coupe', top: 500, accel: 360, grip: 1.05, color: '#e8c84a' }, 1800, 1040, Math.PI, 'traffic');
    t2.speed = 240;
    G.vehicles.push(t1, t2);
    p.vehicle = bike; p.onFoot = false;
    p.x = bike.x; p.y = bike.y;
    G.weather = 'clear';
    G.dayT = 0.5;
  } else if (i === 2) {
    G.title = false;
    const car = makeVehicle({ name: 'Coupe', top: 500, accel: 360, grip: 1.05, color: '#e8c84a' }, 2000, 1400, 0, 'player');
    car.speed = 420;
    G.vehicles.push(car);
    p.vehicle = car; p.onFoot = false;
    p.x = car.x; p.y = car.y;
    G.weather = 'rain';
    G.dayT = 0.55;
    G.wanted = 3;
    // A chasing cop and a blocker ahead of the player.
    const chase = makeVehicle({ name: 'Interceptor', top: 620, accel: 480, grip: 1.1, color: '#22252c', police: true }, 1850, 1400, 0, 'police');
    chase.role = 'chase'; chase.speed = 500;
    const block = makeVehicle({ name: 'Interceptor', top: 620, accel: 480, grip: 1.1, color: '#22252c', police: true }, 2350, 1360, Math.PI, 'police');
    block.role = 'block'; block.speed = 300;
    G.vehicles.push(chase, block);
  } else {
    G.title = false;
    // Harbour Run in fog, rifle equipped.
    startMission(G, 6);
    G.missionStep = 2;
    G.missionTimer = 68;
    p.x = 3100; p.y = 2520; p.angle = -Math.PI / 2;
    p.weapon = 'rifle';
    p.ammo.rifle = 24;
    G.weather = 'fog';
    G.dayT = 0.8;
    spawnGangsters(G, 3160, 2500, 2);
  }
  G.camera.x = p.vehicle ? p.vehicle.x : p.x;
  G.camera.y = p.vehicle ? p.vehicle.y : p.y;
  window.__shotReady = true;
}
