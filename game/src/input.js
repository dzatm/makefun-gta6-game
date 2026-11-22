// Rebindable keyboard + mouse input. Presses are consumed on read so
// one physical press fires exactly once, even on frames that run
// several fixed simulation steps.
import { BINDINGS_KEY } from './config.js';

export const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  punch: ['Space'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  weapon4: ['Digit4'],
  weapon5: ['Digit5'],
  shopRepair: ['KeyG'],
  shopAmmo: ['KeyH'],
  shopEat: ['KeyF'],
  pause: ['Escape'],
  mute: ['KeyM'],
  hideHud: ['Tab'],
  photo: ['KeyP'],
  minimap: ['KeyN'],
  weather: ['KeyR'],
  horn: ['KeyH'],
};

export class Input {
  constructor() {
    this.bindings = this.loadBindings();
    this.down = {}; // code -> bool
    this.pressed = {}; // action -> timestamp ms, consumed on read
    this.pressedAt = {};
    this.up = false; this.downKey = false; this.left = false; this.right = false;
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._listeners = [];
  }

  loadBindings() {
    try {
      const raw = localStorage.getItem(BINDINGS_KEY);
      if (raw) return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }

  saveBindings() {
    try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings)); } catch (e) { /* ignore */ }
  }

  rebind(action, code) {
    this.bindings[action] = [code];
    this.saveBindings();
  }

  attach(canvas) {
    const keydown = (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.down[e.code] = true;
      for (const [action, codes] of Object.entries(this.bindings)) {
        if (codes.includes(e.code)) {
          this.pressed[action] = true;
          this.pressedAt[action] = performance.now();
        }
      }
    };
    const keyup = (e) => { this.down[e.code] = false; };
    const mousemove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    const mousedown = (e) => { this.mouse.down = true; this.mouse.clicked = true; };
    const mouseup = () => { this.mouse.down = false; };
    const blur = () => { this.down = {}; };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    canvas.addEventListener('mousemove', mousemove);
    canvas.addEventListener('mousedown', mousedown);
    window.addEventListener('mouseup', mouseup);
    this._listeners.push(['keydown', keydown], ['keyup', keyup], ['blur', blur]);
  }

  isDown(action) {
    const codes = this.bindings[action] || [];
    return codes.some((c) => this.down[c]);
  }

  // Consume-on-read: a press fires exactly once.
  wasPressed(action) {
    if (this.pressed[action]) {
      this.pressed[action] = false;
      return true;
    }
    return false;
  }

  // Called once per frame AFTER the simulation stepped, so presses that
  // arrive on a frame that ran zero steps are not swallowed. Stale
  // presses (older than 250ms and never consumed) are dropped so a
  // key hit while paused does not fire later by surprise.
  endFrame(stepped) {
    if (!stepped) return;
    const now = performance.now();
    for (const action of Object.keys(this.pressed)) {
      if (this.pressed[action] && now - (this.pressedAt[action] || 0) > 250) {
        this.pressed[action] = false;
      }
    }
  }

  poll() {
    this.up = this.isDown('up');
    this.downKey = this.isDown('down');
    this.left = this.isDown('left');
    this.right = this.isDown('right');
  }
}
