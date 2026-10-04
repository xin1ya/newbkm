/**
 * M1-02 / M1-03 / M1-04 · 三座城镇布局校验：
 * 用真实的 GrayboxProps + CollisionWorld 生成碰撞体，检查门口可达、NPC 不被摆放物卡住、
 * 建筑互不重叠、不压道路、湖上栈道与岸 / 道馆栈桥相连、码头压平。
 * 地形或布局修改后（pnpm gen:sprout）必须保持通过。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPROUT } from '@/config/islands/sprout';
import { SPROUT_TOWNS, CUILAN_DECK_Y, HARBOR_QUAY_Y } from '@/config/islands/towns';
import type { PropInstance, PropsFile } from '@/config/islands/types';
import { Heightfield } from '@/world/terrain/Heightfield';
import { CollisionWorld } from '@/world/collision/CollisionWorld';
import { GrayboxProps } from '@/world/props/GrayboxProps';
import { ALL_NPCS } from '@/config/npcs';
import { STEP_HEIGHT } from '@/actors/player/PlayerController';

const dir = join(__dirname, '../../assets');
const buf = (p: string) => {
  const b = readFileSync(join(dir, p));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const hf = Heightfield.fromPng(SPROUT, buf(SPROUT.heightmap), SPROUT.splatmaps.map(buf));
const file = JSON.parse(readFileSync(join(dir, 'islands/sprout/props.json'), 'utf8')) as PropsFile;
const collision = new CollisionWorld();
const props = new GrayboxProps(hf, collision, file);

/** 站在 (x, z) 处（脚底 y）会不会被非可站立碰撞体挡住 */
function blockedAt(x: number, z: number, y: number, r = 0.35): string | null {
  for (const c of collision.query(x, z, r + 0.5)) {
    if (c.kind === 'box' && c.walkableTop) continue;
    if (c.y1 < y + 0.3 || c.y0 > y + 1.6) continue;
    if (c.kind === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return c.tag ?? 'circle';
    } else {
      const s = Math.sin(-c.yaw);
      const co = Math.cos(-c.yaw);
      const lx = (x - c.x) * co - (z - c.z) * s;
      const lz = (x - c.x) * s + (z - c.z) * co;
      if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return c.tag ?? 'box';
    }
  }
  return null;
}
const standY = (x: number, z: number) => Math.max(hf.heightAt(x, z), collision.walkableTopAt(x, z, hf.heightAt(x, z) + 1.5));


/**
 * 模拟沿直线行走（与 PlayerController 相同：只能踏上不高于当前 + STEP_HEIGHT 的平台），
 * 返回每一步的脚底高度；途中被挡住 / 跌落超过 0.8 m 视为不连通。
 */
function walk(from: [number, number], to: [number, number], label: string, minY = -Infinity): void {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const g0 = hf.heightAt(from[0], from[1]);
  let y = Math.max(g0, collision.walkableTopAt(from[0], from[1], g0 + 5));
  for (let t = 0; t <= len; t += 0.4) {
    const x = from[0] + ((to[0] - from[0]) * t) / len;
    const z = from[1] + ((to[1] - from[1]) * t) / len;
    const ground = hf.heightAt(x, z);
    const ny = Math.max(ground, collision.walkableTopAt(x, z, y + STEP_HEIGHT));
    expect(ny, `${label} 跌落 @${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(Math.max(minY, y - 0.8));
    expect(blockedAt(x, z, ny, 0.3), `${label} 被挡 @${x.toFixed(1)},${z.toFixed(1)}`).toBeNull();
    y = ny;
  }
}

const BUILDINGS = new Set(['house', 'lab', 'pokecenter', 'mart', 'warehouse', 'market-hall', 'terminal', 'greenhouse']);
const townProps: PropInstance[] = SPROUT_TOWNS.flatMap((t) => t.props);

function corners(p: PropInstance, grow = 0): Array<[number, number]> {
  const [w, , d] = p.size;
  const s = Math.sin(p.yaw);
  const c = Math.cos(p.yaw);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => {
    const lx = (a * (w + grow)) / 2;
    const lz = (b * (d + grow)) / 2;
    return [p.position[0] + lx * c + lz * s, p.position[1] - lx * s + lz * c];
  });
}
function insideRect(p: PropInstance, x: number, z: number, grow = 0): boolean {
  const s = Math.sin(-p.yaw);
  const c = Math.cos(-p.yaw);
  const lx = (x - p.position[0]) * c - (z - p.position[1]) * s;
  const lz = (x - p.position[0]) * s + (z - p.position[1]) * c;
  return Math.abs(lx) < p.size[0] / 2 + grow && Math.abs(lz) < p.size[2] / 2 + grow;
}

describe('M1-02/03/04 城镇布局', () => {
  it('所有带室内的 POI 门口与建筑对齐，门口可站立、不被挡住', () => {
    for (const poi of SPROUT.pois.filter((q) => q.interior && q.kind !== 'cave' && q.kind !== 'gym')) {
      const d = props.doors.get(poi.id);
      expect(d, poi.id).toBeTruthy();
      expect(Math.hypot(d!.position.x - poi.position[0], d!.position.z - poi.position[2]), poi.id).toBeLessThan(0.6);
      // 门外 1.2 m 处可站立
      const fx = d!.position.x + Math.sin(d!.yaw) * 1.2;
      const fz = d!.position.z + Math.cos(d!.yaw) * 1.2;
      expect(blockedAt(fx, fz, standY(fx, fz)), `${poi.id} 门外`).toBeNull();
    }
  });

  it('户外 NPC / 训练家站位没有被城镇摆放物卡住', () => {
    const bad: string[] = [];
    for (const n of ALL_NPCS)
      for (const s of n.schedule ?? []) {
        const at = s.at as { island?: string; position?: [number, number] };
        if (at.island !== 'sprout' || !at.position) continue;
        const [x, z] = at.position;
        const hit = blockedAt(x, z, standY(x, z), 0.3);
        if (hit) bad.push(`${n.id}@${x},${z} → ${hit}`);
      }
    expect(bad).toEqual([]);
  });

  it('出生点周围 2 m 空旷', () => {
    const [x, , z] = SPROUT.spawnPoint;
    for (let a = 0; a < 8; a++) expect(blockedAt(x + Math.sin(a) * 2, z + Math.cos(a) * 2, standY(x, z))).toBeNull();
  });

  it('建筑占地互不重叠', () => {
    const bs = townProps.filter((p) => BUILDINGS.has(p.type) || p.type === 'stilt-house');
    const bad: string[] = [];
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i]!;
        const b = bs[j]!;
        if (corners(a).some(([x, z]) => insideRect(b, x, z)) || corners(b).some(([x, z]) => insideRect(a, x, z)) || insideRect(a, b.position[0], b.position[1])) bad.push(`${a.type}${a.position} × ${b.type}${b.position}`);
      }
    expect(bad).toEqual([]);
  });

  it('建筑不压岛屿道路与城镇小路的中线', () => {
    const bad: string[] = [];
    const bs = townProps.filter((p) => BUILDINGS.has(p.type));
    for (const r of SPROUT.roads.filter((q) => q.surface !== 'boardwalk'))
      for (let i = 0; i + 1 < r.points.length; i++) {
        const [ax, az] = r.points[i]!;
        const [bx, bz] = r.points[i + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t <= len; t += 0.5) {
          const x = ax + ((bx - ax) * t) / len;
          const z = az + ((bz - az) * t) / len;
          for (const b of bs) if (insideRect(b, x, z, -0.2)) bad.push(`${r.id} @${x.toFixed(0)},${z.toFixed(0)} × ${b.type}${b.position}`);
        }
      }
    expect([...new Set(bad)].slice(0, 10)).toEqual([]);
  });

  it('建筑地块已压平（四角高差 < 0.35 m）', () => {
    for (const b of townProps.filter((p) => BUILDINGS.has(p.type) && p.y === undefined)) {
      const hs = corners(b).map(([x, z]) => hf.heightAt(x, z));
      expect(Math.max(...hs) - Math.min(...hs), `${b.type}${b.position}`).toBeLessThan(0.35);
    }
  });

  it('翠澜镇：湖上栈道——连岸平台西端埋入岸坡，主栈道与道馆栈桥、外环、高脚屋外廊相连', () => {
    // 从岸边（x=10）沿三条连岸栈道走到主栈道中线，不会掉进湖里
    for (const z of [-100, -55, -15]) walk([10, z], [26, z], `连岸 z=${z}`, CUILAN_DECK_Y - 0.4);
    walk([26, -55], [40, -55], '主栈道→道馆栈桥', CUILAN_DECK_Y - 0.4);
    walk([26, -90], [46, -90], '横栈道', CUILAN_DECK_Y - 0.4);
    walk([46, -90], [46, -64], '外环→钓台', CUILAN_DECK_Y - 0.4);
    walk([26, -122], [26, 2], '主栈道全程', CUILAN_DECK_Y - 0.4);
    // 每栋高脚屋外廊可以从栈道走进去（正面开口 → 门前）
    for (const h of townProps.filter((p) => p.type === 'stilt-house')) {
      const fx = Math.sin(h.yaw);
      const fz = Math.cos(h.yaw);
      for (let k = h.size[2] / 2 + 1.2; k >= 1.3; k -= 0.4) {
        const x = h.position[0] + fx * k;
        const z = h.position[1] + fz * k;
        expect(blockedAt(x, z, CUILAN_DECK_Y, 0.3), `stilt ${h.position} k=${k.toFixed(1)}`).toBeNull();
      }
    }
    // 栏杆：主栈道外侧（湖面一侧，无开口处）不能直接走下水
    expect(blockedAt(28, -70, CUILAN_DECK_Y, 0.3)).toBe('deck-rail');
  });

  it('港湾市：码头压平到码头高度，渡船 / 钓鱼栈桥与码头相接', () => {
    for (const z of [-40, 0, 25, 60, 115, 140]) expect(Math.abs(hf.heightAt(432, z) - HARBOR_QUAY_Y), `quay z=${z}`).toBeLessThan(0.3);
    walk([425, 25], [465, 25], '码头→渡船栈桥', 2.0);
    walk([425, 115], [476, 115], '码头→钓鱼栈桥', 2.0);
  });

  it('城镇里有足够的细节（每镇 ≥ 60 个摆放物，且包含主题构件）', () => {
    const count = (id: string) => SPROUT_TOWNS.find((t) => t.id === id)!.props.length;
    for (const id of ['sprout-town', 'cuilan-town', 'harbor-city']) expect(count(id), id).toBeGreaterThanOrEqual(60);
    const types = (id: string) => new Set(SPROUT_TOWNS.find((t) => t.id === id)!.props.map((p) => p.type));
    expect([...types('sprout-town')]).toEqual(expect.arrayContaining(['lab', 'greenhouse', 'fountain', 'windmill', 'deck', 'rowboat', 'garden']));
    expect([...types('cuilan-town')]).toEqual(expect.arrayContaining(['stilt-house', 'deck', 'lantern', 'reeds', 'lilypads', 'statue', 'market-stall']));
    expect([...types('harbor-city')]).toEqual(expect.arrayContaining(['market-hall', 'terminal', 'lighthouse', 'crane', 'container', 'seawall', 'shed', 'boat']));
  });
});
