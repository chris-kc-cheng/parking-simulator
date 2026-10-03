import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Execute the production longitudinal update, without canvas or the city renderer.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('  let acceleration = 0, braking = false;');
const end = source.indexOf('  const next = { ...state };', start);
assert.ok(start !== -1 && end > start);
function step(speed, keys, gear = speed < 0 ? 'R' : 'D') {
  const state = { speed, gear };
  vm.runInNewContext(source.slice(start, end), { state, keys, dt: 0.04,
    CAR: { brakeDeceleration: 8, forwardAcceleration: 3.2, reverseAcceleration: 2.2 },
    clamp: (n, low, high) => Math.max(low, Math.min(high, n)),
  });
  return state;
}
for (const speed of [-2, 0, 2]) test(`brake dominates acceleration at speed ${speed}`, () => {
  const result = step(speed, { ' ': true, ArrowUp: true, ArrowDown: true });
  assert.equal(result.speed, speed - Math.sign(speed) * Math.min(Math.abs(speed), 0.32));
  assert.equal(result.gear, speed < 0 ? 'R' : 'D');
});
test('brake reaches zero without reversing', () => {
  assert.equal(step(0.1, { ' ': true }).speed, 0);
  assert.equal(step(-0.1, { ' ': true }).speed, 0);
});
test('holding both direction pedals brakes once without shifting', () => {
  assert.equal(step(2, { ArrowUp: true, ArrowDown: true }).speed, 1.68);
  assert.equal(step(0, { ArrowUp: true, ArrowDown: true }, 'P').gear, 'P');
});
test('desktop direction controls still drive and brake before reversing', () => {
  assert.equal(step(0, { ArrowUp: true }, 'P').gear, 'D');
  assert.equal(step(0, { ArrowDown: true }, 'P').gear, 'R');
  assert.equal(step(2, { ArrowDown: true }).speed, 1.68);
  assert.equal(step(-2, { ArrowUp: true }).speed, -1.68);
});
