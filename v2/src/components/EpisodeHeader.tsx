import AppLauncher from './AppLauncher';
import React, { useState } from 'react';
import { Volume2, VolumeX, RotateCcw, HelpCircle, Menu, X } from 'lucide-react';
import { CameraViewMode } from '../types/simulation';
import { EPISODES, EpisodeId } from '../episodes';

interface EpisodeHeaderProps {
  viewMode: CameraViewMode;
  onSelectViewMode: (mode: CameraViewMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  onToggleHelp: () => void;
  episode: EpisodeId;
  onSelectEpisode: (episode: EpisodeId) => void;
  mobile?: boolean;
}

export const EpisodeHeader: React.FC<EpisodeHeaderProps> = ({
  viewMode,
  onSelectViewMode,
  isMuted,
  onToggleMute,
  onRestart,
  onToggleHelp,
  episode,
  onSelectEpisode,
  mobile = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  if (mobile) {
    const act = (fn: () => void) => () => { setMenuOpen(false); fn(); };
    const row = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-100 hover:bg-neutral-800 text-left';
    return (
      <header className="absolute z-40 select-none" style={{ top: 'max(8px, env(safe-area-inset-top))', left: 'max(8px, env(safe-area-inset-left))' }}>
        <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}
          className="w-10 h-10 flex items-center justify-center rounded-xl m-glass text-white">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {menuOpen && (
          <div className="mobile-panel absolute top-12 left-0 w-56 max-h-[calc(100dvh-64px)] overflow-y-auto p-2 flex flex-col gap-1 rounded-2xl bg-neutral-950 border border-white/20 shadow-2xl">
            <span className="px-3 pt-1 text-[11px] font-bold text-neutral-400">Parking Simulator</span>
            {([1, 2] as const).map(id => (
              <button key={id} className={`${row} ${episode === id ? 'bg-emerald-700' : ''}`} onClick={act(() => onSelectEpisode(id))}>
                Episode {id}: {EPISODES[id].short}
              </button>
            ))}
            <button className={`${row} ${viewMode === 'cockpit' ? 'bg-blue-600' : ''}`} onClick={act(() => onSelectViewMode('cockpit'))}>Driver Cockpit</button>
            <button className={`${row} ${viewMode === 'exterior' ? 'bg-blue-600' : ''}`} onClick={act(() => onSelectViewMode('exterior'))}>Exterior View</button>
            <button className={row} onClick={act(onToggleHelp)}><HelpCircle size={16} />Controls Guide</button>
            <button className={row} onClick={onToggleMute}>{isMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} />}{isMuted ? 'Unmute' : 'Mute'}</button>
            <button className={row} onClick={act(onRestart)}><RotateCcw size={16} />Reset</button>
            <a href="../v1/" className={row}>Play original V1</a>
            <div className="flex items-center gap-2 px-3 py-1 text-sm text-neutral-100">Other apps <AppLauncher /></div>
          </div>
        )}
      </header>
    );
  }
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 bg-neutral-950/80 backdrop-blur-md border-b border-white/10 select-none">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          Parking Simulator
        </span>
        <label className="hidden sm:inline text-xs text-neutral-400">
          <span className="sr-only">Episode</span>
          <select value={episode} onChange={e => onSelectEpisode(Number(e.target.value) as EpisodeId)}
            className="bg-neutral-900 text-neutral-200 border border-white/10 rounded-md px-2 py-1 text-xs">
            {([1, 2] as const).map(id => (
              <option key={id} value={id}>Episode {String(id).padStart(2, '0')}: {EPISODES[id].title}</option>
            ))}
          </select>
        </label>
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
        <AppLauncher />
      </div>
    </header>
  );
};
