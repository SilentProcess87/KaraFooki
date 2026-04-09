export interface Song {
  id: string;        // Unique UUID for queue item
  videoId: string;   // YouTube video ID
  title: string;
  thumbnail: string;
  channelTitle?: string;
  duration?: string;
}

export type ReverbPreset = 'off' | 'small' | 'hall' | 'cathedral';
export type ThemeType = 'dark' | 'light';
export type TabType = 'search' | 'queue' | 'favorites';

// ── YouTube IFrame API global declarations ──────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (elementOrId: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerOptions {
  width?: number | string;
  height?: number | string;
  videoId?: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1 | 2;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    fs?: 0 | 1;
    enablejsapi?: 0 | 1;
    origin?: string;
    playsinline?: 0 | 1;
    iv_load_policy?: 1 | 3;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { target: YTPlayer; data: number }) => void;
    onError?: (event: { target: YTPlayer; data: number }) => void;
  };
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { title: string; video_id: string; author: string };
  destroy(): void;
}
