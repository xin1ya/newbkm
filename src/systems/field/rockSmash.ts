/**
 * M3-23 碎岩（hm05-rock-smash）：洞窟 / 塔里散落的「裂纹小岩」。
 *
 * - 有「碎岩」时对着裂纹岩按互动键 → 撞碎；没有时提示需要碎岩
 * - 撞碎后掷骰：一定概率从碎石里跳出野生宝可梦（房间遇敌表，method = 'cave'），否则按掉落表给道具，或什么都没有
 * - 撞碎的岩石只在本次进房间内消失；离开再进来会重新出现（经典「碎岩」玩法：可以反复刷）
 */
import type { Rng } from '../rng';

export const ROCK_SMASH_FLAG = 'hm05-rock-smash';

export interface SmashLootEntry {
  item: string;
  weight: number;
  /** 数量范围（缺省 1） */
  qty?: readonly [number, number];
}

export interface SmashRocksConfig {
  /** 裂纹小岩位置（局部坐标） */
  rocks: readonly (readonly [number, number])[];
  /** 掉落表（缺省 DEFAULT_SMASH_LOOT） */
  loot?: readonly SmashLootEntry[];
  /** 跳出野生宝可梦的概率（缺省 SMASH_WILD_CHANCE；房间没有遇敌表时为 0） */
  wildChance?: number;
  /** 掉道具的概率（缺省 SMASH_ITEM_CHANCE） */
  itemChance?: number;
}

export const SMASH_WILD_CHANCE = 0.2;
export const SMASH_ITEM_CHANCE = 0.45;

/** 通用洞窟掉落：碎石最多，偶尔硬矿石 / 硬石头 / 进化石 */
export const DEFAULT_SMASH_LOOT: readonly SmashLootEntry[] = [
  { item: 'gravel', weight: 50, qty: [1, 3] },
  { item: 'hard-ore', weight: 22 },
  { item: 'hard-stone', weight: 6 },
  { item: 'fire-stone', weight: 3 },
  { item: 'water-stone', weight: 3 },
  { item: 'thunder-stone', weight: 3 },
  { item: 'leaf-stone', weight: 3 },
  { item: 'pearl', weight: 6 },
  { item: 'revive', weight: 4 },
];

export type SmashResult = { kind: 'item'; item: string; qty: number } | { kind: 'wild' } | { kind: 'none' };

export function rollSmash(rng: Rng, cfg: SmashRocksConfig, hasEncounters: boolean): SmashResult {
  const wild = hasEncounters ? (cfg.wildChance ?? SMASH_WILD_CHANCE) : 0;
  const r = rng.next();
  if (r < wild) return { kind: 'wild' };
  if (r < wild + (cfg.itemChance ?? SMASH_ITEM_CHANCE)) {
    const loot = cfg.loot?.length ? cfg.loot : DEFAULT_SMASH_LOOT;
    const e = loot[rng.weighted(loot.map((l) => l.weight))]!;
    const qty = e.qty ? rng.int(e.qty[0], e.qty[1]) : 1;
    return { kind: 'item', item: e.item, qty };
  }
  return { kind: 'none' };
}
