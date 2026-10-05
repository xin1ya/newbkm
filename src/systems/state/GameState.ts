/**
 * SYS-002 · GameState 与存档（设计 §11）。
 *   GameState = { version, flags, party, box, bag, money, position, explored, pokedex, playTime, settings } + 玩家信息
 * 任务进度完全由 flags 推导（07-22 §3.2），GameState 不包含任务字段。
 * 存档的读写介质由 platform/ 提供；这里只负责结构、序列化、校验与版本迁移。
 */
import type { MapPin, NavTarget } from '../map/pins';
import type { PokemonInstance } from '../pokemon/Pokemon';
import type { AlphaDenRecord } from '../alpha';
import type { GatherState } from '../gathering';
import type { FarmState } from '../farming';
import type { LureState, PokeBlock } from '../blocks';
import type { BreederState } from '../breeder';

export const SAVE_VERSION = 1;
export const SAVE_FORMAT = 'cuilan-save';
export const PARTY_MAX = 6;
export const BOX_MAX = 30 * 16;
export const MONEY_MAX = 9_999_999;

export type IslandId = 'sprout' | 'tide' | 'thunder' | 'glaze' | 'secret';
export type Quality = 'auto' | 'low' | 'medium' | 'high';

/** M3-21 名人堂记录 */
export interface HallOfFameEntry {
  /** 第几次入殿（从 1 开始） */
  n: number;
  day: number;
  playTime: number;
  team: Array<{ speciesId: number; nickname: string | null; level: number; shiny: boolean; ot: string }>;
}

export interface Settings {
  quality: Quality;
  volume: { master: number; bgm: number; sfx: number; ambient: number };
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  mouseSensitivity: number;
  invertY: boolean;
  /** 追踪任务的世界浮空标记（设计 §7.3） */
  showWorldMarkers: boolean;
  showNameTags: boolean;
  /** 自定义按键：action → 按键码列表；未设置的使用默认值 */
  keybindings: Record<string, string[]>;
  cameraMode: 'third' | 'first';
  /**
   * 追踪中的任务（M1-16，属于界面偏好而非任务进度，所以放在设置里）：
   * null = 自动（优先主线）；'none' = 玩家取消了追踪；其余为任务 id
   */
  trackedQuest: string | null;
  /** 跟随宝可梦（M1-08）：队首宝可梦在大世界 / 室内跟在身后 */
  showFollower: boolean;
  /** 第三人称也锁定鼠标（第一人称始终锁定） */
  mouseLock: boolean;
  /** 自动存档（完成任务节点 / 战斗结束 / 进出建筑 / 剧情结束 / 每 5 分钟） */
  autoSave: boolean;
  /** 帧率上限：0 = 不限（跟随显示器刷新率） */
  fpsLimit: 0 | 30 | 60 | 120;
  /** 动态分辨率：GPU 吃紧时自动降低渲染分辨率（最低 70%） */
  dynamicResolution: boolean;
  /** 奔跑键：toggle = 按一下切换奔跑 / 步行；hold = 按住奔跑 */
  runMode: 'toggle' | 'hold';
  /** 战斗动画速度倍率 */
  battleSpeed: 1 | 1.5 | 2;
  /** 战斗招式动画（关闭时只播放受击与血条） */
  battleAnims: boolean;
  /** HUD 小地图 */
  showMinimap: boolean;
  /** 小地图随镜头旋转（false = 北朝上） */
  minimapRotate: boolean;
}

export interface Position {
  island: IslandId;
  /** 世界坐标（米） */
  xyz: [number, number, number];
  /** 朝向（弧度） */
  yaw: number;
  /** 当前所在室内场景 id；在大地图时为 null */
  interior: string | null;
}

export interface GameState {
  version: number;
  createdAt: string;
  savedAt: string;
  player: { name: string; gender: 'boy' | 'girl'; trainerId: number };
  flags: Record<string, boolean>;
  /** 计数型进度（例：已采集药草数），与 flags 一样不属于任务字段 */
  vars: Record<string, number>;
  party: PokemonInstance[];
  box: PokemonInstance[];
  bag: Record<string, number>;
  money: number;
  position: Position;
  /** 探索迷雾：island → base64 位图（每格 EXPLORE_CELL 米） */
  explored: Partial<Record<IslandId, string>>;
  pokedex: { seen: number[]; caught: number[] };
  /** 游戏时长（秒） */
  playTime: number;
  /** 游戏内时钟（分钟，0–1439） */
  clockMinutes: number;
  /** 游戏内天数（从 0 开始；头目冷却按天计算）。旧存档缺省为 0，无需迁移 */
  day?: number | undefined;
  /** 头目巢穴记录（计划文档 §3.5）：denId → 击败日 / 捕获 / 首次奖励 / 已发现。旧存档缺省为空 */
  alpha?: Record<string, AlphaDenRecord> | undefined;
  /** 野外采集（计划文档 §9.2）：采集点 → 上次采集的游戏日；蜂蜜树涂蜜时间。旧存档缺省为空，无需迁移 */
  gather?: GatherState | undefined;
  /** 种植（计划文档 §9.3）：田地 id → 作物状态。旧存档缺省为空，无需迁移 */
  farm?: FarmState | undefined;
  /** 能量方块盒（计划文档 §9.5，容量 40）。旧存档缺省为空 */
  blocks?: PokeBlock[] | undefined;
  /** 正在生效的方块诱饵 */
  lure?: LureState | undefined;
  /** 培育家职业（计划文档 §9.4）：经验、培育屋。旧存档缺省为空 */
  breeder?: BreederState | undefined;
  /** 地图自定义标点（大地图放置，小地图显示）与当前导航的标点 id */
  mapPins?: MapPin[] | undefined;
  navPin?: string | null | undefined;
  navTarget?: NavTarget | null | undefined;
  /** M3-21 名人堂（每次战胜冠军记录一次队伍）。旧存档缺省为空，无需迁移 */
  hallOfFame?: HallOfFameEntry[] | undefined;
  /** M3-22 跨岛快速旅行：重新加载后在该飞行点（POI id）播放降落演出。读取后清空 */
  pendingFlyArrival?: string | null | undefined;
  settings: Settings;
  /**
   * 黑屏复活点（M1-09）：最近一次在宝可梦中心 / 家中回复的门口；缺省为岛屿出生点。
   * 旧存档没有该字段，按缺省处理，无需迁移。
   */
  respawn?: RespawnPoint | undefined;
}

export interface RespawnPoint {
  island: IslandId;
  xyz: [number, number, number];
  yaw: number;
  /** 显示名（「宝可梦中心（翠澜镇）」） */
  label: string;
}

export const defaultSettings = (): Settings => ({
  quality: 'auto',
  volume: { master: 0.8, bgm: 0.7, sfx: 0.8, ambient: 0.6 },
  textSpeed: 'normal',
  mouseSensitivity: 1,
  invertY: false,
  showWorldMarkers: true,
  showNameTags: true,
  keybindings: {},
  cameraMode: 'third',
  trackedQuest: null,
  showFollower: true,
  mouseLock: true,
  autoSave: true,
  runMode: 'toggle',
  fpsLimit: 120,
  dynamicResolution: true,
  battleSpeed: 1,
  battleAnims: true,
  showMinimap: true,
  minimapRotate: true,
});

export interface NewGameOptions {
  name: string;
  gender: 'boy' | 'girl';
  trainerId: number;
  spawn: { island: IslandId; xyz: [number, number, number]; yaw?: number };
  now?: Date;
}

export function createNewGame(o: NewGameOptions): GameState {
  const now = (o.now ?? new Date()).toISOString();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    player: { name: o.name, gender: o.gender, trainerId: o.trainerId },
    flags: {},
    vars: {},
    party: [],
    box: [],
    bag: { potion: 3, 'poke-ball': 0 },
    money: 3000,
    position: { island: o.spawn.island, xyz: [...o.spawn.xyz], yaw: o.spawn.yaw ?? 0, interior: null },
    explored: {},
    pokedex: { seen: [], caught: [] },
    playTime: 0,
    clockMinutes: 8 * 60,
    settings: defaultSettings(),
  };
}

// ——————————————————— 常用操作 ———————————————————

export function setFlag(s: GameState, flag: string, value = true): void {
  if (value) s.flags[flag] = true;
  else delete s.flags[flag];
}

export const hasFlag = (s: GameState, flag: string): boolean => s.flags[flag] === true;

export function addItem(s: GameState, id: string, qty = 1): void {
  if (qty <= 0) return;
  s.bag[id] = Math.min(999, (s.bag[id] ?? 0) + qty);
}

/** 扣除道具，不足时返回 false 且不修改 */
export function removeItem(s: GameState, id: string, qty = 1): boolean {
  const have = s.bag[id] ?? 0;
  if (qty <= 0 || have < qty) return false;
  if (have === qty) delete s.bag[id];
  else s.bag[id] = have - qty;
  return true;
}

export function addMoney(s: GameState, amount: number): void {
  s.money = Math.max(0, Math.min(MONEY_MAX, Math.floor(s.money + amount)));
}

/** 加入队伍；队伍已满时放入盒子。返回放置位置 */
export function receivePokemon(s: GameState, p: PokemonInstance): 'party' | 'box' | 'full' {
  markCaught(s, p.speciesId);
  if (s.party.length < PARTY_MAX) {
    s.party.push(p);
    return 'party';
  }
  if (s.box.length < BOX_MAX) {
    s.box.push(p);
    return 'box';
  }
  return 'full';
}

export function markSeen(s: GameState, speciesId: number): void {
  if (!s.pokedex.seen.includes(speciesId)) {
    s.pokedex.seen.push(speciesId);
    s.pokedex.seen.sort((a, b) => a - b);
  }
}

export function markCaught(s: GameState, speciesId: number): void {
  markSeen(s, speciesId);
  if (!s.pokedex.caught.includes(speciesId)) {
    s.pokedex.caught.push(speciesId);
    s.pokedex.caught.sort((a, b) => a - b);
  }
}

/** 队伍中是否还有能战斗的宝可梦 */
export const hasUsablePokemon = (s: GameState): boolean => s.party.some((p) => p.hp > 0);

// ——————————————————— 探索迷雾 ———————————————————

export const EXPLORE_CELL = 16; // 米

export interface ExploreGrid {
  /** 岛屿世界尺寸（米） */
  size: [number, number];
}

function decodeBits(b64: string | undefined, bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  if (!b64) return out;
  const bin = atob(b64);
  for (let i = 0; i < Math.min(bytes, bin.length); i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBits(bits: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bits.length; i++) bin += String.fromCharCode(bits[i] ?? 0);
  return btoa(bin);
}

function gridDims(grid: ExploreGrid): [number, number] {
  return [Math.ceil(grid.size[0] / EXPLORE_CELL), Math.ceil(grid.size[1] / EXPLORE_CELL)];
}

/**
 * 以 (x, z) 为中心、radius 米为半径标记已探索。世界坐标原点在岛屿中心。
 * 返回新增的格子数。
 */
export function markExplored(s: GameState, island: IslandId, grid: ExploreGrid, x: number, z: number, radius: number): number {
  const [w, h] = gridDims(grid);
  const bits = decodeBits(s.explored[island], Math.ceil((w * h) / 8));
  const cx = (x + grid.size[0] / 2) / EXPLORE_CELL;
  const cz = (z + grid.size[1] / 2) / EXPLORE_CELL;
  const r = radius / EXPLORE_CELL;
  let added = 0;
  for (let gz = Math.max(0, Math.floor(cz - r)); gz <= Math.min(h - 1, Math.ceil(cz + r)); gz++) {
    for (let gx = Math.max(0, Math.floor(cx - r)); gx <= Math.min(w - 1, Math.ceil(cx + r)); gx++) {
      if ((gx + 0.5 - cx) ** 2 + (gz + 0.5 - cz) ** 2 > r * r) continue;
      const i = gz * w + gx;
      const byte = i >> 3;
      const mask = 1 << (i & 7);
      if (!((bits[byte] ?? 0) & mask)) {
        bits[byte] = (bits[byte] ?? 0) | mask;
        added++;
      }
    }
  }
  if (added) s.explored[island] = encodeBits(bits);
  return added;
}

export function isExplored(s: GameState, island: IslandId, grid: ExploreGrid, x: number, z: number): boolean {
  const [w, h] = gridDims(grid);
  const gx = Math.floor((x + grid.size[0] / 2) / EXPLORE_CELL);
  const gz = Math.floor((z + grid.size[1] / 2) / EXPLORE_CELL);
  if (gx < 0 || gz < 0 || gx >= w || gz >= h) return false;
  const bits = decodeBits(s.explored[island], Math.ceil((w * h) / 8));
  const i = gz * w + gx;
  return ((bits[i >> 3] ?? 0) & (1 << (i & 7))) !== 0;
}

export function exploredRatio(s: GameState, island: IslandId, grid: ExploreGrid): number {
  const [w, h] = gridDims(grid);
  const bits = decodeBits(s.explored[island], Math.ceil((w * h) / 8));
  let n = 0;
  for (let i = 0; i < w * h; i++) if ((bits[i >> 3] ?? 0) & (1 << (i & 7))) n++;
  return n / (w * h);
}

/** 探索位图整体解码（大地图绘制迷雾用）：w × h 格，bits[i] = 1 表示已探索 */
export function exploredMask(s: GameState, island: IslandId, grid: ExploreGrid): { w: number; h: number; cell: number; cells: Uint8Array } {
  const [w, h] = gridDims(grid);
  const bits = decodeBits(s.explored[island], Math.ceil((w * h) / 8));
  const cells = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cells[i] = (bits[i >> 3] ?? 0) & (1 << (i & 7)) ? 1 : 0;
  return { w, h, cell: EXPLORE_CELL, cells };
}

/** 进入城镇时整片揭开（城镇在大地图上整体显示）：多边形内（含边缘 1 格）的探索格全部置位；返回新增格数 */
export function markExploredPolygon(s: GameState, island: IslandId, grid: ExploreGrid, polygon: readonly (readonly [number, number])[]): number {
  if (polygon.length < 3) return 0;
  const [w, h] = gridDims(grid);
  const bits = decodeBits(s.explored[island], Math.ceil((w * h) / 8));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const inside = (x: number, z: number) => {
    let c = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i]!;
      const [xj, zj] = polygon[j]!;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  let added = 0;
  const g0x = Math.max(0, Math.floor((minX + grid.size[0] / 2) / EXPLORE_CELL) - 1);
  const g1x = Math.min(w - 1, Math.floor((maxX + grid.size[0] / 2) / EXPLORE_CELL) + 1);
  const g0z = Math.max(0, Math.floor((minZ + grid.size[1] / 2) / EXPLORE_CELL) - 1);
  const g1z = Math.min(h - 1, Math.floor((maxZ + grid.size[1] / 2) / EXPLORE_CELL) + 1);
  for (let gz = g0z; gz <= g1z; gz++) {
    for (let gx = g0x; gx <= g1x; gx++) {
      // 格子中心或四角任一在多边形内即揭开（边缘一圈）
      const x0 = gx * EXPLORE_CELL - grid.size[0] / 2;
      const z0 = gz * EXPLORE_CELL - grid.size[1] / 2;
      const hit = [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]].some(([a, b]) => inside(x0 + a! * EXPLORE_CELL, z0 + b! * EXPLORE_CELL));
      if (!hit) continue;
      const i = gz * w + gx;
      const m = 1 << (i & 7);
      if (!((bits[i >> 3] ?? 0) & m)) {
        bits[i >> 3] = (bits[i >> 3] ?? 0) | m;
        added++;
      }
    }
  }
  if (added) s.explored[island] = encodeBits(bits);
  return added;
}

/** 到访过的区域：flags[`zone-visited.<zoneId>`]（地图据此显示地名） */
export const ZONE_VISITED_PREFIX = 'zone-visited.';
