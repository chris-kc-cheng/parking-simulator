export const APP_ID = 'parking-simulator';
export const APPS_URL = import.meta.env.VITE_APPS_URL || 'https://apps.hedgies.cloud/app.json';
export type PlatformApp = { id: string; url: string; name: string; icon: string | null };
const CACHE_KEY = 'parking-platform-apps-v1';

function httpsURL(value: unknown, base?: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Exclude this app by its stable registry ID, including when hosted elsewhere.
export function parseApps(value: unknown): PlatformApp[] {
  if (!Array.isArray(value)) throw new Error('Invalid app registry');
  const seen = new Set<string>();
  return value.flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id)) return [];
    const url = httpsURL(entry.url);
    if (!url || entry.id === APP_ID || seen.has(entry.id)) return [];
    seen.add(entry.id);
    return [{ id: entry.id, url, name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : entry.id,
      icon: httpsURL(entry.icon, url) }];
  });
}

async function json(url: string) {
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('App list unavailable');
  return response.json();
}

async function enrich(app: PlatformApp): Promise<PlatformApp> {
  if (app.name !== app.id && app.icon) return app;
  try {
    const response = await fetch(app.url, { credentials: 'omit', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return app;
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const base = response.url || app.url;
    const manifestURL = httpsURL(doc.querySelector('link[rel="manifest"]')?.getAttribute('href'), base);
    const appleIcon = httpsURL(doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'), base);
    const manifest = manifestURL ? await json(manifestURL) : {};
    const icon = Array.isArray(manifest.icons) ? manifest.icons.find((i: { src?: string }) => httpsURL(i.src, manifestURL!)) : null;
    return { ...app, name: manifest.short_name || manifest.name || doc.title || app.name,
      icon: app.icon || appleIcon || httpsURL(icon?.src, manifestURL || base) };
  } catch { return app; } // Unreadable apps still appear with an initial.
}

export function cachedApps(): PlatformApp[] | null {
  try { const value = localStorage.getItem(CACHE_KEY); return value ? parseApps(JSON.parse(value)) : null; }
  catch { return null; }
}

export async function loadApps(): Promise<PlatformApp[]> {
  let registry;
  try { registry = await json(APPS_URL); }
  catch { registry = await json(new URL('./apps.json', document.baseURI).href); }
  const apps = await Promise.all(parseApps(registry).map(enrich));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(apps)); } catch { /* Storage may be unavailable. */ }
  return apps;
}
