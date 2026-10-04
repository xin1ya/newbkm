/**
 * 静态碰撞世界（纯数学，不依赖 three）：圆柱（树干、岩石、柱子）与有向矩形（建筑、码头边、围栏段）。
 * 使用 8 m 空间哈希；角色按“竖直胶囊 = 平面上的圆 + 高度区间”处理，逐个推出（最多 4 次迭代）。
 * 地形高度与坡度由 Heightfield 负责，这里只管摆放物。
 */
export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  /** 底部 / 顶部高度 */
  y0: number;
  y1: number;
  tag?: string;
}

export interface BoxCollider {
  kind: 'box';
  x: number;
  z: number;
  /** 半宽 / 半深（局部 x / z） */
  hx: number;
  hz: number;
  yaw: number;
  y0: number;
  y1: number;
  tag?: string;
  /** 可站立的顶面（码头、栈桥），角色可以走上去 */
  walkableTop?: boolean;
}

export type Collider = CircleCollider | BoxCollider;

const CELL = 8;
const key = (i: number, j: number) => ((i + 4096) << 13) | (j + 4096);

export class CollisionWorld {
  private cells = new Map<number, Collider[]>();
  private groups = new Map<string, Collider[]>();
  count = 0;

  add(group: string, c: Collider): void {
    let g = this.groups.get(group);
    if (!g) this.groups.set(group, (g = []));
    g.push(c);
    this.count++;
    const r = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
    for (let i = Math.floor((c.x - r) / CELL); i <= Math.floor((c.x + r) / CELL); i++)
      for (let j = Math.floor((c.z - r) / CELL); j <= Math.floor((c.z + r) / CELL); j++) {
        const k = key(i, j);
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = []));
        cell.push(c);
      }
  }

  removeGroup(group: string): void {
    const g = this.groups.get(group);
    if (!g) return;
    const set = new Set<Collider>(g);
    for (const [k, cell] of this.cells) {
      const f = cell.filter((c) => !set.has(c));
      if (f.length) this.cells.set(k, f);
      else this.cells.delete(k);
    }
    this.count -= g.length;
    this.groups.delete(group);
  }

  hasGroup(group: string): boolean {
    return this.groups.has(group);
  }

  query(x: number, z: number, r: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const seen = new Set<Collider>();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const cell = this.cells.get(key(i, j));
        if (!cell) continue;
        for (const c of cell)
          if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
          }
      }
    return out;
  }

  /**
   * 把圆（x, z, r）在高度区间 [y0, y1] 内推出所有碰撞体。返回修正后的位置与是否发生碰撞。
   */
  resolve(x: number, z: number, r: number, y0: number, y1: number): { x: number; z: number; hit: boolean } {
    let hit = false;
    const list: Collider[] = [];
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const c of this.query(x, z, r + 2, list)) {
        if (c.y1 < y0 + 0.35 || c.y0 > y1) continue; // 可以跨过的矮物 / 头顶上的东西
        if (c.kind === 'circle') {
          const dx = x - c.x;
          const dz = z - c.z;
          const d = Math.hypot(dx, dz);
          const min = r + c.r;
          if (d < min) {
            const k = d > 1e-6 ? (min - d) / d : 1;
            x += d > 1e-6 ? dx * k : min;
            z += d > 1e-6 ? dz * k : 0;
            moved = hit = true;
          }
        } else {
          // 变换到盒子局部坐标
          const s = Math.sin(c.yaw);
          const co = Math.cos(c.yaw);
          const dx = x - c.x;
          const dz = z - c.z;
          const lx = dx * co - dz * s;
          const lz = dx * s + dz * co;
          const cx = Math.max(-c.hx, Math.min(c.hx, lx));
          const cz = Math.max(-c.hz, Math.min(c.hz, lz));
          let px = lx - cx;
          let pz = lz - cz;
          let d = Math.hypot(px, pz);
          if (d >= r) continue;
          if (d < 1e-6) {
            // 圆心在盒子内：沿最近的边推出
            const ex = c.hx - Math.abs(lx);
            const ez = c.hz - Math.abs(lz);
            if (ex < ez) {
              px = Math.sign(lx) || 1;
              pz = 0;
              d = -ex;
            } else {
              px = 0;
              pz = Math.sign(lz) || 1;
              d = -ez;
            }
            const push = r - d;
            const nlx = lx + px * push;
            const nlz = lz + pz * push;
            x = c.x + nlx * co + nlz * s;
            z = c.z - nlx * s + nlz * co;
          } else {
            const push = (r - d) / d;
            const nlx = lx + px * push;
            const nlz = lz + pz * push;
            x = c.x + nlx * co + nlz * s;
            z = c.z - nlx * s + nlz * co;
          }
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return { x, z, hit };
  }

  /** 站立面：返回 (x,z) 处可站立的顶面高度（码头 / 栈桥），没有返回 -Infinity */
  walkableTopAt(x: number, z: number, maxY: number): number {
    let best = -Infinity;
    for (const c of this.query(x, z, 0.5)) {
      if (c.kind !== 'box' || !c.walkableTop || c.y1 > maxY) continue;
      const s = Math.sin(c.yaw);
      const co = Math.cos(c.yaw);
      const dx = x - c.x;
      const dz = z - c.z;
      const lx = dx * co - dz * s;
      const lz = dx * s + dz * co;
      if (Math.abs(lx) <= c.hx && Math.abs(lz) <= c.hz) best = Math.max(best, c.y1);
    }
    return best;
  }

  /** 2D 线段是否被遮挡（相机碰撞 / 视线检查），返回最近命中比例 0–1，未命中为 1 */
  segmentHit(ax: number, az: number, ay: number, bx: number, bz: number, by: number): number {
    let best = 1;
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (t >= best) break;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = ay + (by - ay) * t;
      for (const c of this.query(x, z, 0.2)) {
        if (y < c.y0 || y > c.y1 || (c.kind === 'box' && c.walkableTop)) continue;
        if (c.kind === 'circle') {
          if (Math.hypot(x - c.x, z - c.z) < c.r) best = Math.min(best, t);
        } else {
          const si = Math.sin(c.yaw);
          const co = Math.cos(c.yaw);
          const lx = (x - c.x) * co - (z - c.z) * si;
          const lz = (x - c.x) * si + (z - c.z) * co;
          if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) best = Math.min(best, t);
        }
      }
    }
    return best;
  }
}
