import React from 'react';
import { X, Keyboard, Compass } from 'lucide-react';

interface ControlsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ControlsHelpModal: React.FC<ControlsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Keyboard className="text-blue-400" size={18} />
            <h2 className="text-base font-bold text-white">Simplified Driver Controls</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Controls list */}
          <div className="grid grid-cols-2 gap-2 bg-neutral-950/60 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Drive Forward</span>
              <kbd className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 font-mono text-[11px] rounded border border-emerald-500/30">
                W / ↑
              </kbd>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Drive Reverse</span>
              <kbd className="px-2 py-0.5 bg-red-950/80 text-red-300 font-mono text-[11px] rounded border border-red-500/30">
                S / ↓
              </kbd>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Steer Wheels</span>
              <kbd className="px-2 py-0.5 bg-neutral-800 rounded text-neutral-200 font-mono text-[11px] border border-white/10">
                A / D or ← / →
              </kbd>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Park Lock (P)</span>
              <kbd className="px-2 py-0.5 bg-blue-950/80 text-blue-300 font-mono text-[11px] rounded border border-blue-500/30">
                SPACE / P
              </kbd>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Hold: Left Shoulder</span>
              <kbd className="px-2 py-0.5 bg-amber-950/80 text-amber-300 font-mono text-[11px] rounded border border-amber-500/30">
                HOLD Q
              </kbd>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-neutral-900/60 rounded-lg">
              <span className="text-neutral-300 font-medium">Hold: Right Shoulder</span>
              <kbd className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 font-mono text-[11px] rounded border border-emerald-500/30">
                HOLD E
              </kbd>
            </div>
          </div>

          {/* Episode 1 Strategy: How to Back In Park */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Compass size={14} className="text-blue-400" />
              Integrated Cockpit Parking Assistance
            </h3>
            <div className="space-y-1.5 text-neutral-300 bg-neutral-950/40 p-3 rounded-xl border border-white/5 leading-relaxed">
              <p>
                <strong>1. Three Fully Bright Mirrors:</strong> Check left wing, right convex fisheye, and center rearview mirrors for surrounding cars and stall lines.
              </p>
              <p>
                <strong>2. Mirror Backup Camera:</strong> Integrated into the center console, showing dynamic trajectory guidelines that curve in real-time as you steer.
              </p>
              <p>
                <strong>3. 3D Bird's Eye View:</strong> Shows real-time overhead vehicle position relative to the stall and nearby cars.
              </p>
              <p>
                <strong>4. Easy Driving:</strong> Hold <strong>Down (S)</strong> to reverse into the bay, use <strong>Up (W)</strong> to pull forward if needed. When parked inside, press <strong>P</strong> or <strong>Space</strong>!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            Ready to Drive
          </button>
        </div>
      </div>
    </div>
  );
};
