import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ParkingEvaluation } from '../types/simulation';
import { Award, CheckCircle2, XCircle, RotateCcw, ArrowRight, ShieldCheck, Crosshair } from 'lucide-react';

interface EvaluationModalProps {
  evaluation: ParkingEvaluation;
  onRestart: () => void;
  onNextEpisode: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  evaluation,
  onRestart,
  onNextEpisode,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && evaluation.isParkedSuccessfully && evaluation.score >= 80) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#22c55e', '#facc15', '#a855f7'],
      });
    }
  }, [isOpen, evaluation.isParkedSuccessfully, evaluation.score]);

  if (!isOpen) return null;

  const isSuccess = evaluation.isParkedSuccessfully && evaluation.collisions === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Rating Badge */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center border font-mono font-bold text-2xl ${
                evaluation.rating === 'S'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : evaluation.rating === 'A'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : evaluation.rating === 'B'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : evaluation.rating === 'C'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-red-500/20 border-red-500/50 text-red-400'
              }`}
            >
              {evaluation.rating === 'Failed' ? 'F' : evaluation.rating}
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isSuccess ? 'Back-In Parking Completed!' : 'Parking Attempt Finished'}
              </h2>
              <p className="text-xs text-neutral-400">
                Episode 01: Back-In Bay Parking Precision Assessment
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-white tabular-nums">
              {evaluation.score}
              <span className="text-xs font-normal text-neutral-400 ml-0.5">/100</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-400">PRECISION SCORE</div>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="mt-6 space-y-2.5 bg-neutral-950/70 p-3.5 rounded-xl border border-white/5 text-xs">
          {/* Centering / Lateral Offset */}
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Crosshair size={13} className="text-blue-400" />
              Center Line Lateral Offset
            </span>
            <span className="font-mono font-semibold text-white tabular-nums">
              {evaluation.lateralOffsetCm.toFixed(1)} cm
              <span className="text-[10px] text-neutral-400 font-normal ml-1">
                {evaluation.lateralOffsetCm < 15 ? '(Excellent)' : evaluation.lateralOffsetCm < 30 ? '(Good)' : '(Off Center)'}
              </span>
            </span>
          </div>

          {/* Parallel Heading Deviation */}
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" />
              Angle Alignment Error
            </span>
            <span className="font-mono font-semibold text-white tabular-nums">
              {evaluation.headingErrorDeg.toFixed(1)}°
              <span className="text-[10px] text-neutral-400 font-normal ml-1">
                {evaluation.headingErrorDeg < 2.0 ? '(Parallel)' : evaluation.headingErrorDeg < 4.5 ? '(Acceptable)' : '(Crooked)'}
              </span>
            </span>
          </div>

          {/* Depth to Wheel Stop */}
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Award size={13} className="text-amber-400" />
              Distance to Wheel Stop
            </span>
            <span className="font-mono font-semibold text-white tabular-nums">
              {(evaluation.distanceToCurbM * 100).toFixed(0)} cm
              <span className="text-[10px] text-neutral-400 font-normal ml-1">
                {evaluation.distanceToCurbM >= 0.2 && evaluation.distanceToCurbM <= 0.45 ? '(Optimal)' : '(Adjust Depth)'}
              </span>
            </span>
          </div>

          {/* Collisions */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-neutral-400">Impacts / Collisions</span>
            <span
              className={`font-mono font-semibold tabular-nums flex items-center gap-1 ${
                evaluation.collisions === 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {evaluation.collisions === 0 ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {evaluation.collisions}
            </span>
          </div>

          {/* Shifts & Time */}
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Gear Shifts / Time</span>
            <span className="font-mono text-neutral-300 tabular-nums">
              {evaluation.gearShifts} shifts · {evaluation.elapsedSeconds}s
            </span>
          </div>
        </div>

        {/* Guidance Summary */}
        <div className="mt-4 p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-xs text-blue-200">
          <p className="font-medium text-white mb-0.5">Examiner Note:</p>
          <p className="text-neutral-300">{evaluation.guidanceMessage}</p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onRestart}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border border-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            <span>Try Again</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onNextEpisode();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-md shadow-blue-600/30 transition-colors flex items-center justify-center gap-2"
          >
            <span>Next Challenge</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
