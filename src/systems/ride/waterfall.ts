/**
 * M3-19 · 攀瀑（大地图）的纯逻辑：端点判定 + 演出路径采样（不依赖 three）。
 * 路径（攀上）：当前位置 → 崖脚冲刺点（瀑潭靠崖一侧）→ 沿水幕冲上瀑口 → 台顶泉池；攀下（顺瀑布而下）反过来。
 */
import type { WaterfallConfig } from '@/config/islands/types';
import { SURF_SINK } from './index';

export type FallEnd = 'base' | 'top';
export const FALL_REACH = 5.5;

export interface FallPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 抬头为正（弧度） */
  pitch: number;
}

/** 离玩家最近、在触发距离内的瀑布端点（瀑潭 / 泉池） */
export function fallEndNear(falls: readonly WaterfallConfig[], x: number, z: number, reach = FALL_REACH): { fall: WaterfallConfig; end: FallEnd; dist: number } | null {
  let best: { fall: WaterfallConfig; end: FallEnd; dist: number } | null = null;
  for (const f of falls)
    for (const end of ['base', 'top'] as const) {
      const p = f[end];
      const d = Math.hypot(x - p[0], z - p[1]);
      if (d <= reach && (!best || d < best.dist)) best = { fall: f, end, dist: d };
    }
  return best;
}

interface Key {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface FallPath {
  fall: WaterfallConfig;
  from: FallEnd;
  keys: Key[];
  /** 总时长（秒） */
  duration: number;
  /** 面朝方向（攀上 = 朝石台；攀下 = 朝瀑潭） */
  yaw: number;
}

/** 生成演出路径；start = 玩家当前位置（水面） */
export function fallPath(f: WaterfallConfig, from: FallEnd, start: { x: number; z: number }): FallPath {
  const [cx, cz] = f.mesa.center;
  const dl = Math.hypot(f.base[0] - cx, f.base[1] - cz) || 1;
  const dx = (f.base[0] - cx) / dl;
  const dz = (f.base[1] - cz) / dl;
  const R = f.mesa.radius;
  const lowY = f.baseLevel - SURF_SINK;
  const highY = f.topLevel - SURF_SINK;
  const foot = { x: cx + dx * (R + 3.4), z: cz + dz * (R + 3.4) };
  const lipIn = { x: cx + dx * (R - 0.6), z: cz + dz * (R - 0.6) };
  const keysUp: Array<Omit<Key, 't'> & { dt: number }> = [
    { x: from === 'base' ? start.x : f.base[0], y: lowY, z: from === 'base' ? start.z : f.base[1], dt: 0 },
    { x: foot.x, y: lowY, z: foot.z, dt: 0.7 },
    { x: foot.x - dx * 0.8, y: lowY + 1.2, z: foot.z - dz * 0.8, dt: 0.35 },
    { x: lipIn.x + dx * 1.2, y: highY + 0.9, z: lipIn.z + dz * 1.2, dt: Math.max(1.6, (f.topLevel - f.baseLevel) * 0.075) },
    { x: lipIn.x, y: highY + 0.5, z: lipIn.z, dt: 0.3 },
    { x: from === 'top' ? start.x : f.top[0], y: highY, z: from === 'top' ? start.z : f.top[1], dt: 0.6 },
  ];
  let seq = keysUp;
  if (from === 'top') {
    // 顺瀑布而下：倒序，下落段更快
    seq = [...keysUp].reverse().map((k, i, arr) => ({ ...k, dt: i === 0 ? 0 : arr[i - 1]!.dt }));
    seq = seq.map((k, i) => (i === 3 ? { ...k, dt: Math.max(1.0, k.dt * 0.6) } : k));
  }
  let t = 0;
  const keys: Key[] = seq.map((k) => ((t += k.dt), { x: k.x, y: k.y, z: k.z, t }));
  const yawUp = Math.atan2(-dx, -dz);
  return { fall: f, from, keys, duration: t, yaw: from === 'base' ? yawUp : Math.atan2(dx, dz) };
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** 采样 t 秒时的姿态 */
export function sampleFall(p: FallPath, t: number): FallPose {
  const ks = p.keys;
  const tt = Math.max(0, Math.min(p.duration, t));
  let i = 1;
  while (i < ks.length - 1 && ks[i]!.t < tt) i++;
  const a = ks[i - 1]!;
  const b = ks[i]!;
  const u = b.t > a.t ? smooth((tt - a.t) / (b.t - a.t)) : 1;
  const x = a.x + (b.x - a.x) * u;
  const y = a.y + (b.y - a.y) * u;
  const z = a.z + (b.z - a.z) * u;
  const horiz = Math.hypot(b.x - a.x, b.z - a.z);
  const dy = b.y - a.y;
  // 俯仰：攀上时抬头（爬升段），攀下时低头；水平段回 0；在段首尾 15% 内平滑过渡
  const raw = Math.abs(dy) < 0.3 ? 0 : Math.atan2(dy, Math.max(0.4, horiz));
  const edge = Math.min(1, Math.min(u, 1 - u) / 0.15 + 0.35);
  const pitch = Math.max(-1.2, Math.min(1.2, raw * edge));
  return { x, y, z, yaw: p.yaw, pitch };
}
