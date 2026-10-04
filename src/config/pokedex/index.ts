/**
 * M1-18 · 萌芽群岛地区图鉴（M1 范围 40 种，与 ART-003 P0 清单一致）。
 * 顺序：御三家进化线 → 按进化线排列的野生宝可梦 → 幻影之森的索罗亚。
 */
export interface RegionalDex {
  id: string;
  name: string;
  species: number[];
}

export const SPROUT_DEX: RegionalDex = {
  id: 'sprout',
  name: '萌芽图鉴',
  species: [
    722, 723, 724, 155, 156, 157, 258, 259, 260,
    16, 17, 18, 19, 20, 10, 11, 12, 172, 25, 26,
    43, 44, 45, 182, 60, 61, 62, 186, 72, 73,
    98, 99, 120, 121, 129, 130, 278, 279, 570, 571,
  ],
};
