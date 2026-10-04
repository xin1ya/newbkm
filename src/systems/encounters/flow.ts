/**
 * M1-09 · 遇敌流程纯逻辑：开场提示（先手 / 被偷袭 / 睡眠 / 头目 / 闪光）、黑屏惩罚、复活点。
 * 设计 §5.2：背后接近 → 玩家先手；被宝可梦冲撞 → 对方先手；正面接触 → 按速度。
 */
export interface OpeningInput {
  name: string;
  method: 'visible' | 'grass' | 'surf' | 'fish';
  initiative: 'player' | 'wild' | null;
  sleeping: boolean;
  alpha: boolean;
  shiny: boolean;
}

/** 战斗场展开后、第一回合前的提示（按显示顺序） */
export function encounterOpening(o: OpeningInput): string[] {
  const out: string[] = [];
  if (o.method === 'grass') out.push(`草丛里跳出了野生的${o.name}！`);
  else if (o.method === 'fish') out.push(`钓上了野生的${o.name}！`);
  else if (o.method === 'surf') out.push(`水里冒出了野生的${o.name}！`);
  else out.push(`野生的${o.name}出现了！`);
  if (o.shiny) out.push('……它的颜色和平常不太一样！');
  if (o.alpha) out.push(`是体型巨大的头目${o.name}！要小心！`);
  if (o.method === 'visible') {
    if (o.sleeping) out.push(`${o.name}还在睡觉……趁现在先发制人！`);
    else if (o.initiative === 'player') out.push(`从背后悄悄接近了${o.name}！可以抢先行动！`);
    else if (o.initiative === 'wild') out.push(`${o.name}猛地冲了过来！被抢先了！`);
  }
  return out;
}

/** 可见遭遇接触时的头顶表情（战斗前 0.5 s 的停顿演出） */
export function contactEmote(initiative: 'player' | 'wild' | null, sleeping: boolean): '!' | '?' | 'z' {
  if (sleeping) return 'z';
  return initiative === 'player' ? '?' : '!';
}

/** 第四世代起的黑屏付款：最高等级 × 徽章档位基数，不超过持有金额 */
const BLACKOUT_BASE = [8, 16, 24, 36, 48, 64, 80, 100, 120] as const;

export function blackoutPenalty(money: number, highestLevel: number, badges: number): number {
  const base = BLACKOUT_BASE[Math.max(0, Math.min(BLACKOUT_BASE.length - 1, badges))]!;
  return Math.max(0, Math.min(money, base * Math.max(1, highestLevel)));
}

/** 野生个体在玩家逃跑后的冷却：一段时间内不再主动追击（避免战斗循环） */
export const RUN_AWAY_GRACE = 6;
