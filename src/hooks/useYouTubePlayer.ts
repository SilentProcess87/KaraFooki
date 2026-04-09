import { useRef, useState, useCallback, useEffect } from 'react';
import type { YTPlayer } from '../types';

interface YTPlayerHookState {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffering: boolean;
}

interface YTPlayerHookControls {
  loadVideo: (videoId: string, autoplay?: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
}

let ytApiLoading = false;
let ytApiReady = false;
const ytApiReadyCallbacks: Array<() => void> = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise(resolve => {
    if (ytApiReady) { resolve(); return; }
    ytApiReadyCallbacks.push(resolve);
    if (!ytApiLoading) {
      ytApiLoading = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytApiReadyCallbacks.forEach(cb => cb());
        ytApiReadyCallbacks.length = 0;
      };
    }
  });
}

export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onEnded: () => void,
  volume: number,
): [YTPlayerHookState, YTPlayerHookControls] {
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [state, setState] = useState<YTPlayerHookState>({
    isReady: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffering: false,
  });

  // Poll current time while playing
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      if (!playerRef.current) return;
      const ct = playerRef.current.getCurrentTime();
      const dur = playerRef.current.getDuration();
      setState(s => ({ ...s, currentTime: ct, duration: dur || s.duration }));
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Initialize player
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      await loadYouTubeAPI();
      if (destroyed || !containerRef.current) return;

      // Clear the container first (StrictMode double-invoke guard)
      containerRef.current.innerHTML = '';
      const div = document.createElement('div');
      div.id = `yt-player-${Date.now()}`;
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div, {
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,          // Custom controls only
          rel: 0,
          modestbranding: 1,
          fs: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          iv_load_policy: 3,    // Hide annotations
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume);
            setState(s => ({ ...s, isReady: true }));
          },
          onStateChange: (e) => {
            const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };
            switch (e.data) {
              case YT_STATE.PLAYING:
                setState(s => ({ ...s, isPlaying: true, buffering: false }));
                startTimer();
                break;
              case YT_STATE.PAUSED:
                setState(s => ({ ...s, isPlaying: false }));
                stopTimer();
                break;
              case YT_STATE.BUFFERING:
                setState(s => ({ ...s, buffering: true }));
                break;
              case YT_STATE.ENDED:
                setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
                stopTimer();
                onEndedRef.current();
                break;
            }
          },
        },
      });
    })();

    return () => {
      destroyed = true;
      stopTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Only run on mount

  // Sync volume changes
  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  // Controls
  const loadVideo = useCallback((videoId: string, autoplay = true) => {
    if (!playerRef.current) return;
    if (autoplay) {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current.cueVideoById(videoId);
    }
    setState(s => ({ ...s, currentTime: 0, duration: 0 }));
  }, []);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    const ps = playerRef.current.getPlayerState();
    if (ps === 1) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, []);

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    setState(s => ({ ...s, currentTime: seconds }));
  }, []);

  const setVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(v);
  }, []);

  return [state, { loadVideo, play, pause, togglePlay, seek, setVolume }];
}
