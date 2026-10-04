/**
 * SYS-011 · 战斗 AI
 *   random：野生宝可梦，随机选择可用招式
 *   basic ：普通训练家，按「预估伤害 × 命中」选招，20% 概率选次优
 *   smart ：馆主，额外考虑免疫 / 吸收特性、击倒线、异常与能力变化招式的时机、
 *           劣势时换人、低血量时用回复药
 */
import type { MoveData } from '../data/types';
import { getAbility } from './abilities';
import { calcDamage } from './damage';
import type { Battle } from './engine';
import { isSelfTargeting, POWDER_MOVES } from './moves';
import { ailmentToStatus } from './status';
import type { BattleAction, BattleMon, SideId } from './types';

/** 特性造成的免疫（AI 视为已知） */
const ABSORB_ABILITIES: Record<string, string> = {
  'water-absorb': 'water',
  'volt-absorb': 'electric',
  'lightning-rod': 'electric',
  'storm-drain': 'water',
  'motor-drive': 'electric',
  'sap-sipper': 'grass',
  'flash-fire': 'fire',
  levitate: 'ground',
};

export interface MoveScore {
  index: number;
  id: string;
  score: number;
}

export function scoreMoves(b: Battle, side: SideId): MoveScore[] {
  const me = b.active(side);
  const foe = b.foeOf(me);
  const level = b.sides[side].trainer?.ai ?? 'random';
  const out: MoveScore[] = [];
  for (const opt of b.moveOptions(me)) {
    if (opt.disabled) continue;
    const move = b.dex.move(opt.id);
    const score = level === 'random' ? 1 : move.category === 'status' ? scoreStatusMove(b, me, foe, move, level === 'smart') : scoreDamagingMove(b, me, foe, move, level === 'smart');
    out.push({ index: opt.index, id: opt.id, score });
  }
  return out;
}

function scoreDamagingMove(b: Battle, me: BattleMon, foe: BattleMon, move: MoveData, smart: boolean): number {
  const eff = b.dex.effectiveness(move.type, b.types(foe));
  if (eff === 0) return 0;
  if (smart && ABSORB_ABILITIES[foe.pokemon.ability] === move.type) return 0;
  if (smart && move.id === 'sucker-punch') return 5;
  const est = calcDamage(b, {
    user: me,
    target: foe,
    move,
    basePower: move.power || 60,
    type: move.type,
    crit: false,
    targetSide: b.sides[foe.side],
    roll: 0.925,
  }).damage;
  const acc = (move.accuracy ?? 100) / 100;
  const ratio = Math.min(1, est / Math.max(1, foe.pokemon.hp));
  let score = ratio * 100 * acc;
  if (smart && est >= foe.pokemon.hp) score += 60 * acc + move.priority * 20; // 击倒线（优先度高的更好）
  if (move.meta.drain < 0 && smart) score *= 0.9;
  if (move.meta.category === 'damage-raise' && move.statChanges.some((s) => s.change < 0)) score *= 0.9;
  return Math.max(1, score);
}

function scoreStatusMove(b: Battle, me: BattleMon, foe: BattleMon, move: MoveData, smart: boolean): number {
  const m = move.meta;
  const hpRatio = me.pokemon.hp / b.maxHp(me);
  const foeHpRatio = foe.pokemon.hp / b.maxHp(foe);
  const acc = (move.accuracy ?? 100) / 100;
  if (POWDER_MOVES.has(move.id) && b.types(foe).includes('grass')) return 0;
  switch (m.category) {
    case 'ailment': {
      const st = ailmentToStatus(m.ailment, move.id);
      if (st) {
        if (foe.pokemon.status) return 0;
        if (move.id === 'thunder-wave' && b.dex.effectiveness('electric', b.types(foe)) === 0) return 0;
        if (smart && getAbility(foe.pokemon.ability).blocksStatus?.(b, foe, st)) return 0;
        const base = st === 'slp' ? 70 : st === 'par' ? 55 : st === 'tox' ? 60 : st === 'brn' ? 50 : 40;
        return base * acc * (foeHpRatio > 0.5 ? 1 : 0.5);
      }
      if (m.ailment === 'confusion') return foe.v.confusion > 0 ? 0 : 35 * acc;
      return 15;
    }
    case 'net-good-stats': {
      const self = isSelfTargeting(move);
      const target = self ? me : foe;
      const total = move.statChanges.reduce((a, s) => a + (target.stages[s.stat] * Math.sign(s.change) >= 4 ? 0 : 1), 0);
      if (!total) return 0;
      if (self) return hpRatio > 0.6 ? 45 : 10; // 血量健康时才强化
      return foeHpRatio > 0.5 ? 25 * acc : 8;
    }
    case 'heal':
      return hpRatio < 0.4 ? 90 : hpRatio < 0.7 ? 30 : 0;
    case 'swagger':
      return foe.v.confusion > 0 ? 0 : 20;
    default:
      if (['rain-dance', 'sunny-day', 'sandstorm', 'hail'].includes(move.id)) {
        const w = { 'rain-dance': 'rain', 'sunny-day': 'sun', sandstorm: 'sand', hail: 'hail' }[move.id];
        if (b.weather === w) return 0;
        const myTypes = b.types(me);
        const helps = (w === 'rain' && myTypes.includes('water')) || (w === 'sun' && myTypes.includes('fire'));
        return helps ? 50 : 10;
      }
      if (move.id === 'protect' || move.id === 'detect') return me.v.protectStreak > 0 ? 0 : smart && me.pokemon.status?.kind !== undefined ? 5 : 12;
      if (move.id === 'rest') return hpRatio < 0.35 ? 70 : 0;
      if (move.id === 'splash') return 0;
      return smart ? 10 : 15;
  }
}

/** 队伍中某成员对当前对手的对位得分（越高越好） */
function matchupScore(b: Battle, mon: BattleMon, foe: BattleMon): number {
  const myTypes = b.dex.species(mon.pokemon.speciesId).types;
  const foeTypes = b.types(foe);
  let offense = 0;
  for (const m of mon.pokemon.moves) {
    const mv = b.dex.move(m.id);
    if (mv.category === 'status' || m.pp <= 0) continue;
    offense = Math.max(offense, b.dex.effectiveness(mv.type, foeTypes) * (myTypes.includes(mv.type) ? 1.5 : 1));
  }
  let defense = 0;
  for (const t of foeTypes) defense = Math.max(defense, b.dex.effectiveness(t, myTypes));
  return offense - defense + (mon.pokemon.hp / b.maxHp(mon)) * 0.5;
}

export function chooseAction(b: Battle, side: SideId): BattleAction {
  const me = b.active(side);
  const foe = b.foeOf(me);
  const sideData = b.sides[side];
  const level = sideData.trainer?.ai ?? 'random';
  const scores = scoreMoves(b, side);
  if (!scores.length) return { type: 'move', moveIndex: -1 }; // 挣扎

  if (level === 'random') return { type: 'move', moveIndex: b.rng.pick(scores).index };

  if (level === 'smart') {
    const hpRatio = me.pokemon.hp / b.maxHp(me);
    // 回复药
    const potion = sideData.trainer?.items?.find((i) => i.qty > 0 && ['hyper-potion', 'super-potion', 'potion'].includes(i.id));
    if (potion && hpRatio < 0.25 && me.pokemon.hp > 0 && b.rng.chance(0.8)) {
      return { type: 'item', itemId: potion.id, partyIndex: me.index };
    }
    // 劣势换人：所有招式都很差，且队伍中有明显更好的对位
    const best = Math.max(...scores.map((s) => s.score));
    if (best < 15 && !me.v.bound) {
      const current = matchupScore(b, me, foe);
      let bestIdx = -1;
      let bestScore = current + 1;
      for (const m of b.alive(side)) {
        if (m === me) continue;
        const sc = matchupScore(b, m, foe);
        if (sc > bestScore) {
          bestScore = sc;
          bestIdx = m.index;
        }
      }
      if (bestIdx >= 0) return { type: 'switch', partyIndex: bestIdx };
    }
  }

  const sorted = [...scores].sort((a, c) => c.score - a.score);
  const top = sorted[0] as MoveScore;
  if (level === 'basic' && sorted.length > 1 && b.rng.chance(0.2)) return { type: 'move', moveIndex: (sorted[1] as MoveScore).index };
  // 同分随机
  const ties = sorted.filter((s) => s.score >= top.score - 0.001);
  return { type: 'move', moveIndex: b.rng.pick(ties).index };
}

/** 选择替补（濒死 / U 型回转）；返回 -1 表示无可用 */
export function chooseReplacement(b: Battle, side: SideId, exclude?: number): number {
  const foe = b.active(side === 0 ? 1 : 0);
  const options = b.alive(side).filter((m) => m.index !== b.sides[side].active && m.index !== exclude);
  if (!options.length) return -1;
  const level = b.sides[side].trainer?.ai ?? 'random';
  if (level === 'random' || level === 'basic') return (options[0] as BattleMon).index;
  let best = options[0] as BattleMon;
  let bestScore = -Infinity;
  for (const m of options) {
    const s = matchupScore(b, m, foe);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best.index;
}
