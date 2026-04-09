import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { YouTubePlayer } from './components/YouTubePlayer';
import { SongPanel } from './components/SongPanel';
import { MicControls } from './components/MicControls';
import { RecordPanel } from './components/RecordPanel';
import { useKaraokeStore } from './stores/useKaraokeStore';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useRecorder } from './hooks/useRecorder';

export default function App() {
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';

  // Audio settings from store (seed initial values for audio engine)
  const reverbPreset   = useKaraokeStore(s => s.reverbPreset);
  const micVolume      = useKaraokeStore(s => s.micVolume);
  const monitorVolume  = useKaraokeStore(s => s.monitorVolume);
  const echoDelay      = useKaraokeStore(s => s.echoDelay);
  const echoFeedback = useKaraokeStore(s => s.echoFeedback);
  const echoMix      = useKaraokeStore(s => s.echoMix);
  const reverbMix    = useKaraokeStore(s => s.reverbMix);
  const micMuted     = useKaraokeStore(s => s.micMuted);

  const nextSong     = useKaraokeStore(s => s.nextSong);
  const prevSong     = useKaraokeStore(s => s.prevSong);
  const setMicMuted  = useKaraokeStore(s => s.setMicMuted);
  const setYtVolume  = useKaraokeStore(s => s.setYtVolume);
  const ytVolume     = useKaraokeStore(s => s.ytVolume);
  const setShowLyrics = useKaraokeStore(s => s.setShowLyrics);
  const showLyrics   = useKaraokeStore(s => s.showLyrics);

  // Fullscreen
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerWrapRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Audio engine ──────────────────────────────────────────────────────
  const [audioState, audioControls] = useAudioEngine(
    reverbPreset, micVolume, monitorVolume, echoDelay, echoFeedback, echoMix, reverbMix, micMuted,
  );

  // ── Recorder ─────────────────────────────────────────────────────────
  const [recState, recControls] = useRecorder(audioState.micRecordStream);
  const [showRecordPanel, setShowRecordPanel] = useState(false);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Keep a stable ref for play toggle (set by YouTubePlayer via window event)
  const togglePlayRef = useRef<() => void>(() => {});

  useEffect(() => {
    // YouTubePlayer dispatches a custom event so App can proxy the space-bar shortcut
    const handler = (e: Event) => {
      togglePlayRef.current = (e as CustomEvent).detail.toggle;
    };
    window.addEventListener('yt-player-ready', handler);
    return () => window.removeEventListener('yt-player-ready', handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayRef.current?.();
          break;
        case 'n': case 'N':
          e.preventDefault(); nextSong(); break;
        case 'p': case 'P':
          e.preventDefault(); prevSong(); break;
        case 'm': case 'M':
          e.preventDefault();
          setMicMuted(!micMuted);
          if (audioState.isEnabled) audioControls.setMuted(!micMuted);
          break;
        case 'f': case 'F':
          e.preventDefault(); toggleFullscreen(); break;
        case 'l': case 'L':
          e.preventDefault(); setShowLyrics(!showLyrics); break;
        case 'ArrowUp':
          e.preventDefault(); setYtVolume(Math.min(100, ytVolume + 5)); break;
        case 'ArrowDown':
          e.preventDefault(); setYtVolume(Math.max(0, ytVolume - 5)); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [micMuted, audioState.isEnabled, audioControls, nextSong, prevSong,
      setMicMuted, setYtVolume, ytVolume, setShowLyrics, showLyrics]);

  const appBg = isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900';

  return (
    <div className={`flex flex-col h-screen ${appBg} theme-${theme}`}>
      {/* Record panel floats below the header's Record button */}
      <div className="relative">
        <Header
          onToggleRecord={() => setShowRecordPanel(v => !v)}
          isRecording={recState.isRecording}
          showRecord={showRecordPanel}
        />
        {showRecordPanel && (
          <div className="absolute right-4 top-full mt-1 z-50">
            <RecordPanel
              recState={recState}
              recControls={recControls}
              micEnabled={audioState.isEnabled}
              onClose={() => setShowRecordPanel(false)}
            />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Player */}
        <div ref={playerWrapRef} className="flex flex-col flex-1 min-w-0 min-h-0">
          <YouTubePlayer
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />

          {/* Lyrics placeholder */}
          {showLyrics && (
            <div className={`shrink-0 border-t px-4 py-2.5 text-center ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              <p className="text-sm opacity-60">Lyrics panel · Press L to hide</p>
            </div>
          )}
        </div>

        {/* Right: Song panel (search/queue/favorites) */}
        <div className={`w-72 shrink-0 flex flex-col border-l ${isDark ? 'border-gray-800' : 'border-gray-200'} overflow-hidden`}>
          <SongPanel />
        </div>
      </div>

      {/* Bottom: Mic controls */}
      <MicControls audioState={audioState} audioControls={audioControls} />
    </div>
  );
}
