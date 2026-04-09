import type { ReverbPreset } from '../types';

interface PresetConfig {
  duration: number;
  decay: number;
}

const PRESETS: Record<ReverbPreset, PresetConfig> = {
  off:       { duration: 0.01, decay: 10.0 },
  small:     { duration: 0.4,  decay: 3.0  },
  hall:      { duration: 1.6,  decay: 2.0  },
  cathedral: { duration: 4.0,  decay: 1.4  },
};

/** Procedurally generates a stereo impulse response buffer for the given reverb preset. */
export function createImpulseResponse(ctx: AudioContext, preset: ReverbPreset): AudioBuffer {
  const { duration, decay } = PRESETS[preset];
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, decay);
    }
  }

  return buffer;
}
