/**
 * 计划文档 §9.2 / §9.5 · 采集素材（不在 PokeAPI 道具表里）。心之鳞片已在 config/items 注册。
 */
import type { KeyItemDef } from '@/systems/items';

export const GATHER_ITEMS: KeyItemDef[] = [
  { id: 'medicinal-herb', name: '药草', desc: '草原和林缘常见的药草，带着淡淡的苦味。蒲婆婆说可以用来调配伤药。', pocket: 'treasure' },
  { id: 'fragrant-herb', name: '清香草', desc: '叶片揉碎后有清凉香气的草，能做出效果更好的药。', pocket: 'treasure' },
  { id: 'seashell', name: '贝壳', desc: '退潮后留在沙滩上的漂亮贝壳。可以卖给港湾市的商人。', pocket: 'treasure' },
  { id: 'pearl', name: '珍珠', desc: '贝壳里偶尔藏着的小珍珠，泛着柔和的光泽。', pocket: 'treasure' },
  { id: 'tiny-mushroom', name: '小蘑菇', desc: '幻影之森里长成一圈的小蘑菇。', pocket: 'treasure' },
  { id: 'big-mushroom', name: '大蘑菇', desc: '伞盖很大的蘑菇，很少见。', pocket: 'treasure' },
  { id: 'glow-mushroom', name: '发光蘑菇', desc: '只在夜里冒出来的蘑菇，伞盖发出幽幽的青光。', pocket: 'treasure' },
  { id: 'gravel', name: '碎石', desc: '敲碎岩石得到的小石块，可以作为合成材料。', pocket: 'treasure' },
  { id: 'hard-ore', name: '硬矿石', desc: '非常坚硬的矿石，据说可以用来做精灵球的外壳。', pocket: 'treasure' },
  { id: 'honey', name: '甜甜蜜', desc: '香甜的蜂蜜。涂在蜂蜜树上，过一段时间可能会吸引稀有的宝可梦。', pocket: 'treasure' },
  // 计划文档 §9.3 种植：工具与肥料
  { id: 'watering-can', name: '喷壶', desc: '蒲婆婆送的铁皮喷壶。给田里的树果浇水，每个生长阶段至少浇一次，收成会更好。', pocket: 'key' },
  { id: 'growth-mulch', name: '成长肥', desc: '种下树果后（发芽前）施用，生长时间缩短 25%。', pocket: 'treasure' },
  { id: 'rich-mulch', name: '丰收肥', desc: '种下树果后（发芽前）施用，收获时多结 2 个果实。', pocket: 'treasure' },
  { id: 'damp-mulch', name: '恒久肥', desc: '种下树果后（发芽前）施用，土壤保水时间加倍。', pocket: 'treasure' },
  { id: 'surprise-mulch', name: '变异肥', desc: '种下树果后（发芽前）施用，收获时有机会额外长出稀有树果。', pocket: 'treasure' },
];
