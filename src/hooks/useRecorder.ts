/**
 * useRecorder
 *
 * Records karaoke performances in two modes:
 *
 *  Mix (default):
 *    Combines mic (from Web Audio API) + YouTube music (via tab audio capture)
 *    into a single stereo WebM/Opus file.
 *
 *  Split Channels:
 *    Records mic and music to two separate files so you can import them as
 *    individual tracks in a DAW (Audacity, Reaper, GarageBand, etc.)
 *
 * Tab audio capture uses getDisplayMedia. Chrome/Edge will show a
 * "Choose what to share" dialog — select THIS tab and tick "Share tab audio".
 */
import { useState, useRef, useCallback } from 'react';

export type RecordMode = 'mix' | 'split';

export interface RecordingTrack {
  id: string;
  filename: string;
  url: string;
  type: 'mix' | 'mic' | 'music';
  bytes: number;
  durationSec: number;
}

export interface RecorderState {
  isRecording: boolean;
  mode: RecordMode;
  elapsedSec: number;
  tracks: RecordingTrack[];
  error: string | null;
  captureNote: string | null;
}

export interface RecorderControls {
  start: () => Promise<void>;
  stop: () => void;
  setMode: (m: RecordMode) => void;
  download: (track: RecordingTrack) => void;
  remove: (id: string) => void;
}

// ── Tab audio capture ────────────────────────────────────────────────────────
async function captureTabAudio(): Promise<MediaStream | null> {
  try {
    const gdm = (navigator.mediaDevices as unknown as Record<string, unknown>).getDisplayMedia as
      | ((c: object) => Promise<MediaStream>)
      | undefined;
    if (!gdm) return null;

    const stream = await gdm.call(navigator.mediaDevices, {
      audio: {
        suppressLocalAudioPlayback: false,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: { width: 1, height: 1, frameRate: 1 },
      // Chrome 109+: auto-selects the current tab without extra UX
      preferCurrentTab: true,
    });

    // Keep only audio tracks; discard any video
    stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t); });

    return stream.getAudioTracks().length > 0 ? stream : null;
  } catch {
    return null;
  }
}

// ── Pick best supported MIME type ────────────────────────────────────────────
function bestMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? '';
}

function makeExt(mime: string) {
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useRecorder(micStream: MediaStream | null): [RecorderState, RecorderControls] {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<RecordMode>('mix');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tracks, setTracks] = useState<RecordingTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [captureNote, setCaptureNote] = useState<string | null>(null);

  const recordersRef = useRef<MediaRecorder[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const recCtxRef = useRef<AudioContext | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const addTrack = useCallback((blob: Blob, type: RecordingTrack['type']) => {
    const durationSec = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const ext = makeExt(blob.type);
    const url = URL.createObjectURL(blob);
    setTracks(prev => [...prev, {
      id: crypto.randomUUID(),
      filename: `karafooki-${type}-${ts}.${ext}`,
      url,
      type,
      bytes: blob.size,
      durationSec,
    }]);
  }, []);

  const makeRecorder = useCallback((stream: MediaStream, type: RecordingTrack['type']): MediaRecorder => {
    const mime = bestMime();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      addTrack(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), type);
      // Close the recording mix context once all recorders are done
      if (recordersRef.current.every(r => r.state === 'inactive')) {
        recCtxRef.current?.close();
        recCtxRef.current = null;
        displayStreamRef.current?.getTracks().forEach(t => t.stop());
        displayStreamRef.current = null;
      }
    };
    return rec;
  }, [addTrack]);

  // ── stop ───────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    recordersRef.current.forEach(r => { if (r.state === 'recording') r.stop(); });
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
  }, []);

  // ── start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!micStream) {
      setError('Enable your microphone first, then click Record.');
      return;
    }
    setError(null);
    setCaptureNote(null);
    recordersRef.current = [];

    try {
      // ── Grab tab audio ─────────────────────────────────────────────────────
      const displayStream = await captureTabAudio();
      displayStreamRef.current = displayStream;

      if (!displayStream) {
        setCaptureNote('Tab audio not available – recording mic only. To capture music too, use Chrome/Edge and share this tab with audio when prompted.');
      }

      if (mode === 'mix') {
        // Mix mic + music into a single stereo stream via a temporary AudioContext
        const recCtx = new AudioContext();
        recCtxRef.current = recCtx;
        const dest = recCtx.createMediaStreamDestination();

        recCtx.createMediaStreamSource(micStream).connect(dest);
        if (displayStream) recCtx.createMediaStreamSource(displayStream).connect(dest);

        const rec = makeRecorder(dest.stream, 'mix');
        recordersRef.current = [rec];
        rec.start(200);

      } else {
        // Split: two independent MediaRecorder instances
        const micRec = makeRecorder(micStream, 'mic');
        recordersRef.current = [micRec];
        micRec.start(200);

        if (displayStream) {
          const musicRec = makeRecorder(displayStream, 'music');
          recordersRef.current.push(musicRec);
          musicRec.start(200);
        }
      }

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsedSec(0);
      timerRef.current = window.setInterval(
        () => setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000)),
        500,
      );

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  }, [micStream, mode, makeRecorder]);

  // ── download / remove ──────────────────────────────────────────────────────
  const download = useCallback((track: RecordingTrack) => {
    const a = document.createElement('a');
    a.href = track.url;
    a.download = track.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const remove = useCallback((id: string) => {
    setTracks(prev => {
      const t = prev.find(x => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  return [
    { isRecording, mode, elapsedSec, tracks, error, captureNote },
    { start, stop, setMode, download, remove },
  ];
}
