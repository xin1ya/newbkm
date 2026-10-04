/**
 * 计划文档 §9.5 · 能量方块（宝可方块）纯逻辑：
 * - 制作：方块机里放 2–4 种不同的树果 + 转盘节奏小游戏（命中质量 q 0–1）→ 5 维风味、等级、顺滑度；
 *   放了相同的树果 → 黑色方块（失败品）。
 * - 喂食：亲密度 + 外观状态（帅气 / 美丽 / 可爱 / 聪明 / 强壮，对应 辣 / 涩 / 甜 / 苦 / 酸）。
 *   性格喜欢的口味效果翻倍、讨厌的减半；光泽（吃饱程度）满了就吃不下了。
 * - 诱饵：放在地上 3 分钟（游戏 180 分钟），半径内偏好该口味的物种出现率 ×3。
 * - 安抚头目：投喂合口味的方块 → 不再敌对，战斗开场不获得头目气场的能力提升，捕获率 ×1.3。
 */
import type { Rng } from '../rng';
import type { NatureData, StatId, TypeId } from '../data/types';
import type { PokemonInstance } from '../pokemon';
import type { GameState } from '../state/GameState';
import { FLAVORS, FLAVOR_ZH, type BerryDef, type Flavor } from '@/config/berries';

export type BlockKind = 'red' | 'blue' | 'pink' | 'green' | 'yellow' | 'rainbow' | 'gold' | 'black';

export interface PokeBlock {
  uid: string;
  kind: BlockKind;
  flavor: Record<Flavor, number>;
  /** 等级：最强风味的数值 */
  level: number;
  /** 顺滑度 1–99（越高越好入口：外观状态加成越多、光泽涨得越少） */
  smooth: number;
}

export const BLOCK_BOX_CAPACITY = 40;
export const BLOCK_KIND_ZH: Record<BlockKind, string> = {
  red: '红色方块',
  blue: '蓝色方块',
  pink: '粉红方块',
  green: '绿色方块',
  yellow: '黄色方块',
  rainbow: '彩虹方块',
  gold: '金色方块',
  black: '黑色方块',
};
export const BLOCK_COLOR: Record<BlockKind, string> = {
  red: '#e8504a',
  blue: '#4a8fe0',
  pink: '#f39ac0',
  green: '#5cb85c',
  yellow: '#f2d24a',
  rainbow: '#c08af0',
  gold: '#f2b632',
  black: '#3a3a44',
};
const FLAVOR_KIND: Record<Flavor, BlockKind> = { spicy: 'red', dry: 'blue', sweet: 'pink', bitter: 'green', sour: 'yellow' };

export type Condition = 'cool' | 'beauty' | 'cute' | 'smart' | 'tough';
export const CONDITION_OF: Record<Flavor, Condition> = { spicy: 'cool', dry: 'beauty', sweet: 'cute', bitter: 'smart', sour: 'tough' };
export const CONDITION_ZH: Record<Condition, string> = { cool: '帅气', beauty: '美丽', cute: '可爱', smart: '聪明', tough: '强壮' };
export const CONDITION_MAX = 255;
export const SHEEN_MAX = 255;
export interface ConditionState {
  cool: number;
  beauty: number;
  cute: number;
  smart: number;
  tough: number;
  sheen: number;
}

/** 性格 → 喜欢 / 讨厌的口味（攻击辣、防御酸、特攻涩、特防苦、速度甜） */
const STAT_FLAVOR: Partial<Record<StatId, Flavor>> = { atk: 'spicy', def: 'sour', spa: 'dry', spd: 'bitter', spe: 'sweet' };
export function natureTaste(n: Pick<NatureData, 'plus' | 'minus'>): { likes: Flavor | null; dislikes: Flavor | null } {
  const likes = n.plus && n.plus !== n.minus ? (STAT_FLAVOR[n.plus] ?? null) : null;
  const dislikes = n.minus && n.plus !== n.minus ? (STAT_FLAVOR[n.minus] ?? null) : null;
  return { likes, dislikes };
}

/** 物种口味倾向（诱饵 / 安抚头目）：按属性 */
export const TYPE_FLAVOR: Record<TypeId, Flavor> = {
  fire: 'spicy',
  fighting: 'spicy',
  dragon: 'spicy',
  water: 'dry',
  ice: 'dry',
  flying: 'dry',
  psychic: 'dry',
  fairy: 'sweet',
  normal: 'sweet',
  electric: 'sweet',
  grass: 'bitter',
  poison: 'bitter',
  bug: 'bitter',
  ghost: 'bitter',
  ground: 'sour',
  rock: 'sour',
  steel: 'sour',
  dark: 'sour',
} as Record<TypeId, Flavor>;

export function speciesLikes(types: readonly TypeId[]): Flavor[] {
  return [...new Set(types.map((t) => TYPE_FLAVOR[t]).filter((f): f is Flavor => !!f))];
}

/** 最强风味（并列取靠前） */
export function blockMainFlavor(b: Pick<PokeBlock, 'flavor'>): Flavor {
  return FLAVORS.reduce((best, f) => (b.flavor[f] > b.flavor[best] ? f : best), FLAVORS[0]!);
}

export function blockName(b: PokeBlock): string {
  return `${BLOCK_KIND_ZH[b.kind]} Lv.${b.level}`;
}

export function blockSummary(b: PokeBlock): string {
  const parts = FLAVORS.filter((f) => b.flavor[f] > 0).map((f) => `${FLAVOR_ZH[f]} ${b.flavor[f]}`);
  return `${parts.join(' · ') || '没有味道'} · 顺滑度 ${b.smooth}`;
}

// ———————————————— 小游戏 ————————————————

export type HitGrade = 'perfect' | 'good' | 'miss';
export const MINIGAME_ROUNDS = 8;
/** 判定窗口（与目标中心的角度差，弧度）：每轮缩小一点 */
export function hitWindows(round: number): { perfect: number; good: number } {
  const k = 1 - Math.min(round, MINIGAME_ROUNDS - 1) * 0.06;
  return { perfect: 0.16 * k, good: 0.42 * k };
}
/** 指针角速度（弧度 / 秒）：每轮加快，放的树果越多越快 */
export function needleSpeed(round: number, berries: number): number {
  return 3.2 + round * 0.45 + (berries - 2) * 0.35;
}
export function gradeHit(angleDiff: number, round: number): HitGrade {
  const d = Math.abs(Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)));
  const w = hitWindows(round);
  return d <= w.perfect ? 'perfect' : d <= w.good ? 'good' : 'miss';
}
/** 命中质量 0–1 */
export function minigameQuality(hits: readonly HitGrade[]): number {
  if (!hits.length) return 0;
  const s = hits.reduce((a, h) => a + (h === 'perfect' ? 1 : h === 'good' ? 0.5 : 0), 0);
  return Math.max(0, Math.min(1, s / Math.max(hits.length, MINIGAME_ROUNDS)));
}

// ———————————————— 制作 ————————————————

export function canCook(berries: readonly BerryDef[]): string | null {
  if (berries.length < 2) return '至少要放 2 种树果。';
  if (berries.length > 4) return '最多只能放 4 种树果。';
  return null;
}

/**
 * 制作方块。
 * - 风味：各树果风味求和 → 每种树果扣 2 点的混合损耗 → × 质量系数（0.7 + 0.9q）× 树果数系数（每多 1 种 +12%）；
 * - 顺滑度：100 − 平均树果顺滑值 ×（1.3 − 0.6q），多放树果略好入口；
 * - 颜色：只有 1 种风味 → 该风味色；2 种 → 最强风味色；3 种以上 → 彩虹；等级 ≥ 50 且 q ≥ 0.85 → 金色；
 * - 放了相同的树果或全部被抵消 → 黑色方块。
 */
export function cookBlock(berries: readonly BerryDef[], quality: number, uid: string): PokeBlock {
  const q = Math.max(0, Math.min(1, quality));
  const n = berries.length;
  const black = (): PokeBlock => ({ uid, kind: 'black', flavor: { spicy: 2, dry: 2, sweet: 2, bitter: 2, sour: 2 }, level: 2, smooth: 5 });
  if (new Set(berries.map((b) => b.id)).size !== n || n < 2) return black();
  const factor = (0.7 + 0.9 * q) * (1 + (n - 2) * 0.12);
  const flavor = {} as Record<Flavor, number>;
  for (const f of FLAVORS) {
    const sum = berries.reduce((a, b) => a + b.flavor[f], 0);
    flavor[f] = Math.max(0, Math.round(Math.max(0, sum - n * 2) * factor));
  }
  const level = Math.max(...FLAVORS.map((f) => flavor[f]));
  if (level <= 0) return black();
  const avgSmooth = berries.reduce((a, b) => a + b.smoothness, 0) / n;
  const smooth = Math.max(1, Math.min(99, Math.round(100 - avgSmooth * (1.3 - 0.6 * q) + (n - 2) * 3)));
  const present = FLAVORS.filter((f) => flavor[f] > 0);
  let kind: BlockKind = present.length >= 3 ? 'rainbow' : FLAVOR_KIND[blockMainFlavor({ flavor })];
  if (level >= 50 && q >= 0.85) kind = 'gold';
  return { uid, kind, flavor, level, smooth };
}

export function blockBox(s: GameState): PokeBlock[] {
  if (!Array.isArray(s.blocks)) s.blocks = [];
  return s.blocks;
}

/** 放进方块盒；满了返回 false */
export function storeBlock(s: GameState, b: PokeBlock): boolean {
  const box = blockBox(s);
  if (box.length >= BLOCK_BOX_CAPACITY) return false;
  box.push(b);
  return true;
}

export function takeBlock(s: GameState, uid: string): PokeBlock | null {
  const box = blockBox(s);
  const i = box.findIndex((b) => b.uid === uid);
  if (i < 0) return null;
  return box.splice(i, 1)[0]!;
}

export function newBlockUid(rng: Rng): string {
  return `blk-${Date.now().toString(36)}-${Math.floor(rng.next() * 1e9).toString(36)}`;
}

// ———————————————— 喂食 ————————————————

export function conditionOf(p: PokemonInstance): ConditionState {
  if (!p.condition) p.condition = { cool: 0, beauty: 0, cute: 0, smart: 0, tough: 0, sheen: 0 };
  return p.condition;
}

export type Taste = 'like' | 'dislike' | 'neutral';

export interface FeedResult {
  ok: boolean;
  taste: Taste;
  /** 各外观状态的增量 */
  gains: Partial<Record<Condition, number>>;
  friendship: number;
  messages: string[];
}

/** 每块增加的光泽：越顺滑越少 */
export function sheenGain(b: PokeBlock): number {
  return Math.max(2, Math.round(32 - b.smooth * 0.26));
}

/** 喂食（直接修改 p）。光泽满了 → 不吃。name 用于文案 */
export function feedBlock(p: PokemonInstance, b: PokeBlock, nature: Pick<NatureData, 'plus' | 'minus'>, name: string): FeedResult {
  const c = conditionOf(p);
  if (c.sheen >= SHEEN_MAX) return { ok: false, taste: 'neutral', gains: {}, friendship: 0, messages: [`${name}已经吃得很饱了，一口也吃不下了。`] };
  const { likes, dislikes } = natureTaste(nature);
  const main = blockMainFlavor(b);
  const taste: Taste = b.kind === 'black' ? 'neutral' : main === likes ? 'like' : main === dislikes ? 'dislike' : 'neutral';
  const smoothK = 0.5 + b.smooth / 200;
  const gains: Partial<Record<Condition, number>> = {};
  for (const f of FLAVORS) {
    if (b.flavor[f] <= 0) continue;
    const k = f === likes ? 2 : f === dislikes ? 0.5 : 1;
    const cond = CONDITION_OF[f];
    const before = c[cond];
    c[cond] = Math.min(CONDITION_MAX, before + Math.max(1, Math.round(b.flavor[f] * k * smoothK)));
    if (c[cond] > before) gains[cond] = c[cond] - before;
  }
  c.sheen = Math.min(SHEEN_MAX, c.sheen + sheenGain(b));
  const base = 3 + Math.floor(b.level / 15);
  const fr = taste === 'like' ? base * 2 : taste === 'dislike' ? 1 : base;
  const before = p.friendship;
  p.friendship = Math.min(255, p.friendship + fr);
  const msgs = [
    taste === 'like' ? `${name}开心地吃掉了${BLOCK_KIND_ZH[b.kind]}！好像很合口味！` : taste === 'dislike' ? `${name}皱着眉头，勉强吃掉了${BLOCK_KIND_ZH[b.kind]}……` : `${name}吃掉了${BLOCK_KIND_ZH[b.kind]}。`,
  ];
  const gainText = (Object.keys(gains) as Condition[]).map((k) => `${CONDITION_ZH[k]} +${gains[k]}`);
  if (gainText.length) msgs.push(gainText.join('　'));
  if (p.friendship > before) msgs.push(`${name}看起来更亲近你了。`);
  if (c.sheen >= SHEEN_MAX) msgs.push(`${name}的光泽已经满了，再也吃不下方块了。`);
  return { ok: true, taste, gains, friendship: p.friendship - before, messages: msgs };
}

// ———————————————— 诱饵 ————————————————

export const LURE_MINUTES = 180;
export const LURE_RADIUS = 45;
export const LURE_WEIGHT = 3;

export interface LureState {
  island: string;
  x: number;
  z: number;
  flavor: Flavor;
  kind: BlockKind;
  /** 失效时刻（游戏总分钟） */
  until: number;
}

export function placeLure(s: GameState, b: PokeBlock, island: string, x: number, z: number, now: number): LureState {
  const lure: LureState = { island, x, z, flavor: blockMainFlavor(b), kind: b.kind, until: now + LURE_MINUTES * (b.kind === 'gold' ? 1.5 : 1) };
  s.lure = lure;
  return lure;
}

/** 当前位置生效的诱饵口味（过期会清除） */
export function activeLure(s: GameState, island: string, x: number, z: number, now: number): Flavor | null {
  const l = s.lure;
  if (!l) return null;
  if (now >= l.until) {
    s.lure = undefined;
    return null;
  }
  if (l.island !== island || Math.hypot(x - l.x, z - l.z) > LURE_RADIUS) return null;
  return l.flavor;
}

export function lureWeight(types: readonly TypeId[], lure: Flavor | null | undefined): number {
  if (!lure) return 1;
  return speciesLikes(types).includes(lure) ? LURE_WEIGHT : 1;
}

// ———————————————— 安抚头目 ————————————————

export const CALM_CAPTURE_BONUS = 1.3;

export type CalmResult = 'calmed' | 'ignored' | 'angered';

/** 合口味 → 安抚；不合口味但等级 ≥ 40 / 金色 / 彩虹也能安抚；其余不理睬；黑色方块 → 激怒 */
export function calmAlpha(types: readonly TypeId[], b: PokeBlock): CalmResult {
  if (b.kind === 'black') return 'angered';
  const likes = speciesLikes(types);
  const main = blockMainFlavor(b);
  if (likes.includes(main)) return 'calmed';
  if (b.level >= 40 || b.kind === 'gold' || b.kind === 'rainbow') return 'calmed';
  return 'ignored';
}
