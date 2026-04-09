import { X, Circle, Square, Download, Trash2, Mic, Music, Layers, Info } from 'lucide-react';
import { useKaraokeStore } from '../stores/useKaraokeStore';
import type { RecorderState, RecorderControls, RecordingTrack, RecordMode } from '../hooks/useRecorder';

interface Props {
  recState: RecorderState;
  recControls: RecorderControls;
  micEnabled: boolean;
  onClose: () => void;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const MODE_INFO: Record<RecordMode, { label: string; desc: string }> = {
  mix: {
    label: '🎚 Mix  (1 file)',
    desc: 'Vocals + music combined into a single stereo file.',
  },
  split: {
    label: '🎛 Split Channels  (2 files)',
    desc: 'Vocals and music saved separately — ideal for DAW mixing in Audacity, Reaper, GarageBand, etc.',
  },
};

function TrackIcon({ type }: { type: RecordingTrack['type'] }) {
  if (type === 'mic')   return <Mic   size={12} className="text-green-400  shrink-0" />;
  if (type === 'music') return <Music size={12} className="text-blue-400   shrink-0" />;
  return                       <Layers size={12} className="text-fuchsia-400 shrink-0" />;
}

export function RecordPanel({ recState, recControls, micEnabled, onClose }: Props) {
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';

  const { isRecording, mode, elapsedSec, tracks, error, captureNote } = recState;
  const { start, stop, setMode, download, remove } = recControls;

  const panel = isDark
    ? 'bg-gray-900 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900';
  const sectionBorder = isDark ? 'border-gray-800' : 'border-gray-100';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const modeBtnBase = `flex-1 py-2 text-xs font-medium rounded-lg transition-colors`;
  const modeActive = 'bg-fuchsia-600 text-white';
  const modeInactive = isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  return (
    <div className={`w-80 rounded-xl border shadow-2xl overflow-hidden ${panel}`}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${sectionBorder}`}>
        <div className="flex items-center gap-2">
          {isRecording
            ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            : <span className="w-2 h-2 rounded-full bg-gray-500" />}
          <span className="text-sm font-semibold">Recording Studio</span>
          {isRecording && (
            <span className="text-sm font-mono text-red-400 tabular-nums">{fmtTime(elapsedSec)}</span>
          )}
        </div>
        <button onClick={onClose} className={`p-1 rounded transition-colors ${muted} hover:text-current`}>
          <X size={14} />
        </button>
      </div>

      {/* ── Mode selector ───────────────────────────────────────────────── */}
      <div className={`px-4 py-3 border-b ${sectionBorder}`}>
        <p className={`text-xs font-semibold mb-2 ${muted}`}>Output Mode</p>
        <div className="flex gap-2 mb-2">
          {(['mix', 'split'] as RecordMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={isRecording}
              className={`${modeBtnBase} ${mode === m ? modeActive : modeInactive}`}
            >
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <p className={`text-xs ${muted}`}>{MODE_INFO[mode].desc}</p>
      </div>

      {/* ── Start / Stop ────────────────────────────────────────────────── */}
      <div className={`px-4 py-3 border-b ${sectionBorder}`}>
        {!isRecording ? (
          <>
            <button
              onClick={start}
              disabled={!micEnabled}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              <Circle size={14} />
              Start Recording
            </button>
            {!micEnabled && (
              <p className={`text-xs text-center mt-2 ${muted}`}>⚠ Enable your mic in the panel below first.</p>
            )}
            <div className={`flex items-start gap-1.5 mt-2 text-xs ${muted}`}>
              <Info size={11} className="mt-0.5 shrink-0" />
              <span>
                When prompted, select <strong>this tab</strong> and enable <strong>"Share tab audio"</strong> to capture YouTube music.
              </span>
            </div>
          </>
        ) : (
          <button
            onClick={stop}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            <Square size={14} className="fill-white" />
            Stop  ·  {fmtTime(elapsedSec)}
          </button>
        )}

        {/* Non-blocking notice about tab audio availability */}
        {captureNote && (
          <p className="text-xs text-yellow-400 mt-2 leading-snug">{captureNote}</p>
        )}
        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}
      </div>

      {/* ── Recordings list ─────────────────────────────────────────────── */}
      {tracks.length > 0 && (
        <div className="px-4 py-3 max-h-52 overflow-y-auto">
          <p className={`text-xs font-semibold mb-2 ${muted}`}>Saved Recordings</p>
          <div className="space-y-1.5">
            {tracks.map(track => (
              <div
                key={track.id}
                className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
              >
                <TrackIcon type={track.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{track.filename}</p>
                  <p className={`text-xs ${muted}`}>{fmtTime(track.durationSec)} · {fmtBytes(track.bytes)}</p>
                </div>
                <button
                  onClick={() => download(track)}
                  className={`p-1.5 rounded transition-colors ${muted} hover:text-green-400`}
                  title="Download"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => remove(track.id)}
                  className={`p-1.5 rounded transition-colors ${muted} hover:text-red-400`}
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
