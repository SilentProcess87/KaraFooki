import { useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, Speaker, AlertTriangle,
  Radio, Waves,
} from 'lucide-react';
import { useKaraokeStore } from '../stores/useKaraokeStore';
import type { AudioEngineState, AudioEngineControls } from '../hooks/useAudioEngine';
import type { ReverbPreset } from '../types';

interface Props {
  audioState: AudioEngineState;
  audioControls: AudioEngineControls;
}

const REVERB_PRESETS: { id: ReverbPreset; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'small', label: 'Room' },
  { id: 'hall', label: 'Hall' },
  { id: 'cathedral', label: 'Cathedral' },
];

export function MicControls({ audioState, audioControls }: Props) {
  const theme = useKaraokeStore(s => s.theme);
  const isDark = theme === 'dark';

  const micVolume     = useKaraokeStore(s => s.micVolume);
  const monitorVolume = useKaraokeStore(s => s.monitorVolume);
  const echoDelay     = useKaraokeStore(s => s.echoDelay);
  const echoFeedback  = useKaraokeStore(s => s.echoFeedback);
  const echoMix       = useKaraokeStore(s => s.echoMix);
  const reverbPreset  = useKaraokeStore(s => s.reverbPreset);
  const reverbMix     = useKaraokeStore(s => s.reverbMix);
  const micMuted      = useKaraokeStore(s => s.micMuted);

  const setMicVolume     = useKaraokeStore(s => s.setMicVolume);
  const setMonitorVolume = useKaraokeStore(s => s.setMonitorVolume);
  const setEchoDelay     = useKaraokeStore(s => s.setEchoDelay);
  const setEchoFeedback  = useKaraokeStore(s => s.setEchoFeedback);
  const setEchoMix       = useKaraokeStore(s => s.setEchoMix);
  const setReverbPreset  = useKaraokeStore(s => s.setReverbPreset);
  const setReverbMix     = useKaraokeStore(s => s.setReverbMix);
  const setMicMuted      = useKaraokeStore(s => s.setMicMuted);

  // VU meter canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // ── VU meter animation ──────────────────────────────────────────────────
  const drawMeter = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = audioState.analyserNode;
    if (!canvas || !analyser) {
      animFrameRef.current = requestAnimationFrame(drawMeter);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const peak = Math.max(...data);
    const level = peak / 255;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const barCount = Math.floor(W / 5);
    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor((i / barCount) * data.length);
      const barHeight = (data[freqIndex] / 255) * H;
      const hue = 140 + (i / barCount) * 200;   // green → purple
      ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.85)`;
      ctx.fillRect(i * 5, H - barHeight, 4, barHeight);
    }

    // Peak line
    ctx.fillStyle = level > 0.85 ? '#f87171' : '#a855f7';
    ctx.fillRect(0, H - level * H - 1, W, 2);

    // RMS label (unused but avg used to avoid lint)
    void avg;

    animFrameRef.current = requestAnimationFrame(drawMeter);
  }, [audioState.analyserNode]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawMeter);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawMeter]);

  // ── Sync store values to audio engine when engine is active ────────────
  useEffect(() => { if (audioState.isEnabled) audioControls.setMicVolume(micVolume); }, [micVolume, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setMonitorVolume(monitorVolume); }, [monitorVolume, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setEchoDelay(echoDelay); }, [echoDelay, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setEchoFeedback(echoFeedback); }, [echoFeedback, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setEchoMix(echoMix); }, [echoMix, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setReverbPreset(reverbPreset); }, [reverbPreset, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setReverbMix(reverbMix); }, [reverbMix, audioState.isEnabled]);
  useEffect(() => { if (audioState.isEnabled) audioControls.setMuted(micMuted); }, [micMuted, audioState.isEnabled]);

  // ── Device change → re-enable to apply new device ─────────────────────
  const handleInputDeviceChange = async (id: string) => {
    await audioControls.setInputDevice(id);
    if (audioState.isEnabled) {
      await audioControls.disable();
      // Small delay to let stream stop cleanly
      setTimeout(() => audioControls.enable(), 80);
    }
  };

  const handleOutputDeviceChange = async (id: string) => {
    await audioControls.setOutputDevice(id);
  };

  // Theme
  const bg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const selectCls = isDark
    ? 'bg-gray-800 border-gray-700 text-gray-200 focus:ring-fuchsia-500'
    : 'bg-gray-50 border-gray-200 text-gray-800 focus:ring-fuchsia-500';

  const micBtnCls = audioState.isEnabled
    ? micMuted
      ? 'bg-orange-600 hover:bg-orange-500 text-white'
      : 'bg-green-600 hover:bg-green-500 text-white'
    : isDark
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
    : 'bg-gray-200 hover:bg-gray-300 text-gray-700';

  return (
    <div className={`shrink-0 border-t ${bg} px-4 py-2 flex flex-col gap-2`}>

      {/* ══ Row 1: Devices + enable/mute (never overlaps sliders) ══════════ */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Mic device selector */}
        <div className="flex items-center gap-1.5" style={{ minWidth: 200, flex: '1 1 200px' }}>
          <Mic size={12} className={`${textMuted} shrink-0`} />
          <select
            value={audioState.selectedInputId}
            onChange={e => handleInputDeviceChange(e.target.value)}
            className={`flex-1 min-w-0 text-xs py-1 px-1.5 rounded border outline-none focus:ring-1 ${selectCls}`}
            title="Microphone input device"
          >
            {audioState.inputDevices.length === 0 ? (
              <option value="">Default microphone</option>
            ) : (
              audioState.inputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))
            )}
          </select>
        </div>

        {/* Speaker / output selector (Chrome 110+ only) */}
        {audioState.canSetOutputDevice && (
          <div className="flex items-center gap-1.5" style={{ minWidth: 200, flex: '1 1 200px' }}>
            <Speaker size={12} className={`${textMuted} shrink-0`} />
            <select
              value={audioState.selectedOutputId}
              onChange={e => handleOutputDeviceChange(e.target.value)}
              className={`flex-1 min-w-0 text-xs py-1 px-1.5 rounded border outline-none focus:ring-1 ${selectCls}`}
              title="Audio output device (mic monitoring)"
            >
              {audioState.outputDevices.length === 0 ? (
                <option value="">Default speakers</option>
              ) : (
                audioState.outputDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Enable / mute */}
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => audioState.isEnabled ? audioControls.disable() : audioControls.enable()}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${micBtnCls}`}
          >
            {audioState.isEnabled
              ? micMuted ? <><MicOff size={12} /> Muted</> : <><Mic size={12} /> Live</>
              : <><Mic size={12} /> Enable Mic</>}
          </button>
          {audioState.isEnabled && (
            <button
              onClick={() => setMicMuted(!micMuted)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                micMuted
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title={micMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {micMuted ? <MicOff size={12} /> : <MicOff size={12} className="opacity-40" />}
            </button>
          )}
        </div>

        {/* Inline notices */}
        {audioState.error && (
          <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
            <AlertTriangle size={11} />{audioState.error}
          </span>
        )}
        {audioState.isEnabled && !micMuted && (
          <span className={`flex items-center gap-1 text-xs shrink-0 ${textMuted}`}>
            <AlertTriangle size={10} className="text-yellow-500" />
            Use headphones to avoid feedback
          </span>
        )}
      </div>

      {/* ══ Row 2: Effect sliders + VU meter (separate from devices above) ══ */}
      <div className="flex items-center gap-4">

        {/* Sliders in a 2-column grid */}
        <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1.5 min-w-0">

          <SliderRow
            label="Headphones"
            icon={<Volume2 size={11} className="text-fuchsia-400" />}
            value={monitorVolume} min={0} max={3} step={0.02}
            display={`${Math.round(monitorVolume * 100)}%`}
            onChange={v => { setMonitorVolume(v); audioControls.setMonitorVolume(v); }}
            textMuted={textMuted} highlight
          />

          <SliderRow
            label="Mic Gain"
            icon={<Mic size={11} className="text-green-400" />}
            value={micVolume} min={0} max={4} step={0.02}
            display={`${Math.round(micVolume * 100)}%`}
            onChange={v => { setMicVolume(v); audioControls.setMicVolume(v); }}
            textMuted={textMuted}
          />

          <SliderRow
            label="Echo"
            icon={<Radio size={11} />}
            value={echoMix} min={0} max={1} step={0.01}
            display={`${Math.round(echoMix * 100)}%`}
            onChange={v => { setEchoMix(v); audioControls.setEchoMix(v); }}
            textMuted={textMuted}
          />

          <SliderRow
            label="Delay"
            icon={<Radio size={11} className="opacity-60" />}
            value={echoDelay} min={0.05} max={0.9} step={0.01}
            display={`${Math.round(echoDelay * 1000)}ms`}
            onChange={v => { setEchoDelay(v); audioControls.setEchoDelay(v); }}
            textMuted={textMuted}
          />

          <SliderRow
            label="Repeat"
            icon={<Waves size={11} />}
            value={echoFeedback} min={0} max={0.7} step={0.01}
            display={`${Math.round(echoFeedback * 100)}%`}
            onChange={v => { setEchoFeedback(v); audioControls.setEchoFeedback(v); }}
            textMuted={textMuted}
          />

          <SliderRow
            label="Reverb"
            icon={<Waves size={11} />}
            value={reverbMix} min={0} max={1} step={0.01}
            display={`${Math.round(reverbMix * 100)}%`}
            onChange={v => { setReverbMix(v); audioControls.setReverbMix(v); }}
            textMuted={textMuted}
          />

          {/* Space presets span both columns */}
          <div className="col-span-2 flex items-center gap-2 pt-0.5">
            <span className={`text-xs font-medium shrink-0 ${textMuted}`}>Space</span>
            {REVERB_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setReverbPreset(p.id);
                  if (p.id === 'off') { setReverbMix(0); audioControls.setReverbMix(0); }
                  else if (reverbMix === 0) { setReverbMix(0.25); audioControls.setReverbMix(0.25); }
                  audioControls.setReverbPreset(p.id);
                }}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  reverbPreset === p.id
                    ? 'bg-fuchsia-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* VU meter */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className={`text-xs font-medium ${textMuted}`}>Level</span>
          <canvas
            ref={canvasRef}
            width={88}
            height={56}
            className="rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

      </div>
    </div>
  );
}

// ── Slider row helper ────────────────────────────────────────────────────────
interface SliderRowProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  textMuted: string;
  highlight?: boolean;
}

function SliderRow({ label, icon, value, min, max, step, display, onChange, textMuted, highlight }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackColor = highlight
    ? `linear-gradient(to right, #c026d3 ${pct}%, rgba(255,255,255,.18) ${pct}%)`
    : `linear-gradient(to right, #9ca3af ${pct}%, rgba(255,255,255,.18) ${pct}%)`;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium flex items-center gap-1 ${highlight ? 'text-fuchsia-400' : textMuted}`}>
          {icon} {label}
        </span>
        <span className={`text-xs tabular-nums font-semibold ${highlight ? 'text-fuchsia-400' : textMuted}`}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ background: trackColor }}
      />
    </div>
  );
}
