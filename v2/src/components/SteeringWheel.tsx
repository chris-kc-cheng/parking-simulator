import React, { useEffect, useRef, useState } from 'react';

const MAX_DEG = 135; // full lock either way

// Drag around the hub to turn (clockwise = right). Springs back to centre on release.
export const SteeringWheel: React.FC<{ onSteer: (value: number) => void }> = ({ onSteer }) => {
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
      className="m-wheel m-glass rounded-full select-none"
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
        <circle r="44" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <path d="M-40 4 L-12 4 M40 4 L12 4 M0 12 L0 42" stroke="#e5e7eb" strokeWidth="7" strokeLinecap="round" />
        <circle r="12" fill="#1e3a5f" stroke="#e5e7eb" strokeWidth="3" />
        <rect x="-3" y="-48" width="6" height="12" rx="2" fill="#f59e0b" />
      </svg>
    </div>
  );
};
