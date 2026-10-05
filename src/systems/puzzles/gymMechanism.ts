/**
 * M3-15 · 道馆 5–8「馆内机关」纯逻辑（无 three / 无浏览器依赖）。
 *
 * 一套通用的「开关 → 闸门」模型，覆盖四座雷鸣道馆：
 * - 雷霆道馆（电）：导电开关（拉杆，2 档）控制电栅栏；拉杆之间互相牵制，要来回切换才能走到馆主面前。
 * - 晨辉道馆（普）：日晷（共享变量 sun：0 昼 / 1 夜）。日光墙（sunlight）白天实体、夜里消散；
 *   影墙（shadow）相反。进门时按真实时钟取初值（`fromClock`），馆内多座日晷都能拨动同一个昼夜。
 * - 霜凝道馆（冰）：冰面（ice）——踏上冰面后沿进入方向一直滑行，直到撞上冰块 / 墙或滑出冰面。
 * - 云翎道馆（飞）：深谷（pit，永远不可通行）+ 风桥（wind 闸门：打开 = 风托起的桥，关闭 = 深谷），由风扇开关驱动。
 *
 * - 幻影道馆（超）：传送镜（mirror）——踏上镜前的光阵就被传送；镜子的去向可由「念力水晶球」（orb 开关）旋转切换，
 *   走错的镜子会把人送回入口。
 * - 幽冥道馆（鬼）：常暗房间（dark）；灵火墙（spirit 闸门）挡路，点亮对应的灯台（lamp 开关）才会退散；
 *   烛台可以有 3 档（轮流点亮不同的厅）。
 *
 * 闸门语义统一：`openWhen` 中每个变量都取到指定值时闸门「打开」（可通行），否则是实体阻挡。
 * 提供：可通行判定、阻挡矩形（给碰撞系统）、滑冰终点、BFS 求解（单元测试证明可解、非平凡、无死局）。
 */
import type { Rect } from './waterLevel';

export type { Rect };
export type Vec2 = readonly [number, number];

export type GateStyle = 'electric' | 'sunlight' | 'shadow' | 'wind' | 'spirit' | 'tide';
export type SwitchStyle = 'lever' | 'sundial' | 'fan' | 'orb' | 'lamp' | 'conch';
export type WallStyle = 'stone' | 'metal' | 'ice' | 'cloud' | 'crystal' | 'grave' | 'coral';

export interface MechSwitch {
  id: string;
  position: Vec2;
  style: SwitchStyle;
  /** 控制的变量（缺省 = 开关 id；多座日晷共享 'sun'） */
  variable?: string;
  /** 档位数（缺省 2） */
  states?: number;
  /** 各档名称（提示与 toast 用） */
  stateNames?: readonly string[];
  /** 互动半径（缺省 1.5 m） */
  range?: number;
}

export interface MechGate {
  id: string;
  rect: Rect;
  style: GateStyle;
  /** 全部满足时打开（可通行） */
  openWhen: Readonly<Record<string, number>>;
}

export interface MechWall {
  rect: Rect;
  style: WallStyle;
  /** 墙高（缺省 2.4 m；冰块 1.4 m） */
  height?: number;
}

export interface MechMirror {
  id: string;
  /** 光阵中心（踏上即传送） */
  at: Vec2;
  /** 固定去向（无 variable 时） */
  to?: Vec2;
  /** 由变量决定去向：targets[state] */
  variable?: string;
  targets?: readonly Vec2[];
  /** 镜面朝向（视图用，弧度，0 = 镜面朝 +z） */
  yaw?: number;
  /** 光阵颜色（同色成对，提示用） */
  color?: string;
}

export const MIRROR_RADIUS = 0.7;

/**
 * M3-18 海底神殿 · 暗流：站进生效中的暗流就被冲着走（不读输入），直到冲出暗流区或撞上阻挡。
 * variable / activeWhen：由开关控制是否生效（缺省常开）。
 */
export interface MechCurrent {
  id: string;
  rect: Rect;
  /** 流向（四向单位向量） */
  dir: Vec2;
  variable?: string;
  activeWhen?: number;
}

export const CURRENT_SPEED = 5.5;

export interface GymMechanismConfig {
  kind: 'electric' | 'sundial' | 'ice' | 'wind' | 'mirror' | 'lamp' | 'tide';
  /** 机关区域（BFS 与视图范围；房间坐标） */
  bounds: Rect;
  switches: readonly MechSwitch[];
  gates: readonly MechGate[];
  walls: readonly MechWall[];
  /** 深谷：永远不可通行（风桥道馆） */
  pits?: readonly Rect[];
  /** 冰面 */
  ice?: readonly Rect[];
  /** 传送镜 */
  mirrors?: readonly MechMirror[];
  /** M3-18 暗流 */
  currents?: readonly MechCurrent[];
  /** 常暗：房间灯压暗，只有玩家提灯与点亮的灯台照明 */
  dark?: boolean;
  /** 变量初值（缺省 0） */
  initial?: Readonly<Record<string, number>>;
  /** 按真实时钟取初值的变量：白天 0 / 夜里 1 */
  fromClock?: string;
  /** M3-18 一旦置位这个 flag，进门时机关直接处于 solvedState（神殿解开后不再复位） */
  solvedFlag?: string;
  solvedState?: Readonly<Record<string, number>>;
  /** 求解起点（入口）与终点（馆主台前） */
  start: Vec2;
  goal: Vec2;
}

export type MechState = Record<string, number>;

export const SLIDE_SPEED = 7.5;
export const SWITCH_RANGE = 1.5;

export const inRect = (r: Rect, x: number, z: number, pad = 0): boolean => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;

export const switchVar = (s: MechSwitch): string => s.variable ?? s.id;
export const switchStates = (s: MechSwitch): number => Math.max(2, s.states ?? 2);

/** 全部变量（开关 + 闸门引用的） */
export function variables(cfg: GymMechanismConfig): string[] {
  const set = new Set<string>();
  for (const s of cfg.switches) set.add(switchVar(s));
  for (const g of cfg.gates) for (const k of Object.keys(g.openWhen)) set.add(k);
  for (const m of cfg.mirrors ?? []) if (m.variable) set.add(m.variable);
  for (const c of cfg.currents ?? []) if (c.variable) set.add(c.variable);
  return [...set].sort();
}

export function initialState(cfg: GymMechanismConfig, night = false): MechState {
  const st: MechState = {};
  for (const v of variables(cfg)) st[v] = cfg.initial?.[v] ?? 0;
  if (cfg.fromClock) st[cfg.fromClock] = night ? 1 : 0;
  return st;
}

export function gateOpen(g: MechGate, st: Readonly<MechState>): boolean {
  return Object.entries(g.openWhen).every(([k, v]) => (st[k] ?? 0) === v);
}

/** 拨动开关：返回新状态（不修改原对象） */
export function cycleSwitch(cfg: GymMechanismConfig, st: Readonly<MechState>, id: string): MechState {
  const s = cfg.switches.find((q) => q.id === id);
  if (!s) return { ...st };
  const v = switchVar(s);
  return { ...st, [v]: ((st[v] ?? 0) + 1) % switchStates(s) };
}

/** 当前状态下所有实体阻挡矩形（墙 + 深谷 + 关闭的闸门） */
export function blockingRects(cfg: GymMechanismConfig, st: Readonly<MechState>): Rect[] {
  return [...cfg.walls.map((w) => w.rect), ...(cfg.pits ?? []), ...cfg.gates.filter((g) => !gateOpen(g, st)).map((g) => g.rect)];
}

/** 拨动后会关上、且与 (x, z) 半径 r 重叠的闸门（视图据此拒绝拨动，防止把人关进墙里） */
export function gatesClosingOn(cfg: GymMechanismConfig, before: Readonly<MechState>, after: Readonly<MechState>, x: number, z: number, r = 0.4): MechGate[] {
  return cfg.gates.filter((g) => gateOpen(g, before) && !gateOpen(g, after) && inRect(g.rect, x, z, r));
}

/** 当前状态下镜子的去向 */
export function mirrorTarget(m: MechMirror, st: Readonly<MechState>): Vec2 {
  if (m.variable && m.targets?.length) return m.targets[(st[m.variable] ?? 0) % m.targets.length]!;
  return m.to ?? m.at;
}

export function mirrorAt(cfg: GymMechanismConfig, x: number, z: number, r = MIRROR_RADIUS): MechMirror | null {
  for (const m of cfg.mirrors ?? []) if (Math.hypot(x - m.at[0], z - m.at[1]) <= r) return m;
  return null;
}

export function currentActive(c: MechCurrent, st: Readonly<MechState>): boolean {
  return !c.variable || (st[c.variable] ?? 0) === (c.activeWhen ?? 1);
}

/** (x, z) 处生效中的暗流（重叠时取配置里靠后的，便于做转向块） */
export function currentAt(cfg: GymMechanismConfig, st: Readonly<MechState>, x: number, z: number): MechCurrent | null {
  let hit: MechCurrent | null = null;
  for (const c of cfg.currents ?? []) if (currentActive(c, st) && inRect(c.rect, x, z)) hit = c;
  return hit;
}

export function onIce(cfg: GymMechanismConfig, x: number, z: number): boolean {
  return !!cfg.ice?.some((r) => inRect(r, x, z));
}

export function switchNear(cfg: GymMechanismConfig, x: number, z: number): MechSwitch | null {
  let best: MechSwitch | null = null;
  let bd = Infinity;
  for (const s of cfg.switches) {
    const d = Math.hypot(x - s.position[0], z - s.position[1]);
    if (d <= (s.range ?? SWITCH_RANGE) && d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** 速度 → 主方向（四向，滑冰用）；速度太小返回 null */
export function cardinal(vx: number, vz: number, min = 0.6): Vec2 | null {
  if (Math.hypot(vx, vz) < min) return null;
  return Math.abs(vx) >= Math.abs(vz) ? [Math.sign(vx), 0] : [0, Math.sign(vz)];
}

// ———————————————————— BFS 求解（1 m 网格，点状玩家） ————————————————————

export interface SolveResult {
  solvable: boolean;
  /** 最少拨动次数（不可解为 -1） */
  minToggles: number;
  /** 可达状态中回不到入口的数量（死局） */
  softlocks: number;
  /** 可达 (格子, 状态) 数 */
  explored: number;
}

interface Grid {
  x0: number;
  z0: number;
  nx: number;
  nz: number;
}

function grid(cfg: GymMechanismConfig): Grid {
  const [x0, z0, x1, z1] = cfg.bounds;
  return { x0, z0, nx: Math.round(x1 - x0), nz: Math.round(z1 - z0) };
}

/** 求解器：节点 = (格子, 变量组合)；边 = 走一步 / 滑行 / 拨动开关 */
export function solveMechanism(cfg: GymMechanismConfig, night = false): SolveResult {
  const g = grid(cfg);
  const vars = variables(cfg);
  const cx = (i: number): number => g.x0 + i + 0.5;
  const cz = (j: number): number => g.z0 + j + 0.5;
  const cell = (x: number, z: number): [number, number] => [Math.floor(x - g.x0), Math.floor(z - g.z0)];
  const enc = (st: MechState): string => vars.map((v) => st[v] ?? 0).join(',');
  const dec = (k: string): MechState => {
    const p = k.split(',').map(Number);
    const st: MechState = {};
    vars.forEach((v, i) => (st[v] = p[i] ?? 0));
    return st;
  };
  const solidSwitch = (x: number, z: number): boolean => cfg.switches.some((s) => Math.abs(x - s.position[0]) < 0.6 && Math.abs(z - s.position[1]) < 0.6);
  const blockedCache = new Map<string, Uint8Array>();
  const blockedMap = (sk: string): Uint8Array => {
    let m = blockedCache.get(sk);
    if (m) return m;
    const rects = blockingRects(cfg, dec(sk));
    m = new Uint8Array(g.nx * g.nz);
    for (let j = 0; j < g.nz; j++)
      for (let i = 0; i < g.nx; i++) {
        const x = cx(i);
        const z = cz(j);
        if (rects.some((r) => inRect(r, x, z)) || solidSwitch(x, z)) m[j * g.nx + i] = 1;
      }
    blockedCache.set(sk, m);
    return m;
  };
  const free = (sk: string, i: number, j: number): boolean => i >= 0 && j >= 0 && i < g.nx && j < g.nz && blockedMap(sk)[j * g.nx + i] === 0;
  const iceAt = (i: number, j: number): boolean => onIce(cfg, cx(i), cz(j));
  /** 暗流：被冲到停下为止（冲出暗流区 / 前方受阻）；防环上限 */
  const settle = (i: number, j: number, sk: string): [number, number] => {
    const st = dec(sk);
    for (let n = 0; n < 400; n++) {
      const c = currentAt(cfg, st, cx(i), cz(j));
      if (!c || !free(sk, i + c.dir[0], j + c.dir[1])) break;
      i += c.dir[0];
      j += c.dir[1];
    }
    return [i, j];
  };

  const neighbors = (i: number, j: number, sk: string): Array<[number, number, string, number]> => {
    const out: Array<[number, number, string, number]> = [];
    // 站在仍能冲动的暗流上：唯一的移动就是被冲走
    {
      const c = currentAt(cfg, dec(sk), cx(i), cz(j));
      if (c && free(sk, i + c.dir[0], j + c.dir[1])) {
        const [ni, nj] = settle(i, j, sk);
        return [[ni, nj, sk, 0]];
      }
    }
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      let ni = i + di;
      let nj = j + dj;
      if (!free(sk, ni, nj)) continue;
      // 滑冰：踏上冰面后一直滑到撞墙或滑出冰面
      while (iceAt(ni, nj) && free(sk, ni + di, nj + dj)) {
        ni += di;
        nj += dj;
      }
      // 传送镜：落点是光阵就被送到镜子当前的去向
      const mir = mirrorAt(cfg, cx(ni), cz(nj), 0.6);
      if (mir) {
        const [tx, tz] = mirrorTarget(mir, dec(sk));
        [ni, nj] = cell(tx, tz);
        if (!free(sk, ni, nj)) continue;
      }
      [ni, nj] = settle(ni, nj, sk);
      out.push([ni, nj, sk, 0]);
    }
    {
      const st = dec(sk);
      for (const s of cfg.switches) {
        if (Math.hypot(cx(i) - s.position[0], cz(j) - s.position[1]) > (s.range ?? SWITCH_RANGE) + 0.5) continue;
        const next = cycleSwitch(cfg, st, s.id);
        if (gatesClosingOn(cfg, st, next, cx(i), cz(j)).length) continue;
        out.push([i, j, enc(next), 1]);
      }
    }
    return out;
  };

  const [si, sj] = cell(cfg.start[0], cfg.start[1]);
  const [gi, gj] = cell(cfg.goal[0], cfg.goal[1]);
  const s0 = enc(initialState(cfg, night));
  const key = (i: number, j: number, sk: string): string => `${i}|${j}|${sk}`;
  // 0-1 BFS：拨动开关代价 1，走路代价 0 → 求最少拨动次数
  const dist = new Map<string, number>();
  const dq: Array<[number, number, string]> = [[si, sj, s0]];
  dist.set(key(si, sj, s0), 0);
  let minToggles = -1;
  while (dq.length) {
    const [i, j, sk] = dq.shift()!;
    const d = dist.get(key(i, j, sk))!;
    if (i === gi && j === gj && (minToggles < 0 || d < minToggles)) minToggles = d;
    for (const [ni, nj, nk, c] of neighbors(i, j, sk)) {
      const k = key(ni, nj, nk);
      const nd = d + c;
      const old = dist.get(k);
      if (old !== undefined && old <= nd) continue;
      dist.set(k, nd);
      if (c === 0) dq.unshift([ni, nj, nk]);
      else dq.push([ni, nj, nk]);
    }
  }
  // 死局检查：从每个可达节点出发能否回到入口格（任意状态）
  const back = new Set<string>();
  const nodes = [...dist.keys()];
  const adj = new Map<string, string[]>();
  for (const k of nodes) {
    const [a, b, sk] = k.split('|');
    for (const [ni, nj, nk] of neighbors(Number(a), Number(b), sk!)) {
      const t = key(ni, nj, nk);
      let l = adj.get(t);
      if (!l) adj.set(t, (l = []));
      l.push(k);
    }
  }
  const q: string[] = [];
  for (const k of nodes)
    if (k.startsWith(`${si}|${sj}|`)) {
      back.add(k);
      q.push(k);
    }
  while (q.length) {
    const k = q.pop()!;
    for (const p of adj.get(k) ?? [])
      if (!back.has(p)) {
        back.add(p);
        q.push(p);
      }
  }
  return { solvable: minToggles >= 0, minToggles, softlocks: nodes.length - back.size, explored: nodes.length };
}
