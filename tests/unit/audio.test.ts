/**
 * M1-20 · 音频（纯逻辑）：乐谱记法解析、和弦 / 编配助手、全部曲目校验、区域 / 室内 bgm 覆盖、BGM 选择与环境音混合。
 */
import { describe, expect, it } from 'vitest';
import { arp, bassLine, chordMidi, drumLoop, midiToFreq, noteToMidi, padLine, parseChord, parseVoice, stepsPerBar, trackSeconds, validateTrack } from '@/systems/audio/music';
import { ambienceMix, pickBgm, waterProximity, type AmbienceSituation } from '@/systems/audio/select';
import { MUSIC, MUSIC_BY_ID, resolveBgm } from '@/config/audio/music';
import { ISLANDS } from '@/config/islands';
import { INTERIORS } from '@/config/interiors';

describe('乐谱记法', () => {
  it('音名 ↔ MIDI ↔ 频率', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#5')).toBe(78);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
    expect(() => noteToMidi('H2')).toThrow();
  });

  it('音符、休止、延音、和弦、力度与小节线', () => {
    const p = parseVoice({ inst: 'lead', notes: 'C5:4 E5 r:2 G5:6! | ~:8 [C4E4G4]:8?' });
    expect(p.steps).toBe(32);
    expect(p.barLengths).toEqual([16, 16]);
    expect(p.events.map((e) => [e.step, e.len])).toEqual([
      [0, 4],
      [4, 4],
      [10, 14], // G5 被 ~ 延长 8
      [24, 8],
    ]);
    expect(p.events[2]!.vel).toBe(1);
    expect(p.events[3]!.midi).toEqual([60, 64, 67]);
    expect(p.events[3]!.vel).toBeLessThan(0.5);
  });

  it('移调与鼓声部', () => {
    expect(parseVoice({ inst: 'bass', notes: 'C3:16', transpose: 2 }).events[0]!.midi).toEqual([50]);
    const d = parseVoice({ inst: 'drums', notes: 'k.h.|s.o.' });
    expect(d.steps).toBe(8);
    expect(d.barLengths).toEqual([4, 4]);
    expect(d.events.map((e) => e.drum)).toEqual(['k', 'h', 's', 'o']);
    expect(() => parseVoice({ inst: 'drums', notes: 'kz' })).toThrow();
  });

  it('和弦符号', () => {
    expect(parseChord('F#m').root).toBe(6);
    expect(chordMidi('C', 4)).toEqual([60, 64, 67]);
    expect(chordMidi('Am7', 3)).toEqual([57, 60, 64, 67]);
    expect(chordMidi('Bb', 3)).toEqual([58, 62, 65]);
    expect(() => parseChord('Cxyz')).toThrow();
  });

  it('编配助手生成的每小节长度正确（4/4 与 3/4）', () => {
    const chords = ['C', 'Am', 'F', 'G7'];
    for (const pattern of ['up', 'down', 'updown', 'alberti', 'broken', 'pulse'] as const) {
      for (const rate of [1, 2, 4]) {
        const p = parseVoice({ inst: 'pluck', notes: arp(chords, { octave: 4, pattern, rate }) });
        expect(p.barLengths).toEqual([16, 16, 16, 16]);
      }
      expect(parseVoice({ inst: 'pluck', notes: arp(chords, { octave: 4, pattern, rate: 4, meter: 3 }) }).barLengths).toEqual([12, 12, 12, 12]);
    }
    for (const style of ['root', 'root8', 'rootFifth', 'octave', 'walk', 'waltz', 'gallop', 'sync'] as const) {
      expect(parseVoice({ inst: 'bass', notes: bassLine(chords, { octave: 2, style }) }).barLengths).toEqual([16, 16, 16, 16]);
      expect(parseVoice({ inst: 'bass', notes: bassLine(chords, { octave: 2, style, meter: 3 }) }).barLengths).toEqual([12, 12, 12, 12]);
    }
    expect(parseVoice({ inst: 'pad', notes: padLine(chords, { octave: 3, split: true }) }).steps).toBe(64);
    expect(parseVoice({ inst: 'drums', notes: drumLoop('k...s...k...s...', 4, 'k.s.k.s.k.s.ssss') }).events.length).toBe(4 * 3 + 10);
  });
});

describe('曲目', () => {
  it('全部曲目通过校验（每小节时值、音域、速度）', () => {
    const errs = MUSIC.flatMap((t) => validateTrack(t));
    expect(errs).toEqual([]);
  });

  it('曲目 id 唯一，循环曲至少 8 小节、短乐句不超过 9 秒', () => {
    expect(new Set(MUSIC.map((t) => t.id)).size).toBe(MUSIC.length);
    for (const t of MUSIC) {
      if (t.loop) expect(t.bars, t.id).toBeGreaterThanOrEqual(8);
      else expect(trackSeconds(t), t.id).toBeLessThanOrEqual(9);
      expect(stepsPerBar(t)).toBe((t.meter ?? 4) * 4);
    }
  });

  it('所有区域与室内的 bgm 都有对应曲目', () => {
    const names = new Set<string>();
    for (const isl of Object.values(ISLANDS)) for (const z of isl.zones) names.add(z.bgm);
    for (const i of Object.values(INTERIORS)) if (i.bgm) names.add(i.bgm);
    const missing = [...names].filter((n) => !resolveBgm(n));
    expect(missing).toEqual([]);
  });

  it('战斗 / 胜利 / 水上骑乘 / 短乐句曲目齐全', () => {
    for (const id of ['battle-wild', 'battle-trainer', 'battle-gym', 'victory-wild', 'victory-trainer', 'surf', 'jingle-heal', 'jingle-item', 'jingle-key-item', 'jingle-catch', 'jingle-level', 'jingle-spotted', 'jingle-fish'])
      expect(MUSIC_BY_ID.has(id), id).toBe(true);
  });
});

describe('BGM 选择', () => {
  const base = { battle: null, victory: null, surfing: false, interiorBgm: null, zoneBgm: 'town-sprout' } as const;
  it('优先级：凯旋 > 战斗 > 室内 > 水上骑乘 > 区域', () => {
    expect(pickBgm(base)).toBe('town-sprout');
    expect(pickBgm({ ...base, surfing: true })).toBe('surf');
    expect(pickBgm({ ...base, surfing: true, interiorBgm: 'pokecenter' })).toBe('pokecenter');
    expect(pickBgm({ ...base, interiorBgm: 'pokecenter', battle: 'trainer' })).toBe('battle-trainer');
    expect(pickBgm({ ...base, battle: 'gym' })).toBe('battle-gym');
    expect(pickBgm({ ...base, battle: 'wild', victory: 'wild' })).toBe('victory-wild');
    expect(pickBgm({ ...base, zoneBgm: null })).toBeNull();
  });
});

describe('环境音混合', () => {
  const s = (o: Partial<AmbienceSituation>): AmbienceSituation => ({
    indoor: null,
    zoneKind: 'wild',
    zoneBgm: 'field-meadow',
    time: 'day',
    weather: 'clear',
    sea: 0,
    fresh: 0,
    altitude: 5,
    surfing: false,
    battle: false,
    ...o,
  });

  it('白天草原：鸟鸣 + 微风，无虫鸣无雨', () => {
    const m = ambienceMix(s({}));
    expect(m.birds).toBeGreaterThan(0.3);
    expect(m.wind).toBeGreaterThan(0);
    expect(m.crickets).toBe(0);
    expect(m.rain).toBe(0);
  });

  it('夜晚：虫鸣代替鸟鸣；森林夜里更浓', () => {
    const m = ambienceMix(s({ time: 'night' }));
    expect(m.birds).toBe(0);
    expect(m.crickets).toBeGreaterThan(0.3);
    expect(ambienceMix(s({ time: 'night', zoneBgm: 'field-phantom-forest' })).forest).toBeGreaterThan(ambienceMix(s({ zoneBgm: 'field-phantom-forest' })).forest);
  });

  it('雨天 / 暴风雨：雨声与风声变大，鸟停止', () => {
    const r = ambienceMix(s({ weather: 'rain' }));
    const st = ambienceMix(s({ weather: 'storm' }));
    expect(r.rain).toBeGreaterThan(0.4);
    expect(st.rain).toBeGreaterThan(r.rain);
    expect(st.wind).toBeGreaterThan(r.wind);
    expect(r.birds).toBe(0);
  });

  it('海边：海浪 + 海鸥；湖边：拍水；水上骑乘加强', () => {
    const sea = ambienceMix(s({ sea: 0.5, zoneKind: 'town' }));
    expect(sea.waves).toBeGreaterThan(0.4);
    expect(sea.gulls).toBeGreaterThan(0);
    const lake = ambienceMix(s({ fresh: 0.4 }));
    expect(lake.lap).toBeGreaterThan(0.2);
    expect(lake.waves).toBe(0);
    expect(ambienceMix(s({ sea: 0.5, surfing: true })).waves).toBeGreaterThan(sea.waves);
  });

  it('室内 / 洞穴只有室内底噪；战斗时压低', () => {
    const room = ambienceMix(s({ indoor: 'room' }));
    expect(room.room).toBeGreaterThan(0);
    expect(room.birds + room.wind + room.waves).toBe(0);
    expect(ambienceMix(s({ indoor: 'room', weather: 'rain' })).rain).toBeGreaterThan(0);
    expect(ambienceMix(s({ indoor: 'cave' })).cave).toBeGreaterThan(0);
    expect(ambienceMix(s({ battle: true })).birds).toBeLessThan(ambienceMix(s({})).birds);
  });

  it('水面采样比例', () => {
    expect(waterProximity([])).toEqual({ sea: 0, fresh: 0, river: 0 });
    expect(
      waterProximity([
        { depth: 1, sea: true },
        { depth: 0, sea: true },
        { depth: 0.5, sea: false },
        { depth: 0.01, sea: false },
      ]),
    ).toEqual({ sea: 0.25, fresh: 0.25, river: 0 });
  });
});
