// Full-page integration checks. These deliberately load index.html and the real
// application modules/CSS; no input controller, capture API, or app state is mocked.
// Install the CI-pinned Playwright version, then run: node tests/browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import test, { before, after } from 'node:test';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = process.env.APP_ROOT ? resolve(projectRoot, process.env.APP_ROOT) : projectRoot;
const artifacts = resolve(projectRoot, 'test-results');
const viewports = [
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
];
const browsers = process.env.BROWSER ? [process.env.BROWSER] : ['chromium', 'webkit'];
assert.ok(browsers.every(name => ['chromium', 'webkit'].includes(name)), 'BROWSER must be chromium or webkit');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
let baseURL;
before(async () => {
  await mkdir(artifacts, { recursive: true });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}/`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });

const wheelHeld = (page, expected) => page.waitForFunction(value => document.querySelector('.wheel').classList.contains('steering-held') === value, expected);
const pedalHeld = (page, key, expected) => page.waitForFunction(({ key, expected }) => {
  const button = [...document.querySelectorAll('[data-key]')].find(button => button.dataset.key === key);
  return button.getAttribute('aria-pressed') === String(expected) && button.classList.contains('held') === expected;
}, { key, expected });
const angle = page => page.locator('.wheel').evaluate(wheel => Number(wheel.style.transform.match(/rotate\(([-\d.e+]+)deg\)/)?.[1]));
const nearAngle = (page, expected, tolerance = 3) => page.waitForFunction(({ expected, tolerance }) => {
  const value = Number(document.querySelector('.wheel').style.transform.match(/rotate\(([-\d.e+]+)deg\)/)?.[1]);
  return Number.isFinite(value) && Math.abs(value - expected) <= tolerance;
}, { expected, tolerance });
const centered = page => nearAngle(page, 0, 1);
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const polar = (wheel, degrees, radius = wheel.radius * .9) => ({
  x: wheel.x + Math.cos(degrees * Math.PI / 180) * radius,
  y: wheel.y + Math.sin(degrees * Math.PI / 180) * radius,
});
async function geometry(page) {
  await centered(page);
  return page.locator('.wheel').evaluate(wheel => {
    const box = wheel.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, radius: wheel.offsetWidth / 2 };
  });
}
async function buttonPoint(page, key) {
  return page.locator('[data-key]').evaluateAll((buttons, key) => {
    const button = buttons.find(button => button.dataset.key === key), box = button.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    if (!button.contains(document.elementFromPoint(x, y))) throw new Error(`The ${key} control is covered`);
    return { x, y };
  }, key);
}
async function checkWheelHit(page, point, region) {
  const hit = await page.evaluate(({ point, region }) => {
    const wheel = document.querySelector('.wheel'), target = document.elementFromPoint(point.x, point.y);
    return { inWheel: wheel.contains(target), horn: !!target?.closest('.horn'),
      spoke: !!target?.closest(`.${region}`), delegated: target === wheel,
      target: target?.outerHTML.slice(0, 180), touchAction: getComputedStyle(wheel).touchAction };
  }, { point, region });
  assert.equal(hit.inWheel, true, `${region} must hit the wheel, got ${hit.target}`);
  assert.equal(hit.horn, region === 'horn', `${region} must not accidentally hit the horn`);
  if (region.endsWith('Spoke')) assert.ok(hit.spoke || hit.delegated, `${region} must hit its visible spoke or delegate to the wheel, got ${hit.target}`);
  assert.equal(hit.touchAction, 'none', 'wheel must isolate native browser gestures');
}
async function arc(driver, id, wheel, from, to, radius = wheel.radius * .9) {
  for (let step = 1; step <= 12; step++) await driver.move(id, polar(wheel, from + (to - from) * step / 12, radius));
}
async function noHolds(page) {
  await wheelHeld(page, false);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']) await pedalHeld(page, key, false);
}

// Chromium uses trusted browser-generated touch/pointer events. The explicit
// SyntheticPointerActions feature enables the documented active-contact-list
// semantics: touchMove can add/remove a contact without releasing its sibling.
// WebKit has no equivalent public multi-touch protocol API in Playwright, so its
// multi-touch tests construct native Touch/TouchEvent instances and let them
// bubble from the real hit-tested DOM target. They are not physical iOS tests.
async function touchDriver(page, browserName) {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const contacts = new Map();
    const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...contacts.values()] });
    return {
      async start(id, point) {
        assert.ok(!contacts.has(id));
        const type = contacts.size ? 'touchMove' : 'touchStart';
        contacts.set(id, { id, ...point, radiusX: 2, radiusY: 2, force: 1 });
        await send(type);
      },
      async move(id, point) { assert.ok(contacts.has(id)); Object.assign(contacts.get(id), point); await send('touchMove'); },
      async end(id) { assert.ok(contacts.delete(id)); await send(contacts.size ? 'touchMove' : 'touchEnd'); },
      async cancelAll() { if (contacts.size) { contacts.clear(); await send('touchCancel'); } },
      async dispose() { await this.cancelAll(); await cdp.detach(); },
    };
  }
  await page.evaluate(() => { window.__browserTestContacts = new Map(); });
  const dispatch = (type, id, point) => page.evaluate(({ type, id, point }) => {
    const contacts = window.__browserTestContacts;
    let contact = contacts.get(id);
    if (type === 'touchstart') {
      if (contact) throw new Error(`Duplicate touch ${id}`);
      contact = { identifier: id, target: document.elementFromPoint(point.x, point.y), ...point };
      if (!contact.target) throw new Error(`Touch ${id} starts outside the viewport`);
      contacts.set(id, contact);
    } else if (!contact) throw new Error(`Missing touch ${id}`);
    if (point) Object.assign(contact, point);
    const makeTouch = item => new Touch({ identifier: item.identifier, target: item.target,
      clientX: item.x, clientY: item.y, pageX: item.x + scrollX, pageY: item.y + scrollY,
      screenX: item.x, screenY: item.y, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    const changed = makeTouch(contact);
    if (type === 'touchend' || type === 'touchcancel') contacts.delete(id);
    const touches = [...contacts.values()].map(makeTouch);
    contact.target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, view: window,
      touches, targetTouches: touches.filter(touch => touch.target === contact.target), changedTouches: [changed] }));
  }, { type, id, point });
  return {
    start: (id, point) => dispatch('touchstart', id, point),
    move: (id, point) => dispatch('touchmove', id, point),
    end: id => dispatch('touchend', id),
    async cancelAll() {
      const ids = await page.evaluate(() => [...window.__browserTestContacts.keys()]);
      for (const id of ids) await dispatch('touchcancel', id);
    },
    async dispose() { await this.cancelAll(); },
  };
}

async function loadApp(page) {
  await page.goto(baseURL, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.wheel')?.style.transform && document.querySelector('canvas[data-view="front"]')?.width > 0);
  await frame(page);
  await centered(page);
  assert.equal(await page.evaluate(() => 'ontouchstart' in window), true, 'mobile context must expose Touch Events');
}

const touchCases = {
  async 'rim and all three spokes steer clockwise and counterclockwise'({ page, driver }) {
    for (const [region, degrees, fraction] of [['rim', -90, .92], ['leftSpoke', 180, .72], ['rightSpoke', 0, .72], ['lowerSpoke', 90, .72]]) {
      const wheel = await geometry(page), radius = wheel.radius * fraction, start = polar(wheel, degrees, radius);
      await checkWheelHit(page, start, region);
      await driver.start(1, start);
      await wheelHeld(page, true);
      await arc(driver, 1, wheel, degrees, degrees + 60, radius);
      await nearAngle(page, 60);
      await arc(driver, 1, wheel, degrees + 60, degrees - 60, radius);
      await nearAngle(page, -60);
      await driver.end(1);
      await wheelHeld(page, false);
      await centered(page);
    }
  },
  async 'wheel and every pedal retain independent finger ownership'({ page, driver }) {
    for (const key of ['ArrowUp', 'ArrowDown', ' ']) {
      const wheel = await geometry(page), pedal = await buttonPoint(page, key);
      await driver.start(1, polar(wheel, -90));
      await driver.start(2, pedal);
      await wheelHeld(page, true);
      await pedalHeld(page, key, true);
      await arc(driver, 1, wheel, -90, -30);
      await nearAngle(page, 60);
      if (key !== ' ') await page.waitForFunction(gear => document.querySelector('.gear .active')?.textContent === gear, key === 'ArrowUp' ? 'D' : 'R');
      await driver.end(1);
      await wheelHeld(page, false);
      await pedalHeld(page, key, true);
      await centered(page);
      await driver.start(3, polar(wheel, -90));
      await arc(driver, 3, wheel, -90, -30);
      await nearAngle(page, 60);
      await driver.end(2);
      await pedalHeld(page, key, false);
      await wheelHeld(page, true);
      await arc(driver, 3, wheel, -30, 0);
      await nearAngle(page, 90);
      await driver.end(3);
      await centered(page);
    }
  },
  async 'dragging outside the wheel or pedal retains ownership until release or cancel'({ page, driver }) {
    const wheel = await geometry(page);
    await driver.start(1, polar(wheel, -90));
    await driver.start(2, await buttonPoint(page, 'ArrowUp'));
    await arc(driver, 1, wheel, -90, 0);
    await nearAngle(page, 90);
    const outside = polar(wheel, 0, wheel.radius * 2);
    assert.equal(await page.evaluate(point => !!document.elementFromPoint(point.x, point.y)?.closest('.wheel'), outside), false);
    await driver.move(1, outside);
    await driver.move(1, polar(wheel, -30, wheel.radius * 2));
    await nearAngle(page, 60);
    await driver.move(2, { x: page.viewportSize().width - 5, y: 5 });
    await pedalHeld(page, 'ArrowUp', true);
    await wheelHeld(page, true);
    await driver.cancelAll();
    await noHolds(page);
    await centered(page);
    await driver.start(3, polar(wheel, -90));
    await arc(driver, 3, wheel, -90, -45);
    await nearAngle(page, 45);
    await driver.end(3);
    await noHolds(page);
  },
  async 'horn hit target never starts steering and a real tap still clicks it'({ page, driver }) {
    const wheel = await geometry(page), point = { x: wheel.x, y: wheel.y };
    await checkWheelHit(page, point, 'horn');
    await driver.start(1, point);
    await driver.move(1, { x: point.x + 5, y: point.y - 5 });
    await wheelHeld(page, false);
    await nearAngle(page, 0);
    await driver.end(1);
    // Unlike constructed TouchEvents, touchscreen.tap goes through each browser's
    // input API and exercises the native compatibility click for the horn.
    await page.locator('.horn').evaluate(horn => {
      window.__hornClicks = 0;
      horn.addEventListener('click', () => window.__hornClicks++, { capture: true });
    });
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForFunction(() => window.__hornClicks === 1);
    await wheelHeld(page, false);
    await nearAngle(page, 0);
  },
  async 'keyboard and touch owners of the same pedal release independently'({ page, driver }) {
    const pedal = await buttonPoint(page, 'ArrowUp');
    await page.keyboard.down('ArrowUp');
    await driver.start(1, { x: pedal.x - 8, y: pedal.y });
    await driver.start(2, { x: pedal.x + 8, y: pedal.y });
    await driver.end(1);
    await pedalHeld(page, 'ArrowUp', true);
    await page.keyboard.up('ArrowUp');
    await pedalHeld(page, 'ArrowUp', true);
    await driver.end(2);
    await pedalHeld(page, 'ArrowUp', false);
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => Number(document.querySelector('.wheel').style.transform.match(/rotate\(([-\d.e+]+)deg\)/)?.[1]) < -30);
    await page.keyboard.up('ArrowLeft');
    await centered(page);
    await page.keyboard.down(' ');
    await pedalHeld(page, ' ', true);
    await page.keyboard.up(' ');
    await noHolds(page);
  },
  async 'mouse pointer dragging still works on a touch-capable browser'({ page }) {
    await mouseChecks(page);
  },
  async 'blur, pagehide, orientation and visibility interruptions clear every hold'({ page, driver }) {
    for (const type of ['blur', 'pagehide', 'orientationchange', 'visibilitychange']) {
      const wheel = await geometry(page);
      await driver.start(1, polar(wheel, -90));
      await driver.start(2, await buttonPoint(page, 'ArrowUp'));
      await page.keyboard.down('ArrowRight');
      await arc(driver, 1, wheel, -90, -30);
      await nearAngle(page, 60);
      await page.evaluate(type => {
        if (type === 'visibilitychange') {
          // Browser-independent lifecycle simulation. Actual iOS app switching
          // is still a physical-device check, not claimed by this regression.
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event(type));
          delete document.hidden;
        } else window.dispatchEvent(new Event(type));
      }, type);
      await noHolds(page);
      await driver.move(1, polar(wheel, 0));
      await noHolds(page); // an old contact may not resume after interruption
      await driver.cancelAll();
      await page.keyboard.up('ArrowRight');
      await centered(page);
    }
  },
  async 'height-only browser chrome resizing preserves a grip without an angular jump'({ page, driver, viewport }) {
    const wheel = await geometry(page), previousPoint = polar(wheel, -30);
    await driver.start(1, polar(wheel, -90));
    await driver.start(2, await buttonPoint(page, 'ArrowUp'));
    await arc(driver, 1, wheel, -90, -30);
    await nearAngle(page, 60);
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 20 });
    await frame(page);
    await wheelHeld(page, true);
    await pedalHeld(page, 'ArrowUp', true);
    await nearAngle(page, 60);
    const movedWheel = await page.locator('.wheel').evaluate(element => {
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, radius: element.offsetWidth / 2 };
    });
    const dx = previousPoint.x - movedWheel.x, dy = previousPoint.y - movedWheel.y;
    const from = Math.atan2(dy, dx) * 180 / Math.PI;
    await arc(driver, 1, movedWheel, from, from + 30, Math.hypot(dx, dy));
    await nearAngle(page, 90);
    await driver.cancelAll();
    await noHolds(page);
    await page.setViewportSize(viewport);
    await centered(page);
  },
  async 'viewport rotation clears holds, blocks portrait phones and permits fresh landscape input'({ page, driver, viewport }) {
    const wheel = await geometry(page);
    await driver.start(1, polar(wheel, -90));
    await driver.start(2, await buttonPoint(page, 'ArrowUp'));
    await arc(driver, 1, wheel, -90, -30);
    await nearAngle(page, 60);
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await noHolds(page);
    await driver.cancelAll();
    if (viewport.height <= 600) {
      assert.equal(await page.locator('.rotateHint').isVisible(), true);
      await page.keyboard.down('ArrowUp');
      await pedalHeld(page, 'ArrowUp', false);
      await page.keyboard.up('ArrowUp');
    }
    await page.setViewportSize(viewport);
    await frame(page);
    assert.equal(await page.locator('.rotateHint').isVisible(), false);
    const fresh = await geometry(page);
    await driver.start(3, polar(fresh, -90));
    await arc(driver, 3, fresh, -90, -45);
    await nearAngle(page, 45);
    await driver.end(3);
    await noHolds(page);
  },
};

async function mouseChecks(page) {
  const wheel = await geometry(page), start = polar(wheel, -90);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await wheelHeld(page, true);
  for (let degrees = -85; degrees <= 0; degrees += 5) {
    const point = polar(wheel, degrees);
    await page.mouse.move(point.x, point.y);
  }
  await nearAngle(page, 90);
  const outside = polar(wheel, -30, wheel.radius * 2);
  await page.mouse.move(outside.x, outside.y);
  await nearAngle(page, 60);
  await page.mouse.up();
  await wheelHeld(page, false);
  await centered(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'right' });
  await wheelHeld(page, false);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => Number(document.querySelector('.wheel').style.transform.match(/rotate\(([-\d.e+]+)deg\)/)?.[1]) > 30);
  await page.keyboard.up('ArrowRight');
  await centered(page);
}

for (const browserName of browsers) test(`${browserName}: real app browser regressions`, { timeout: 300_000 }, async t => {
  const browser = await ({ chromium, webkit }[browserName]).launch(browserName === 'chromium' ? { args: ['--enable-features=SyntheticPointerActions'] } : {});
  try {
    for (const viewport of viewports) await t.test(`${viewport.width}x${viewport.height} touch`, async t => {
      const name = `${browserName}-${viewport.width}x${viewport.height}`;
      const directory = resolve(artifacts, name);
      await mkdir(directory, { recursive: true });
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      // Keep browser checks offline and stable: the app's only remote assets are
      // optional Google fonts. Never replace or intercept any app JS/CSS.
      await context.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      let errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await loadApp(page);
        await page.screenshot({ path: resolve(directory, 'screenshot.png'), fullPage: true });
        for (const [title, run] of Object.entries(touchCases)) await t.test(title, async () => {
          errors = [];
          await loadApp(page);
          const driver = await touchDriver(page, browserName);
          try {
            await run({ page, driver, viewport });
            assert.deepEqual(errors, [], 'no uncaught browser errors');
            const viewportState = await page.evaluate(() => ({ x: scrollX, y: scrollY, scale: visualViewport?.scale ?? 1 }));
            assert.deepEqual(viewportState, { x: 0, y: 0, scale: 1 }, 'controls must not scroll or pinch-zoom the page');
          } catch (error) {
            await page.screenshot({ path: resolve(directory, `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-failure.png`), fullPage: true }).catch(() => {});
            throw error;
          } finally { await driver.dispose(); }
        });
      } finally {
        await context.tracing.stop({ path: resolve(directory, 'trace.zip') });
        await context.close();
      }
    });
    await t.test('desktop mouse and keyboard without Touch Events', async () => {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, hasTouch: false });
      await context.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(baseURL, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelector('.wheel')?.style.transform);
        await mouseChecks(page);
        const pedal = await buttonPoint(page, 'ArrowUp');
        await page.mouse.move(pedal.x, pedal.y);
        await page.mouse.down();
        await pedalHeld(page, 'ArrowUp', true);
        await page.mouse.move(1350, 10);
        await pedalHeld(page, 'ArrowUp', true);
        await page.mouse.up();
        await noHolds(page);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  } finally { await browser.close(); }
});
