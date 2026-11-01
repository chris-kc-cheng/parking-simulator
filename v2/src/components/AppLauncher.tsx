import { useEffect, useRef, useState } from 'react';
import { cachedApps, loadApps, type PlatformApp } from '../utils/platformApps';

function Tile({ app, close }: { app: PlatformApp; close: () => void }) {
  const [broken, setBroken] = useState(false);
  return <a role="menuitem" className="parking-launcher-tile" href={app.url} target="_blank" rel="noopener noreferrer" onClick={close}>
    {app.icon && !broken ? <img src={app.icon} alt="" width="48" height="48" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      : <span className="parking-launcher-initial" aria-hidden="true">{app.name.charAt(0).toUpperCase()}</span>}
    <span>{app.name}<span className="sr-only"> (opens in a new tab)</span></span>
  </a>;
}

export default function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<PlatformApp[] | null>(cachedApps);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const load = () => {
    setLoading(true); setFailed(false);
    loadApps().then(list => { if (active.current) setApps(list); }).catch(() => { if (active.current) setFailed(true); })
      .finally(() => { if (active.current) setLoading(false); });
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  return <div ref={box} className="parking-launcher" onKeyDown={event => {
    event.stopPropagation();
    if (!open || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...box.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }} onKeyUp={event => event.stopPropagation()}>
    <button ref={button} type="button" aria-label="Apps" title="Apps" aria-haspopup="menu" aria-expanded={open}
      className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-lg border border-white/5"
      onClick={() => { if (!open && !loading) load(); setOpen(!open); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {[5, 12, 19].flatMap(y => [5, 12, 19].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" />))}
      </svg>
    </button>
    {open && <div role="menu" aria-label="Apps" className="parking-launcher-menu" onBlur={event => {
      if (event.relatedTarget && !box.current?.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      {loading && apps === null && <p role="status">Loading apps…</p>}
      {failed && <p role="alert">{apps ? 'Showing the last saved app list. ' : 'The app list could not be loaded. '}
        <button type="button" onClick={load} className="underline">Try again</button></p>}
      {apps?.length === 0 && <p>No other apps are listed.</p>}
      {apps?.map(app => <Tile key={app.id} app={app} close={() => setOpen(false)} />)}
    </div>}
  </div>;
}
