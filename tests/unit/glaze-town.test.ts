/** M3-13 琉璃镇：布局、码头 / 神殿之门、POI / 室内 / NPC / 互动的对应关系 */
import { describe, expect, it } from 'vitest';
import { GLAZE_TOWN, GLAZE_TOWNS } from '@/config/islands/towns/glaze';
import { GLAZE } from '@/config/islands/glaze';
import { GLAZE_NPCS } from '@/config/npcs/glaze';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { INTERIORS } from '@/config/interiors';
import { pointInPolygon } from '@/world/island/ZoneMap';

const props = GLAZE_TOWN.props;

describe('琉璃镇布局', () => {
  it('已注册，含水系道馆 / 中心 / 商店 / 玻璃工坊 / 灯塔 / 神殿之门', () => {
    expect(GLAZE_TOWNS).toContain(GLAZE_TOWN);
    expect(props.some((p) => p.type === 'gym' && p.variant === 'water')).toBe(true);
    expect(props.some((p) => p.type === 'pokecenter')).toBe(true);
    expect(props.some((p) => p.type === 'mart')).toBe(true);
    expect(props.some((p) => p.type === 'house' && p.variant === 'glassworks')).toBe(true);
    expect(props.some((p) => p.type === 'lighthouse')).toBe(true);
    expect(props.filter((p) => p.type === 'house' && p.variant === 'glass').length).toBeGreaterThanOrEqual(18);
  });
  it('神殿石堤接到海中石台：石堤顶与石台顶齐平，石堤东端伸进石台', () => {
    const gate = props.find((p) => p.type === 'temple-gate')!;
    const causeway = props.find((p) => p.type === 'deck' && Math.abs(p.position[1] - gate.position[1]) < 0.01)!;
    expect(causeway).toBeTruthy();
    expect(gate.y! + 0.7).toBeCloseTo(causeway.y!, 5);
    const east = causeway.position[0] + causeway.size[0] / 2;
    const platformWest = gate.position[0] - 4.2;
    expect(east).toBeGreaterThanOrEqual(platformWest);
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
    expect(INTERIORS['glaze-glassworks']).toBeTruthy();
    expect(INTERIORS['glaze-diver-house']).toBeTruthy();
  });
  it('建筑互不重叠、不压在主街（z 148–156）上', () => {
    const rect = (p: (typeof props)[number]) => {
      const [w, , d] = p.size;
      const c = Math.abs(Math.cos(p.yaw));
      const s = Math.abs(Math.sin(p.yaw));
      return [p.position[0] - (w * c + d * s) / 2, p.position[0] + (w * c + d * s) / 2, p.position[1] - (w * s + d * c) / 2, p.position[1] + (w * s + d * c) / 2] as const;
    };
    const blds = props.filter((p) => ['house', 'pokecenter', 'mart', 'gym'].includes(p.type));
    for (let i = 0; i < blds.length; i++) {
      const a = rect(blds[i]!);
      expect(a[3] <= 148 || a[2] >= 156, blds[i]!.ref ?? `#${i}`).toBe(true);
      for (let j = i + 1; j < blds.length; j++) {
        const b = rect(blds[j]!);
        expect(a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2], `${blds[i]!.ref ?? i}/${blds[j]!.ref ?? j}`).toBe(true);
      }
    }
  });
  it('NPC 在镇里；室内 NPC 与互动都有定义', () => {
    const zone = GLAZE.zones.find((z) => z.id === 'glaze-town')!;
    const town = GLAZE_NPCS.filter((n) => n.id.startsWith('glaze-'));
    expect(town.length).toBeGreaterThanOrEqual(10);
    for (const n of town.filter((q) => q.id !== 'glaze-fisher')) for (const e of n.schedule ?? []) if ('island' in e.at) expect(pointInPolygon(e.at.position[0], e.at.position[1], zone.polygon), n.id).toBe(true);
    const npcIds = new Set(GLAZE_NPCS.map((n) => n.id));
    const ids = new Set(ALL_INTERACTIONS.map((i) => i.id));
    for (const key of ['glaze-glassworks', 'glaze-diver-house'])
      for (const room of INTERIORS[key]!.rooms) {
        for (const s of room.npcs ?? []) expect(npcIds.has(s.id), s.id).toBe(true);
        for (const f of room.furniture) if (f.interact) expect(ids.has(f.interact), f.interact).toBe(true);
      }
    for (const id of ['glaze-temple-gate', 'glaze-temple-stele', 'glaze-lighthouse', 'glaze-fountain', 'glaze-noticeboard']) expect(ids.has(id), id).toBe(true);
  });
});
