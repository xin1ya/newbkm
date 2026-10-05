/**
 * 雷鸣群岛遇敌表（M3-03 临时版）。
 * 等级与 src/config/islands/thunder.ts 各区域 levelRange 对应。
 * 目前只用已有模型的物种；M3-28（雷鸣生态定稿 + 新模型）会把电 / 冰 / 岩系新物种替换进来。
 */
import type { EncounterTable } from '@/systems/encounters';
import { DEFAULT_SHINY_CHANCE } from '@/systems/encounters';
import { ROAMING_CHANCE } from '@/systems/alpha';

const base = { alphaChance: ROAMING_CHANCE, shinyChance: DEFAULT_SHINY_CHANCE, grassRatePerMeter: 0.05 } as const;

export const THUNDER_ENCOUNTERS: Record<string, EncounterTable> = {
  // —— 碧潮—雷鸣海域（冲浪）——
  'thunder-sea-route': {
    id: 'thunder-sea-route',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 72, weight: 30, levels: [26, 30], methods: ['surf', 'visible'] }, // 玛瑙水母
      { speciesId: 73, weight: 8, levels: [30, 32], methods: ['surf'], formation: 'rare' }, // 毒刺水母
      { speciesId: 278, weight: 20, levels: [26, 30], formation: 'group', groupSize: [2, 4] }, // 长翅鸥
      { speciesId: 279, weight: 10, levels: [29, 32] }, // 大嘴鸥
      { speciesId: 120, weight: 14, levels: [26, 30], methods: ['surf', 'visible'] }, // 海星星
      { speciesId: 129, weight: 24, levels: [26, 30], methods: ['fish', 'surf', 'visible'] }, // 鲤鱼王
      { speciesId: 130, weight: 2, levels: [30, 32], methods: ['fish', 'surf'], formation: 'rare' }, // 暴鲤龙
      { speciesId: 91, weight: 6, levels: [28, 32], methods: ['fish', 'surf'] }, // 刺甲贝
      { speciesId: 98, weight: 16, levels: [26, 30], methods: ['fish', 'surf'] }, // 大钳蟹
      { speciesId: 61, weight: 16, levels: [26, 31], methods: ['surf', 'visible'] }, // 蚊香君
    ],
  },
  'thunder-nearshore': {
    id: 'thunder-nearshore',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 73, weight: 20, levels: [32, 36], methods: ['surf', 'visible'] },
      { speciesId: 279, weight: 18, levels: [32, 36] },
      { speciesId: 121, weight: 8, levels: [34, 38], methods: ['surf'], formation: 'rare' }, // 宝石海星
      { speciesId: 91, weight: 14, levels: [32, 36], methods: ['fish', 'surf'] },
      { speciesId: 342, weight: 10, levels: [33, 37], methods: ['fish', 'surf'] }, // 铁螯龙虾
      { speciesId: 130, weight: 4, levels: [34, 38], methods: ['fish', 'surf'], formation: 'rare' },
      { speciesId: 119, weight: 12, levels: [32, 36], methods: ['fish'] }, // 金鱼王
    ],
  },
  // —— 雷鸣平原 / 风暴高地 / 灯塔岬（电 + 飞行）——
  'thunder-plain': {
    id: 'thunder-plain',
    ...base,
    density: [9, 13],
    entries: [
      { speciesId: 25, weight: 22, levels: [31, 34], formation: 'group', groupSize: [2, 3] }, // 皮卡丘
      { speciesId: 172, weight: 10, levels: [31, 33], time: 'day' }, // 皮丘
      { speciesId: 26, weight: 3, levels: [34, 35], formation: 'rare' }, // 雷丘
      { speciesId: 397, weight: 20, levels: [31, 35] }, // 姆克鸟
      { speciesId: 162, weight: 18, levels: [31, 35] }, // 大尾立
      { speciesId: 264, weight: 14, levels: [31, 35] }, // 直冲熊
      { speciesId: 164, weight: 14, levels: [32, 35], time: 'night' }, // 猫头夜鹰
    ],
  },
  'storm-highland': {
    id: 'storm-highland',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 25, weight: 18, levels: [32, 35] },
      { speciesId: 26, weight: 5, levels: [35, 36], formation: 'rare' },
      { speciesId: 75, weight: 20, levels: [32, 36] }, // 隆隆石
      { speciesId: 67, weight: 14, levels: [32, 36] }, // 豪力
      { speciesId: 397, weight: 16, levels: [32, 35] },
      { speciesId: 398, weight: 3, levels: [35, 36], formation: 'rare' }, // 姆克鹰
      { speciesId: 42, weight: 14, levels: [32, 36], time: 'night' }, // 大嘴蝠
    ],
  },
  'lighthouse-cape': {
    id: 'lighthouse-cape',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 279, weight: 22, levels: [35, 39] },
      { speciesId: 26, weight: 10, levels: [36, 39] },
      { speciesId: 17, weight: 18, levels: [35, 38] }, // 比比鸟
      { speciesId: 18, weight: 4, levels: [38, 39], formation: 'rare' }, // 大比鸟
      { speciesId: 222, weight: 10, levels: [35, 38] }, // 太阳珊瑚（礁岸）
      { speciesId: 99, weight: 12, levels: [35, 39] }, // 巨钳蟹
    ],
  },
  'dawn-hills': {
    id: 'dawn-hills',
    ...base,
    density: [9, 13],
    entries: [
      { speciesId: 162, weight: 18, levels: [34, 38] },
      { speciesId: 166, weight: 12, levels: [34, 38], time: 'day' }, // 安瓢虫
      { speciesId: 284, weight: 10, levels: [34, 38], weather: ['rain'] }, // 雨翅蛾
      { speciesId: 182, weight: 8, levels: [35, 38], time: 'day', formation: 'rare' }, // 美丽花
      { speciesId: 286, weight: 12, levels: [34, 38] }, // 斗笠菇
      { speciesId: 59, weight: 3, levels: [37, 38], formation: 'rare' }, // 风速狗
      { speciesId: 164, weight: 14, levels: [34, 38], time: 'night' },
    ],
  },
  // —— 冰川 / 霜冻之路 / 云崖（冰 + 岩）——
  glacier: {
    id: 'glacier',
    ...base,
    density: [7, 10],
    entries: [
      { speciesId: 91, weight: 14, levels: [38, 42] }, // 刺甲贝（冰缝水洼）
      { speciesId: 28, weight: 20, levels: [38, 42] }, // 穿山王
      { speciesId: 76, weight: 8, levels: [40, 42], formation: 'rare' }, // 隆隆岩
      { speciesId: 112, weight: 12, levels: [38, 42] }, // 钻角犀兽
      { speciesId: 42, weight: 14, levels: [38, 42], time: 'night' },
      { speciesId: 93, weight: 10, levels: [39, 42], time: 'night' }, // 鬼斯通
    ],
  },
  'frost-road': {
    id: 'frost-road',
    ...base,
    density: [7, 10],
    entries: [
      { speciesId: 28, weight: 18, levels: [40, 44] },
      { speciesId: 76, weight: 12, levels: [41, 44] },
      { speciesId: 68, weight: 8, levels: [42, 44], formation: 'rare' }, // 怪力
      { speciesId: 398, weight: 14, levels: [40, 44] },
      { speciesId: 169, weight: 8, levels: [41, 44], time: 'night' }, // 叉字蝠
      { speciesId: 208, weight: 4, levels: [42, 44], formation: 'rare' }, // 大钢蛇
    ],
  },
  'cloud-cliffs': {
    id: 'cloud-cliffs',
    ...base,
    density: [7, 10],
    entries: [
      { speciesId: 398, weight: 18, levels: [42, 46] },
      { speciesId: 18, weight: 12, levels: [42, 46] },
      { speciesId: 26, weight: 12, levels: [42, 46] },
      { speciesId: 112, weight: 12, levels: [42, 46] },
      { speciesId: 464, weight: 2, levels: [45, 46], formation: 'rare' }, // 超甲狂犀
      { speciesId: 94, weight: 6, levels: [43, 46], time: 'night', formation: 'rare' }, // 耿鬼
    ],
  },
};
