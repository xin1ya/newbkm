/**
 * M2 · 碧潮群岛训练家。
 * 野外训练家等级跟随区域：古树林道 / 碧潮海岸 15–18、碧潮古森 17–19、矿石峡谷 19–21、赭石丘陵 20–22、
 * 余烬小径 21–23、温泉溪谷 22–24、活火山麓 25–27。
 * 道馆训练家等级随「本岛徽章数」的第 1 档设计（17–19），馆主队伍由 GymDef 动态生成（party 留空）。
 */
import type { TrainerDef } from '@/systems/trainers';
import type { TrainerPlacement } from './sprout';

const PI = Math.PI;

export const TIDE_TRAINERS: TrainerPlacement[] = [
  // —— 古树林道 ——
  {
    def: {
      id: 'camper-lin',
      name: '阿林',
      title: '野营少年',
      ai: 'basic',
      prizeBase: 20,
      sight: { range: 10, fov: 70 },
      party: [
        { species: 285, level: 15 },
        { species: 263, level: 16 },
      ],
      intro: ['欢迎来到碧潮群岛！先和本地人比划比划吧！'],
      defeat: ['海那边来的训练家都这么厉害吗……'],
      after: ['沿着这条林道往东走就是矿石峡谷。', '路上的大树根很滑，骑车要小心。'],
      entrance: 'point',
    },
    npc: {
      appearance: { look: 'camper' },
      schedule: [{ from: 6, to: 21, at: { island: 'tide', position: [-262, 58], yaw: -PI / 2 } }],
    },
  },
  {
    def: {
      id: 'bugcatcher-mu',
      name: '小木',
      title: '捕虫少年',
      ai: 'random',
      prizeBase: 16,
      sight: { range: 9, fov: 60 },
      party: [
        { species: 165, level: 15 },
        { species: 165, level: 15 },
        { species: 46, level: 16 },
      ],
      intro: ['古森里的虫子比萌芽群岛的大一圈！'],
      defeat: ['芭瓢虫们飞走了……'],
      after: ['赫拉克罗斯最喜欢古森深处的树汁。', '大白天在大树附近转转，说不定能碰到。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'bug-catcher' },
      schedule: [{ from: 6, to: 19, at: { island: 'tide', position: [-150, 118], yaw: PI / 2 } }],
    },
  },
  // —— 碧潮古森 ——
  {
    def: {
      id: 'lass-ye',
      name: '小叶',
      title: '迷你裙',
      ai: 'basic',
      prizeBase: 20,
      sight: { range: 9, fov: 70 },
      party: [
        { species: 406, level: 17 },
        { species: 43, level: 17 },
        { species: 315, level: 18 },
      ],
      intro: ['古森的花开得正好，你的宝可梦也想来闻闻吗？'],
      defeat: ['花瓣都被吹散了……'],
      after: ['北边有座被藤蔓缠住的神龛。', '叶岚馆主说，等你配得上古森的认可，自然就能劈开藤蔓。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'lass', palette: { jacket: '#5d9a3e' } },
      schedule: [{ from: 7, to: 18, at: { island: 'tide', position: [-500, -150], yaw: PI } }],
    },
  },
  {
    def: {
      id: 'hiker-song',
      name: '老松',
      title: '登山男',
      ai: 'smart',
      prizeBase: 28,
      sight: { range: 11, fov: 60 },
      party: [
        { species: 74, level: 18 },
        { species: 66, level: 18 },
        { species: 27, level: 19 },
      ],
      intro: ['在古森里迷路三天了，正好找个人练练手！'],
      defeat: ['哈哈，输得心服口服！'],
      after: ['往东穿过高原就是异变遗迹。', '那层紫色的光……我靠近一下头就疼。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'hiker' },
      schedule: [{ from: 6, to: 20, at: { island: 'tide', position: [-404, -296], yaw: PI / 2 } }],
    },
  },
  // —— 碧潮海岸 ——
  {
    def: {
      id: 'swimmer-hai',
      name: '阿海',
      title: '泳裤小伙',
      ai: 'basic',
      prizeBase: 20,
      sight: { range: 10, fov: 70 },
      party: [
        { species: 72, level: 16 },
        { species: 278, level: 17 },
        { species: 118, level: 17 },
      ],
      intro: ['碧潮的海水暖和多了，游一整天都不累！'],
      defeat: ['呛到海水了……'],
      after: ['珊瑚沉船附近有好多太阳珊瑚。', '雨天出海能看到更多水系宝可梦。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'swimmer' },
      schedule: [{ from: 8, to: 18, at: { island: 'tide', position: [-410, 252], yaw: -PI / 4 } }],
    },
  },
  // —— 矿石峡谷 ——
  {
    def: {
      id: 'miner-dong',
      name: '大东',
      title: '矿工',
      ai: 'smart',
      prizeBase: 28,
      sight: { range: 10, fov: 60 },
      party: [
        { species: 74, level: 19 },
        { species: 75, level: 20 },
        { species: 104, level: 20 },
      ],
      intro: ['下了工就想对战！来一场！'],
      defeat: ['镐头都震麻了……'],
      after: ['矿洞最近总有怪声。', '工头家就在矿石镇主街东头，他最清楚矿里的事。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'miner' },
      schedule: [{ from: 6, to: 20, at: { island: 'tide', position: [96, 40], yaw: PI } }],
    },
  },
  {
    def: {
      id: 'hiker-yan',
      name: '岩叔',
      title: '登山男',
      ai: 'smart',
      prizeBase: 28,
      sight: { range: 11, fov: 60 },
      party: [
        { species: 95, level: 19 },
        { species: 111, level: 20 },
      ],
      intro: ['峡谷的风里都是沙子，你扛得住吗？'],
      defeat: ['好家伙，比沙暴还猛！'],
      after: ['峡谷断崖那边住着一条巨大的大岩蛇头目。', '没有准备好，千万别靠近。'],
      entrance: 'point',
    },
    npc: {
      appearance: { look: 'hiker', palette: { jacket: '#8a6440' } },
      schedule: [{ from: 6, to: 20, at: { island: 'tide', position: [-36, 150], yaw: PI / 2 } }],
    },
  },
  // —— 赭石丘陵 ——
  {
    def: {
      id: 'camper-tu',
      name: '小土',
      title: '野营少年',
      ai: 'basic',
      prizeBase: 22,
      sight: { range: 10, fov: 70 },
      party: [
        { species: 104, level: 20 },
        { species: 27, level: 21 },
        { species: 343, level: 21 },
      ],
      intro: ['赭石丘陵的骨冢可不是闹着玩的，先过我这关！'],
      defeat: ['我的卡拉卡拉哭了……'],
      after: ['骨冢前的小路被一块巨石挡住了。', '要推开它，得有「怪力」才行。'],
      entrance: 'point',
    },
    npc: {
      appearance: { look: 'camper', palette: { jacket: '#c08a3e' } },
      schedule: [{ from: 7, to: 19, at: { island: 'tide', position: [140, 392], yaw: PI } }],
    },
  },
  // —— 余烬小径 ——
  {
    def: {
      id: 'kindler-huo',
      name: '阿火',
      title: '吹火人',
      ai: 'smart',
      prizeBase: 26,
      sight: { range: 10, fov: 60 },
      party: [
        { species: 218, level: 21 },
        { species: 58, level: 22 },
        { species: 322, level: 22 },
      ],
      intro: ['看我喷出的火焰！'],
      defeat: ['火……被吹灭了……'],
      after: ['火山镇越来越热了，观测站的人都忙疯了。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'youngster', palette: { jacket: '#c8502a', shirt: '#f0742a', cap: '#2c2428' } },
      schedule: [{ from: 6, to: 21, at: { island: 'tide', position: [330, 136], yaw: -PI / 2 } }],
    },
  },
  // —— 温泉溪谷 ——
  {
    def: {
      id: 'lass-quan',
      name: '小泉',
      title: '迷你裙',
      ai: 'smart',
      prizeBase: 24,
      sight: { range: 9, fov: 70 },
      party: [
        { species: 79, level: 22 },
        { species: 194, level: 22 },
        { species: 284, level: 23 },
      ],
      intro: ['泡完温泉正精神呢！陪我对战吧！'],
      defeat: ['又得回去泡一次了……'],
      after: ['温泉最近不太热，听说是源头被石头堵住了。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'lass', palette: { jacket: '#7ac8d8' } },
      schedule: [{ from: 8, to: 19, at: { island: 'tide', position: [466, 372], yaw: PI } }],
    },
  },
  // —— 活火山麓 ——
  {
    def: {
      id: 'hiker-lie',
      name: '烈山',
      title: '登山男',
      ai: 'smart',
      prizeBase: 32,
      sight: { range: 12, fov: 60 },
      party: [
        { species: 75, level: 25 },
        { species: 219, level: 26 },
        { species: 323, level: 27 },
      ],
      intro: ['能走到火山麓的，都不是普通训练家！'],
      defeat: ['你比熔岩还烫！'],
      after: ['火山洞窟里伸手不见五指。', '碧焰道馆的徽章能让宝可梦使出「闪光」。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'hiker', palette: { jacket: '#c8502a' } },
      schedule: [{ from: 6, to: 20, at: { island: 'tide', position: [664, -82], yaw: PI } }],
    },
  },
];

/**
 * 碧潮群岛道馆训练家（室内固定站位，NPC 定义在 config/npcs/tide.ts）。
 */
export const TIDE_GYM_TRAINERS: TrainerDef[] = [
  // —— 碧潮道馆（草）——
  {
    id: 'gym-azure-1',
    name: '阿蕨',
    title: '园艺家',
    ai: 'smart',
    prizeBase: 24,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 69, level: 17, moves: ['vine-whip', 'acid', 'sleep-powder', 'wrap'] },
      { species: 285, level: 18, moves: ['mega-drain', 'headbutt', 'stun-spore', 'leech-seed'] },
    ],
    intro: ['盘根小径可不好走！', '想见叶岚大人，先陪我的花草们玩玩！'],
    defeat: ['根……被拔起来了……'],
    after: ['草属性怕火、怕飞行、怕冰，也怕虫和毒。', '可叶岚大人的斗笠菇会格斗招式，岩石属性别大意。'],
    entrance: 'wave',
  },
  {
    id: 'gym-azure-2',
    name: '小苔',
    title: '迷你裙',
    ai: 'smart',
    prizeBase: 24,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 406, level: 18, moves: ['mega-drain', 'stun-spore', 'growth', 'absorb'] },
      { species: 46, level: 18, moves: ['fury-cutter', 'absorb', 'stun-spore', 'scratch'] },
      { species: 43, level: 19, moves: ['acid', 'mega-drain', 'poison-powder', 'sleep-powder'] },
    ],
    intro: ['走到这里，鞋子上沾满青苔了吧？', '最后一道关卡，是我！'],
    defeat: ['你的伙伴像大树一样稳。'],
    after: ['叶岚大人在树洞前等你。', '她的王牌会「寄生种子」，拖久了会很难缠。'],
    entrance: 'wave',
  },
  {
    id: 'gym-azure-leader',
    name: '叶岚',
    title: '碧潮道馆馆主',
    ai: 'smart',
    prizeBase: 0,
    sight: { range: 0, fov: 0 },
    party: [],
    gym: 'gym-azure',
    intro: ['我是叶岚。古森里的每一棵树，都比这座镇子更古老。', '它们不说话，却记得一切——包括群岛的异变。', '让我听听，你和伙伴的根扎得有多深！'],
    defeat: ['……古森在为你沙沙作响。'],
    after: ['藤蔓挡路的时候，记得用「居合劈」。', '古森北面的神龛，也许藏着异变的线索。'],
    entrance: 'bow',
  },
  // —— 矿石道馆（岩）——
  {
    id: 'gym-ore-1',
    name: '石头',
    title: '矿工',
    ai: 'smart',
    prizeBase: 26,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 74, level: 17, moves: ['rock-throw', 'defense-curl', 'tackle', 'rollout'] },
      { species: 27, level: 18, moves: ['dig', 'rollout', 'defense-curl', 'scratch'] },
    ],
    intro: ['采石场的规矩：先打过矿工，再见工头！'],
    defeat: ['碎、碎了……'],
    after: ['岩石属性怕水、草、格斗、地面和钢。', '岩磊大人的大岩蛇特别硬，有「结实」特性，一击打不倒。'],
    entrance: 'flex',
  },
  {
    id: 'gym-ore-2',
    name: '砾砾',
    title: '登山女',
    ai: 'smart',
    prizeBase: 26,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 104, level: 18, moves: ['dig', 'headbutt', 'leer', 'focus-energy'] },
      { species: 343, level: 18, moves: ['confusion', 'rapid-spin', 'mud-slap', 'harden'] },
      { species: 74, level: 19, moves: ['rock-throw', 'bulldoze', 'defense-curl', 'rollout'] },
    ],
    intro: ['爬过了碎石坡？体力不错嘛！', '再陪我爬一座山！'],
    defeat: ['我得再去练练腿了……'],
    after: ['岩磊大人说话像打雷，其实心特别软。'],
    entrance: 'point',
  },
  {
    id: 'gym-ore-leader',
    name: '岩磊',
    title: '矿石道馆馆主',
    ai: 'smart',
    prizeBase: 0,
    sight: { range: 0, fov: 0 },
    party: [],
    gym: 'gym-ore',
    intro: ['哈哈哈！我是岩磊，矿石镇的工头，也是这座道馆的馆主！', '石头不会说谎——硬就是硬，碎就是碎。', '来吧，用你最硬的一拳，敲敲我的石头！'],
    defeat: ['哈！好一记重拳！'],
    after: ['矿洞的事多亏了你。', '在野外看到挡路的巨石，记得用「怪力」推开。'],
    entrance: 'flex',
  },
  // —— 碧焰道馆（火）——
  {
    id: 'gym-flame-1',
    name: '阿炭',
    title: '吹火人',
    ai: 'smart',
    prizeBase: 26,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 218, level: 17, moves: ['ember', 'rock-throw', 'harden', 'smog'] },
      { species: 58, level: 18, moves: ['ember', 'bite', 'roar', 'take-down'] },
    ],
    intro: ['熔岩沟中间的栈道很窄，掉下去可不是闹着玩的！'],
    defeat: ['火……熄了……'],
    after: ['火属性怕水、地面和岩石。', '炎棘大人的煤炭龟会放烟幕，命中率要留意。'],
    entrance: 'flex',
  },
  {
    id: 'gym-flame-2',
    name: '焰焰',
    title: '迷你裙',
    ai: 'smart',
    prizeBase: 26,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 77, level: 18, moves: ['ember', 'stomp', 'tail-whip', 'flame-charge'] },
      { species: 322, level: 18, moves: ['ember', 'focus-energy', 'tackle', 'growl'] },
      { species: 228, level: 19, moves: ['ember', 'bite', 'howl', 'smog'] },
    ],
    intro: ['热吗？这里可是火山的心脏！'],
    defeat: ['被你浇了一头冷水……'],
    after: ['炎棘大人从不笑，但她的火焰很温柔。'],
    entrance: 'wave',
  },
  {
    id: 'gym-flame-leader',
    name: '炎棘',
    title: '碧焰道馆馆主',
    ai: 'smart',
    prizeBase: 0,
    sight: { range: 0, fov: 0 },
    party: [],
    gym: 'gym-flame',
    intro: ['……炎棘。', '火山镇的火，三百年没有熄灭过。最近，它烧得太旺了。', '在我弄清楚之前——先让我看看，你的火能烧多旺。'],
    defeat: ['……够了。你赢了。'],
    after: ['火山洞窟漆黑一片，「闪光」能照亮它。', '地热的事，观测站的老秦一直在查。'],
    entrance: 'bow',
  },
];
