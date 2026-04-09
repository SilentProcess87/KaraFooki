import { useState } from 'react';
import { Mic, Moon, Sun, Keyboard, X, Circle } from 'lucide-react';
import { useKaraokeStore } from '../stores/useKaraokeStore';

export interface HeaderProps {
  onToggleRecord: () => void;
  isRecording: boolean;
  showRecord: boolean;
}

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: 'N', action: 'Next song' },
  { key: 'P', action: 'Previous song' },
  { key: 'M', action: 'Mute / unmute mic' },
  { key: 'F', action: 'Fullscreen' },
  { key: '← / →', action: 'Seek ±10 seconds' },
  { key: '↑ / ↓', action: 'YouTube volume ±5' },
  { key: 'L', action: 'Toggle lyrics panel' },
];

export function Header({ onToggleRecord, isRecording, showRecord }: HeaderProps) {
  const theme = useKaraokeStore(s => s.theme);
  const setTheme = useKaraokeStore(s => s.setTheme);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isDark = theme === 'dark';
  const surface = isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const btn = isDark
    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900';

  return (
    <>
      <header className={`flex items-center justify-between px-4 h-12 border-b shrink-0 ${surface}`}>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shadow-lg shadow-fuchsia-900/40">
            <Mic size={14} className="text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">
            Kara<span className="text-fuchsia-500">Fooki</span>
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowShortcuts(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${btn}`}
            title="Keyboard shortcuts"
          >
            <Keyboard size={13} />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          {/* Record button */}
          <button
            onClick={onToggleRecord}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : showRecord
                ? 'bg-gray-700 text-white'
                : btn
            }`}
            title="Recording studio"
          >
            <Circle size={11} className={isRecording ? 'fill-white animate-pulse' : ''} />
            <span className="hidden sm:inline">{isRecording ? 'Recording…' : 'Record'}</span>
          </button>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded transition-colors ${btn}`}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className={`relative w-80 rounded-xl border shadow-2xl p-5 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className={`p-1 rounded transition-colors ${btn}`}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <kbd className={`px-2 py-0.5 text-xs rounded font-mono ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    {s.key}
                  </kbd>
                  <span className={`text-xs ${mutedText}`}>{s.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
