/**
 * 招式学习器兼容表 + 想起招式（计划文档 §6）· 纯逻辑，无 UI。
 */
import type { Dex } from '../data/Dex';
import type { SpeciesData, TypeId } from '../data/types';
import type { PokemonInstance } from '../pokemon';
import type { Rng } from '../rng';

/** TM 定义里规则需要的字段（避免 systems 依赖 config） */
export interface TmRule {
  move: string;
  universal?: boolean;
}

/** 进化家族：从最初形态出发的所有成员（只含数据里存在的物种） */
export function evolutionFamily(species: readonly SpeciesData[], id: number): SpeciesData[] {
  const byId = new Map(species.map((s) => [s.id, s]));
  let root = byId.get(id);
  if (!root) return [];
  while (root.evolvesFrom && byId.has(root.evolvesFrom)) root = byId.get(root.evolvesFrom)!;
  const out: SpeciesData[] = [];
  const stack = [root];
  while (stack.length) {
    const s = stack.pop()!;
    out.push(s);
    for (const e of s.evolutions) {
      const to = byId.get(e.to);
      if (to) stack.push(to);
    }
  }
  return out;
}

/** 前置形态链（不含自己），从近到远 */
export function prevolutions(species: readonly SpeciesData[], id: number): SpeciesData[] {
  const byId = new Map(species.map((s) => [s.id, s]));
  const out: SpeciesData[] = [];
  let cur = byId.get(id);
  while (cur?.evolvesFrom && byId.has(cur.evolvesFrom)) {
    cur = byId.get(cur.evolvesFrom)!;
    out.push(cur);
  }
  return out;
}

/**
 * 兼容规则：universal → 全部；否则进化家族任一成员的学招表里有该招式，或物种属性与招式属性相同。
 * （数据只有升级学招表，没有官方 TM 表；家族共享保证进化前后一致）
 */
export function computeTmCompat(species: readonly SpeciesData[], moveType: string, tm: TmRule): number[] {
  return species
    .filter((s) => tm.universal || s.types.includes(moveType as TypeId) || evolutionFamily(species, s.id).some((f) => f.learnset.some((e) => e.move === tm.move)))
    .map((s) => s.id)
    .sort((a, b) => a - b);
}

// ———————————————————————— 想起招式 ————————————————————————

export const HEART_SCALE = 'heart-scale';
export const RECALL_PRICE = 1000;
/** 野生宝可梦战胜后掉落心之鳞片的概率 */
export const HEART_SCALE_WILD_CHANCE = 0.03;

export interface RecallEntry {
  move: string;
  /** 学会等级（0 = 进化时学会） */
  level: number;
  /** 来自前置形态的学招表（显示「进化前」） */
  fromPrevo: boolean;
}

/**
 * 可想起的招式：当前形态与所有前置形态学招表里、等级 ≤ 当前等级的招式（含进化招式 level 0），
 * 排除已会的、数据里没有的；同一招式取最低等级、优先当前形态。按等级 → 招式 id 排序。
 */
export function recallableMoves(dex: Dex, p: PokemonInstance): RecallEntry[] {
  const known = new Set(p.moves.map((m) => m.id));
  const all = dex.allSpecies();
  const forms = [{ s: dex.species(p.speciesId), prevo: false }, ...prevolutions(all, p.speciesId).map((s) => ({ s, prevo: true }))];
  const best = new Map<string, RecallEntry>();
  for (const { s, prevo } of forms) {
    for (const e of s.learnset) {
      if (e.level > p.level || known.has(e.move) || !dex.hasMove(e.move)) continue;
      const cur = best.get(e.move);
      if (!cur || (cur.fromPrevo && !prevo) || (cur.fromPrevo === prevo && e.level < cur.level)) best.set(e.move, { move: e.move, level: e.level, fromPrevo: prevo });
    }
  }
  return [...best.values()].sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
}

/** 想起招式的支付方式：优先心之鳞片，其次 1000 円；都不够返回 null */
export type RecallPayment = 'scale' | 'money';
export function recallPayments(bag: Readonly<Record<string, number>>, money: number): RecallPayment[] {
  const out: RecallPayment[] = [];
  if ((bag[HEART_SCALE] ?? 0) > 0) out.push('scale');
  if (money >= RECALL_PRICE) out.push('money');
  return out;
}

/** 野生战胜利后的心之鳞片掉落 */
export function rollWildHeartScale(rng: Rng): boolean {
  return rng.next() < HEART_SCALE_WILD_CHANCE;
}

/** 打倒野生宝可梦获得的少量货币：等级 × 2 + 0…等级 的随机零头（Lv10 ≈ 20–30 円，头目 ×3） */
export function wildPrizeMoney(level: number, rng: Rng, alpha = false): number {
  const lv = Math.max(1, Math.round(level));
  const base = lv * 2 + Math.floor(rng.next() * (lv + 1));
  return alpha ? base * 3 : base;
}
