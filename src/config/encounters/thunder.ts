/**
 * 雷鸣群岛遇敌表（M3-28 定稿）。
 * 等级与 src/config/islands/thunder.ts 各区域 levelRange 对应。
 * M3-28 定稿：新增雷鸣 电 / 冰 / 岩钢、琉璃 超能 / 幽灵 / 水、冠军之路 龙系物种（模型见 M3-31）。
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
      // M3-28 生态定稿新增
      { speciesId: 86, weight: 14, levels: [26, 30], methods: ['surf', 'visible'] }, // 小海狮
      { speciesId: 170, weight: 16, levels: [26, 30], methods: ['fish', 'surf'] }, // 灯笼鱼
      { speciesId: 116, weight: 12, levels: [26, 30], methods: ['fish', 'surf'] }, // 墨海马
      { speciesId: 363, weight: 8, levels: [27, 31], methods: ['surf', 'visible'] }, // 海豹球
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
      // M3-28 生态定稿新增
      { speciesId: 87, weight: 6, levels: [35, 38], methods: ['surf'], formation: 'rare' }, // 白海狮
      { speciesId: 171, weight: 12, levels: [33, 37], methods: ['fish', 'surf'] }, // 电灯怪
      { speciesId: 364, weight: 10, levels: [33, 37], methods: ['surf', 'visible'] }, // 海魔狮
      { speciesId: 117, weight: 8, levels: [34, 38], methods: ['fish'] }, // 海刺龙
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
      // M3-28 生态定稿新增
      { speciesId: 179, weight: 22, levels: [31, 34], formation: 'group', groupSize: [2, 4] }, // 咩利羊
      { speciesId: 180, weight: 8, levels: [33, 35] }, // 茸茸羊
      { speciesId: 403, weight: 18, levels: [31, 33], formation: 'group', groupSize: [2, 3] }, // 小猫怪
      { speciesId: 404, weight: 6, levels: [33, 35] }, // 勒克猫
      { speciesId: 100, weight: 10, levels: [31, 34] }, // 霹雳电球
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
      // M3-28 生态定稿新增
      { speciesId: 239, weight: 10, levels: [32, 34] }, // 电击怪
      { speciesId: 125, weight: 8, levels: [34, 36], weather: ['storm'] }, // 电击兽（雷暴天气）
      { speciesId: 81, weight: 16, levels: [32, 35] }, // 小磁怪
      { speciesId: 82, weight: 6, levels: [34, 36], formation: 'rare' }, // 三合一磁怪
      { speciesId: 101, weight: 6, levels: [34, 36], weather: ['storm'] }, // 顽皮雷弹
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
      // M3-28 生态定稿新增
      { speciesId: 81, weight: 14, levels: [35, 38] }, // 小磁怪（灯塔的电流引来）
      { speciesId: 82, weight: 8, levels: [36, 39] }, // 三合一磁怪
      { speciesId: 86, weight: 12, levels: [35, 38] }, // 小海狮
      { speciesId: 225, weight: 8, levels: [35, 39] }, // 信使鸟
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
      // M3-28 生态定稿新增
      { speciesId: 180, weight: 14, levels: [34, 38] }, // 茸茸羊
      { speciesId: 404, weight: 12, levels: [34, 38] }, // 勒克猫
      { speciesId: 299, weight: 8, levels: [34, 37] }, // 朝北鼻
      { speciesId: 181, weight: 2, levels: [37, 38], formation: 'rare' }, // 电龙
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
      // M3-28 生态定稿新增
      { speciesId: 220, weight: 18, levels: [38, 41], formation: 'group', groupSize: [2, 3] }, // 小山猪
      { speciesId: 221, weight: 8, levels: [40, 42] }, // 长毛猪
      { speciesId: 361, weight: 16, levels: [38, 41] }, // 雪童子
      { speciesId: 215, weight: 8, levels: [39, 42], time: 'night' }, // 狃拉
      { speciesId: 363, weight: 10, levels: [38, 41] }, // 海豹球（冰缝）
      { speciesId: 225, weight: 10, levels: [38, 42] }, // 信使鸟
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
      // M3-28 生态定稿新增
      { speciesId: 459, weight: 18, levels: [40, 43] }, // 雪笠怪
      { speciesId: 460, weight: 4, levels: [43, 44], formation: 'rare' }, // 暴雪王
      { speciesId: 221, weight: 12, levels: [40, 44] }, // 长毛猪
      { speciesId: 362, weight: 6, levels: [42, 44], formation: 'rare' }, // 冰鬼护
      { speciesId: 215, weight: 10, levels: [40, 44], time: 'night' }, // 狃拉
      { speciesId: 364, weight: 8, levels: [40, 44] }, // 海魔狮
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
      // M3-28 生态定稿新增
      { speciesId: 459, weight: 12, levels: [42, 45] }, // 雪笠怪
      { speciesId: 478, weight: 4, levels: [44, 46], formation: 'rare', time: 'night' }, // 雪妖女
      { speciesId: 215, weight: 10, levels: [42, 46], time: 'night' }, // 狃拉
      { speciesId: 299, weight: 10, levels: [42, 45] }, // 朝北鼻
      { speciesId: 225, weight: 10, levels: [42, 46] }, // 信使鸟
      { speciesId: 398, weight: 18, levels: [42, 46] },
      { speciesId: 18, weight: 12, levels: [42, 46] },
      { speciesId: 26, weight: 12, levels: [42, 46] },
      { speciesId: 112, weight: 12, levels: [42, 46] },
      { speciesId: 464, weight: 2, levels: [45, 46], formation: 'rare' }, // 超甲狂犀
      { speciesId: 94, weight: 6, levels: [43, 46], time: 'night', formation: 'rare' }, // 耿鬼
    ],
  },
  // —— M3-23 洞窟 / 塔 ——
  'crystal-cave': {
    id: 'crystal-cave',
    ...base,
    grassRatePerMeter: 0.045,
    density: [6, 9],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 299, weight: 12, levels: [38, 41] }, // 朝北鼻
      { speciesId: 81, weight: 10, levels: [38, 41] }, // 小磁怪
      { speciesId: 74, weight: 16, levels: [38, 40] }, // 小拳石
      { speciesId: 75, weight: 18, levels: [38, 41] }, // 隆隆石
      { speciesId: 95, weight: 10, levels: [39, 42] }, // 大岩蛇
      { speciesId: 41, weight: 14, levels: [38, 40], formation: 'group', groupSize: [2, 3] }, // 超音蝠
      { speciesId: 42, weight: 8, levels: [40, 42] }, // 大嘴蝠
      { speciesId: 343, weight: 14, levels: [38, 41] }, // 天秤偶
      { speciesId: 25, weight: 8, levels: [39, 41] }, // 皮卡丘（被晶石的电吸引来）
      { speciesId: 26, weight: 2, levels: [42, 43], formation: 'rare' }, // 雷丘
    ],
  },
  'crystal-cave-deep': {
    id: 'crystal-cave-deep',
    ...base,
    grassRatePerMeter: 0.04,
    density: [5, 8],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 82, weight: 10, levels: [41, 44] }, // 三合一磁怪
      { speciesId: 299, weight: 10, levels: [41, 44] }, // 朝北鼻
      { speciesId: 100, weight: 10, levels: [41, 43] }, // 霹雳电球
      { speciesId: 75, weight: 16, levels: [41, 43] },
      { speciesId: 76, weight: 4, levels: [43, 44], formation: 'rare' }, // 隆隆岩
      { speciesId: 344, weight: 12, levels: [41, 44] }, // 念力土偶
      { speciesId: 343, weight: 12, levels: [40, 42] },
      { speciesId: 208, weight: 6, levels: [42, 44] }, // 大钢蛇
      { speciesId: 42, weight: 14, levels: [41, 43] },
      { speciesId: 26, weight: 6, levels: [42, 44] },
    ],
  },
  'old-lighthouse': {
    id: 'old-lighthouse',
    ...base,
    grassRatePerMeter: 0.04,
    density: [5, 8],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 81, weight: 12, levels: [36, 39] }, // 小磁怪
      { speciesId: 100, weight: 10, levels: [36, 39] }, // 霹雳电球
      { speciesId: 92, weight: 22, levels: [36, 38] }, // 鬼斯
      { speciesId: 93, weight: 8, levels: [38, 40], formation: 'rare' }, // 鬼斯通
      { speciesId: 41, weight: 16, levels: [36, 38], formation: 'group', groupSize: [2, 3] },
      { speciesId: 42, weight: 8, levels: [38, 40] },
      { speciesId: 769, weight: 10, levels: [36, 39] }, // 沙丘娃（被海风吹进塔里的沙）
      { speciesId: 864, weight: 4, levels: [39, 40], formation: 'rare' }, // 魔灵珊瑚
      { speciesId: 25, weight: 10, levels: [36, 39] }, // 皮卡丘（灯室残存的电）
      { speciesId: 164, weight: 10, levels: [37, 39], time: 'night' }, // 猫头夜鹰
    ],
  },
  'glacier-ruins': {
    id: 'glacier-ruins',
    ...base,
    grassRatePerMeter: 0.04,
    density: [5, 8],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 361, weight: 12, levels: [42, 45] }, // 雪童子
      { speciesId: 362, weight: 6, levels: [44, 46], formation: 'rare' }, // 冰鬼护
      { speciesId: 221, weight: 10, levels: [42, 45] }, // 长毛猪
      { speciesId: 91, weight: 16, levels: [42, 45] }, // 刺甲贝
      { speciesId: 343, weight: 16, levels: [42, 44] }, // 天秤偶
      { speciesId: 344, weight: 8, levels: [44, 46] }, // 念力土偶
      { speciesId: 95, weight: 10, levels: [42, 45] },
      { speciesId: 195, weight: 12, levels: [42, 45] }, // 沼王
      { speciesId: 42, weight: 14, levels: [42, 44] },
      { speciesId: 169, weight: 3, levels: [45, 46], formation: 'rare' }, // 叉字蝠
    ],
  },
  'glacier-ruins-deep': {
    id: 'glacier-ruins-deep',
    ...base,
    grassRatePerMeter: 0.03,
    density: [4, 7],
    entries: [
      // M3-28 生态定稿新增
      { speciesId: 362, weight: 10, levels: [44, 46] }, // 冰鬼护
      { speciesId: 87, weight: 8, levels: [44, 46] }, // 白海狮
      { speciesId: 365, weight: 3, levels: [46, 47], formation: 'rare' }, // 帝牙海狮
      { speciesId: 344, weight: 18, levels: [44, 46] },
      { speciesId: 91, weight: 16, levels: [44, 46] },
      { speciesId: 76, weight: 6, levels: [45, 46], formation: 'rare' },
      { speciesId: 169, weight: 8, levels: [45, 46] },
    ],
  },
};
