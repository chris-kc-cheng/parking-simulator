import React from 'react';
import { LookGlance, VehicleState, SonarSensors } from '../types/simulation';
import { Gauge, RotateCcw, RotateCw, AlertOctagon } from 'lucide-react';

interface CockpitOverlayProps {
  state: VehicleState;
  sonar: SonarSensors;
  currentGlance: LookGlance;
  onSelectGlance: (glance: LookGlance) => void;
  hadRecentCollision: boolean;
}

export const CockpitOverlay: React.FC<CockpitOverlayProps> = ({
  state,
  sonar,
  currentGlance,
  onSelectGlance,
  hadRecentCollision,
}) => {
  const speedKmh = Math.abs(state.speed * 3.6);
  // Negative steering angle = Left, Positive = Right
  const steerDeg = Math.round((state.steeringAngle * 180) / Math.PI);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10">
      {/* Collision Alert Banner */}
      {hadRecentCollision && (
        <div className="absolute inset-0 bg-red-600/30 pointer-events-none animate-pulse flex items-center justify-center">
          <div className="bg-red-950/95 border border-red-500 rounded-xl px-5 py-2.5 flex items-center gap-2 text-red-100 font-semibold shadow-2xl">
            <AlertOctagon className="text-red-400" size={22} />
            <span>COLLISION DETECTED - USE UP/DOWN TO MOVE AWAY</span>
          </div>
        </div>
      )}

      {/* Relocated Over-Shoulder Glance Bar: Positioned above the center infotainment console */}
      {/* Completely free of the top rearview mirror with zero overlap! */}
      <div className="absolute bottom-[234px] left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 p-1.5 bg-neutral-950/90 backdrop-blur-md rounded-2xl border border-white/20 text-xs shadow-2xl">
        {/* Hold: Left Over Shoulder */}
        <button
          onMouseDown={() => onSelectGlance('over-shoulder-left')}
          onMouseUp={() => onSelectGlance('center')}
          onMouseLeave={() => {
            if (currentGlance === 'over-shoulder-left') onSelectGlance('center');
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSelectGlance('over-shoulder-left');
          }}
          onTouchEnd={() => onSelectGlance('center')}
          className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 select-none ${
            currentGlance === 'over-shoulder-left'
              ? 'bg-amber-600 text-white shadow-[0_0_16px_rgba(245,158,11,0.8)] scale-105'
              : 'bg-neutral-900/90 text-amber-300 hover:bg-neutral-800 border border-amber-500/40'
          }`}
          title="HOLD to Look Over Left Shoulder (Release to Return)"
        >
          <RotateCcw size={14} />
          <span className="font-semibold">Hold: Left Shoulder</span>
          <span className="text-[9px] font-mono text-amber-400/80 ml-1">Q</span>
        </button>

        {/* Hold: Right Over Shoulder */}
        <button
          onMouseDown={() => onSelectGlance('over-shoulder-right')}
          onMouseUp={() => onSelectGlance('center')}
          onMouseLeave={() => {
            if (currentGlance === 'over-shoulder-right') onSelectGlance('center');
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onSelectGlance('over-shoulder-right');
          }}
          onTouchEnd={() => onSelectGlance('center')}
          className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 select-none ${
            currentGlance === 'over-shoulder-right'
              ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.8)] scale-105'
              : 'bg-neutral-900/90 text-emerald-300 hover:bg-neutral-800 border border-emerald-500/40'
          }`}
          title="HOLD to Look Over Right Shoulder (Release to Return)"
        >
          <RotateCw size={14} />
          <span className="font-semibold">Hold: Right Shoulder</span>
          <span className="text-[9px] font-mono text-emerald-400/80 ml-1">E</span>
        </button>
      </div>

      {/* Driver Digital Gauge Cluster (Mounted on bottom-left) */}
      <div className="absolute bottom-6 left-6 pointer-events-auto hidden md:flex flex-col gap-2 p-3 bg-neutral-950/90 backdrop-blur-md rounded-2xl border border-white/15 shadow-2xl w-64">
        <div className="flex items-center justify-between text-neutral-400 text-xs border-b border-white/10 pb-1.5">
          <span className="flex items-center gap-1.5 font-medium text-neutral-200">
            <Gauge size={14} className="text-blue-400" />
            INSTRUMENT CLUSTER
          </span>
          <span className="font-mono text-[10px] text-emerald-400">READY</span>
        </div>

        {/* Speedometer & Gear Display */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {speedKmh.toFixed(0)}
              <span className="text-xs font-normal text-neutral-400 ml-1">KM/H</span>
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              {(speedKmh * 0.621371).toFixed(0)} MPH
            </div>
          </div>

          <div className="flex items-center gap-1 bg-neutral-900/95 p-1 rounded-xl border border-white/10">
            {(['P', 'R', 'N', 'D'] as const).map((g) => (
              <span
                key={g}
                className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-xs rounded-lg transition-all ${
                  state.gear === g
                    ? g === 'R'
                      ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                      : g === 'D'
                      ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                      : 'bg-blue-600 text-white shadow-md'
                    : 'text-neutral-500'
                }`}
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Steering Angle Meter & Sonar Proximity */}
        <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-neutral-400">STEERING:</span>
            <span
              className={`font-semibold ${
                Math.abs(steerDeg) < 3 ? 'text-emerald-400' : 'text-neutral-200'
              }`}
            >
              {steerDeg < -2 ? `${Math.abs(steerDeg)}° LEFT` : steerDeg > 2 ? `${steerDeg}° RIGHT` : '0° CENTER'}
            </span>
          </div>

          <div className="w-full h-1.5 bg-neutral-800 rounded-full relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 -translate-x-1/2" />
            <div
              className="absolute top-0 bottom-0 bg-blue-500 transition-all duration-75"
              style={{
                left: steerDeg < 0 ? `${50 + (steerDeg / 35) * 50}%` : '50%',
                width: `${(Math.abs(steerDeg) / 35) * 50}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400 pt-1">
            <span>RPM: {state.engineRPM}</span>
            <span>
              OBSTACLE:{' '}
              <strong
                className={
                  sonar.closestDistance < 0.4
                    ? 'text-red-400 animate-pulse'
                    : sonar.closestDistance < 1.0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {sonar.closestDistance < 3.5 ? `${sonar.closestDistance.toFixed(2)}m` : 'CLEAR'}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
