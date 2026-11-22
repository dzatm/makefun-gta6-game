// Keyboard and mouse input. Keys are tracked as a set of codes; the mouse is
// tracked in logical canvas coordinates so aiming works at any window size.
//
// Actions are rebound through a bindings table (persisted in localStorage):
// the game asks for an action ('pause', 'hud', 'photo', 'minimap',
// 'weather', 'mute') instead of a hard-coded key, so the player can remap
// them without touching the code. Defaults match the controls screen.

const BINDINGS_KEY = 'solmarina.bindings.v1';

export const DEFAULT_BINDINGS = {
  pause: 'Escape',
  hud: 'Tab',
  photo: 'KeyP',
  minimap: 'KeyN',
  weather: 'KeyR',
  mute: 'KeyM',
};

function loadBindings() {
  try {
    const raw = window.localStorage.getItem(BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const data = JSON.parse(raw);
    return { ...DEFAULT_BINDINGS, ...data };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export const bindings = loadBindings();

/** The key code currently bound to an action. */
export function getBinding(action) {
  return bindings[action] || DEFAULT_BINDINGS[action];
}

/** Rebind an action to a new key code and persist it. */
export function setBinding(action, code) {
  if (!DEFAULT_BINDINGS[action] || typeof code !== 'string') return false;
  bindings[action] = code;
  try {
    window.localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch { /* storage unavailable; the binding still holds for this session */ }
  return true;
}

/** Was the action's key pressed since the last frame (edge-triggered)?
 * Consumes the press, like wasPressed, so one key press fires once. */
export function wasPressedAction(input, action) {
  return wasPressed(input, getBinding(action));
}

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    mouseClicked: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.code);
      input.pressed.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * 1280;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * 720;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });

  return input;
}

export function axis(input, negative, positive) {
  let v = 0;
  if (input.keys.has(negative)) v -= 1;
  if (input.keys.has(positive)) v += 1;
  return v;
}

/** Was the key pressed since the last frame (edge-triggered)? Reading a press
 * consumes it, so a frame that runs several fixed simulation steps still
 * handles one key press exactly once (a pause key must not pause and
 * immediately unpause, a weather key must not cycle twice). */
export function wasPressed(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

/** Clear the edge-triggered set at the end of each frame. */
export function endFrame(input) {
  input.pressed.clear();
  input.mouseClicked = false;
}
