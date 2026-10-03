import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createDrivingInput } from '../src/driving-input.mjs';
import { WHEEL_LOCK_DEGREES } from '../src/wheel-input.mjs';

class Target extends EventTarget {
  dataset = {}; captured = new Set(); attributes = {}; classes = new Set();
  offsetWidth = 100;
  box = { left: 40, top: 60, width: 100, height: 100 };
  classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  getBoundingClientRect() { return this.box; }
  setAttribute(name, value) { this.attributes[name] = value; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) {
    this.captured.delete(id);
    emit(this, 'lostpointercapture', { pointerId: id });
  }
  matches() { return false; }
  closest() { return null; }
}
function emit(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  const { target: origin, ...values } = props;
  Object.assign(event, values);
  if (origin) Object.defineProperty(event, 'target', { value: origin });
  target.dispatchEvent(event);
  return event;
}
function fixture(initial = 0) {
  const windowTarget = new Target(), documentTarget = new Target(), wheel = new Target(), keys = {};
  const buttons = ['ArrowUp', 'ArrowDown', ' ', 'ArrowLeft', 'ArrowRight'].map(key => Object.assign(new Target(), { dataset: { key } }));
  let enabled = true, steering = initial;
  const input = createDrivingInput(keys, buttons, { windowTarget, documentTarget, wheel,
    canDrive: () => enabled, getSteering: () => steering });
  const point = (angle, radius = 45) => ({ clientX: 90 + Math.cos(angle * Math.PI / 180) * radius, clientY: 110 + Math.sin(angle * Math.PI / 180) * radius });
  const wheelEvent = (type, angle = -90, pointerId = 1, extra = {}) => emit(wheel, type, { pointerId, pointerType: 'touch', ...point(angle), ...extra });
  const pressPedal = (index = 0, pointerId = 2) => emit(buttons[index], 'pointerdown', { pointerId, pointerType: 'touch' });
  return { input, keys, wheel, buttons, windowTarget, documentTarget, point, wheelEvent, pressPedal,
    disable: () => enabled = false, setSteering: value => steering = value };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('grabbing starts from current steering without jumping, clockwise motion is proportional', () => {
  const f = fixture(.25);
  assert.equal(f.wheelEvent('pointerdown').defaultPrevented, true);
  near(f.input.steering, .25);
  assert.equal(f.wheel.captured.has(1), true);
  assert.equal(f.wheelEvent('pointermove', 0).defaultPrevented, true);
  near(f.input.steering, .25 + 90 / WHEEL_LOCK_DEGREES);
  f.wheelEvent('pointermove', -90);
  near(f.input.steering, .25);
});
for (const direction of [-1, 1]) test(`angle seam unwraps smoothly in direction ${direction}`, () => {
  const f = fixture();
  f.wheelEvent('pointerdown', direction * 179);
  f.wheelEvent('pointermove', direction * -179);
  near(f.input.steering, direction * 2 / WHEEL_LOCK_DEGREES);
});
for (const direction of [-1, 1]) test(`multiple revolutions clamp at ${direction} lock and reverse immediately`, () => {
  const f = fixture(); f.wheelEvent('pointerdown', 0);
  for (let angle = 90; angle <= 720; angle += 90) f.wheelEvent('pointermove', direction * angle);
  assert.equal(f.input.steering, direction);
  f.wheelEvent('pointermove', direction * 630);
  near(f.input.steering, direction * (1 - 90 / WHEEL_LOCK_DEGREES));
});
test('crossing the center dead zone cannot flip the wheel', () => {
  const f = fixture(); f.wheelEvent('pointerdown', 0);
  f.wheelEvent('pointermove', 0, 1, f.point(0, 0));
  f.wheelEvent('pointermove', 180);
  near(f.input.steering, 0);
  f.wheelEvent('pointermove', 90);
  near(f.input.steering, -90 / WHEEL_LOCK_DEGREES);
});
test('a fast swipe that skips over the hub rebases without a 180-degree jump', () => {
  const f = fixture(); f.wheelEvent('pointerdown', 0);
  f.wheelEvent('pointermove', 180); near(f.input.steering, 0);
  f.wheelEvent('pointermove', 90); near(f.input.steering, -90 / WHEEL_LOCK_DEGREES);
});
test('rotated bounding box keeps a stable center and pointer capture follows outside the rim', () => {
  const f = fixture(); f.wheelEvent('pointerdown', -90);
  f.wheel.box = { left: 20, top: 40, width: 140, height: 140 };
  f.wheelEvent('pointermove', 0, 1, f.point(0, 200));
  near(f.input.steering, 90 / WHEEL_LOCK_DEGREES);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) test(`${type} releases only wheel; pedal remains held`, () => {
  const f = fixture(); f.wheelEvent('pointerdown'); f.wheelEvent('pointermove', 0); f.pressPedal();
  f.wheelEvent(type);
  assert.equal(f.input.steering, null); assert.equal(f.keys.ArrowUp, true);
  assert.equal(f.wheel.captured.size, 0); assert.equal(f.wheel.classes.has('steering-held'), false);
});
for (const index of [0, 1, 2]) test(`pedal ${index} works independently and releasing it preserves wheel`, () => {
  const f = fixture(); f.pressPedal(index); f.wheelEvent('pointerdown'); f.wheelEvent('pointermove', 0);
  assert.equal(f.keys[f.buttons[index].dataset.key], true);
  emit(f.buttons[index], 'pointerup', { pointerId: 2 });
  near(f.input.steering, 90 / WHEEL_LOCK_DEGREES);
});
test('a second wheel finger cannot steal, move, or release the first finger', () => {
  const f = fixture(); f.wheelEvent('pointerdown');
  f.wheelEvent('pointerdown', 90, 2); f.wheelEvent('pointermove', 180, 2); f.wheelEvent('pointerup', 180, 2);
  near(f.input.steering, 0); assert.equal(f.wheel.captured.has(2), false);
  f.wheelEvent('pointermove', 0); near(f.input.steering, 90 / WHEEL_LOCK_DEGREES);
});
for (const type of ['blur', 'pagehide', 'orientationchange']) test(`${type} clears wheel, pedals, and keyboard together`, () => {
  const f = fixture(); f.wheelEvent('pointerdown'); f.pressPedal(); emit(f.windowTarget, 'keydown', { key: 'ArrowLeft' });
  emit(f.windowTarget, type);
  assert.equal(f.input.steering, null); assert.ok(Object.values(f.keys).every(value => !value));
  assert.equal(f.wheel.captured.size, 0);
});
test('hidden document and explicit settings/reset/gear/viewport clear release the wheel', () => {
  const f = fixture(); f.wheelEvent('pointerdown'); f.documentTarget.hidden = true;
  emit(f.documentTarget, 'visibilitychange'); assert.equal(f.input.steering, null);
  f.wheelEvent('pointerdown'); f.input.clear(); assert.equal(f.input.steering, null);
});
test('blocked driving rejects grabs and clears an existing gesture on movement', () => {
  const f = fixture(); f.wheelEvent('pointerdown'); f.disable(); f.wheelEvent('pointermove', 0);
  assert.equal(f.input.steering, null); f.wheelEvent('pointerdown'); assert.equal(f.input.steering, null);
});
test('horn remains a normal button and right-click cannot start steering', () => {
  const f = fixture();
  const horn = { closest: selector => selector === 'button' };
  assert.equal(f.wheelEvent('pointerdown', 0, 1, { target: horn }).defaultPrevented, false);
  assert.equal(f.input.steering, null);
  f.wheelEvent('pointerdown', 0, 1, { pointerType: 'mouse', button: 2 }); assert.equal(f.input.steering, null);
  f.wheelEvent('pointerdown', 0, 1, { pointerType: 'mouse', button: 0 }); near(f.input.steering, 0);
});
test('release and re-grab samples actual recentering position; destroy removes listeners', () => {
  const f = fixture(.6); f.wheelEvent('pointerdown'); f.wheelEvent('pointerup');
  f.setSteering(.2); f.wheelEvent('pointerdown', 90); near(f.input.steering, .2);
  f.input.destroy(); f.wheelEvent('pointerdown'); assert.equal(f.input.steering, null);
});

// Execute the actual production steering section to cover integration/precedence.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('  const wheelSteering = drivingInput.steering;');
const end = source.indexOf('  let acceleration = 0, braking = false;', start);
assert.ok(start !== -1 && end > start);
function step(steer, wheelSteering, keys = {}, signal = null) {
  const state = { steer, signal };
  vm.runInNewContext(source.slice(start, end), { state, drivingInput: { steering: wheelSteering }, keys,
    dt: .04, CAR: { maxSteer: .55 }, cancelSignal: () => state.signal = null,
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
  });
  return state;
}
test('actual game update applies analog steering directly, prioritizes a grabbed centered wheel', () => {
  near(step(0, .5).steer, .275);
  near(step(.2, 0, { ArrowRight: true }).steer, 0);
});
test('release resumes existing recentering and keyboard steering rate', () => {
  near(step(.2, null).steer, (.2 - .032) * Math.pow(.35, .04));
  near(step(.2, null, { ArrowLeft: true }).steer, .168);
});
test('analog countersteering still cancels turn indicators', () => {
  assert.equal(step(0, .3, {}, 'left').signal, null);
  assert.equal(step(0, -.3, {}, 'right').signal, null);
});
