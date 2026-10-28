import React from 'react';
import { SonarSensors } from '../types/simulation';
import { Maximize2, ShieldAlert } from 'lucide-react';

interface MirrorWidgetsProps {
  sonar: SonarSensors;
  onEnlargeMirror?: (mirror: 'left' | 'right' | 'rearview') => void;
  visible: boolean;
}

export const MirrorWidgets: React.FC<MirrorWidgetsProps> = ({
  sonar,
  onEnlargeMirror,
  visible,
}) => {
  if (!visible) return null;

  // Blind spot radar warning triggers when obstacle is nearby on side
  const leftBsmActive = sonar.rearLeft < 2.0 || sonar.frontLeft < 1.4;
  const rightBsmActive = sonar.rearRight < 2.0 || sonar.frontRight < 1.4;

  return (
    <>
      {/* 1. Center Rearview Mirror (Windshield Mount - 100% Full Outside Brightness) */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none">
        <div className="relative group p-1 bg-transparent rounded-2xl border-4 border-neutral-700/80 shadow-2xl ring-1 ring-white/25">
          {/* Mirror mounting bracket */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-8 h-3.5 bg-neutral-800 rounded-t-md border border-neutral-600 -z-10" />

          {/* WebGL Viewport Target Container (100% transparent, ZERO dimming) */}
          <div
            id="rearview-mirror-viewport"
            className="w-72 sm:w-[460px] md:w-[520px] h-24 sm:h-32 rounded-xl overflow-hidden bg-transparent relative border border-white/30"
          >
            {/* Header info */}
            <div className="absolute top-2 left-2.5 flex items-center gap-1.5 text-[10px] font-mono text-neutral-100 bg-neutral-950/80 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-semibold">REARVIEW MIRROR</span>
            </div>

            {/* Quick inspect button */}
            <button
              onClick={() => onEnlargeMirror?.('rearview')}
              className="absolute top-2 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 p-1.5 rounded-lg text-neutral-200 hover:text-white border border-white/10"
              title="Inspect Rearview Mirror"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Anti-glare tab at bottom */}
          <div className="w-8 h-2 mx-auto mt-1 bg-neutral-600 rounded-full border border-neutral-500/50" />
        </div>
      </div>

      {/* 2. Left Side Wing Mirror (Position swapped to right side of screen as requested) */}
      <div className="absolute top-24 right-4 z-20 pointer-events-auto select-none">
        <div className="relative group p-1 bg-transparent rounded-2xl border-4 border-neutral-700/80 shadow-2xl ring-1 ring-white/25">
          <div
            id="left-mirror-viewport"
            className="w-56 sm:w-72 md:w-80 h-36 sm:h-48 md:h-52 rounded-xl overflow-hidden bg-transparent relative border border-white/30"
          >
            {/* Header info */}
            <div className="absolute top-2 left-2.5 flex items-center gap-1.5 text-[10px] font-mono text-neutral-100 bg-neutral-950/80 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
              <span className="font-bold text-white">L-MIRROR</span>
              <span className="text-neutral-300 text-[9px]">· WIDE</span>
            </div>

            {/* Blind Spot Monitor (BSM) Warning LED */}
            <div
              className={`absolute top-2 right-2.5 px-2 py-0.5 rounded flex items-center gap-1.5 transition-all duration-200 border ${
                leftBsmActive
                  ? 'bg-amber-500 text-neutral-950 border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.9)] font-bold animate-pulse'
                  : 'bg-neutral-950/60 text-neutral-500 border-white/5'
              }`}
              title="Blind Spot Radar Detection"
            >
              <ShieldAlert size={12} />
              <span className="text-[9px] font-mono font-bold">BSM</span>
            </div>

            {/* Mirror Etching Warning text */}
            <div className="absolute bottom-1.5 left-2 right-2 text-center text-[9px] font-mono text-neutral-100 font-medium tracking-tight bg-neutral-950/60 py-0.5 rounded backdrop-blur-2xs pointer-events-none">
              OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR
            </div>

            <button
              onClick={() => onEnlargeMirror?.('left')}
              className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 p-1.5 rounded-lg text-neutral-200 hover:text-white border border-white/10"
              title="Inspect Left Mirror"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Side Wing Mirror (Position swapped to left side of screen as requested) */}
      <div className="absolute top-24 left-4 z-20 pointer-events-auto select-none">
        <div className="relative group p-1 bg-transparent rounded-2xl border-4 border-neutral-700/80 shadow-2xl ring-1 ring-white/25">
          <div
            id="right-mirror-viewport"
            className="w-56 sm:w-72 md:w-80 h-36 sm:h-48 md:h-52 rounded-xl overflow-hidden bg-transparent relative border border-white/30"
          >
            {/* Header info */}
            <div className="absolute top-2 left-2.5 flex items-center gap-1.5 text-[10px] font-mono text-neutral-100 bg-neutral-950/80 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
              <span className="font-bold text-white">R-MIRROR</span>
              <span className="text-amber-300 text-[9px]">· CONVEX</span>
            </div>

            {/* Blind Spot Monitor (BSM) Warning LED */}
            <div
              className={`absolute top-2 right-2.5 px-2 py-0.5 rounded flex items-center gap-1.5 transition-all duration-200 border ${
                rightBsmActive
                  ? 'bg-amber-500 text-neutral-950 border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.9)] font-bold animate-pulse'
                  : 'bg-neutral-950/60 text-neutral-500 border-white/5'
              }`}
              title="Blind Spot Radar Detection"
            >
              <ShieldAlert size={12} />
              <span className="text-[9px] font-mono font-bold">BSM</span>
            </div>

            {/* Mirror Etching Warning text */}
            <div className="absolute bottom-1.5 left-2 right-2 text-center text-[9px] font-mono text-neutral-100 font-medium tracking-tight bg-neutral-950/60 py-0.5 rounded backdrop-blur-2xs pointer-events-none">
              OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR
            </div>

            <button
              onClick={() => onEnlargeMirror?.('right')}
              className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 p-1.5 rounded-lg text-neutral-200 hover:text-white border border-white/10"
              title="Inspect Right Mirror"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
