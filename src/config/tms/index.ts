/**
 * 招式学习器（TM，可重复使用）· 计划文档 §6。
 *
 * - 编号 / 招式 / 获取途径在这里定义；可学物种表 compat.json 由 `pnpm gen:tms` 按规则生成
 *   （systems/tms 的 computeTmCompat：进化家族任一成员的学招表里有该招式、或与招式同属性；universal = 全部可学），
 *   tests/unit/tms.test.ts 校验生成表与规则一致。
 * - 道具 id 统一为 `tm-<招式 id>`，名字「招式学习器 No.xx 招式名」（招式名由 dex 填）。
 * - 获取：港湾大市场「阿岚招式摊」（shop）、翠澜道馆奖励（gym）、巢穴头目首次击败（den）、野外拾取（field）。
 */
export type TmSource =
  | { kind: 'shop'; shop: string; price: number; badges?: number }
  | { kind: 'gym'; gym: string }
  | { kind: 'den'; den: string }
  | { kind: 'field'; pickup: string; position: [number, number]; hint: string };

export interface TmDef {
  no: number;
  move: string;
  /** 所有物种都能学（守住 / 睡觉 / 高速星星这类通用招式） */
  universal?: boolean;
  source: TmSource;
}

export const TM_DEFS: readonly TmDef[] = [
  { no: 1, move: 'protect', universal: true, source: { kind: 'shop', shop: 'harbor-tms', price: 2000 } },
  { no: 2, move: 'rest', universal: true, source: { kind: 'shop', shop: 'harbor-tms', price: 3000, badges: 1 } },
  { no: 3, move: 'swift', universal: true, source: { kind: 'shop', shop: 'harbor-tms', price: 2000 } },
  { no: 4, move: 'water-pulse', source: { kind: 'gym', gym: 'gym-cuilan' } },
  { no: 5, move: 'mud-shot', source: { kind: 'shop', shop: 'harbor-tms', price: 1500 } },
  { no: 6, move: 'flame-charge', source: { kind: 'shop', shop: 'harbor-tms', price: 1500 } },
  { no: 7, move: 'thunder-wave', source: { kind: 'shop', shop: 'harbor-tms', price: 1500, badges: 1 } },
  { no: 8, move: 'bug-bite', source: { kind: 'shop', shop: 'harbor-tms', price: 1000 } },
  { no: 9, move: 'air-slash', source: { kind: 'den', den: 'den-meadow' } },
  { no: 10, move: 'giga-drain', source: { kind: 'shop', shop: 'harbor-tms', price: 3000, badges: 1 } },
  { no: 11, move: 'psybeam', source: { kind: 'field', pickup: 'tm-west-beach', position: [-300, 250], hint: '沙滩上有个闪闪发光的东西' } },
  { no: 12, move: 'hex', source: { kind: 'field', pickup: 'tm-phantom-forest', position: [-330, -250], hint: '雾中的树根旁有个发光的东西' } },
  { no: 13, move: 'poison-jab', source: { kind: 'field', pickup: 'tm-meadow', position: [-180, 200], hint: '草丛里有个闪闪发光的东西' } },
  { no: 14, move: 'iron-tail', source: { kind: 'den', den: 'den-delta' } },
  { no: 15, move: 'rock-slide', source: { kind: 'den', den: 'den-highlands' } },
  { no: 16, move: 'shadow-ball', source: { kind: 'den', den: 'den-forest' } },
  { no: 17, move: 'snarl', source: { kind: 'field', pickup: 'tm-woodland', position: [-210, -60], hint: '林间空地上有个发光的东西' } },
  { no: 18, move: 'ice-fang', source: { kind: 'den', den: 'den-lakeside' } },
  { no: 19, move: 'thunderbolt', source: { kind: 'den', den: 'den-cliffs' } },
  { no: 20, move: 'flamethrower', source: { kind: 'field', pickup: 'tm-highlands', position: [-50, -260], hint: '高地的岩石间有个发光的东西' } },
  { no: 21, move: 'confusion', source: { kind: 'shop', shop: 'harbor-tms', price: 1000 } },
  // M2 · 碧潮群岛道馆奖励（07-22 §3.6 #6/#8/#10）
  { no: 22, move: 'magical-leaf', source: { kind: 'gym', gym: 'gym-azure' } },
  { no: 23, move: 'rock-tomb', source: { kind: 'gym', gym: 'gym-ore' } },
  { no: 24, move: 'incinerate', source: { kind: 'gym', gym: 'gym-flame' } },
  // M3-15 · 雷鸣群岛道馆奖励（07-22 §3.6 #15/#16/#18/#19；十万伏特已是 No.19 巢穴奖励，雷鸣道馆改发「电击波」）
  { no: 25, move: 'shock-wave', source: { kind: 'gym', gym: 'gym-thunder' } },
  { no: 26, move: 'facade', source: { kind: 'gym', gym: 'gym-dawn' } },
  { no: 27, move: 'icy-wind', source: { kind: 'gym', gym: 'gym-snow' } },
  { no: 28, move: 'aerial-ace', source: { kind: 'gym', gym: 'gym-lark' } },
];

export const tmItemId = (move: string): string => `tm-${move}`;
export const TM_BY_ITEM: ReadonlyMap<string, TmDef> = new Map(TM_DEFS.map((t) => [tmItemId(t.move), t]));
export const TM_BY_DEN: ReadonlyMap<string, TmDef> = new Map(TM_DEFS.flatMap((t) => (t.source.kind === 'den' ? [[t.source.den, t] as const] : [])));
export const tmLabel = (no: number): string => `No.${String(no).padStart(2, '0')}`;
