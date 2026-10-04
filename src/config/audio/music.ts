/**
 * M1-20 · 原创程序化配乐（全部为本项目原创旋律）。
 * 每首曲子 = 手写主旋律 + 按和弦进行自动编配的伴奏（风格模板）。记法见 systems/audio/music.ts。
 * 以后换成真实音频文件时，在 assets/audio/manifest.json 里登记同名 id 即可覆盖（core/audio 优先播放文件）。
 */
import { arp, bassLine, drumLoop, padLine, type TrackDef, type VoiceDef } from '@/systems/audio/music';

type Style = 'cozy' | 'route' | 'waltz' | 'calm' | 'shanty' | 'heroic' | 'mystery' | 'breeze' | 'surf' | 'center' | 'mart' | 'home' | 'lab' | 'cave' | 'gym' | 'market' | 'battle' | 'victory';

/** 伴奏模板：根据和弦进行生成低音 / 分解和弦 / 铺底 / 鼓 */
function accompany(style: Style, chords: string[]): VoiceDef[] {
  const n = chords.length;
  switch (style) {
    case 'cozy':
      return [
        { inst: 'marimba', notes: arp(chords, { octave: 4, pattern: 'alberti', rate: 2 }), gain: 0.22, pan: 0.25 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'rootFifth' }), gain: 0.42 },
        { inst: 'drums', notes: drumLoop('k.x.h.x.s.x.h.x.', n, 'k.x.h.x.s.x.s.ss'), gain: 0.22 },
      ];
    case 'route':
      return [
        { inst: 'strings', notes: padLine(chords, { octave: 3 }), gain: 0.14, pan: -0.3 },
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'up', rate: 2 }), gain: 0.2, pan: 0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'octave' }), gain: 0.4 },
        { inst: 'drums', notes: drumLoop('k.h.s.h.k.k.s.h.', n, 'k.h.s.h.k.s.s.ss'), gain: 0.3 },
      ];
    case 'waltz':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'up', rate: 4, meter: 3 }), gain: 0.2, pan: 0.3 },
        { inst: 'strings', notes: padLine(chords, { octave: 3, meter: 3 }), gain: 0.12, pan: -0.25 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'waltz', meter: 3 }), gain: 0.4 },
        { inst: 'drums', notes: drumLoop('k...x...x...', n), gain: 0.18 },
      ];
    case 'calm':
      return [
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.2 },
        { inst: 'marimba', notes: arp(chords, { octave: 4, pattern: 'updown', rate: 2 }), gain: 0.16, pan: 0.35 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'root' }), gain: 0.34 },
        { inst: 'drums', notes: drumLoop('x...x...x...x.x.', n), gain: 0.1 },
      ];
    case 'shanty':
      return [
        { inst: 'organ', notes: arp(chords, { octave: 4, pattern: 'pulse', rate: 4, accent: true }), gain: 0.13, pan: -0.2 },
        { inst: 'pluck', notes: arp(chords, { octave: 3, pattern: 'broken', rate: 2 }), gain: 0.16, pan: 0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'rootFifth' }), gain: 0.45 },
        { inst: 'drums', notes: drumLoop('k...s.k.k...s.c.', n, 'k...s.k.k.s.s.ss'), gain: 0.3 },
      ];
    case 'heroic':
      return [
        { inst: 'strings', notes: padLine(chords, { octave: 3, split: true }), gain: 0.16 },
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'updown', rate: 2 }), gain: 0.16, pan: 0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'gallop' }), gain: 0.4 },
        { inst: 'drums', notes: drumLoop('k.hkshh.k.hks.hh', n, 'k.hks.h.t.t.ttss'), gain: 0.28 },
      ];
    case 'mystery':
      return [
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.22 },
        { inst: 'marimba', notes: arp(chords, { octave: 3, pattern: 'broken', rate: 2 }), gain: 0.12, pan: -0.35 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'root' }), gain: 0.3 },
        { inst: 'drums', notes: drumLoop('t...............', n, 't.......t.....t.'), gain: 0.14 },
      ];
    case 'breeze':
    case 'surf':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'updown', rate: 2 }), gain: 0.2, pan: 0.3 },
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.13, pan: -0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: style === 'surf' ? 'sync' : 'rootFifth' }), gain: 0.42 },
        { inst: 'drums', notes: drumLoop(style === 'surf' ? 'k.h.s.hkk.hks.h.' : 'k.x.s.x.k.xks.x.', n, 'k.h.s.hkk.s.s.ss'), gain: 0.26 },
      ];
    case 'center':
      return [
        { inst: 'marimba', notes: arp(chords, { octave: 4, pattern: 'alberti', rate: 2 }), gain: 0.18, pan: 0.3 },
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.12 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'walk' }), gain: 0.38 },
        { inst: 'drums', notes: drumLoop('k.x.s.x.k.x.s.x.', n), gain: 0.16 },
      ];
    case 'mart':
      return [
        { inst: 'organ', notes: arp(chords, { octave: 4, pattern: 'pulse', rate: 4 }), gain: 0.1, pan: -0.25 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'walk' }), gain: 0.42 },
        { inst: 'drums', notes: drumLoop('k.h.s.h.k.h.s.hc', n), gain: 0.24 },
      ];
    case 'home':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 3, pattern: 'broken', rate: 2 }), gain: 0.18, pan: 0.2 },
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.12 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'root' }), gain: 0.3 },
      ];
    case 'lab':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 3, pattern: 'pulse', rate: 4 }), gain: 0.12, pan: -0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'rootFifth' }), gain: 0.38 },
        { inst: 'drums', notes: drumLoop('k.x.h.x.k.xkh.x.', n), gain: 0.2 },
      ];
    case 'cave':
      return [
        { inst: 'pad', notes: padLine(chords, { octave: 3 }), gain: 0.2 },
        { inst: 'bass', notes: bassLine(chords, { octave: 1, style: 'root' }), gain: 0.34 },
        { inst: 'drums', notes: drumLoop('t...........t...', n), gain: 0.12 },
      ];
    case 'gym':
      return [
        { inst: 'strings', notes: arp(chords, { octave: 3, pattern: 'pulse', rate: 2 }), gain: 0.1 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'octave' }), gain: 0.42 },
        { inst: 'drums', notes: drumLoop('k.hkshk.k.hks.hh', n, 'k.hks.k.s.ssttts'), gain: 0.3 },
      ];
    case 'market':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'alberti', rate: 2 }), gain: 0.18, pan: 0.3 },
        { inst: 'organ', notes: arp(chords, { octave: 3, pattern: 'pulse', rate: 4 }), gain: 0.08, pan: -0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'octave' }), gain: 0.4 },
        { inst: 'drums', notes: drumLoop('k.hck.h.k.hckshh', n), gain: 0.26 },
      ];
    case 'battle':
      return [
        { inst: 'square', notes: arp(chords, { octave: 4, pattern: 'up', rate: 1 }), gain: 0.08, pan: -0.3 },
        { inst: 'strings', notes: padLine(chords, { octave: 3, split: true }), gain: 0.12, pan: 0.3 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'gallop' }), gain: 0.46 },
        { inst: 'drums', notes: drumLoop('k.hks.hkk.hks.hh', n, 'k.hks.hks.s.ssss'), gain: 0.34 },
      ];
    case 'victory':
      return [
        { inst: 'pluck', notes: arp(chords, { octave: 4, pattern: 'up', rate: 2 }), gain: 0.18, pan: 0.3 },
        { inst: 'brass', notes: padLine(chords, { octave: 3, split: true }), gain: 0.1, pan: -0.2 },
        { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'walk' }), gain: 0.42 },
        { inst: 'drums', notes: drumLoop('k.h.s.h.k.hks.h.', n), gain: 0.28 },
      ];
  }
}

function song(
  id: string,
  title: string,
  o: { bpm: number; style: Style; chords: string[]; melody: string; lead: VoiceDef['inst']; leadGain?: number; meter?: 3 | 4; swing?: number; counter?: VoiceDef },
): TrackDef {
  const voices: VoiceDef[] = [{ inst: o.lead, notes: o.melody, gain: o.leadGain ?? 0.42 }, ...accompany(o.style, o.chords)];
  if (o.counter) voices.push(o.counter);
  return { id, title, bpm: o.bpm, bars: o.chords.length, loop: true, voices, ...(o.meter ? { meter: o.meter } : {}), ...(o.swing ? { swing: o.swing } : {}) };
}

function jingle(id: string, title: string, bpm: number, melody: string, chords: string[], inst: VoiceDef['inst'] = 'bell'): TrackDef {
  return {
    id,
    title,
    bpm,
    bars: chords.length,
    loop: false,
    voices: [
      { inst, notes: melody, gain: 0.5 },
      { inst: 'pad', notes: padLine(chords, { octave: 4 }), gain: 0.16 },
      { inst: 'bass', notes: bassLine(chords, { octave: 2, style: 'root' }), gain: 0.3 },
    ],
  };
}

export const MUSIC: readonly TrackDef[] = [
  // ———————————————————— 城镇 ————————————————————
  song('town-sprout', '萌芽镇 · 晨光小路', {
    bpm: 104,
    style: 'cozy',
    lead: 'flute',
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Am', 'Bb', 'F', 'Gm7', 'C7', 'F', 'F'],
    melody: [
      'A4:4 C5:2 A4:2 G4:4 F4:4',
      'E4:4 G4:4 C5:6 r:2',
      'D5:4 C5:2 A4:2 F4:4 A4:4',
      'G4:12 r:4',
      'A4:4 C5:2 F5:2 E5:4 C5:4',
      'D5:2 C5:2 Bb4:2 A4:2 G4:8',
      'F4:4 G4:2 A4:2 Bb4:4 D5:4',
      'C5:12 r:4',
      'F5:6 E5:2 D5:4 A4:4',
      'C5:6 Bb4:2 A4:4 E4:4',
      'D5:4 C5:2 Bb4:2 A4:4 F4:4',
      'A4:4 G4:2 F4:2 C5:8',
      'Bb4:4 D5:4 F5:4 D5:4',
      'E5:4 D5:2 C5:2 Bb4:4 G4:4',
      'A4:6 G4:2 F4:8',
      'r:8 C5:2 D5:2 E5:4',
    ].join(' | '),
  }),
  song('town-cuilan', '翠澜镇 · 湖畔圆舞曲', {
    bpm: 138,
    meter: 3,
    style: 'waltz',
    lead: 'flute',
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D', 'D'],
    melody: [
      'F#5:8 A5:4',
      'E5:8 C#5:4',
      'D5:6 E5:2 F#5:4',
      'B4:12',
      'F#5:8 A5:4',
      'C#6:6 B5:2 A5:4',
      'G5:4 F#5:4 E5:4',
      'E5:12',
      'F#5:6 G5:2 F#5:4',
      'C#5:8 A4:4',
      'B4:4 D5:4 G5:4',
      'F#5:12',
      'G5:6 F#5:2 E5:4',
      'C#5:4 E5:4 A5:4',
      'D5:12',
      'r:6 A4:2 B4:2 C#5:2',
    ].join(' | '),
  }),
  song('town-harbor', '港湾市 · 起锚号子', {
    bpm: 116,
    swing: 0.18,
    style: 'shanty',
    lead: 'square',
    leadGain: 0.3,
    chords: ['Am', 'G', 'C', 'E', 'Am', 'G', 'F', 'E', 'C', 'G', 'Am', 'Em', 'F', 'G', 'Am', 'Am'],
    melody: [
      'A4:2 C5:2 E5:4 E5:2 D5:2 C5:4',
      'B4:2 D5:2 G5:4 F5:2 E5:2 D5:4',
      'C5:2 E5:2 G5:4 A5:2 G5:2 E5:4',
      'G#5:6 F5:2 E5:8',
      'A5:2 G5:2 E5:4 C5:2 D5:2 E5:4',
      'D5:2 C5:2 B4:4 D5:4 G4:4',
      'A4:4 C5:4 F5:4 E5:2 D5:2',
      'E5:12 r:4',
      'G5:4 E5:2 G5:2 C6:4 B5:4',
      'A5:2 G5:2 F5:2 D5:2 B4:8',
      'C5:2 D5:2 E5:4 A5:4 G5:4',
      'E5:12 r:2 E5:2',
      'F5:4 A5:4 C6:4 A5:4',
      'B5:4 G5:2 A5:2 B5:4 D6:4',
      'C6:4 B5:2 A5:2 E5:4 C5:4',
      'A4:12 r:4',
    ].join(' | '),
    counter: { inst: 'organ', notes: padLine(['Am', 'G', 'C', 'E', 'Am', 'G', 'F', 'E', 'C', 'G', 'Am', 'Em', 'F', 'G', 'Am', 'Am'], { octave: 4, split: true }), gain: 0.06, pan: 0.2 },
  }),

  // ———————————————————— 野外 ————————————————————
  song('field-meadow', '一号道路 · 向风而行', {
    bpm: 132,
    style: 'route',
    lead: 'lead',
    leadGain: 0.34,
    chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'Em', 'Bm', 'C', 'G', 'Am7', 'D', 'G', 'G'],
    melody: [
      'D5:2 G5:2 B5:4 A5:2 G5:2 D5:4',
      'F#5:4 E5:2 D5:2 A4:8',
      'G5:2 F#5:2 E5:2 D5:2 B4:4 G4:4',
      'C5:4 E5:4 G5:6 r:2',
      'D5:2 G5:2 B5:4 A5:2 G5:2 D6:4',
      'C6:4 B5:2 A5:2 F#5:8',
      'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
      'A5:12 r:2 D5:2',
      'B5:6 A5:2 G5:4 E5:4',
      'F#5:6 E5:2 D5:4 B4:4',
      'C5:2 E5:2 G5:2 C6:2 B5:4 A5:4',
      'B5:8 G5:8',
      'A5:4 C6:2 B5:2 A5:4 E5:4',
      'F#5:4 A5:2 G5:2 F#5:4 D5:4',
      'G5:4 B5:4 D6:8',
      'r:8 D5:2 E5:2 F#5:4',
    ].join(' | '),
  }),
  song('field-lake', '翠澜湖畔 · 镜面', {
    bpm: 84,
    style: 'calm',
    lead: 'flute',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G', 'Cmaj7', 'Em', 'Fmaj7', 'Gsus4', 'Am7', 'Fmaj7', 'Dm7', 'G'],
    melody: [
      'E5:8 G5:4 B5:4',
      'A5:12 G5:4',
      'F5:6 E5:2 C5:8',
      'D5:16',
      'E5:4 G5:4 C6:8',
      'B5:6 G5:2 E5:8',
      'A5:4 G5:4 F5:4 E5:4',
      'D5:12 r:4',
      'C5:4 E5:4 A5:8',
      'G5:6 F5:2 E5:8',
      'F5:4 E5:4 D5:4 A4:4',
      'B4:12 r:4',
    ].join(' | '),
    counter: { inst: 'bell', notes: 'r:16 | r:16 | r:8 C6:8 | B5:16 | r:16 | r:8 E6:8 | r:16 | G5:16 | r:16 | r:8 C6:8 | r:16 | D6:16', gain: 0.14, pan: 0.4 },
  }),
  song('field-cliffs', '港湾海崖 · 逆风', {
    bpm: 120,
    style: 'heroic',
    lead: 'brass',
    leadGain: 0.34,
    chords: ['Em', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'Am', 'B7', 'Em'],
    melody: [
      'E5:6 B4:2 E5:4 F#5:4',
      'G5:6 F#5:2 E5:4 C5:4',
      'D5:4 F#5:4 A5:4 G5:2 F#5:2',
      'F#5:12 r:4',
      'E5:6 B4:2 E5:4 G5:4',
      'C6:6 B5:2 A5:4 G5:4',
      'F#5:4 G5:2 A5:2 D5:8',
      'A5:12 r:4',
      'G5:4 E5:4 C5:4 E5:4',
      'F#5:4 D5:4 A4:4 D5:4',
      'B4:4 D5:4 F#5:4 B5:4',
      'G5:12 r:4',
      'E5:2 G5:2 C6:4 B5:4 G5:4',
      'A5:4 C6:4 E5:8',
      'D#5:4 F#5:4 B5:6 A5:2',
      'E5:12 r:4',
    ].join(' | '),
  }),
  song('field-phantom-forest', '幻影之森 · 雾中低语', {
    bpm: 72,
    style: 'mystery',
    lead: 'bell',
    leadGain: 0.36,
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Gm', 'A', 'Bb', 'C', 'Dm', 'A'],
    melody: [
      'A5:4 r:4 F5:4 D5:4',
      'F5:8 D5:8',
      'G5:4 Bb5:4 A5:8',
      'C#5:12 r:4',
      'D6:4 r:4 A5:4 F5:4',
      'C6:8 A5:8',
      'Bb5:4 A5:4 G5:4 D5:4',
      'E5:16',
      'F5:4 G5:4 A5:4 Bb5:4',
      'G5:4 E5:4 C5:8',
      'D5:12 r:4',
      'r:8 C#5:4 E5:4',
    ].join(' | '),
    counter: { inst: 'flute', notes: 'r:16 | r:16 | r:16 | r:8 E4:8 | r:16 | r:16 | r:16 | r:8 C#4:8 | r:16 | r:16 | r:8 F4:8 | E4:16', gain: 0.16, pan: -0.4 },
  }),
  song('sea-route', '海路 · 潮汐之间', {
    bpm: 112,
    style: 'breeze',
    lead: 'lead',
    leadGain: 0.32,
    chords: ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F', 'Gm', 'Dm', 'Eb', 'Bb', 'Cm7', 'F', 'Bb', 'Bb'],
    melody: [
      'D5:4 F5:4 Bb5:6 A5:2',
      'A5:4 G5:2 F5:2 C5:8',
      'D5:2 Eb5:2 F5:4 G5:4 Bb5:4',
      'G5:12 r:4',
      'F5:4 Bb5:4 D6:6 C6:2',
      'C6:4 A5:2 F5:2 A5:8',
      'G5:4 Bb5:4 Eb6:4 D6:2 C6:2',
      'C6:12 r:4',
      'Bb5:6 A5:2 G5:4 D5:4',
      'F5:6 D5:2 A4:8',
      'Eb5:4 G5:4 Bb5:4 G5:4',
      'F5:12 r:4',
      'Eb5:4 G5:4 C6:4 Bb5:4',
      'A5:4 C6:4 F5:8',
      'Bb5:4 D6:4 F6:8',
      'r:8 F5:2 G5:2 A5:4',
    ].join(' | '),
  }),
  song('surf', '水上骑乘 · 乘浪', {
    bpm: 120,
    style: 'surf',
    lead: 'lead',
    leadGain: 0.34,
    chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'C', 'F', 'Am', 'Bb', 'F', 'Gm', 'C', 'F', 'F'],
    melody: [
      'C5:2 F5:2 A5:4 C6:4 A5:4',
      'Bb5:4 D6:4 F5:8',
      'G5:2 A5:2 Bb5:4 C6:4 E5:4',
      'F5:12 r:4',
      'D5:2 F5:2 A5:4 D6:4 C6:4',
      'Bb5:4 A5:2 G5:2 F5:4 D5:4',
      'E5:4 G5:4 C6:6 Bb5:2',
      'C6:12 r:4',
      'A5:4 C6:2 A5:2 F5:4 C5:4',
      'E5:4 A5:4 C6:8',
      'D6:4 C6:2 Bb5:2 A5:4 F5:4',
      'A5:12 r:4',
      'Bb5:4 G5:4 D5:4 Bb5:4',
      'C6:4 Bb5:2 A5:2 G5:4 E5:4',
      'F5:4 A5:4 C6:8',
      'r:8 C5:2 D5:2 E5:4',
    ].join(' | '),
  }),

  // ———————————————————— 室内 ————————————————————
  song('pokecenter', '宝可梦中心 · 安心时刻', {
    bpm: 100,
    style: 'center',
    lead: 'bell',
    leadGain: 0.36,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7', 'G7'],
    melody: [
      'E5:4 G5:2 E5:2 C5:4 G4:4',
      'A4:4 C5:2 E5:2 A5:8',
      'A5:2 G5:2 F5:2 E5:2 C5:4 A4:4',
      'B4:4 D5:4 G5:8',
      'E5:4 G5:2 C6:2 B5:4 G5:4',
      'A5:4 E5:2 A5:2 C6:8',
      'D6:4 C6:2 A5:2 F5:4 D5:4',
      'G5:4 F5:4 D5:4 B4:4',
    ].join(' | '),
  }),
  song('mart', '友好商店 · 今日特价', {
    bpm: 116,
    swing: 0.2,
    style: 'mart',
    lead: 'marimba',
    leadGain: 0.4,
    chords: ['F', 'Dm', 'Gm', 'C', 'F', 'Dm', 'Gm7', 'C7'],
    melody: [
      'F5:2 r:2 A5:2 F5:2 C5:4 A4:4',
      'D5:2 r:2 F5:2 D5:2 A4:8',
      'Bb4:2 D5:2 G5:2 F5:2 E5:2 D5:2 Bb4:4',
      'C5:2 E5:2 G5:4 C6:8',
      'A5:2 r:2 C6:2 A5:2 F5:4 C5:4',
      'F5:2 E5:2 D5:2 A4:2 D5:8',
      'G5:4 Bb5:4 A5:2 G5:2 F5:4',
      'E5:4 G5:4 C5:8',
    ].join(' | '),
  }),
  song('market', '港湾大市场 · 讨价还价', {
    bpm: 124,
    style: 'market',
    lead: 'square',
    leadGain: 0.26,
    chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A7', 'D'],
    melody: [
      'A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4',
      'B5:2 G5:2 D5:2 G5:2 B5:4 D6:4',
      'C#6:2 A5:2 E5:2 A5:2 G5:2 F#5:2 E5:4',
      'F#5:4 D5:4 A4:8',
      'B5:2 A5:2 F#5:2 D5:2 B4:4 D5:4',
      'G5:2 F#5:2 G5:2 B5:2 D6:8',
      'C#6:2 B5:2 A5:2 G5:2 E5:4 C#5:4',
      'D5:8 r:8',
    ].join(' | '),
  }),
  song('home', '家 · 窗边的风', {
    bpm: 80,
    style: 'home',
    lead: 'flute',
    leadGain: 0.36,
    chords: ['Gmaj7', 'Em7', 'Cmaj7', 'D', 'G', 'Bm', 'C', 'D'],
    melody: ['B4:6 D5:2 G5:8', 'E5:6 G5:2 B4:8', 'C5:4 E5:4 G5:4 E5:4', 'F#5:12 r:4', 'G5:6 B5:2 D6:8', 'B5:6 A5:2 F#5:8', 'E5:4 G5:4 C6:4 B5:4', 'A5:12 r:4'].join(' | '),
  }),
  song('lab', '研究所 · 好奇心', {
    bpm: 108,
    style: 'lab',
    lead: 'marimba',
    leadGain: 0.4,
    chords: ['C', 'Dm', 'Em', 'F', 'C', 'Dm', 'G', 'G'],
    melody: [
      'C5:2 E5:2 G5:2 E5:2 C6:4 G5:4',
      'D5:2 F5:2 A5:2 F5:2 D6:4 A5:4',
      'E5:2 G5:2 B5:2 G5:2 E6:4 B5:4',
      'F5:2 A5:2 C6:2 A5:2 F6:8',
      'E6:2 D6:2 C6:2 G5:2 E5:4 C5:4',
      'F5:2 A5:2 D6:4 C6:2 A5:2 F5:4',
      'G5:2 B5:2 D6:2 F6:2 E6:4 D6:4',
      'C6:4 G5:4 D6:8',
    ].join(' | '),
  }),
  song('cave', '海崖洞穴 · 滴水声', {
    bpm: 66,
    style: 'cave',
    lead: 'bell',
    leadGain: 0.3,
    chords: ['Am', 'Am', 'F', 'E', 'Am', 'Dm', 'F', 'E'],
    melody: ['E5:8 r:8', 'C5:4 B4:4 A4:8', 'F5:8 r:4 E5:4', 'G#4:16', 'A4:4 C5:4 E5:8', 'D5:8 F5:8', 'E5:4 D5:4 C5:4 A4:4', 'B4:16'].join(' | '),
  }),
  song('gym', '翠澜道馆 · 水之试炼', {
    bpm: 138,
    style: 'gym',
    lead: 'brass',
    leadGain: 0.32,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
    melody: [
      'C5:2 C5:2 Eb5:2 G5:2 C6:4 G5:4',
      'Ab5:4 G5:2 F5:2 Eb5:4 C5:4',
      'D5:2 F5:2 Bb5:4 Ab5:2 G5:2 F5:4',
      'G5:4 B4:4 D5:4 G5:4',
      'Eb6:4 D6:2 C6:2 G5:4 Eb5:4',
      'Ab5:4 C6:4 Eb6:8',
      'F5:2 Ab5:2 C6:4 Bb5:2 Ab5:2 F5:4',
      'G5:4 D6:4 B5:8',
    ].join(' | '),
  }),

  // ———————————————————— 战斗 ————————————————————
  song('battle-wild', '战斗！野生宝可梦', {
    bpm: 160,
    style: 'battle',
    lead: 'lead',
    leadGain: 0.34,
    chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G', 'E', 'E'],
    melody: [
      'A5:2 E5:2 A5:2 C6:2 B5:2 A5:2 E5:4',
      'F5:2 A5:2 C6:2 F6:2 E6:4 C6:4',
      'D6:2 B5:2 G5:2 B5:2 D6:4 G5:4',
      'G#5:4 B5:4 E6:8',
      'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4',
      'F5:2 A5:2 C6:4 B5:2 A5:2 F5:4',
      'G5:2 B5:2 D6:2 G6:2 F6:2 E6:2 D6:4',
      'C6:4 B5:4 A5:8',
      'D6:4 F6:4 E6:2 D6:2 A5:4',
      'B5:4 D6:4 G5:8',
      'C6:2 D6:2 E6:4 G6:4 E6:4',
      'A5:12 r:4',
      'F5:2 A5:2 C6:2 F6:2 E6:2 D6:2 C6:4',
      'D6:2 B5:2 G5:2 D6:2 B5:4 G5:4',
      'E5:2 G#5:2 B5:2 E6:2 D6:4 B5:4',
      'G#5:4 A5:4 B5:8',
    ].join(' | '),
  }),
  song('battle-trainer', '战斗！训练家', {
    bpm: 168,
    style: 'battle',
    lead: 'lead',
    leadGain: 0.34,
    chords: ['Em', 'C', 'D', 'B7', 'Em', 'C', 'Am', 'B7', 'C', 'D', 'Bm', 'Em', 'Am', 'D', 'B7', 'B7'],
    melody: [
      'E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:4',
      'C6:2 E6:2 G6:4 E6:2 C6:2 G5:4',
      'F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4',
      'D#6:4 B5:4 F#5:8',
      'E6:2 D6:2 B5:2 G5:2 E5:4 B5:4',
      'C6:2 B5:2 G5:2 E5:2 C6:4 E6:4',
      'A5:2 C6:2 E6:2 A6:2 G6:4 E6:4',
      'F#6:4 D#6:4 B5:8',
      'G5:4 C6:4 E6:4 G6:4',
      'F#6:4 D6:4 A5:8',
      'B5:2 D6:2 F#6:4 D6:2 B5:2 F#5:4',
      'G5:4 B5:4 E6:8',
      'A5:2 C6:2 E6:4 C6:2 A5:2 E5:4',
      'F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4',
      'D#6:2 F#6:2 B6:4 A6:2 F#6:2 D#6:4',
      'B5:4 A5:4 F#5:8',
    ].join(' | '),
  }),
  song('battle-gym', '战斗！道馆馆主', {
    bpm: 176,
    style: 'battle',
    lead: 'brass',
    leadGain: 0.34,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G', 'Cm', 'G'],
    melody: [
      'C6:2 G5:2 C6:2 Eb6:2 D6:2 C6:2 G5:4',
      'Ab5:2 C6:2 Eb6:4 D6:2 C6:2 Ab5:4',
      'Bb5:2 D6:2 F6:4 Eb6:2 D6:2 Bb5:4',
      'B5:4 D6:4 G6:8',
      'Eb6:2 D6:2 C6:2 G5:2 Eb5:4 G5:4',
      'C6:2 Ab5:2 Eb5:2 Ab5:2 C6:4 Eb6:4',
      'F6:2 Eb6:2 C6:2 Ab5:2 F5:4 Ab5:4',
      'G5:4 B5:4 D6:8',
      'Eb6:4 C6:4 Ab5:4 C6:4',
      'D6:4 Bb5:4 F5:8',
      'G5:2 C6:2 Eb6:4 G6:4 Eb6:4',
      'C6:12 r:4',
      'Ab5:2 C6:2 F6:4 Eb6:2 C6:2 Ab5:4',
      'G5:2 B5:2 D6:4 F6:2 D6:2 B5:4',
      'C6:4 Eb6:4 G6:8',
      'F6:4 D6:4 B5:8',
    ].join(' | '),
    counter: { inst: 'lead', notes: 'r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | r:16 | C5:4 Eb5:4 Ab5:8 | Bb4:4 D5:4 F5:8 | G4:4 C5:4 Eb5:8 | G5:16 | F4:4 Ab4:4 C5:8 | D5:4 F5:4 B4:8 | Eb5:8 G5:8 | D5:16', gain: 0.14, pan: -0.35 },
  }),
  song('victory-wild', '胜利！（野生宝可梦）', {
    bpm: 132,
    style: 'victory',
    lead: 'lead',
    leadGain: 0.32,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'],
    melody: [
      'G5:2 C6:2 E6:4 D6:2 C6:2 G5:4',
      'A5:2 C6:2 F6:4 E6:2 D6:2 C6:4',
      'B5:2 D6:2 G6:4 F6:2 E6:2 D6:4',
      'E6:8 C6:8',
      'C6:2 E6:2 A6:4 G6:2 E6:2 C6:4',
      'F6:4 E6:2 D6:2 C6:4 A5:4',
      'B5:4 D6:4 G6:4 F6:4',
      'E6:4 G6:4 C7:8',
    ].join(' | '),
  }),
  song('victory-trainer', '胜利！（训练家）', {
    bpm: 136,
    style: 'victory',
    lead: 'brass',
    leadGain: 0.32,
    chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G'],
    melody: [
      'D6:2 B5:2 G5:2 B5:2 D6:4 G6:4',
      'E6:2 C6:2 G5:2 C6:2 E6:4 G6:4',
      'F#6:2 D6:2 A5:2 D6:2 F#6:4 A6:4',
      'G6:8 D6:8',
      'B5:2 E6:2 G6:4 F#6:2 E6:2 B5:4',
      'C6:4 E6:2 G6:2 E6:4 C6:4',
      'D6:4 F#6:4 A6:4 F#6:4',
      'G6:12 r:4',
    ].join(' | '),
  }),

  // ———————————————————— 短乐句 ————————————————————
  jingle('jingle-heal', '宝可梦已恢复', 110, 'C5:2 E5:2 G5:4 E5:2 G5:2 C6:4 | B5:2 D6:2 G6:4 C6:8', ['C', 'C']),
  jingle('jingle-item', '获得道具', 140, 'G5:2 B5:2 D6:2 G6:2 r:2 E6:2 F#6:2 G6:2 | [B5D6G6]:12 r:4', ['G', 'G'], 'lead'),
  jingle('jingle-key-item', '获得重要物品', 120, 'F5:2 Bb5:2 D6:4 C6:2 Bb5:2 A5:4 | G5:2 C6:2 Eb6:4 D6:2 C6:2 Bb5:4 | [D6F6Bb6]:12 r:4', ['Bb', 'Cm', 'Bb'], 'lead'),
  jingle('jingle-catch', '捕获成功', 120, 'C6:2 G5:2 E5:2 G5:2 C6:4 E6:4 | D6:2 B5:2 G5:2 B5:2 D6:4 G6:4 | C7:12 r:4', ['C', 'G', 'C'], 'lead'),
  jingle('jingle-level', '升级', 150, 'C6:2 E6:2 G6:2 C7:10', ['C'], 'lead'),
  jingle('jingle-spotted', '视线交汇', 150, 'E5:1 F5:1 E5:1 F5:1 E5:1 F5:1 E5:2 B5:4 r:4 | E6:2 D#6:2 E6:2 B5:2 E6:8', ['Em', 'B7'], 'lead'),
  jingle('jingle-badge', '获得徽章', 110, 'G5:4 C6:4 E6:4 G6:4 | A6:4 G6:2 E6:2 C6:8 | F6:4 E6:4 D6:4 B5:4 | C7:16', ['C', 'F', 'G', 'C'], 'brass'),
  jingle('jingle-fish', '钓上来了', 150, 'G5:1 A5:1 B5:1 C6:1 D6:2 G6:2 r:2 E6:2 G6:4 | [G5B5D6G6]:12 r:4', ['G', 'G'], 'lead'),
];

export const MUSIC_BY_ID: ReadonlyMap<string, TrackDef> = new Map(MUSIC.map((t) => [t.id, t]));

/** 区域 / 室内配置里的 bgm 名 → 曲目 id（名字一致的直接对应） */
export const BGM_ALIASES: Readonly<Record<string, string>> = {};

export function resolveBgm(name: string | null | undefined): string | null {
  if (!name) return null;
  const id = BGM_ALIASES[name] ?? name;
  return MUSIC_BY_ID.has(id) ? id : null;
}
