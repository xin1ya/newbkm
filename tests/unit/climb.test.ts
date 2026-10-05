import { describe, expect, it } from 'vitest';
import { ISLANDS } from '@/config/islands';
import { RIDE_BY_ID } from '@/config/rides';
import { QUEST_REGISTRY } from '@/config/quests';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { blockerOpen } from '@/systems/interaction';
import { rideFor } from '@/systems/ride';
import { RIDES } from '@/config/rides';
import { climbEndNear, climbPath, climbProgress, sampleClimb, CLIMB_REACH } from '@/systems/ride/climb';
import type { ClimbWallConfig } from '@/config/islands/types';

// 合成地形：z < 0 为 10 m 高台，z ∈ [0, 3] 为崖面，z > 3 为平地
const cliff = (_x: number, z: number): number => (z <= 0 ? 10 : z >= 3 ? 0 : 10 * (1 - z / 3));
const WALL: ClimbWallConfig = { id: 'w', name: '测试岩壁', style: 'crack', base: [0, 8], top: [0, -5] };

describe('M3-17 攀爬 · 路径', () => {
  it('路径从崖脚到崖顶单调上升，落差 = 台地高度，崖面坡度接近垂直', () => {
    const p = climbPath(WALL, cliff);
    expect(p.rise).toBeCloseTo(10, 5);
    for (let i = 1; i < p.points.length; i++) expect(p.points[i]!.y).toBeGreaterThanOrEqual(p.points[i - 1]!.y);
    expect(Math.max(...p.points.map((q) => q.pitch))).toBeGreaterThan(1.0);
    // 朝向：崖脚 (z=8) → 崖顶 (z=-5) 即 −z
    expect(Math.abs(Math.abs(p.yaw) - Math.PI)).toBeLessThan(1e-6);
  });
  it('崖面上的点往崖外退（不钻进岩壁），平地上不退', () => {
    const p = climbPath(WALL, cliff);
    const onFace = p.points.filter((q) => q.pitch > 1.0);
    expect(onFace.length).toBeGreaterThan(0);
    for (const q of onFace) expect(q.y).toBeGreaterThanOrEqual(cliff(q.x, q.z) - 1e-6);
    expect(p.points[0]!.z).toBeCloseTo(8, 6);
  });
  it('按长度采样：两端与中点', () => {
    const p = climbPath(WALL, cliff);
    expect(sampleClimb(p, 0).y).toBeCloseTo(0, 6);
    expect(sampleClimb(p, p.length).y).toBeCloseTo(10, 6);
    expect(sampleClimb(p, p.length * 2).s).toBe(p.length);
  });
  it('推进：W 上 S 下，到顶继续推才算到顶；奔跑更快', () => {
    const p = climbPath(WALL, cliff);
    const a = climbProgress(p, 0, 1, false, 1);
    const b = climbProgress(p, 0, 1, true, 1);
    expect(b.s).toBeGreaterThan(a.s);
    expect(climbProgress(p, p.length, 1, false, 0.1).atTop).toBe(true);
    expect(climbProgress(p, p.length, 0, false, 0.1).atTop).toBe(false);
    expect(climbProgress(p, 0, -1, false, 0.1).atBase).toBe(true);
  });
  it('端点检测：距离 + 朝向（崖脚要面朝崖顶，崖顶要面朝崖脚）', () => {
    expect(climbEndNear([WALL], 0, 8.5)?.end).toBe('base');
    expect(climbEndNear([WALL], 0, -5.5)?.end).toBe('top');
    expect(climbEndNear([WALL], 0, 8 + CLIMB_REACH + 0.5)).toBeNull();
    expect(climbEndNear([WALL], 0, 8.5, Math.PI)?.end).toBe('base');
    expect(climbEndNear([WALL], 0, 8.5, 0)).toBeNull();
    expect(climbEndNear([WALL], 0, -5.5, 0)?.end).toBe('top');
  });
});

describe('M3-17 攀爬 · 配置', () => {
  const T = ISLANDS.thunder!;
  it('攀岩骑乘已实装，flag = 雪原道馆奖励', () => {
    const r = RIDE_BY_ID.get('climb')!;
    expect(r.implemented).toBe(true);
    expect(QUEST_REGISTRY.get('main-gym-snow')!.reward!.hm).toBe(r.flag);
    expect(rideFor(RIDES, 'rock', {})).toBeNull();
    expect(rideFor(RIDES, 'rock', { [r.flag]: true })?.id).toBe('climb');
  });
  it('雷鸣：高崖南壁 3 处 + 冰岩台 1 处；崖脚在崖下（南）、崖顶在崖上（北）', () => {
    const walls = T.climbWalls ?? [];
    expect(walls.length).toBe(4);
    const scarp = T.scarps!.find((s) => s.id === 'cloud-scarp')!;
    for (const w of walls.filter((q) => q.id.startsWith('cloud-scarp'))) {
      // 找到同 x 处的崖线 z
      const pts = scarp.points;
      const i = pts.findIndex((p, k) => k + 1 < pts.length && p[0] <= w.base[0] && pts[k + 1]![0] >= w.base[0]);
      const [ax, az] = pts[i]!;
      const [bx, bz] = pts[i + 1]!;
      const zc = az + ((w.base[0] - ax) / (bx - ax)) * (bz - az);
      expect(w.base[1], w.id).toBeGreaterThan(zc + 4);
      expect(w.top[1], w.id).toBeLessThan(zc - 4);
    }
    for (const w of walls) expect(Math.hypot(w.top[0] - w.base[0], w.top[1] - w.base[1]), w.id).toBeLessThan(25);
  });
  it('冰岩台：封锁点同样挡飞行（攀岩 flag 解除）；台顶的石匣在封锁圈内，奖励不融冰', () => {
    const b = T.blockers.find((q) => q.id === 'glacier-ledge')!;
    expect(b.type).toBe('climb');
    expect(blockerOpen(b, () => false)).toBe(false);
    expect(blockerOpen(b, (f) => f === 'hm08-rock-climb')).toBe(true);
    const cache = T.pois.find((p) => p.id === 'glacier-ledge-cache')!;
    expect(Math.hypot(cache.position[0] - b.position[0], cache.position[2] - b.position[2])).toBeLessThan(b.radius!);
    const top = T.climbWalls!.find((w) => w.id === 'glacier-ledge-wall')!.top;
    expect(Math.hypot(top[0] - b.position[0], top[1] - b.position[2])).toBeLessThan(b.radius! + 1);
    const def = ALL_INTERACTIONS.find((d) => d.id === 'glacier-ledge-cache')!;
    expect(def.effects?.[0]).toMatchObject({ kind: 'give-item', item: 'never-melt-ice' });
  });
});
