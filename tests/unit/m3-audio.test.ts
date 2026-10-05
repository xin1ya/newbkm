import { describe, expect, it } from 'vitest';
import { ambienceMix, battleTrackFor, pickBgm, type AmbienceSituation } from '@/systems/audio/select';
import { MUSIC_BY_ID, resolveBgm } from '@/config/audio/music';
import { LEAGUE_INTERIOR } from '@/config/interiors/league';

const base: AmbienceSituation = { indoor: null, zoneKind: 'wild', zoneBgm: 'field-snow', time: 'day', weather: 'clear', sea: 0, fresh: 0, altitude: 10, surfing: false, battle: false };

describe('M3-30 音频', () => {
  it('雷鸣 / 琉璃馆主战用各自的道馆战曲，其余道馆用通用曲', () => {
    for (const g of ['thunder', 'dawn', 'snow', 'lark']) expect(battleTrackFor('gym', `gym-${g}-leader`)).toBe('battle-gym-thunder');
    for (const g of ['mirage', 'ghost', 'glaze']) expect(battleTrackFor('gym', `gym-${g}-leader`)).toBe('battle-gym-glaze');
    expect(battleTrackFor('gym', 'gym-azure-leader')).toBeNull();
    expect(battleTrackFor('trainer', 'gym-thunder-1')).toBeNull();
    expect(pickBgm({ battle: 'gym', victory: null, surfing: false, interiorBgm: null, zoneBgm: null, battleTrack: 'battle-gym-glaze' })).toBe('battle-gym-glaze');
    expect(pickBgm({ battle: 'gym', victory: null, surfing: false, interiorBgm: null, zoneBgm: null })).toBe('battle-gym');
  });
  it('新曲目都已登记，四天王 / 冠军 / 名人堂有曲', () => {
    for (const id of ['battle-gym-thunder', 'battle-gym-glaze', 'hall-of-fame', 'battle-elite', 'battle-champion']) expect(resolveBgm(id), id).toBe(id);
    for (const id of ['battle-gym-thunder', 'battle-gym-glaze', 'hall-of-fame']) {
      const t = MUSIC_BY_ID.get(id)!;
      expect(t.voices[0]!.notes.split('|').length).toBe(t.bars);
    }
  });
  it('名人堂房间播名人堂曲', () => {
    const hof = LEAGUE_INTERIOR.rooms.find((r) => r.id === 'hall-of-fame');
    expect(hof?.bgm).toBe('hall-of-fame');
  });
  it('雷暴有雷声层，暴雪有呼啸层，晴天都没有；室内减弱', () => {
    expect(ambienceMix({ ...base, weather: 'storm' }).thunder).toBeGreaterThan(0.5);
    expect(ambienceMix({ ...base, weather: 'blizzard' }).blizzard).toBeGreaterThan(0.5);
    expect(ambienceMix({ ...base, weather: 'snow' }).blizzard).toBeLessThan(0.2);
    const clear = ambienceMix(base);
    expect(clear.thunder + clear.blizzard).toBe(0);
    const inStorm = ambienceMix({ ...base, indoor: 'room', weather: 'storm' });
    expect(inStorm.thunder).toBeGreaterThan(0);
    expect(inStorm.thunder).toBeLessThan(0.5);
    expect(ambienceMix({ ...base, weather: 'storm', battle: true }).thunder).toBeLessThan(0.25);
  });
});
