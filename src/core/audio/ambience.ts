/**
 * M1-20 · 分层环境音（全部程序化）：
 * - 连续层（循环噪声 + 滤波 + LFO）：风、海浪、湖岸拍水、雨、室内底噪、洞穴低鸣、森林低鸣
 * - 事件层（随机时刻合成短声）：鸟鸣、虫鸣、海鸥、雨滴、猫头鹰 / 枝叶、洞穴滴水
 * 每层有独立增益，由 setMix 平滑过渡；增益为 0 的事件层不产生事件（省 CPU）。
 */
import { AMBIENCE_LAYERS, type AmbienceLayer } from '@/systems/audio/select';
import type { Synth } from './synth';
import { weatherSignal } from '../weatherSignal';

type Colour = 'white' | 'pink' | 'brown';

export class Ambience {
  readonly out: GainNode;
  private layers = new Map<AmbienceLayer, GainNode>();
  private target: Record<AmbienceLayer, number>;
  private nextEvent = new Map<AmbienceLayer, number>();
  private buffers = new Map<Colour, AudioBuffer>();
  /** M3-30：每次打雷回调（close = 近雷），天气特效可同步闪电 */
  onThunder: ((close: boolean) => void) | null = null;
  private seenStrikes = weatherSignal.strikes;
  private lastStrikeAt = -1e9;
  private pendingClose: boolean | null = null;

  constructor(
    private readonly synth: Synth,
    dest: AudioNode,
  ) {
    const ctx = synth.ctx;
    this.out = ctx.createGain();
    this.out.connect(dest);
    this.target = Object.fromEntries(AMBIENCE_LAYERS.map((l) => [l, 0])) as Record<AmbienceLayer, number>;
    for (const l of AMBIENCE_LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.layers.set(l, g);
    }
    this.buildContinuous();
  }

  get mix(): Readonly<Record<AmbienceLayer, number>> {
    return this.target;
  }

  private buffer(c: Colour): AudioBuffer {
    let b = this.buffers.get(c);
    if (b) return b;
    const ctx = this.synth.ctx;
    const len = ctx.sampleRate * 4;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (c === 'white') d[i] = w;
      else if (c === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // 首尾交叉淡化，循环无缝
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[len - fade + i] = d[len - fade + i]! * (1 - k) + d[i]! * k;
    }
    this.buffers.set(c, b);
    return b;
  }

  private loop(colour: Colour, dest: AudioNode, filters: { type: BiquadFilterType; freq: number; q?: number }[], lfo?: { rate: number; depth: number; target: 'gain' | 'freq' }): void {
    const ctx = this.synth.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(colour);
    src.loop = true;
    let node: AudioNode = src;
    const fs = filters.map((f) => {
      const b = ctx.createBiquadFilter();
      b.type = f.type;
      b.frequency.value = f.freq;
      b.Q.value = f.q ?? 0.7;
      node.connect(b);
      node = b;
      return b;
    });
    const g = ctx.createGain();
    g.gain.value = 1;
    node.connect(g).connect(dest);
    if (lfo) {
      const o = ctx.createOscillator();
      o.frequency.value = lfo.rate;
      const og = ctx.createGain();
      og.gain.value = lfo.depth;
      o.connect(og);
      if (lfo.target === 'gain') {
        g.gain.value = 1 - lfo.depth;
        og.connect(g.gain);
      } else if (fs[0]) og.connect(fs[0].frequency);
      o.start();
    }
    src.start(0, Math.random() * 3);
  }

  private buildContinuous(): void {
    const L = (l: AmbienceLayer) => this.layers.get(l)!;
    // 风：粉噪声带通，频率与响度双 LFO（阵风）
    this.loop('pink', L('wind'), [{ type: 'bandpass', freq: 500, q: 0.6 }], { rate: 0.09, depth: 260, target: 'freq' });
    this.loop('pink', L('wind'), [{ type: 'highpass', freq: 1800 }], { rate: 0.13, depth: 0.7, target: 'gain' });
    // 海浪：棕噪声低通，0.11 Hz 涌动
    this.loop('brown', L('waves'), [{ type: 'lowpass', freq: 700 }], { rate: 0.11, depth: 0.75, target: 'gain' });
    this.loop('pink', L('waves'), [{ type: 'bandpass', freq: 2400, q: 0.5 }], { rate: 0.11, depth: 0.85, target: 'gain' });
    // 湖岸拍水：更快更轻
    this.loop('brown', L('lap'), [{ type: 'bandpass', freq: 420, q: 1.2 }], { rate: 0.45, depth: 0.8, target: 'gain' });
    // 雨：白噪声高通 + 低频
    this.loop('white', L('rain'), [{ type: 'highpass', freq: 2500 }, { type: 'lowpass', freq: 9000 }]);
    this.loop('pink', L('rain'), [{ type: 'lowpass', freq: 600 }]);
    // 室内：低沉底噪 + 电器嗡声
    this.loop('brown', L('room'), [{ type: 'lowpass', freq: 220 }]);
    // 洞穴：深低频 + 缓慢回响感
    this.loop('brown', L('cave'), [{ type: 'lowpass', freq: 160 }], { rate: 0.05, depth: 0.4, target: 'gain' });
    // 森林：低沉嗡鸣（树叶沙沙）
    this.loop('pink', L('forest'), [{ type: 'bandpass', freq: 1100, q: 0.4 }], { rate: 0.07, depth: 0.6, target: 'gain' });
    // 溪流：两层白 / 粉噪声带通，快速不规则的响度起伏 = 潺潺水声
    this.loop('white', L('stream'), [{ type: 'bandpass', freq: 1500, q: 0.7 }], { rate: 1.9, depth: 0.45, target: 'gain' });
    this.loop('pink', L('stream'), [{ type: 'bandpass', freq: 650, q: 0.9 }], { rate: 0.7, depth: 260, target: 'freq' });
    // 昆虫：远处蝉鸣 / 嗡声的高频底噪（事件层再叠加蜜蜂飞过）
    this.loop('white', L('insects'), [{ type: 'bandpass', freq: 5200, q: 6 }], { rate: 0.23, depth: 0.7, target: 'gain' });
    // M3-30 雷暴：持续的低频隆隆底（事件层再叠远雷 / 炸雷）
    this.loop('brown', L('thunder'), [{ type: 'lowpass', freq: 120 }], { rate: 0.04, depth: 0.6, target: 'gain' });
    // M3-30 暴雪：高频呼啸（窄带通扫频）+ 冰粒沙沙（高通白噪声，快速起伏）
    this.loop('pink', L('blizzard'), [{ type: 'bandpass', freq: 900, q: 4 }], { rate: 0.17, depth: 420, target: 'freq' });
    this.loop('pink', L('blizzard'), [{ type: 'bandpass', freq: 1700, q: 6 }], { rate: 0.23, depth: 600, target: 'freq' });
    this.loop('white', L('blizzard'), [{ type: 'highpass', freq: 4500 }], { rate: 1.3, depth: 0.6, target: 'gain' });
    const ctx = this.synth.ctx;
    const hum = ctx.createOscillator();
    hum.frequency.value = 58;
    const hg = ctx.createGain();
    hg.gain.value = 0.05;
    hum.connect(hg).connect(L('room'));
    hum.start();
    // 各层整体响度校正
    const trim: Partial<Record<AmbienceLayer, number>> = { wind: 0.5, waves: 0.55, lap: 0.45, rain: 0.35, room: 0.45, cave: 0.7, forest: 0.3, stream: 0.4, insects: 0.12, thunder: 0.6, blizzard: 0.4 };
    for (const [l, v] of Object.entries(trim)) {
      const inner = this.layers.get(l as AmbienceLayer)!;
      // 插入一个修正增益：layer gain（混合）→ trim → out
      inner.disconnect();
      const t = ctx.createGain();
      t.gain.value = v;
      inner.connect(t).connect(this.out);
    }
  }

  setMix(mix: Readonly<Record<AmbienceLayer, number>>, seconds = 2.5): void {
    const now = this.synth.ctx.currentTime;
    for (const l of AMBIENCE_LAYERS) {
      const v = Math.max(0, Math.min(1, mix[l] ?? 0));
      this.target[l] = v;
      this.layers.get(l)!.gain.setTargetAtTime(v, now, seconds / 3);
    }
  }

  /** 每帧调用：为事件层安排接下来的声音 */
  tick(): void {
    const ctx = this.synth.ctx;
    const now = ctx.currentTime;
    // 有可见闪电时，雷声跟着闪电走（按距离延迟）；没有可见闪电（室内 / 战斗）才随机打雷
    if (weatherSignal.strikes !== this.seenStrikes) {
      this.seenStrikes = weatherSignal.strikes;
      if (this.target.thunder >= 0.02) {
        const d = weatherSignal.distance;
        this.pendingClose = d < 110;
        this.nextEvent.set('thunder', now + Math.min(3, 0.3 + d / 343));
        this.lastStrikeAt = now;
      }
    }
    for (const l of ['birds', 'crickets', 'gulls', 'rain', 'forest', 'cave', 'frogs', 'insects', 'thunder', 'blizzard'] as const) {
      const v = this.target[l];
      if (v < 0.02) {
        this.nextEvent.delete(l);
        continue;
      }
      const at = this.nextEvent.get(l);
      if (at === undefined) {
        this.nextEvent.set(l, now + Math.random() * 1.5);
        continue;
      }
      if (at > now + 0.2) continue;
      const dest = this.layers.get(l)!;
      const t = Math.max(now + 0.02, at);
      this.nextEvent.set(l, t + this.emit(l, dest, t));
    }
  }

  /** 合成一个事件，返回到下一个事件的间隔（秒） */
  private emit(l: AmbienceLayer, dest: AudioNode, t: number): number {
    const ctx = this.synth.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(dest);
    const chirp = (f0: number, f1: number, dur: number, gain: number, at: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(gain, at + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
      o.connect(g).connect(pan);
      o.start(at);
      o.stop(at + dur + 0.02);
    };
    setTimeout(() => pan.disconnect(), 6000);
    switch (l) {
      case 'birds': {
        // 一段 2–6 声的鸣叫，音高随机选一种「鸟」
        const base = 2200 + Math.random() * 2400;
        const n = 2 + Math.floor(Math.random() * 5);
        const kind = Math.random();
        for (let i = 0; i < n; i++) {
          const at = t + i * (0.09 + Math.random() * 0.08);
          if (kind < 0.5) chirp(base * 1.3, base * 0.8, 0.07, 0.12, at);
          else chirp(base * 0.8, base * 1.4, 0.09, 0.1, at);
        }
        return 1.2 + Math.random() * 4;
      }
      case 'crickets': {
        // 蟋蟀：4.5 kHz 短脉冲串
        const f = 4200 + Math.random() * 700;
        const pulses = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < pulses; i++) chirp(f, f * 0.98, 0.025, 0.05, t + i * 0.045, 'triangle');
        return 0.25 + Math.random() * 0.7;
      }
      case 'gulls': {
        const f = 1300 + Math.random() * 500;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) chirp(f * 1.25, f * 0.7, 0.22, 0.07, t + i * 0.28, 'sawtooth');
        return 4 + Math.random() * 7;
      }
      case 'rain': {
        // 雨滴 / 屋檐滴答
        for (let i = 0; i < 4; i++) chirp(1800 + Math.random() * 2500, 700, 0.03, 0.04, t + Math.random() * 0.25);
        return 0.15 + Math.random() * 0.2;
      }
      case 'forest': {
        if (Math.random() < 0.35) {
          // 猫头鹰 / 远处的「呜——呜」
          chirp(420, 380, 0.35, 0.09, t);
          chirp(400, 350, 0.5, 0.08, t + 0.5);
        } else {
          // 枝条轻响
          chirp(260 + Math.random() * 120, 180, 0.12, 0.05, t, 'triangle');
        }
        return 3 + Math.random() * 6;
      }
      case 'frogs': {
        // 蛙鸣：低频「呱」——快速下滑的方波 + 喉音颤动，偶尔两三只此起彼伏
        const calls = 1 + Math.floor(Math.random() * 3);
        for (let c = 0; c < calls; c++) {
          const f = 160 + Math.random() * 260;
          const at = t + c * (0.35 + Math.random() * 0.5);
          const croaks = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < croaks; i++) chirp(f * 1.6, f, 0.09, 0.07, at + i * 0.13, 'square');
        }
        return 0.8 + Math.random() * 2.2;
      }
      case 'insects': {
        // 蜜蜂飞过：200 Hz 锯齿波，频率缓慢起伏（多普勒感）
        if (Math.random() < 0.5) chirp(210 + Math.random() * 40, 180 + Math.random() * 60, 1.2 + Math.random() * 0.8, 0.025, t, 'sawtooth');
        else chirp(5600, 5200, 0.6, 0.02, t, 'square'); // 一声短蝉
        return 2.5 + Math.random() * 5;
      }
      case 'thunder': {
        // 雷：噪声爆发经低通，起音快、衰减长；近雷先有一声高频「咔嚓」
        const close = this.pendingClose ?? Math.random() < 0.3;
        this.pendingClose = null;
        const burst = (dur: number, freq: number, gain: number, at: number) => {
          const src = ctx.createBufferSource();
          src.buffer = this.buffer(close && freq > 1000 ? 'white' : 'brown');
          const f = ctx.createBiquadFilter();
          f.type = freq > 1000 ? 'highpass' : 'lowpass';
          f.frequency.setValueAtTime(freq, at);
          if (freq < 1000) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.35), at + dur);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(gain, at + Math.min(0.08, dur * 0.1));
          g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
          src.connect(f).connect(g).connect(pan);
          src.start(at, Math.random() * 2, dur + 0.1);
        };
        if (close) {
          burst(0.35, 2500, 0.5, t);
          burst(3.5, 400, 1.2, t + 0.05);
        } else {
          const delay = 0.2 + Math.random() * 0.6;
          burst(4 + Math.random() * 2, 180 + Math.random() * 120, 0.8, t + delay);
          burst(2.5, 120, 0.5, t + delay + 1.2 + Math.random());
        }
        this.onThunder?.(close);
        // 刚有可见闪电：把随机雷推远，等下一道闪电
        return ctx.currentTime - this.lastStrikeAt < 20 ? 30 : 7 + Math.random() * 12;
      }
      case 'blizzard': {
        // 一阵冰粒：多颗极短的高频「嗒」
        for (let i = 0; i < 10; i++) chirp(5000 + Math.random() * 4000, 3000, 0.015, 0.03, t + Math.random() * 0.4, 'square');
        return 0.3 + Math.random() * 0.5;
      }
      case 'cave': {
        // 滴水：高频「叮」+ 回声
        const f = 1400 + Math.random() * 900;
        chirp(f, f * 0.6, 0.08, 0.12, t);
        chirp(f, f * 0.6, 0.08, 0.04, t + 0.23);
        chirp(f, f * 0.6, 0.08, 0.015, t + 0.46);
        return 1.5 + Math.random() * 3.5;
      }
      default:
        return 5;
    }
  }
}
