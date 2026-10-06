import { describe, expect, it } from 'vitest';
import { MOON_NIGHT_HOURS, MOON_TOWN_FLAG, SECRET_TOWNS } from '@/config/islands/towns/secret';
import { ISLANDS } from '@/config/islands';
import { SECRET_NPCS } from '@/config/npcs/secret';
import { SECRET_LANDMARKS } from '@/config/interactions/secret';
import { inHourWindow, phaseKey } from '@/world/props/phase';

describe('M4-04 月魇镇', () => {
  const island = ISLANDS.secret!;
  const town = SECRET_TOWNS.find((t) => t.id === 'moon-town')!;
  const poi = (id: string) => island.pois.find((p) => p.id === id);

  it('夜现构件全部同时带 hours 与 requiresFlag（同一分时组）', () => {
    expect(town).toBeTruthy();
    for (const p of town.props) {
      const night = p.hours !== undefined || p.requiresFlag !== undefined;
      if (!night) continue;
      expect(p.hours, `${p.type}@${p.position}`).toEqual(MOON_NIGHT_HOURS);
      expect(p.requiresFlag, p.type).toBe(MOON_TOWN_FLAG);
    }
    // 至少整套镇子（道馆 + 5 屋 + 碑 + 摊 + 灯…）都在夜里
    expect(town.props.filter((p) => p.hours).length).toBeGreaterThan(15);
  });

  it('白天常设物不带 flag：遗址指路牌始终在', () => {
    const sign = town.props.find((p) => p.type === 'sign' && p.ref === 'moon-ruins')!;
    expect(sign).toBeTruthy();
    expect(sign.hours).toBeUndefined();
    expect(sign.requiresFlag).toBeUndefined();
  });

  it('魇月道馆外观在遗址北端、夜里浮现；POI/室内留 M4-07', () => {
    const gym = town.props.find((p) => p.type === 'gym')!;
    expect(gym.variant).toBe('moon');
    expect(gym.ref).toBe('gym-moon');
    expect(gym.hours).toEqual(MOON_NIGHT_HOURS);
    expect(gym.requiresFlag).toBe(MOON_TOWN_FLAG);
    // 门 (40,-345) 朝南 → 中心 (40,-356)
    expect(gym.position[0]).toBeCloseTo(40, 3);
    expect(gym.position[1]).toBeCloseTo(-345 - (22 / 2 + 1) * Math.cos(0), 3);
    expect(poi('gym-moon')).toBeUndefined();
  });

  it('夜镇互动都有对应 POI（白天不可调查）', () => {
    for (const id of ['moon-town-board', 'moon-gym-board', 'moon-statue']) {
      expect(poi(id), id).toBeTruthy();
      const def = SECRET_LANDMARKS.find((d) => d.id === id)!;
      expect(def, id).toBeTruthy();
      expect(def.showIf, id).toBe(MOON_TOWN_FLAG);
    }
    expect(poi('moon-ruins')).toBeTruthy();
    expect(SECRET_LANDMARKS.find((d) => d.id === 'moon-ruins')?.night?.length).toBeGreaterThan(0);
    expect(SECRET_LANDMARKS.find((d) => d.id === 'moon-mirror-stele')).toBeTruthy();
  });

  it('夜镇 NPC 只在解锁后的夜里；守址人白天常驻', () => {
    const nightNpcs = SECRET_NPCS.filter((n) => n.showIf?.includes(MOON_TOWN_FLAG));
    expect(nightNpcs.length).toBe(4);
    for (const n of nightNpcs) {
      expect(n.schedule, n.id).toBeTruthy();
      for (const s of n.schedule!) expect(s.from).toBe(19);
    }
    const hermit = SECRET_NPCS.find((n) => n.id === 'moon-hermit')!;
    expect(hermit.showIf).toBeUndefined();
    expect(hermit.schedule![0]).toMatchObject({ from: 6, to: 19 });
  });

  it('分时机制：跨午夜窗 + 带 flag 的组键独立', () => {
    expect(inHourWindow(23, MOON_NIGHT_HOURS)).toBe(true);
    expect(inHourWindow(2, MOON_NIGHT_HOURS)).toBe(true);
    expect(inHourWindow(12, MOON_NIGHT_HOURS)).toBe(false);
    const bare = phaseKey({ hours: MOON_NIGHT_HOURS } as never);
    const gated = phaseKey({ hours: MOON_NIGHT_HOURS, requiresFlag: MOON_TOWN_FLAG } as never);
    expect(gated).not.toBe(bare);
    expect(gated).toContain(MOON_TOWN_FLAG);
  });
});
