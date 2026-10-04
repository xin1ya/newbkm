/**
 * M1-20 · 程序化音效：界面、脚步、战斗、精灵球、水上骑乘、钓鱼、商店等。
 * 每个音效是一个函数：在给定时间点向目标节点合成一段短声音。
 */
import type { Synth } from './synth';

export type SfxName =
  | 'cursor'
  | 'confirm'
  | 'back'
  | 'error'
  | 'text'
  | 'menu-open'
  | 'menu-close'
  | 'door'
  | 'step-grass'
  | 'step-ground'
  | 'step-wood'
  | 'step-water'
  | 'bump'
  | 'splash'
  | 'surf-mount'
  | 'surf-dismount'
  | 'shiny'
  | 'ball-throw'
  | 'ball-open'
  | 'ball-shake'
  | 'ball-click'
  | 'ball-break'
  | 'hit'
  | 'hit-strong'
  | 'hit-weak'
  | 'faint'
  | 'stat-up'
  | 'stat-down'
  | 'heal'
  | 'exp'
  | 'money'
  | 'emote'
  | 'spotted'
  | 'fish-cast'
  | 'fish-plop'
  | 'fish-nibble'
  | 'fish-bite'
  | 'fish-reel'
  | 'fish-snap'
  | 'fish-escape'
  | 'item'
  | 'save'
  | 'heal-machine'
  | 'run'
  | 'valve'
  | 'jump'
  | 'land'
  | 'bike-bell'
  | 'bike-tick';

type Recipe = (s: Synth, out: AudioNode, t: number, v: number) => void;

function tone(s: Synth, out: AudioNode, t: number, o: { type?: OscillatorType; f0: number; f1?: number; dur: number; gain: number; attack?: number; curve?: 'exp' | 'lin' }): void {
  const ctx = s.ctx;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1 !== undefined) {
    if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0005, t + o.dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
  osc.onended = () => g.disconnect();
}

function noise(s: Synth, out: AudioNode, t: number, o: { type: BiquadFilterType; freq: number; freq1?: number; q?: number; dur: number; gain: number; attack?: number }): void {
  const ctx = s.ctx;
  const n = ctx.createBufferSource();
  n.buffer = s.noise();
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freq1) f.frequency.exponentialRampToValueAtTime(o.freq1, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0005, t + o.dur);
  n.connect(f).connect(g).connect(out);
  n.start(t, Math.random() * 1.5);
  n.stop(t + o.dur + 0.02);
  n.onended = () => g.disconnect();
}

/** 一串短音（琶音） */
function seq(s: Synth, out: AudioNode, t: number, freqs: number[], step: number, o: { type?: OscillatorType; dur?: number; gain: number }): void {
  freqs.forEach((f, i) => tone(s, out, t + i * step, { type: o.type ?? 'square', f0: f, dur: o.dur ?? step * 1.6, gain: o.gain }));
}

const R: Record<SfxName, Recipe> = {
  // M1-11 阀门：金属棘轮咔哒 ×4 + 低沉的水流涌动
  valve: (s, o, t, v) => {
    for (let i = 0; i < 4; i++) {
      noise(s, o, t + i * 0.11, { type: 'bandpass', freq: 3200, q: 6, dur: 0.04, gain: 0.18 * v });
      tone(s, o, t + i * 0.11, { type: 'square', f0: 420 - i * 30, dur: 0.03, gain: 0.05 * v });
    }
    noise(s, o, t + 0.35, { type: 'lowpass', freq: 380, freq1: 900, dur: 1.6, gain: 0.4 * v, attack: 0.4 });
    tone(s, o, t + 0.35, { type: 'sine', f0: 70, f1: 55, dur: 1.4, gain: 0.25 * v, attack: 0.3 });
  },
  cursor: (s, o, t, v) => tone(s, o, t, { type: 'square', f0: 1320, dur: 0.035, gain: 0.08 * v }),
  confirm: (s, o, t, v) => seq(s, o, t, [880, 1320], 0.045, { gain: 0.09 * v }),
  back: (s, o, t, v) => seq(s, o, t, [990, 660], 0.045, { gain: 0.08 * v }),
  error: (s, o, t, v) => seq(s, o, t, [220, 185], 0.08, { type: 'sawtooth', gain: 0.07 * v, dur: 0.1 }),
  text: (s, o, t, v) => tone(s, o, t, { type: 'triangle', f0: 620 + Math.random() * 80, dur: 0.03, gain: 0.05 * v }),
  'menu-open': (s, o, t, v) => seq(s, o, t, [660, 880, 1175], 0.035, { type: 'triangle', gain: 0.12 * v }),
  'menu-close': (s, o, t, v) => seq(s, o, t, [1175, 880, 660], 0.035, { type: 'triangle', gain: 0.1 * v }),
  door: (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 500, dur: 0.18, gain: 0.35 * v });
    tone(s, o, t, { type: 'sine', f0: 140, f1: 70, dur: 0.2, gain: 0.3 * v });
    noise(s, o, t + 0.2, { type: 'bandpass', freq: 2200, q: 3, dur: 0.05, gain: 0.15 * v });
  },
  'step-grass': (s, o, t, v) => noise(s, o, t, { type: 'bandpass', freq: 3200 + Math.random() * 800, q: 0.8, dur: 0.09, gain: 0.07 * v, attack: 0.015 }),
  jump: (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 700, dur: 0.06, gain: 0.08 * v });
    tone(s, o, t, { type: 'sine', f0: 260, f1: 420, dur: 0.12, gain: 0.05 * v });
  },
  'bike-bell': (s, o, t, v) => {
    for (const k of [0, 0.16]) {
      tone(s, o, t + k, { type: 'sine', f0: 2350, dur: 0.5, gain: 0.07 * v, attack: 0.002 });
      tone(s, o, t + k, { type: 'sine', f0: 3120, dur: 0.32, gain: 0.035 * v, attack: 0.002 });
    }
  },
  'bike-tick': (s, o, t, v) => noise(s, o, t, { type: 'highpass', freq: 3800, dur: 0.018, gain: 0.05 * v }),
  land: (s, o, t, v) => noise(s, o, t, { type: 'lowpass', freq: 520, dur: 0.11, gain: 0.16 * v }),
  'step-ground': (s, o, t, v) => noise(s, o, t, { type: 'lowpass', freq: 900 + Math.random() * 300, dur: 0.07, gain: 0.1 * v }),
  'step-wood': (s, o, t, v) => {
    noise(s, o, t, { type: 'bandpass', freq: 700, q: 2, dur: 0.06, gain: 0.12 * v });
    tone(s, o, t, { type: 'sine', f0: 190 + Math.random() * 30, dur: 0.06, gain: 0.08 * v });
  },
  'step-water': (s, o, t, v) => noise(s, o, t, { type: 'bandpass', freq: 1400, freq1: 600, q: 1.5, dur: 0.16, gain: 0.1 * v, attack: 0.02 }),
  bump: (s, o, t, v) => tone(s, o, t, { type: 'sine', f0: 110, f1: 60, dur: 0.12, gain: 0.25 * v }),
  splash: (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 3000, freq1: 400, dur: 0.45, gain: 0.35 * v, attack: 0.01 });
    for (let i = 0; i < 4; i++) tone(s, o, t + 0.05 + i * 0.05, { type: 'sine', f0: 900 + Math.random() * 900, f1: 400, dur: 0.06, gain: 0.05 * v });
  },
  'surf-mount': (s, o, t, v) => {
    seq(s, o, t, [392, 523, 659, 784], 0.05, { type: 'triangle', gain: 0.12 * v });
    noise(s, o, t + 0.2, { type: 'lowpass', freq: 2500, freq1: 300, dur: 0.5, gain: 0.3 * v });
  },
  'surf-dismount': (s, o, t, v) => {
    tone(s, o, t, { type: 'triangle', f0: 400, f1: 800, dur: 0.18, gain: 0.12 * v });
    noise(s, o, t, { type: 'lowpass', freq: 1800, freq1: 300, dur: 0.3, gain: 0.2 * v });
  },
  'shiny': (s, o, t, v) => {
    // 异色闪光：两串上行的清脆高音 + 轻微噪声闪烁
    seq(s, o, t, [1568, 2093, 2637, 3136], 0.06, { type: 'sine', gain: 0.09 * v });
    seq(s, o, t + 0.32, [2093, 2637, 3136, 4186], 0.06, { type: 'triangle', gain: 0.07 * v });
    noise(s, o, t + 0.05, { type: 'highpass', freq: 6000, dur: 0.5, gain: 0.03 * v, attack: 0.05 });
  },
  'ball-throw': (s, o, t, v) => noise(s, o, t, { type: 'bandpass', freq: 800, freq1: 3000, q: 2, dur: 0.3, gain: 0.18 * v, attack: 0.08 }),
  'ball-open': (s, o, t, v) => {
    tone(s, o, t, { type: 'square', f0: 300, f1: 1400, dur: 0.18, gain: 0.08 * v });
    noise(s, o, t + 0.05, { type: 'highpass', freq: 3000, dur: 0.3, gain: 0.12 * v });
  },
  'ball-shake': (s, o, t, v) => {
    tone(s, o, t, { type: 'sine', f0: 260, f1: 180, dur: 0.07, gain: 0.25 * v });
    noise(s, o, t, { type: 'bandpass', freq: 1800, q: 4, dur: 0.05, gain: 0.12 * v });
  },
  'ball-click': (s, o, t, v) => {
    noise(s, o, t, { type: 'bandpass', freq: 2600, q: 6, dur: 0.04, gain: 0.3 * v });
    tone(s, o, t + 0.02, { type: 'square', f0: 1760, dur: 0.05, gain: 0.07 * v });
  },
  'ball-break': (s, o, t, v) => {
    noise(s, o, t, { type: 'highpass', freq: 1500, dur: 0.25, gain: 0.25 * v });
    tone(s, o, t, { type: 'square', f0: 900, f1: 200, dur: 0.25, gain: 0.08 * v });
  },
  hit: (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 2400, freq1: 300, dur: 0.16, gain: 0.4 * v });
    tone(s, o, t, { type: 'square', f0: 180, f1: 60, dur: 0.12, gain: 0.15 * v });
  },
  'hit-strong': (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 5000, freq1: 200, dur: 0.3, gain: 0.55 * v });
    tone(s, o, t, { type: 'sawtooth', f0: 220, f1: 40, dur: 0.28, gain: 0.2 * v });
    tone(s, o, t + 0.06, { type: 'square', f0: 120, f1: 50, dur: 0.2, gain: 0.12 * v });
  },
  'hit-weak': (s, o, t, v) => noise(s, o, t, { type: 'lowpass', freq: 1200, freq1: 300, dur: 0.1, gain: 0.25 * v }),
  faint: (s, o, t, v) => tone(s, o, t, { type: 'square', f0: 880, f1: 110, dur: 0.7, gain: 0.08 * v, curve: 'exp' }),
  'stat-up': (s, o, t, v) => seq(s, o, t, [523, 659, 784, 1047, 1319], 0.05, { type: 'triangle', gain: 0.1 * v }),
  'stat-down': (s, o, t, v) => seq(s, o, t, [1047, 784, 659, 523, 392], 0.05, { type: 'triangle', gain: 0.1 * v }),
  heal: (s, o, t, v) => {
    for (let i = 0; i < 6; i++) tone(s, o, t + i * 0.06, { type: 'sine', f0: 1200 + i * 180 + Math.random() * 60, dur: 0.25, gain: 0.06 * v });
  },
  exp: (s, o, t, v) => tone(s, o, t, { type: 'square', f0: 400, f1: 1600, dur: 0.6, gain: 0.05 * v, curve: 'lin' }),
  money: (s, o, t, v) => {
    seq(s, o, t, [1568, 2093], 0.07, { type: 'square', gain: 0.07 * v, dur: 0.18 });
    noise(s, o, t, { type: 'highpass', freq: 6000, dur: 0.12, gain: 0.08 * v });
  },
  emote: (s, o, t, v) => tone(s, o, t, { type: 'triangle', f0: 700, f1: 1400, dur: 0.12, gain: 0.12 * v }),
  spotted: (s, o, t, v) => seq(s, o, t, [1319, 1319, 1760], 0.06, { type: 'square', gain: 0.1 * v }),
  'fish-cast': (s, o, t, v) => {
    noise(s, o, t, { type: 'bandpass', freq: 3000, freq1: 900, q: 3, dur: 0.35, gain: 0.2 * v, attack: 0.05 });
    tone(s, o, t, { type: 'sine', f0: 2400, f1: 1200, dur: 0.3, gain: 0.03 * v });
  },
  'fish-plop': (s, o, t, v) => {
    tone(s, o, t, { type: 'sine', f0: 700, f1: 200, dur: 0.12, gain: 0.25 * v });
    noise(s, o, t, { type: 'lowpass', freq: 1500, dur: 0.2, gain: 0.12 * v });
  },
  'fish-nibble': (s, o, t, v) => tone(s, o, t, { type: 'sine', f0: 500, f1: 350, dur: 0.07, gain: 0.14 * v }),
  'fish-bite': (s, o, t, v) => {
    seq(s, o, t, [1760, 1760], 0.08, { type: 'square', gain: 0.12 * v, dur: 0.07 });
    noise(s, o, t, { type: 'lowpass', freq: 2500, freq1: 300, dur: 0.4, gain: 0.35 * v });
  },
  'fish-reel': (s, o, t, v) => noise(s, o, t, { type: 'bandpass', freq: 4200, q: 8, dur: 0.025, gain: 0.12 * v }),
  'fish-snap': (s, o, t, v) => {
    noise(s, o, t, { type: 'highpass', freq: 2500, dur: 0.08, gain: 0.4 * v });
    tone(s, o, t, { type: 'sawtooth', f0: 1200, f1: 150, dur: 0.3, gain: 0.08 * v });
  },
  'fish-escape': (s, o, t, v) => {
    noise(s, o, t, { type: 'lowpass', freq: 2000, freq1: 300, dur: 0.35, gain: 0.25 * v });
    seq(s, o, t + 0.1, [523, 440, 349], 0.09, { type: 'triangle', gain: 0.08 * v });
  },
  item: (s, o, t, v) => seq(s, o, t, [784, 988, 1175, 1568], 0.05, { type: 'square', gain: 0.08 * v }),
  save: (s, o, t, v) => seq(s, o, t, [659, 784, 1047], 0.08, { type: 'triangle', gain: 0.12 * v }),
  'heal-machine': (s, o, t, v) => {
    // 恢复机：一只宝可梦一声「嘀」
    tone(s, o, t, { type: 'square', f0: 1046, dur: 0.12, gain: 0.07 * v });
    tone(s, o, t, { type: 'sine', f0: 2093, dur: 0.12, gain: 0.04 * v });
  },
  run: (s, o, t, v) => noise(s, o, t, { type: 'bandpass', freq: 1200, freq1: 4000, q: 1, dur: 0.35, gain: 0.18 * v, attack: 0.05 }),
};

export const SFX_NAMES = Object.keys(R) as SfxName[];

export function playSfxRecipe(name: SfxName, s: Synth, out: AudioNode, t: number, vol = 1): void {
  R[name](s, out, t, vol);
}
