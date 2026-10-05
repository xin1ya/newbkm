/**
 * M3-20 · 怪力推石谜题（冠军之路）的纯逻辑（无 three 依赖，便于单测 / BFS 证明可解）。
 *
 * 房间里铺一张方格（cell 米一格）：
 * - walls：岩柱，人和石头都过不去
 * - holes：地洞，人过不去；石头推进去就把洞填平（之后变成地面，人和石头都能过）
 * - boulders：怪力巨石，玩家朝它走（有「怪力」）就沿推的方向挪一格；前方是墙 / 另一块石头 / 出界就推不动
 * 进度存档：填平的洞记 `boulder:<id>:hole<i>`，掉进洞的石头记 `boulder:<id>:used<j>`；
 * 其余石头每次进门复位（推死了出去再进来即可重来）。
 *
 * M3-23 压力板 + 石闸（晶石洞窟）：
 * - plates：压力板，人和石头都能站；所有压力板上同时压着石头 → 石闸（gate）打开
 * - gate：石闸格，关着时同墙；打开后变成地面。打开状态记 `boulder:<id>:gate`（之后永久打开）
 */

export type Cell = readonly [number, number];

export interface BoulderPuzzleConfig {
  id: string;
  /** 方格左上角（最小 x, 最小 z，局部坐标） */
  origin: readonly [number, number];
  cell: number;
  cols: number;
  rows: number;
  walls: readonly Cell[];
  /** 深谷格：逻辑上同墙（人和石头都过不去），视图画成裂谷 */
  chasm?: readonly Cell[];
  holes: readonly Cell[];
  boulders: readonly Cell[];
  /** 求解起点 / 终点（玩家所在格；单测与提示用） */
  start: Cell;
  goal: Cell;
  /** 需要的能力 flag（缺省 hm06-strength） */
  requiresFlag?: string;
  /** M3-23 压力板（全部压上石头 → 打开 gate） */
  plates?: readonly Cell[];
  /** M3-23 石闸格（关闭时同墙） */
  gate?: readonly Cell[];
}

export interface BoulderState {
  /** 每块石头的位置；null = 已经掉进洞里 */
  boulders: Array<[number, number] | null>;
  /** 每个洞是否已填平 */
  filled: boolean[];
  /** M3-23 石闸已打开（没有石闸的谜题恒为 true） */
  gateOpen: boolean;
}

export const STRENGTH_FLAG = 'hm06-strength';

export const holeFlag = (cfg: BoulderPuzzleConfig, i: number): string => `boulder:${cfg.id}:hole${i}`;
export const usedFlag = (cfg: BoulderPuzzleConfig, j: number): string => `boulder:${cfg.id}:used${j}`;
export const gateFlag = (cfg: BoulderPuzzleConfig): string => `boulder:${cfg.id}:gate`;

/** 进门时的状态：已填的洞保持填平，已用掉的石头不再出现，其余石头回到初始位置 */
export function loadBoulderState(cfg: BoulderPuzzleConfig, flags: Readonly<Record<string, boolean | undefined>> = {}): BoulderState {
  return {
    boulders: cfg.boulders.map((b, j) => (flags[usedFlag(cfg, j)] ? null : [b[0], b[1]])),
    filled: cfg.holes.map((_, i) => !!flags[holeFlag(cfg, i)]),
    gateOpen: !cfg.gate?.length || !!flags[gateFlag(cfg)],
  };
}

const key = (c: number, r: number): number => r * 1000 + c;

export function cellCenter(cfg: BoulderPuzzleConfig, c: number, r: number): [number, number] {
  return [cfg.origin[0] + (c + 0.5) * cfg.cell, cfg.origin[1] + (r + 0.5) * cfg.cell];
}

export function cellAt(cfg: BoulderPuzzleConfig, x: number, z: number): [number, number] | null {
  const c = Math.floor((x - cfg.origin[0]) / cfg.cell);
  const r = Math.floor((z - cfg.origin[1]) / cfg.cell);
  if (c < 0 || r < 0 || c >= cfg.cols || r >= cfg.rows) return null;
  return [c, r];
}

function wallSet(cfg: BoulderPuzzleConfig): Set<number> {
  return new Set([...cfg.walls, ...(cfg.chasm ?? [])].map(([c, r]) => key(c, r)));
}

function holeIndex(cfg: BoulderPuzzleConfig, c: number, r: number): number {
  return cfg.holes.findIndex((h) => h[0] === c && h[1] === r);
}

function isGate(cfg: BoulderPuzzleConfig, st: BoulderState, c: number, r: number): boolean {
  return !st.gateOpen && !!cfg.gate?.some((g) => g[0] === c && g[1] === r);
}

/** 所有压力板上都压着石头 */
export function platesCovered(cfg: BoulderPuzzleConfig, boulders: BoulderState['boulders']): boolean {
  const plates = cfg.plates ?? [];
  return plates.length > 0 && plates.every((p) => boulders.some((b) => b && b[0] === p[0] && b[1] === p[1]));
}

export function inGrid(cfg: BoulderPuzzleConfig, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < cfg.cols && r < cfg.rows;
}

/** 玩家能否站在这一格（墙 / 未填的洞 / 石头都不行） */
export function walkable(cfg: BoulderPuzzleConfig, st: BoulderState, c: number, r: number, walls = wallSet(cfg)): boolean {
  if (!inGrid(cfg, c, r) || walls.has(key(c, r)) || isGate(cfg, st, c, r)) return false;
  const h = holeIndex(cfg, c, r);
  if (h >= 0 && !st.filled[h]) return false;
  return !st.boulders.some((b) => b && b[0] === c && b[1] === r);
}

export type PushResult = { ok: false; reason: 'blocked' | 'none' } | { ok: true; to: [number, number]; filledHole: number | null; openedGate: boolean; state: BoulderState };

/** 把位于 (c, r) 的石头沿 (dc, dr) 推一格 */
export function pushBoulder(cfg: BoulderPuzzleConfig, st: BoulderState, c: number, r: number, dc: number, dr: number, walls = wallSet(cfg)): PushResult {
  const j = st.boulders.findIndex((b) => b && b[0] === c && b[1] === r);
  if (j < 0) return { ok: false, reason: 'none' };
  const tc = c + dc;
  const tr = r + dr;
  if (!inGrid(cfg, tc, tr) || walls.has(key(tc, tr)) || isGate(cfg, st, tc, tr)) return { ok: false, reason: 'blocked' };
  if (st.boulders.some((b) => b && b[0] === tc && b[1] === tr)) return { ok: false, reason: 'blocked' };
  const h = holeIndex(cfg, tc, tr);
  const boulders = st.boulders.map((b) => (b ? ([b[0], b[1]] as [number, number]) : null));
  const filled = [...st.filled];
  let filledHole: number | null = null;
  if (h >= 0 && !filled[h]) {
    filled[h] = true;
    boulders[j] = null;
    filledHole = h;
  } else boulders[j] = [tc, tr];
  const openedGate = !st.gateOpen && platesCovered(cfg, boulders);
  return { ok: true, to: [tc, tr], filledHole, openedGate, state: { boulders, filled, gateOpen: st.gateOpen || openedGate } };
}

/** 从 from 出发不推石头能走到的格子 */
export function reachable(cfg: BoulderPuzzleConfig, st: BoulderState, from: Cell, walls = wallSet(cfg)): Set<number> {
  const seen = new Set<number>();
  if (!walkable(cfg, st, from[0], from[1], walls)) return seen;
  const q: Array<[number, number]> = [[from[0], from[1]]];
  seen.add(key(from[0], from[1]));
  while (q.length) {
    const [c, r] = q.pop()!;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      const k = key(nc, nr);
      if (seen.has(k) || !walkable(cfg, st, nc, nr, walls)) continue;
      seen.add(k);
      q.push([nc, nr]);
    }
  }
  return seen;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface BoulderSolve {
  solvable: boolean;
  /** 最少推石次数 */
  minPushes: number;
  explored: number;
}

/**
 * 推箱子式 BFS：状态 = 石头布局 + 玩家所在连通块（取块内最小格为代表）。
 * 每一步 = 玩家走到某块石头旁、推一下。终点：玩家能走到 goal。
 */
export function solveBoulders(cfg: BoulderPuzzleConfig, init?: BoulderState, limit = 200000): BoulderSolve {
  const walls = wallSet(cfg);
  const st0 = init ?? loadBoulderState(cfg);
  const enc = (st: BoulderState, region: Set<number>): string => {
    let m = Infinity;
    for (const k of region) m = Math.min(m, k);
    const bs = st.boulders
      .map((b) => (b ? key(b[0], b[1]) : -1))
      .sort((a, b) => a - b)
      .join(',');
    return `${m}|${bs}|${st.filled.map((f) => (f ? 1 : 0)).join('')}|${st.gateOpen ? 1 : 0}`;
  };
  const goalK = key(cfg.goal[0], cfg.goal[1]);
  const r0 = reachable(cfg, st0, cfg.start, walls);
  if (r0.has(goalK)) return { solvable: true, minPushes: 0, explored: 1 };
  const seen = new Set<string>([enc(st0, r0)]);
  let frontier: Array<{ st: BoulderState; region: Set<number> }> = [{ st: st0, region: r0 }];
  let depth = 0;
  while (frontier.length && seen.size < limit) {
    depth++;
    const next: typeof frontier = [];
    for (const { st, region } of frontier) {
      for (const b of st.boulders) {
        if (!b) continue;
        for (const [dc, dr] of DIRS) {
          // 玩家要站在石头的反方向一格
          const pc = b[0] - dc;
          const pr = b[1] - dr;
          if (!region.has(key(pc, pr))) continue;
          const res = pushBoulder(cfg, st, b[0], b[1], dc, dr, walls);
          if (!res.ok) continue;
          // 推完玩家站到石头原来的位置
          const reg = reachable(cfg, res.state, [b[0], b[1]], walls);
          if (reg.has(goalK)) return { solvable: true, minPushes: depth, explored: seen.size };
          const k = enc(res.state, reg);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ st: res.state, region: reg });
        }
      }
    }
    frontier = next;
  }
  return { solvable: false, minPushes: -1, explored: seen.size };
}

/** 玩家朝向（弧度，0 = +Z）对应的推动方向（只取上下左右；离轴超过 35° 不算推） */
export function pushDir(yaw: number): [number, number] | null {
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);
  if (Math.abs(x) > Math.abs(z)) return Math.abs(x) > Math.cos((35 * Math.PI) / 180) ? [Math.sign(x), 0] : null;
  return Math.abs(z) > Math.cos((35 * Math.PI) / 180) ? [0, Math.sign(z)] : null;
}
