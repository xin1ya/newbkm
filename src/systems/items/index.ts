/**
 * M1-18 · 野外道具（纯逻辑）：背包口袋分类、对宝可梦使用（回复 / 解除异常 / 复活 / 树果 / 进化石 / 招式学习器）、
 * 携带与收回、丢弃。战斗内的道具仍由 battle/engine 处理，两边回复量保持一致（伤药 20 / 好伤药 60 / 厉害伤药 120）。
 */
import type { Dex } from '../data/Dex';
import type { MajorStatus, PokemonInstance } from '../pokemon';
import { EV_MAX_PER_STAT, EV_MAX_TOTAL, IV_ITEMS, IV_MAX, VITAMINS, VITAMIN_EV, addEvs, applyIvItem, evTotal, ivItemUsable, maxHp } from '../pokemon';
import type { BaseStatId } from '../data/types';
import { checkEvolution, gainExp, teachMove } from '../progression';
import { addItem, removeItem, type GameState } from '../state';
import { computeTmCompat } from '../tms';
import TM_COMPAT from '@/config/tms/compat.json';
import { BERRIES, EV_BERRIES } from '@/config/berries';
import { ALPHA_MATERIAL_BY_ID, insightChance } from '@/config/alpha/materials';

export type Pocket = 'medicine' | 'balls' | 'berries' | 'held' | 'evolution' | 'tms' | 'treasure' | 'key';

export const POCKETS: { id: Pocket; name: string }[] = [
  { id: 'medicine', name: '药品' },
  { id: 'balls', name: '精灵球' },
  { id: 'berries', name: '树果' },
  { id: 'held', name: '携带物' },
  { id: 'evolution', name: '进化道具' },
  { id: 'tms', name: '招式学习器' },
  { id: 'treasure', name: '素材' },
  { id: 'key', name: '重要物品' },
];

/** 不在 PokeAPI 道具表里的物品（重要物品 / 招式学习器），由 config 注册 */
export interface KeyItemDef {
  id: string;
  name: string;
  desc: string;
  pocket: 'key' | 'tms' | 'medicine' | 'treasure' | 'berries' | 'held' | 'evolution';
  /** 招式学习器教的招式 */
  move?: string;
}

export interface ItemInfo {
  id: string;
  name: string;
  desc: string;
  pocket: Pocket;
  /** 可在野外对宝可梦使用 */
  usable: boolean;
  /** 可以携带 */
  holdable: boolean;
  /** 可以丢弃（重要物品不行） */
  tossable: boolean;
}

export const HEAL_AMOUNT: Record<string, number> = { potion: 20, 'super-potion': 60, 'hyper-potion': 120 };
export const STATUS_CURES: Record<string, MajorStatus[]> = {
  antidote: ['psn', 'tox'],
  'paralyze-heal': ['par'],
  awakening: ['slp'],
  'burn-heal': ['brn'],
  'ice-heal': ['frz'],
  'full-heal': ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
  'lum-berry': ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
};
// 计划文档 §9.1：状态树果（樱子果 / 零余果 / 桃桃果 / 莓莓果 / 利木果）按 berries.json 登记
for (const b of BERRIES) if (b.effect.cure && !STATUS_CURES[b.id]) STATUS_CURES[b.id] = b.effect.cure;
const BERRY_HEAL: Record<string, (max: number) => number> = { 'oran-berry': () => 10, 'sitrus-berry': (max) => Math.floor(max / 4) };

/** 降努力值树果：-10 努力值；亲密度 +10 / +5 / +2（<100 / <200 / 以上），上限 255 */
export const EV_BERRY_DROP = 10;
export function friendshipGain(f: number): number {
  return f < 100 ? 10 : f < 200 ? 5 : 2;
}
export const FRIENDSHIP_MAX = 255;
/** 苹野果：回复 PP 最少（缺得最多）的招式 10 点 */
export const LEPPA_PP = 10;

export function pocketOf(dex: Dex, id: string, keyItems: ReadonlyMap<string, KeyItemDef>): Pocket {
  const k = keyItems.get(id);
  if (k) return k.pocket;
  if (id.endsWith('-berry')) return 'berries';
  if (id.startsWith('exp-candy')) return 'medicine';
  const cat = dex.item(id)?.category ?? '';
  if (cat.endsWith('balls')) return 'balls';
  if (['healing', 'revival', 'status-cures', 'medicine', 'vitamins'].includes(cat)) return 'medicine';
  if (cat === 'evolution' || id === 'kings-rock') return 'evolution';
  if (['held-items', 'choice', 'type-enhancement', 'species-specific'].includes(cat)) return 'held';
  return 'key';
}

export function itemInfo(dex: Dex, id: string, keyItems: ReadonlyMap<string, KeyItemDef>): ItemInfo {
  const k = keyItems.get(id);
  const d = dex.item(id);
  const pocket = pocketOf(dex, id, keyItems);
  return {
    id,
    name: k?.name ?? d?.name.zh ?? id,
    desc: k?.desc ?? d?.shortEffect.replace(/\s+/g, '') ?? '',
    pocket,
    usable: pocket === 'medicine' || pocket === 'berries' || pocket === 'evolution' || pocket === 'tms',
    holdable: pocket === 'held' || pocket === 'berries' || id === 'kings-rock' || id === 'linking-cord',
    tossable: pocket !== 'key' && pocket !== 'tms',
  };
}

/** 背包中某口袋的物品（按 id 排序稳定显示） */
export function pocketItems(dex: Dex, bag: Readonly<Record<string, number>>, pocket: Pocket, keyItems: ReadonlyMap<string, KeyItemDef>): { id: string; qty: number }[] {
  return Object.entries(bag)
    .filter(([id, q]) => q > 0 && pocketOf(dex, id, keyItems) === pocket)
    .map(([id, qty]) => ({ id, qty }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** 经验糖果的经验量 */
const EXP_CANDY: Record<string, number> = { 'exp-candy-xs': 100, 'exp-candy-s': 800, 'exp-candy-m': 3000, 'exp-candy-l': 10000, 'exp-candy-xl': 30000 };

export type UseResult =
  | { ok: true; messages: string[]; consumed: boolean; evolveTo?: number; learnMove?: string }
  | { ok: false; messages: string[] };

/** 使用道具的上下文：时段（进化判定）；洗练道具需要的能力项与随机数 */
export interface ItemUseContext {
  timeOfDay: 'day' | 'night';
  stat?: BaseStatId | undefined;
  /** 返回 0–31 的个体值；缺省用 Math.random */
  roll?: (() => number) | undefined;
  /** 返回 [0,1) 的随机数（头目素材领悟判定）；缺省用 Math.random */
  chance?: (() => number) | undefined;
}

const STAT_ZH: Record<BaseStatId, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };

const noEffect = (): UseResult => ({ ok: false, messages: ['即使使用也没有效果。'] });

/** 预判：对这只宝可梦使用是否有效果（界面用来提示“没有效果”，不修改状态） */
export function canUseOn(dex: Dex, id: string, p: PokemonInstance, keyItems: ReadonlyMap<string, KeyItemDef>): boolean {
  const clone = structuredClone(p);
  const r = applyToPokemon(dex, id, clone, keyItems, { timeOfDay: 'day' });
  return r.ok;
}

/**
 * 对宝可梦使用道具（直接修改 p；不改背包）。进化石返回 evolveTo，由调用方演出后调用 progression.evolve；
 * 招式学习器返回 learnMove（4 招已满时由调用方让玩家选择忘记的招式）。
 */
export function applyToPokemon(dex: Dex, id: string, p: PokemonInstance, keyItems: ReadonlyMap<string, KeyItemDef>, ctx: ItemUseContext): UseResult {
  const name = p.nickname ?? dex.species(p.speciesId).name.zh;
  const max = maxHp(dex, p);
  const key = keyItems.get(id);
  if (key?.pocket === 'tms' && key.move) {
    if (!dex.hasMove(key.move)) return noEffect();
    if (p.moves.some((m) => m.id === key.move)) return { ok: false, messages: [`${name}已经学会了「${dex.move(key.move).name.zh}」。`] };
    if (!tmCompatible(dex, p, key.move)) return { ok: false, messages: [`${name}无法学会「${dex.move(key.move).name.zh}」。`] };
    return { ok: true, messages: [], consumed: false, learnMove: key.move };
  }
  const mat = ALPHA_MATERIAL_BY_ID.get(id);
  if (mat) {
    // 头目素材：属性符合才能喂；无论成败都消耗，失败累计保底
    if (!dex.hasMove(mat.move)) return noEffect();
    const mv = dex.move(mat.move);
    if (p.moves.some((m) => m.id === mat.move)) return { ok: false, messages: [`${name}已经掌握了「${mv.name.zh}」。`] };
    if (!dex.species(p.speciesId).types.includes(mv.type)) return { ok: false, messages: [`${name}对${mat.name}没有反应……（属性不符）`] };
    if (!machineCompatible(dex, p, mat.move)) return { ok: false, messages: [`${name}无法领悟「${mv.name.zh}」……（招式学习器不兼容）`] };
    const fails = p.alphaInsight?.[mat.move] ?? 0;
    const roll = (ctx.chance ?? Math.random)();
    if (roll < insightChance(fails)) {
      if (p.alphaInsight) {
        delete p.alphaInsight[mat.move];
        if (!Object.keys(p.alphaInsight).length) delete p.alphaInsight;
      }
      return { ok: true, messages: [`${name}吃下了${mat.name}……`, `头目的气息流入了${name}的身体！`], consumed: true, learnMove: mat.move };
    }
    p.alphaInsight = { ...p.alphaInsight, [mat.move]: fails + 1 };
    return { ok: true, messages: [`${name}吃下了${mat.name}……`, `似乎感受到了什么，但还没能领悟。（下次几率 ${Math.round(insightChance(fails + 1) * 100)}%）`], consumed: true };
  }
  if (id.startsWith('mint-') && key) {
    // 性格薄荷：濒死也能用；同性格没有效果
    const nature = id.slice(5);
    if (p.nature === nature) return noEffect();
    p.nature = nature;
    const newMax = maxHp(dex, p);
    if (p.hp > 0) p.hp = Math.max(1, Math.min(newMax, p.hp));
    return { ok: true, messages: [`${name}的性格变得像「${dex.nature(nature).name.zh}」一样了！`], consumed: true };
  }
  const vit = VITAMINS[id];
  if (vit) {
    // 营养剂：+10 努力值（单项 252 / 合计 510 封顶），濒死也能用
    if (p.evs[vit] >= EV_MAX_PER_STAT || evTotal(p.evs) >= EV_MAX_TOTAL) return noEffect();
    const before = p.evs[vit];
    addEvs(p.evs, { [vit]: VITAMIN_EV });
    // HP 努力值提高后最大 HP 可能变大：当前 HP 同步加上差值
    if (vit === 'hp' && p.hp > 0) p.hp += Math.max(0, maxHp(dex, p) - max);
    const gained = p.evs[vit] - before;
    const zh = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' }[vit];
    return { ok: true, messages: [`${name}的${zh}努力值提高了 ${gained} 点！`], consumed: true };
  }
  if (IV_ITEMS[id]) {
    // 个体值洗练：濒死也能用。需要选能力的道具没给能力时只做预判（不修改、不消耗）
    if (!ivItemUsable(id, p.ivs)) return { ok: false, messages: [`${name}的个体值已经全部是最棒的了。`] };
    if (IV_ITEMS[id]!.needsStat && !ctx.stat) return { ok: true, messages: [], consumed: false };
    const roll = ctx.roll ?? (() => Math.floor(Math.random() * (IV_MAX + 1)));
    const changes = applyIvItem(id, p.ivs, ctx.stat, roll);
    if (!changes) return noEffect();
    // 最大 HP 变化：保持已损失的 HP 不变
    const newMax = maxHp(dex, p);
    if (p.hp > 0) p.hp = Math.max(1, Math.min(newMax, p.hp + newMax - max));
    const lines = changes.map((c) => `${STAT_ZH[c.stat]} ${c.from} → ${c.to}${c.to > c.from ? ' ↑' : c.to < c.from ? ' ↓' : ''}`);
    const head = IV_ITEMS[id]!.kind === 'cap' || IV_ITEMS[id]!.kind === 'gold-cap' ? `${name}的潜能被激发了！` : `${name}的个体值重新洗练了！`;
    return { ok: true, messages: [head, lines.join('　')], consumed: true };
  }
  const evStat = EV_BERRIES[id];
  if (evStat) {
    // 降努力值树果：努力值和亲密度都已到头时没有效果；濒死也能吃
    if (p.evs[evStat] <= 0 && p.friendship >= FRIENDSHIP_MAX) return noEffect();
    const msgs: string[] = [];
    if (p.evs[evStat] > 0) {
      const drop = Math.min(EV_BERRY_DROP, p.evs[evStat]);
      p.evs[evStat] -= drop;
      if (evStat === 'hp' && p.hp > 0) p.hp = Math.max(1, Math.min(p.hp, maxHp(dex, p)));
      msgs.push(`${name}的${STAT_ZH[evStat]}努力值降低了 ${drop} 点。`);
    } else msgs.push(`${name}的${STAT_ZH[evStat]}努力值已经无法再降低了。`);
    if (p.friendship < FRIENDSHIP_MAX) {
      p.friendship = Math.min(FRIENDSHIP_MAX, p.friendship + friendshipGain(p.friendship));
      msgs.push(`${name}看起来更亲近你了！`);
    }
    return { ok: true, messages: msgs, consumed: true };
  }
  if (id === 'leppa-berry') {
    let best: (typeof p.moves)[number] | null = null;
    for (const m of p.moves) if (m.pp < m.maxPp && (!best || m.maxPp - m.pp > best.maxPp - best.pp)) best = m;
    if (!best) return noEffect();
    const amt = Math.min(LEPPA_PP, best.maxPp - best.pp);
    best.pp += amt;
    return { ok: true, messages: [`${name}的「${dex.hasMove(best.id) ? dex.move(best.id).name.zh : best.id}」PP 恢复了 ${amt} 点！`], consumed: true };
  }
  if (id === 'revive') {
    if (p.hp > 0) return noEffect();
    p.hp = Math.floor(max / 2);
    p.status = null;
    return { ok: true, messages: [`${name}恢复了精神！`], consumed: true };
  }
  if (id.startsWith('exp-candy')) {
    // 经验糖果L：获得 10000 点经验（濒死也能吃；满级无效）
    if (p.level >= 100) return noEffect();
    const recs = gainExp(dex, p, EXP_CANDY[id] ?? 10000);
    const msgs = [`${name}获得了 ${EXP_CANDY[id] ?? 10000} 点经验值！`];
    const pending: string[] = [];
    for (const r of recs) {
      msgs.push(`${name}升到了 ${r.level} 级！`);
      for (const m of r.learned) msgs.push(`${name}学会了「${dex.hasMove(m) ? dex.move(m).name.zh : m}」！`);
      pending.push(...r.pending);
    }
    const evo = checkEvolution(dex, p, { timeOfDay: ctx.timeOfDay });
    return {
      ok: true,
      messages: msgs,
      consumed: true,
      ...(evo !== null ? { evolveTo: evo } : {}),
      ...(pending[0] !== undefined ? { learnMove: pending[0] } : {}),
    };
  }
  if (p.hp <= 0) return noEffect();
  const heal = HEAL_AMOUNT[id] ?? BERRY_HEAL[id]?.(max);
  if (heal !== undefined) {
    if (p.hp >= max) return noEffect();
    const amt = Math.min(max - p.hp, heal);
    p.hp += amt;
    return { ok: true, messages: [`${name}的 HP 恢复了 ${amt} 点！`], consumed: true };
  }
  const cure = STATUS_CURES[id];
  if (cure) {
    if (!p.status || !cure.includes(p.status.kind)) return noEffect();
    p.status = null;
    return { ok: true, messages: [`${name}的异常状态治好了！`], consumed: true };
  }
  if (pocketOf(dex, id, keyItems) === 'evolution') {
    const to = checkEvolution(dex, p, { timeOfDay: ctx.timeOfDay, usedItem: id });
    if (to === null) return noEffect();
    return { ok: true, messages: [], consumed: true, evolveTo: to };
  }
  return { ok: false, messages: ['现在不能使用这个道具。'] };
}

/**
 * 招式学习器兼容性：查 config/tms/compat.json（pnpm gen:tms 按规则生成）。
 * 表里没有的招式（调试 / 未登记）退回规则：进化家族学招表里有，或同属性。
 */
export function tmCompatible(dex: Dex, p: PokemonInstance, move: string): boolean {
  const ids = (TM_COMPAT as Record<string, number[]>)[`tm-${move}`];
  if (ids) return ids.includes(p.speciesId);
  return computeTmCompat(dex.allSpecies(), dex.move(move).type, { move }).includes(p.speciesId);
}

/**
 * 能否用招式学习器学会：项目内招式学习器按 compat.json；其余招式按图鉴数据的招式学习器列表（species.machineMoves）
 */
export function machineCompatible(dex: Dex, p: PokemonInstance, move: string): boolean {
  const ids = (TM_COMPAT as Record<string, number[]>)[`tm-${move}`];
  if (ids) return ids.includes(p.speciesId);
  return !!dex.species(p.speciesId).machineMoves?.includes(move);
}

/** 背包里使用：检查数量 → 生效 → 扣除 */
export function useFromBag(dex: Dex, s: GameState, id: string, partyIndex: number, keyItems: ReadonlyMap<string, KeyItemDef>, ctx: ItemUseContext): UseResult {
  const p = s.party[partyIndex];
  if (!p || (s.bag[id] ?? 0) <= 0) return { ok: false, messages: ['没有这个道具。'] };
  const r = applyToPokemon(dex, id, p, keyItems, ctx);
  if (r.ok && r.consumed) removeItem(s, id, 1);
  return r;
}

/** 让宝可梦携带道具；原来携带的放回背包。返回被换下的道具 */
export function giveHeldItem(s: GameState, partyIndex: number, id: string): { ok: boolean; previous: string | null } {
  const p = s.party[partyIndex];
  if (!p || !removeItem(s, id, 1)) return { ok: false, previous: null };
  const prev = p.heldItem;
  if (prev) addItem(s, prev, 1);
  p.heldItem = id;
  return { ok: true, previous: prev };
}

export function takeHeldItem(s: GameState, partyIndex: number): string | null {
  const p = s.party[partyIndex];
  if (!p?.heldItem) return null;
  const id = p.heldItem;
  addItem(s, id, 1);
  p.heldItem = null;
  return id;
}

export function tossItem(s: GameState, id: string, qty: number): boolean {
  if (qty <= 0) return false;
  return removeItem(s, id, Math.min(qty, s.bag[id] ?? 0));
}

/** 交换队伍顺序 */
export function swapParty(s: GameState, i: number, j: number): boolean {
  if (i === j || !s.party[i] || !s.party[j]) return false;
  [s.party[i], s.party[j]] = [s.party[j]!, s.party[i]!];
  return true;
}

export { teachMove };
