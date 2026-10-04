/**
 * SYS-004 · 经验与升级、学会招式、进化判定。
 */
import type { Dex } from '../data/Dex';
import type { StatTable } from '../data/types';
import type { PokemonInstance } from '../pokemon/Pokemon';
import { getStats } from '../pokemon/Pokemon';
import { expForLevel, MAX_LEVEL } from '../pokemon/growth';
import { addEvs } from '../pokemon/stats';

export interface ExpGainInput {
  defeatedSpeciesBaseExp: number;
  defeatedLevel: number;
  victorLevel: number;
  /** 训练家的宝可梦 ×1.5 */
  isTrainer: boolean;
  /** 分享经验的参战宝可梦数量 */
  participants: number;
  /** 其他倍率（幸运蛋 1.5、交换来的 1.5 等） */
  multiplier?: number;
}

/** Gen5 按等级差缩放的经验公式 */
export function expGain(i: ExpGainInput): number {
  const a = i.isTrainer ? 1.5 : 1;
  const b = i.defeatedSpeciesBaseExp;
  const L = i.defeatedLevel;
  const Lp = i.victorLevel;
  const s = Math.max(1, i.participants);
  const scaled = ((a * b * L) / (5 * s)) * Math.pow((2 * L + 10) / (L + Lp + 10), 2.5) + 1;
  return Math.max(1, Math.floor(scaled * (i.multiplier ?? 1)));
}

export interface LevelUpRecord {
  level: number;
  before: StatTable;
  after: StatTable;
  /** 自动学会的招式（招式栏未满） */
  learned: string[];
  /** 需要玩家决定是否替换的招式（招式栏已满） */
  pending: string[];
}

/** 某等级新学会的招式（按学招表，去掉已会的） */
export function movesLearnedAt(dex: Dex, p: PokemonInstance, level: number): string[] {
  const sp = dex.species(p.speciesId);
  const known = new Set(p.moves.map((m) => m.id));
  return [...new Set(sp.learnset.filter((e) => e.level === level && !known.has(e.move) && dex.hasMove(e.move)).map((e) => e.move))];
}

export function teachMove(dex: Dex, p: PokemonInstance, moveId: string, replaceIndex?: number): boolean {
  if (p.moves.some((m) => m.id === moveId)) return false;
  const pp = dex.move(moveId).pp;
  const slot = { id: moveId, pp, maxPp: pp };
  if (replaceIndex === undefined) {
    if (p.moves.length >= 4) return false;
    p.moves.push(slot);
    return true;
  }
  if (replaceIndex < 0 || replaceIndex >= p.moves.length) return false;
  p.moves[replaceIndex] = slot;
  return true;
}

/**
 * 增加经验并处理连续升级。HP 按最大值增量同步提高（与正作一致）。
 */
export function gainExp(dex: Dex, p: PokemonInstance, amount: number): LevelUpRecord[] {
  const sp = dex.species(p.speciesId);
  const records: LevelUpRecord[] = [];
  const cap = expForLevel(sp.growthRate, MAX_LEVEL);
  p.exp = Math.min(cap, p.exp + Math.max(0, Math.floor(amount)));
  while (p.level < MAX_LEVEL && p.exp >= expForLevel(sp.growthRate, p.level + 1)) {
    const before = getStats(dex, p);
    p.level++;
    const after = getStats(dex, p);
    if (p.hp > 0) p.hp = Math.min(after.hp, p.hp + (after.hp - before.hp));
    const learned: string[] = [];
    const pending: string[] = [];
    for (const m of movesLearnedAt(dex, p, p.level)) {
      if (teachMove(dex, p, m)) learned.push(m);
      else pending.push(m);
    }
    records.push({ level: p.level, before, after, learned, pending });
  }
  return records;
}

/** 击败后获得努力值（玩家宝可梦） */
export function gainEvs(dex: Dex, p: PokemonInstance, defeatedSpeciesId: number): StatTable {
  return addEvs(p.evs, dex.species(defeatedSpeciesId).evYield);
}

export function expProgress(dex: Dex, p: PokemonInstance): { current: number; needed: number; ratio: number } {
  const sp = dex.species(p.speciesId);
  if (p.level >= MAX_LEVEL) return { current: 0, needed: 0, ratio: 1 };
  const lo = expForLevel(sp.growthRate, p.level);
  const hi = expForLevel(sp.growthRate, p.level + 1);
  return { current: p.exp - lo, needed: hi - lo, ratio: (p.exp - lo) / (hi - lo) };
}

export interface EvolutionContext {
  timeOfDay: 'day' | 'night';
  /** 使用的道具（进化石） */
  usedItem?: string;
}

/**
 * 进化判定：支持 level-up（等级 / 时段 / 亲密度 / 性别 / 已会招式属性）与 use-item。
 * 通信交换进化在单机中改为「持有特定道具升级」以外暂不支持（返回 null）。
 */
export function checkEvolution(dex: Dex, p: PokemonInstance, ctx: EvolutionContext): number | null {
  const sp = dex.species(p.speciesId);
  for (const e of sp.evolutions) {
    if (!dex.hasSpecies(e.to)) continue;
    if (ctx.usedItem) {
      if (e.trigger === 'use-item' && e.item === ctx.usedItem) return e.to;
      continue;
    }
    if (e.trigger === 'trade') {
      // 单机替代：通信交换进化 → 携带「联系绳」升级（需要特定携带物的交换进化仍然携带该道具）
      if (p.heldItem === tradeItemOf(e)) return e.to;
      continue;
    }
    if (e.trigger !== 'level-up') continue;
    if (e.minLevel !== undefined && p.level < e.minLevel) continue;
    if (e.timeOfDay && e.timeOfDay !== ctx.timeOfDay) continue;
    if (e.minHappiness !== undefined && p.friendship < e.minHappiness) continue;
    if (e.gender !== undefined && ((e.gender === 1 && p.gender !== 'female') || (e.gender === 2 && p.gender !== 'male'))) continue;
    if (e.heldItem && p.heldItem !== e.heldItem) continue;
    if (e.knownMoveType && !p.moves.some((m) => dex.move(m.id).type === e.knownMoveType)) continue;
    if (e.minLevel === undefined && e.minHappiness === undefined && !e.timeOfDay && !e.heldItem && !e.knownMoveType) continue;
    return e.to;
  }
  return null;
}

export const LINKING_CORD = 'linking-cord';
/** 交换进化在单机中需要携带的道具 */
export function tradeItemOf(e: { heldItem?: string | undefined }): string {
  return e.heldItem ?? LINKING_CORD;
}

/** 执行进化：更换物种、保持受损量、学会进化招式（学招表 level 0） */
export function evolve(dex: Dex, p: PokemonInstance, to: number): { learned: string[]; pending: string[] } {
  const before = getStats(dex, p);
  const damage = before.hp - p.hp;
  // 通过携带物触发的进化（联系绳 / 交换 + 携带物 / 携带物升级）会消耗该携带物
  const via = dex.species(p.speciesId).evolutions.find((e) => e.to === to && (e.trigger === 'trade' || e.heldItem));
  if (via && p.heldItem === (via.trigger === 'trade' ? tradeItemOf(via) : via.heldItem)) p.heldItem = null;
  p.speciesId = to;
  const sp = dex.species(to);
  if (!sp.abilities.some((a) => a.id === p.ability)) p.ability = sp.abilities[0]?.id ?? p.ability;
  const after = getStats(dex, p);
  p.hp = p.hp > 0 ? Math.max(1, after.hp - damage) : 0;
  const learned: string[] = [];
  const pending: string[] = [];
  const evoMoves = sp.learnset.filter((e) => e.level === 0 || e.level === p.level).map((e) => e.move);
  for (const m of new Set(evoMoves)) {
    if (!dex.hasMove(m) || p.moves.some((x) => x.id === m)) continue;
    if (teachMove(dex, p, m)) learned.push(m);
    else pending.push(m);
  }
  return { learned, pending };
}
