/**
 * M3-17 · 攀爬骑乘的纯逻辑（无 three 依赖，便于单测）。
 * - climbPath：沿崖脚 → 崖顶采样一条贴着崖面的路径（高度跟随地形，水平方向往崖外退一点，免得钻进岩壁）
 * - climbEndNear：玩家是否站在某面岩壁的崖脚 / 崖顶，并大致面朝岩壁
 * - climbProgress：按输入推进路径参数（W 上 / S 下），两端停住
 */
import type { ClimbWallConfig } from '@/config/islands/types';

/** 离崖脚 / 崖顶站立点多近可以开始攀爬（米） */
export const CLIMB_REACH = 2.6;
/** 攀爬速度（米 / 秒，沿路径长度） */
export const CLIMB_SPEED = 3.2;
export const CLIMB_SPRINT = 4.6;
/** 路径采样数 */
export const CLIMB_SAMPLES = 32;
/** 崖面外退距离（米）：坐骑趴在崖面上，玩家在它背上 */
export const CLIMB_STANDOFF = 0.55;

export interface ClimbPoint {
  x: number;
  y: number;
  z: number;
  /** 从起点开始的累计长度（米） */
  s: number;
  /** 该点的崖面坡度（弧度，0 = 平地，π/2 = 垂直） */
  pitch: number;
}

export interface ClimbPath {
  wall: ClimbWallConfig;
  points: ClimbPoint[];
  length: number;
  /** 水平朝向（崖脚 → 崖顶） */
  yaw: number;
  /** 落差（米） */
  rise: number;
}

export function climbPath(wall: ClimbWallConfig, heightAt: (x: number, z: number) => number, n = CLIMB_SAMPLES): ClimbPath {
  const [bx, bz] = wall.base;
  const [tx, tz] = wall.top;
  const dx = tx - bx;
  const dz = tz - bz;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const raw: Array<{ x: number; z: number; h: number }> = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = bx + dx * k;
    const z = bz + dz * k;
    raw.push({ x, z, h: heightAt(x, z) });
  }
  // 单调化：攀爬路径只升不降（崖面上的小凹坑不让人往下掉）
  for (let i = 1; i < raw.length; i++) raw[i]!.h = Math.max(raw[i]!.h, raw[i - 1]!.h);
  const points: ClimbPoint[] = [];
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]!;
    const prev = raw[Math.max(0, i - 1)]!;
    const next = raw[Math.min(raw.length - 1, i + 1)]!;
    const run = Math.hypot(next.x - prev.x, next.z - prev.z) || 1e-6;
    const pitch = Math.atan2(next.h - prev.h, run);
    // 崖面越陡越往外退（平地上不退）
    const back = CLIMB_STANDOFF * Math.sin(pitch);
    const x = r.x - ux * back;
    const z = r.z - uz * back;
    if (i > 0) {
      const q = points[i - 1]!;
      s += Math.hypot(x - q.x, r.h - q.y, z - q.z);
    }
    points.push({ x, y: r.h, z, s, pitch });
  }
  return { wall, points, length: s, yaw: Math.atan2(ux, uz), rise: raw[raw.length - 1]!.h - raw[0]!.h };
}

/** 路径上按长度 s 取点（线性插值） */
export function sampleClimb(path: ClimbPath, s: number): ClimbPoint {
  const pts = path.points;
  const t = Math.max(0, Math.min(path.length, s));
  let i = 1;
  while (i < pts.length - 1 && pts[i]!.s < t) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const k = b.s > a.s ? (t - a.s) / (b.s - a.s) : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, s: t, pitch: a.pitch + (b.pitch - a.pitch) * k };
}

export type ClimbEnd = 'base' | 'top';

/**
 * 玩家附近的攀爬端点：离站立点 CLIMB_REACH 以内；facing 给出时要求大致朝向岩壁
 * （在崖脚朝崖顶方向 ±75°，在崖顶朝崖脚方向 ±75°）。
 */
export function climbEndNear(walls: readonly ClimbWallConfig[], x: number, z: number, facing?: number): { wall: ClimbWallConfig; end: ClimbEnd; dist: number } | null {
  let best: { wall: ClimbWallConfig; end: ClimbEnd; dist: number } | null = null;
  for (const w of walls) {
    for (const end of ['base', 'top'] as const) {
      const [px, pz] = w[end];
      const d = Math.hypot(x - px, z - pz);
      if (d > CLIMB_REACH) continue;
      if (facing !== undefined) {
        const [ox, oz] = end === 'base' ? w.top : w.base;
        const want = Math.atan2(ox - px, oz - pz);
        let diff = facing - want;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > (75 * Math.PI) / 180) continue;
      }
      if (!best || d < best.dist) best = { wall: w, end, dist: d };
    }
  }
  return best;
}

/** 推进攀爬参数：axis > 0 向上；返回新的 s 与是否到达两端 */
export function climbProgress(path: ClimbPath, s: number, axis: number, sprint: boolean, dt: number): { s: number; atTop: boolean; atBase: boolean } {
  const v = (sprint ? CLIMB_SPRINT : CLIMB_SPEED) * Math.max(-1, Math.min(1, axis));
  const ns = Math.max(0, Math.min(path.length, s + v * dt));
  return { s: ns, atTop: ns >= path.length - 1e-6 && axis > 0, atBase: ns <= 1e-6 && axis < 0 };
}
