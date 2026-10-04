/**
 * 城镇布局辅助：按「门口坐标 + 朝向」摆建筑（与 GrayboxProps 反推门口的规则一致），以及成排 / 散布小品。
 * 纯数据计算（config 层），不依赖 three。
 */
import type { PropInstance, PropType, Vec2, Vec3 } from '../types';

export const PI = Math.PI;
/** 朝向常量：建筑正面（门）朝哪个方向 */
export const FACE = { south: 0, north: PI, east: PI / 2, west: -PI / 2 } as const;

/** 门口到建筑中心的距离（研究所有突出的玻璃门厅） */
export function doorBack(type: PropType, depth: number): number {
  return depth / 2 + (type === 'lab' ? 3.6 : type === 'treehouse' ? 1.2 : 0.6);
}

/** 由门口位置反推建筑中心 */
export function atDoor(type: PropType, door: Vec2, yaw: number, size: Vec3, extra: Partial<PropInstance> = {}): PropInstance {
  const back = doorBack(type, size[2]);
  return { type, position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back], yaw, size, ...extra };
}

export function prop(type: PropType, position: Vec2, size: Vec3, extra: Partial<PropInstance> = {}): PropInstance {
  return { type, position, yaw: 0, size, ...extra };
}

/** 沿折线每隔 step 米放一个（offset = 向左侧的法向偏移） */
export function along(points: Vec2[], step: number, make: (p: Vec2, yaw: number, i: number) => PropInstance, offset = 0, start = step / 2): PropInstance[] {
  const out: PropInstance[] = [];
  let i = 0;
  for (let s = 0; s + 1 < points.length; s++) {
    const [ax, az] = points[s]!;
    const [bx, bz] = points[s + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let t = s === 0 ? start : 0; t <= len + 1e-6; t += step) {
      out.push(make([ax + ((bx - ax) * t) / len + nx * offset, az + ((bz - az) * t) / len + nz * offset], Math.atan2(bx - ax, bz - az), i++));
    }
  }
  return out;
}

/** 树：[x, z, 高度?, 变体?] 列表 */
export function trees(list: Array<[number, number, number?, string?]>, seedBase = 1): PropInstance[] {
  return list.map(([x, z, h, v], i) => ({ type: 'tree', position: [x, z], yaw: (i * 1.7) % (PI * 2), size: [1, h ?? 6, 1], variant: v ?? 'round', seed: seedBase + i * 31 }));
}

export function lamps(list: Vec2[], h = 4.2): PropInstance[] {
  return list.map((p) => ({ type: 'lamp', position: p, yaw: 0, size: [0.3, h, 0.3] }));
}

/** 围栏（折线） */
export function fence(points: Vec2[]): PropInstance {
  return { type: 'fence', position: [0, 0], yaw: 0, size: [0.12, 1.1, 0.12], points };
}

/** 水上平台（湖面 / 码头）：中心、宽（局部 x）、深（局部 z）、平台顶面高度 */
export function deck(center: Vec2, w: number, d: number, y: number, rails: string, gaps: Array<[string, number, number]> = [], yaw = 0): PropInstance {
  return { type: 'deck', position: center, yaw, size: [w, 0.4, d], y, rails, gaps };
}
