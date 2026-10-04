/**
 * M1-19 · 商店（纯逻辑）：价格表、按徽章 / flag 解锁的货架、购买、出售。
 * - 出售价 = 买入价的一半（向下取整）；重要物品 / 招式学习器 / 没有定价的物品不能出售
 * - 一次买 10 个以上精灵球类道具额外赠送 1 个同款（翠澜商店的促销，替代原作的纪念球）
 * - 金钱上限与 GameState 的 MONEY_MAX 一致（addMoney 负责截断）
 */
import { addItem, addMoney, removeItem, type GameState } from '../state';

export interface ShopStock {
  item: string;
  /** 需要的徽章数量（缺省 0） */
  badges?: number;
  /** 需要的 flag */
  flag?: string;
  /** 只能购买 1 个（重要物品，如自行车）：背包里已有就下架 */
  once?: boolean;
}

export interface ShopDef {
  id: string;
  name: string;
  /** 欢迎语（店员说话人名） */
  greeting: string;
  stock: ShopStock[];
  /** 是否收购（市场小摊可以只卖不收） */
  buysBack: boolean;
  /** 价格倍率（市场小摊略贵 / 特价） */
  markup?: number;
}

export const BAG_ITEM_MAX = 999;

export function badgeCount(flags: Readonly<Record<string, boolean>>): number {
  return Object.keys(flags).filter((f) => f.startsWith('badge-') && flags[f]).length;
}

/** 当前可购买的货架（保持配置顺序） */
export function shopInventory(shop: ShopDef, flags: Readonly<Record<string, boolean>>, bag: Readonly<Record<string, number>> = {}): string[] {
  const badges = badgeCount(flags);
  return shop.stock
    .filter((s) => (s.badges ?? 0) <= badges && (!s.flag || flags[s.flag]) && !(s.once && (bag[s.item] ?? 0) > 0))
    .map((s) => s.item);
}

/** 限购 1 个的货品 */
export function isOnceItem(shop: ShopDef, item: string): boolean {
  return !!shop.stock.find((s) => s.item === item)?.once;
}

export function buyPrice(prices: Readonly<Record<string, number>>, shop: ShopDef, item: string): number | null {
  const base = prices[item];
  if (base === undefined) return null;
  return Math.round(base * (shop.markup ?? 1));
}

export function sellPrice(prices: Readonly<Record<string, number>>, item: string, sellable: boolean): number | null {
  const base = prices[item];
  if (!sellable || base === undefined || base <= 0) return null;
  return Math.floor(base / 2);
}

/** 以当前金钱与背包上限计算最多能买几个 */
export function maxAffordable(state: GameState, price: number, item: string): number {
  if (price <= 0) return 0;
  const room = BAG_ITEM_MAX - (state.bag[item] ?? 0);
  return Math.max(0, Math.min(room, Math.floor(state.money / price), 99));
}

export function isBallItem(item: string): boolean {
  return item.endsWith('-ball');
}

export type BuyResult =
  | { ok: true; spent: number; bonus: number }
  | { ok: false; reason: 'money' | 'stock' | 'qty' | 'bag' };

export function buy(state: GameState, prices: Readonly<Record<string, number>>, shop: ShopDef, item: string, qty: number): BuyResult {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' };
  if (!shopInventory(shop, state.flags, state.bag).includes(item)) return { ok: false, reason: 'stock' };
  if (isOnceItem(shop, item) && qty > 1) return { ok: false, reason: 'qty' };
  const price = buyPrice(prices, shop, item);
  if (price === null) return { ok: false, reason: 'stock' };
  const total = price * qty;
  if (total > state.money) return { ok: false, reason: 'money' };
  const bonus = isBallItem(item) && qty >= 10 ? Math.floor(qty / 10) : 0;
  if ((state.bag[item] ?? 0) + qty + bonus > BAG_ITEM_MAX) return { ok: false, reason: 'bag' };
  addMoney(state, -total);
  addItem(state, item, qty + bonus);
  return { ok: true, spent: total, bonus };
}

export type SellResult = { ok: true; earned: number } | { ok: false; reason: 'unsellable' | 'qty' | 'held' };

export function sell(state: GameState, prices: Readonly<Record<string, number>>, item: string, qty: number, sellable: boolean): SellResult {
  const unit = sellPrice(prices, item, sellable);
  if (unit === null) return { ok: false, reason: 'unsellable' };
  if (!Number.isInteger(qty) || qty < 1 || (state.bag[item] ?? 0) < qty) return { ok: false, reason: 'qty' };
  if (!removeItem(state, item, qty)) return { ok: false, reason: 'qty' };
  addMoney(state, unit * qty);
  return { ok: true, earned: unit * qty };
}
