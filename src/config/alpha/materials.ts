/**
 * 头目专属素材（领悟头目招式）：每个巢穴头目掉落各自的素材。
 * 在背包「素材」口袋对宝可梦使用（喂食）：宝可梦需具备招式的属性，且能用招式学习器学会该招式（同招式学习器兼容规则）；有几率领悟该头目招式，
 * 失败次数累积会提高下一次的几率（保底），素材无论成败都会消耗。
 */
export interface AlphaMaterialDef {
  /** 道具 id */
  id: string;
  /** 掉落该素材的巢穴 */
  den: string;
  name: string;
  desc: string;
  /** 领悟的头目招式 */
  move: string;
  /** 图标主色 */
  color: string;
}

/** 首次喂食的领悟几率；每失败一次 +INSIGHT_STEP，4 次失败后必定领悟 */
export const INSIGHT_BASE = 0.3;
export const INSIGHT_STEP = 0.2;

export const ALPHA_MATERIALS: AlphaMaterialDef[] = [
  { id: 'alpha-mat-meadow', den: 'den-meadow', name: '烈风翎羽', desc: '草原大巢头目比比鸟脱落的翎羽，仍带着劲风。', move: 'fly', color: '#d9a35a' },
  { id: 'alpha-mat-lakeside', den: 'den-lakeside', name: '怒涛逆鳞', desc: '湖东浅滩头目暴鲤龙的逆鳞，摸上去冰冷而沉重。', move: 'waterfall', color: '#3a7fd0' },
  { id: 'alpha-mat-cliffs', den: 'den-cliffs', name: '海崖风羽', desc: '海崖之巅头目大嘴鸥的飞羽，闻得到海风的咸味。', move: 'hurricane', color: '#8fd0e8' },
  { id: 'alpha-mat-forest', den: 'den-forest', name: '幻影黑鬃', desc: '森林石圈头目索罗亚克的鬃毛，看久了会觉得它在晃动。', move: 'foul-play', color: '#6a2a4a' },
  { id: 'alpha-mat-highlands', den: 'den-highlands', name: '石冢核晶', desc: '高地石冢头目体内凝结的晶核，坚硬得敲不出痕迹。', move: 'stone-edge', color: '#9a8a6a' },
  { id: 'alpha-mat-delta', den: 'den-delta', name: '巨钳甲片', desc: '河口泥滩头目巨钳蟹蜕下的钳甲碎片。', move: 'liquidation', color: '#d0503a' },
];

export const ALPHA_MATERIAL_BY_ID = new Map(ALPHA_MATERIALS.map((m) => [m.id, m]));
export const ALPHA_MATERIAL_BY_DEN = new Map(ALPHA_MATERIALS.map((m) => [m.den, m]));

/** 第 fails+1 次喂食的领悟几率 */
export function insightChance(fails: number): number {
  return Math.min(1, INSIGHT_BASE + INSIGHT_STEP * Math.max(0, fails));
}
