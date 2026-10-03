import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingInput } from '../src/driving-input.mjs';
class Target extends EventTarget {
  dataset = {}; captured = new Set(); attributes = {}; classes = new Set();
  classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  setAttribute(name, value) { this.attributes[name] = value; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  matches() { return false; }
  closest() { return null; }
}
function emit(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, props); target.dispatchEvent(event); return event;
}
function fixture() {
  const windowTarget = new Target(), documentTarget = new Target(), keys = {};
  const buttons = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].map(key => Object.assign(new Target(), { dataset: { key } }));
  let enabled = true;
  const input = createDrivingInput(keys, buttons, { windowTarget, documentTarget, canDrive: () => enabled });
  const press = (index, pointerId) => emit(buttons[index], 'pointerdown', { pointerId, pointerType: 'touch' });
  return { windowTarget, documentTarget, keys, buttons, input, press, disable: () => enabled = false };
}
test('two thumbs can steer and accelerate independently', () => {
  const f = fixture(); f.press(0, 1); f.press(2, 2);
  assert.equal(f.keys.ArrowLeft, true); assert.equal(f.keys.ArrowUp, true);
  emit(f.buttons[0], 'pointerup', { pointerId: 1 });
  assert.equal(f.keys.ArrowLeft, false); assert.equal(f.keys.ArrowUp, true);
  emit(f.buttons[2], 'pointerup', { pointerId: 2 }); assert.equal(f.keys.ArrowUp, false);
});
test('same action can have two fingers and a keyboard owner', () => {
  const f = fixture(); f.press(2, 1); f.press(2, 2);
  emit(f.windowTarget, 'keydown', { key: 'ArrowUp' });
  emit(f.buttons[2], 'pointerup', { pointerId: 1 });
  emit(f.windowTarget, 'keyup', { key: 'ArrowUp' }); assert.equal(f.keys.ArrowUp, true);
  emit(f.buttons[2], 'pointercancel', { pointerId: 2 }); assert.equal(f.keys.ArrowUp, false);
});
for (const type of ['pointercancel', 'lostpointercapture']) test(`${type} releases only its owner`, () => {
  const f = fixture(); f.press(0, 1); f.press(2, 2);
  emit(f.buttons[0], type, { pointerId: 1 }); assert.equal(f.keys.ArrowLeft, false); assert.equal(f.keys.ArrowUp, true);
});
for (const type of ['blur', 'pagehide', 'orientationchange']) test(`${type} clears all holds and pressed visuals`, () => {
  const f = fixture(); f.press(0, 1); f.press(2, 2); emit(f.windowTarget, 'keydown', { key: ' ' });
  emit(f.windowTarget, type);
  assert.ok(Object.values(f.keys).every(value => !value)); assert.equal(f.buttons[2].attributes['aria-pressed'], 'false'); assert.equal(f.buttons[2].captured.size, 0);
});
test('backgrounding the document releases holds', () => {
  const f = fixture(); f.press(4, 1); f.documentTarget.hidden = true; emit(f.documentTarget, 'visibilitychange'); assert.equal(f.keys[' '], false);
});
test('settings, reset and gear changes can explicitly clear controls', () => {
  const f = fixture(); f.press(2, 1); f.input.clear(); assert.equal(f.keys.ArrowUp, false);
  f.disable(); f.press(2, 2); emit(f.windowTarget, 'keydown', { key: 'ArrowUp' }); assert.equal(f.keys.ArrowUp, false);
});
test('destroy releases input and removes listeners', () => {
  const f = fixture(); f.press(2, 1); f.input.destroy(); f.press(2, 2); emit(f.windowTarget, 'keydown', { key: 'ArrowUp' }); assert.equal(f.keys.ArrowUp, false);
});
test('touch prevents browser gestures, right mouse button is ignored', () => {
  const f = fixture(); assert.equal(f.press(2, 1).defaultPrevented, true); f.input.clear();
  emit(f.buttons[2], 'pointerdown', { pointerId: 2, pointerType: 'mouse', button: 2 }); assert.equal(f.keys.ArrowUp, false);
});
test('form fields keep arrows and focused buttons keep Space activation', () => {
  const f = fixture();
  const key = (value, target) => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    event.key = value; f.windowTarget.dispatchEvent(event); return event;
  };
  const input = { matches: () => true };
  assert.equal(key('ArrowUp', input).defaultPrevented, false); assert.equal(f.keys.ArrowUp, false);
  const button = { matches: () => false, closest: () => true };
  assert.equal(key(' ', button).defaultPrevented, false); assert.equal(f.keys[' '], false);
});
