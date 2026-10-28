import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
// Serve under a repository prefix to catch asset paths that break on Pages.
const prefix = '/parking-simulator';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(`${prefix}/`)) { res.writeHead(404).end(); return; }
    let path = resolve(root, `.${decodeURIComponent(url.pathname.slice(prefix.length))}`);
    if (!path.startsWith(`${root}${sep}`) && path !== root) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
      path = resolve(path, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
    args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  await page.goto(`${base}/?source=smoke#cockpit`);
  await page.waitForURL(`${base}/v2/?source=smoke#cockpit`);
  await page.getByRole('button', { name: 'Driver Cockpit', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(c => c.width > 0 && c.height > 0));
  await page.getByRole('button', { name: 'Exterior View', exact: true }).click();
  await page.getByRole('button', { name: 'Driver Cockpit', exact: true }).click();
  await page.getByTitle('Controls Guide').click();
  await page.getByRole('button', { name: 'Ready to Drive', exact: true }).click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  await page.getByTitle('Reset Car Position & Restart Episode').click();
  await page.waitForTimeout(1000);
  if (process.env.UPDATE_SCREENSHOT) await page.screenshot({ path: 'screenshot.png' });
  await page.goto(`${base}/v2`);
  await page.getByRole('button', { name: 'Driver Cockpit', exact: true }).waitFor();
  await page.getByRole('link', { name: 'V1', exact: true }).click();
  await page.locator('.wheel').waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Passed: default redirect, repository prefix, v2 route, cameras, help, input, reset, v1 switch; no page errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
