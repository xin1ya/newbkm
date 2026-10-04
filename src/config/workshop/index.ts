/**
 * 计划文档 §9.5 · 工坊配方（宝可梦中心左侧的工作台，工匠阿铁）。素材来自野外采集（计划 §9.2）、头目奖励与树果。
 */
import type { Recipe } from '@/systems/breeder/workshop';
import { BERRIES } from '@/config/berries';

/** 稀有树果：半减果与风味果 */
export const RARE_BERRIES: readonly string[] = BERRIES.filter((b) => b.category === 'resist' || b.category === 'flavor').map((b) => b.id);

export const RECIPES: readonly Recipe[] = [
  { id: 'potion', out: { item: 'potion', qty: 1 }, inputs: [{ item: 'medicinal-herb', qty: 2 }], level: 1 },
  { id: 'antidote', out: { item: 'antidote', qty: 1 }, inputs: [{ item: 'medicinal-herb', qty: 1 }, { item: 'pecha-berry', qty: 1 }], level: 1 },
  { id: 'super-potion', out: { item: 'super-potion', qty: 1 }, inputs: [{ item: 'medicinal-herb', qty: 2 }, { item: 'fragrant-herb', qty: 1 }, { item: 'oran-berry', qty: 1 }], level: 2 },
  { id: 'poke-ball', out: { item: 'poke-ball', qty: 2 }, inputs: [{ item: 'gravel', qty: 2 }, { item: 'hard-ore', qty: 1 }], level: 2 },
  { id: 'growth-mulch', out: { item: 'growth-mulch', qty: 2 }, inputs: [{ item: 'tiny-mushroom', qty: 2 }, { item: 'gravel', qty: 1 }], level: 3 },
  { id: 'rich-mulch', out: { item: 'rich-mulch', qty: 2 }, inputs: [{ item: 'big-mushroom', qty: 1 }, { item: 'seashell', qty: 2 }], level: 3 },
  { id: 'damp-mulch', out: { item: 'damp-mulch', qty: 2 }, inputs: [{ item: 'seashell', qty: 2 }, { item: 'fragrant-herb', qty: 1 }], level: 3 },
  { id: 'great-ball', out: { item: 'great-ball', qty: 1 }, inputs: [{ item: 'hard-ore', qty: 2 }, { item: 'pearl', qty: 1 }], level: 4 },
  { id: 'revive', out: { item: 'revive', qty: 1 }, inputs: [{ item: 'glow-mushroom', qty: 1 }, { item: 'medicinal-herb', qty: 2 }, { item: 'honey', qty: 1 }], level: 5 },
  { id: 'surprise-mulch', out: { item: 'surprise-mulch', qty: 1 }, inputs: [{ item: 'glow-mushroom', qty: 1 }, { item: 'pearl', qty: 1 }], level: 6 },
  { id: 'hyper-potion', out: { item: 'hyper-potion', qty: 1 }, inputs: [{ item: 'big-mushroom', qty: 1 }, { item: 'fragrant-herb', qty: 2 }, { item: 'sitrus-berry', qty: 1 }], level: 6 },
  { id: 'mint', out: { item: 'mint', qty: 1 }, inputs: [{ item: 'alpha-scale', qty: 1 }, { anyOf: RARE_BERRIES, label: '稀有树果（半减果 / 风味果）', qty: 2 }], level: 7, mint: true },
];
