/** 自动战斗：指定打手 / 打手招式 / 骑乘寻怪（纯逻辑） */
import { describe, expect, it } from 'vitest';
import { FLY_SEARCH_CRUISE, FLY_SEARCH_DESCEND, defaultAutoConfig, flyCruiseVy, flySearchStep, moveAllowed, pickCarrier, sanitizeAutoConfig } from '@/systems/autobattle';

describe('代练指定打手', () => {
  const party = [
    { uid: 'a', level: 5, hp: 20, canHit: true },
    { uid: 'b', level: 40, hp: 100, canHit: true },
    { uid: 'c', level: 30, hp: 90, canHit: true },
  ];
  it('指定的打手优先（不限等级），不可用时退回等级最高的', () => {
    expect(pickCarrier(party)).toBe(1);
    expect(pickCarrier(party, 'c')).toBe(2);
    expect(pickCarrier(party.map((m) => (m.uid === 'c' ? { ...m, hp: 0 } : m)), 'c')).toBe(1);
    expect(pickCarrier(party.map((m) => (m.uid === 'c' ? { ...m, canHit: false } : m)), 'c')).toBe(1);
    expect(pickCarrier(party, 'a')).toBe(1); // 首发不能当打手
    expect(pickCarrier([party[0]!, { uid: 'd', level: 3, hp: 10, canHit: true }], 'd')).toBe(1);
  });
  it('打手限定招式只作用于打手', () => {
    const cfg = { ...defaultAutoConfig(), train: true, carrierUid: 'b', carrierMoves: ['surf'], disabledMoves: ['tackle'] };
    expect(moveAllowed(cfg, 'b', 'surf')).toBe(true);
    expect(moveAllowed(cfg, 'b', 'tackle')).toBe(false);
    expect(moveAllowed(cfg, 'b', 'ember')).toBe(false);
    expect(moveAllowed(cfg, 'a', 'ember')).toBe(true);
    expect(moveAllowed(cfg, 'a', 'tackle')).toBe(false);
    expect(moveAllowed({ ...cfg, carrierMoves: [] }, 'b', 'ember')).toBe(true);
    expect(moveAllowed({ ...cfg, train: false }, 'b', 'ember')).toBe(true);
  });
  it('配置读取兼容旧存档', () => {
    const c = sanitizeAutoConfig({ targets: { 16: 'defeat' } });
    expect(c.carrierUid).toBeNull();
    expect(c.carrierMoves).toEqual([]);
    expect(c.flySearch).toBe(false);
    const d = sanitizeAutoConfig({ carrierUid: 'x1', carrierMoves: ['a', 1, 'b', 'c', 'd', 'e'], flySearch: true });
    expect(d.carrierUid).toBe('x1');
    expect(d.carrierMoves).toEqual(['a', 'b', 'c', 'd']);
    expect(d.flySearch).toBe(true);
  });
});

describe('骑乘寻怪', () => {
  it('远处巡航、接近时下滑、贴近低空时降落', () => {
    expect(flySearchStep(null, 5, 2.2)).toEqual({ kind: 'cruise', altitude: FLY_SEARCH_CRUISE });
    expect(flySearchStep(100, 12, 2.2)).toEqual({ kind: 'cruise', altitude: FLY_SEARCH_CRUISE });
    const mid = flySearchStep(FLY_SEARCH_DESCEND / 2 + 3, 12, 2.2);
    expect(mid.kind).toBe('cruise');
    if (mid.kind === 'cruise') expect(mid.altitude).toBeLessThan(FLY_SEARCH_CRUISE);
    expect(flySearchStep(5, 2, 2.2).kind).toBe('land');
    expect(flySearchStep(5, 6, 2.2).kind).toBe('cruise');
    // 下滑高度随距离单调
    let last = -1;
    for (let d = 6; d <= 30; d += 2) {
      const s = flySearchStep(d, 9, 2.2);
      const a = s.kind === 'cruise' ? s.altitude : 0;
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });
  it('垂直速度限幅', () => {
    expect(flyCruiseVy(0, 100, 7)).toBe(7);
    expect(flyCruiseVy(100, 0, 7)).toBeCloseTo(-9.1);
    expect(flyCruiseVy(12, 12, 7)).toBe(0);
  });
});
