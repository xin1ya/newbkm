/**
 * 计划文档 §9.2 · 野外采集（纯逻辑，单测覆盖）：
 * - 可采条件：刷新（树果树 1–3 天重新结果 / 草药·蘑菇·贝壳·蜂蜜每日 / 矿点 2 天）、潮汐（贝壳只在退潮时露出）、
 *   碎岩（矿点）、夜晚（异奇果只在夜里成熟）；
 * - 掉落：按种类掷骰；蘑菇夜晚 / 雾天产量翻倍；跟随宝可梦协助（草系采草药 +1、岩石 / 格斗系采矿 +1）；
 * - 嗅觉好的跟随宝可梦（蛇纹熊 / 直冲熊 / 尾立 / 大尾立）每天随机「捡到」一件道具；
 * - 蜂蜜树：涂上甜甜蜜 6 小时后吸引稀有宝可梦；
 * - 存档：state.gather 只记录每个采集点上次采集的游戏日（与重新结果天数），离线期间按游戏日自然结算。
 */
import type { Rng } from '../rng';
import type { GameState } from '../state';
import { addItem, removeItem } from '../state';

export type GatherKind = 'berryTree' | 'herb' | 'shell' | 'mushroom' | 'ore' | 'honey';

export interface GatherPointDef {
  id: string;
  kind: GatherKind;
  /** 世界坐标 [x, z] */
  position: [number, number];
  zone: string;
  /** 树果树结的树果 */
  berry?: string;
}

export interface GatherRecord {
  /** 上次采集的游戏日 */
  day: number;
  /** 树果树：采摘后重新结果需要的天数（1–3） */
  regrow?: number;
}

export interface GatherState {
  points: Record<string, GatherRecord>;
  /** 蜂蜜树：涂蜜时的游戏总分钟数 */
  honey: Record<string, number>;
  /** 跟随宝可梦上次「捡到」道具的游戏日 */
  sniffDay?: number;
}

export interface GatherContext {
  day: number;
  /** 0–23.99 */
  hour: number;
  weather: string;
  flags: Readonly<Record<string, boolean>>;
  /** 跟随宝可梦的属性（没有跟随时为空） */
  followerTypes: readonly string[];
}

export interface ItemStack {
  id: string;
  qty: number;
}

export interface GatherRoll {
  items: ItemStack[];
  /** 跟随宝可梦协助的额外数量（已计入 items） */
  assist: number;
  /** 夜晚 / 雾天加成（蘑菇） */
  doubled: boolean;
}

export const KIND_ZH: Record<GatherKind, string> = { berryTree: '树果树', herb: '草药丛', shell: '贝壳滩', mushroom: '蘑菇圈', ore: '矿点', honey: '蜂蜜树' };
export const KIND_ACTION: Record<GatherKind, string> = { berryTree: '摘树果', herb: '采草药', shell: '捡贝壳', mushroom: '采蘑菇', ore: '碎岩采矿', honey: '采蜂蜜' };
export const ROCK_SMASH_FLAG = 'hm05-rock-smash';
/** 退潮时段：早 5–8 点、傍晚 17–20 点 */
export const LOW_TIDE: ReadonlyArray<[number, number]> = [
  [5, 8],
  [17, 20],
];
export const ORE_RESPAWN_DAYS = 2;
export const HONEY_WAIT_MINUTES = 360;
export const NIGHT_ONLY_BERRIES = new Set(['wiki-berry']);
export const EVOLUTION_STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone'];
/** 嗅觉好的宝可梦：尾立、大尾立、蛇纹熊、直冲熊 */
export const SNIFFERS = new Set([161, 162, 263, 264]);
export const SNIFF_ITEMS: ReadonlyArray<[string, number]> = [
  ['oran-berry', 20],
  ['potion', 16],
  ['poke-ball', 14],
  ['medicinal-herb', 14],
  ['razz-berry', 10],
  ['seashell', 8],
  ['honey', 6],
  ['super-potion', 6],
  ['pearl', 3],
  ['heart-scale', 2],
  ['bottle-cap', 1],
];

export function emptyGather(): GatherState {
  return { points: {}, honey: {} };
}

/** 读档兼容：缺省 / 损坏时重建 */
export function gatherState(s: GameState): GatherState {
  const g = s.gather;
  if (!g || typeof g !== 'object' || typeof g.points !== 'object' || g.points === null) {
    s.gather = emptyGather();
    return s.gather;
  }
  if (typeof g.honey !== 'object' || g.honey === null) g.honey = {};
  return g;
}

export const isNight = (hour: number): boolean => hour < 6 || hour >= 19;
export const isLowTide = (hour: number): boolean => LOW_TIDE.some(([a, b]) => hour >= a && hour < b);

/** 稳定散列（采集点 id + 游戏日 → 0–1），用于重新结果天数，保证同一天结果一致 */
export function hash01(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 树果树采摘后重新结果的天数：1–3 */
export function regrowDays(id: string, day: number): number {
  return 1 + Math.floor(hash01(id, day * 7919) * 3);
}

/** 距离下次可采还有几天（0 = 已刷新） */
export function daysUntilReady(def: GatherPointDef, rec: GatherRecord | undefined, day: number): number {
  if (!rec) return 0;
  const wait = def.kind === 'berryTree' ? (rec.regrow ?? 1) : def.kind === 'ore' ? ORE_RESPAWN_DAYS : 1;
  return Math.max(0, rec.day + wait - day);
}

export type Availability = { ok: true } | { ok: false; reason: 'regrow' | 'tide' | 'tool' | 'night'; hint: string };

export function availability(def: GatherPointDef, rec: GatherRecord | undefined, ctx: GatherContext): Availability {
  if (def.kind === 'ore' && !ctx.flags[ROCK_SMASH_FLAG]) return { ok: false, reason: 'tool', hint: '岩石里嵌着闪亮的矿石……需要「碎岩」才能敲开。' };
  const wait = daysUntilReady(def, rec, ctx.day);
  if (wait > 0) {
    const hint: Record<GatherKind, string> = {
      berryTree: wait === 1 ? '树果都摘光了，明天应该会重新结果。' : `树果都摘光了，大约 ${wait} 天后会重新结果。`,
      herb: '能用的药草已经采完了，明天再来吧。',
      shell: '能捡的贝壳已经捡完了，明天退潮时再来吧。',
      mushroom: '蘑菇已经采完了，明天会冒出新的。',
      ore: wait === 1 ? '矿石已经敲完了，明天再来看看。' : `矿石已经敲完了，${wait} 天后再来看看。`,
      honey: '蜂巢里的蜜已经取过了，明天再来吧。',
    };
    return { ok: false, reason: 'regrow', hint: hint[def.kind] };
  }
  if (def.kind === 'shell' && !isLowTide(ctx.hour)) return { ok: false, reason: 'tide', hint: '涨潮了，贝壳都被海水盖住了。退潮时（早上 5–8 点、傍晚 5–8 点）再来吧。' };
  if (def.kind === 'berryTree' && def.berry && NIGHT_ONLY_BERRIES.has(def.berry) && !isNight(ctx.hour)) {
    return { ok: false, reason: 'night', hint: '枝头挂着青涩的果实……听说它只在夜里成熟。' };
  }
  return { ok: true };
}

const push = (out: ItemStack[], id: string, qty: number): void => {
  if (qty <= 0) return;
  const s = out.find((o) => o.id === id);
  if (s) s.qty += qty;
  else out.push({ id, qty });
};

/** 掷骰掉落（不修改存档） */
export function rollGather(def: GatherPointDef, ctx: GatherContext, rng: Rng): GatherRoll {
  const items: ItemStack[] = [];
  let assist = 0;
  let doubled = false;
  const t = ctx.followerTypes;
  switch (def.kind) {
    case 'berryTree':
      push(items, def.berry ?? 'oran-berry', rng.int(1, 4));
      break;
    case 'herb':
      push(items, 'medicinal-herb', rng.int(1, 3));
      if (rng.chance(0.25)) push(items, 'fragrant-herb', 1);
      if (t.includes('grass')) {
        assist = 1;
        push(items, 'medicinal-herb', 1);
      }
      break;
    case 'shell':
      push(items, 'seashell', rng.int(1, 3));
      if (rng.chance(0.12)) push(items, 'pearl', 1);
      if (rng.chance(0.04)) push(items, 'heart-scale', 1);
      break;
    case 'mushroom': {
      doubled = isNight(ctx.hour) || ctx.weather === 'fog';
      const k = doubled ? 2 : 1;
      push(items, 'tiny-mushroom', rng.int(1, 2) * k);
      if (rng.chance(0.15)) push(items, 'big-mushroom', k);
      if (isNight(ctx.hour) && rng.chance(0.6)) push(items, 'glow-mushroom', k);
      break;
    }
    case 'ore':
      push(items, 'gravel', rng.int(1, 3));
      if (rng.chance(0.3)) push(items, 'hard-ore', 1);
      if (rng.chance(0.06)) push(items, rng.pick(EVOLUTION_STONES), 1);
      if (t.includes('rock') || t.includes('fighting')) {
        assist = 1;
        push(items, 'gravel', 1);
      }
      break;
    case 'honey':
      push(items, 'honey', rng.chance(0.35) ? 2 : 1);
      break;
  }
  return { items, assist, doubled };
}

/** 采集：检查条件 → 掷骰 → 放进背包 → 记录游戏日 */
export function gather(s: GameState, def: GatherPointDef, ctx: GatherContext, rng: Rng): ({ ok: true } & GatherRoll) | { ok: false; hint: string } {
  const g = gatherState(s);
  const a = availability(def, g.points[def.id], ctx);
  if (!a.ok) return { ok: false, hint: a.hint };
  const r = rollGather(def, ctx, rng);
  for (const it of r.items) addItem(s, it.id, it.qty);
  g.points[def.id] = def.kind === 'berryTree' ? { day: ctx.day, regrow: regrowDays(def.id, ctx.day) } : { day: ctx.day };
  return { ok: true, ...r };
}

// ———————————————————— 蜂蜜树 ————————————————————

export type HoneyStatus = { state: 'none' } | { state: 'waiting'; minutesLeft: number } | { state: 'ready' };

export function honeyStatus(s: GameState, def: GatherPointDef, totalMinutes: number): HoneyStatus {
  const at = gatherState(s).honey[def.id];
  if (at === undefined) return { state: 'none' };
  const left = at + HONEY_WAIT_MINUTES - totalMinutes;
  return left > 0 ? { state: 'waiting', minutesLeft: left } : { state: 'ready' };
}

/** 涂甜甜蜜（消耗 1 个）；已经涂过时返回 false */
export function slatherHoney(s: GameState, def: GatherPointDef, totalMinutes: number): boolean {
  if (def.kind !== 'honey') return false;
  const g = gatherState(s);
  if (g.honey[def.id] !== undefined) return false;
  if (!removeItem(s, 'honey', 1)) return false;
  g.honey[def.id] = totalMinutes;
  return true;
}

/** 蜂蜜吸引来的宝可梦战斗开始时清除涂蜜记录 */
export function consumeHoney(s: GameState, def: GatherPointDef): void {
  delete gatherState(s).honey[def.id];
}

export interface HoneySlot {
  speciesId: number;
  level: [number, number];
  weight: number;
  time?: 'day' | 'night';
}

/** 蜂蜜树吸引的宝可梦（只用已有模型的物种；稀有的皮卡丘 / 皮丘 / 雨翅蛾） */
export const HONEY_TABLE: readonly HoneySlot[] = [
  { speciesId: 12, level: [12, 15], weight: 22, time: 'day' },
  { speciesId: 46, level: [11, 14], weight: 20 },
  { speciesId: 43, level: [11, 14], weight: 18, time: 'night' },
  { speciesId: 163, level: [12, 15], weight: 18, time: 'night' },
  { speciesId: 284, level: [14, 16], weight: 8 },
  { speciesId: 25, level: [12, 15], weight: 6, time: 'day' },
  { speciesId: 172, level: [8, 10], weight: 6 },
];

export function rollHoney(rng: Rng, hour: number): { speciesId: number; level: number } {
  const night = isNight(hour);
  const pool = HONEY_TABLE.filter((s) => !s.time || (s.time === 'night') === night);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let r = rng.next() * total;
  let slot = pool[pool.length - 1]!;
  for (const s of pool) {
    r -= s.weight;
    if (r < 0) {
      slot = s;
      break;
    }
  }
  return { speciesId: slot.speciesId, level: rng.int(slot.level[0], slot.level[1]) };
}

// ———————————————————— 跟随宝可梦「捡到」 ————————————————————

/** 嗅觉好的跟随宝可梦每天捡到一件道具（每个游戏日一次；返回 null 表示今天已经捡过或不是这类宝可梦） */
export function sniffPickup(s: GameState, followerSpecies: number | null, day: number, rng: Rng): string | null {
  if (followerSpecies === null || !SNIFFERS.has(followerSpecies)) return null;
  const g = gatherState(s);
  if (g.sniffDay !== undefined && g.sniffDay >= day) return null;
  g.sniffDay = day;
  const total = SNIFF_ITEMS.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  let id = SNIFF_ITEMS[0]![0];
  for (const [it, w] of SNIFF_ITEMS) {
    r -= w;
    if (r < 0) {
      id = it;
      break;
    }
  }
  addItem(s, id, 1);
  return id;
}
