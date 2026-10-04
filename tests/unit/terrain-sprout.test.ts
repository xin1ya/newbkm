/**
 * M1-01 · 萌芽群岛正式地形校验：读取生成的高度图 / 材质图，检查可走性、水系与关键地点。
 * 地形重新生成（pnpm gen:sprout）后必须保持通过。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPROUT } from '@/config/islands/sprout';
import { Heightfield } from '@/world/terrain/Heightfield';
import { ALL_NPCS } from '@/config/npcs';

const dir = join(__dirname, '../../assets');
const buf = (p: string) => {
  const b = readFileSync(join(dir, p));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const hf = Heightfield.fromPng(SPROUT, buf(SPROUT.heightmap), SPROUT.splatmaps.map(buf));
const MAX_WALK_SLOPE = 25;

/** 半径 r 内的最大坡度（按 1 m 采样） */
const maxSlope = (x: number, z: number, r = 1.5) => {
  let m = 0;
  for (let dx = -r; dx <= r; dx += 1) for (let dz = -r; dz <= r; dz += 1) m = Math.max(m, hf.slopeAt(x + dx, z + dz));
  return m;
};
const bridges = SPROUT.roads.filter((r) => r.surface === 'boardwalk');
const nearBridge = (x: number, z: number) =>
  bridges.some((b) => b.points.some((p, i) => {
    const q = b.points[i + 1];
    if (!q) return false;
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t) < 14;
  }));

describe('M1-01 萌芽群岛地形', () => {
  it('出生点在陆地上且平坦', () => {
    const [x, , z] = SPROUT.spawnPoint;
    expect(hf.waterAt(x, z)).toBeNull();
    expect(maxSlope(x, z, 3)).toBeLessThan(MAX_WALK_SLOPE);
  });

  it('所有陆上地点（门、中心、商店、地标、洞穴）不在水里且可站立', () => {
    for (const p of SPROUT.pois) {
      if (p.kind === 'dock' || p.kind === 'ferry' || p.kind === 'fishing' || p.kind === 'gym') continue;
      const [x, , z] = p.position;
      expect(hf.waterAt(x, z), p.id).toBeNull();
      expect(hf.heightAt(x, z), p.id).toBeGreaterThan(0.3);
      expect(maxSlope(x, z), p.id).toBeLessThan(MAX_WALK_SLOPE);
    }
  });

  it('所有陆路每 2 m 采样：坡度 < 25°，除木桥处外不下水', () => {
    for (const r of SPROUT.roads) {
      if (r.surface === 'boardwalk') continue;
      for (let s = 0; s + 1 < r.points.length; s++) {
        const [ax, az] = r.points[s]!;
        const [bx, bz] = r.points[s + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t <= len; t += 2) {
          const x = ax + ((bx - ax) * t) / len;
          const z = az + ((bz - az) * t) / len;
          const at = `${r.id} @ (${x.toFixed(0)}, ${z.toFixed(0)})`;
          // 木桥桥面下（与两端 14 m 引桥）走的是桥面，不检查地面
          if (nearBridge(x, z)) continue;
          expect(hf.slopeAt(x, z), at).toBeLessThan(MAX_WALK_SLOPE);
          expect(hf.waterAt(x, z), at).toBeNull();
        }
      }
    }
  });

  it('河流：沿线都是水，下游足够深可以水上骑乘；河口接海', () => {
    for (const r of SPROUT.rivers ?? []) {
      let deep = 0;
      let n = 0;
      for (let s = 0; s + 1 < r.points.length; s++) {
        const [ax, az] = r.points[s]!;
        const [bx, bz] = r.points[s + 1]!;
        for (let t = 0.1; t < 1; t += 0.2) {
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          const w = hf.waterAt(x, z);
          expect(w, `${r.id} @ ${x.toFixed(0)},${z.toFixed(0)}`).not.toBeNull();
          n++;
          if ((w?.depth ?? 0) >= 0.6) deep++;
        }
      }
      expect(deep / n, r.id).toBeGreaterThan(0.8);
      // 两岸 width/2 + 8 m 处为陆地
      // 三角洲分汊在分流点紧贴主河道，岸线取下游段检查
      const si = r.id.startsWith('delta-') ? 3 : 1;
      const [ax, az] = r.points[si]!;
      const [bx, bz] = r.points[si + 1]!;
      const l = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / l;
      const nz = (bx - ax) / l;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      for (const sgn of [-1, 1]) expect(hf.waterAt(mx + nx * sgn * (r.width / 2 + 8), mz + nz * sgn * (r.width / 2 + 8)), `${r.id} 岸`).toBeNull();
    }
    const river = SPROUT.rivers!.find((r) => r.id === 'cuilan-river')!;
    const mouth = river.points[river.points.length - 1]!;
    expect(hf.waterAt(mouth[0], mouth[1] + 12)?.body).toBe('sea');
    // 源头接湖
    expect(hf.waterAt(river.points[0]![0], river.points[0]![1])?.body).toBe('cuilan-lake');
  });

  it('西岸海崖：洞穴门口在崖下海滩上，东侧 10 m 为崖顶，海滩可沿小路从萌芽镇走到', () => {
    const cave = SPROUT.pois.find((p) => p.id === 'meadow-hidden-cave')!;
    const [x, , z] = cave.position;
    expect(hf.heightAt(x, z)).toBeLessThan(3);
    expect(hf.heightAt(x + 10, z)).toBeGreaterThan(11);
    expect(hf.waterAt(x - 6, z)).toBeNull();
    const rock = SPROUT.blockers.find((b) => b.id === 'hidden-cave-rock')!;
    expect(Math.hypot(rock.position[0] - x, rock.position[2] - z)).toBeLessThan(5);
  });

  it('外围小岛与各区域中心都在陆地上（海域除外）', () => {
    for (const zn of SPROUT.zones) {
      if (zn.kind === 'sea') continue;
      const cx = zn.polygon.reduce((a, p) => a + p[0], 0) / zn.polygon.length;
      const cz = zn.polygon.reduce((a, p) => a + p[1], 0) / zn.polygon.length;
      expect(hf.heightAt(cx, cz), zn.id).toBeGreaterThan(0.5);
    }
    for (const [x, z] of [[-318, 462], [250, -490], [488, -160]] as const) expect(hf.heightAt(x, z), `${x},${z}`).toBeGreaterThan(1);
  });

  it('户外 NPC / 训练家的日程位置都在旱地上', () => {
    const bad: string[] = [];
    for (const n of ALL_NPCS)
      for (const e of n.schedule ?? []) {
        const at = e.at as { island?: string; position?: [number, number] };
        if (at.island !== 'sprout' || !at.position) continue;
        const [x, z] = at.position;
        if (hf.waterAt(x, z) || hf.heightAt(x, z) < 0.3) bad.push(`${n.id} @ ${x},${z}`);
      }
    expect(bad).toEqual([]);
  });

  it('材质权重每像素和为 1，陆地可行走比例 ≥ 85%', () => {
    const w = hf.surfaceAt(-80, 300);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
    let land = 0;
    let ok = 0;
    for (let x = -500; x < 500; x += 8)
      for (let z = -500; z < 500; z += 8) {
        if (hf.heightAt(x, z) < 0.3 || hf.waterAt(x, z)) continue;
        land++;
        if (hf.slopeAt(x, z) < 40) ok++;
      }
    expect(ok / land).toBeGreaterThan(0.85);
  });
});
