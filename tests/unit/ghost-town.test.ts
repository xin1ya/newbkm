/** M3-12 幽冥镇：布局、午夜鬼火、POI / 室内 / NPC / 互动的对应关系 */
import { describe, expect, it } from 'vitest';
import { inHourWindow } from '@/world/props/phase';
import { GHOST_HOURS, GHOST_TOWN, GLAZE_TOWNS } from '@/config/islands/towns/glaze';
import { GLAZE } from '@/config/islands/glaze';
import { GLAZE_NPCS } from '@/config/npcs/glaze';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { INTERIORS } from '@/config/interiors';
import { pointInPolygon } from '@/world/island/ZoneMap';

const props = GHOST_TOWN.props;

describe('幽冥镇布局', () => {
  it('已注册到琉璃城镇列表，含道馆 / 中心 / 商店 / 钟楼 / 墓园', () => {
    expect(GLAZE_TOWNS).toContain(GHOST_TOWN);
    expect(props.some((p) => p.type === 'gym' && p.variant === 'ghost')).toBe(true);
    expect(props.some((p) => p.type === 'pokecenter')).toBe(true);
    expect(props.some((p) => p.type === 'mart')).toBe(true);
    expect(props.some((p) => p.type === 'bell-tower')).toBe(true);
    expect(props.filter((p) => p.type === 'tombstone').length).toBeGreaterThan(20);
    expect(props.filter((p) => p.type === 'ghost-lamp').length).toBeGreaterThan(5);
  });
  it('午夜鬼火只在 0–3 时出现', () => {
    const mid = props.filter((p) => p.hours);
    expect(mid.length).toBeGreaterThan(3);
    for (const p of mid) expect(p.hours).toEqual(GHOST_HOURS.midnight);
    expect(inHourWindow(1, GHOST_HOURS.midnight)).toBe(true);
    expect(inHourWindow(12, GHOST_HOURS.midnight)).toBe(false);
  });
  it('有门的建筑都对应 POI 与室内，门口坐标一致', () => {
    for (const p of props.filter((q) => q.ref && ['house', 'pokecenter', 'mart', 'gym'].includes(q.type))) {
      const poi = GLAZE.pois.find((q) => q.id === p.ref);
      expect(poi, p.ref).toBeTruthy();
      const back = p.type === 'gym' ? p.size[0] / 2 + 1 : p.size[2] / 2 + 0.6;
      const dx = p.position[0] + Math.sin(p.yaw) * back;
      const dz = p.position[1] + Math.cos(p.yaw) * back;
      expect(Math.hypot(dx - poi!.position[0], dz - poi!.position[2]), p.ref).toBeLessThan(0.05);
    }
    expect(INTERIORS['ghost-ossuary']).toBeTruthy();
    expect(INTERIORS['ghost-gravekeeper-house']).toBeTruthy();
  });
  it('常驻建筑互不重叠', () => {
    const rect = (p: (typeof props)[number]) => {
      const [w, , d] = p.size;
      const c = Math.abs(Math.cos(p.yaw));
      const s = Math.abs(Math.sin(p.yaw));
      return [p.position[0] - (w * c + d * s) / 2, p.position[0] + (w * c + d * s) / 2, p.position[1] - (w * s + d * c) / 2, p.position[1] + (w * s + d * c) / 2] as const;
    };
    const blds = props.filter((p) => ['house', 'pokecenter', 'mart', 'bell-tower', 'stilt-house'].includes(p.type));
    for (let i = 0; i < blds.length; i++)
      for (let j = i + 1; j < blds.length; j++) {
        const a = rect(blds[i]!);
        const b = rect(blds[j]!);
        expect(a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2], `${blds[i]!.ref ?? i}/${blds[j]!.ref ?? j}`).toBe(true);
      }
  });
  it('NPC 在镇里；室内 NPC 与互动都有定义', () => {
    const zone = GLAZE.zones.find((z) => z.id === 'ghost-town')!;
    const ghost = GLAZE_NPCS.filter((n) => n.id.startsWith('ghost-'));
    expect(ghost.length).toBeGreaterThanOrEqual(8);
    for (const n of ghost.filter((q) => q.id !== 'ghost-stilt-fisher')) for (const e of n.schedule ?? []) if ('island' in e.at) expect(pointInPolygon(e.at.position[0], e.at.position[1], zone.polygon), n.id).toBe(true);
    const npcIds = new Set(GLAZE_NPCS.map((n) => n.id));
    const ids = new Set(ALL_INTERACTIONS.map((i) => i.id));
    for (const key of ['ghost-ossuary', 'ghost-gravekeeper-house'])
      for (const room of INTERIORS[key]!.rooms) {
        for (const s of room.npcs ?? []) expect(npcIds.has(s.id), s.id).toBe(true);
        for (const f of room.furniture) if (f.interact) expect(ids.has(f.interact), f.interact).toBe(true);
      }
    for (const id of ['ghost-cemetery', 'ghost-bell-tower', 'ghost-noticeboard']) expect(ids.has(id), id).toBe(true);
  });
});
