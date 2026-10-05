/**
 * 数据抓取清单（SYS-001）。修改后运行 `pnpm fetch-data`。
 * M0/M1 只覆盖萌芽群岛物种；后续里程碑按岛追加（07-22 §4.1 的 ~300 种）。
 * 抓取时会自动展开每个种子物种的完整进化线。
 */
export const SEED_SPECIES: readonly number[] = [
  // 御三家（07-21 §2.2）
  722, 155, 258,
  // 首批区域图鉴（07-21 §2.3）
  16, 19, 10, 25, 43, 72, 120, 98, 60, 129,
  // 萌芽群岛补充：港湾海崖飞行系、幻影之森索罗亚（07-22 §3.7 支线）
  278, 570,
  // 生态新物种第 1 批（2026-10-03 计划文档 §3）：尾立、蛇纹熊、派拉斯、咕咕、鬼斯
  161, 263, 46, 163, 92,
  // 生态新物种第 2 批：大舌贝、太阳珊瑚、沙丘娃、小拳石、腕力
  90, 222, 769, 74, 66,
  // 生态新物种第 3 批：姆克儿、可达鸭、乌波、溜溜糖球、龙虾小兵、角金鱼
  396, 54, 194, 283, 341, 118,
  // M2 碧潮群岛（2026-10-04）：古森 喇叭芽/蘑蘑菇/芭瓢虫/赫拉克罗斯/含羞苞；峡谷 大岩蛇/超音蝠/卡拉卡拉/穿山鼠；
  // 冲撞骑乘 独角犀牛；火山 卡蒂狗/小火马/熔岩虫/呆火驼/煤炭龟/戴鲁比；温泉 呆呆兽；遗迹 天秤偶/雷吉洛克；火山口的蛋 燃烧虫
  69, 285, 165, 214, 406, 95, 41, 104, 27, 111, 58, 77, 218, 322, 324, 228, 79, 343, 377, 636,
  // M3 · 雷鸣群岛支线『冻土之种』奖励：妙蛙种子（妙蛙草 / 妙蛙花）
  1,
  // M3-28 雷鸣群岛生态（电 / 冰 / 岩 / 钢）：小磁怪、霹雳电球、电击怪、咩利羊、小猫怪、小山猪、狃拉、雪童子、信使鸟、雪笠怪、海豹球、小海狮、朝北鼻
  81, 100, 239, 179, 403, 220, 215, 361, 225, 459, 363, 86, 299,
  // M3-28 琉璃群岛生态（超能 / 幽灵 / 水）：凯西、拉鲁拉丝、天然雀、梦妖、夜巡灵、飘飘球、轻飘飘、灯笼鱼、墨海马
  63, 280, 177, 200, 355, 425, 592, 170, 116,
  // M3-28 冠军之路：幼基拉斯、圆陆鲨、迷你龙
  246, 443, 147,
];

/** 核心道具：携带物（SYS-010）+ 精灵球（SYS-005）+ 回复药 */
export const CORE_ITEMS: readonly string[] = [
  // 携带物
  'leftovers', 'choice-band', 'choice-specs', 'choice-scarf', 'life-orb', 'focus-sash', 'expert-belt',
  'sitrus-berry', 'oran-berry', 'lum-berry', 'charcoal', 'mystic-water', 'miracle-seed', 'magnet', 'sharp-beak',
  'silver-powder', 'poison-barb', 'silk-scarf', 'black-belt', 'soft-sand', 'hard-stone', 'never-melt-ice',
  'spell-tag', 'twisted-spoon', 'dragon-fang', 'black-glasses', 'metal-coat', 'fairy-feather',
  // 精灵球
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'quick-ball', 'net-ball', 'dusk-ball',
  // 回复
  'potion', 'super-potion', 'hyper-potion', 'antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'full-heal', 'revive',
  // 营养剂（努力值 +10）
  'hp-up', 'protein', 'iron', 'calcium', 'zinc', 'carbos',
  // 进化石（进化判定用）
  'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'sun-stone', 'kings-rock', 'linking-cord', 'protector',
  // M3 支线奖励：光之石 / 冰之石 / 暗之石、经验糖果L、心之水滴（拉帝亚斯 / 拉帝欧斯专属）
  'shiny-stone', 'ice-stone', 'dusk-stone', 'exp-candy-l', 'soul-dew',
  // M3-28 新物种进化道具：电力增幅器、灵界之布、龙之鳞片、锐利之爪、觉醒之石
  'electirizer', 'reaper-cloth', 'dragon-scale', 'razor-claw', 'dawn-stone',
];

/** 明确的接触类招式补充（特殊攻击中也有少数接触招式） */
export const CONTACT_MOVES: ReadonlySet<string> = new Set(['petal-dance', 'grass-knot', 'draining-kiss', 'infestation', 'wring-out']);

/** 物理但不接触的招式（常见的少数例外） */
export const NON_CONTACT_PHYSICAL: ReadonlySet<string> = new Set([
  'earthquake', 'rock-slide', 'rock-throw', 'rock-tomb', 'bulldoze', 'magnitude', 'bone-club', 'bonemerang', 'sand-tomb',
  'stone-edge', 'razor-leaf', 'seed-bomb', 'bullet-seed', 'icicle-crash', 'icicle-spear', 'ice-shard', 'poison-sting',
  'twineedle', 'pin-missile', 'gunk-shot', 'self-destruct', 'explosion', 'rock-blast', 'smack-down', 'fling', 'leafage', 'spike-cannon', 'barrage', 'egg-bomb', 'present', 'beat-up', 'pay-day', 'fissure', 'triple-arrows', 'petal-blizzard', 'bone-rush', 'aqua-cutter', 'sky-attack', 'scale-shot', 'precipice-blades', 'thousand-arrows', 'poltergeist', 'magnet-bomb', 'dragon-darts', 'thousand-waves',
]);

/** 学习方式之外额外补入招式库的招式（头目招式等，scripts/augment-moves.ts） */
export const EXTRA_MOVES: readonly string[] = ['scald', 'head-smash', 'liquidation', 'dragon-rush', 'night-daze', 'brave-bird', 'hurricane', 'stone-edge', 'crabhammer', 'aqua-tail'];
