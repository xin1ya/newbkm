/** M3-11 幻影镇：分时摆放物、布局与 POI / NPC / 互动的对应关系 */
import { describe, expect, it } from 'vitest';
import { inHourWindow, phaseKey, phaseOpacity, MIRAGE_OPACITY } from '@/world/props/phase';
import { MIRAGE_HOURS, MIRAGE_TOWN } from '@/config/islands/towns/glaze';
import { GLAZE } from '@/config/islands/glaze';
import { GLAZE_NPCS } from '@/config/npcs/glaze';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { INTERIORS } from '@/config/interiors';
import { hourInRange } from '@/systems/npcs';
import { pointInPolygon } from '@/world/island/ZoneMap';

describe('分时摆放物', () => {
  it('时间窗（含跨午夜）', () => {
    expect(inHourWindow(12, [10, 16])).toBe(true);
    expect(inHourWindow(16, [10, 16])).toBe(false);
    expect(inHourWindow(23.5, [19, 3])).toBe(true);
    expect(inHourWindow(2.9, [19, 3])).toBe(true);
    expect(inHourWindow(3, [19, 3])).toBe(false);
    expect(inHourWindow(-1, [19, 3])).toBe(true);
  });
  it('分组键与不透明度', () => {
    expect(phaseKey({})).toBeNull();
    expect(phaseKey({ hours: [10, 16], mirage: true })).toBe('phase:10-16:mirage');
    expect(phaseOpacity(20, [10, 16], true, 1)).toBe(0);
    expect(phaseOpacity(12, [20, 4], false, 1)).toBe(0);
    expect(phaseOpacity(22, [20, 4], false, 1)).toBe(1);
    for (let t = 0; t < 20; t += 0.37) {
      const o = phaseOpacity(12, [10, 16], true, t);
      expect(o).toBeGreaterThan(0.3);
      expect(o).toBeLessThanOrEqual(MIRAGE_OPACITY);
    }
  });
});

describe('幻影镇布局', () => {
  const props = MIRAGE_TOWN.props;
  it('四类分时建筑都在，幻象不参与碰撞', () => {
    const by = (h: [number, number]) => props.filter((p) => p.hours?.[0] === h[0] && p.hours?.[1] === h[1]);
    expect(by(MIRAGE_HOURS.bazaar).filter((p) => p.type === 'market-stall').length).toBe(4);
    expect(by(MIRAGE_HOURS.nightMarket).filter((p) => p.type === 'market-stall').length).toBe(4);
    expect(by(MIRAGE_HOURS.moonTower).some((p) => p.type === 'moon-tower')).toBe(true);
    const palace = by(MIRAGE_HOURS.palace);
    expect(palace.length).toBeGreaterThan(4);
    expect(palace.every((p) => p.mirage === true)).toBe(true);
    // 白日市集与月夜集市不会同时出现
    for (let h = 0; h < 24; h += 0.5) expect(inHourWindow(h, MIRAGE_HOURS.bazaar) && inHourWindow(h, MIRAGE_HOURS.nightMarket)).toBe(false);
  });
  it('有门的建筑都对应 POI，门口坐标一致', () => {
    for (const p of props.filter((q) => q.ref && ['house', 'pokecenter', 'mart', 'gym'].includes(q.type))) {
      const poi = GLAZE.pois.find((q) => q.id === p.ref);
      expect(poi, p.ref).toBeTruthy();
      const back = p.type === 'gym' ? p.size[0] / 2 + 1 : p.size[2] / 2 + 0.6;
      const dx = p.position[0] + Math.sin(p.yaw) * back;
      const dz = p.position[1] + Math.cos(p.yaw) * back;
      expect(Math.hypot(dx - poi!.position[0], dz - poi!.position[2]), p.ref).toBeLessThan(0.05);
    }
    expect(INTERIORS['mirage-seer-house']).toBeTruthy();
  });
  it('常驻建筑互不重叠、不压在主街 / 码头路上', () => {
    const rect = (p: (typeof props)[number]) => {
      const [w, , d] = p.size;
      const c = Math.abs(Math.cos(p.yaw));
      const s = Math.abs(Math.sin(p.yaw));
      const hx = (w * c + d * s) / 2;
      const hz = (w * s + d * c) / 2;
      return [p.position[0] - hx, p.position[0] + hx, p.position[1] - hz, p.position[1] + hz] as const;
    };
    const blds = props.filter((p) => !p.hours && ['house', 'pokecenter', 'mart'].includes(p.type));
    for (let i = 0; i < blds.length; i++) {
      const a = rect(blds[i]!);
      // 主街 z 446–454、码头路 x −383 ~ −377（z > 454）
      expect(a[3] < 446 || a[2] > 454, blds[i]!.ref ?? `#${i}`).toBe(true);
      if (a[2] > 454) expect(a[1] < -383 || a[0] > -377).toBe(true);
      for (let j = i + 1; j < blds.length; j++) {
        const b = rect(blds[j]!);
        expect(a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2], `${i}/${j}`).toBe(true);
      }
    }
  });
  it('NPC 在镇里，摊主日程与集市时间一致；互动都有定义', () => {
    const zone = GLAZE.zones.find((z) => z.id === 'mirage-town')!;
    for (const n of GLAZE_NPCS.filter((q) => q.id.startsWith('mirage-'))) for (const e of n.schedule ?? []) if ('island' in e.at && n.id !== 'mirage-scholar' && n.id !== 'mirage-fisher') expect(pointInPolygon(e.at.position[0], e.at.position[1], zone.polygon), n.id).toBe(true);
    const night = GLAZE_NPCS.find((n) => n.id === 'mirage-night-vendor')!.schedule![0]!;
    for (let h = 0; h < 24; h++) expect(hourInRange(h, night.from, night.to)).toBe(inHourWindow(h, MIRAGE_HOURS.nightMarket));
    const ids = new Set(ALL_INTERACTIONS.map((i) => i.id));
    for (const id of ['mirage-obelisk', 'mirage-palace', 'mirage-moon-tower', 'mirage-dock', 'seer-crystal-ball', 'seer-books', 'seer-jars', 'seer-star-chart']) expect(ids.has(id), id).toBe(true);
  });
});
