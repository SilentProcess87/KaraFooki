import { useState } from 'react';
import { X, Check, SlidersHorizontal, Search } from 'lucide-react';
import { useKaraokeStore } from '../stores/useKaraokeStore';
import { PRESET_GROUPS, type VocalPreset } from '../data/vocalPresets';

interface Props {
  onClose: () => void;
}

export function PresetPanel({ onClose }: Props) {
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';

  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Store setters — applying a preset just updates the store; MicControls'
  // useEffects then propagate the new values to the Web Audio API automatically.
  const setEchoMix      = useKaraokeStore(s => s.setEchoMix);
  const setEchoDelay    = useKaraokeStore(s => s.setEchoDelay);
  const setEchoFeedback = useKaraokeStore(s => s.setEchoFeedback);
  const setReverbPreset = useKaraokeStore(s => s.setReverbPreset);
  const setReverbMix    = useKaraokeStore(s => s.setReverbMix);

  const applyPreset = (p: VocalPreset) => {
    setEchoMix(p.echoMix);
    setEchoDelay(p.echoDelay);
    setEchoFeedback(p.echoFeedback);
    setReverbPreset(p.reverbPreset);
    setReverbMix(p.reverbMix);
    setAppliedId(p.id);
  };

  // Filter across all groups
  const q = search.toLowerCase().trim();
  const filteredGroups = PRESET_GROUPS.map(g => ({
    ...g,
    presets: g.presets.filter(p =>
      !q ||
      p.song.toLowerCase().includes(q) ||
      p.artist.toLowerCase().includes(q) ||
      p.genre.toLowerCase().includes(q)
    ),
  })).filter(g => g.presets.length > 0);

  // Theme helpers
  const panel   = isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900';
  const divider = isDark ? 'border-gray-800' : 'border-gray-100';
  const muted   = isDark ? 'text-gray-400' : 'text-gray-500';
  const heading = isDark ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-500';
  const inputCls = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-fuchsia-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-fuchsia-500';

  return (
    <div className={`w-72 rounded-xl border shadow-2xl overflow-hidden flex flex-col ${panel}`}
         style={{ maxHeight: 'calc(100vh - 80px)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${divider}`}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-fuchsia-400" />
          <span className="text-sm font-semibold">Vocal Presets</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {PRESET_GROUPS.reduce((n, g) => n + g.presets.length, 0)}
          </span>
        </div>
        <button onClick={onClose} className={`p-1 rounded transition-colors ${muted} hover:text-current`}>
          <X size={14} />
        </button>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className={`px-3 py-2 border-b shrink-0 ${divider}`}>
        <div className="relative">
          <Search size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${muted}`} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search song or artist…"
            className={`w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none focus:ring-1 ${inputCls}`}
          />
        </div>
      </div>

      {/* ── Preset list ─────────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex-1">
        {filteredGroups.length === 0 ? (
          <p className={`text-xs text-center py-8 ${muted}`}>No presets found for "{search}"</p>
        ) : (
          filteredGroups.map(group => (
            <div key={group.label} className={`border-b last:border-0 ${divider}`}>
              {/* Group header */}
              <p className={`sticky top-0 px-4 py-1.5 text-xs font-bold ${heading}`}>
                {group.label}
              </p>

              {group.presets.map(preset => {
                const isApplied = appliedId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      isApplied
                        ? isDark
                          ? 'bg-fuchsia-600/15 border-l-2 border-fuchsia-500'
                          : 'bg-fuchsia-50 border-l-2 border-fuchsia-500'
                        : isDark
                        ? 'hover:bg-gray-800/70'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Applied indicator */}
                    <div className={`w-4 shrink-0 mt-0.5 flex items-center justify-center`}>
                      {isApplied
                        ? <Check size={11} className="text-fuchsia-400" />
                        : <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold ${isApplied ? 'text-fuchsia-400' : ''}`}>
                          {preset.song}
                        </span>
                        <span className={`text-xs ${muted}`}>— {preset.artist}</span>
                      </div>
                      <p className={`text-xs mt-0.5 italic leading-snug ${muted}`}>{preset.vibe}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* ── Footer: confirmation ─────────────────────────────────────────── */}
      {appliedId && (
        <div className={`shrink-0 px-4 py-2 border-t flex items-center gap-1.5 text-xs text-fuchsia-400 ${divider}`}>
          <Check size={11} />
          Preset applied — tweak the sliders below to fine-tune
        </div>
      )}
    </div>
  );
}
