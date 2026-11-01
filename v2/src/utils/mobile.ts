import { useEffect, useState } from 'react';

// Touch-first phones and small tablets. Desktop layout is never affected.
const TOUCH = '(pointer: coarse) and (hover: none)';

export type DeviceLayout = { mobile: boolean; portrait: boolean };

function read(): DeviceLayout {
  const mobile = window.matchMedia(TOUCH).matches && Math.min(window.screen.width, window.screen.height) <= 900;
  return { mobile, portrait: window.innerHeight > window.innerWidth };
}

export function useDeviceLayout(): DeviceLayout {
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const update = () => setLayout(prev => {
      const next = read();
      return prev.mobile === next.mobile && prev.portrait === next.portrait ? prev : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return layout;
}

export function isFullscreen() {
  return !!document.fullscreenElement || (navigator as { standalone?: boolean }).standalone === true;
}

// Must be called from a user gesture. Browsers without the API (iPhone Safari) ignore it;
// installing to the home screen gives them the full-screen experience instead.
export async function enterFullscreenLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch { /* Not supported or denied; the rotate prompt still works. */ }
}
