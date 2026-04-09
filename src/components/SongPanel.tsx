import { useState, useRef } from 'react';
import {
  Search, Link, Plus, Trash2, Heart, Clock, PlayCircle,
  Loader2, Key, X, GripVertical, ChevronRight,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useKaraokeStore } from '../stores/useKaraokeStore';
import { searchYouTube, extractVideoId } from '../utils/youtubeUtils';
import type { Song, TabType } from '../types';

export function SongPanel() {
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';

  const activeTab = useKaraokeStore(s => s.activeTab);
  const setActiveTab = useKaraokeStore(s => s.setActiveTab);
  const queue = useKaraokeStore(s => s.queue);
  const currentIndex = useKaraokeStore(s => s.currentIndex);
  const favorites = useKaraokeStore(s => s.favorites);
  const history = useKaraokeStore(s => s.history);
  const ytApiKey = useKaraokeStore(s => s.ytApiKey);
  const addKaraokeSuffix = useKaraokeStore(s => s.addKaraokeSuffix);
  const searchQuery = useKaraokeStore(s => s.searchQuery);
  const searchResults = useKaraokeStore(s => s.searchResults);
  const isSearching = useKaraokeStore(s => s.isSearching);
  const searchError = useKaraokeStore(s => s.searchError);

  const setSearchQuery = useKaraokeStore(s => s.setSearchQuery);
  const setSearchResults = useKaraokeStore(s => s.setSearchResults);
  const setIsSearching = useKaraokeStore(s => s.setIsSearching);
  const setSearchError = useKaraokeStore(s => s.setSearchError);
  const addToQueue = useKaraokeStore(s => s.addToQueue);
  const playNow = useKaraokeStore(s => s.playNow);
  const removeFromQueue = useKaraokeStore(s => s.removeFromQueue);
  const reorderQueue = useKaraokeStore(s => s.reorderQueue);
  const setCurrentIndex = useKaraokeStore(s => s.setCurrentIndex);
  const toggleFavorite = useKaraokeStore(s => s.toggleFavorite);
  const isFavorite = useKaraokeStore(s => s.isFavorite);
  const clearHistory = useKaraokeStore(s => s.clearHistory);
  const setYtApiKey = useKaraokeStore(s => s.setYtApiKey);
  const setAddKaraokeSuffix = useKaraokeStore(s => s.setAddKaraokeSuffix);

  const [showApiInput, setShowApiInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(ytApiKey);
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme helpers
  const panelBg = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const surfaceBg = isDark ? 'bg-gray-800' : 'bg-white';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';
  const itemHover = isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100';

  // ── Search / URL handling ──────────────────────────────────────────────
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    // Check if it's a YouTube URL/ID
    const vid = extractVideoId(q);
    if (vid) {
      const song: Song = {
        id: crypto.randomUUID(),
        videoId: vid,
        title: `YouTube Video (${vid})`,
        thumbnail: `https://img.youtube.com/vi/${vid}/default.jpg`,
      };
      playNow(song);
      setActiveTab('queue');
      return;
    }

    // API search
    if (!ytApiKey) {
      setSearchError('Paste a YouTube URL above, or set your YouTube API key to search by name.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const query = addKaraokeSuffix ? `${q} karaoke` : q;
      const results = await searchYouTube(query, ytApiKey);
      setSearchResults(results);
      if (results.length === 0) setSearchError('No results found.');
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderQueue(result.source.index, result.destination.index);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'search', label: 'Search', icon: <Search size={12} /> },
    { id: 'queue', label: `Queue ${queue.length > 0 ? `(${queue.length})` : ''}`, icon: <PlayCircle size={12} /> },
    { id: 'favorites', label: 'Saved', icon: <Heart size={12} /> },
  ];

  return (
    <div className={`flex flex-col h-full ${panelBg}`}>
      {/* Tabs */}
      <div className={`flex shrink-0 border-b ${borderColor}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-fuchsia-500 text-fuchsia-500'
                : `border-transparent ${textMuted} hover:text-current`
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── SEARCH TAB ─────────────────────────────────────────────── */}
        {activeTab === 'search' && (
          <div className="flex flex-col gap-2 p-2">
            {/* Search input */}
            <form
              onSubmit={e => { e.preventDefault(); handleSearch(); }}
              className="flex gap-1.5"
            >
              <div className="relative flex-1">
                <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textMuted}`} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Song name or YouTube URL…"
                  className={`w-full pl-7 pr-3 py-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-fuchsia-500 ${inputBg}`}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-3 py-2 text-xs font-medium bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shrink-0"
              >
                {isSearching ? <Loader2 size={13} className="animate-spin" /> : 'Go'}
              </button>
            </form>

            {/* Options row */}
            <div className="flex items-center justify-between px-0.5">
              <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${textMuted}`}>
                <input
                  type="checkbox"
                  checked={addKaraokeSuffix}
                  onChange={e => setAddKaraokeSuffix(e.target.checked)}
                  className="accent-fuchsia-500 w-3 h-3"
                />
                Add "karaoke" to search
              </label>
              <button
                onClick={() => setShowApiInput(v => !v)}
                className={`flex items-center gap-1 text-xs transition-colors ${ytApiKey ? 'text-green-500' : textMuted} hover:text-fuchsia-400`}
                title="YouTube API key settings"
              >
                <Key size={11} />
                {ytApiKey ? 'API key set' : 'Set API key'}
              </button>
            </div>

            {/* API key input */}
            {showApiInput && (
              <div className={`rounded-lg border p-2 ${surfaceBg} ${borderColor}`}>
                <p className={`text-xs mb-1.5 ${textMuted}`}>
                  YouTube Data API v3 key (needed for search by name). Get one free at{' '}
                  <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-fuchsia-400 underline">
                    console.cloud.google.com
                  </a>
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={apiKeyDraft}
                    onChange={e => setApiKeyDraft(e.target.value)}
                    placeholder="AIza…"
                    className={`flex-1 px-2.5 py-1.5 text-xs rounded border outline-none focus:ring-1 focus:ring-fuchsia-500 ${inputBg}`}
                  />
                  <button
                    onClick={() => { setYtApiKey(apiKeyDraft); setShowApiInput(false); }}
                    className="px-2.5 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
                  >Save</button>
                </div>
              </div>
            )}

            {/* Error */}
            {searchError && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400 text-xs">
                <X size={12} className="mt-0.5 shrink-0" />
                {searchError}
              </div>
            )}

            {/* URL quick-add hint */}
            {!searchResults.length && !searchError && (
              <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                <Link size={12} className="mt-0.5 shrink-0" />
                <span>Paste a YouTube URL or video ID to play instantly — no API key needed.</span>
              </div>
            )}

            {/* Search results */}
            {searchResults.map(song => (
              <SongRow
                key={song.id}
                song={song}
                isDark={isDark}
                itemHover={itemHover}
                textMuted={textMuted}
                isFav={isFavorite(song.videoId)}
                onPlay={() => { playNow(song); setActiveTab('queue'); }}
                onAdd={() => addToQueue({ ...song, id: crypto.randomUUID() })}
                onFav={() => toggleFavorite(song)}
              />
            ))}
          </div>
        )}

        {/* ── QUEUE TAB ──────────────────────────────────────────────── */}
        {activeTab === 'queue' && (
          <div className="p-1">
            {queue.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-10 gap-2 ${textMuted}`}>
                <PlayCircle size={28} className="opacity-40" />
                <p className="text-xs">Queue is empty</p>
                <button onClick={() => setActiveTab('search')} className="text-xs text-fuchsia-500 hover:underline">
                  Search for songs →
                </button>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="queue">
                  {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {queue.map((song, idx) => (
                        <Draggable key={song.id} draggableId={song.id} index={idx}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 transition-colors cursor-pointer ${
                                snap.isDragging
                                  ? isDark ? 'bg-gray-700 shadow-xl' : 'bg-gray-200 shadow-xl'
                                  : idx === currentIndex
                                  ? 'bg-fuchsia-600/20 border border-fuchsia-500/30'
                                  : itemHover
                              }`}
                              onClick={() => setCurrentIndex(idx)}
                            >
                              <span {...prov.dragHandleProps} className={`shrink-0 cursor-grab ${textMuted}`}>
                                <GripVertical size={13} />
                              </span>
                              <img src={song.thumbnail} alt="" className="w-9 h-7 rounded object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${idx === currentIndex ? 'text-fuchsia-400' : ''}`}>
                                  {song.title}
                                </p>
                                {song.duration && <p className={`text-xs ${textMuted}`}>{song.duration}</p>}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); removeFromQueue(song.id); }}
                                className={`shrink-0 p-1 rounded transition-colors ${textMuted} hover:text-red-400`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        )}

        {/* ── FAVORITES / HISTORY TAB ───────────────────────────────── */}
        {activeTab === 'favorites' && (
          <div className="p-2">
            {/* Favorites */}
            <div className="mb-3">
              <p className={`text-xs font-semibold mb-2 flex items-center gap-1 ${textMuted}`}>
                <Heart size={11} className="text-pink-500" /> Favorites ({favorites.length})
              </p>
              {favorites.length === 0 ? (
                <p className={`text-xs ${textMuted} py-2`}>Heart songs to save them here.</p>
              ) : (
                favorites.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    isDark={isDark}
                    itemHover={itemHover}
                    textMuted={textMuted}
                    isFav={true}
                    onPlay={() => playNow(song)}
                    onAdd={() => addToQueue({ ...song, id: crypto.randomUUID() })}
                    onFav={() => toggleFavorite(song)}
                  />
                ))
              )}
            </div>

            {/* History */}
            <div>
              <div className={`flex items-center justify-between mb-2`}>
                <p className={`text-xs font-semibold flex items-center gap-1 ${textMuted}`}>
                  <Clock size={11} /> History ({history.length})
                </p>
                {history.length > 0 && (
                  <button onClick={clearHistory} className={`text-xs hover:text-red-400 transition-colors ${textMuted}`}>Clear</button>
                )}
              </div>
              {history.length === 0 ? (
                <p className={`text-xs ${textMuted} py-2`}>Recently played songs appear here.</p>
              ) : (
                history.slice(0, 20).map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    isDark={isDark}
                    itemHover={itemHover}
                    textMuted={textMuted}
                    isFav={isFavorite(song.videoId)}
                    onPlay={() => playNow(song)}
                    onAdd={() => addToQueue({ ...song, id: crypto.randomUUID() })}
                    onFav={() => toggleFavorite(song)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable song row ────────────────────────────────────────────────────────
interface SongRowProps {
  song: Song;
  isDark: boolean;
  itemHover: string;
  textMuted: string;
  isFav: boolean;
  onPlay: () => void;
  onAdd: () => void;
  onFav: () => void;
}

function SongRow({ song, itemHover, textMuted, isFav, onPlay, onAdd, onFav }: SongRowProps) {
  const isDark = false; // unused param guard — keep interface for future use
  void isDark;
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded-lg mb-0.5 group transition-colors ${itemHover}`}>
      <div className="relative shrink-0 cursor-pointer" onClick={onPlay}>
        <img src={song.thumbnail} alt="" className="w-11 h-8 rounded object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded transition-opacity">
          <ChevronRight size={14} className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
        <p className="text-xs font-medium truncate leading-snug">{song.title}</p>
        <p className={`text-xs truncate ${textMuted}`}>{song.channelTitle ?? ''} {song.duration ? `· ${song.duration}` : ''}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onFav} title={isFav ? 'Remove favorite' : 'Add to favorites'} className="p-1 rounded hover:bg-fuchsia-600/20 transition-colors">
          <Heart size={12} className={isFav ? 'fill-pink-500 text-pink-500' : textMuted} />
        </button>
        <button onClick={onAdd} title="Add to queue" className={`p-1 rounded hover:bg-fuchsia-600/20 transition-colors ${textMuted} hover:text-fuchsia-400`}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
