/**
 * 生成数据（src/config/data/*.json）的类型定义。
 * 由 scripts/fetch-data.ts 写出，由 systems/ 各模块通过 Dex 读取。
 */

export type TypeId =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting' | 'poison' | 'ground'
  | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

/** 六项能力值 */
export type BaseStatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
/** 含命中 / 闪避（能力阶用） */
export type StatId = BaseStatId | 'acc' | 'eva';

export type StatTable = Record<BaseStatId, number>;

export interface LocalizedName {
  en: string;
  zh: string;
}

export type GrowthRate = 'slow' | 'medium' | 'fast' | 'medium-slow' | 'slow-then-very-fast' | 'fast-then-very-slow';

export interface EvolutionData {
  to: number;
  trigger: string; // 'level-up' | 'use-item' | 'trade' | ...
  minLevel?: number | undefined;
  item?: string | undefined;
  heldItem?: string | undefined;
  timeOfDay?: string | undefined;
  minHappiness?: number | undefined;
  knownMoveType?: string | undefined;
  gender?: number | undefined;
}

export interface LearnsetEntry {
  level: number;
  move: string;
}

export interface SpeciesData {
  id: number;
  key: string;
  name: LocalizedName;
  genus: LocalizedName;
  types: TypeId[];
  baseStats: StatTable;
  abilities: { id: string; hidden: boolean; slot: number }[];
  captureRate: number;
  baseExp: number;
  growthRate: GrowthRate;
  /** 雌性比例 /8；-1 为无性别 */
  genderRate: number;
  baseHappiness: number;
  evYield: StatTable;
  heightM: number;
  weightKg: number;
  color: string;
  evolvesFrom: number | null;
  evolutions: EvolutionData[];
  learnset: LearnsetEntry[];
  learnsetVersion: string;
  flavor: string;
  /** 同版本组可用招式学习器学会的招式（scripts/augment-moves.ts） */
  machineMoves?: string[];
  /** 教学招式 */
  tutorMoves?: string[];
  /** 蛋招式 */
  eggMoves?: string[];
}

export type MoveCategory = 'physical' | 'special' | 'status';

export interface MoveMeta {
  /** PokeAPI move-meta-category：damage / ailment / net-good-stats / heal / damage+ailment / swagger / damage+lower / damage+raise / damage+heal / ohko / whole-field-effect / field-effect / force-switch / unique */
  category: string;
  ailment: string;
  ailmentChance: number;
  critRate: number;
  drain: number;
  flinchChance: number;
  healing: number;
  minHits: number | null;
  maxHits: number | null;
  minTurns: number | null;
  maxTurns: number | null;
  statChance: number;
}

export interface MoveData {
  id: string;
  num: number;
  name: LocalizedName;
  type: TypeId;
  category: MoveCategory;
  power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  effectChance: number | null;
  meta: MoveMeta;
  statChanges: { stat: StatId; change: number }[];
  flags: { contact: boolean };
  shortEffect: string;
}

export interface TypeChartData {
  types: TypeId[];
  names: Record<string, string>;
  /** chart[攻击属性][防御属性] = 倍率 */
  chart: Record<string, Record<string, number>>;
}

export interface AbilityData {
  id: string;
  name: LocalizedName;
  shortEffect: string;
}

export interface ItemData {
  id: string;
  name: LocalizedName;
  category: string;
  cost: number;
  flingPower: number | null;
  shortEffect: string;
}

export interface NatureData {
  id: string;
  name: LocalizedName;
  plus: StatId | null;
  minus: StatId | null;
}
