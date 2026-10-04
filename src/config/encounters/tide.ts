/**
 * 碧潮群岛遇敌表（M2-18，设计 §5.2 / 3D 设计 §3.2–3.4）。
 * 等级范围与 src/config/islands/tide.ts 中各区域 levelRange 对应；
 * 洞窟 / 遗迹表（ore-mine / volcano-cave / anomaly-ruins）供室内地城使用。
 */
import type { EncounterTable } from '@/systems/encounters';
import { DEFAULT_SHINY_CHANCE } from '@/systems/encounters';
import { ROAMING_CHANCE } from '@/systems/alpha';

const base = { alphaChance: ROAMING_CHANCE, shinyChance: DEFAULT_SHINY_CHANCE, grassRatePerMeter: 0.05 } as const;

export const TIDE_ENCOUNTERS: Record<string, EncounterTable> = {
  // —— 西部 · 森林 ——
  'azure-forest': {
    id: 'azure-forest',
    ...base,
    density: [9, 13],
    entries: [
      { speciesId: 69, weight: 30, levels: [15, 18] }, // 喇叭芽
      { speciesId: 70, weight: 6, levels: [19, 20], formation: 'rare' }, // 口呆花
      { speciesId: 165, weight: 25, levels: [15, 18], time: 'day', formation: 'group', groupSize: [2, 4] }, // 芭瓢虫
      { speciesId: 166, weight: 5, levels: [18, 20], time: 'day', formation: 'rare' }, // 安瓢虫
      { speciesId: 285, weight: 28, levels: [15, 18] }, // 蘑蘑菇
      { speciesId: 286, weight: 4, levels: [19, 20], formation: 'rare', weather: ['rain'] }, // 斗笠菇（雨后）
      { speciesId: 214, weight: 4, levels: [17, 20], time: 'day', formation: 'rare' }, // 赫拉克罗斯（树汁）
      { speciesId: 406, weight: 18, levels: [15, 17], time: 'day' }, // 含羞苞
      { speciesId: 315, weight: 12, levels: [16, 19] }, // 毒蔷薇
      { speciesId: 44, weight: 14, levels: [17, 19], time: 'night' }, // 臭臭花
      { speciesId: 163, weight: 18, levels: [15, 18], time: 'night' }, // 咕咕
      { speciesId: 47, weight: 8, levels: [17, 20], time: 'night' }, // 派拉斯特
    ],
  },
  'root-trail': {
    id: 'root-trail',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 69, weight: 25, levels: [14, 17] },
      { speciesId: 165, weight: 22, levels: [14, 16], time: 'day', formation: 'group', groupSize: [2, 3] },
      { speciesId: 285, weight: 20, levels: [14, 17] },
      { speciesId: 406, weight: 16, levels: [14, 16], time: 'day' },
      { speciesId: 17, weight: 18, levels: [15, 18], time: 'day' }, // 比比鸟
      { speciesId: 264, weight: 12, levels: [16, 18] }, // 直冲熊
      { speciesId: 162, weight: 10, levels: [15, 18] }, // 大尾立
      { speciesId: 20, weight: 14, levels: [15, 18], time: 'night' }, // 拉达
    ],
  },
  'tide-coast': {
    id: 'tide-coast',
    ...base,
    density: [7, 11],
    entries: [
      { speciesId: 79, weight: 25, levels: [14, 17], methods: ['visible', 'surf'] }, // 呆呆兽（岸边发呆）
      { speciesId: 90, weight: 15, levels: [14, 17], methods: ['fish', 'surf', 'visible'] }, // 大舌贝
      { speciesId: 222, weight: 15, levels: [14, 17], methods: ['visible', 'surf'] }, // 太阳珊瑚
      { speciesId: 341, weight: 18, levels: [14, 17] }, // 龙虾小兵
      { speciesId: 278, weight: 20, levels: [14, 17], formation: 'group', groupSize: [2, 4] }, // 长翅鸥
      { speciesId: 98, weight: 14, levels: [14, 17], time: 'night' }, // 大钳蟹
      { speciesId: 194, weight: 10, levels: [14, 16], time: 'night', methods: ['visible', 'surf'] }, // 乌波
      { speciesId: 80, weight: 3, levels: [17, 18], formation: 'rare' }, // 呆壳兽
    ],
  },
  // —— 中部 · 高原 / 峡谷 / 丘陵 ——
  'ancient-plateau': {
    id: 'ancient-plateau',
    ...base,
    density: [7, 10],
    entries: [
      { speciesId: 343, weight: 28, levels: [22, 25] }, // 天秤偶
      { speciesId: 344, weight: 5, levels: [25, 26], formation: 'rare' }, // 念力土偶
      { speciesId: 111, weight: 20, levels: [22, 25] }, // 独角犀牛
      { speciesId: 104, weight: 16, levels: [22, 24] }, // 卡拉卡拉
      { speciesId: 105, weight: 4, levels: [25, 26], formation: 'rare' }, // 嘎啦嘎啦
      { speciesId: 228, weight: 18, levels: [22, 25], time: 'night', formation: 'group', groupSize: [2, 3] }, // 戴鲁比
      { speciesId: 397, weight: 14, levels: [22, 25], time: 'day', formation: 'group', groupSize: [2, 3] }, // 姆克鸟
      { speciesId: 93, weight: 6, levels: [24, 26], time: 'night', formation: 'rare' }, // 鬼斯通（遗迹附近）
    ],
  },
  'ore-canyon': {
    id: 'ore-canyon',
    ...base,
    density: [8, 11],
    entries: [
      { speciesId: 74, weight: 28, levels: [17, 20] }, // 小拳石
      { speciesId: 75, weight: 8, levels: [21, 22], formation: 'rare' }, // 隆隆石
      { speciesId: 27, weight: 24, levels: [17, 20] }, // 穿山鼠
      { speciesId: 28, weight: 4, levels: [21, 22], formation: 'rare' }, // 穿山王
      { speciesId: 66, weight: 18, levels: [17, 20] }, // 腕力
      { speciesId: 104, weight: 12, levels: [18, 21] },
      { speciesId: 111, weight: 10, levels: [18, 21] },
      { speciesId: 41, weight: 20, levels: [17, 20], time: 'night', formation: 'group', groupSize: [2, 4] }, // 超音蝠
      { speciesId: 95, weight: 3, levels: [20, 22], formation: 'rare' }, // 大岩蛇
    ],
  },
  'ochre-hills': {
    id: 'ochre-hills',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 27, weight: 22, levels: [18, 21] },
      { speciesId: 322, weight: 22, levels: [18, 21] }, // 呆火驼
      { speciesId: 343, weight: 15, levels: [18, 21] },
      { speciesId: 104, weight: 14, levels: [18, 21] },
      { speciesId: 58, weight: 10, levels: [18, 21], time: 'day' }, // 卡蒂狗
      { speciesId: 17, weight: 16, levels: [18, 21], time: 'day' },
      { speciesId: 264, weight: 14, levels: [18, 21] },
      { speciesId: 228, weight: 12, levels: [19, 22], time: 'night' },
    ],
  },
  // —— 东部 · 火山 ——
  'ember-trail': {
    id: 'ember-trail',
    ...base,
    density: [8, 11],
    entries: [
      { speciesId: 58, weight: 20, levels: [20, 23] },
      { speciesId: 77, weight: 18, levels: [20, 23], time: 'day' }, // 小火马
      { speciesId: 218, weight: 22, levels: [20, 23] }, // 熔岩虫
      { speciesId: 322, weight: 20, levels: [20, 23] },
      { speciesId: 324, weight: 12, levels: [21, 24] }, // 煤炭龟
      { speciesId: 228, weight: 16, levels: [20, 23], time: 'night', formation: 'group', groupSize: [2, 3] },
      { speciesId: 27, weight: 10, levels: [20, 22] },
    ],
  },
  'volcano-slope': {
    id: 'volcano-slope',
    ...base,
    density: [7, 10],
    entries: [
      { speciesId: 77, weight: 18, levels: [24, 27] },
      { speciesId: 78, weight: 4, levels: [27, 28], formation: 'rare' }, // 烈焰马
      { speciesId: 218, weight: 18, levels: [24, 27] },
      { speciesId: 219, weight: 8, levels: [27, 28] }, // 熔岩蜗牛
      { speciesId: 322, weight: 14, levels: [24, 27] },
      { speciesId: 323, weight: 4, levels: [27, 28], formation: 'rare' }, // 喷火驼
      { speciesId: 324, weight: 16, levels: [24, 27] },
      { speciesId: 636, weight: 3, levels: [24, 26], formation: 'rare', time: 'day' }, // 燃烧虫
      { speciesId: 229, weight: 4, levels: [26, 28], time: 'night', formation: 'rare' }, // 黑鲁加
      { speciesId: 228, weight: 14, levels: [24, 27], time: 'night' },
    ],
  },
  'crater-rim': {
    id: 'crater-rim',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 219, weight: 22, levels: [27, 30] },
      { speciesId: 323, weight: 14, levels: [28, 31] },
      { speciesId: 324, weight: 18, levels: [27, 30] },
      { speciesId: 229, weight: 12, levels: [28, 31], time: 'night' },
      { speciesId: 78, weight: 10, levels: [28, 31], time: 'day' },
      { speciesId: 636, weight: 8, levels: [27, 29] },
      { speciesId: 637, weight: 1, levels: [30, 31], formation: 'rare', weather: ['clear'] }, // 火神蛾（晴天火口）
    ],
  },
  // —— 东南 · 温泉 ——
  'spring-valley': {
    id: 'spring-valley',
    ...base,
    density: [8, 12],
    entries: [
      { speciesId: 79, weight: 20, levels: [21, 24], methods: ['visible', 'surf'] },
      { speciesId: 80, weight: 4, levels: [24, 25], formation: 'rare' },
      { speciesId: 55, weight: 10, levels: [22, 25], methods: ['visible', 'surf'] }, // 哥达鸭
      { speciesId: 195, weight: 12, levels: [22, 25], methods: ['visible', 'surf'] }, // 沼王
      { speciesId: 980, weight: 3, levels: [24, 25], formation: 'rare', time: 'night' }, // 土王（夜间泉边）
      { speciesId: 315, weight: 16, levels: [21, 24] },
      { speciesId: 406, weight: 12, levels: [21, 23], time: 'day' },
      { speciesId: 77, weight: 12, levels: [21, 24], time: 'day' },
      { speciesId: 58, weight: 10, levels: [21, 24] },
      { speciesId: 166, weight: 8, levels: [22, 25], time: 'day' },
    ],
  },
  // —— 海域 ——
  'tide-sea-route': {
    id: 'tide-sea-route',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 72, weight: 40, levels: [12, 15], methods: ['surf', 'visible'] }, // 玛瑙水母
      { speciesId: 120, weight: 25, levels: [12, 15], methods: ['surf', 'visible'] }, // 海星星
      { speciesId: 129, weight: 30, levels: [12, 16], methods: ['fish', 'surf', 'visible'] }, // 鲤鱼王
      { speciesId: 278, weight: 18, levels: [12, 15], formation: 'group', groupSize: [2, 4] },
      { speciesId: 90, weight: 8, levels: [13, 15], methods: ['fish', 'surf'] },
      { speciesId: 118, weight: 10, levels: [13, 16], methods: ['fish', 'surf'] },
    ],
  },
  'tide-nearshore': {
    id: 'tide-nearshore',
    ...base,
    density: [6, 9],
    entries: [
      { speciesId: 72, weight: 28, levels: [16, 20], methods: ['surf', 'visible'] },
      { speciesId: 73, weight: 3, levels: [21, 22], formation: 'rare', methods: ['surf', 'visible'] }, // 毒刺水母
      { speciesId: 222, weight: 16, levels: [16, 20], methods: ['surf', 'visible'] },
      { speciesId: 864, weight: 2, levels: [21, 22], time: 'night', formation: 'rare', methods: ['visible'] }, // 魔灵珊瑚（夜间礁石）
      { speciesId: 279, weight: 10, levels: [19, 22] }, // 大嘴鸥
      { speciesId: 341, weight: 12, levels: [16, 20] },
      { speciesId: 119, weight: 8, levels: [19, 22], methods: ['fish', 'surf'] }, // 金鱼王
      { speciesId: 129, weight: 24, levels: [16, 22], methods: ['fish', 'surf', 'visible'] },
      { speciesId: 130, weight: 1, levels: [22, 22], formation: 'rare', methods: ['fish'] }, // 暴鲤龙
    ],
  },
  // —— 地城（室内） ——
  'ore-mine': {
    id: 'ore-mine',
    ...base,
    grassRatePerMeter: 0.04,
    density: [6, 9],
    entries: [
      { speciesId: 41, weight: 30, levels: [18, 21], formation: 'group', groupSize: [2, 3] },
      { speciesId: 42, weight: 5, levels: [22, 22], formation: 'rare' }, // 大嘴蝠
      { speciesId: 74, weight: 25, levels: [18, 21] },
      { speciesId: 75, weight: 8, levels: [21, 22] },
      { speciesId: 66, weight: 14, levels: [18, 21] },
      { speciesId: 27, weight: 12, levels: [18, 21] },
      { speciesId: 95, weight: 6, levels: [20, 22] },
      { speciesId: 208, weight: 1, levels: [22, 22], formation: 'rare' }, // 大钢蛇（矿坑深处）
    ],
  },
  'volcano-cave': {
    id: 'volcano-cave',
    ...base,
    grassRatePerMeter: 0.04,
    density: [6, 9],
    entries: [
      { speciesId: 41, weight: 20, levels: [24, 27] },
      { speciesId: 42, weight: 10, levels: [26, 28] },
      { speciesId: 218, weight: 22, levels: [24, 27] },
      { speciesId: 219, weight: 8, levels: [27, 28] },
      { speciesId: 75, weight: 14, levels: [24, 27] },
      { speciesId: 324, weight: 14, levels: [24, 27] },
      { speciesId: 636, weight: 4, levels: [25, 27], formation: 'rare' },
    ],
  },
  'anomaly-ruins': {
    id: 'anomaly-ruins',
    ...base,
    grassRatePerMeter: 0.04,
    density: [5, 8],
    entries: [
      { speciesId: 343, weight: 26, levels: [26, 29] },
      { speciesId: 344, weight: 10, levels: [28, 30] },
      { speciesId: 93, weight: 18, levels: [26, 29] }, // 鬼斯通
      { speciesId: 42, weight: 16, levels: [26, 29] },
      { speciesId: 169, weight: 2, levels: [30, 30], formation: 'rare' }, // 叉字蝠
      { speciesId: 95, weight: 10, levels: [26, 29] },
      { speciesId: 105, weight: 8, levels: [27, 30] },
    ],
  },
};
