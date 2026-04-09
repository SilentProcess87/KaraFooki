import type { Song } from '../types';

const YT_API = 'https://www.googleapis.com/youtube/v3';

/** Extracts a YouTube video ID from various URL formats or plain IDs. */
export function extractVideoId(input: string): string | null {
  input = input.trim();

  // Already a bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  // youtu.be/ID
  const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=ID  (or &v= anywhere)
  const longMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (longMatch) return longMatch[1];

  // youtube.com/embed/ID
  const embedMatch = input.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  return null;
}

/** Converts an ISO 8601 duration (PT3M45S) to a human-readable string (3:45). */
export function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || '0');
  const min = parseInt(m[2] || '0');
  const s = parseInt(m[3] || '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

/** Searches YouTube via the Data API v3. Requires a valid API key. */
export async function searchYouTube(query: string, apiKey: string): Promise<Song[]> {
  const searchRes = await fetch(
    `${YT_API}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&key=${encodeURIComponent(apiKey)}&maxResults=12`
  );

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Search failed (${searchRes.status})`);
  }

  const searchData = await searchRes.json() as {
    items: Array<{
      id: { videoId: string };
      snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
    }>;
  };

  const videoIds = searchData.items.map(i => i.id.videoId).join(',');

  // Fetch durations in a second request
  let durations = new Map<string, string>();
  try {
    const detailRes = await fetch(
      `${YT_API}/videos?part=contentDetails&id=${videoIds}&key=${encodeURIComponent(apiKey)}`
    );
    if (detailRes.ok) {
      const detailData = await detailRes.json() as {
        items: Array<{ id: string; contentDetails: { duration: string } }>;
      };
      durations = new Map(detailData.items.map(i => [i.id, parseDuration(i.contentDetails.duration)]));
    }
  } catch {
    // Duration fetch failing is non-critical
  }

  return searchData.items.map(item => ({
    id: crypto.randomUUID(),
    videoId: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    thumbnail: item.snippet.thumbnails.default.url,
    channelTitle: item.snippet.channelTitle,
    duration: durations.get(item.id.videoId) ?? '',
  }));
}

/** Decodes HTML entities returned by the YouTube API (e.g. &amp; → &). */
function decodeHtmlEntities(str: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
