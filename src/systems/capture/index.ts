/**
 * SYS-005 · 捕获公式（Gen5+ 四次摇晃判定）+ 野外投球情境系数（设计 §9）。
 *
 *   a = (3M − 2H) × 捕获率 × 球加成 / (3M) × 状态加成 × 情境系数
 *   b = 65536 / (255 / a)^(3/16)
 *   连续 4 次 rand(0..65535) < b 即成功；显示的摇晃次数 = 通过次数（最多 3）。
 */
import type { MajorStatus } from '../pokemon/Pokemon';
import type { TypeId } from '../data/types';
import type { Rng } from '../rng';

export type BallId = 'poke-ball' | 'great-ball' | 'ultra-ball' | 'master-ball' | 'quick-ball' | 'net-ball' | 'dusk-ball';

export const BALL_IDS: readonly BallId[] = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'quick-ball', 'net-ball', 'dusk-ball'];

export interface BallContext {
  /** 战斗第几回合（从 1 开始）；野外投球为 0 */
  turn: number;
  targetTypes: readonly TypeId[];
  isNight: boolean;
  inCave: boolean;
}

export function isBall(itemId: string): itemId is BallId {
  return (BALL_IDS as readonly string[]).includes(itemId);
}

export function ballMultiplier(ball: BallId, ctx: BallContext): number {
  switch (ball) {
    case 'poke-ball':
      return 1;
    case 'great-ball':
      return 1.5;
    case 'ultra-ball':
      return 2;
    case 'master-ball':
      return 255;
    case 'quick-ball':
      return ctx.turn <= 1 ? 5 : 1;
    case 'net-ball':
      return ctx.targetTypes.includes('water') || ctx.targetTypes.includes('bug') ? 3.5 : 1;
    case 'dusk-ball':
      return ctx.isNight || ctx.inCave ? 3 : 1;
  }
}

export function statusMultiplier(status: MajorStatus | null | undefined): number {
  if (status === 'slp' || status === 'frz') return 2.5;
  if (status === 'par' || status === 'psn' || status === 'tox' || status === 'brn') return 1.5;
  return 1;
}

/** 野外投球（不进入战斗）的情境信息，设计 §9 */
export interface FieldThrowContext {
  /** 目标正在睡觉（夜间睡眠 AI 状态） */
  sleeping: boolean;
  /** 从目标背后投掷（玩家位于目标视野后方 120° 扇区） */
  fromBehind: boolean;
  /** 玩家首发宝可梦等级 − 目标等级 */
  levelAdvantage: number;
  /** 目标是否发现了玩家（警觉状态） */
  alerted: boolean;
  /** 头目个体 */
  alpha: boolean;
}

export const FIELD_THROW_CAP = 4;

/**
 * 情境系数：睡眠 ×2、背后 ×1.5、等级优势每级 +3%（最多 +60%）、
 * 已警觉 ×0.75、头目 ×0.5；乘积上限 ×4。
 */
export function fieldThrowMultiplier(ctx: FieldThrowContext): number {
  let m = 1;
  if (ctx.sleeping) m *= 2;
  if (ctx.fromBehind) m *= 1.5;
  if (ctx.levelAdvantage > 0) m *= 1 + Math.min(ctx.levelAdvantage, 20) * 0.03;
  if (ctx.alerted) m *= 0.75;
  if (ctx.alpha) m *= 0.5;
  return Math.min(FIELD_THROW_CAP, m);
}

export interface CaptureInput {
  maxHp: number;
  hp: number;
  captureRate: number;
  ball: BallId;
  ballContext: BallContext;
  status: MajorStatus | null | undefined;
  /** 额外倍率：野外投球情境系数等 */
  extraMultiplier?: number;
}

export interface CaptureResult {
  success: boolean;
  /** 显示的摇晃次数 0–3 */
  shakes: number;
  /** 修正后的捕获值 a（调试 / 单测用） */
  modifiedRate: number;
  /** 单次摇晃通过概率 */
  shakeProbability: number;
}

export function modifiedCatchRate(input: CaptureInput): number {
  const { maxHp, hp, captureRate } = input;
  const h = Math.max(1, Math.min(hp, maxHp));
  const ball = ballMultiplier(input.ball, input.ballContext);
  const a = (((3 * maxHp - 2 * h) * captureRate * ball) / (3 * maxHp)) * statusMultiplier(input.status) * (input.extraMultiplier ?? 1);
  return Math.max(1, a);
}

export function attemptCapture(input: CaptureInput, rng: Rng): CaptureResult {
  if (input.ball === 'master-ball') return { success: true, shakes: 3, modifiedRate: 255, shakeProbability: 1 };
  const a = modifiedCatchRate(input);
  if (a >= 255) return { success: true, shakes: 3, modifiedRate: a, shakeProbability: 1 };
  const b = Math.floor(65536 / Math.pow(255 / a, 0.1875));
  let passed = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.int(0, 65535) < b) passed++;
    else break;
  }
  return { success: passed === 4, shakes: Math.min(3, passed), modifiedRate: a, shakeProbability: b / 65536 };
}

/** 理论成功率（UI 提示 / 平衡调试用） */
export function captureChance(input: CaptureInput): number {
  if (input.ball === 'master-ball') return 1;
  const a = modifiedCatchRate(input);
  if (a >= 255) return 1;
  const p = Math.floor(65536 / Math.pow(255 / a, 0.1875)) / 65536;
  return p ** 4;
}
