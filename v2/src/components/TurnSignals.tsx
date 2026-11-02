import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { soundEngine } from '../utils/audio';

export type Signal = 'left' | 'right' | null;

// Flashing indicators with a relay tick while a signal is active.
export const TurnSignals: React.FC<{ signal: Signal; mobile?: boolean }> = ({ signal, mobile = false }) => {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!signal) { setLit(false); return; }
    let on = true;
    setLit(true); soundEngine.playSignalTick(true);
    const id = window.setInterval(() => {
      on = !on; setLit(on); soundEngine.playSignalTick(on);
    }, 380);
    return () => window.clearInterval(id);
  }, [signal]);
  const arrow = (side: 'left' | 'right') => {
    const active = signal === side && lit;
    const Icon = side === 'left' ? ArrowLeft : ArrowRight;
    return <Icon aria-label={`${side} turn signal${signal === side ? ' on' : ''}`} size={mobile ? 22 : 28} strokeWidth={3}
      className={active ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'text-neutral-600'} />;
  };
  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-6 pointer-events-none select-none"
      style={{ top: mobile ? 'calc(14dvh + 34px)' : '13.5rem' }}>
      {arrow('left')}{arrow('right')}
    </div>
  );
};
