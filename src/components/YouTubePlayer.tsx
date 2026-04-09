import { useRef, useEffect } from 'react';
import { SkipBack, SkipForward, Play, Pause, Maximize2, Minimize2, Volume2 } from 'lucide-react';
import { useKaraokeStore } from '../stores/useKaraokeStore';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function YouTubePlayer({ isFullscreen, onToggleFullscreen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const queue = useKaraokeStore(s => s.queue);
  const currentIndex = useKaraokeStore(s => s.currentIndex);
  const nextSong = useKaraokeStore(s => s.nextSong);
  const prevSong = useKaraokeStore(s => s.prevSong);
  const setIsPlaying = useKaraokeStore(s => s.setIsPlaying);
  const ytVolume = useKaraokeStore(s => s.ytVolume);
  const setYtVolume = useKaraokeStore(s => s.setYtVolume);
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';
  const addToHistory = useKaraokeStore(s => s.addToHistory);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  const handleEnded = () => {
    if (queue.length > 1) nextSong();
    else setIsPlaying(false);
  };

  const [ytState, ytControls] = useYouTubePlayer(containerRef, handleEnded, ytVolume);

  // Load video whenever current song changes
  useEffect(() => {
    if (currentSong && ytState.isReady) {
      ytControls.loadVideo(currentSong.videoId, true);
      addToHistory(currentSong);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.videoId, ytState.isReady]);

  // Sync playing state to store
  useEffect(() => {
    setIsPlaying(ytState.isPlaying);
  }, [ytState.isPlaying, setIsPlaying]);

  // Expose togglePlay to App for Space-bar shortcut
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('yt-player-ready', { detail: { toggle: ytControls.togglePlay } }));
  }, [ytControls.togglePlay]);

  const bg = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const controlBg = isDark ? 'bg-gray-900/90' : 'bg-white/90';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const btnClass = isDark
    ? 'text-gray-300 hover:text-white'
    : 'text-gray-600 hover:text-gray-900';

  const progressPct = ytState.duration > 0 ? (ytState.currentTime / ytState.duration) * 100 : 0;

  return (
    <div ref={wrapRef} className={`flex flex-col flex-1 min-h-0 ${bg}`}>
      {/* Player area */}
      <div className="relative flex-1 min-h-0 bg-black">
        {/* YouTube iframe container — z-0 (bottom) */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

        {/* ━━ Overlay interceptor (z-10) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             Sits on top of the iframe and blocks YouTube's own overlay UI
             (recommendation cards, end-screen "More videos", branding logo).
             Our custom controls live outside this div so they still work. */}
        {currentSong && (
          <div className="absolute inset-0" style={{ zIndex: 10, background: 'transparent' }} />
        )}

        {/* Empty state (z-20) */}
        {!currentSong && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" style={{ zIndex: 20 }}>
            <div className="w-16 h-16 rounded-full bg-fuchsia-600/20 flex items-center justify-center">
              <span className="text-3xl">🎤</span>
            </div>
            <p className="text-sm text-gray-400 font-medium">Add songs to the queue to get started</p>
            <p className="text-xs text-gray-600">Search for songs or paste a YouTube URL →</p>
          </div>
        )}

        {/* Buffering spinner (z-20, pointer-events-none so it doesn’t block seeking) */}
        {ytState.buffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none" style={{ zIndex: 20 }}>
            <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Fullscreen toggle (z-20) */}
        <button
          onClick={onToggleFullscreen}
          className={`absolute top-2 right-2 p-1.5 rounded bg-black/50 text-white hover:bg-black/70 transition-colors ${!currentSong ? 'hidden' : ''}`}
          style={{ zIndex: 20 }}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Custom controls bar */}
      <div className={`shrink-0 px-3 py-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} ${controlBg}`}>
        {/* Song title */}
        {currentSong && (
          <p className="text-xs font-medium truncate mb-1.5" title={currentSong.title}>
            {currentSong.title}
          </p>
        )}

        {/* Seek bar */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs tabular-nums shrink-0 ${textMuted}`}>{formatTime(ytState.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={ytState.duration || 100}
            step={0.5}
            value={ytState.currentTime}
            onChange={e => ytControls.seek(Number(e.target.value))}
            className="flex-1"
            style={{
              background: `linear-gradient(to right, #c026d3 ${progressPct}%, rgba(255,255,255,.18) ${progressPct}%)`,
            }}
            disabled={!currentSong}
          />
          <span className={`text-xs tabular-nums shrink-0 ${textMuted}`}>{formatTime(ytState.duration)}</span>
        </div>

        {/* Buttons + volume */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={prevSong} className={`p-1.5 rounded transition-colors ${btnClass}`} disabled={queue.length === 0} title="Previous">
              <SkipBack size={16} />
            </button>
            <button
              onClick={ytControls.togglePlay}
              disabled={!currentSong}
              className={`p-1.5 rounded-full transition-colors ${currentSong ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              title={ytState.isPlaying ? 'Pause' : 'Play'}
            >
              {ytState.isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button onClick={nextSong} className={`p-1.5 rounded transition-colors ${btnClass}`} disabled={queue.length === 0} title="Next">
              <SkipForward size={16} />
            </button>
          </div>

          {/* YouTube volume */}
          <div className="flex items-center gap-1.5 w-28">
            <Volume2 size={13} className={textMuted} />
            <input
              type="range"
              min={0}
              max={100}
              value={ytVolume}
              onChange={e => {
                setYtVolume(Number(e.target.value));
                ytControls.setVolume(Number(e.target.value));
              }}
              title={`YouTube volume: ${ytVolume}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
