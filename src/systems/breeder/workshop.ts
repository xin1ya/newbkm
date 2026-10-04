/**
 * 计划文档 §9.5 · 工坊合成（纯逻辑）：配方按培育家等级解锁；素材从背包扣除，产物放进背包。
 * 输入可以是指定物品，也可以是「任选其一」的物品组（如稀有树果）；薄荷配方需要额外指定性格。
 */
import { addItem, removeItem, type GameState } from '../state';

export interface RecipeInput {
  /** 指定物品 */
  item?: string;
  /** 任选：其中任意物品合计 qty 个（按列表顺序优先扣） */
  anyOf?: readonly string[];
  /** 任选组的显示名（如「稀有树果」） */
  label?: string;
  qty: number;
}

export interface Recipe {
  id: string;
  /** 产物；mint 配方由玩家选性格（out.item 为占位 'mint'） */
  out: { item: string; qty: number };
  inputs: readonly RecipeInput[];
  /** 需要的培育家等级 */
  level: number;
  /** 薄荷 */
  mint?: boolean;
}

export function inputHave(s: GameState, inp: RecipeInput): number {
  if (inp.item) return s.bag[inp.item] ?? 0;
  return (inp.anyOf ?? []).reduce((a, id) => a + (s.bag[id] ?? 0), 0);
}

export function canCraft(s: GameState, r: Recipe, level: number): 'level' | 'materials' | null {
  if (level < r.level) return 'level';
  return r.inputs.every((i) => inputHave(s, i) >= i.qty) ? null : 'materials';
}

/** 合成；薄荷需要 outItem（mint-<性格>）。成功返回产物 */
export function craft(s: GameState, r: Recipe, level: number, outItem?: string): { item: string; qty: number } | null {
  if (canCraft(s, r, level)) return null;
  const item = r.mint ? outItem : r.out.item;
  if (!item || (r.mint && !item.startsWith('mint-'))) return null;
  for (const inp of r.inputs) {
    let left = inp.qty;
    const ids = inp.item ? [inp.item] : [...(inp.anyOf ?? [])];
    for (const id of ids) {
      const take = Math.min(left, s.bag[id] ?? 0);
      if (take > 0) removeItem(s, id, take);
      left -= take;
      if (left <= 0) break;
    }
  }
  addItem(s, item, r.out.qty);
  return { item, qty: r.out.qty };
}
