import React, { useEffect, useRef, useState } from 'react';

const MAX_DEG = 135; // full lock either way

// Drag around the hub to turn (clockwise = right). Springs back to centre on release.
export const SteeringWheel: React.FC<{ onSteer: (value: number) => void; onHorn: (on: boolean) => void }> = ({ onSteer, onHorn }) => {
  const box = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const last = useRef<number | null>(null);
  const raf = useRef(0);
  const [deg, setDeg] = useState(0);

  const apply = (value: number) => {
    rot.current = Math.max(-MAX_DEG, Math.min(MAX_DEG, value));
    setDeg(rot.current);
    onSteer(rot.current / MAX_DEG);
  };
  const angle = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const release = () => {
    last.current = null;
    cancelAnimationFrame(raf.current);
    let t0 = performance.now();
    const back = (t: number) => {
      const dt = Math.min((t - t0) / 1000, 0.1); t0 = t;
      apply(Math.abs(rot.current) < 1 ? 0 : rot.current * Math.exp(-dt * 12));
      if (rot.current !== 0) raf.current = requestAnimationFrame(back);
    };
    raf.current = requestAnimationFrame(back);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div ref={box} role="slider" aria-label="Steering wheel" aria-valuemin={-MAX_DEG} aria-valuemax={MAX_DEG} aria-valuenow={Math.round(deg)}
      className="m-wheel m-glass rounded-full select-none relative"
      style={{ touchAction: 'none' }}
      onPointerDown={e => {
        cancelAnimationFrame(raf.current);
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = angle(e);
      }}
      onPointerMove={e => {
        if (last.current === null) return;
        const now = angle(e);
        let d = now - last.current;
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        last.current = now;
        apply(rot.current + d);
      }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <svg viewBox="-50 -50 100 100" className="w-full h-full pointer-events-none" style={{ transform: `rotate(${deg}deg)` }} aria-hidden="true">
        <circle r="44" fill="none" stroke="#9ca3af" strokeWidth="10.5" />
        <circle r="44" fill="none" stroke="#0a0a0a" strokeWidth="8" />
        <path d="M-40 4 L-12 4 M40 4 L12 4 M0 12 L0 42" stroke="#9ca3af" strokeWidth="9.5" strokeLinecap="round" />
        <path d="M-40 4 L-12 4 M40 4 L12 4 M0 12 L0 42" stroke="#0a0a0a" strokeWidth="7" strokeLinecap="round" />
        <circle r="15" fill="#0a0a0a" stroke="#9ca3af" strokeWidth="1.5" />
        <rect x="-3" y="-48" width="6" height="12" rx="2" fill="#f59e0b" />
      </svg>
      <button type="button" aria-label="Horn" title="Horn (H)"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full text-[8px] font-bold text-neutral-300 active:bg-neutral-700"
        style={{ touchAction: 'none' }}
        onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); onHorn(true); }}
        onPointerUp={e => { e.stopPropagation(); onHorn(false); }}
        onPointerCancel={() => onHorn(false)} onLostPointerCapture={() => onHorn(false)}
        onContextMenu={e => e.preventDefault()}>
        HORN
      </button>
    </div>
  );
};
