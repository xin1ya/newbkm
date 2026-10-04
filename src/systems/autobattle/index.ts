/**
 * 自动战斗（纯逻辑，场景层与战斗场景共用）：
 * - 配置：勾选目标物种，每个目标选「打倒」或「捕捉」；捕捉用的球；使用的可使用的招式（勾选，每回合在勾选的攻击招式里自动挑效果最好的）；
 *   HP / PP 阈值（低于阈值时自动使用勾选的道具）
 * - 决策（decideAutoAction）：
 *   · 非目标遭遇 → 逃跑（不能逃时用最强招式打倒）
 *   · 我方 HP 比例低于阈值 → 使用勾选的回复道具（没有 → 停止自动）
 *   · 所选招式 PP ≤ 阈值 → 使用勾选的 PP 道具（没有 → 换一个还有 PP 的招式）
 *   · 打倒 → 用所选招式（或估算伤害最高的招式）
 *   · 捕捉 → 对方 HP 进入红血（≤ 20%）后扔球；否则挑「不会打倒对方」的伤害最大的招式（点到为止，优先「点到为止」），
 *     所有招式都可能打倒对方时直接扔球（宁可满血丢球，也不把目标打倒）
 */
import type { Battle, BattleRequest } from '../battle/engine';
import type { BattleAction } from '../battle/types';
import { calcDamage } from '../battle/damage';

export type AutoGoal = 'defeat' | 'capture';

export interface AutoBattleConfig {
  /** speciesId → 目标 */
  targets: Record<number, AutoGoal>;
  /** 捕捉用的球 */
  ball: string;
  /** 取消勾选（不使用）的招式 id；其余攻击招式都可用，每回合在可用招式里自动挑效果最好的 */
  disabledMoves: string[];
  /** HP 低于该比例（0–1）时使用回复道具 */
  hpPct: number;
  /** 所选招式 PP 低于等于该值时使用 PP 道具 */
  ppMin: number;
  /** 勾选的回复道具（按顺序优先） */
  healItems: string[];
  /** 勾选的 PP 道具 */
  ppItems: string[];
  /** 回复道具用完 / PP 用完 / 首发倒下时，飞回最近的宝可梦中心治疗后回来继续（需要能飞行） */
  centerHeal: boolean;
}

/** 战斗中可用的回复道具（与 Battle.useItem 支持的一致） */
export const AUTO_HEAL_ITEMS = ['potion', 'super-potion', 'hyper-potion', 'full-heal'] as const;
export const AUTO_PP_ITEMS = ['leppa-berry'] as const;
export const AUTO_BALLS = ['poke-ball', 'great-ball', 'ultra-ball', 'quick-ball', 'net-ball', 'dusk-ball'] as const;
/** 红血线 */
export const RED_HP = 0.2;

export function defaultAutoConfig(): AutoBattleConfig {
  return { targets: {}, ball: 'poke-ball', disabledMoves: [], hpPct: 0.35, ppMin: 2, healItems: ['potion', 'super-potion'], ppItems: ['leppa-berry'], centerHeal: true };
}

/** 读档 / 本地存储恢复：字段缺失或非法时用默认值 */
export function sanitizeAutoConfig(raw: unknown): AutoBattleConfig {
  const d = defaultAutoConfig();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AutoBattleConfig>;
  const targets: Record<number, AutoGoal> = {};
  if (r.targets && typeof r.targets === 'object')
    for (const [k, v] of Object.entries(r.targets)) if ((v === 'defeat' || v === 'capture') && Number.isInteger(Number(k))) targets[Number(k)] = v;
  const num = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  const strs = (v: unknown, allowed: readonly string[], def: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)) : def);
  return {
    targets,
    ball: typeof r.ball === 'string' && (AUTO_BALLS as readonly string[]).includes(r.ball) ? r.ball : d.ball,
    disabledMoves: Array.isArray(r.disabledMoves) ? r.disabledMoves.filter((x): x is string => typeof x === 'string').slice(0, 64) : [],
    hpPct: num(r.hpPct, 0, 0.9, d.hpPct),
    ppMin: Math.round(num(r.ppMin, 0, 10, d.ppMin)),
    healItems: strs(r.healItems, AUTO_HEAL_ITEMS, d.healItems),
    ppItems: strs(r.ppItems, AUTO_PP_ITEMS, d.ppItems),
    centerHeal: typeof r.centerHeal === 'boolean' ? r.centerHeal : d.centerHeal,
  };
}

export type AutoDecision = { kind: 'act'; action: BattleAction; note?: string } | { kind: 'stop'; reason: string };

type ActionRequest = Extract<BattleRequest, { kind: 'action' }>;

/** 估算某招式对当前对手的伤害（不含会心；roll = 随机系数） */
export function estimateDamage(b: Battle, moveIndex: number, roll = 1): number {
  const me = b.active(0);
  const foe = b.active(1);
  const slot = me.pokemon.moves[moveIndex];
  if (!slot) return 0;
  const move = b.dex.move(slot.id);
  if (move.category === 'status' || !move.power) return 0;
  return calcDamage(b, { user: me, target: foe, move, basePower: move.power, type: move.type, crit: false, targetSide: b.sides[1], roll }).damage;
}

function usable(req: ActionRequest, i: number): boolean {
  const m = req.moves[i];
  return !!m && !m.disabled && m.pp > 0;
}

/** 有伤害的招式（自动战斗从不使用变化招式 / 无威力招式） */
export function isDamagingMove(b: Battle, id: string): boolean {
  const mv = b.dex.move(id);
  return mv.category !== 'status' && !!mv.power;
}

function usableAttack(b: Battle, req: ActionRequest, i: number, cfg?: AutoBattleConfig): boolean {
  const id = req.moves[i]?.id;
  if (!id || cfg?.disabledMoves.includes(id)) return false;
  return usable(req, i) && isDamagingMove(b, id) && estimateDamage(b, i, 1) > 0;
}

/** 回合上限：超过仍未分出胜负（免疫 / 特性等估算不到的情况）就撤退，防止卡死 */
export const AUTO_MAX_TURNS = 25;

/** 队伍里还能战斗、且有能打到对手的攻击招式（属性不免疫）的宝可梦 */
export function effectiveSwitchIndex(b: Battle): number | null {
  const s = b.sides[0];
  const foeTypes = b.types(b.active(1));
  const i = s.party.findIndex(
    (m, idx) =>
      idx !== s.active &&
      m.pokemon.hp > 0 &&
      m.pokemon.moves.some((mv) => mv.pp > 0 && isDamagingMove(b, mv.id) && b.dex.effectiveness(b.dex.move(mv.id).type, foeTypes) > 0),
  );
  return i >= 0 ? i : null;
}

/** 没有能造成伤害的招式（例如一般 / 格斗系招式打鬼斯）：捕捉目标直接扔球 → 换上打得到的同伴 → 逃跑 → 停止 */
function noEffectiveMove(b: Battle, req: ActionRequest, goal: AutoGoal | null, cfg: AutoBattleConfig, bag: Readonly<Record<string, number>>): AutoDecision {
  if (goal === 'capture' && req.canCatch && (bag[cfg.ball] ?? 0) > 0) return { kind: 'act', action: { type: 'ball', itemId: cfg.ball }, note: 'ball' };
  const sw = req.canSwitch ? effectiveSwitchIndex(b) : null;
  if (sw !== null) return { kind: 'act', action: { type: 'switch', partyIndex: sw }, note: 'switch' };
  if (req.canRun) return { kind: 'act', action: { type: 'run' }, note: 'retreat' };
  return { kind: 'stop', reason: '我方招式都打不到对手' };
}

/** 估算伤害最高的可用攻击招式（按命中率折算）；没有可用的攻击招式返回 -1 */
export function bestMove(b: Battle, req: ActionRequest, cfg?: AutoBattleConfig): number {
  let best = -1;
  let score = -1;
  for (const m of req.moves) {
    if (!usableAttack(b, req, m.index, cfg)) continue;
    const acc = (b.dex.move(m.id).accuracy ?? 100) / 100;
    const s = estimateDamage(b, m.index, 0.925) * acc;
    if (s > score) {
      score = s;
      best = m.index;
    }
  }
  return best;
}

function firstOwned(items: readonly string[], bag: Readonly<Record<string, number>>): string | null {
  return items.find((id) => (bag[id] ?? 0) > 0) ?? null;
}

/**
 * 决定本回合的行动。goal = null 表示这只不是目标（逃跑）。
 */
export function decideAutoAction(b: Battle, req: ActionRequest, goal: AutoGoal | null, cfg: AutoBattleConfig, bag: Readonly<Record<string, number>>): AutoDecision {
  if (req.forced) return { kind: 'act', action: { type: 'move', moveIndex: 0 } };
  if (b.turn > AUTO_MAX_TURNS && req.canRun) return { kind: 'act', action: { type: 'run' }, note: 'retreat' };
  if (goal === null) {
    if (req.canRun) return { kind: 'act', action: { type: 'run' }, note: 'flee' };
    const m = bestMove(b, req, cfg);
    if (m < 0) return noEffectiveMove(b, req, goal, cfg, bag);
    return { kind: 'act', action: { type: 'move', moveIndex: m } };
  }
  const me = b.active(0);
  const meIdx = b.sides[0].active;
  const foe = b.active(1);
  const foeMax = b.maxHp(foe);
  // HP 阈值 → 回复道具
  if (me.pokemon.hp / b.maxHp(me) < cfg.hpPct) {
    const heal = firstOwned(
      cfg.healItems.filter((id) => id !== 'full-heal'),
      bag,
    );
    if (heal) return { kind: 'act', action: { type: 'item', itemId: heal, partyIndex: meIdx }, note: 'heal' };
    // 设定了回宝可梦中心：先撤退，战斗结束后飞回去治疗
    if (cfg.centerHeal && req.canRun) return { kind: 'act', action: { type: 'run' }, note: 'retreat' };
    if (!cfg.centerHeal) return { kind: 'stop', reason: 'HP 低于设定值，且没有勾选的回复道具了' };
  }
  // 异常状态（勾选了万灵药时）
  if (me.pokemon.status && cfg.healItems.includes('full-heal') && (bag['full-heal'] ?? 0) > 0)
    return { kind: 'act', action: { type: 'item', itemId: 'full-heal', partyIndex: meIdx }, note: 'cure' };
  // 招式选择
  // 勾选的攻击招式全部 PP ≤ 阈值 → 给 PP 最少的那个用 PP 道具
  const checked = req.moves.filter((m) => !cfg.disabledMoves.includes(m.id) && isDamagingMove(b, m.id) && estimateDamage(b, m.index, 1) > 0);
  if (checked.length && checked.every((m) => m.pp <= cfg.ppMin)) {
    const pp = firstOwned(cfg.ppItems, bag);
    const low = checked.reduce((a, m) => (m.pp < a.pp ? m : a));
    if (pp && low.pp < low.maxPp) return { kind: 'act', action: { type: 'item', itemId: pp, partyIndex: meIdx }, note: 'pp' };
  }
  if (!req.moves.some((m) => usable(req, m.index))) return { kind: 'act', action: { type: 'move', moveIndex: 0 } }; // 全部 PP 耗尽 → 引擎改用「挣扎」
  if (!req.moves.some((m) => usableAttack(b, req, m.index, cfg))) return noEffectiveMove(b, req, goal, cfg, bag);
  if (goal === 'defeat') return { kind: 'act', action: { type: 'move', moveIndex: bestMove(b, req, cfg) } };
  // 捕捉
  const ratio = foe.pokemon.hp / foeMax;
  const ball = (bag[cfg.ball] ?? 0) > 0 ? cfg.ball : null;
  if (!req.canCatch) return { kind: 'stop', reason: '现在不能捕捉' };
  if (ratio <= RED_HP || foe.pokemon.hp <= 1) {
    if (!ball) return { kind: 'stop', reason: '设定的精灵球用完了' };
    return { kind: 'act', action: { type: 'ball', itemId: ball }, note: 'ball' };
  }
  // 点到为止：留 1 HP
  const fs = req.moves.find((m) => m.id === 'false-swipe' && usableAttack(b, req, m.index, cfg));
  if (fs) return { kind: 'act', action: { type: 'move', moveIndex: fs.index } };
  // 不会打倒对方的最大伤害招式（按最高随机系数估算）
  let pick = -1;
  let dmg = 0;
  for (const m of req.moves) {
    if (!usableAttack(b, req, m.index, cfg)) continue;
    const max = estimateDamage(b, m.index, 1);
    if (max <= 0) continue;
    if (max < foe.pokemon.hp && max > dmg) {
      dmg = max;
      pick = m.index;
    }
  }
  if (pick >= 0) return { kind: 'act', action: { type: 'move', moveIndex: pick } };
  // 每个招式都可能打倒对方：不冒险，直接扔球（满血捕获率低一些，但不会把目标打倒）
  if (!ball) return { kind: 'stop', reason: '设定的精灵球用完了' };
  return { kind: 'act', action: { type: 'ball', itemId: ball }, note: 'ball' };
}

/** 换人请求（首发倒下）：第一只还能战斗的宝可梦 */
export function autoSwitchIndex(b: Battle): number | null {
  const s = b.sides[0];
  const i = s.party.findIndex((m, idx) => idx !== s.active && m.pokemon.hp > 0);
  return i >= 0 ? i : null;
}
