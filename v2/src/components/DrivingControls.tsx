import React from 'react';
import { VehicleInputs } from '../types/simulation';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

interface DrivingControlsProps {
  inputs: VehicleInputs;
  onSetInput: <K extends keyof VehicleInputs>(key: K, value: VehicleInputs[K]) => void;
  onTogglePark: () => void;
}

export const DrivingControls: React.FC<DrivingControlsProps> = ({
  inputs,
  onSetInput,
  onTogglePark,
}) => {
  return (
    <div className="absolute bottom-6 right-6 z-20 pointer-events-auto flex items-end gap-3 select-none">
      {/* 1. Steering Buttons (Left / Right with auto-return on release) */}
      <div className="flex items-center gap-1.5 bg-neutral-950/90 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl">
        <button
          onMouseDown={() => onSetInput('steer', -1)}
          onMouseUp={() => onSetInput('steer', 0)}
          onMouseLeave={() => {
            if (inputs.steer < 0) onSetInput('steer', 0);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSetInput('steer', -1);
          }}
          onTouchEnd={() => onSetInput('steer', 0)}
          className={`w-14 h-20 rounded-xl flex flex-col items-center justify-center transition-all ${
            inputs.steer < -0.2
              ? 'bg-blue-600 text-white shadow-lg scale-95'
              : 'bg-neutral-900 text-neutral-200 hover:bg-neutral-800 border border-white/5'
          }`}
          title="Steer Left (A / Left Arrow)"
        >
          <ChevronLeft size={24} />
          <span className="text-[10px] font-mono font-bold mt-1">LEFT</span>
          <span className="text-[8px] font-mono text-neutral-400">A / ←</span>
        </button>

        <button
          onMouseDown={() => onSetInput('steer', 1)}
          onMouseUp={() => onSetInput('steer', 0)}
          onMouseLeave={() => {
            if (inputs.steer > 0) onSetInput('steer', 0);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSetInput('steer', 1);
          }}
          onTouchEnd={() => onSetInput('steer', 0)}
          className={`w-14 h-20 rounded-xl flex flex-col items-center justify-center transition-all ${
            inputs.steer > 0.2
              ? 'bg-blue-600 text-white shadow-lg scale-95'
              : 'bg-neutral-900 text-neutral-200 hover:bg-neutral-800 border border-white/5'
          }`}
          title="Steer Right (D / Right Arrow)"
        >
          <ChevronRight size={24} />
          <span className="text-[10px] font-mono font-bold mt-1">RIGHT</span>
          <span className="text-[8px] font-mono text-neutral-400">D / →</span>
        </button>
      </div>

      {/* 2. Park / Lock Wheel Button */}
      <button
        onClick={onTogglePark}
        className={`w-14 h-24 rounded-2xl flex flex-col items-center justify-center transition-all border shadow-2xl ${
          inputs.park
            ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_16px_rgba(37,99,235,0.7)]'
            : 'bg-neutral-950/90 backdrop-blur-md border-white/15 text-neutral-300 hover:text-white hover:border-white/30'
        }`}
        title="Shift to Park / Lock Brakes (Spacebar or P)"
      >
        <Lock size={20} className={inputs.park ? 'animate-bounce' : ''} />
        <span className="text-xs font-mono font-bold mt-1">PARK</span>
        <span className="text-[8px] font-mono text-neutral-400">SPACE / P</span>
      </button>

      {/* 3. Simplified Drive Buttons: UP for Forward Acceleration, DOWN for Reverse */}
      <div className="flex flex-col gap-2 bg-neutral-950/90 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl">
        {/* UP BUTTON: Acceleration Forward */}
        <button
          onMouseDown={() => {
            onSetInput('park', false);
            onSetInput('forward', true);
            onSetInput('reverse', false);
          }}
          onMouseUp={() => onSetInput('forward', false)}
          onMouseLeave={() => {
            if (inputs.forward) onSetInput('forward', false);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSetInput('park', false);
            onSetInput('forward', true);
            onSetInput('reverse', false);
          }}
          onTouchEnd={() => onSetInput('forward', false)}
          className={`w-20 h-16 rounded-xl flex flex-col items-center justify-center transition-all ${
            inputs.forward
              ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.7)] scale-95'
              : 'bg-neutral-900 text-emerald-300 hover:bg-neutral-800 border border-emerald-500/30'
          }`}
          title="Drive / Accelerate Forward (W / Up Arrow)"
        >
          <ArrowUp size={22} />
          <span className="text-[11px] font-mono font-bold mt-0.5">FORWARD</span>
          <span className="text-[8px] font-mono text-neutral-400">W / ↑</span>
        </button>

        {/* DOWN BUTTON: Reverse */}
        <button
          onMouseDown={() => {
            onSetInput('park', false);
            onSetInput('reverse', true);
            onSetInput('forward', false);
          }}
          onMouseUp={() => onSetInput('reverse', false)}
          onMouseLeave={() => {
            if (inputs.reverse) onSetInput('reverse', false);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSetInput('park', false);
            onSetInput('reverse', true);
            onSetInput('forward', false);
          }}
          onTouchEnd={() => onSetInput('reverse', false)}
          className={`w-20 h-16 rounded-xl flex flex-col items-center justify-center transition-all ${
            inputs.reverse
              ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(239,68,68,0.7)] scale-95'
              : 'bg-neutral-900 text-red-300 hover:bg-neutral-800 border border-red-500/30'
          }`}
          title="Drive / Back In Reverse (S / Down Arrow)"
        >
          <ArrowDown size={22} />
          <span className="text-[11px] font-mono font-bold mt-0.5">REVERSE</span>
          <span className="text-[8px] font-mono text-neutral-400">S / ↓</span>
        </button>
      </div>
    </div>
  );
};
