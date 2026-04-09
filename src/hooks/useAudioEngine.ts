/**
 * useAudioEngine
 *
 * Manages the Web Audio API pipeline:
 *   Mic → MicGain → [Echo: Delay+Feedback] → [Reverb: Convolver] → Analyser → Speakers
 *
 * This routes the user's microphone directly to their speakers so they can
 * hear themselves singing alongside the YouTube music. Use headphones to avoid
 * acoustic feedback between mic and speakers.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import type { ReverbPreset } from '../types';
import { createImpulseResponse } from '../utils/impulseResponse';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface AudioEngineState {
  isEnabled: boolean;
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  selectedInputId: string;
  selectedOutputId: string;
  canSetOutputDevice: boolean;   // true only on Chrome 110+
  analyserNode: AnalyserNode | null;
  /** Processed mic audio stream for MediaRecorder — includes all effects */
  micRecordStream: MediaStream | null;
  error: string | null;
}

export interface AudioEngineControls {
  enable: () => Promise<void>;
  disable: () => void;
  setMicVolume: (v: number) => void;
  setMonitorVolume: (v: number) => void;
  setEchoDelay: (v: number) => void;
  setEchoFeedback: (v: number) => void;
  setEchoMix: (v: number) => void;
  setReverbPreset: (p: ReverbPreset) => void;
  setReverbMix: (v: number) => void;
  setMuted: (muted: boolean) => void;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
}

interface GraphNodes {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
  micGain: GainNode;
  delay: DelayNode;
  feedbackGain: GainNode;
  echoWetGain: GainNode;
  convolver: ConvolverNode;
  reverbDryGain: GainNode;
  reverbWetGain: GainNode;
  monitorGain: GainNode;       // headphone / speaker output volume
  masterMute: GainNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
  recordingDest: MediaStreamAudioDestinationNode;
}

export function useAudioEngine(
  initialPreset: ReverbPreset,
  initialMicVolume: number,
  initialMonitorVolume: number,
  initialEchoDelay: number,
  initialEchoFeedback: number,
  initialEchoMix: number,
  initialReverbMix: number,
  initialMuted: boolean,
): [AudioEngineState, AudioEngineControls] {
  const graphRef = useRef<GraphNodes | null>(null);

  const [state, setState] = useState<AudioEngineState>({
    isEnabled: false,
    inputDevices: [],
    outputDevices: [],
    selectedInputId: '',
    selectedOutputId: '',
    canSetOutputDevice: 'setSinkId' in AudioContext.prototype,
    analyserNode: null,
    micRecordStream: null,
    error: null,
  });

  // ── Device enumeration ──────────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      const outputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` }));
      setState(s => ({ ...s, inputDevices: inputs, outputDevices: outputs }));
    } catch {
      // Enumeration may fail without permissions; that's OK
    }
  }, []);

  // ── Build the audio graph ───────────────────────────────────────────────
  const buildGraph = useCallback(
    async (ctx: AudioContext, stream: MediaStream): Promise<GraphNodes> => {
      const source = ctx.createMediaStreamSource(stream);

      // 0. Stereo spreader — mic is mono; duplicate it to both L and R channels so
      //    you hear yourself in BOTH ears (not just the right ear).
      const stereoMerger = ctx.createChannelMerger(2);
      source.connect(stereoMerger, 0, 0);   // mono → left channel
      source.connect(stereoMerger, 0, 1);   // mono → right channel

      // 1. Input gain (mic volume 0-4)
      const micGain = ctx.createGain();
      micGain.gain.value = initialMicVolume;

      // 2. Echo: delay node + feedback loop
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = initialEchoDelay;

      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = initialEchoFeedback;

      // Echo wet mix (how much delay is heard)
      const echoWetGain = ctx.createGain();
      echoWetGain.gain.value = initialEchoMix;

      // 3. Reverb: convolver + dry/wet mix
      const convolver = ctx.createConvolver();
      convolver.buffer = createImpulseResponse(ctx, initialPreset);

      const reverbWetGain = ctx.createGain();
      reverbWetGain.gain.value = initialPreset === 'off' ? 0 : initialReverbMix;

      const reverbDryGain = ctx.createGain();
      reverbDryGain.gain.value = initialPreset === 'off' ? 1 : 1 - initialReverbMix;

      // 4. Monitor gain — controls how loud you hear yourself in headphones (0-3)
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = initialMonitorVolume;

      // 5. Master mute (gain 0 = muted, 1 = unmuted)
      const masterMute = ctx.createGain();
      masterMute.gain.value = initialMuted ? 0 : 1;

      // 6. Limiter/compressor to prevent clipping at high gains
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;   // start compressing at -18 dBFS
      compressor.knee.value = 6;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;

      // 7. Analyser for VU meter
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // ── Wire everything up ──────────────────────────────────────────────
      // Stereo mic → micGain
      stereoMerger.connect(micGain);

      // Echo chain:
      //   micGain → delay → feedbackGain → delay  (feedback loop creates repeats)
      //   micGain → delay → echoWetGain  (wet echo output)
      micGain.connect(delay);
      delay.connect(feedbackGain);
      feedbackGain.connect(delay);          // feedback loop
      delay.connect(echoWetGain);

      // Both dry (micGain) and wet echo connect to reverb inputs
      micGain.connect(convolver);
      micGain.connect(reverbDryGain);
      echoWetGain.connect(convolver);
      echoWetGain.connect(reverbDryGain);

      // Reverb outputs → monitorGain → masterMute → compressor → analyser → speakers
      convolver.connect(reverbWetGain);
      reverbWetGain.connect(monitorGain);
      reverbDryGain.connect(monitorGain);
      monitorGain.connect(masterMute);
      masterMute.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      // Recording tap: tapped BEFORE monitorGain and masterMute so that:
      //  - Muting the mic monitor does NOT silence the recording
      //  - Cranking headphone volume does NOT distort the recorded level
      //  - All effects (gain, echo, reverb) ARE included in the recording
      const recordingDest = ctx.createMediaStreamDestination();
      reverbWetGain.connect(recordingDest);
      reverbDryGain.connect(recordingDest);

      return { ctx, source, stream, micGain, delay, feedbackGain, echoWetGain, convolver, reverbDryGain, reverbWetGain, monitorGain, masterMute, compressor, analyser, recordingDest };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Enable mic ─────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    try {
      // Tear down any existing graph
      graphRef.current?.stream.getTracks().forEach(t => t.stop());
      graphRef.current?.ctx.close();
      graphRef.current = null;

      const inputId = state.selectedInputId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: inputId ? { exact: inputId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      // Set output device if supported and selected
      if ('setSinkId' in ctx && state.selectedOutputId) {
        await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(state.selectedOutputId);
      }

      const graph = await buildGraph(ctx, stream);
      graphRef.current = graph;

      // After getting mic permission, re-enumerate for proper labels
      await refreshDevices();

      setState(s => ({ ...s, isEnabled: true, analyserNode: graph.analyser, micRecordStream: graph.recordingDest.stream, error: null }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setState(s => ({ ...s, isEnabled: false, analyserNode: null, micRecordStream: null, error: msg }));
    }
  }, [state.selectedInputId, state.selectedOutputId, buildGraph, refreshDevices]);

  // ── Disable mic ────────────────────────────────────────────────────────
  const disable = useCallback(() => {
    graphRef.current?.stream.getTracks().forEach(t => t.stop());
    graphRef.current?.ctx.close();
    graphRef.current = null;
    setState(s => ({ ...s, isEnabled: false, analyserNode: null, micRecordStream: null, error: null }));
  }, []);

  // ── Real-time parameter setters ────────────────────────────────────────
  const setMicVolume = useCallback((v: number) => {
    if (graphRef.current) graphRef.current.micGain.gain.setTargetAtTime(v, graphRef.current.ctx.currentTime, 0.01);
  }, []);

  const setMonitorVolume = useCallback((v: number) => {
    if (graphRef.current) graphRef.current.monitorGain.gain.setTargetAtTime(v, graphRef.current.ctx.currentTime, 0.01);
  }, []);

  const setEchoDelay = useCallback((v: number) => {
    if (graphRef.current) graphRef.current.delay.delayTime.setTargetAtTime(v, graphRef.current.ctx.currentTime, 0.01);
  }, []);

  const setEchoFeedback = useCallback((v: number) => {
    if (graphRef.current) graphRef.current.feedbackGain.gain.setTargetAtTime(Math.min(v, 0.7), graphRef.current.ctx.currentTime, 0.01);
  }, []);

  const setEchoMix = useCallback((v: number) => {
    if (graphRef.current) graphRef.current.echoWetGain.gain.setTargetAtTime(v, graphRef.current.ctx.currentTime, 0.01);
  }, []);

  const setReverbPreset = useCallback((preset: ReverbPreset) => {
    if (!graphRef.current) return;
    graphRef.current.convolver.buffer = createImpulseResponse(graphRef.current.ctx, preset);
  }, []);

  const setReverbMix = useCallback((v: number) => {
    if (!graphRef.current) return;
    const t = graphRef.current.ctx.currentTime;
    graphRef.current.reverbWetGain.gain.setTargetAtTime(v, t, 0.01);
    graphRef.current.reverbDryGain.gain.setTargetAtTime(1 - v, t, 0.01);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (graphRef.current)
      graphRef.current.masterMute.gain.setTargetAtTime(muted ? 0 : 1, graphRef.current.ctx.currentTime, 0.01);
  }, []);

  // ── Device switching ────────────────────────────────────────────────────
  const setInputDevice = useCallback(async (deviceId: string) => {
    setState(s => ({ ...s, selectedInputId: deviceId }));
    // Note: caller (MicControls) is responsible for calling disable()+enable()
    // after a device change to rebuild the graph with the new deviceId.
  }, []);

  const setOutputDevice = useCallback(async (deviceId: string) => {
    setState(s => ({ ...s, selectedOutputId: deviceId }));
    if (graphRef.current && 'setSinkId' in graphRef.current.ctx) {
      try {
        await (graphRef.current.ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId);
      } catch {
        // Ignore setSinkId errors
      }
    }
  }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      graphRef.current?.stream.getTracks().forEach(t => t.stop());
      graphRef.current?.ctx.close();
    };
  }, [refreshDevices]);

  return [
    state,
    {
      enable,
      disable,
      setMicVolume,
      setMonitorVolume,
      setEchoDelay,
      setEchoFeedback,
      setEchoMix,
      setReverbPreset,
      setReverbMix,
      setMuted,
      setInputDevice,
      setOutputDevice,
      refreshDevices,
    },
  ];
}
