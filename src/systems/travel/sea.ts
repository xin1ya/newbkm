/**
 * M3-03 海域机制（纯逻辑）：洋流推动、漩涡卷入。
 * - 洋流：沿折线方向推动冲浪者，中心最强、边缘按 smoothstep 衰减（宽度 = 全宽）。
 * - 漩涡：进入半径 → 卷入；场景层负责演出（转圈 + 甩出到漩涡外侧、远离漩涡中心的方向）。
 */
export type SeaVec2 = [number, number];
export interface SeaCurrent { id: string; points: SeaVec2[]; width: number; speed: number }
export interface SeaWhirlpool { id: string; center: SeaVec2; radius: number }

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** (x, z) 处的洋流速度（多股叠加）；不在任何洋流里时为 0 */
export function currentAt(currents: readonly SeaCurrent[] | undefined, x: number, z: number): { x: number; z: number; id: string | null } {
  let vx = 0;
  let vz = 0;
  let id: string | null = null;
  let best = 0;
  for (const c of currents ?? []) {
    let bd = Infinity;
    let dir: SeaVec2 = [0, 0];
    for (let s = 0; s + 1 < c.points.length; s++) {
      const [ax, az] = c.points[s]!;
      const [bx, bz] = c.points[s + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (d < bd) {
        bd = d;
        const l = Math.sqrt(l2);
        dir = [dx / l, dz / l];
      }
    }
    const k = sstep(c.width / 2, c.width * 0.15, bd);
    if (k <= 0) continue;
    vx += dir[0] * c.speed * k;
    vz += dir[1] * c.speed * k;
    if (k > best) {
      best = k;
      id = c.id;
    }
  }
  return { x: vx, z: vz, id };
}

/** 落在哪个漩涡里（进入半径即卷入） */
export function whirlpoolAt(pools: readonly SeaWhirlpool[] | undefined, x: number, z: number): SeaWhirlpool | null {
  for (const w of pools ?? []) if (Math.hypot(x - w.center[0], z - w.center[1]) < w.radius) return w;
  return null;
}

/** 卷入后甩出的位置：沿「中心 → 玩家」方向甩到半径外 margin 米（玩家正好在中心时向东甩） */
export function whirlpoolEject(w: SeaWhirlpool, x: number, z: number, margin = 18): { x: number; z: number; yaw: number } {
  let dx = x - w.center[0];
  let dz = z - w.center[1];
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) {
    dx = 1;
    dz = 0;
  } else {
    dx /= d;
    dz /= d;
  }
  const r = w.radius + margin;
  return { x: w.center[0] + dx * r, z: w.center[1] + dz * r, yaw: Math.atan2(dx, dz) };
}
