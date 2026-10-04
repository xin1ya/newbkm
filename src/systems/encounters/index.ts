/**
 * SYS-007 · 遇敌表抽取（时段 / 天气 / 等级范围 / 刷新形态）+ 道馆动态等级档位（设计 §5）。
 */
import type { Dex } from '../data/Dex';
import type { TypeId } from '../data/types';
import type { PokemonInstance } from '../pokemon/Pokemon';
import { createPokemon } from '../pokemon/Pokemon';
import { fixedIvs } from '../pokemon/stats';
import { alphaIvs } from '../alpha';
import type { Rng } from '../rng';
import type { Flavor } from '@/config/berries';
import { lureWeight } from '../blocks';

export type TimeOfDay = 'day' | 'night';
export type FieldWeather = 'clear' | 'rain' | 'fog' | 'snow' | 'storm' | 'sandstorm' | 'anomaly';
export type EncounterMethod = 'visible' | 'grass' | 'surf' | 'fish' | 'cave';
export type Formation = 'single' | 'group' | 'rare';
export type Temperament = 'timid' | 'curious' | 'aggressive' | 'sleepy' | 'calm';

export interface EncounterEntry {
  speciesId: number;
  weight: number;
  levels: [number, number];
  time?: TimeOfDay | 'any';
  /** 只在这些天气出现；省略 = 任何天气 */
  weather?: FieldWeather[];
  formation?: Formation;
  groupSize?: [number, number];
  /** 省略 = 可见遇敌与暗雷都可以 */
  methods?: EncounterMethod[];
}

export interface EncounterTable {
  id: string;
  entries: EncounterEntry[];
  /** 可见遇敌：玩家周围维持的数量（设计 §5.2，通常 6–12） */
  density: [number, number];
  /** 头目个体概率 */
  alphaChance: number;
  /** 异色概率 */
  shinyChance: number;
  /** 暗雷：每移动 1 米的遇敌概率 */
  grassRatePerMeter?: number;
}

export const DEFAULT_SHINY_CHANCE = 1 / 4096;
export const ALPHA_LEVEL_BONUS = 5;

export interface EncounterContext {
  time: TimeOfDay;
  weather: FieldWeather;
  method: EncounterMethod;
  /** 能量方块诱饵的口味（计划文档 §9.5）：偏好该口味的物种权重 ×3 */
  lure?: Flavor | null | undefined;
}

export interface RolledEncounter {
  speciesId: number;
  level: number;
  shiny: boolean;
  alpha: boolean;
  formation: Formation;
  count: number;
}

/** 天气对属性的权重加成（设计 §4.5：雨天水系增多等） */
export const WEATHER_TYPE_BOOST: Partial<Record<FieldWeather, Partial<Record<TypeId, number>>>> = {
  rain: { water: 1.5, bug: 0.7 },
  storm: { electric: 1.8, water: 1.3, flying: 0.5 },
  snow: { ice: 1.8, fire: 0.6 },
  fog: { ghost: 1.5, psychic: 1.3 },
  sandstorm: { ground: 1.6, rock: 1.6 },
  clear: { fire: 1.1, grass: 1.1 },
  anomaly: { psychic: 1.5, dragon: 1.5 },
};

export function eligibleEntries(table: EncounterTable, ctx: EncounterContext): EncounterEntry[] {
  return table.entries.filter(
    (e) =>
      (e.time === undefined || e.time === 'any' || e.time === ctx.time) &&
      (!e.weather || e.weather.includes(ctx.weather)) &&
      (!e.methods || e.methods.includes(ctx.method)),
  );
}

export function entryWeight(e: EncounterEntry, ctx: EncounterContext, dex?: Dex): number {
  const boost = WEATHER_TYPE_BOOST[ctx.weather];
  if (!dex || !dex.hasSpecies(e.speciesId)) return e.weight;
  const types = dex.species(e.speciesId).types;
  const lure = lureWeight(types, ctx.lure);
  if (!boost) return e.weight * lure;
  // 双属性取加成最明显的一项（>1 取最大，否则取最小）
  const mults = types.map((t) => boost[t] ?? 1);
  const up = Math.max(...mults);
  const down = Math.min(...mults);
  return e.weight * (up > 1 ? up : down) * lure;
}

export function rollEncounter(table: EncounterTable, ctx: EncounterContext, rng: Rng, dex?: Dex): RolledEncounter | null {
  const pool = eligibleEntries(table, ctx);
  if (!pool.length) return null;
  const idx = rng.weighted(pool.map((e) => entryWeight(e, ctx, dex)));
  const e = pool[idx];
  if (!e) return null;
  // 游荡头目（计划文档 §3.2）：从遇敌表抽取，排除群体与稀有条目
  const alpha = (e.formation ?? 'single') === 'single' && rng.chance(table.alphaChance);
  const level = Math.min(100, rng.int(e.levels[0], e.levels[1]) + (alpha ? ALPHA_LEVEL_BONUS : 0));
  const formation = e.formation ?? 'single';
  const count = formation === 'group' ? rng.int(e.groupSize?.[0] ?? 2, e.groupSize?.[1] ?? 4) : 1;
  return { speciesId: e.speciesId, level, shiny: rng.chance(table.shinyChance), alpha, formation, count };
}

/** 暗雷：移动 distance 米后是否触发遇敌 */
export function grassEncounterCheck(table: EncounterTable, distance: number, rng: Rng): boolean {
  const rate = table.grassRatePerMeter ?? 0.06;
  if (distance <= 0) return false;
  return rng.chance(1 - Math.pow(1 - rate, distance));
}

/** 创建野生个体 */
export function createWild(dex: Dex, enc: RolledEncounter, rng: Rng, meta?: PokemonInstance['metAt']): PokemonInstance {
  const opts: Parameters<typeof createPokemon>[4] = { shiny: enc.shiny, alpha: enc.alpha, abilitySlot: 'random' };
  if (meta) opts.metAt = meta;
  if (enc.alpha) opts.ivs = alphaIvs(rng, 2, 15);
  const p = createPokemon(dex, enc.speciesId, enc.level, rng, opts);
  if (enc.alpha) p.alphaKind = 'roaming';
  return p;
}

// ——————————————————— 道馆动态等级（设计 §5.4） ———————————————————

export interface GymMember {
  speciesId: number;
  /** 相对本档基准等级的偏移（王牌通常为 +2） */
  levelOffset: number;
  moves: string[];
  ability?: string;
  heldItem?: string;
  nature?: string;
}

export interface GymDef {
  id: string;
  island: string;
  leader: string;
  type: TypeId;
  badgeFlag: string;
  /** 各档基准等级：按「本岛已获徽章数」选取（0 → 第 1 档） */
  tierLevels: number[];
  /** 各档可额外追加的成员（高档位队伍更完整）；key = 档位下标 */
  extraMembers?: Record<number, GymMember[]>;
  team: GymMember[];
  ivs: number;
  prizeMoney: number;
  items?: { id: string; qty: number }[];
  /** 徽章显示名（缺省「翠澜徽章」） */
  badgeName?: string;
  /** 胜利仪式台词：win = 授予前，effect = 徽章效果与奖励说明 */
  ceremony?: { win: string[]; effect: string[] };
}

/** 本岛已获得的徽章数（不含本道馆） */
export function badgesOnIsland(gyms: readonly GymDef[], island: string, flags: Record<string, boolean>, excludeGymId?: string): number {
  return gyms.filter((g) => g.island === island && g.id !== excludeGymId && flags[g.badgeFlag]).length;
}

export function gymTier(gym: GymDef, islandBadges: number): number {
  return Math.max(0, Math.min(gym.tierLevels.length - 1, islandBadges));
}

export function gymLevelRange(gym: GymDef, tier: number): [number, number] {
  const base = gym.tierLevels[tier] ?? gym.tierLevels[0] ?? 10;
  const members = [...gym.team, ...Object.entries(gym.extraMembers ?? {}).filter(([t]) => Number(t) <= tier).flatMap(([, m]) => m)];
  const offs = members.map((m) => m.levelOffset);
  return [base + Math.min(...offs), base + Math.max(...offs)];
}

export function buildGymTeam(dex: Dex, gym: GymDef, tier: number, rng: Rng): PokemonInstance[] {
  const base = gym.tierLevels[tier] ?? gym.tierLevels[0] ?? 10;
  const extra = Object.entries(gym.extraMembers ?? {})
    .filter(([t]) => Number(t) <= tier)
    .flatMap(([, m]) => m);
  // 追加成员放在王牌之前
  const ace = gym.team[gym.team.length - 1];
  const members = ace ? [...gym.team.slice(0, -1), ...extra, ace] : extra;
  return members.map((m) => {
    const opts: Parameters<typeof createPokemon>[4] = { moves: m.moves, ivs: fixedIvs(gym.ivs), heldItem: m.heldItem ?? null, nature: m.nature ?? 'serious' };
    const p = createPokemon(dex, m.speciesId, Math.max(1, base + m.levelOffset), rng, opts);
    if (m.ability) p.ability = m.ability;
    return p;
  });
}
export * from './flow';
