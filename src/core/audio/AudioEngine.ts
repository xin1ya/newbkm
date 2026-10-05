/**
 * M1-20 · 音频引擎（ENG-006 之上）。
 *
 * 总线：master ← [bgm（夜间低通）, sfx, ambient] → 压缩器 → 输出
 * - 浏览器自动播放策略：第一次按键 / 点击后才创建 AudioContext；之前的请求（当前 BGM、环境音）会被记住，解锁后立即生效
 * - BGM：前瞻调度器（每 25 ms 安排未来 0.15 s 的音符），切歌时交叉淡入淡出；同一首不重启
 * - 短乐句（回复、获得道具……）：压低 BGM → 播放 → 恢复
 * - 若 assets/audio/manifest.json 登记了同名音频文件，则优先播放文件（程序化配乐作为回退）
 * - 页面隐藏时挂起，回来后恢复
 *
 * 状态（当前曲目、目标曲目、环境音混合、音效计数）即使在未解锁 / 无音频设备时也会维护，供 e2e 断言。
 */
import { parseVoice, stepSeconds, stepsPerBar, type NoteEvent, type TrackDef, type VoiceDef } from '@/systems/audio/music';
import { AMBIENCE_LAYERS, type AmbienceLayer } from '@/systems/audio/select';
import { Synth } from './synth';
import { Ambience } from './ambience';
import { playSfxRecipe, type SfxName } from './sfx';

export interface Volumes {
  master: number;
  bgm: number;
  sfx: number;
  ambient: number;
  /** 剧情配音音量（缺省 1） */
  voice?: number | undefined;
}

/** 配音播放效果（由 voice.ts 按场景 / 台词语气计算） */
export interface VoiceStyle {
  gain: number;
  rate: number;
  lowpass: number;
  highpass: number;
  /** 混响湿声比例 0–1 */
  reverb: number;
  space: 'room' | 'hall' | 'dream' | 'open';
}

interface ParsedTrack {
  def: TrackDef;
  voices: { def: VoiceDef; events: NoteEvent[] }[];
  totalSteps: number;
  stepDur: number;
}

class MusicPlayer {
  readonly gain: GainNode;
  private startAt = 0;
  private cursor = 0;
  private stopped = false;
  private stopAt = Infinity;
  private voiceOut: AudioNode[] = [];

  constructor(
    readonly track: ParsedTrack,
    private readonly synth: Synth,
    dest: AudioNode,
  ) {
    const ctx = synth.ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);
    for (const v of track.voices) {
      const g = ctx.createGain();
      g.gain.value = v.def.gain ?? 0.6;
      if (v.def.pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = v.def.pan;
        g.connect(p).connect(this.gain);
      } else g.connect(this.gain);
      this.voiceOut.push(g);
    }
  }

  start(at: number, fade: number, level = 1): void {
    this.startAt = at;
    this.cursor = 0;
    const p = this.gain.gain;
    p.setValueAtTime(0, at);
    p.linearRampToValueAtTime(level, at + Math.max(0.01, fade));
  }

  /** 播放结束时刻（非循环曲） */
  get endTime(): number {
    return this.startAt + this.track.totalSteps * this.track.stepDur;
  }

  get finished(): boolean {
    return this.stopped || (!this.track.def.loop && this.synth.ctx.currentTime > this.endTime + 1);
  }

  fadeOut(seconds: number): void {
    const now = this.synth.ctx.currentTime;
    const p = this.gain.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(0, now + seconds);
    this.stopAt = now + seconds;
  }

  duck(level: number, seconds: number): void {
    const now = this.synth.ctx.currentTime;
    const p = this.gain.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(level, now + seconds);
  }

  /** 安排 [now, until) 之间的音符 */
  schedule(until: number): void {
    if (this.stopped) return;
    const ctx = this.synth.ctx;
    if (ctx.currentTime > this.stopAt + 0.1) {
      this.dispose();
      return;
    }
    const { totalSteps, stepDur, def } = this.track;
    const swing = def.swing ?? 0;
    for (;;) {
      const t = this.startAt + this.cursor * stepDur;
      if (t >= until || t >= this.stopAt) break;
      if (!def.loop && this.cursor >= totalSteps) break;
      const step = this.cursor % totalSteps;
      const off = step % 4 === 2 ? swing * stepDur * 2 : 0;
      this.track.voices.forEach((v, vi) => {
        const out = this.voiceOut[vi]!;
        for (const e of v.events) {
          if (e.step !== step) continue;
          const at = Math.max(ctx.currentTime, t + off);
          if (e.drum) this.synth.drum(e.drum, at, e.vel, out);
          else {
            const dur = e.len * stepDur * 0.92;
            for (const m of e.midi) this.synth.note(v.def.inst as Exclude<VoiceDef['inst'], 'drums'>, m, at, dur, e.vel * (e.midi.length > 1 ? 0.7 : 1), out);
          }
        }
      });
      this.cursor++;
    }
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    setTimeout(() => this.gain.disconnect(), 2500);
  }
}

/** 按事件起始步索引，加速调度 */
function indexTrack(def: TrackDef): ParsedTrack {
  const voices = def.voices.map((v) => ({ def: v, events: parseVoice(v).events }));
  return { def, voices, totalSteps: def.bars * stepsPerBar(def), stepDur: stepSeconds(def.bpm) };
}

export interface AudioDebugState {
  unlocked: boolean;
  contextState: string;
  bgm: string | null;
  /** 最近一次请求的 BGM（未解锁时也会记录） */
  desiredBgm: string | null;
  jingle: string | null;
  night: number;
  ambience: Record<AmbienceLayer, number>;
  sfxCount: number;
  lastSfx: string | null;
  volumes: Volumes;
  liveNotes: number;
  history: string[];
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private voiceSrc: { src: AudioBufferSourceNode; gain: GainNode; done: () => void } | null = null;
  private voiceBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private impulses = new Map<string, AudioBuffer>();
  /** 配音时压低 BGM / 环境音（0 = 不压，1 = 完全压） */
  private voiceDuck = 0;
  private nightFilter: BiquadFilterNode | null = null;
  /** M3-18 海底低通（整条主输出） */
  private underFilter: BiquadFilterNode | null = null;
  private underwater = 0;
  private ambience: Ambience | null = null;
  private tracks = new Map<string, ParsedTrack>();
  private player: MusicPlayer | null = null;
  private players: MusicPlayer[] = [];
  private jinglePlayer: MusicPlayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private files = new Map<string, string>();
  private fileSource: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private decoded = new Map<string, AudioBuffer>();
  private volumes: Volumes = { master: 0.8, bgm: 0.7, sfx: 0.8, ambient: 0.6 };
  private desired: string | null = null;
  private current: string | null = null;
  private jingleId: string | null = null;
  private night = 0;
  private ambMix: Record<AmbienceLayer, number> = Object.fromEntries(AMBIENCE_LAYERS.map((l) => [l, 0])) as Record<AmbienceLayer, number>;
  private sfxCount = 0;
  private lastSfx: string | null = null;
  private lastSfxAt = new Map<string, number>();
  private history: string[] = [];
  private unlockCleanup: (() => void) | null = null;
  /** 读取音频文件（manifest 覆盖用），由平台层注入 */
  fetchFile: ((url: string) => Promise<ArrayBuffer>) | null = null;
  /** 调试：禁用真实输出（测试环境） */
  muted = false;

  constructor(defs: readonly TrackDef[]) {
    for (const d of defs) this.tracks.set(d.id, indexTrack(d));
  }

  has(id: string): boolean {
    return this.tracks.has(id) || this.files.has(id);
  }

  /** 登记音频文件覆盖：{ id: url } */
  setFiles(map: Readonly<Record<string, string>>): void {
    for (const [k, v] of Object.entries(map)) this.files.set(k, v);
  }

  /** 在第一次用户手势时解锁（浏览器自动播放策略） */
  attachUnlock(target: Window): void {
    const handler = () => this.unlock();
    target.addEventListener('pointerdown', handler, { capture: true });
    target.addEventListener('keydown', handler, { capture: true });
    target.addEventListener('touchstart', handler, { capture: true });
    this.unlockCleanup = () => {
      target.removeEventListener('pointerdown', handler, { capture: true });
      target.removeEventListener('keydown', handler, { capture: true });
      target.removeEventListener('touchstart', handler, { capture: true });
    };
  }

  get unlocked(): boolean {
    return !!this.ctx;
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    } catch (err) {
      console.warn('[audio] 无法创建 AudioContext', err);
      return;
    }
    this.unlockCleanup?.();
    this.unlockCleanup = null;
    const ctx = this.ctx;
    this.synth = new Synth(ctx);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.underFilter = ctx.createBiquadFilter();
    this.underFilter.type = 'lowpass';
    this.underFilter.frequency.value = 20000;
    this.underFilter.Q.value = 0.9;
    this.underFilter.connect(comp);
    this.master.connect(this.underFilter);
    this.nightFilter = ctx.createBiquadFilter();
    this.nightFilter.type = 'lowpass';
    this.nightFilter.frequency.value = 18000;
    this.nightFilter.connect(this.master);
    this.bgmBus = ctx.createGain();
    this.bgmBus.connect(this.nightFilter);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    this.voiceBus = ctx.createGain();
    this.voiceBus.connect(this.master);
    this.ambience = new Ambience(this.synth, this.ambBus);
    this.applyVolumes();
    this.ambience.setMix(this.ambMix, 1.5);
    this.setNight(this.night);
    if (this.underwater) this.underFilter.frequency.value = 700;
    if (ctx.state === 'suspended') void ctx.resume();
    this.timer = setInterval(() => this.tick(), 25);
    const want = this.desired;
    this.desired = null;
    this.current = null;
    if (want) this.playBgm(want, 1.2);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const until = ctx.currentTime + 0.15;
    for (const p of this.players) p.schedule(until);
    this.jinglePlayer?.schedule(until);
    this.players = this.players.filter((p) => {
      if (!p.finished) return true;
      p.dispose();
      return false;
    });
    this.ambience?.tick();
  }

  setVolumes(v: Volumes): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const m = this.muted ? 0 : this.volumes.master;
    this.master!.gain.setTargetAtTime(m, now, 0.05);
    const duck = this.voiceDuck;
    this.bgmBus!.gain.setTargetAtTime(this.volumes.bgm * 0.8 * (1 - 0.55 * duck), now, duck ? 0.12 : 0.4);
    this.sfxBus!.gain.setTargetAtTime(this.volumes.sfx, now, 0.05);
    this.ambBus!.gain.setTargetAtTime(this.volumes.ambient * 0.9 * (1 - 0.4 * duck), now, duck ? 0.12 : 0.4);
    this.voiceBus!.gain.setTargetAtTime((this.volumes.voice ?? 1) * 1.1, now, 0.05);
  }

  // ———————————————————— 剧情配音 ————————————————————

  /** 预取配音文件（解码缓存最多 24 条，先进先出） */
  preloadVoice(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.voiceBuffers.get(url);
    if (!p) {
      const load = this.fetchFile ? this.fetchFile(url) : fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))));
      p = load.then((buf) => ctx.decodeAudioData(buf)).catch((err: unknown) => {
        console.warn('[voice] 加载失败', url, err);
        return null;
      });
      this.voiceBuffers.set(url, p);
      if (this.voiceBuffers.size > 24) this.voiceBuffers.delete(this.voiceBuffers.keys().next().value!);
    }
    return p;
  }

  /** 播放一句配音（会打断上一句）；播放结束 / 被打断时 resolve */
  async playVoice(url: string, style: VoiceStyle): Promise<void> {
    this.stopVoice(0.06);
    const ctx = this.ctx;
    if (!ctx || !this.voiceBus) return;
    const token = {};
    this.voiceToken = token;
    const buf = await this.preloadVoice(url);
    if (!buf || this.voiceToken !== token) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = style.rate;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = style.highpass;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = style.lowpass;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(style.gain, now + 0.03);
    src.connect(hp).connect(lp);
    const dry = ctx.createGain();
    dry.gain.value = 1 - style.reverb * 0.5;
    lp.connect(dry).connect(gain);
    if (style.reverb > 0.01) {
      const conv = ctx.createConvolver();
      conv.buffer = this.impulse(style.space);
      const wet = ctx.createGain();
      wet.gain.value = style.reverb;
      lp.connect(conv).connect(wet).connect(gain);
    }
    gain.connect(this.voiceBus);
    this.voiceDuck = 1;
    this.applyVolumes();
    await new Promise<void>((resolve) => {
      const done = () => {
        if (this.voiceSrc?.src === src) {
          this.voiceSrc = null;
          this.voiceDuck = 0;
          this.applyVolumes();
        }
        // 混响尾音放完再断开
        setTimeout(() => gain.disconnect(), 2500);
        resolve();
      };
      src.onended = done;
      this.voiceSrc = { src, gain, done };
      src.start();
    });
  }

  private voiceToken: object | null = null;

  stopVoice(fade = 0.12): void {
    this.voiceToken = null;
    const v = this.voiceSrc;
    const ctx = this.ctx;
    if (!v || !ctx) return;
    this.voiceSrc = null;
    const now = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      v.src.stop(now + fade + 0.01);
    } catch {
      /* 已停止 */
    }
    this.voiceDuck = 0;
    this.applyVolumes();
  }

  get voicePlaying(): boolean {
    return !!this.voiceSrc;
  }

  /** 程序生成的混响脉冲（房间 / 大厅 / 梦境 / 室外） */
  private impulse(space: VoiceStyle['space']): AudioBuffer {
    const hit = this.impulses.get(space);
    if (hit) return hit;
    const ctx = this.ctx!;
    const cfg = { open: [0.35, 4.5], room: [0.55, 3.2], hall: [1.6, 2.4], dream: [3.2, 1.6] }[space];
    const len = Math.floor(ctx.sampleRate * cfg[0]!);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // 指数衰减噪声；梦境额外加入缓慢的回声层
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, cfg[1]!) * (space === 'dream' ? 0.6 + 0.4 * Math.sin(t * 40 + c) : 1);
      }
    }
    this.impulses.set(space, b);
    return b;
  }

  /** 夜间程度 0–1：BGM 变得更暗更柔 */
  /** M3-18 水下：k = 1 时主输出低通到约 700 Hz（平滑过渡） */
  setUnderwater(k: number): void {
    const v = Math.max(0, Math.min(1, k));
    if (v === this.underwater) return;
    this.underwater = v;
    if (!this.ctx || !this.underFilter) return;
    const f = 20000 * Math.pow(700 / 20000, v);
    this.underFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.35);
  }

  setNight(k: number): void {
    this.night = Math.max(0, Math.min(1, k));
    if (!this.ctx || !this.nightFilter) return;
    const f = 18000 * Math.pow(2600 / 18000, this.night);
    this.nightFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.2);
  }

  private log(s: string): void {
    this.history.push(s);
    if (this.history.length > 40) this.history.shift();
  }

  /** 切换 BGM（null = 停止）；同一首不重启 */
  playBgm(id: string | null, fade = 1.6): void {
    if (id !== null && !this.has(id)) {
      console.warn(`[audio] 未知曲目 ${id}`);
      return;
    }
    if (id === this.desired && (this.current === id || !this.ctx)) return;
    this.desired = id;
    this.log(`bgm:${id ?? '-'}`);
    if (!this.ctx || !this.synth || !this.bgmBus) return;
    // 淡出旧曲
    if (this.player) {
      this.player.fadeOut(fade);
      this.player = null;
    }
    if (this.fileSource) {
      const fs = this.fileSource;
      fs.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
      fs.src.stop(this.ctx.currentTime + fade + 0.1);
      this.fileSource = null;
    }
    this.current = id;
    if (!id) return;
    const url = this.files.get(id);
    if (url && this.fetchFile) {
      void this.playFile(id, url, fade);
      return;
    }
    const t = this.tracks.get(id)!;
    const p = new MusicPlayer(t, this.synth, this.bgmBus);
    // 新曲在旧曲淡出一半时进入
    p.start(this.ctx.currentTime + fade * 0.4 + 0.05, fade * 0.6, this.jinglePlayer ? 0.15 : 1);
    this.player = p;
    this.players.push(p);
  }

  private async playFile(id: string, url: string, fade: number): Promise<void> {
    const ctx = this.ctx!;
    try {
      let buf = this.decoded.get(url);
      if (!buf) {
        buf = await ctx.decodeAudioData(await this.fetchFile!(url));
        this.decoded.set(url, buf);
      }
      if (this.current !== id) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, fade / 3);
      src.connect(g).connect(this.bgmBus!);
      src.start();
      this.fileSource = { id, src, gain: g };
    } catch (err) {
      console.warn(`[audio] 音频文件 ${url} 读取失败，改用程序化配乐`, err);
      this.files.delete(id);
      if (this.current === id) {
        this.current = null;
        this.desired = null;
        this.playBgm(id, fade);
      }
    }
  }

  /** 短乐句：压低 BGM，播完恢复；返回乐句时长（秒） */
  playJingle(id: string): Promise<void> {
    const def = this.tracks.get(id);
    if (!def) return Promise.resolve();
    this.jingleId = id;
    this.log(`jingle:${id}`);
    const secs = def.totalSteps * def.stepDur;
    if (!this.ctx || !this.synth || !this.bgmBus || this.ctx.state !== 'running') {
      // 未解锁：不发声，但保持演出节奏
      return new Promise((r) =>
        setTimeout(() => {
          if (this.jingleId === id) this.jingleId = null;
          r();
        }, Math.min(secs, 1.5) * 1000),
      );
    }
    this.player?.duck(0.12, 0.2);
    this.fileSource?.gain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.07);
    const p = new MusicPlayer(def, this.synth, this.bgmBus);
    p.start(this.ctx.currentTime + 0.22, 0.01);
    this.jinglePlayer = p;
    return new Promise((r) =>
      setTimeout(
        () => {
          if (this.jinglePlayer === p) {
            this.jinglePlayer = null;
            this.jingleId = null;
            p.fadeOut(0.3);
            setTimeout(() => p.dispose(), 600);
            this.player?.duck(1, 1.2);
            if (this.ctx) this.fileSource?.gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
          }
          r();
        },
        (secs + 0.35) * 1000,
      ),
    );
  }

  /** 播放音效；同名音效 30 ms 内去重（防止同帧重复触发） */
  sfx(name: SfxName, vol = 1): void {
    this.sfxCount++;
    this.lastSfx = name;
    const ctx = this.ctx;
    if (!ctx || !this.synth || !this.sfxBus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if ((this.lastSfxAt.get(name) ?? -1) > now - 0.03) return;
    this.lastSfxAt.set(name, now);
    playSfxRecipe(name, this.synth, this.sfxBus, now + 0.005, vol);
  }

  setAmbience(mix: Readonly<Record<AmbienceLayer, number>>, seconds = 2.5): void {
    let changed = false;
    for (const l of AMBIENCE_LAYERS) {
      const v = Math.round((mix[l] ?? 0) * 100) / 100;
      if (v !== this.ambMix[l]) {
        this.ambMix[l] = v;
        changed = true;
      }
    }
    if (changed) this.ambience?.setMix(this.ambMix, seconds);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get bgm(): string | null {
    return this.desired;
  }

  state(): AudioDebugState {
    return {
      unlocked: !!this.ctx,
      contextState: this.ctx?.state ?? 'locked',
      bgm: this.current,
      desiredBgm: this.desired,
      jingle: this.jingleId,
      night: this.night,
      ambience: { ...this.ambMix },
      sfxCount: this.sfxCount,
      lastSfx: this.lastSfx,
      volumes: { ...this.volumes },
      liveNotes: this.synth?.live ?? 0,
      history: [...this.history],
    };
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.unlockCleanup?.();
    void this.ctx?.close();
    this.ctx = null;
  }
}
