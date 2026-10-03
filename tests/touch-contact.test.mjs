import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingInput } from '../src/driving-input.mjs';

class Target extends EventTarget {
  dataset = {}; captured = new Set(); options = new Map();
  offsetWidth = 100; box = { left: 0, top: 0, width: 100, height: 100 };
  classList = { toggle() {} };
  getBoundingClientRect() { return this.box; }
  setAttribute() {}
  closest() { return null; }
  matches() { return false; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  addEventListener(type, callback, options) { this.options.set(type, options); super.addEventListener(type, callback, options); }
}
function emit(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  const { origin, ...rest } = props;
  Object.assign(event, rest);
  if (origin) Object.defineProperty(event, 'target', { value: origin });
  target.dispatchEvent(event); return event;
}
function fixture(touchEvents = true) {
  const windowTarget = new Target(), documentTarget = new Target(), wheel = new Target(), keys = {};
  if (touchEvents) windowTarget.ontouchstart = null;
  const buttons = ['ArrowUp', 'ArrowDown', ' '].map(key => Object.assign(new Target(), { dataset: { key } }));
  const input = createDrivingInput(keys, buttons, { windowTarget, documentTarget, wheel });
  const touch = (element, type, id, x, y, origin = element) => emit(element, type, {
    changedTouches: [{ identifier: id, clientX: x, clientY: y, target: origin }],
  });
  return { input, windowTarget, documentTarget, wheel, buttons, keys, touch };
}
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-10, `${value} != ${expected}`);

test('native touch events steer with no PointerEvent API or pointer capture', () => {
  const f = fixture(); f.wheel.setPointerCapture = () => { throw Error('Must not capture a touch'); };
  assert.ok(f.touch(f.wheel, 'touchstart', 0, 50, 5).defaultPrevented);
  assert.ok(f.touch(f.wheel, 'touchmove', 0, 95, 50).defaultPrevented);
  near(f.input.steering, 90 / 420);
  f.touch(f.wheel, 'touchend', 0, 95, 50); assert.equal(f.input.steering, null);
  assert.equal(f.wheel.options.get('touchstart').passive, false);
  assert.equal(f.wheel.options.get('touchmove').passive, false);
});
for (const pedalFirst of [false, true]) test(`native wheel/pedal independent, pedal-first=${pedalFirst}`, () => {
  const f = fixture();
  const pedal = () => f.touch(f.buttons[0], 'touchstart', 1, 300, 200);
  if (pedalFirst) pedal();
  f.touch(f.wheel, 'touchstart', 0, 50, 5);
  if (!pedalFirst) pedal();
  f.touch(f.wheel, 'touchmove', 0, 95, 50);
  near(f.input.steering, 90 / 420); assert.equal(f.keys.ArrowUp, true);
  f.touch(f.buttons[0], 'touchend', 1, 300, 200);
  near(f.input.steering, 90 / 420); assert.equal(f.keys.ArrowUp, false);
});
for (const type of ['touchend', 'touchcancel']) test(`${type} for unrelated finger cannot release wheel or pedal`, () => {
  const f = fixture(); f.touch(f.wheel, 'touchstart', 1, 50, 5); f.touch(f.buttons[0], 'touchstart', 2, 300, 200);
  f.touch(f.wheel, type, 2, 300, 200); assert.equal(f.input.steering, 0); assert.equal(f.keys.ArrowUp, true);
  f.touch(f.wheel, type, 1, 50, 5); assert.equal(f.input.steering, null); assert.equal(f.keys.ArrowUp, true);
});
test('second wheel finger cannot steal the gesture', () => {
  const f = fixture(); f.touch(f.wheel, 'touchstart', 0, 50, 5); f.touch(f.wheel, 'touchstart', 1, 5, 50);
  f.touch(f.wheel, 'touchmove', 1, 50, 95); assert.equal(f.input.steering, 0);
  f.touch(f.wheel, 'touchmove', 0, 95, 50); near(f.input.steering, 90 / 420);
});
test('duplicate touch PointerEvents and compatibility mouse events cannot start or release a touch grip', () => {
  const f = fixture();
  emit(f.wheel, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 50, clientY: 5 });
  assert.equal(f.input.steering, null);
  f.touch(f.wheel, 'touchstart', 1, 50, 5);
  emit(f.wheel, 'pointercancel', { pointerId: 1 }); assert.equal(f.input.steering, 0);
  f.touch(f.wheel, 'touchend', 1, 50, 5);
  emit(f.wheel, 'pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 50, clientY: 5 });
  assert.equal(f.input.steering, null);
});
test('touch IDs do not collide with simultaneous pen pointer IDs', () => {
  const f = fixture(); f.touch(f.buttons[0], 'touchstart', 1, 300, 200);
  emit(f.wheel, 'pointerdown', { pointerType: 'pen', pointerId: 1, clientX: 50, clientY: 5 });
  emit(f.wheel, 'pointerup', { pointerId: 1 }); assert.equal(f.keys.ArrowUp, true);
});
test('horn touch remains uncanceled and never starts steering', () => {
  const f = fixture(); const horn = { closest: () => true };
  assert.equal(f.touch(f.wheel, 'touchstart', 1, 50, 50, horn).defaultPrevented, false);
  assert.equal(f.input.steering, null);
});
test('bubbled descendant capture loss cannot cancel parent wheel capture', () => {
  const f = fixture(false);
  emit(f.wheel, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 50, clientY: 5 });
  emit(f.wheel, 'lostpointercapture', { pointerId: 1, origin: new Target() }); assert.equal(f.input.steering, 0);
  emit(f.wheel, 'lostpointercapture', { pointerId: 1 }); assert.equal(f.input.steering, null);
});
test('capture failure still allows document-level mouse continuation and release outside wheel', () => {
  const f = fixture(false); f.wheel.setPointerCapture = () => { throw Error('NotFoundError'); };
  emit(f.wheel, 'pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 50, clientY: 5 });
  emit(f.documentTarget, 'pointermove', { pointerId: 1, clientX: 200, clientY: 50 }); near(f.input.steering, 90 / 420);
  emit(f.documentTarget, 'pointerup', { pointerId: 1 }); assert.equal(f.input.steering, null);
});
test('browser-bar height resize rebases a held wheel without releasing or jumping', () => {
  const f = fixture(); f.touch(f.wheel, 'touchstart', 1, 50, 5); f.touch(f.wheel, 'touchmove', 1, 95, 50);
  f.wheel.box.top = 10; f.input.rebaseWheel(); near(f.input.steering, 90 / 420);
  f.touch(f.wheel, 'touchmove', 1, 95, 50); near(f.input.steering, 90 / 420);
});
for (const type of ['orientationchange', 'pagehide', 'blur']) test(`${type} clears native touch ownership`, () => {
  const f = fixture(); f.touch(f.wheel, 'touchstart', 1, 50, 5); f.touch(f.buttons[0], 'touchstart', 2, 300, 200);
  emit(f.windowTarget, type); assert.equal(f.input.steering, null); assert.equal(f.keys.ArrowUp, false);
  f.touch(f.wheel, 'touchmove', 1, 95, 50); assert.equal(f.input.steering, null);
});
test('destroy removes native touch handlers', () => {
  const f = fixture(); f.input.destroy(); f.touch(f.wheel, 'touchstart', 1, 50, 5); assert.equal(f.input.steering, null);
});

test('batched changedTouches cannot assign another target’s finger to wheel or pedal', () => {
  const f = fixture();
  const changedTouches = [
    { identifier: 1, clientX: 300, clientY: 200, target: f.buttons[0] },
    { identifier: 2, clientX: 50, clientY: 5, target: f.wheel },
    { identifier: 3, clientX: 400, clientY: 200, target: f.buttons[1] },
  ];
  emit(f.wheel, 'touchstart', { changedTouches });
  emit(f.buttons[0], 'touchstart', { changedTouches });
  emit(f.buttons[1], 'touchstart', { changedTouches });
  f.touch(f.wheel, 'touchmove', 2, 95, 50); near(f.input.steering, 90 / 420);
  f.touch(f.buttons[0], 'touchend', 1, 300, 200);
  assert.equal(f.keys.ArrowUp, false); assert.equal(f.keys.ArrowDown, true);
  f.touch(f.buttons[1], 'touchend', 3, 400, 200);
  assert.equal(f.keys.ArrowDown, false); near(f.input.steering, 90 / 420);
});

test('capture-failure mouse returning without buttons releases a missed pointerup', () => {
  const f = fixture(false); f.wheel.setPointerCapture = () => { throw Error('NotFoundError'); };
  emit(f.wheel, 'pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 50, clientY: 5 });
  emit(f.documentTarget, 'pointermove', { pointerId: 1, buttons: 0, clientX: 95, clientY: 50 });
  assert.equal(f.input.steering, null);
});
