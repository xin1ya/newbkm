/**
 * 萌芽群岛遇敌表（设计 §5.2）。等级范围与区域 levelRange 对应。
 */
import type { EncounterTable } from '@/systems/encounters';
import { DEFAULT_SHINY_CHANCE } from '@/systems/encounters';
import { ROAMING_CHANCE } from '@/systems/alpha';

/** alphaChance = 游荡头目出现率（计划文档 §3.2：0.4%） */
const base = { alphaChance: ROAMING_CHANCE, shinyChance: DEFAULT_SHINY_CHANCE, grassRatePerMeter: 0.05 } as const;

export const SPROUT_ENCOUNTERS: Record<string, EncounterTable> = {
  'sprout-meadow': {
    id: 'sprout-meadow',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 16, weight: 35, levels: [2, 4], time: 'day', formation: 'group', groupSize: [2, 3] }, // 波波
      { speciesId: 19, weight: 35, levels: [2, 4] }, // 小拉达
      { speciesId: 10, weight: 25, levels: [2, 4], time: 'day', methods: ['grass', 'visible'] }, // 绿毛虫
      { speciesId: 43, weight: 30, levels: [3, 5], time: 'night' }, // 走路草
      { speciesId: 25, weight: 4, levels: [3, 5], formation: 'rare' }, // 皮卡丘
      { speciesId: 172, weight: 3, levels: [2, 3], time: 'day', formation: 'rare', weather: ['clear'] }, // 皮丘
      { speciesId: 161, weight: 25, levels: [2, 4], time: 'day', formation: 'group', groupSize: [2, 3] }, // 尾立
      { speciesId: 263, weight: 22, levels: [2, 4] }, // 蛇纹熊
    ],
  },
  'cuilan-lakeside': {
    id: 'cuilan-lakeside',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 60, weight: 30, levels: [5, 8] }, // 蚊香蝌蚪
      { speciesId: 129, weight: 25, levels: [5, 9], methods: ['surf', 'fish', 'visible'] }, // 鲤鱼王
      { speciesId: 98, weight: 20, levels: [6, 8], formation: 'group', groupSize: [2, 3] }, // 大钳蟹
      { speciesId: 43, weight: 15, levels: [6, 8], time: 'night' },
      { speciesId: 11, weight: 12, levels: [6, 8], time: 'day' }, // 铁甲蛹
      { speciesId: 16, weight: 15, levels: [5, 7], time: 'day' },
      { speciesId: 25, weight: 4, levels: [6, 8], formation: 'rare', weather: ['rain', 'storm'] },
      { speciesId: 258, weight: 2, levels: [6, 8], formation: 'rare', weather: ['rain'] }, // 水跃鱼（稀有）
      // 生态新物种第 3 批
      { speciesId: 283, weight: 12, levels: [6, 8], weather: ['rain'], methods: ['visible', 'surf'] }, // 溜溜糖球
    ],
  },
  'harbor-cliffs': {
    id: 'harbor-cliffs',
    ...base,
    density: [6, 10],
    entries: [
      { speciesId: 278, weight: 40, levels: [8, 11], formation: 'group', groupSize: [2, 4] }, // 长翅鸥
      { speciesId: 16, weight: 20, levels: [8, 10], time: 'day' },
      { speciesId: 17, weight: 5, levels: [11, 12], formation: 'rare' }, // 比比鸟
      { speciesId: 98, weight: 20, levels: [8, 11] },
      { speciesId: 120, weight: 15, levels: [9, 11], time: 'night' }, // 海星星
      { speciesId: 19, weight: 15, levels: [8, 10], time: 'night' },
      // 生态新物种第 3 批
      { speciesId: 396, weight: 18, levels: [8, 10], time: 'day', formation: 'group', groupSize: [3, 5] }, // 姆克儿
    ],
  },
  'phantom-forest': {
    id: 'phantom-forest',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 43, weight: 30, levels: [6, 9] },
      { speciesId: 10, weight: 20, levels: [6, 8], time: 'day' },
      { speciesId: 11, weight: 15, levels: [7, 9] },
      { speciesId: 19, weight: 20, levels: [6, 9], time: 'night' },
      { speciesId: 722, weight: 3, levels: [7, 9], formation: 'rare', time: 'night' }, // 木木枭（稀有）
      { speciesId: 570, weight: 2, levels: [8, 10], formation: 'rare', weather: ['fog'] }, // 索罗亚（剧情外的稀有个体）
      { speciesId: 46, weight: 22, levels: [6, 9], time: 'night' }, // 派拉斯
      { speciesId: 163, weight: 22, levels: [6, 9], time: 'night' }, // 咕咕
      { speciesId: 92, weight: 18, levels: [7, 10], time: 'night' }, // 鬼斯
      { speciesId: 92, weight: 14, levels: [8, 10], weather: ['fog'] }, // 鬼斯（雾天白天也出现）
    ],
  },
  // ── 2026-10 生态扩充：先用现有 40 种模型填满新野区，新物种按批次加入（规划 §2.4）──
  'west-beach': {
    id: 'west-beach',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 98, weight: 30, levels: [3, 6], formation: 'group', groupSize: [2, 3] }, // 大钳蟹（礁石）
      { speciesId: 278, weight: 30, levels: [3, 6], formation: 'group', groupSize: [2, 4] }, // 长翅鸥
      { speciesId: 120, weight: 20, levels: [4, 6], time: 'night' }, // 海星星（潮池）
      { speciesId: 72, weight: 15, levels: [4, 6], methods: ['surf', 'visible'] }, // 玛瑙水母（近岸）
      { speciesId: 60, weight: 15, levels: [3, 5], weather: ['rain'] },
      { speciesId: 19, weight: 15, levels: [3, 5], time: 'night' },
      { speciesId: 129, weight: 15, levels: [3, 6], methods: ['fish', 'surf'] },
      { speciesId: 16, weight: 12, levels: [3, 5], time: 'day' },
      { speciesId: 25, weight: 3, levels: [4, 6], formation: 'rare', weather: ['clear'] },
      { speciesId: 258, weight: 2, levels: [5, 6], formation: 'rare', weather: ['rain'] }, // 水跃鱼
      // 生态新物种第 2 批
      { speciesId: 90, weight: 22, levels: [3, 6] }, // 大舌贝（沙滩 / 礁石边）
      { speciesId: 90, weight: 10, levels: [4, 6], methods: ['fish', 'surf'] }, // 大舌贝（钓鱼 / 近岸）
      { speciesId: 222, weight: 3, levels: [5, 6], formation: 'rare', weather: ['clear'] }, // 太阳珊瑚（晴天稀有）
      { speciesId: 769, weight: 3, levels: [5, 6], formation: 'rare', time: 'night' }, // 沙丘娃（夜晚稀有）
    ],
  },
  'sprout-woodland': {
    id: 'sprout-woodland',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 10, weight: 30, levels: [4, 6], time: 'day', methods: ['grass', 'visible'] }, // 绿毛虫
      { speciesId: 11, weight: 18, levels: [5, 7], time: 'day' }, // 铁甲蛹
      { speciesId: 16, weight: 25, levels: [4, 7], time: 'day', formation: 'group', groupSize: [2, 3] },
      { speciesId: 19, weight: 25, levels: [4, 7] },
      { speciesId: 43, weight: 30, levels: [4, 7], time: 'night' }, // 走路草
      { speciesId: 44, weight: 4, levels: [8, 8], time: 'night', weather: ['fog'] }, // 臭臭花
      { speciesId: 172, weight: 4, levels: [4, 5], time: 'day', formation: 'rare', weather: ['clear'] },
      { speciesId: 25, weight: 4, levels: [5, 7], formation: 'rare' },
      { speciesId: 722, weight: 2, levels: [6, 8], formation: 'rare', time: 'night' }, // 木木枭
      { speciesId: 155, weight: 2, levels: [6, 8], formation: 'rare', time: 'day' }, // 火球鼠
      { speciesId: 161, weight: 22, levels: [4, 7], time: 'day', formation: 'group', groupSize: [2, 3] }, // 尾立（林缘）
      { speciesId: 46, weight: 18, levels: [4, 7], time: 'night' }, // 派拉斯
      { speciesId: 163, weight: 20, levels: [5, 7], time: 'night' }, // 咕咕
    ],
  },
  'lanyuan-highlands': {
    id: 'lanyuan-highlands',
    ...base,
    density: [7, 11],
    entries: [
      { speciesId: 17, weight: 20, levels: [8, 11], time: 'day' }, // 比比鸟
      { speciesId: 16, weight: 20, levels: [7, 9], time: 'day', formation: 'group', groupSize: [2, 3] },
      { speciesId: 20, weight: 15, levels: [9, 11], time: 'night' }, // 拉达
      { speciesId: 19, weight: 20, levels: [7, 9] },
      { speciesId: 60, weight: 20, levels: [7, 10], methods: ['visible', 'surf'] }, // 溪涧
      { speciesId: 129, weight: 15, levels: [7, 11], methods: ['fish', 'surf'] },
      { speciesId: 43, weight: 15, levels: [7, 9], time: 'night' },
      { speciesId: 12, weight: 4, levels: [10, 11], time: 'day', weather: ['clear'] }, // 巴大蝶
      { speciesId: 26, weight: 2, levels: [11, 11], formation: 'rare', weather: ['storm', 'rain'] }, // 雷丘
      { speciesId: 156, weight: 2, levels: [10, 11], formation: 'rare', weather: ['clear'] }, // 火岩鼠
      // 生态新物种第 2 批
      { speciesId: 74, weight: 22, levels: [7, 10], formation: 'group', groupSize: [2, 3] }, // 小拳石（岩坡成群）
      { speciesId: 66, weight: 18, levels: [8, 11], time: 'day' }, // 腕力（白天在岩场锻炼）
      // 生态新物种第 3 批
      { speciesId: 396, weight: 22, levels: [8, 10], time: 'day', formation: 'group', groupSize: [3, 5] }, // 姆克儿（成群）
      { speciesId: 54, weight: 15, levels: [8, 10], methods: ['visible', 'surf'] }, // 可达鸭（溪涧）
    ],
  },
  'river-delta': {
    id: 'river-delta',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 60, weight: 30, levels: [8, 11] }, // 芦苇湿地
      { speciesId: 61, weight: 6, levels: [11, 12], weather: ['rain'] }, // 蚊香君
      { speciesId: 98, weight: 25, levels: [8, 11], formation: 'group', groupSize: [2, 3] },
      { speciesId: 278, weight: 25, levels: [8, 11], formation: 'group', groupSize: [2, 4] },
      { speciesId: 129, weight: 20, levels: [8, 12], methods: ['fish', 'surf', 'visible'] },
      { speciesId: 72, weight: 12, levels: [9, 12], methods: ['surf', 'visible'] },
      { speciesId: 120, weight: 12, levels: [9, 11], time: 'night' },
      { speciesId: 258, weight: 4, levels: [9, 11], formation: 'rare', weather: ['rain', 'storm'] },
      { speciesId: 259, weight: 1, levels: [12, 12], formation: 'rare', weather: ['storm'] }, // 沼跃鱼
      { speciesId: 186, weight: 1, levels: [12, 12], formation: 'rare', time: 'night', weather: ['rain'] }, // 牛蛙君
      // 生态新物种第 3 批
      { speciesId: 194, weight: 16, levels: [9, 12], time: 'night' }, // 乌波
      { speciesId: 194, weight: 10, levels: [9, 12], weather: ['rain'] },
      { speciesId: 283, weight: 14, levels: [9, 11], weather: ['rain'], methods: ['visible', 'surf'] }, // 溜溜糖球（雨天水面滑行）
      { speciesId: 341, weight: 20, levels: [9, 12] }, // 龙虾小兵
      { speciesId: 118, weight: 15, levels: [9, 12], methods: ['fish', 'surf'] }, // 角金鱼
    ],
  },
  'cuilan-river': {
    id: 'cuilan-river',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 60, weight: 25, levels: [5, 8] },
      { speciesId: 129, weight: 25, levels: [5, 9], methods: ['fish', 'surf', 'visible'] },
      { speciesId: 19, weight: 20, levels: [5, 8] },
      { speciesId: 16, weight: 20, levels: [5, 7], time: 'day', formation: 'group', groupSize: [2, 3] },
      { speciesId: 43, weight: 15, levels: [5, 8], time: 'night' },
      { speciesId: 10, weight: 12, levels: [5, 7], time: 'day' },
      { speciesId: 98, weight: 12, levels: [6, 8] },
      { speciesId: 263, weight: 20, levels: [5, 8] }, // 蛇纹熊（河谷）
      { speciesId: 182, weight: 1, levels: [9, 9], formation: 'rare', time: 'day', weather: ['clear'] }, // 美丽花
      { speciesId: 258, weight: 3, levels: [6, 8], formation: 'rare', weather: ['rain'] },
      // 生态新物种第 3 批
      { speciesId: 54, weight: 18, levels: [5, 8] }, // 可达鸭
      { speciesId: 194, weight: 16, levels: [5, 8], time: 'night' }, // 乌波（夜）
      { speciesId: 194, weight: 12, levels: [5, 8], weather: ['rain'] }, // 乌波（雨天白天也出来）
      { speciesId: 118, weight: 18, levels: [5, 8], methods: ['fish', 'surf'] }, // 角金鱼
    ],
  },
  'sea-route-1': {
    id: 'sea-route-1',
    ...base,
    density: [6, 10],
    entries: [
      { speciesId: 72, weight: 45, levels: [10, 14], methods: ['surf', 'visible'] }, // 玛瑙水母
      { speciesId: 278, weight: 25, levels: [10, 13] },
      { speciesId: 129, weight: 20, levels: [10, 14], methods: ['surf', 'fish'] },
      { speciesId: 120, weight: 10, levels: [11, 14], time: 'night', methods: ['surf', 'visible'] },
      { speciesId: 90, weight: 12, levels: [10, 13], methods: ['surf', 'fish'] }, // 大舌贝
      { speciesId: 222, weight: 3, levels: [11, 14], formation: 'rare', weather: ['clear'], methods: ['surf', 'visible'] }, // 太阳珊瑚（浅礁）
    ],
  },
};
