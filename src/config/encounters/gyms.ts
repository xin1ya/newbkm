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
];
