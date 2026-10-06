import { describe, expect, it } from 'vitest';
import { SECRET_TOWNS } from '@/config/islands/towns/secret';
import { ISLANDS } from '@/config/islands';
import { INTERIORS } from '@/config/interiors';
import { SECRET_NPCS } from '@/config/npcs/secret';
import { SECRET_LANDMARKS } from '@/config/interactions/secret';
import { NPC_BY_ID } from '@/config/npcs';

/** 门口 → 建筑中心：center = door − (sin, cos)(yaw) × (depth/2 + 0.6) */
function centerOf(door: [number, number], yaw: number, depth: number): [number, number] {
  const back = depth / 2 + 0.6;
  return [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back];
}

describe('M4-03 寐龙镇', () => {
  const island = ISLANDS.secret!;
  const town = SECRET_TOWNS.find((t) => t.id === 'dragon-town')!;
  const poi = (id: string) => island.pois.find((p) => p.id === id);

  it('城镇已注册且坐在谷地区域', () => {
    expect(town).toBeTruthy();
    expect(town.zone).toBe('dragon-town');
    expect(island.zones.some((z) => z.id === 'dragon-town')).toBe(true);
  });

  it('巨兽龙骨化石地标摆放并与 POI 同名', () => {
    const sk = town.props.find((p) => p.type === 'dragon-skeleton')!;
    expect(sk.position).toEqual([24, 244]);
    expect(sk.ref).toBe('dragon-bones');
    expect(poi('dragon-bones')).toBeTruthy();
  });

  it('门口 POI 与建筑 ref 对应，且 POI 落在门口', () => {
    for (const [id, door, yaw, depth] of [
      ['pokecenter-dragon', [-8, 206], Math.PI / 2, 11],
      ['mart-dragon', [-8, 224], Math.PI / 2, 9],
      ['dragon-keeper-house', [8, 212], -Math.PI / 2, 10],
    ] as Array<[string, [number, number], number, number]>) {
      const p = poi(id);
      expect(p, id).toBeTruthy();
      const b = town.props.find((q) => q.ref === id)!;
      expect(b, id).toBeTruthy();
      const [cx, cz] = centerOf(door, yaw, depth);
      expect(b.position[0]).toBeCloseTo(cx, 2);
      expect(b.position[1]).toBeCloseTo(cz, 2);
      expect(p!.position[0]).toBe(door[0]);
      expect(p!.position[2]).toBe(door[1]);
    }
  });

  it('道馆外观在街口，POI 留到 M4-06', () => {
    const gym = town.props.find((p) => p.type === 'gym')!;
    expect(gym.variant).toBe('dragon');
    expect(gym.ref).toBe('gym-dragon');
    // 门 (0,199) 朝南 → 中心 (0,185)
    expect(gym.position[0]).toBeCloseTo(0, 3);
    expect(gym.position[1]).toBeCloseTo(185, 3);
  });

  it('寐龙镇室内已注册且 NPC 齐全', () => {
    const interior = INTERIORS['dragon-keeper-house'];
    expect(interior).toBeTruthy();
    for (const r of interior!.rooms) for (const n of r.npcs ?? []) expect(NPC_BY_ID.has(n.id), n.id).toBe(true);
  });

  it('NPC 日程都在秘境岛', () => {
    expect(SECRET_NPCS.length).toBeGreaterThanOrEqual(5);
    for (const n of SECRET_NPCS)
      for (const s of n.schedule ?? []) if ('island' in s.at) expect(s.at.island, n.id).toBe('secret');
  });

  it('地标与家具互动 id 齐全', () => {
    const ids = new Set(SECRET_LANDMARKS.map((d) => d.id));
    for (const id of ['dragon-bones', 'dragon-canyon-sign', 'keeper-table', 'keeper-skull', 'keeper-shelves', 'keeper-map', 'dragon-town-notice'])
      expect(ids.has(id), id).toBe(true);
    // 家具 interact 与互动一一对应
    const room = INTERIORS['dragon-keeper-house']!.rooms[0]!;
    for (const f of room.furniture) if (f.interact) expect(ids.has(f.interact), f.interact).toBe(true);
  });

  it('建筑互不重叠（粗检：门口都在街道两侧 8 m 之外）', () => {
    for (const p of town.props) {
      if (!['house', 'pokecenter', 'mart'].includes(p.type)) continue;
      const [x, z] = p.position;
      const [w] = p.size;
      const near = town.props.filter((q) => q !== p && ['house', 'pokecenter', 'mart', 'gym'].includes(q.type) && Math.hypot(q.position[0] - x, q.position[1] - z) < (w + q.size[0]) * 0.42 && Math.abs(q.position[1] - z) < (p.size[2] + q.size[2]) * 0.42);
      expect(near.length, `${p.type}@${x},${z}`).toBe(0);
    }
  });
});
