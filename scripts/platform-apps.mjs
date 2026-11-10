import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REGISTRY = 'https://apps.hedgies.cloud/app.json';
const MAX_BYTES = 512_000;
function privateIP(ip) {
  if (isIP(ip) === 6) return !ip.startsWith('2') && !ip.startsWith('3');
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
async function read(address, redirects = 0) {
  const url = new URL(address);
  if (url.protocol !== 'https:' || url.username || url.password || redirects > 4) throw new Error('Invalid public URL');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateIP(address))) throw new Error('Private address refused');
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  if ([301, 302, 303, 307, 308].includes(response.status)) return read(new URL(response.headers.get('location'), url), redirects + 1);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let text = '', bytes = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error('Response too large');
    text += decoder.decode(chunk, { stream: true });
  }
  return { text: text + decoder.decode(), url: response.url };
}
function href(value, base) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value.replaceAll('&amp;', '&'), base); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
function links(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => Object.fromEntries(
    [...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), value])
  ));
}
async function describe(entry) {
  const result = { id: entry.id, url: entry.url, name: entry.id, icon: null };
  try {
    const page = await read(entry.url);
    const tags = links(page.text);
    const apple = href(tags.find(tag => tag.rel === 'apple-touch-icon')?.href, page.url);
    result.icon = apple;
    const title = page.text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    if (title) result.name = title;
    const address = href(tags.find(tag => tag.rel === 'manifest')?.href, page.url);
    if (address) {
      const response = await read(address);
      const manifest = JSON.parse(response.text);
      result.name = manifest.short_name || manifest.name || result.name;
      const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
      const icon = icons.find(icon => icon.sizes === '192x192') || icons.find(icon => href(icon.src, response.url));
      result.icon = href(icon?.src, response.url) || apple;
    }
  } catch { /* Keep unreadable apps in the registry with their ID/initial. */ }
  return result;
}
export async function writePlatformApps(destination) {
  let apps;
  try {
    const registry = JSON.parse((await read(REGISTRY)).text);
    if (!Array.isArray(registry)) throw new Error('Invalid registry');
    const seen = new Set();
    const entries = registry.filter(entry => {
      if (!entry || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id) || seen.has(entry.id) || !href(entry.url)) return false;
      seen.add(entry.id); return true;
    }).slice(0, 24);
    // Keep all IDs here. Each app excludes itself in its own UI.
    apps = await Promise.all(entries.map(describe));
  } catch (error) {
    console.warn('Registry unavailable; retaining the last published list:', error.message);
    apps = JSON.parse((await read('https://chris-kc-cheng.github.io/parking-simulator/v2/apps.json')).text);
    if (!Array.isArray(apps)) throw new Error('No valid saved registry');
  }
  await writeFile(destination, JSON.stringify(apps, null, 2) + '\n');
  console.log(`Refreshed ${apps.length} platform apps from ${REGISTRY}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writePlatformApps(process.argv[2] || 'dist/v2/apps.json');
}
