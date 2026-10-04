/**
 * SYS-002 · 存档序列化、校验与版本迁移。
 *
 * 新增存档字段时：
 *   1. SAVE_VERSION + 1
 *   2. 在 MIGRATIONS 中登记 `旧版本号 → 迁移函数`（只做结构变换，不依赖运行时数据）
 *   3. 在 tests/unit/state.test.ts 中补充旧版本样例
 */
import { repairPins } from '../map/pins';
import type { GameState } from './GameState';
import { defaultSettings, PARTY_MAX, SAVE_FORMAT, SAVE_VERSION } from './GameState';

export class SaveError extends Error {
  constructor(
    message: string,
    readonly code: 'parse' | 'format' | 'future-version' | 'invalid',
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

/** 存档外层包装 */
export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  /** 存档选择界面显示的摘要，读取时无需解析完整数据 */
  summary: SaveSummary;
  data: GameState;
}

export interface SaveSummary {
  playerName: string;
  playTime: number;
  badges: number;
  island: string;
  partySpecies: number[];
  caught: number;
  /** 存档时所在地（「新芽岛 · 某某区域」），标题画面显示 */
  location?: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Migration = (data: any) => any;

/** 版本迁移表：key = 迁移前的版本号 */
export const MIGRATIONS: Record<number, Migration> = {
  // 示例（v1 → v2）：1: (d) => ({ ...d, newField: defaultValue }),
};

export function summarize(s: GameState, location?: string): SaveSummary {
  return {
    location,
    playerName: s.player.name,
    playTime: Math.floor(s.playTime),
    badges: Object.keys(s.flags).filter((f) => f.startsWith('badge-') && s.flags[f]).length,
    island: s.position.island,
    partySpecies: s.party.map((p) => p.speciesId),
    caught: s.pokedex.caught.length,
  };
}

export function serializeSave(s: GameState, now = new Date()): string {
  const data: GameState = { ...s, version: SAVE_VERSION, savedAt: now.toISOString() };
  const env: SaveEnvelope = { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: data.savedAt, summary: summarize(data), data };
  return JSON.stringify(env);
}

/**
 * 按顺序执行迁移，直到 target 版本。缺少某一步迁移时抛错（防止静默丢数据）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(data: any, from: number, target = SAVE_VERSION, migrations: Record<number, Migration> = MIGRATIONS): any {
  let d = data;
  for (let v = from; v < target; v++) {
    const m = migrations[v];
    if (!m) throw new SaveError(`缺少存档迁移 v${v} → v${v + 1}`, 'invalid');
    d = m(d);
    d.version = v + 1;
  }
  return d;
}

export interface LoadResult {
  state: GameState;
  migratedFrom: number | null;
  /** 自动修复的问题（记录日志，不阻止读档） */
  repairs: string[];
}

export function deserializeSave(text: string, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): LoadResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let env: any;
  try {
    env = JSON.parse(text);
  } catch {
    throw new SaveError('存档不是有效的 JSON', 'parse');
  }
  if (!env || env.format !== SAVE_FORMAT || typeof env.version !== 'number' || typeof env.data !== 'object') {
    throw new SaveError('不是翠澜群岛的存档', 'format');
  }
  if (env.version > target) throw new SaveError(`存档版本 v${env.version} 比游戏更新（v${target}），请更新游戏`, 'future-version');
  const migratedFrom = env.version < target ? env.version : null;
  const data = migratedFrom !== null ? migrate(env.data, env.version, target, migrations) : env.data;
  const repairs = validateAndRepair(data);
  return { state: data as GameState, migratedFrom, repairs };
}

/** 结构校验；可修复的问题就地修复并返回描述，不可修复时抛错 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateAndRepair(d: any): string[] {
  const repairs: string[] = [];
  const need = (cond: boolean, msg: string) => {
    if (!cond) throw new SaveError(`存档损坏：${msg}`, 'invalid');
  };
  need(typeof d.player === 'object' && typeof d.player?.name === 'string', '缺少玩家信息');
  need(typeof d.position === 'object' && Array.isArray(d.position?.xyz) && d.position.xyz.length === 3, '缺少位置');
  need(Array.isArray(d.party), '缺少队伍');
  if (typeof d.flags !== 'object' || d.flags === null) {
    d.flags = {};
    repairs.push('flags 缺失，已重置');
  }
  if (typeof d.vars !== 'object' || d.vars === null) {
    d.vars = {};
    repairs.push('vars 缺失，已重置');
  }
  if (!Array.isArray(d.box)) {
    d.box = [];
    repairs.push('box 缺失，已重置');
  }
  if (typeof d.bag !== 'object' || d.bag === null) {
    d.bag = {};
    repairs.push('bag 缺失，已重置');
  }
  for (const [k, v] of Object.entries(d.bag)) {
    if (typeof v !== 'number' || v <= 0 || !Number.isFinite(v)) {
      delete d.bag[k];
      repairs.push(`背包道具 ${k} 数量无效，已移除`);
    }
  }
  if (typeof d.money !== 'number' || !Number.isFinite(d.money) || d.money < 0) {
    d.money = 0;
    repairs.push('金钱无效，已归零');
  }
  if (d.party.length > PARTY_MAX) {
    d.box.push(...d.party.splice(PARTY_MAX));
    repairs.push('队伍超过 6 只，多余的已放入盒子');
  }
  for (const p of [...d.party, ...d.box]) {
    need(typeof p.speciesId === 'number' && typeof p.level === 'number' && Array.isArray(p.moves), '宝可梦数据不完整');
    if (typeof p.hp !== 'number' || p.hp < 0) {
      p.hp = 0;
      repairs.push(`宝可梦 ${p.uid} HP 无效`);
    }
  }
  if (!d.pokedex || !Array.isArray(d.pokedex.seen) || !Array.isArray(d.pokedex.caught)) {
    d.pokedex = { seen: [], caught: [] };
    repairs.push('图鉴缺失，已重置');
  }
  if (typeof d.explored !== 'object' || d.explored === null) {
    d.explored = {};
    repairs.push('探索记录缺失，已重置');
  }
  if (typeof d.playTime !== 'number') d.playTime = 0;
  if (typeof d.clockMinutes !== 'number') d.clockMinutes = 480;
  if (d.day !== undefined && (typeof d.day !== 'number' || !Number.isFinite(d.day) || d.day < 0)) d.day = 0;
  if (d.alpha !== undefined && (typeof d.alpha !== 'object' || d.alpha === null)) {
    d.alpha = {};
    repairs.push('头目记录无效，已重置');
  }
  if (d.gather !== undefined && (typeof d.gather !== 'object' || d.gather === null || typeof d.gather.points !== 'object' || d.gather.points === null)) {
    d.gather = { points: {}, honey: {} };
    repairs.push('采集记录无效，已重置');
  } else if (d.gather && (typeof d.gather.honey !== 'object' || d.gather.honey === null)) d.gather.honey = {};
  if (d.farm !== undefined && (typeof d.farm !== 'object' || d.farm === null || typeof d.farm.plots !== 'object' || d.farm.plots === null)) {
    d.farm = { plots: {} };
    repairs.push('田地记录无效，已重置');
  }
  if (d.blocks !== undefined) {
    const ok = (b: unknown): boolean => {
      const x = b as { uid?: unknown; kind?: unknown; level?: unknown; smooth?: unknown; flavor?: unknown };
      return !!x && typeof x.uid === 'string' && typeof x.kind === 'string' && typeof x.level === 'number' && typeof x.smooth === 'number' && typeof x.flavor === 'object' && x.flavor !== null;
    };
    if (!Array.isArray(d.blocks)) {
      d.blocks = [];
      repairs.push('方块盒无效，已重置');
    } else if (!d.blocks.every(ok)) {
      d.blocks = d.blocks.filter(ok);
      repairs.push('方块盒里有损坏的方块，已移除');
    }
  }
  if (d.lure !== undefined && (typeof d.lure !== 'object' || d.lure === null || typeof d.lure.until !== 'number')) d.lure = undefined;
  if (d.breeder !== undefined) {
    const b = d.breeder as { xp?: unknown; daycare?: unknown } | null;
    if (!b || typeof b !== 'object' || typeof b.xp !== 'number' || !Array.isArray(b.daycare)) {
      d.breeder = { xp: typeof b?.xp === 'number' ? b.xp : 0, daycare: [] };
      repairs.push('培育家记录无效，已重置');
    } else {
      const ok = (x: unknown) => {
        const v = x as { mon?: { speciesId?: unknown }; since?: unknown; level0?: unknown };
        return !!v && typeof v.since === 'number' && typeof v.level0 === 'number' && !!v.mon && typeof v.mon.speciesId === 'number';
      };
      if (!(b.daycare as unknown[]).every(ok)) {
        d.breeder.daycare = (b.daycare as unknown[]).filter(ok) as typeof d.breeder.daycare;
        repairs.push('培育屋记录有损坏，已移除');
      }
    }
  }
  repairPins(d);
  d.settings = { ...defaultSettings(), ...(d.settings ?? {}) };
  return repairs;
}
