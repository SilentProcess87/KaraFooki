import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Song, ReverbPreset, ThemeType, TabType } from '../types';

interface KaraokeState {
  // ── Queue & playback ──────────────────────────────────────────────────────
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;

  // ── UI ────────────────────────────────────────────────────────────────────
  theme: ThemeType;
  activeTab: TabType;
  showLyrics: boolean;
  showApiKeyInput: boolean;

  // ── YouTube settings ──────────────────────────────────────────────────────
  ytVolume: number;       // 0-100
  ytApiKey: string;
  addKaraokeSuffix: boolean;

  // ── Search ────────────────────────────────────────────────────────────────
  searchQuery: string;
  searchResults: Song[];
  isSearching: boolean;
  searchError: string;

  // ── Mic / audio settings (persisted) ─────────────────────────────────────
  micVolume: number;        // 0-4  (1 = 100%, mic input sensitivity)
  monitorVolume: number;    // 0-3  (headphone/speaker output level)
  echoDelay: number;        // 0-1  seconds
  echoFeedback: number;     // 0-0.7
  echoMix: number;          // 0-1  (0 = no echo)
  reverbPreset: ReverbPreset;
  reverbMix: number;        // 0-1
  micMuted: boolean;

  // ── Favorites / history ───────────────────────────────────────────────────
  favorites: Song[];
  history: Song[];

  // ── Actions ───────────────────────────────────────────────────────────────
  addToQueue: (song: Song) => void;
  removeFromQueue: (id: string) => void;
  reorderQueue: (from: number, to: number) => void;
  playNow: (song: Song) => void;
  setCurrentIndex: (i: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  setIsPlaying: (v: boolean) => void;

  setTheme: (t: ThemeType) => void;
  setActiveTab: (t: TabType) => void;
  setShowLyrics: (v: boolean) => void;
  setShowApiKeyInput: (v: boolean) => void;

  setYtVolume: (v: number) => void;
  setYtApiKey: (k: string) => void;
  setAddKaraokeSuffix: (v: boolean) => void;

  setSearchQuery: (q: string) => void;
  setSearchResults: (r: Song[]) => void;
  setIsSearching: (v: boolean) => void;
  setSearchError: (e: string) => void;

  setMicVolume: (v: number) => void;
  setMonitorVolume: (v: number) => void;
  setEchoDelay: (v: number) => void;
  setEchoFeedback: (v: number) => void;
  setEchoMix: (v: number) => void;
  setReverbPreset: (p: ReverbPreset) => void;
  setReverbMix: (v: number) => void;
  setMicMuted: (v: boolean) => void;

  toggleFavorite: (song: Song) => void;
  isFavorite: (videoId: string) => boolean;
  addToHistory: (song: Song) => void;
  clearHistory: () => void;
}

export const useKaraokeStore = create<KaraokeState>()(
  persist(
    (set, get) => ({
      // Defaults
      queue: [],
      currentIndex: -1,
      isPlaying: false,

      theme: 'dark',
      activeTab: 'search',
      showLyrics: false,
      showApiKeyInput: false,

      ytVolume: 80,
      ytApiKey: '',
      addKaraokeSuffix: true,

      searchQuery: '',
      searchResults: [],
      isSearching: false,
      searchError: '',

      micVolume: 2.0,
      monitorVolume: 2.0,
      echoDelay: 0.25,
      echoFeedback: 0.35,
      echoMix: 0,
      reverbPreset: 'small',
      reverbMix: 0.2,
      micMuted: false,

      favorites: [],
      history: [],

      // ── Queue actions ─────────────────────────────────────────────────────
      addToQueue: (song) =>
        set(s => {
          const queue = [...s.queue, song];
          const currentIndex = s.currentIndex === -1 ? 0 : s.currentIndex;
          return { queue, currentIndex };
        }),

      removeFromQueue: (id) =>
        set(s => {
          const queue = s.queue.filter(song => song.id !== id);
          const removedIdx = s.queue.findIndex(song => song.id === id);
          let currentIndex = s.currentIndex;
          if (removedIdx < currentIndex) currentIndex--;
          else if (removedIdx === currentIndex) currentIndex = Math.min(currentIndex, queue.length - 1);
          return { queue, currentIndex };
        }),

      reorderQueue: (from, to) =>
        set(s => {
          const queue = [...s.queue];
          const [moved] = queue.splice(from, 1);
          queue.splice(to, 0, moved);
          let idx = s.currentIndex;
          if (s.currentIndex === from) idx = to;
          else if (from < s.currentIndex && to >= s.currentIndex) idx--;
          else if (from > s.currentIndex && to <= s.currentIndex) idx++;
          return { queue, currentIndex: idx };
        }),

      playNow: (song) =>
        set(s => {
          // If already in queue, jump to it
          const existing = s.queue.findIndex(q => q.id === song.id);
          if (existing !== -1) return { currentIndex: existing, isPlaying: true };
          const queue = [...s.queue, song];
          return { queue, currentIndex: queue.length - 1, isPlaying: true };
        }),

      setCurrentIndex: (i) => set({ currentIndex: i }),
      setIsPlaying: (v) => set({ isPlaying: v }),

      nextSong: () =>
        set(s => {
          if (s.queue.length === 0) return {};
          return { currentIndex: (s.currentIndex + 1) % s.queue.length, isPlaying: true };
        }),

      prevSong: () =>
        set(s => {
          if (s.queue.length === 0) return {};
          return {
            currentIndex: s.currentIndex <= 0 ? s.queue.length - 1 : s.currentIndex - 1,
            isPlaying: true,
          };
        }),

      // ── UI ────────────────────────────────────────────────────────────────
      setTheme: (t) => set({ theme: t }),
      setActiveTab: (t) => set({ activeTab: t }),
      setShowLyrics: (v) => set({ showLyrics: v }),
      setShowApiKeyInput: (v) => set({ showApiKeyInput: v }),

      // ── YouTube ───────────────────────────────────────────────────────────
      setYtVolume: (v) => set({ ytVolume: v }),
      setYtApiKey: (k) => set({ ytApiKey: k }),
      setAddKaraokeSuffix: (v) => set({ addKaraokeSuffix: v }),

      // ── Search ────────────────────────────────────────────────────────────
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSearchResults: (r) => set({ searchResults: r }),
      setIsSearching: (v) => set({ isSearching: v }),
      setSearchError: (e) => set({ searchError: e }),

      // ── Mic ───────────────────────────────────────────────────────────────
      setMicVolume: (v) => set({ micVolume: v }),
      setMonitorVolume: (v) => set({ monitorVolume: v }),
      setEchoDelay: (v) => set({ echoDelay: v }),
      setEchoFeedback: (v) => set({ echoFeedback: v }),
      setEchoMix: (v) => set({ echoMix: v }),
      setReverbPreset: (p) => set({ reverbPreset: p }),
      setReverbMix: (v) => set({ reverbMix: v }),
      setMicMuted: (v) => set({ micMuted: v }),

      // ── Favorites / history ───────────────────────────────────────────────
      toggleFavorite: (song) =>
        set(s => {
          const exists = s.favorites.some(f => f.videoId === song.videoId);
          return {
            favorites: exists
              ? s.favorites.filter(f => f.videoId !== song.videoId)
              : [{ ...song, id: crypto.randomUUID() }, ...s.favorites],
          };
        }),

      isFavorite: (videoId) => get().favorites.some(f => f.videoId === videoId),

      addToHistory: (song) =>
        set(s => {
          const filtered = s.history.filter(h => h.videoId !== song.videoId);
          return { history: [{ ...song, id: crypto.randomUUID() }, ...filtered].slice(0, 50) };
        }),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'karafooki-v1',
      partialize: (s) => ({
        theme: s.theme,
        ytApiKey: s.ytApiKey,
        ytVolume: s.ytVolume,
        addKaraokeSuffix: s.addKaraokeSuffix,
        micVolume: s.micVolume,
        monitorVolume: s.monitorVolume,
        echoDelay: s.echoDelay,
        echoFeedback: s.echoFeedback,
        echoMix: s.echoMix,
        reverbPreset: s.reverbPreset,
        reverbMix: s.reverbMix,
        favorites: s.favorites,
        history: s.history,
        showLyrics: s.showLyrics,
      }),
    }
  )
);
