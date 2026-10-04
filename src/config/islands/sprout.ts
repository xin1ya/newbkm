/**
 * 岛 1 · 萌芽群岛（设计 §3.2）——灰盒版（WLD-005）。
 * 坐标：原点在岛屿中心，+X 东，+Z 南，Y 为高度（米）。
 * 高度图与材质图由 `pnpm gen:graybox` 根据本文件生成（scripts/gen-sprout-graybox.ts）。
 */
import { SPROUT_TOWNS } from './towns';
import type { IslandConfig } from './types';

export const SPROUT: IslandConfig = {
  id: 'sprout',
  name: '萌芽群岛',
  size: [1024, 1024],
  heightmap: 'islands/sprout/height.png',
  heightRange: [-24, 72],
  splatmaps: ['islands/sprout/splat0.png', 'islands/sprout/splat1.png'],
  seaLevel: 0,
  chunkSize: 128,
  props: 'islands/sprout/props.json',
  palette: { primary: '#8fd16a', secondary: '#6cc3f0', accent: '#f6e27a' },
  spawnPoint: [-118, 0, 378],
  spawnYaw: Math.PI,
  zones: [
    {
      id: 'sprout-town',
      name: '萌芽镇',
      kind: 'town',
      polygon: [[-190, 300], [30, 300], [50, 430], [-210, 440]],
      bgm: 'town-sprout',
      legacyMapId: 'sprout-town',
    },
    {
      id: 'sprout-meadow',
      name: '萌芽草原',
      kind: 'wild',
      polygon: [[-250, 290], [30, 290], [50, 140], [10, 55], [-70, 55], [-270, 70]],
      bgm: 'field-meadow',
      encounterTable: 'sprout-meadow',
      levelRange: [2, 5],
      weather: [
        { weather: 'clear', weight: 6 },
        { weather: 'rain', weight: 2 },
        { weather: 'fog', weight: 1, time: 'night' },
      ],
      legacyMapId: 'route-1',
    },
    {
      id: 'cuilan-town',
      name: '翠澜镇',
      kind: 'town',
      polygon: [[-95, -15], [-65, 45], [15, 45], [15, -165], [-75, -140]],
      bgm: 'town-cuilan',
      legacyMapId: 'verdant-town',
    },
    {
      id: 'cuilan-lakeside',
      name: '翠澜湖畔',
      kind: 'wild',
      polygon: [[25, 45], [65, 135], [270, 110], [300, -150], [205, -245], [25, -170]],
      bgm: 'field-lake',
      encounterTable: 'cuilan-lakeside',
      levelRange: [5, 9],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 3 },
        { weather: 'fog', weight: 1 },
      ],
      legacyMapId: 'new-route-1',
    },
    {
      id: 'harbor-city',
      name: '港湾市',
      kind: 'town',
      polygon: [[300, -70], [440, -90], [450, 150], [310, 160], [290, 40]],
      bgm: 'town-harbor',
      legacyMapId: 'harbor-city',
    },
    {
      id: 'harbor-cliffs',
      name: '港湾海崖',
      kind: 'wild',
      polygon: [[200, -270], [320, -165], [440, -130], [430, -400], [260, -430]],
      bgm: 'field-cliffs',
      encounterTable: 'harbor-cliffs',
      levelRange: [8, 12],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'rain', weight: 2 },
        { weather: 'storm', weight: 1 },
      ],
      legacyMapId: 'harbor-cliff-route',
    },
    {
      id: 'phantom-forest',
      name: '幻影之森',
      kind: 'wild',
      polygon: [[-420, -120], [-130, -150], [-110, -380], [-300, -440], [-440, -300]],
      bgm: 'field-phantom-forest',
      encounterTable: 'phantom-forest',
      levelRange: [6, 10],
      weather: [
        { weather: 'fog', weight: 5 },
        { weather: 'clear', weight: 2 },
        { weather: 'rain', weight: 1 },
      ],
      legacyMapId: 'phantom-forest',
    },
    {
      // 翠澜河入海口的冲积扇：分汊水道、芦苇湿地、泥滩与浅水塘（放在河谷之前，重叠处归河口）
      id: 'river-delta',
      name: '翠澜河口',
      kind: 'wild',
      polygon: [[200, 372], [232, 382], [246, 400], [232, 434], [208, 462], [168, 472], [126, 464], [118, 446], [148, 420], [178, 394]],
      bgm: 'field-lake',
      encounterTable: 'river-delta',
      levelRange: [8, 12],
      weather: [
        { weather: 'rain', weight: 4 },
        { weather: 'clear', weight: 3 },
        { weather: 'fog', weight: 1 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      // M1-01：翠澜湖的出水口向东南流入大海，河谷两岸为缓丘
      id: 'cuilan-river',
      name: '翠澜河谷',
      kind: 'wild',
      polygon: [[165, 150], [300, 145], [330, 250], [260, 370], [190, 430], [120, 360], [135, 250]],
      bgm: 'field-lake',
      encounterTable: 'cuilan-river',
      levelRange: [5, 9],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 2 },
        { weather: 'fog', weight: 1, time: 'night' },
      ],
    },
    {
      // 2026-10 生态扩充：萌芽镇以西的海岸——三个弧形沙湾 + 礁石岬角，崖下碎石带
      id: 'west-beach',
      name: '西岸沙滩',
      kind: 'wild',
      polygon: [[-212, 445], [-250, 300], [-270, 70], [-296, 14], [-322, 62], [-332, 130], [-327, 200], [-330, 268], [-321, 338], [-298, 394], [-264, 424], [-236, 442]],
      bgm: 'field-meadow',
      encounterTable: 'west-beach',
      levelRange: [3, 6],
      weather: [
        { weather: 'clear', weight: 6 },
        { weather: 'rain', weight: 2 },
      ],
    },
    {
      // 草原与幻影之森之间的疏林灌木带
      id: 'sprout-woodland',
      name: '林缘小径',
      kind: 'wild',
      polygon: [[-270, 70], [-70, 55], [-95, -15], [-130, -150], [-430, -118], [-410, -72], [-330, -42], [-278, 10]],
      bgm: 'field-meadow',
      encounterTable: 'sprout-woodland',
      levelRange: [4, 8],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 1 },
        { weather: 'fog', weight: 2, time: 'night' },
      ],
    },
    {
      // 翠澜镇以北的丘陵，澜源溪上游
      id: 'lanyuan-highlands',
      name: '澜源高地',
      kind: 'wild',
      polygon: [[-130, -150], [-75, -140], [15, -165], [25, -170], [205, -245], [200, -270], [260, -430], [-110, -440], [-110, -380]],
      bgm: 'field-cliffs',
      encounterTable: 'lanyuan-highlands',
      levelRange: [7, 11],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'rain', weight: 2 },
        { weather: 'fog', weight: 2 },
      ],
    },
    {
      id: 'sea-route-1',
      name: '水路 1',
      kind: 'sea',
      polygon: [[462, -230], [512, -230], [512, 230], [462, 230]],
      bgm: 'sea-route',
      encounterTable: 'sea-route-1',
      levelRange: [10, 14],
      legacyMapId: 'water-route-1',
    },
  ],
  waterBodies: [{ id: 'cuilan-lake', level: 5, center: [135, -55], radius: [120, 105] }],
  rivers: [
    // 北部山地的泉水汇成澜源溪，自北向南注入翠澜湖
    { id: 'lanyuan-creek', name: '澜源溪', width: 7, points: [[92, -350], [112, -285], [104, -225], [121, -150]], levels: [19, 13.5, 8.5, 5] },
    // 湖水从东南岸流出，经翠澜河谷入海
    // 2026-10 河口三角洲的分汊水道（主河道之外向东西各分一支入海）
    { id: 'delta-west', name: '翠澜河西汊', width: 5, points: [[183, 405], [170, 418], [164, 431], [150, 440], [142, 455], [126, 466]], levels: [1.0, 0.8, 0.6, 0.42, 0.25, 0.12] },
    { id: 'delta-east', name: '翠澜河东汊', width: 5, points: [[186, 400], [193, 412], [196, 424], [199, 434], [200, 446], [198, 460]], levels: [1.0, 0.8, 0.6, 0.42, 0.25, 0.12] },
    { id: 'cuilan-river', name: '翠澜河', width: 11, points: [[225, 5], [252, 83], [262, 140], [238, 220], [205, 320], [182, 400], [172, 478]], levels: [5, 4.5, 4, 3.1, 2.1, 1.1, 0.25] },
  ],
  // 头目巢穴（计划文档 §3.3）。坐标按 height.png 选在区域内的平缓陆地（坡度 < 14°）；湖畔巢穴在湖东浅水（水深约 2–3 m）
  alphaDens: [
    { id: 'den-meadow', theme: 'nest', name: '草原中央的大巢', speciesId: 18, level: 11, position: [-120, 170], radius: 6, zone: 'sprout-meadow', moves: ['gust', 'quick-attack', 'wing-attack', 'air-slash'] },
    { id: 'den-lakeside', theme: 'whirlpool', name: '湖东浅滩', speciesId: 130, level: 15, position: [238, -55], radius: 7, zone: 'cuilan-lakeside', moves: ['bite', 'twister', 'leer', 'aqua-tail'], when: { weather: ['rain', 'storm'] }, whenText: '只在雨天浮出水面' },
    { id: 'den-cliffs', theme: 'seacliff', name: '海崖之巅', speciesId: 279, level: 18, position: [320, -336], radius: 6, zone: 'harbor-cliffs', moves: ['water-pulse', 'wing-attack', 'supersonic', 'air-slash'] },
    { id: 'den-forest', theme: 'shadow', name: '森林深处的石圈', speciesId: 571, level: 16, position: [-268, -340], radius: 6, zone: 'phantom-forest', moves: ['scratch', 'fury-swipes', 'bite', 'night-daze'], when: { time: 'night', weather: ['fog'] }, whenText: '只在夜晚或雾天出现' },
    // 计划为 075 隆隆石 / 067 豪力：进化型模型在「进化线闭合」批次制作，先由小拳石头目镇守
    { id: 'den-highlands', theme: 'rock', name: '高地石冢', speciesId: 74, level: 17, position: [-52, -300], radius: 6, zone: 'lanyuan-highlands', moves: ['rock-throw', 'defense-curl', 'bulldoze', 'rock-slide'] },
    { id: 'den-delta', theme: 'mudflat', name: '河口泥滩', speciesId: 99, level: 16, position: [152, 456], radius: 6, zone: 'river-delta', moves: ['bubble-beam', 'metal-claw', 'harden', 'crabhammer'] },
  ],
  roads: [
    { id: 'road-town-meadow', surface: 'dirt', width: 6, points: [[-80, 390], [-70, 300], [-40, 200], [-20, 120], [-20, 50], [-30, -20]] },
    { id: 'road-lake-north', surface: 'dirt', width: 5, points: [[0, 55], [70, 120], [190, 120], [270, 70], [330, 40], [390, 35]] },
    { id: 'road-harbor-cliffs', surface: 'dirt', width: 4, points: [[360, -30], [345, -150], [330, -260], [320, -360]] },
    { id: 'road-meadow-forest', surface: 'dirt', width: 4, points: [[-40, 180], [-150, 150], [-190, 30], [-150, -110], [-190, -200]] },
    // M1-03 道馆栈桥从湖上主栈道东侧出发（岸边到主栈道由城镇布局的连岸平台承接）
    { id: 'bridge-gym', surface: 'boardwalk', width: 3, points: [[28.6, -55], [119, -55]] }, // 终点落在湖心岛平地（岛半径 17 → x ≥ 118）
    { id: 'bridge-cuilan-river', surface: 'boardwalk', width: 5, points: [[234, 94], [270, 71.5]] },
    // M1-01 萌芽镇西侧沿海滩北上到海崖下（隐藏洞穴）
    { id: 'path-west-beach', surface: 'dirt', width: 3, points: [[-190, 385], [-228, 350], [-252, 290], [-256, 200], [-254, 120]] },
    { id: 'town-sprout-plaza', surface: 'stone', width: 10, points: [[-150, 365], [0, 355]] },
    { id: 'town-harbor-street', surface: 'stone', width: 9, points: [[330, 40], [440, 35]] },
    // M1-02/03/04 城镇小路
    ...SPROUT_TOWNS.flatMap((t) => t.paths),
  ],
  pois: [
    { id: 'player-house', kind: 'door', name: '自己家', position: [-120, 0, 360], interior: 'sprout-player-house', showOnMap: true },
    { id: 'magnolia-lab', kind: 'door', name: '木兰博士研究所', position: [-20, 0, 345], interior: 'sprout-lab', showOnMap: true },
    { id: 'sprout-dock', kind: 'dock', name: '萌芽镇码头', position: [-70, 0, 452], showOnMap: true },
    { id: 'elder-pu-house', kind: 'door', name: '蒲婆婆家', position: [-165, 0, 395], interior: 'sprout-elder-house', showOnMap: true },
    { id: 'pokecenter-cuilan', kind: 'pokecenter', name: '宝可梦中心（翠澜镇）', position: [-40, 0, -10], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-cuilan', kind: 'mart', name: '友好商店（翠澜镇）', position: [-55, 0, -70], interior: 'mart', showOnMap: true },
    { id: 'gym-cuilan', kind: 'gym', name: '翠澜道馆', position: [135, 0, -55], interior: 'gym-cuilan', showOnMap: true },
    { id: 'pokecenter-harbor', kind: 'pokecenter', name: '宝可梦中心（港湾市）', position: [350, 0, 10], interior: 'pokecenter', showOnMap: true },
    { id: 'harbor-market', kind: 'mart', name: '港湾大市场', position: [380, 0, 90], interior: 'harbor-market', showOnMap: true },
    { id: 'harbor-pier', kind: 'fishing', name: '钓鱼码头', position: [445, 0, 115], showOnMap: true },
    { id: 'harbor-lighthouse', kind: 'landmark', name: '港湾灯塔', position: [425, 0, -60], showOnMap: true },
    { id: 'harbor-ferry', kind: 'ferry', name: '渡船码头', position: [452, 0, 25], showOnMap: true },
    { id: 'phantom-forest-entrance', kind: 'landmark', name: '幻影之森入口', position: [-150, 0, -120], showOnMap: true },
    { id: 'zorua-clearing', kind: 'quest', name: '雾中空地', position: [-320, 0, -330] },
    { id: 'meadow-hidden-cave', kind: 'cave', name: '海崖下的洞穴', position: [-247.6, 0, 110], interior: 'sprout-hidden-cave', doorYaw: -Math.PI / 2 },
  ],
  blockers: [
    { id: 'gym-bridge-gate', type: 'story', requiresFlag: 'starter-chosen', position: [31.5, 0, -55], radius: 2.5, hint: '道馆正在准备中，先去找木兰博士吧。' },
    { id: 'harbor-open-sea', type: 'surf', requiresFlag: 'hm03-surf', position: [458, 0, 60], radius: 6, hint: '海面很宽阔……似乎需要某种能力才能通过。' },
    { id: 'hidden-cave-rock', type: 'rock-smash', requiresFlag: 'hm05-rock-smash', position: [-249.6, 0, 110], radius: 2.5, hint: '裂开的岩石挡住了洞口……似乎需要某种能力才能通过。' },
  ],
};
