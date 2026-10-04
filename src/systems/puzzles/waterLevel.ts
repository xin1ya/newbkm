/**
 * M1-11 · 道馆 1「水位机关」纯逻辑（无 three / 无浏览器依赖）。
 *
 * 规则：
 * - 水池（pool 矩形）内默认不可站立；只有「当前水位下露出 / 浮起」的格子可以走：
 *   - always：石岛，任何水位都能站；
 *   - low：低水位才露出的石栈道（高水位时没入水下）；
 *   - high：高水位才浮到地面高度的木筏（低水位时搁浅在池底，够不着）。
 * - 阀门（valve）站在旁边互动即切换水位 high ⇄ low。
 * - 池外（大厅、馆主台）永远可站。
 *
 * 提供：可站立判定、阻挡矩形（给碰撞系统）、BFS 求解（单元测试用来证明可解、无死局）。
 */

export type WaterLevel = 'high' | 'low';
export type Rect = readonly [x0: number, z0: number, x1: number, z1: number];

export interface WaterTile {
  id: string;
  rect: Rect;
  kind: 'island' | 'walkway' | 'raft';
  when: 'always' | WaterLevel;
}

export interface WaterValve {
  id: string;
  position: readonly [number, number];
  /** 互动半径（缺省 1.4 m） */
  range?: number;
}

export interface WaterPuzzleConfig {
  /** 水池范围（房间坐标，米） */
  pool: Rect;
  /** 进门时的水位 */
  start: WaterLevel;
  /** 两档水面高度（米，地面为 0） */
  levels: Record<WaterLevel, number>;
  tiles: readonly WaterTile[];
  valves: readonly WaterValve[];
}

export const toggleLevel = (l: WaterLevel): WaterLevel => (l === 'high' ? 'low' : 'high');

const inRect = (r: Rect, x: number, z: number, pad = 0): boolean => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;

export function tileActive(t: WaterTile, level: WaterLevel): boolean {
  return t.when === 'always' || t.when === level;
}

export function activeTiles(cfg: WaterPuzzleConfig, level: WaterLevel): WaterTile[] {
  return cfg.tiles.filter((t) => tileActive(t, level));
}

/** (x, z) 在该水位下能否站立（池外永远可以） */
export function isStandable(cfg: WaterPuzzleConfig, level: WaterLevel, x: number, z: number): boolean {
  if (!inRect(cfg.pool, x, z)) return true;
  return cfg.tiles.some((t) => tileActive(t, level) && inRect(t.rect, x, z));
}

/** 离 (x, z) 最近、在互动范围内的阀门 */
export function valveAt(cfg: WaterPuzzleConfig, x: number, z: number): WaterValve | null {
  let best: WaterValve | null = null;
  let bd = Infinity;
  for (const v of cfg.valves) {
    const d = Math.hypot(v.position[0] - x, v.position[1] - z);
    if (d <= (v.range ?? 1.4) && d < bd) {
      best = v;
      bd = d;
    }
  }
  return best;
}

/**
 * 当前水位下水池里不可站立的区域，合并成尽量少的矩形（碰撞体）。
 * 采样格 cell（默认 0.5 m，配置里的矩形都对齐 0.5 m）；先按行合并，再把相同跨度的相邻行合并。
 */
export function blockerRects(cfg: WaterPuzzleConfig, level: WaterLevel, cell = 0.5): Rect[] {
  const [px0, pz0, px1, pz1] = cfg.pool;
  const nx = Math.round((px1 - px0) / cell);
  const nz = Math.round((pz1 - pz0) / cell);
  const rows: Array<Array<[number, number]>> = [];
  for (let j = 0; j < nz; j++) {
    const z = pz0 + (j + 0.5) * cell;
    const runs: Array<[number, number]> = [];
    let start = -1;
    for (let i = 0; i <= nx; i++) {
      const blocked = i < nx && !isStandable(cfg, level, px0 + (i + 0.5) * cell, z);
      if (blocked && start < 0) start = i;
      if (!blocked && start >= 0) {
        runs.push([start, i]);
        start = -1;
      }
    }
    rows.push(runs);
  }
  const out: Rect[] = [];
  const open = new Map<string, { j0: number; a: number; b: number }>();
  for (let j = 0; j <= nz; j++) {
    const runs = j < nz ? rows[j]! : [];
    const keys = new Set(runs.map(([a, b]) => `${a}:${b}`));
    for (const [k, r] of [...open]) {
      if (!keys.has(k)) {
        out.push([px0 + r.a * cell, pz0 + r.j0 * cell, px0 + r.b * cell, pz0 + j * cell]);
        open.delete(k);
      }
    }
    for (const [a, b] of runs) {
      const k = `${a}:${b}`;
      if (!open.has(k)) open.set(k, { j0: j, a, b });
    }
  }
  return out;
}

export interface SolveResult {
  /** 最少的阀门操作次数 */
  toggles: number;
  /** 依次使用的阀门 id */
  valves: string[];
}

/**
 * BFS：从 from 出发（水位 level），走到 to 所需的最少阀门操作。
 * 状态 = (格子, 水位)；同一水位下在可站立格之间 4 邻接移动（代价 0），在阀门旁切换水位（代价 1）。
 * 0-1 BFS 保证最少切换次数。走不到返回 null。
 */
export function solve(cfg: WaterPuzzleConfig, bounds: Rect, from: readonly [number, number], to: readonly [number, number], level: WaterLevel = cfg.start, cell = 0.5): SolveResult | null {
  const [bx0, bz0, bx1, bz1] = bounds;
  const nx = Math.round((bx1 - bx0) / cell);
  const nz = Math.round((bz1 - bz0) / cell);
  const idx = (x: number, z: number) => Math.floor((z - bz0) / cell) * nx + Math.floor((x - bx0) / cell);
  const cx = (i: number) => bx0 + ((i % nx) + 0.5) * cell;
  const cz = (i: number) => bz0 + (Math.floor(i / nx) + 0.5) * cell;
  const L = (l: WaterLevel) => (l === 'high' ? 0 : 1);
  const stand: Uint8Array[] = [new Uint8Array(nx * nz), new Uint8Array(nx * nz)];
  for (const l of ['high', 'low'] as const) for (let i = 0; i < nx * nz; i++) stand[L(l)]![i] = isStandable(cfg, l, cx(i), cz(i)) ? 1 : 0;
  const dist = [new Int32Array(nx * nz).fill(-1), new Int32Array(nx * nz).fill(-1)];
  const prev = new Map<number, { s: number; valve: string | null }>();
  const key = (i: number, l: number) => i * 2 + l;
  const s0 = idx(from[0], from[1]);
  const goal = idx(to[0], to[1]);
  if (!stand[L(level)]![s0]) return null;
  const dq: Array<[number, number]> = [[s0, L(level)]];
  dist[L(level)]![s0] = 0;
  while (dq.length) {
    const [i, l] = dq.shift()!;
    const d = dist[l]![i]!;
    if (i === goal) {
      const valves: string[] = [];
      let k = key(i, l);
      while (prev.has(k)) {
        const p = prev.get(k)!;
        if (p.valve) valves.unshift(p.valve);
        k = p.s;
      }
      return { toggles: d, valves };
    }
    const x = i % nx;
    const z = Math.floor(i / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ax = x + dx;
      const az = z + dz;
      if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
      const j = az * nx + ax;
      if (!stand[l]![j] || (dist[l]![j]! >= 0 && dist[l]![j]! <= d)) continue;
      dist[l]![j] = d;
      prev.set(key(j, l), { s: key(i, l), valve: null });
      dq.unshift([j, l]);
    }
    const v = valveAt(cfg, cx(i), cz(i));
    const ol = 1 - l;
    if (v && stand[ol]![i] && dist[ol]![i]! < 0) {
      dist[ol]![i] = d + 1;
      prev.set(key(i, ol), { s: key(i, l), valve: v.id });
      dq.push([i, ol]);
    }
  }
  return null;
}

/**
 * 从 from（水位 level）出发能到达的所有 (位置, 水位) 状态，按「石岛 / 栈道 / 木筏 / 池外」的代表点返回。
 * 单元测试用它检查「无死局」：每个可达状态都还能回到门口。
 */
export function reachableStates(
  cfg: WaterPuzzleConfig,
  bounds: Rect,
  from: readonly [number, number],
  level: WaterLevel = cfg.start,
  cell = 0.5,
): Array<{ x: number; z: number; level: WaterLevel }> {
  const [bx0, bz0, bx1, bz1] = bounds;
  const nx = Math.round((bx1 - bx0) / cell);
  const nz = Math.round((bz1 - bz0) / cell);
  const cx = (i: number) => bx0 + ((i % nx) + 0.5) * cell;
  const cz = (i: number) => bz0 + (Math.floor(i / nx) + 0.5) * cell;
  const seen = new Set<number>();
  const lv = (l: number): WaterLevel => (l === 0 ? 'high' : 'low');
  const s0 = Math.floor((from[1] - bz0) / cell) * nx + Math.floor((from[0] - bx0) / cell);
  const l0 = level === 'high' ? 0 : 1;
  if (!isStandable(cfg, level, cx(s0), cz(s0))) return [];
  const q: number[] = [s0 * 2 + l0];
  seen.add(q[0]!);
  while (q.length) {
    const k = q.pop()!;
    const i = k >> 1;
    const l = k & 1;
    const x = i % nx;
    const z = Math.floor(i / nx);
    const push = (j: number, ll: number) => {
      const kk = j * 2 + ll;
      if (seen.has(kk) || !isStandable(cfg, lv(ll), cx(j), cz(j))) return;
      seen.add(kk);
      q.push(kk);
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ax = x + dx;
      const az = z + dz;
      if (ax >= 0 && az >= 0 && ax < nx && az < nz) push(az * nx + ax, l);
    }
    if (valveAt(cfg, cx(i), cz(i))) push(i, 1 - l);
  }
  // 每个区域（石块 / 池外）× 水位取一个代表点
  const reps = new Map<string, { x: number; z: number; level: WaterLevel }>();
  for (const k of seen) {
    const i = k >> 1;
    const x = cx(i);
    const z = cz(i);
    const t = inRect(cfg.pool, x, z) ? cfg.tiles.find((tt) => tileActive(tt, lv(k & 1)) && inRect(tt.rect, x, z)) : undefined;
    const id = `${t?.id ?? 'dry'}@${lv(k & 1)}`;
    if (!reps.has(id)) reps.set(id, { x, z, level: lv(k & 1) });
  }
  return [...reps.values()];
}
