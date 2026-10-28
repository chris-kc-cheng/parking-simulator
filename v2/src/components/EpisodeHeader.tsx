import React from 'react';
import { Volume2, VolumeX, RotateCcw, HelpCircle } from 'lucide-react';
import { CameraViewMode } from '../types/simulation';

interface EpisodeHeaderProps {
  viewMode: CameraViewMode;
  onSelectViewMode: (mode: CameraViewMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  onToggleHelp: () => void;
}

export const EpisodeHeader: React.FC<EpisodeHeaderProps> = ({
  viewMode,
  onSelectViewMode,
  isMuted,
  onToggleMute,
  onRestart,
  onToggleHelp,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 bg-neutral-950/80 backdrop-blur-md border-b border-white/10 select-none">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          PrecisionPark 3D
        </span>
        <span className="text-xs text-neutral-400 hidden sm:inline">
          · Episode 01: Back-In Bay Parking
        </span>
      </div>

      {/* Zone 2: Navigation & View Mode: ONLY Cockpit View and Exterior Chase */}
      <nav className="flex items-center gap-1.5 p-1 bg-neutral-900/90 rounded-lg border border-white/10 text-xs">
        <button
          onClick={() => onSelectViewMode('cockpit')}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            viewMode === 'cockpit'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Driver Cockpit Perspective (Mirrors, Backup Cam & Bird's Eye View)"
        >
          Driver Cockpit
        </button>
        <button
          onClick={() => onSelectViewMode('exterior')}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            viewMode === 'exterior'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Exterior Chase Camera"
        >
          Exterior View
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        <a href="../v1/" className="px-2 py-1 text-xs text-neutral-300 hover:text-white" title="Play original version">V1</a>
        <button
          onClick={onToggleHelp}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-lg transition-colors border border-white/5"
          title="Controls Guide"
          aria-label="Controls Guide"
        >
          <HelpCircle size={16} />
        </button>
        <button
          onClick={onToggleMute}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-lg transition-colors border border-white/5"
          title={isMuted ? 'Unmute Audio' : 'Mute Engine & Sonar Audio'}
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} />}
        </button>
        <button
          onClick={onRestart}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 rounded-lg border border-white/10 transition-colors whitespace-nowrap"
          title="Reset Car Position & Restart Episode"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
