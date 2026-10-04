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
  'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'sun-stone', 'kings-rock', 'linking-cord',
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
