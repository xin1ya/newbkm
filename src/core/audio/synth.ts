/**
 * M1-20 · WebAudio 合成器：12 种乐器音色 + 7 种鼓，全部实时合成（无需音频文件）。
 * 每个音符创建一组短命节点（振荡器 → 滤波 → 包络增益 → 声部增益），播完自动断开。
 */
import { midiToFreq, type DrumHit, type InstrumentId } from '@/systems/audio/music';

interface Env {
  a: number;
  d: number;
  s: number;
  r: number;
}

const ENV: Record<InstrumentId, Env> = {
  lead: { a: 0.005, d: 0.08, s: 0.62, r: 0.07 },
  square: { a: 0.005, d: 0.1, s: 0.5, r: 0.05 },
  triangle: { a: 0.01, d: 0.1, s: 0.8, r: 0.08 },
  flute: { a: 0.045, d: 0.12, s: 0.8, r: 0.14 },
  pluck: { a: 0.002, d: 0.35, s: 0.0, r: 0.12 },
  bell: { a: 0.002, d: 1.3, s: 0.0, r: 0.4 },
  marimba: { a: 0.002, d: 0.55, s: 0.0, r: 0.1 },
  pad: { a: 0.45, d: 0.3, s: 0.8, r: 0.7 },
  strings: { a: 0.12, d: 0.2, s: 0.85, r: 0.28 },
  brass: { a: 0.04, d: 0.16, s: 0.75, r: 0.1 },
  organ: { a: 0.01, d: 0.05, s: 1, r: 0.06 },
  bass: { a: 0.005, d: 0.15, s: 0.72, r: 0.06 },
};

/** 各乐器的响度校正（不同波形能量差异很大） */
const LOUD: Record<InstrumentId, number> = {
  lead: 0.32,
  square: 0.26,
  triangle: 0.7,
  flute: 0.75,
  pluck: 0.4,
  bell: 0.55,
  marimba: 0.7,
  pad: 0.22,
  strings: 0.24,
  brass: 0.3,
  organ: 0.3,
  bass: 0.62,
};

export class Synth {
  private waves = new Map<string, PeriodicWave>();
  private noiseBuf: AudioBuffer | null = null;
  /** 当前存活的音符数（性能监控 / 测试） */
  live = 0;

  constructor(readonly ctx: AudioContext) {}

  private pulse(duty: number): PeriodicWave {
    const key = `p${duty}`;
    let w = this.waves.get(key);
    if (!w) {
      const n = 40;
      const re = new Float32Array(n);
      const im = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
        im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
      }
      w = this.ctx.createPeriodicWave(re, im);
      this.waves.set(key, w);
    }
    return w;
  }

  private organWave(): PeriodicWave {
    let w = this.waves.get('organ');
    if (!w) {
      const im = new Float32Array([0, 1, 0.55, 0.32, 0.22, 0, 0.12, 0, 0.08]);
      w = this.ctx.createPeriodicWave(new Float32Array(im.length), im);
      this.waves.set('organ', w);
    }
    return w;
  }

  noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate * 2;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.noiseBuf = b;
    }
    return this.noiseBuf;
  }

  private envelope(g: GainNode, t: number, dur: number, peak: number, e: Env): number {
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + e.a);
    const sus = Math.max(0.0001, peak * e.s);
    const dEnd = t + e.a + e.d;
    if (e.s <= 0) {
      // 打击类：自然衰减，不受时值限制太多
      p.setTargetAtTime(0.0001, t + e.a, e.d / 3);
      return t + Math.max(dur, e.a + e.d) + e.r;
    }
    if (dEnd < t + dur) {
      p.linearRampToValueAtTime(sus, dEnd);
      p.setValueAtTime(sus, t + dur);
    } else p.linearRampToValueAtTime(sus, t + dur);
    p.setTargetAtTime(0.0001, t + dur, e.r / 3);
    return t + dur + e.r * 1.5;
  }

  private osc(type: OscillatorType | PeriodicWave, freq: number, t: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (type instanceof PeriodicWave) o.setPeriodicWave(type);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  private vibrato(target: AudioParam, t: number, rate: number, cents: number, delay: number, end: number): OscillatorNode {
    const l = this.ctx.createOscillator();
    l.frequency.value = rate;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(cents, t + delay + 0.1);
    lg.gain.setValueAtTime(cents, end);
    l.connect(lg).connect(target);
    return l;
  }

  private finish(nodes: AudioScheduledSourceNode[], end: number, out: AudioNode[]): void {
    this.live++;
    const first = nodes[0];
    for (const n of nodes) n.stop(end);
    if (first)
      first.onended = () => {
        this.live--;
        for (const n of out) n.disconnect();
      };
  }

  /** 播放一个音（midi 可为和弦） */
  note(inst: InstrumentId, midi: number, t: number, dur: number, vel: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const e = ENV[inst];
    const g = ctx.createGain();
    const peak = LOUD[inst] * vel;
    const end = this.envelope(g, t, dur, peak, e);
    g.connect(dest);
    const cleanup: AudioNode[] = [g];
    const srcs: AudioScheduledSourceNode[] = [];
    switch (inst) {
      case 'lead': {
        const o = this.osc(this.pulse(0.25), f, t);
        srcs.push(o, this.vibrato(o.detune, t, 5.6, 7, 0.18, end));
        o.connect(g);
        break;
      }
      case 'square': {
        const o = this.osc(this.pulse(0.5), f, t);
        o.connect(g);
        srcs.push(o);
        break;
      }
      case 'triangle': {
        const o = this.osc('triangle', f, t);
        o.connect(g);
        srcs.push(o);
        break;
      }
      case 'flute': {
        const o = this.osc('sine', f, t);
        const o2 = this.osc('triangle', f * 2, t);
        const g2 = ctx.createGain();
        g2.gain.value = 0.12;
        o2.connect(g2).connect(g);
        o.connect(g);
        // 气声
        const n = ctx.createBufferSource();
        n.buffer = this.noise();
        n.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f * 2;
        bp.Q.value = 2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.25, t);
        ng.gain.exponentialRampToValueAtTime(0.03, t + 0.12);
        n.connect(bp).connect(ng).connect(g);
        srcs.push(o, o2, n, this.vibrato(o.detune, t, 5, 9, 0.25, end));
        cleanup.push(g2, bp, ng);
        break;
      }
      case 'pluck': {
        const o = this.osc('sawtooth', f, t);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 3;
        lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
        lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + 0.3);
        o.connect(lp).connect(g);
        srcs.push(o);
        cleanup.push(lp);
        break;
      }
      case 'bell': {
        const c = this.osc('sine', f, t);
        const m = this.osc('sine', f * 3.5, t);
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 5, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 1.1);
        m.connect(mg).connect(c.frequency);
        c.connect(g);
        srcs.push(c, m);
        cleanup.push(mg);
        break;
      }
      case 'marimba': {
        const o = this.osc('sine', f, t);
        const o4 = this.osc('sine', f * 4, t);
        const g4 = ctx.createGain();
        g4.gain.setValueAtTime(0.35, t);
        g4.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o4.connect(g4).connect(g);
        o.connect(g);
        srcs.push(o, o4);
        cleanup.push(g4);
        break;
      }
      case 'pad':
      case 'strings': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = inst === 'pad' ? 1300 : 2600;
        lp.connect(g);
        for (const det of inst === 'pad' ? [-8, 8] : [-5, 6]) {
          const o = this.osc('sawtooth', f, t);
          o.detune.value = det;
          o.connect(lp);
          srcs.push(o);
        }
        if (inst === 'strings') srcs.push(this.vibrato((srcs[0] as OscillatorNode).detune, t, 5.2, 6, 0.3, end));
        cleanup.push(lp);
        break;
      }
      case 'brass': {
        const o = this.osc('sawtooth', f, t);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 1.5;
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.linearRampToValueAtTime(Math.min(6000, f * 6), t + 0.06);
        lp.frequency.linearRampToValueAtTime(Math.min(3500, f * 3.5), t + 0.25);
        o.connect(lp).connect(g);
        srcs.push(o, this.vibrato(o.detune, t, 5, 5, 0.25, end));
        cleanup.push(lp);
        break;
      }
      case 'organ': {
        const o = this.osc(this.organWave(), f, t);
        o.connect(g);
        srcs.push(o);
        break;
      }
      case 'bass': {
        const o = this.osc('triangle', f, t);
        const o2 = this.osc(this.pulse(0.5), f, t);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        o2.connect(g2).connect(lp);
        o.connect(lp).connect(g);
        srcs.push(o, o2);
        cleanup.push(lp, g2);
        break;
      }
    }
    for (const s of srcs) s.start(t);
    this.finish(srcs, end + 0.05, cleanup);
  }

  drum(hit: DrumHit, t: number, vel: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(dest);
    const cleanup: AudioNode[] = [g];
    const srcs: AudioScheduledSourceNode[] = [];
    const noise = (type: BiquadFilterType, freq: number, q: number, dur: number, level: number, at = t) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise();
      n.playbackRate.value = 0.9 + Math.random() * 0.2;
      const flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = freq;
      flt.Q.value = q;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(level * vel, at);
      ng.gain.exponentialRampToValueAtTime(0.0008, at + dur);
      n.connect(flt).connect(ng).connect(g);
      n.start(at, Math.random() * 1.5);
      srcs.push(n);
      cleanup.push(flt, ng);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, level: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
      const og = ctx.createGain();
      og.gain.setValueAtTime(level * vel, t);
      og.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(og).connect(g);
      o.start(t);
      srcs.push(o);
      cleanup.push(og);
    };
    let len = 0.3;
    switch (hit) {
      case 'k':
        tone('sine', 150, 42, 0.28, 1.1);
        noise('lowpass', 900, 1, 0.02, 0.3);
        break;
      case 's':
        noise('bandpass', 1900, 0.8, 0.16, 0.9);
        tone('triangle', 200, 150, 0.09, 0.5);
        break;
      case 'h':
        noise('highpass', 7500, 0.7, 0.045, 0.5);
        len = 0.08;
        break;
      case 'o':
        noise('highpass', 6500, 0.7, 0.28, 0.45);
        break;
      case 't':
        tone('sine', 190, 88, 0.32, 0.9);
        break;
      case 'c':
        for (let i = 0; i < 3; i++) noise('bandpass', 1300, 1.2, 0.03 + (i === 2 ? 0.1 : 0), 0.8, t + i * 0.011);
        break;
      case 'x':
        noise('bandpass', 6200, 1.5, 0.06, 0.35);
        len = 0.1;
        break;
    }
    this.finish(srcs, t + len + 0.05, cleanup);
  }
}
