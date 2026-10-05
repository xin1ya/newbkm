/**
 * SYS-003 · Gen5+ 伤害公式
 *   基础 = ⌊⌊⌊2×Lv/5+2⌋ × 威力 × A / D⌋ / 50⌋ + 2
 *   × 天气 × 要害(1.5) × 随机(0.85~1.00) × 本系(1.5/适应力 2) × 克制 × 灼伤(物理 0.5) × 墙 × 其他（特性 / 携带物）
 * 要害时忽略攻击方的负能力阶与防御方的正能力阶，并无视反射壁 / 光墙。
 */
import type { MoveData, TypeId } from '../data/types';
import type { BattleApi, HitInfo } from './api';
import type { BattleMon, Side } from './types';
import { getAbility } from './abilities';
import { getItem } from './items';
import { stageMultiplier } from '../pokemon/stats';
import { weatherDamageModifier, weatherSpDefModifier } from './status/weather';
import { getStats } from '../pokemon/Pokemon';

export const CRIT_MULTIPLIER = 1.5;
/** 会心等级 → 概率（Gen7+） */
export const CRIT_CHANCES = [1 / 24, 1 / 8, 1 / 2, 1, 1];

export interface DamageInput {
  user: BattleMon;
  target: BattleMon;
  move: MoveData;
  basePower: number;
  type: TypeId;
  crit: boolean;
  targetSide: Side;
  /** 固定随机数（0.85~1.00），单测用 */
  roll?: number;
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  crit: boolean;
  /** 目标的半减树果生效（engine 负责消耗 / 演出；AI 估算时不消耗） */
  resistBerry?: boolean;
}

/** 当前（含能力阶以外修正前）的能力值 */
export function rawStat(b: BattleApi, mon: BattleMon, stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe'): number {
  const o = stat === 'spe' ? undefined : mon.v.statOverride?.[stat];
  return o ?? getStats(b.dex, mon.pokemon)[stat];
}

export function calcDamage(b: BattleApi, input: DamageInput): DamageResult {
  const { user, target, move, type, crit } = input;
  const effectiveness = b.dex.effectiveness(type, b.types(target));
  if (effectiveness === 0) return { damage: 0, effectiveness, crit: false };

  const physical = move.category === 'physical';
  const atkStat = physical ? 'atk' : 'spa';
  const defStat = physical ? 'def' : 'spd';
  const userAbility = getAbility(user.pokemon.ability);
  const targetAbility = getAbility(target.pokemon.ability);

  // 攻击方能力值（欺诈使用目标的攻击与能力阶）
  const atkSource = move.id === 'foul-play' ? target : user;
  let atkStage = atkSource.stages[atkStat];
  if (crit && atkStage < 0) atkStage = 0;
  if (target.pokemon.ability === 'unaware') atkStage = 0; // 纯朴：无视对手的能力阶
  let A = rawStat(b, atkSource, atkStat) * stageMultiplier(atkStage);
  A *= userAbility.modifyAttack?.(b, user, move, atkStat) ?? 1;
  A *= getItem(user).modifyAttack?.(user, atkStat) ?? 1;
  A = Math.max(1, Math.floor(A));

  let defStage = target.stages[defStat];
  if (crit && defStage > 0) defStage = 0;
  if (user.pokemon.ability === 'unaware') defStage = 0;
  // 无关天气：攻防双方任一方持有时，天气对伤害无影响（简化：只看本次交手的双方）
  const wx = user.pokemon.ability === 'cloud-nine' || target.pokemon.ability === 'cloud-nine' ? 'none' : b.weather;
  let D = rawStat(b, target, defStat) * stageMultiplier(defStage);
  if (defStat === 'spd') D *= weatherSpDefModifier(wx, b.types(target));
  D *= targetAbility.modifyDefense?.(b, target, move, defStat) ?? 1;
  D = Math.max(1, Math.floor(D));

  // 威力
  let power = input.basePower;
  power *= userAbility.modifyBasePower?.(b, user, target, move, type) ?? 1;
  power *= getItem(user).modifyBasePower?.(move, type, user) ?? 1;
  power = Math.max(1, Math.floor(power));

  const level = user.pokemon.level;
  let dmg = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * A) / D) / 50) + 2;

  dmg = Math.floor(dmg * weatherDamageModifier(wx, type));
  dmg = Math.floor(dmg * terrainModifier(b, user, type));
  if (crit) dmg = Math.floor(dmg * CRIT_MULTIPLIER);
  const roll = input.roll ?? b.rng.int(85, 100) / 100;
  dmg = Math.floor(dmg * roll);
  if (b.types(user).includes(type) && type !== ('???' as TypeId)) {
    dmg = Math.floor(dmg * (user.pokemon.ability === 'adaptability' ? 2 : 1.5));
  }
  dmg = Math.floor(dmg * effectiveness);
  if (physical && user.pokemon.status?.kind === 'brn' && user.pokemon.ability !== 'guts') dmg = Math.floor(dmg * 0.5);
  if (!crit && user.pokemon.ability !== 'infiltrator') {
    // 穿透：无视对手的反射壁 / 光墙
    if (physical && input.targetSide.conditions.reflect > 0) dmg = Math.floor(dmg * 0.5);
    if (!physical && input.targetSide.conditions.lightScreen > 0) dmg = Math.floor(dmg * 0.5);
  }
  const hit: HitInfo = { move, type, damage: dmg, crit, effectiveness };
  dmg = Math.floor(dmg * (userAbility.modifyDamageDealt?.(b, user, target, hit) ?? 1));
  dmg = Math.floor(dmg * (targetAbility.modifyDamageTaken?.(b, target, user, hit) ?? 1));
  dmg = Math.floor(dmg * (getItem(user).modifyDamageDealt?.(b, user, hit) ?? 1));
  const resist = getItem(target).resistType;
  if (resist && resist === type && effectiveness > 1) {
    dmg = Math.floor(dmg * 0.5);
    return { damage: Math.max(1, dmg), effectiveness, crit, resistBerry: true };
  }
  return { damage: Math.max(1, dmg), effectiveness, crit };
}

/** 会心等级：招式 crit_rate + 聚气(+2) + 特性 */
/** 场地：着地的攻击方，电气场地电属性 / 青草场地草属性 ×1.3 */
export function isGrounded(b: BattleApi, mon: BattleMon): boolean {
  return !b.types(mon).includes('flying') && mon.pokemon.ability !== 'levitate';
}
function terrainModifier(b: BattleApi, user: BattleMon, type: TypeId): number {
  if (b.terrain === 'none' || !isGrounded(b, user)) return 1;
  if (b.terrain === 'electric' && type === 'electric') return 1.3;
  if (b.terrain === 'grassy' && type === 'grass') return 1.3;
  return 1;
}

export function critStage(user: BattleMon, move: MoveData): number {
  let s = move.meta.critRate;
  if (user.v.focusEnergy) s += 2;
  s += getAbility(user.pokemon.ability).critBoost ?? 0;
  return Math.max(0, Math.min(CRIT_CHANCES.length - 1, s));
}

/** 混乱自伤：40 威力无属性物理攻击，不计会心与随机数以外的修正 */
export function confusionDamage(b: BattleApi, mon: BattleMon): number {
  const A = Math.max(1, Math.floor(rawStat(b, mon, 'atk') * stageMultiplier(mon.stages.atk)));
  const D = Math.max(1, Math.floor(rawStat(b, mon, 'def') * stageMultiplier(mon.stages.def)));
  const base = Math.floor(Math.floor((Math.floor((2 * mon.pokemon.level) / 5 + 2) * 40 * A) / D) / 50) + 2;
  return Math.max(1, Math.floor(base * (b.rng.int(85, 100) / 100)));
}
