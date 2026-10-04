/**
 * M1-20 · 程序化音乐的纯逻辑部分：乐谱记法解析、和弦、编配助手、校验。
 *
 * 记法（每个声部一串以空格分隔的记号，`|` 为小节线，仅用于校验与阅读）：
 * - 音符 `C5:4`：音名 + 八度 + `:` + 时值（单位 = 十六分音符，4 = 四分音符）；省略时值则沿用上一个
 * - 升降号 `F#4` / `Bb3`；重音后缀 `!`（力度 1.0），轻音后缀 `?`（力度 0.45），缺省 0.75
 * - 休止 `r:4`；延音 `~:4`（把上一个音再延长）
 * - 和弦 `[C4E4G4]:16`
 * - 鼓声部：每个字符一个十六分音符：k 底鼓 s 军鼓 h 闭镲 o 开镲 t 通鼓 c 拍手 x 沙锤 . 空；空格 / `|` 忽略
 *
 * 所有函数都是纯函数（可在 Node 中运行），WebAudio 播放在 core/audio。
 */

export type InstrumentId =
  | 'lead' // 25% 脉冲波主旋律（掌机风）
  | 'square' // 50% 方波
  | 'triangle' // 三角波（柔和旋律 / 低音）
  | 'flute' // 正弦 + 气声
  | 'pluck' // 拨弦（锯齿 + 快速滤波包络）
  | 'bell' // FM 铃
  | 'marimba' // 木琴
  | 'pad' // 慢起音铺底
  | 'strings' // 弦乐
  | 'brass' // 铜管
  | 'organ' // 风琴
  | 'bass'; // 低音

export type DrumHit = 'k' | 's' | 'h' | 'o' | 't' | 'c' | 'x';

export interface VoiceDef {
  inst: InstrumentId | 'drums';
  notes: string;
  /** 0–1，缺省 0.6 */
  gain?: number;
  /** 半音移调 */
  transpose?: number;
  /** -1（左）…1（右） */
  pan?: number;
}

export interface TrackDef {
  id: string;
  title: string;
  bpm: number;
  /** 每小节拍数（4 或 3），缺省 4 */
  meter?: 3 | 4;
  bars: number;
  /** false = 短乐句（回复音、获得道具），播完即止 */
  loop: boolean;
  /** 摇摆比例 0–0.5：偶数十六分后移 */
  swing?: number;
  voices: VoiceDef[];
}

export interface NoteEvent {
  /** 起始十六分音符序号 */
  step: number;
  /** 时值（十六分音符数） */
  len: number;
  /** MIDI 音高（和弦多个）；鼓为空 */
  midi: number[];
  drum?: DrumHit;
  vel: number;
}

export interface ParsedVoice {
  events: NoteEvent[];
  steps: number;
  /** 各小节长度（按 `|` 切分），用于校验 */
  barLengths: number[];
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 音名 → MIDI（C4 = 60） */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`无法解析音名：${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + acc;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function stepsPerBar(t: Pick<TrackDef, 'meter'>): number {
  return (t.meter ?? 4) * 4;
}

export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

export function trackSeconds(t: TrackDef): number {
  return t.bars * stepsPerBar(t) * stepSeconds(t.bpm);
}

const DRUMS = new Set<string>(['k', 's', 'h', 'o', 't', 'c', 'x']);

export function parseVoice(v: VoiceDef): ParsedVoice {
  const events: NoteEvent[] = [];
  const barLengths: number[] = [];
  let step = 0;
  let barStart = 0;
  const closeBar = () => {
    if (step > barStart) barLengths.push(step - barStart);
    barStart = step;
  };
  if (v.inst === 'drums') {
    for (const ch of v.notes) {
      if (ch === ' ' || ch === '\n') continue;
      if (ch === '|') {
        closeBar();
        continue;
      }
      if (ch !== '.') {
        if (!DRUMS.has(ch)) throw new Error(`未知鼓记号：${ch}`);
        events.push({ step, len: 1, midi: [], drum: ch as DrumHit, vel: ch === 'h' || ch === 'x' ? 0.55 : 0.85 });
      }
      step++;
    }
    closeBar();
    return { events, steps: step, barLengths };
  }
  let len = 4;
  const tr = v.transpose ?? 0;
  for (const raw of v.notes.split(/\s+/)) {
    if (!raw) continue;
    if (raw === '|') {
      closeBar();
      continue;
    }
    let tok = raw;
    let vel = 0.75;
    if (tok.endsWith('!')) {
      vel = 1;
      tok = tok.slice(0, -1);
    } else if (tok.endsWith('?')) {
      vel = 0.45;
      tok = tok.slice(0, -1);
    }
    const [head, dur] = tok.split(':');
    if (dur !== undefined) {
      const n = Number(dur);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`时值无效：${raw}`);
      len = n;
    }
    if (head === 'r') {
      step += len;
      continue;
    }
    if (head === '~') {
      const last = events[events.length - 1];
      if (!last) throw new Error('延音记号前没有音符');
      last.len += len;
      step += len;
      continue;
    }
    let midi: number[];
    if (head!.startsWith('[')) {
      const inner = head!.slice(1, -1);
      midi = (inner.match(/[A-G][#b]?-?\d/g) ?? []).map((n) => noteToMidi(n) + tr);
      if (!midi.length) throw new Error(`空和弦：${raw}`);
    } else midi = [noteToMidi(head!) + tr];
    events.push({ step, len, midi, vel });
    step += len;
  }
  closeBar();
  return { events, steps: step, barLengths };
}

// ———————————————————— 和弦与编配助手（供 config/audio 生成伴奏） ————————————————————

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  m9: [0, 3, 7, 10, 14],
};

/** 和弦符号 → 根音音级（0–11）与音程 */
export function parseChord(sym: string): { root: number; intervals: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  if (!m) throw new Error(`无法解析和弦：${sym}`);
  const q = QUALITY[m[3]!];
  if (!q) throw new Error(`未知和弦性质：${sym}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return { root: (PC[m[1]!]! + acc + 12) % 12, intervals: q };
}

/** 和弦在指定八度的 MIDI 音（根音位于该八度） */
export function chordMidi(sym: string, octave: number): number[] {
  const c = parseChord(sym);
  const base = 12 * (octave + 1) + c.root;
  return c.intervals.map((i) => base + i);
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export function midiToName(m: number): string {
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

export type ArpPattern = 'up' | 'down' | 'updown' | 'alberti' | 'broken' | 'pulse';

/**
 * 分解和弦：每小节一个和弦，rate = 每个音的十六分数。
 * 'pulse' = 整个和弦按 rate 重复（节奏型柱式和弦）。
 */
export function arp(chords: readonly string[], o: { octave: number; pattern: ArpPattern; rate: number; meter?: 3 | 4; accent?: boolean }): string {
  const spb = (o.meter ?? 4) * 4;
  const per = Math.floor(spb / o.rate);
  const bars: string[] = [];
  for (const sym of chords) {
    if (sym === '-') {
      bars.push(`r:${spb}`);
      continue;
    }
    const tones = chordMidi(sym, o.octave).slice(0, 4);
    let seq: number[];
    switch (o.pattern) {
      case 'down':
        seq = [...tones].reverse();
        break;
      case 'updown':
        seq = [...tones, ...tones.slice(1, -1).reverse()];
        break;
      case 'alberti':
        seq = [tones[0]!, tones[2] ?? tones[1]!, tones[1]!, tones[2] ?? tones[1]!];
        break;
      case 'broken':
        seq = [tones[0]!, tones[1]!, tones[2] ?? tones[0]!, tones[1]!, (tones[0] ?? 0) + 12, tones[1]!];
        break;
      default:
        seq = tones;
    }
    const toks: string[] = [];
    for (let i = 0; i < per; i++) {
      const acc = o.accent && i % (o.meter === 3 ? 3 : 4) === 0 ? '' : '?';
      if (o.pattern === 'pulse') toks.push(`[${tones.map(midiToName).join('')}]:${o.rate}${acc}`);
      else toks.push(`${midiToName(seq[i % seq.length]!)}:${o.rate}${acc}`);
    }
    const rest = spb - per * o.rate;
    if (rest > 0) toks.push(`r:${rest}`);
    bars.push(toks.join(' '));
  }
  return bars.join(' | ');
}

export type BassStyle = 'root' | 'root8' | 'rootFifth' | 'octave' | 'walk' | 'waltz' | 'gallop' | 'sync';

/** 低音线（根音位于 octave 八度） */
export function bassLine(chords: readonly string[], o: { octave: number; style: BassStyle; meter?: 3 | 4 }): string {
  const spb = (o.meter ?? 4) * 4;
  const bars: string[] = [];
  chords.forEach((sym, bi) => {
    if (sym === '-') {
      bars.push(`r:${spb}`);
      return;
    }
    const [r, third, fifth] = chordMidi(sym, o.octave);
    const R = midiToName(r!);
    const F = midiToName(fifth!);
    const O = midiToName(r! + 12);
    const next = chords[(bi + 1) % chords.length];
    const nr = next && next !== '-' ? chordMidi(next, o.octave)[0]! : r!;
    // 经过音：向下一和弦根音半音 / 全音靠近
    const approach = midiToName(nr > r! ? nr - 1 : nr + (nr === r ? 2 : 1));
    switch (o.style) {
      case 'root':
        bars.push(`${R}:${spb}`);
        break;
      case 'root8':
        bars.push(Array.from({ length: spb / 2 }, (_, i) => `${R}:2${i % 4 === 0 ? '' : '?'}`).join(' '));
        break;
      case 'rootFifth':
        bars.push(spb === 12 ? `${R}:4 ${F}:4 ${R}:4` : `${R}:4 ${F}:4 ${R}:4 ${F}:4`);
        break;
      case 'octave':
        bars.push(Array.from({ length: spb / 2 }, (_, i) => `${i % 2 ? O : R}:2${i % 2 ? '?' : ''}`).join(' '));
        break;
      case 'walk':
        bars.push(spb === 12 ? `${R}:4 ${midiToName(third!)}:4 ${approach}:4` : `${R}:4 ${midiToName(third!)}:4 ${F}:4 ${approach}:4`);
        break;
      case 'waltz':
        bars.push(`${R}:4 r:4 ${F}:4?`.replace('r:4', spb === 12 ? 'r:4' : 'r:8'));
        break;
      case 'gallop':
        bars.push(Array.from({ length: spb / 4 }, (_, i) => `${i % 2 ? F : R}:2 ${i % 2 ? F : R}:1? ${i % 2 ? F : R}:1?`).join(' '));
        break;
      case 'sync':
        bars.push(spb === 12 ? `${R}:6 ${F}:6` : `${R}:3 ${R}:3? ${F}:2 r:2 ${R}:2 ${approach}:4`);
        break;
    }
  });
  return bars.join(' | ');
}

/** 铺底：每小节一个持续和弦 */
export function padLine(chords: readonly string[], o: { octave: number; meter?: 3 | 4; split?: boolean }): string {
  const spb = (o.meter ?? 4) * 4;
  return chords
    .map((sym) => {
      if (sym === '-') return `r:${spb}`;
      const tones = chordMidi(sym, o.octave).slice(0, 4).map(midiToName).join('');
      return o.split ? `[${tones}]:${spb / 2} [${tones}]:${spb / 2}?` : `[${tones}]:${spb}`;
    })
    .join(' | ');
}

/** 鼓：一小节的节奏型重复 n 次；fill 替换每 fillEvery 小节的最后一小节 */
export function drumLoop(bar: string, bars: number, fill?: string, fillEvery = 4): string {
  const out: string[] = [];
  for (let i = 0; i < bars; i++) out.push(fill && (i + 1) % fillEvery === 0 ? fill : bar);
  return out.join(' | ');
}

/** 重复一段乐谱 n 次 */
export function repeat(notes: string, n: number): string {
  return Array.from({ length: n }, () => notes).join(' | ');
}

/** 每个和弦重复 n 小节 */
export function hold(chords: readonly string[], n: number): string[] {
  return chords.flatMap((c) => Array.from({ length: n }, () => c));
}

// ———————————————————— 校验 ————————————————————

export function validateTrack(t: TrackDef): string[] {
  const errs: string[] = [];
  const spb = stepsPerBar(t);
  const total = spb * t.bars;
  t.voices.forEach((v, i) => {
    let p: ParsedVoice;
    try {
      p = parseVoice(v);
    } catch (e) {
      errs.push(`${t.id} 声部 ${i}(${v.inst})：${(e as Error).message}`);
      return;
    }
    if (p.steps !== total) errs.push(`${t.id} 声部 ${i}(${v.inst})：总长 ${p.steps}/${total} 个十六分音符`);
    if (p.barLengths.length > 1) {
      p.barLengths.forEach((len, b) => {
        if (len !== spb) errs.push(`${t.id} 声部 ${i}(${v.inst}) 第 ${b + 1} 小节：${len}/${spb}`);
      });
    }
    for (const e of p.events) for (const m of e.midi) if (m < 24 || m > 108) errs.push(`${t.id} 声部 ${i}：音高越界 ${midiToName(m)}`);
  });
  if (t.bpm < 40 || t.bpm > 220) errs.push(`${t.id}：速度 ${t.bpm} 超出范围`);
  return errs;
}
