/**
 * 琉璃群岛遇敌表（M3-28 定稿）。
 * 等级与 src/config/islands/glaze.ts 各区域 levelRange 对应。
 * M3-28 定稿：新增雷鸣 电 / 冰 / 岩钢、琉璃 超能 / 幽灵 / 水、冠军之路 龙系物种（模型见 M3-31）。
 */
import type { EncounterTable } from '@/systems/encounters';
import { DEFAULT_SHINY_CHANCE } from '@/systems/encounters';
import { ROAMING_CHANCE } from '@/systems/alpha';

const base = { alphaChance: ROAMING_CHANCE, shinyChance: DEFAULT_SHINY_CHANCE, grassRatePerMeter: 0.05 } as const;

export const GLAZE_ENCOUNTERS: Record<string, EncounterTable> = {
  // —— M3-18 海底（潜水；室内暗雷，method cave）——
  'glaze-reef': {
    id: 'glaze-reef',
    ...base,
    grassRatePerMeter: 0.04,
    density: [4, 6],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 170, weight: 16, levels: [45, 48] }, // 灯笼鱼
      { speciesId: 171, weight: 10, levels: [48, 51] }, // 电灯怪
      { speciesId: 117, weight: 10, levels: [46, 50] }, // 海刺龙
      { speciesId: 592, weight: 12, levels: [45, 49] }, // 轻飘飘
      { speciesId: 222, weight: 22, levels: [46, 50] }, // 太阳珊瑚
      { speciesId: 120, weight: 16, levels: [45, 49] }, // 海星星
      { speciesId: 121, weight: 8, levels: [48, 52] }, // 宝石海星
      { speciesId: 118, weight: 14, levels: [45, 48] }, // 角金鱼
      { speciesId: 119, weight: 10, levels: [48, 51] }, // 金鱼王
      { speciesId: 90, weight: 14, levels: [45, 49] }, // 大舌贝
      { speciesId: 864, weight: 4, levels: [50, 53], formation: 'rare' }, // 魔灵珊瑚
    ],
  },
  'glaze-trench': {
    id: 'glaze-trench',
    ...base,
    grassRatePerMeter: 0.045,
    density: [4, 6],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 593, weight: 8, levels: [50, 53] }, // 胖嘟嘟
      { speciesId: 171, weight: 10, levels: [49, 52] }, // 电灯怪
      { speciesId: 230, weight: 3, levels: [53, 55], formation: 'rare' }, // 刺龙王
      { speciesId: 73, weight: 20, levels: [48, 52] }, // 毒刺水母
      { speciesId: 91, weight: 14, levels: [49, 53] }, // 刺甲贝
      { speciesId: 342, weight: 16, levels: [48, 52] }, // 铁螯龙虾
      { speciesId: 99, weight: 14, levels: [48, 52] }, // 巨钳蟹
      { speciesId: 864, weight: 8, levels: [50, 54] }, // 魔灵珊瑚
      { speciesId: 130, weight: 4, levels: [52, 55], formation: 'rare' }, // 暴鲤龙
    ],
  },
  // —— 雷鸣—琉璃海域（冲浪，海雾）——
  'glaze-sea-route': {
    id: 'glaze-sea-route',
    ...base,
    density: [6, 9],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 592, weight: 14, levels: [40, 44], methods: ['surf', 'visible'] }, // 轻飘飘
      { speciesId: 117, weight: 10, levels: [41, 45], methods: ['fish', 'surf'] }, // 海刺龙
      { speciesId: 171, weight: 10, levels: [40, 44], methods: ['fish', 'surf'] }, // 电灯怪
      { speciesId: 87, weight: 8, levels: [41, 45], methods: ['surf', 'visible'] }, // 白海狮
      { speciesId: 73, weight: 22, levels: [40, 44], methods: ['surf', 'visible'] }, // 毒刺水母
      { speciesId: 121, weight: 10, levels: [42, 46], methods: ['surf', 'visible'] }, // 宝石海星
      { speciesId: 279, weight: 18, levels: [40, 44] }, // 大嘴鸥
      { speciesId: 91, weight: 12, levels: [40, 45], methods: ['fish', 'surf'] }, // 刺甲贝
      { speciesId: 130, weight: 6, levels: [42, 46], methods: ['fish', 'surf'], formation: 'rare' }, // 暴鲤龙
      { speciesId: 342, weight: 12, levels: [40, 44], methods: ['fish', 'surf'] }, // 铁螯龙虾
      { speciesId: 222, weight: 10, levels: [40, 44], methods: ['surf', 'visible'] }, // 太阳珊瑚
      { speciesId: 864, weight: 3, levels: [44, 46], methods: ['surf'], formation: 'rare' }, // 魔灵珊瑚
    ],
  },
  'glaze-nearshore': {
    id: 'glaze-nearshore',
    ...base,
    density: [6, 9],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 593, weight: 6, levels: [47, 50], methods: ['surf'], formation: 'rare' }, // 胖嘟嘟
      { speciesId: 592, weight: 14, levels: [44, 48], methods: ['surf', 'visible'] }, // 轻飘飘
      { speciesId: 117, weight: 10, levels: [44, 48], methods: ['fish'] }, // 海刺龙
      { speciesId: 73, weight: 20, levels: [44, 48], methods: ['surf', 'visible'] },
      { speciesId: 121, weight: 12, levels: [45, 50], methods: ['surf'] },
      { speciesId: 80, weight: 10, levels: [45, 49], methods: ['surf', 'visible'] }, // 呆壳兽
      { speciesId: 279, weight: 16, levels: [44, 48] },
      { speciesId: 119, weight: 14, levels: [44, 48], methods: ['fish'] }, // 金鱼王
      { speciesId: 130, weight: 5, levels: [46, 50], methods: ['fish', 'surf'], formation: 'rare' },
      { speciesId: 864, weight: 4, levels: [46, 50], methods: ['surf'] },
    ],
  },
  // —— 海蚀石林（岩 / 地面 / 超能）——
  'stone-forest': {
    id: 'stone-forest',
    ...base,
    density: [8, 12],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 299, weight: 14, levels: [44, 47] }, // 朝北鼻
      { speciesId: 64, weight: 10, levels: [44, 47] }, // 勇基拉
      { speciesId: 177, weight: 12, levels: [44, 46] }, // 天然雀
      { speciesId: 178, weight: 6, levels: [46, 48] }, // 天然鸟
      { speciesId: 476, weight: 3, levels: [47, 48], formation: 'rare' }, // 大朝北鼻
      { speciesId: 76, weight: 10, levels: [45, 48], formation: 'rare' }, // 隆隆岩
      { speciesId: 75, weight: 18, levels: [44, 47] }, // 隆隆石
      { speciesId: 344, weight: 16, levels: [44, 48] }, // 念力土偶
      { speciesId: 343, weight: 16, levels: [44, 46], formation: 'group', groupSize: [2, 3] }, // 天秤偶
      { speciesId: 112, weight: 12, levels: [45, 48] }, // 钻角犀兽
      { speciesId: 169, weight: 14, levels: [44, 48], time: 'night' }, // 叉字蝠
      { speciesId: 279, weight: 12, levels: [44, 47] },
    ],
  },
  // —— 幽灵沼泽（幽灵 / 毒 / 水）——
  'ghost-marsh': {
    id: 'ghost-marsh',
    ...base,
    density: [9, 13],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 355, weight: 18, levels: [46, 48], time: 'night' }, // 夜巡灵
      { speciesId: 356, weight: 6, levels: [48, 50], formation: 'rare', time: 'night' }, // 彷徨夜灵
      { speciesId: 200, weight: 12, levels: [46, 49] }, // 梦妖
      { speciesId: 425, weight: 12, levels: [46, 49], weather: ['fog', 'nightfog'] }, // 飘飘球（雾天）
      { speciesId: 93, weight: 22, levels: [46, 49] }, // 鬼斯通
      { speciesId: 94, weight: 4, levels: [49, 50], formation: 'rare', time: 'night' }, // 耿鬼
      { speciesId: 195, weight: 16, levels: [46, 50] }, // 沼王
      { speciesId: 260, weight: 6, levels: [48, 50], formation: 'rare' }, // 巨沼怪
      { speciesId: 980, weight: 10, levels: [46, 50] }, // 土王
      { speciesId: 45, weight: 12, levels: [46, 49] }, // 霸王花
      { speciesId: 169, weight: 12, levels: [46, 50], time: 'night' },
      { speciesId: 724, weight: 3, levels: [48, 50], formation: 'rare' }, // 狙射树枭
    ],
  },
  // —— 暗影林（恶 / 幽灵 / 虫）——
  'shadow-wood': {
    id: 'shadow-wood',
    ...base,
    density: [9, 13],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 200, weight: 12, levels: [46, 49], time: 'night' }, // 梦妖
      { speciesId: 355, weight: 12, levels: [46, 49], time: 'night' }, // 夜巡灵
      { speciesId: 280, weight: 12, levels: [46, 48], time: 'day' }, // 拉鲁拉丝
      { speciesId: 281, weight: 6, levels: [48, 50], time: 'day', formation: 'rare' }, // 奇鲁莉安
      { speciesId: 425, weight: 10, levels: [46, 49] }, // 飘飘球
      { speciesId: 571, weight: 8, levels: [48, 50], formation: 'rare' }, // 索罗亚克
      { speciesId: 570, weight: 14, levels: [46, 48] }, // 索罗亚
      { speciesId: 93, weight: 14, levels: [46, 49], time: 'night' },
      { speciesId: 164, weight: 14, levels: [46, 50], time: 'night' }, // 猫头夜鹰
      { speciesId: 862, weight: 8, levels: [47, 50] }, // 堵拦熊
      { speciesId: 214, weight: 10, levels: [46, 50], time: 'day' }, // 赫拉克罗斯
      { speciesId: 286, weight: 12, levels: [46, 49] }, // 斗笠菇
      { speciesId: 407, weight: 10, levels: [46, 50], time: 'day' }, // 罗丝雷朵
    ],
  },
  // —— 蜃景沙丘（地面 / 幽灵 / 超能）——
  'mirage-dunes': {
    id: 'mirage-dunes',
    ...base,
    density: [7, 11],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 63, weight: 12, levels: [44, 46] }, // 凯西（瞬间移动着出现）
      { speciesId: 64, weight: 8, levels: [45, 48] }, // 勇基拉
      { speciesId: 177, weight: 14, levels: [44, 47], formation: 'group', groupSize: [2, 3] }, // 天然雀
      { speciesId: 178, weight: 6, levels: [46, 48], formation: 'rare' }, // 天然鸟
      { speciesId: 770, weight: 8, levels: [46, 48], formation: 'rare' }, // 噬沙堡爷
      { speciesId: 769, weight: 18, levels: [44, 47] }, // 沙丘娃
      { speciesId: 344, weight: 14, levels: [44, 48] },
      { speciesId: 105, weight: 14, levels: [44, 48] }, // 嘎啦嘎啦
      { speciesId: 28, weight: 16, levels: [44, 47] }, // 穿山王
      { speciesId: 323, weight: 10, levels: [45, 48] }, // 喷火驼
      { speciesId: 229, weight: 6, levels: [46, 48], time: 'night' }, // 黑鲁加
    ],
  },
  // —— 玻璃海岸（水 / 超能）——
  'glass-coast': {
    id: 'glass-coast',
    ...base,
    density: [8, 12],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 592, weight: 12, levels: [47, 50], methods: ['surf', 'visible'] }, // 轻飘飘
      { speciesId: 281, weight: 8, levels: [47, 50] }, // 奇鲁莉安
      { speciesId: 426, weight: 6, levels: [48, 51], weather: ['fog', 'seafog'] }, // 随风球
      { speciesId: 117, weight: 8, levels: [47, 50], methods: ['fish'] }, // 海刺龙
      { speciesId: 80, weight: 16, levels: [47, 50] }, // 呆壳兽
      { speciesId: 199, weight: 4, levels: [50, 51], formation: 'rare' }, // 呆呆王
      { speciesId: 121, weight: 12, levels: [47, 51], methods: ['surf', 'visible'] },
      { speciesId: 55, weight: 16, levels: [47, 50] }, // 哥达鸭
      { speciesId: 99, weight: 14, levels: [47, 50] }, // 巨钳蟹
      { speciesId: 279, weight: 14, levels: [47, 51] },
      { speciesId: 186, weight: 8, levels: [48, 51] }, // 蚊香蛙皇
    ],
  },
  // —— 冠军山麓 / 联盟高原（高等级混合）——
  'victory-mountain': {
    id: 'victory-mountain',
    ...base,
    density: [8, 12],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 246, weight: 10, levels: [48, 50] }, // 幼基拉斯
      { speciesId: 247, weight: 4, levels: [50, 52], formation: 'rare' }, // 沙基拉斯
      { speciesId: 443, weight: 8, levels: [48, 50] }, // 圆陆鲨
      { speciesId: 444, weight: 3, levels: [50, 52], formation: 'rare' }, // 尖牙陆鲨
      { speciesId: 476, weight: 6, levels: [49, 52] }, // 大朝北鼻
      { speciesId: 68, weight: 14, levels: [48, 52] }, // 怪力
      { speciesId: 76, weight: 12, levels: [48, 52] },
      { speciesId: 112, weight: 12, levels: [48, 52] },
      { speciesId: 464, weight: 3, levels: [51, 52], formation: 'rare' }, // 超甲狂犀
      { speciesId: 208, weight: 8, levels: [49, 52] }, // 大钢蛇
      { speciesId: 59, weight: 8, levels: [49, 52], time: 'day' }, // 风速狗
      { speciesId: 169, weight: 12, levels: [48, 52], time: 'night' },
      { speciesId: 398, weight: 12, levels: [48, 52] }, // 姆克鹰
    ],
  },
  // —— M3-20 冠军之路（洞窟 / 地下暗河）——
  'victory-road': {
    id: 'victory-road',
    ...base,
    grassRatePerMeter: 0.045,
    density: [7, 10],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 246, weight: 10, levels: [50, 53] }, // 幼基拉斯
      { speciesId: 247, weight: 5, levels: [52, 54] }, // 沙基拉斯
      { speciesId: 443, weight: 10, levels: [50, 53] }, // 圆陆鲨
      { speciesId: 444, weight: 4, levels: [52, 54], formation: 'rare' }, // 尖牙陆鲨
      { speciesId: 476, weight: 6, levels: [51, 54] }, // 大朝北鼻
      { speciesId: 75, weight: 16, levels: [50, 53] }, // 隆隆石
      { speciesId: 76, weight: 6, levels: [52, 54], formation: 'rare' }, // 隆隆岩
      { speciesId: 95, weight: 12, levels: [50, 53] }, // 大岩蛇
      { speciesId: 208, weight: 6, levels: [52, 54] }, // 大钢蛇
      { speciesId: 67, weight: 14, levels: [50, 53] }, // 豪力
      { speciesId: 68, weight: 4, levels: [53, 54], formation: 'rare' }, // 怪力
      { speciesId: 42, weight: 16, levels: [50, 53], formation: 'group', groupSize: [2, 3] }, // 大嘴蝠
      { speciesId: 169, weight: 4, levels: [53, 54] }, // 叉字蝠
      { speciesId: 105, weight: 10, levels: [50, 53] }, // 嘎啦嘎啦
      { speciesId: 112, weight: 8, levels: [51, 54] }, // 钻角犀兽
      { speciesId: 770, weight: 4, levels: [52, 54] }, // 噬沙堡爷
    ],
  },
  'victory-road-river': {
    id: 'victory-road-river',
    ...base,
    grassRatePerMeter: 0.045,
    density: [6, 9],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 147, weight: 8, levels: [50, 53] }, // 迷你龙
      { speciesId: 148, weight: 3, levels: [53, 55], formation: 'rare' }, // 哈克龙
      { speciesId: 230, weight: 2, levels: [54, 55], formation: 'rare' }, // 刺龙王
      { speciesId: 42, weight: 18, levels: [50, 53], formation: 'group', groupSize: [2, 3] },
      { speciesId: 195, weight: 14, levels: [50, 53] }, // 沼王
      { speciesId: 260, weight: 6, levels: [52, 54], formation: 'rare' }, // 巨沼怪
      { speciesId: 91, weight: 10, levels: [50, 53] }, // 刺甲贝
      { speciesId: 342, weight: 12, levels: [50, 53] }, // 铁螯龙虾
      { speciesId: 62, weight: 10, levels: [50, 53] }, // 蚊香泳士
      { speciesId: 119, weight: 12, levels: [50, 53] }, // 金鱼王
      { speciesId: 130, weight: 3, levels: [54, 55], formation: 'rare' }, // 暴鲤龙
      { speciesId: 95, weight: 8, levels: [50, 53] },
    ],
  },
  'league-plateau': {
    id: 'league-plateau',
    ...base,
    density: [7, 10],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 148, weight: 6, levels: [51, 54], weather: ['rain'] }, // 哈克龙（雨天）
      { speciesId: 282, weight: 4, levels: [52, 54], formation: 'rare', time: 'day' }, // 沙奈朵
      { speciesId: 475, weight: 4, levels: [52, 54], formation: 'rare', time: 'day' }, // 艾路雷朵
      { speciesId: 178, weight: 10, levels: [50, 54] }, // 天然鸟
      { speciesId: 149, weight: 1, levels: [54, 54], formation: 'rare' }, // 快龙
      { speciesId: 398, weight: 18, levels: [50, 54] },
      { speciesId: 18, weight: 16, levels: [50, 54] }, // 大比鸟
      { speciesId: 59, weight: 10, levels: [51, 54] },
      { speciesId: 68, weight: 12, levels: [50, 54] },
      { speciesId: 199, weight: 6, levels: [52, 54], formation: 'rare' },
      { speciesId: 94, weight: 6, levels: [52, 54], time: 'night', formation: 'rare' },
    ],
  },
  // —— M3-23 暗影洞窟（高等级）——
  'shadow-cave': {
    id: 'shadow-cave',
    ...base,
    grassRatePerMeter: 0.045,
    density: [6, 9],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 355, weight: 14, levels: [50, 52] }, // 夜巡灵
      { speciesId: 356, weight: 8, levels: [51, 54] }, // 彷徨夜灵
      { speciesId: 200, weight: 10, levels: [50, 53] }, // 梦妖
      { speciesId: 93, weight: 18, levels: [50, 53] }, // 鬼斯通
      { speciesId: 94, weight: 4, levels: [53, 54], formation: 'rare' }, // 耿鬼
      { speciesId: 42, weight: 14, levels: [50, 52], formation: 'group', groupSize: [2, 3] },
      { speciesId: 169, weight: 8, levels: [52, 54] }, // 叉字蝠
      { speciesId: 570, weight: 12, levels: [50, 52] }, // 索罗亚
      { speciesId: 228, weight: 10, levels: [50, 52] }, // 戴鲁比
      { speciesId: 770, weight: 8, levels: [51, 54] }, // 噬沙堡爷
      { speciesId: 342, weight: 8, levels: [50, 53] }, // 铁螯龙虾
    ],
  },
  'shadow-cave-deep': {
    id: 'shadow-cave-deep',
    ...base,
    grassRatePerMeter: 0.04,
    density: [5, 8],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 477, weight: 3, levels: [55, 56], formation: 'rare' }, // 黑夜魔灵
      { speciesId: 429, weight: 4, levels: [54, 56], formation: 'rare' }, // 梦妖魔
      { speciesId: 356, weight: 10, levels: [53, 55] }, // 彷徨夜灵
      { speciesId: 94, weight: 10, levels: [53, 56] },
      { speciesId: 571, weight: 8, levels: [53, 56] }, // 索罗亚克
      { speciesId: 229, weight: 10, levels: [53, 55] }, // 黑鲁加
      { speciesId: 862, weight: 6, levels: [54, 56], formation: 'rare' }, // 堵拦熊
      { speciesId: 864, weight: 10, levels: [53, 55] }, // 魔灵珊瑚
      { speciesId: 169, weight: 14, levels: [53, 55] },
      { speciesId: 93, weight: 14, levels: [52, 54] },
    ],
  },
};
