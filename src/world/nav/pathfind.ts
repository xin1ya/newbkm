/**
 * 任务地面指引用的寻路（纯逻辑，无 three）：在起点—终点包围盒（外扩 margin）内铺一张自适应网格做 A*。
 * - cost(x, z) 返回进入该格的代价倍率（道路 < 1 < 草地 < 浅水），Infinity = 不可通行（深水、陡坡、建筑）
 * - 8 邻接，对角代价 √2；启发函数用欧氏距离 × 最小代价，保证可采纳
 * - 结果做视线化简（两点间采样都可通行且代价不变差就跳过中间点），再按固定间距重采样
 */

export type CostFn = (x: number, z: number) => number;

export interface PathOptions {
  /** 包围盒外扩（米） */
  margin?: number;
  /** 网格最大边长（格），超出时自动放大格子 */
  maxCells?: number;
  /** 最小格子尺寸（米） */
  minCell?: number;
  /** 代价函数可能返回的最小值（启发函数用） */
  minCost?: number;
}

class Heap {
  private readonly ids: number[] = [];
  private readonly keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      ids[i] = ids[p]!;
      keys[i] = keys[p]!;
      i = p;
    }
    ids[i] = id;
    keys[i] = key;
  }
  pop(): number {
    const ids = this.ids;
    const keys = this.keys;
    const top = ids[0]!;
    const lastId = ids.pop()!;
    const lastKey = keys.pop()!;
    if (ids.length) {
      let i = 0;
      const n = ids.length;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r]! < keys[l]! ? r : l;
        if (keys[c]! >= lastKey) break;
        ids[i] = ids[c]!;
        keys[i] = keys[c]!;
        i = c;
      }
      ids[i] = lastId;
      keys[i] = lastKey;
    }
    return top;
  }
}

/** A* 寻路：返回世界坐标折线（含起点、终点）；找不到时返回 null */
export function findPath(sx: number, sz: number, tx: number, tz: number, cost: CostFn, o: PathOptions = {}): Array<[number, number]> | null {
  const margin = o.margin ?? 40;
  const maxCells = o.maxCells ?? 120;
  const minCost = o.minCost ?? 0.5;
  const x0 = Math.min(sx, tx) - margin;
  const z0 = Math.min(sz, tz) - margin;
  const span = Math.max(Math.abs(tx - sx), Math.abs(tz - sz)) + margin * 2;
  const cell = Math.max(o.minCell ?? 3, span / maxCells);
  const W = Math.ceil((Math.max(sx, tx) + margin - x0) / cell) + 1;
  const H = Math.ceil((Math.max(sz, tz) + margin - z0) / cell) + 1;
  const N = W * H;
  const cx = (i: number) => x0 + (i % W) * cell;
  const cz = (i: number) => z0 + Math.floor(i / W) * cell;
  const idx = (x: number, z: number) => Math.round((z - z0) / cell) * W + Math.round((x - x0) / cell);
  const costCache = new Float32Array(N).fill(-1);
  const cellCost = (i: number): number => {
    let c = costCache[i]!;
    if (c < 0) costCache[i] = c = cost(cx(i), cz(i));
    return c;
  };
  const start = idx(sx, sz);
  let goal = idx(tx, tz);
  // 终点不可达（例如在建筑里 / 水中央）：取终点附近最近的可通行格
  if (!Number.isFinite(cellCost(goal))) {
    let best = -1;
    let bd = Infinity;
    const gx = goal % W;
    const gz = Math.floor(goal / W);
    for (let r = 1; r < 8 && best < 0; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          const x = gx + dx;
          const z = gz + dz;
          if (x < 0 || z < 0 || x >= W || z >= H) continue;
          const i = z * W + x;
          if (!Number.isFinite(cellCost(i))) continue;
          const d = dx * dx + dz * dz;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
    if (best < 0) return null;
    goal = best;
  }
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap();
  const gxT = goal % W;
  const gzT = Math.floor(goal / W);
  const h = (i: number) => Math.hypot((i % W) - gxT, Math.floor(i / W) - gzT) * minCost;
  g[start] = 0;
  heap.push(start, h(start));
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
  let found = false;
  let expanded = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goal) {
      found = true;
      break;
    }
    closed[cur] = 1;
    if (++expanded > N) break;
    const x = cur % W;
    const z = Math.floor(cur / W);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k]!;
      const nz = z + DZ[k]!;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const ni = nz * W + nx;
      if (closed[ni]) continue;
      const c = cellCost(ni);
      if (!Number.isFinite(c)) continue;
      // 对角不切角：两侧正交格都要可通行
      if (k >= 4 && (!Number.isFinite(cellCost(z * W + nx)) || !Number.isFinite(cellCost(nz * W + x)))) continue;
      const ng = g[cur]! + (k >= 4 ? Math.SQRT2 : 1) * c;
      if (ng < g[ni]!) {
        g[ni] = ng;
        from[ni] = cur;
        heap.push(ni, ng + h(ni));
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let i = goal; i >= 0; i = from[i]!) {
    cells.push(i);
    if (i === start) break;
  }
  cells.reverse();
  const pts: Array<[number, number]> = cells.map((i) => [cx(i), cz(i)]);
  pts[0] = [sx, sz];
  if (goal === idx(tx, tz)) pts[pts.length - 1] = [tx, tz];
  return simplify(pts, cost, cell);
}

/** 视线化简：从当前点尽量连到最远的点，只要中间采样都可通行且平均代价不高于原路线 */
export function simplify(pts: Array<[number, number]>, cost: CostFn, step: number): Array<[number, number]> {
  if (pts.length <= 2) return pts;
  const out: Array<[number, number]> = [pts[0]!];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) if (clearLine(pts[i]!, pts[j]!, pts.slice(i, j + 1), cost, step)) break;
    out.push(pts[j]!);
    i = j;
  }
  return out;
}

function clearLine(a: [number, number], b: [number, number], orig: Array<[number, number]>, cost: CostFn, step: number): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / (step * 0.5)));
  let sum = 0;
  for (let k = 0; k <= n; k++) {
    const c = cost(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
    if (!Number.isFinite(c)) return false;
    sum += c;
  }
  let os = 0;
  for (const p of orig) os += cost(p[0], p[1]);
  // 直线的平均代价不能比原路线明显更差（否则会抄近路离开道路）
  return sum / (n + 1) <= (os / orig.length) * 1.08 + 1e-6;
}

/** 折线按固定间距重采样，返回 [x, z, 累计距离] */
export function resample(pts: ReadonlyArray<[number, number]>, spacing: number, maxLen = Infinity): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  if (!pts.length) return out;
  let acc = 0;
  let next = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const seg = Math.hypot(bx - ax, bz - az);
    while (next <= acc + seg && next <= maxLen) {
      const t = seg > 0 ? (next - acc) / seg : 0;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t, next]);
      next += spacing;
    }
    acc += seg;
    if (next > maxLen) break;
  }
  return out;
}
