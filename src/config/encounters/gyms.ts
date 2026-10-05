/**
 * 道馆定义（设计 §5.4 动态等级）。
 * 萌芽群岛只有 1 座道馆，所以只有 1 档；岛 2/3 的道馆在 M2/M3 追加，每座 3 档。
 * 队伍来源：07-21 §2.5（道馆 1 水系：海星星 + 大钳蟹 + 暴鲤龙）。
 */
import type { GymDef } from '@/systems/encounters';

export const GYMS: GymDef[] = [
  {
    id: 'gym-cuilan',
    island: 'sprout',
    leader: '沧澜',
    type: 'water',
    badgeFlag: 'badge-verdant',
    tierLevels: [14],
    ivs: 18,
    prizeMoney: 1680,
    items: [{ id: 'super-potion', qty: 2 }],
    team: [
      { speciesId: 120, levelOffset: -1, moves: ['water-gun', 'rapid-spin', 'swift', 'harden'], ability: 'natural-cure' },
      { speciesId: 98, levelOffset: -1, moves: ['water-gun', 'metal-claw', 'harden', 'leer'], ability: 'hyper-cutter' },
      { speciesId: 130, levelOffset: 2, moves: ['water-pulse', 'bite', 'twister', 'scary-face'], ability: 'intimidate', heldItem: 'sitrus-berry' },
    ],
  },
  // ———————————— 碧潮群岛（M2-09）：3 座道馆，挑战顺序自由；按「本岛已获徽章数」取档 ————————————
  // 第 1 档 18–20 / 第 2 档 23–25 / 第 3 档 28–30（tierLevels 为基准，成员偏移 -1..+1）
  {
    id: 'gym-azure',
    island: 'tide',
    leader: '叶岚',
    type: 'grass',
    badgeFlag: 'badge-azure',
    badgeName: '翠澜徽章',
    tierLevels: [19, 24, 29],
    ivs: 20,
    prizeMoney: 2400,
    items: [{ id: 'super-potion', qty: 2 }],
    ceremony: {
      win: ['……根扎得再深，也会被真正的风撼动。', '你的伙伴和你一起成长的样子，像古森里新抽的嫩枝。', '这枚徽章，是碧潮古森认可你的证明。'],
      effect: ['有了这枚徽章，就可以在野外用「居合斩」斩开挡路的藤蔓了。', '另外，收下招式学习器「魔法叶」吧。', '古森北面被藤蔓封住的神龛，现在你也能去看看了。'],
    },
    team: [
      { speciesId: 70, levelOffset: -1, moves: ['razor-leaf', 'acid', 'sleep-powder', 'vine-whip'], ability: 'chlorophyll' },
      { speciesId: 44, levelOffset: -1, moves: ['mega-drain', 'acid', 'stun-spore', 'poison-powder'], ability: 'chlorophyll' },
      { speciesId: 286, levelOffset: 1, moves: ['mach-punch', 'seed-bomb', 'headbutt', 'leech-seed'], ability: 'effect-spore', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 315, levelOffset: 0, moves: ['giga-drain', 'poison-powder', 'magical-leaf', 'stun-spore'], ability: 'natural-cure' }],
      2: [{ speciesId: 47, levelOffset: 0, moves: ['x-scissor', 'giga-drain', 'spore', 'fury-cutter'], ability: 'effect-spore' }],
    },
  },
  {
    id: 'gym-ore',
    island: 'tide',
    leader: '岩磊',
    type: 'rock',
    badgeFlag: 'badge-ore',
    badgeName: '翠澜徽章',
    tierLevels: [19, 24, 29],
    ivs: 20,
    prizeMoney: 2400,
    items: [{ id: 'super-potion', qty: 2 }],
    ceremony: {
      win: ['哈！好硬的一拳，连峡谷的岩壁都在嗡嗡响。', '矿工的规矩：认输要认得痛快。', '拿去吧，这是矿石镇的徽章——翠澜徽章！'],
      effect: ['有了它，等级更高的宝可梦也会听你的话。', '这个招式学习器「岩石封锁」也一起带走。', '要是在矿坑里看到挡路的大石头，去找工头聊聊「怪力」的事。'],
    },
    team: [
      { speciesId: 75, levelOffset: -1, moves: ['rock-throw', 'bulldoze', 'defense-curl', 'rollout'], ability: 'sturdy' },
      { speciesId: 111, levelOffset: -1, moves: ['horn-attack', 'rock-blast', 'stomp', 'scary-face'], ability: 'rock-head' },
      { speciesId: 95, levelOffset: 1, moves: ['rock-tomb', 'bind', 'screech', 'dig'], ability: 'sturdy', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 222, levelOffset: 0, moves: ['ancient-power', 'bubble-beam', 'recover', 'harden'], ability: 'natural-cure' }],
      2: [{ speciesId: 112, levelOffset: 0, moves: ['rock-slide', 'stomp', 'horn-attack', 'scary-face'], ability: 'lightning-rod' }],
    },
  },
  {
    id: 'gym-flame',
    island: 'tide',
    leader: '炎棘',
    type: 'fire',
    badgeFlag: 'badge-flame',
    badgeName: '翠澜徽章',
    tierLevels: [19, 24, 29],
    ivs: 22,
    prizeMoney: 2600,
    items: [{ id: 'super-potion', qty: 3 }],
    ceremony: {
      win: ['……火被压下去了。可余温还在烧，对吧？', '你的斗志比火山口的热浪还烫手。', '收下吧，火山镇的翠澜徽章。'],
      effect: ['有了这枚徽章，在火山洞里也能用「闪光」照亮脚下。', '招式学习器「焚烧殆尽」也送你了。', '火山口的热浪，靠这份力量就能顶过去。'],
    },
    team: [
      { speciesId: 77, levelOffset: -1, moves: ['flame-charge', 'stomp', 'take-down', 'ember'], ability: 'flash-fire' },
      { speciesId: 219, levelOffset: -1, moves: ['lava-plume', 'rock-throw', 'harden', 'amnesia'], ability: 'flame-body' },
      { speciesId: 324, levelOffset: 1, moves: ['flame-wheel', 'body-slam', 'smokescreen', 'withdraw'], ability: 'white-smoke', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 228, levelOffset: 0, moves: ['fire-fang', 'bite', 'howl', 'smog'], ability: 'early-bird' }],
      2: [{ speciesId: 636, levelOffset: 0, moves: ['flame-charge', 'bug-bite', 'take-down', 'string-shot'], ability: 'flame-body' }],
    },
  },
  // ———————————— 雷鸣群岛（M3-15）：4 座道馆，挑战顺序自由；按「本岛已获徽章数」取 4 档 ————————————
  // 第 1 档 31–34 / 第 2 档 35–38 / 第 3 档 39–42 / 第 4 档 43–46（野外 26–38）。
  // 物种暂用现有 120 种图鉴里的属性代表 / 会该属性招式的宝可梦；M3-28 物种清单定稿、M3-31 模型到位后替换为设计稿队伍
  // （例：霜凝 小山猪 / 冰鬼护 / 猛犸猪），本文件的等级档与仪式台词保持不变。
  {
    id: 'gym-thunder',
    island: 'thunder',
    leader: '雷霆',
    type: 'electric',
    badgeFlag: 'badge-thunder',
    badgeName: '翠澜徽章',
    tierLevels: [33, 37, 41, 45],
    ivs: 24,
    prizeMoney: 3600,
    items: [{ id: 'hyper-potion', qty: 2 }],
    ceremony: {
      win: ['……哈！电流全被你导走了。', '高原上的雷暴一年到头不停，我的伙伴们就是在雷声里长大的——今天倒是被你劈了一回。', '收下吧，雷鸣镇的翠澜徽章！'],
      effect: ['有了这枚徽章，等级更高的宝可梦也会听你的话。', '招式学习器「电击波」也一起拿去——它从不落空。', '雷鸣群岛还有三座道馆，晨光、雪原、云雀，顺序随你。'],
    },
    team: [
      { speciesId: 121, levelOffset: -1, moves: ['thunderbolt', 'psybeam', 'rapid-spin', 'recover'], ability: 'natural-cure' },
      { speciesId: 25, levelOffset: -1, moves: ['discharge', 'iron-tail', 'agility', 'thunder-wave'], ability: 'static' },
      { speciesId: 26, levelOffset: 2, moves: ['thunderbolt', 'brick-break', 'nasty-plot', 'quick-attack'], ability: 'lightning-rod', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 94, levelOffset: 0, moves: ['thunderbolt', 'shadow-ball', 'hypnosis', 'sludge-bomb'], ability: 'cursed-body' }],
      2: [{ speciesId: 464, levelOffset: 0, moves: ['thunder-fang', 'rock-slide', 'drill-run', 'stomp'], ability: 'lightning-rod' }],
      3: [{ speciesId: 130, levelOffset: 1, moves: ['thunderbolt', 'waterfall', 'dragon-dance', 'ice-fang'], ability: 'intimidate' }],
    },
  },
  {
    id: 'gym-dawn',
    island: 'thunder',
    leader: '晨辉',
    type: 'normal',
    badgeFlag: 'badge-dawn',
    badgeName: '翠澜徽章',
    tierLevels: [33, 37, 41, 45],
    ivs: 24,
    prizeMoney: 3600,
    items: [{ id: 'hyper-potion', qty: 2 }],
    ceremony: {
      win: ['日升、日落……你在昼与夜之间都没有迷路。', '「普通」从来不是平庸，是能在任何时刻站稳脚跟的力量。', '这枚翠澜徽章，是晨光镇的认可。'],
      effect: ['有了它，伙伴们在野外会更信任你。', '招式学习器「硬撑」也给你——越是陷入异常状态，越要咬牙反击。', '去看看风车镇的黄昏吧，那是群岛最美的时刻。'],
    },
    team: [
      { speciesId: 162, levelOffset: -1, moves: ['hyper-voice', 'sucker-punch', 'follow-me', 'u-turn'], ability: 'frisk' },
      { speciesId: 164, levelOffset: -1, moves: ['hyper-voice', 'extrasensory', 'air-slash', 'reflect'], ability: 'tinted-lens' },
      { speciesId: 862, levelOffset: 2, moves: ['obstruct', 'facade', 'throat-chop', 'counter'], ability: 'guts', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 20, levelOffset: 0, moves: ['hyper-fang', 'crunch', 'sucker-punch', 'quick-attack'], ability: 'guts' }],
      2: [{ speciesId: 264, levelOffset: 0, moves: ['body-slam', 'shadow-claw', 'hone-claws', 'seed-bomb'], ability: 'quick-feet' }],
      3: [{ speciesId: 398, levelOffset: 1, moves: ['double-edge', 'close-combat', 'aerial-ace', 'quick-attack'], ability: 'intimidate' }],
    },
  },
  {
    id: 'gym-snow',
    island: 'thunder',
    leader: '霜凝',
    type: 'ice',
    badgeFlag: 'badge-snow',
    badgeName: '翠澜徽章',
    tierLevels: [33, 37, 41, 45],
    ivs: 25,
    prizeMoney: 3800,
    items: [{ id: 'hyper-potion', qty: 3 }],
    ceremony: {
      win: ['冰面上滑倒的人，我见过很多。站起来接着滑的，没几个。', '你的伙伴像冰川一样，一寸一寸，从不后退。', '这枚翠澜徽章——冰晶的光，送给你。'],
      effect: ['有了这枚徽章，就可以骑着伙伴「攀爬」藤蔓和裂缝崖壁了。', '招式学习器「冰冻之风」也拿去吧。', '冰川北面那道崖，现在挡不住你了。'],
    },
    team: [
      { speciesId: 195, levelOffset: -1, moves: ['avalanche', 'muddy-water', 'yawn', 'amnesia'], ability: 'unaware' },
      { speciesId: 73, levelOffset: -1, moves: ['ice-beam', 'sludge-bomb', 'hex', 'acid-armor'], ability: 'clear-body' },
      { speciesId: 91, levelOffset: 2, moves: ['icicle-crash', 'ice-shard', 'shell-smash', 'razor-shell'], ability: 'skill-link', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 342, levelOffset: 0, moves: ['avalanche', 'night-slash', 'razor-shell', 'swords-dance'], ability: 'hyper-cutter' }],
      2: [{ speciesId: 186, levelOffset: 0, moves: ['ice-beam', 'hydro-pump', 'brick-break', 'rain-dance'], ability: 'water-absorb' }],
      3: [{ speciesId: 260, levelOffset: 1, moves: ['avalanche', 'earthquake', 'waterfall', 'protect'], ability: 'torrent' }],
    },
  },
  {
    id: 'gym-lark',
    island: 'thunder',
    leader: '云翎',
    type: 'flying',
    badgeFlag: 'badge-lark',
    badgeName: '翠澜徽章',
    tierLevels: [33, 37, 41, 45],
    ivs: 25,
    prizeMoney: 3800,
    items: [{ id: 'hyper-potion', qty: 3 }],
    ceremony: {
      win: ['……风停了。是你让它停下来的。', '在云崖上长大的孩子，第一课是学会看风；而你，学会了驾驭它。', '白羽般的翠澜徽章，归你了。'],
      effect: ['有了这枚徽章，驾着伙伴在天空中会飞得更稳。', '招式学习器「燕返」——一记必中的翻身斩，带上它。', '雷鸣群岛的四枚徽章都齐了的话，去码头找钓竿爷聊聊北边的海吧。'],
    },
    team: [
      { speciesId: 279, levelOffset: -1, moves: ['air-slash', 'water-pulse', 'tailwind', 'protect'], ability: 'keen-eye' },
      { speciesId: 284, levelOffset: -1, moves: ['air-slash', 'bug-buzz', 'stun-spore', 'giga-drain'], ability: 'intimidate' },
      { speciesId: 169, levelOffset: 2, moves: ['cross-poison', 'air-cutter', 'bite', 'tailwind'], ability: 'inner-focus', heldItem: 'sitrus-berry' },
    ],
    extraMembers: {
      1: [{ speciesId: 18, levelOffset: 0, moves: ['aerial-ace', 'twister', 'feather-dance', 'quick-attack'], ability: 'keen-eye' }],
      2: [{ speciesId: 398, levelOffset: 0, moves: ['aerial-ace', 'close-combat', 'take-down', 'agility'], ability: 'intimidate' }],
      3: [{ speciesId: 130, levelOffset: 1, moves: ['hurricane', 'waterfall', 'dragon-dance', 'crunch'], ability: 'moxie' }],
    },
  },
];
