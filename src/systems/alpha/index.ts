/**
 * 头目宝可梦（2026-10-03 计划文档 §3）：纯逻辑，不依赖 three / 场景，可单测。
 *
 * 两类头目：
 *  - 巢穴头目（den）：每个野区 1–2 个固定巢穴（config/islands/*.alphaDens）。首次进入即存在；
 *    击败或捕获后按「游戏内天数」冷却 3 天再出现；可附加出现条件（时段 / 天气，任一满足即可）。
 *    体型 ×1.8、3 项个体值 31 其余 ≥ 20、携带 1 个头目招式；战斗开场双防 +1，第一次 HP 低于一半时咆哮攻击 +1。
 *  - 游荡头目（roaming）：野区普通刷新时以 0.4% 概率出现，每岛同时最多 1 只；等级 = 区域上限 + 4，
 *    体型 ×1.5、2 项 31 其余 ≥ 15；战斗开场双防 +1。
 *
 * 存档：GameState.alpha = { [denId]: AlphaDenRecord }（缺省 = 从未遭遇，旧存档无需迁移）。
 */
import type { Dex } from '../data/Dex';
import type { StatTable } from '../data/types';
import { createPokemon, type PokemonInstance } from '../pokemon/Pokemon';
import type { Rng } from '../rng';

export type AlphaKind = 'den' | 'roaming';

/** 击败 / 捕获后的冷却（游戏内天数） */
export const DEN_COOLDOWN_DAYS = 3;
/** 游荡头目：每次普通刷新判定的出现概率 */
export const ROAMING_CHANCE = 0.004;
/** 游荡头目：等级 = 区域等级上限 + 4 */
export const ROAMING_LEVEL_BONUS = 4;
/** 游荡头目：多久没遭遇就离开（现实秒） */
export const ROAMING_LIFETIME_S = 30 * 60;
/** 体型倍率 */
export const ALPHA_SCALE: Record<AlphaKind, number> = { den: 1.8, roaming: 1.5 };
/** 领地行为（米）：进入警告圈咆哮、进入冲锋圈主动冲锋、离开巢穴超过 leash 返回 */
export const TERRITORY = { warn: 25, charge: 15, leash: 40 } as const;
/** 头目专属素材 */
export const ALPHA_MATERIAL = 'alpha-scale';

/** 时段 / 天气（与 systems/encounters 的 TimeOfDay / FieldWeather 取值一致，这里不引入以免循环依赖） */
export type AlphaTime = 'day' | 'night';
export type AlphaWeather = 'clear' | 'rain' | 'storm' | 'fog' | 'snow' | 'sandstorm';

/** 巢穴场景主题（world/props/alphaDens 按主题建模；缺省按头目属性推断） */
export type AlphaDenTheme = 'nest' | 'whirlpool' | 'seacliff' | 'shadow' | 'rock' | 'mudflat';

export interface AlphaDenDef {
  id: string;
  /** 巢穴名（地图提示 / 接近提示） */
  name: string;
  speciesId: number;
  level: number;
  /** 世界坐标 [x, z] */
  position: [number, number];
  /** 巢穴半径（米）：头目在此范围内踱步 */
  radius: number;
  /** 所在区域 id */
  zone: string;
  /** 头目招式在内的完整招式表（缺省按等级学招 + 不加头目招式） */
  moves?: string[];
  /** 出现条件：time / weather 任一满足即可；缺省 = 随时 */
  when?: { time?: AlphaTime; weather?: AlphaWeather[] };
  /** 条件说明（地图提示） */
  whenText?: string;
  /** 巢穴场景主题 */
  theme?: AlphaDenTheme;
}

export interface AlphaDenRecord {
  /** 最近一次击败 / 捕获的游戏日 */
  defeatedDay?: number;
  /** 捕获过（图鉴 / 统计） */
  caught?: boolean;
  /** 已领取首次奖励 */
  firstClear?: boolean;
  /** 玩家到过巢穴附近（地图上显示物种而不是「？」） */
  discovered?: boolean;
}

export type AlphaDenStatus = 'ready' | 'cooldown' | 'waiting';

/** 冷却剩余天数（0 = 已冷却完） */
export function denCooldownLeft(rec: AlphaDenRecord | undefined, day: number): number {
  if (rec?.defeatedDay === undefined) return 0;
  return Math.max(0, DEN_COOLDOWN_DAYS - (day - rec.defeatedDay));
}

export function denConditionMet(den: AlphaDenDef, time: AlphaTime, weather: string): boolean {
  const w = den.when;
  if (!w || (!w.time && !w.weather?.length)) return true;
  if (w.time && w.time === time) return true;
  if (w.weather?.includes(weather as AlphaWeather)) return true;
  return false;
}

/** ready = 现在就在巢穴；cooldown = 冷却中；waiting = 冷却完但条件不满足 */
export function denStatus(den: AlphaDenDef, rec: AlphaDenRecord | undefined, day: number, time: AlphaTime, weather: string): AlphaDenStatus {
  if (denCooldownLeft(rec, day) > 0) return 'cooldown';
  return denConditionMet(den, time, weather) ? 'ready' : 'waiting';
}

/** 头目个体值：perfect 项为 31（随机选取，不含重复），其余在 [floor, 31] */
export function alphaIvs(rng: Rng, perfect: number, floor: number): StatTable {
  const keys: (keyof StatTable)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const pool = [...keys];
  const top = new Set<keyof StatTable>();
  while (top.size < Math.min(6, perfect)) {
    const i = rng.int(0, pool.length - 1);
    top.add(pool[i]!);
    pool.splice(i, 1);
  }
  const out = {} as StatTable;
  for (const k of keys) out[k] = top.has(k) ? 31 : rng.int(floor, 31);
  return out;
}

export function denAlpha(dex: Dex, den: AlphaDenDef, rng: Rng, meta?: PokemonInstance['metAt']): PokemonInstance {
  const p = createPokemon(dex, den.speciesId, den.level, rng, {
    alpha: true,
    abilitySlot: 'random',
    ivs: alphaIvs(rng, 3, 20),
    ...(den.moves ? { moves: den.moves } : {}),
    ...(meta ? { metAt: meta } : {}),
  });
  p.alphaKind = 'den';
  return p;
}

/** 把一只已生成的野生个体升级为游荡头目（等级 = 区域上限 + 4） */
export function makeRoaming(dex: Dex, base: PokemonInstance, zoneMaxLevel: number, rng: Rng): PokemonInstance {
  const level = Math.min(100, Math.max(base.level, zoneMaxLevel + ROAMING_LEVEL_BONUS));
  const p = createPokemon(dex, base.speciesId, level, rng, {
    alpha: true,
    abilitySlot: 'random',
    shiny: base.shiny,
    ivs: alphaIvs(rng, 2, 15),
    ...(base.metAt ? { metAt: { ...base.metAt, level } } : {}),
  });
  p.alphaKind = 'roaming';
  return p;
}

/** 体型倍率（旧存档里没有 alphaKind 的头目按游荡头目处理） */
export function alphaScale(p: Pick<PokemonInstance, 'alpha' | 'alphaKind'>): number {
  if (!p.alpha) return 1;
  return ALPHA_SCALE[p.alphaKind ?? 'roaming'];
}

export interface AlphaReward {
  money: number;
  items: Record<string, number>;
  firstClear: boolean;
}

/** 随机掉落（之后每次击败 / 游荡头目） */
const DROPS: { id: string; w: number }[] = [
  { id: 'super-potion', w: 30 },
  { id: 'great-ball', w: 25 },
  { id: 'full-heal', w: 15 },
  { id: 'sitrus-berry', w: 12 },
  { id: 'reroll-stone', w: 10 },
  { id: 'bottle-cap', w: 3 },
  { id: 'revive', w: 5 },
  // 想起招式的费用（计划文档 §6）
  { id: 'heart-scale', w: 15 },
];

export function rollDrop(rng: Rng): string {
  const total = DROPS.reduce((s, d) => s + d.w, 0);
  let x = rng.next() * total;
  for (const d of DROPS) {
    x -= d.w;
    if (x < 0) return d.id;
  }
  return DROPS[0]!.id;
}

/**
 * 巢穴头目奖励：首次 = 头目之鳞 ×3 + 心之鳞片 + 该巢穴的招式学习器（firstTm）+ 高额奖金；
 * 之后 = 头目之鳞 ×1 + 随机道具
 */
export function denReward(level: number, rec: AlphaDenRecord | undefined, rng: Rng, firstTm?: string, denMaterial?: string): AlphaReward {
  const first = !rec?.firstClear;
  const mat = (n: number): Record<string, number> => (denMaterial ? { [denMaterial]: n } : {});
  if (first) return { money: level * 120 + 2000, items: { [ALPHA_MATERIAL]: 3, ...mat(2), 'heart-scale': 1, ...(firstTm ? { [firstTm]: 1 } : {}) }, firstClear: true };
  const drop = rollDrop(rng);
  return { money: level * 120, items: { [ALPHA_MATERIAL]: 1, ...mat(1), [drop]: 1 }, firstClear: false };
}

/** 游荡头目奖励：金钱 + 随机道具 */
export function roamingReward(level: number, rng: Rng): AlphaReward {
  return { money: level * 80, items: { [rollDrop(rng)]: 1 }, firstClear: false };
}

/** 结算巢穴记录（击败或捕获） */
export function settleDen(rec: AlphaDenRecord | undefined, day: number, captured: boolean): AlphaDenRecord {
  return { ...rec, defeatedDay: day, caught: !!rec?.caught || captured, firstClear: true, discovered: true };
}

/** 战斗开场 / 半血咆哮的能力变化 */
export const ALPHA_BATTLE = {
  opening: [
    { stat: 'def', delta: 1 },
    { stat: 'spd', delta: 1 },
  ],
  enrage: { stat: 'atk', delta: 1 },
} as const;
