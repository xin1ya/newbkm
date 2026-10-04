/**
 * 岛 2 · 碧潮群岛（设计 §3.2 / §3.3，M2-02 / M2-03）。
 * 坐标：原点在地图中心，+X 东，+Z 南，Y 为高度（米）。地图 2048 m 见方：
 *   - 西段 x < -600：萌芽—碧潮海域（航线走廊，宽约 460 m，珊瑚礁小岛 / 沉船 / 浮标，两侧暗礁与巨浪封边）；
 *     走廊西端 x = -1024 与萌芽群岛东岸的水路 1 相连（systems/travel）。
 *   - 东段：碧潮群岛主岛（约 1.8 km²）+ 东北的余烬屿、南面的温泉屿两座小岛。
 *     西：碧潮镇（巨树根系）与碧潮古森；中：矿石峡谷与矿石镇，北面中央高原上是异变遗迹；
 *     东：活火山（火山口约 172 m）与火山镇；东南：温泉溪谷与温泉乡。
 * 高度图 / 材质图 / 摆放物由 `pnpm gen:tide` 根据本文件生成（scripts/gen-tide.ts）。
 * 主色板（设计 §8.4）：深绿 / 赭石 / 熔岩橙。
 */
import { TIDE_TOWNS } from './towns/tide';
import type { IslandConfig } from './types';

export const TIDE: IslandConfig = {
  id: 'tide',
  name: '碧潮群岛',
  size: [2048, 2048],
  heightmap: 'islands/tide/height.png',
  heightRange: [-30, 200],
  splatmaps: ['islands/tide/splat0.png', 'islands/tide/splat1.png', 'islands/tide/splat2.png'],
  seaLevel: 0,
  chunkSize: 128,
  props: 'islands/tide/props.json',
  palette: { primary: '#2f7a46', secondary: '#c08a3e', accent: '#f0742a' },
  // 首次跨海由剧情把玩家放到走廊西端；这里是读档失效时的兜底出生点（碧潮镇宝可梦中心门口）
  spawnPoint: [-500, 0, -12],
  spawnYaw: 0,
  // 冲浪 / 飞行只能在航线走廊 + 主岛近海内（走廊外是暗礁、巨浪与海雾）
  travelBounds: [
    [-1024, -232], [-700, -232], [-660, -300], [-640, -720], [0, -800], [700, -800], [1000, -700], [1010, 0], [1000, 760], [400, 800], [-300, 760], [-640, 640], [-660, 300], [-700, 232], [-1024, 232],
  ],
  zones: [
    // ———————— 城镇 ————————
    {
      id: 'tide-town',
      name: '碧潮镇',
      kind: 'town',
      polygon: [[-600, -95], [-420, -120], [-372, -20], [-380, 120], [-470, 160], [-600, 150]],
      bgm: 'town-tide',
      legacyMapId: 'azure-town',
    },
    {
      id: 'ore-town',
      name: '矿石镇',
      kind: 'town',
      polygon: [[10, 150], [150, 140], [176, 230], [168, 318], [26, 322], [-6, 240]],
      bgm: 'town-ore',
      legacyMapId: 'ore-town',
    },
    {
      id: 'flame-town',
      name: '火山镇',
      kind: 'town',
      polygon: [[452, -40], [640, -52], [676, 60], [650, 150], [470, 160], [440, 60]],
      bgm: 'town-flame',
      legacyMapId: 'flame-town',
    },
    {
      id: 'spring-village',
      name: '温泉乡',
      kind: 'town',
      polygon: [[300, 470], [500, 450], [586, 548], [560, 650], [420, 676], [300, 620]],
      bgm: 'town-spring',
      legacyMapId: 'hot-spring-village',
    },
    // ———————— 野外（顺序 = 重叠时的优先级：小区域在前） ————————
    {
      id: 'crater-rim',
      name: '火山口',
      kind: 'wild',
      polygon: [[560, -390], [640, -420], [720, -390], [748, -300], [720, -210], [640, -180], [560, -210], [532, -300]],
      bgm: 'field-volcano',
      encounterTable: 'crater-rim',
      levelRange: [27, 31],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'sandstorm', weight: 1 },
      ],
    },
    {
      id: 'ruins-plaza',
      name: '异变遗迹 · 入口',
      kind: 'dungeon-entrance',
      polygon: [[0, -470], [80, -470], [96, -400], [60, -370], [10, -372], [-14, -410]],
      bgm: 'field-ruins',
    },
    {
      id: 'azure-forest',
      name: '碧潮古森',
      kind: 'wild',
      polygon: [[-600, -95], [-420, -120], [-260, -150], [-170, -190], [-150, -420], [-220, -640], [-400, -590], [-530, -440], [-596, -260]],
      bgm: 'field-ancient-forest',
      encounterTable: 'azure-forest',
      levelRange: [15, 20],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'rain', weight: 3 },
        { weather: 'fog', weight: 2 },
      ],
      legacyMapId: 'azure-forest',
    },
    {
      id: 'root-trail',
      name: '古树林道',
      kind: 'wild',
      polygon: [[-372, -20], [-420, -120], [-260, -150], [-170, -190], [-60, -110], [-20, 70], [-6, 240], [-120, 260], [-250, 220], [-380, 120]],
      bgm: 'field-ancient-forest',
      encounterTable: 'root-trail',
      levelRange: [14, 18],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 2 },
      ],
      legacyMapId: 'route-2',
    },
    {
      id: 'tide-coast',
      name: '碧潮海岸',
      kind: 'wild',
      polygon: [[-600, 150], [-470, 160], [-380, 120], [-250, 220], [-210, 380], [-200, 580], [-330, 520], [-470, 380], [-570, 250]],
      bgm: 'field-coast',
      encounterTable: 'tide-coast',
      levelRange: [14, 18],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 2 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'ancient-plateau',
      name: '中央高原',
      kind: 'wild',
      polygon: [[-150, -420], [-170, -190], [-60, -110], [40, -150], [200, -170], [290, -330], [250, -560], [60, -700], [-160, -680], [-220, -640]],
      bgm: 'field-plateau',
      encounterTable: 'ancient-plateau',
      levelRange: [22, 26],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'fog', weight: 2 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'ore-canyon',
      name: '矿石峡谷',
      kind: 'wild',
      polygon: [[-60, -110], [40, -150], [200, -170], [230, 0], [176, 230], [150, 140], [10, 150], [-6, 240], [-20, 70]],
      bgm: 'field-canyon',
      encounterTable: 'ore-canyon',
      levelRange: [17, 22],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'sandstorm', weight: 2 },
      ],
      legacyMapId: 'ore-canyon',
    },
    {
      id: 'ember-trail',
      name: '余烬小径',
      kind: 'wild',
      polygon: [[200, -170], [330, -150], [452, -40], [440, 60], [470, 160], [360, 210], [176, 230], [230, 0]],
      bgm: 'field-volcano',
      encounterTable: 'ember-trail',
      levelRange: [20, 24],
      weather: [
        { weather: 'clear', weight: 4 },
      ],
      legacyMapId: 'ore-flame-route',
    },
    {
      id: 'volcano-slope',
      name: '活火山麓',
      kind: 'wild',
      polygon: [[290, -330], [200, -170], [330, -150], [452, -40], [640, -52], [676, 60], [800, 40], [930, -80], [940, -320], [840, -540], [640, -660], [420, -640], [250, -560]],
      bgm: 'field-volcano',
      encounterTable: 'volcano-slope',
      levelRange: [24, 28],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'sandstorm', weight: 1 },
      ],
    },
    {
      id: 'spring-valley',
      name: '温泉溪谷',
      kind: 'wild',
      polygon: [[176, 230], [360, 210], [470, 160], [650, 150], [676, 60], [800, 40], [880, 260], [790, 470], [586, 548], [500, 450], [300, 470], [230, 400]],
      bgm: 'field-spring',
      encounterTable: 'spring-valley',
      levelRange: [21, 25],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'rain', weight: 2 },
        { weather: 'fog', weight: 2 },
      ],
      legacyMapId: 'flame-spring-route',
    },
    {
      id: 'ochre-hills',
      name: '赭石丘陵',
      kind: 'wild',
      polygon: [[-250, 220], [-120, 260], [-6, 240], [26, 322], [168, 318], [176, 230], [230, 400], [300, 470], [300, 620], [140, 680], [-60, 640], [-200, 580], [-210, 380]],
      bgm: 'field-canyon',
      encounterTable: 'ochre-hills',
      levelRange: [18, 22],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 1 },
      ],
    },
    // ———————— 海域 ————————
    {
      id: 'tide-sea-route',
      name: '萌芽—碧潮海域',
      kind: 'sea',
      polygon: [[-1024, -240], [-640, -240], [-600, -95], [-600, 150], [-640, 240], [-1024, 240]],
      bgm: 'sea-route',
      encounterTable: 'tide-sea-route',
      levelRange: [12, 16],
      weather: [
        { weather: 'clear', weight: 6 },
        { weather: 'rain', weight: 2 },
        { weather: 'fog', weight: 1 },
      ],
      legacyMapId: 'water-route-1',
    },
    {
      id: 'tide-nearshore',
      name: '碧潮近海',
      kind: 'sea',
      polygon: [[-660, -760], [1024, -760], [1024, 800], [-660, 800]],
      bgm: 'sea-route',
      encounterTable: 'tide-nearshore',
      levelRange: [16, 22],
    },
  ],
  waterBodies: [
    // 温泉池（高于海平面的小水体；温泉乡与溪谷上游的天然泉眼）
    { id: 'spring-pool-main', level: 7.6, center: [452, 566], radius: [15, 11] },
    { id: 'spring-pool-upper', level: 8.4, center: [494, 598], radius: [8, 6] },
    { id: 'spring-source', level: 24.5, center: [600, 300], radius: [10, 8] },
    // 碧潮古森深处的古池
    { id: 'forest-pond', level: 13, center: [-330, -330], radius: [26, 19] },
  ],
  rivers: [
    // 火山东南麓的泉眼 → 温泉溪谷 → 温泉乡东侧入海
    { id: 'spring-creek', name: '温泉溪', width: 7, points: [[600, 300], [566, 360], [530, 420], [508, 470], [520, 520], [560, 580], [600, 630], [630, 690]], levels: [24.5, 18.5, 12.5, 9.2, 7.4, 4.2, 1.8, 0.2] },
    // 碧潮古森的古池向南流经碧潮镇北侧入海
    { id: 'root-brook', name: '根须溪', width: 6, points: [[-330, -330], [-372, -250], [-430, -170], [-500, -116], [-560, -100], [-610, -96]], levels: [13, 10.5, 7.5, 4.6, 2.2, 0.15] },
  ],
  lavaFlows: [
    // 火山口溢出的熔岩向东流入大海（熔岩地带：可看不可走）
    { id: 'lava-east', points: [[700, -300], [760, -276], [818, -232], [872, -170], [930, -120], [975, -96]], width: 10 },
    { id: 'lava-north', points: [[650, -372], [664, -440], [690, -520], [730, -600], [760, -660]], width: 8 },
  ],
  alphaDens: [
    { id: 'den-azure-forest', theme: 'nest', name: '古森巨树下', speciesId: 214, level: 26, position: [-250, -470], radius: 6, zone: 'azure-forest', moves: ['horn-attack', 'brick-break', 'aerial-ace', 'close-combat'] },
    { id: 'den-ore-canyon', theme: 'rock', name: '峡谷断崖', speciesId: 95, level: 27, position: [150, -40], radius: 8, zone: 'ore-canyon', moves: ['rock-throw', 'bind', 'dragon-breath', 'stone-edge'] },
    { id: 'den-plateau', theme: 'shadow', name: '高原残碑', speciesId: 229, level: 30, position: [-60, -560], radius: 7, zone: 'ancient-plateau', moves: ['ember', 'bite', 'roar', 'flamethrower'], when: { time: 'night' }, whenText: '只在夜晚出现' },
    { id: 'den-volcano', theme: 'rock', name: '熔岩台地', speciesId: 219, level: 30, position: [780, -360], radius: 7, zone: 'volcano-slope', moves: ['ember', 'rock-throw', 'harden', 'flamethrower'] },
    { id: 'den-spring', theme: 'whirlpool', name: '温泉溪湾', speciesId: 80, level: 28, position: [555, 395], radius: 6, zone: 'spring-valley', moves: ['water-gun', 'confusion', 'headbutt', 'scald'], when: { weather: ['rain', 'fog'] }, whenText: '只在雨天或雾天现身' },
    { id: 'den-ochre', theme: 'rock', name: '赭石骨冢', speciesId: 105, level: 28, position: [60, 520], radius: 6, zone: 'ochre-hills', moves: ['bone-club', 'headbutt', 'bonemerang', 'stone-edge'] },
  ],
  roads: [
    // 碧潮镇 → 碧潮古森（北）
    { id: 'road-tide-forest', surface: 'dirt', width: 5, points: [[-520, 10], [-516, -60], [-500, -120], [-452, -180], [-410, -260], [-380, -330], [-360, -400]] },
    // 碧潮镇 → 古树林道 → 矿石镇（2 号路）
    { id: 'road-tide-ore', surface: 'dirt', width: 6, points: [[-376, 30], [-300, 34], [-210, 60], [-120, 100], [-50, 160], [16, 210]] },
    // 碧潮镇 → 碧潮海岸
    { id: 'road-tide-coast', surface: 'dirt', width: 4, points: [[-470, 150], [-420, 230], [-360, 320], [-300, 420]] },
    // 矿石镇 → 峡谷北段 → 矿洞
    { id: 'road-ore-mine', surface: 'dirt', width: 5, points: [[80, 150], [92, 60], [100, -20], [104, -96]] },
    // 峡谷北口 → 中央高原（盘山路）→ 异变遗迹
    { id: 'road-plateau', surface: 'dirt', width: 4, points: [[60, -70], [10, -130], [-40, -180], [-60, -240], [-30, -300], [20, -340], [44, -372]] },
    // 矿石镇 → 余烬小径 → 火山镇（新路线）
    { id: 'road-ore-flame', surface: 'dirt', width: 5, points: [[168, 220], [250, 180], [330, 130], [400, 90], [452, 64]] },
    // 火山镇 → 火山洞窟
    { id: 'road-flame-cave', surface: 'dirt', width: 4, points: [[620, -20], [660, -70], [700, -110], [722, -138]] },
    // 火山镇 → 火山口（登山道）
    { id: 'road-crater', surface: 'dirt', width: 3, points: [[580, -46], [560, -110], [610, -140], [560, -180], [600, -215], [640, -232]] },
    // 火山镇 → 温泉溪谷 → 温泉乡（新路线）
    { id: 'road-flame-spring', surface: 'dirt', width: 5, points: [[540, 160], [500, 250], [470, 340], [440, 420], [420, 470]] },
    // 矿石镇 → 赭石丘陵 → 温泉乡
    // 赭石丘陵：骨冢小径（中段被怪力巨石堵住）
    { id: 'trail-ochre-den', surface: 'dirt', width: 3, points: [[150, 400], [90, 440], [54, 486], [60, 512]] },
    { id: 'road-ore-spring', surface: 'dirt', width: 4, points: [[100, 322], [150, 400], [230, 450], [310, 500]] },
    // 碧潮镇主街
    { id: 'town-tide-main', surface: 'stone', width: 8, points: [[-560, 30], [-376, 30]] },
    { id: 'town-ore-main', surface: 'stone', width: 8, points: [[16, 210], [168, 220]] },
    { id: 'town-flame-main', surface: 'stone', width: 8, points: [[452, 64], [650, 50]] },
    { id: 'town-spring-main', surface: 'stone', width: 7, points: [[310, 500], [420, 520], [540, 560]] },
    // 木桥 / 栈道
    { id: 'bridge-root-brook', surface: 'boardwalk', width: 5, points: [[-509, -100], [-494, -136]] },
    { id: 'bridge-spring-creek', surface: 'boardwalk', width: 5, points: [[516, 548], [554, 562]] },
    ...TIDE_TOWNS.flatMap((t) => t.paths),
  ],
  pois: [
    { id: 'tide-dock', kind: 'dock', name: '碧潮镇码头', position: [-602, 0, 30], showOnMap: true },
    { id: 'pokecenter-tide', kind: 'pokecenter', name: '宝可梦中心（碧潮镇）', position: [-500, 0, 22], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-tide', kind: 'mart', name: '友好商店（碧潮镇）', position: [-440, 0, 22], interior: 'mart', showOnMap: true },
    { id: 'gym-azure', kind: 'gym', name: '碧潮道馆', position: [-470, 0, -52], interior: 'gym-azure', showOnMap: true },
    { id: 'tide-elder-house', kind: 'door', name: '树语长老的树屋', position: [-540, 0, 78], interior: 'tide-elder-house', showOnMap: true },
    { id: 'pokecenter-ore', kind: 'pokecenter', name: '宝可梦中心（矿石镇）', position: [40, 0, 230], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-ore', kind: 'mart', name: '矿工商店', position: [90, 0, 232], interior: 'mart', showOnMap: true },
    { id: 'gym-ore', kind: 'gym', name: '矿石道馆', position: [120, 0, 200], interior: 'gym-ore', showOnMap: true },
    { id: 'ore-foreman-house', kind: 'door', name: '矿工工头之家', position: [150, 0, 240], interior: 'ore-foreman-house', showOnMap: true },
    { id: 'tide-mine', kind: 'cave', name: '矿石镇矿洞', position: [104, 0, -104], interior: 'tide-mine', doorYaw: 0, showOnMap: true },
    { id: 'pokecenter-flame', kind: 'pokecenter', name: '宝可梦中心（火山镇）', position: [490, 0, 76], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-flame', kind: 'mart', name: '友好商店（火山镇）', position: [540, 0, 76], interior: 'mart', showOnMap: true },
    { id: 'gym-flame', kind: 'gym', name: '碧焰道馆', position: [600, 0, 34], interior: 'gym-flame', showOnMap: true },
    { id: 'flame-observatory', kind: 'door', name: '地热观测站', position: [626, 0, 98], interior: 'flame-observatory', showOnMap: true },
    { id: 'volcano-cave', kind: 'cave', name: '火山洞窟', position: [724, 0, -140], interior: 'volcano-cave', doorYaw: 0.48, showOnMap: true },
    { id: 'pokecenter-spring', kind: 'pokecenter', name: '宝可梦中心（温泉乡）', position: [372, 0, 498], interior: 'pokecenter', showOnMap: true },
    { id: 'spring-breeder', kind: 'door', name: '培育屋', position: [340, 0, 548], interior: 'spring-breeder', showOnMap: true },
    { id: 'spring-inn', kind: 'door', name: '温泉旅馆「汤之庭」', position: [410, 0, 600], interior: 'spring-inn', showOnMap: true },
    { id: 'hot-spring', kind: 'landmark', name: '温泉', position: [452, 0, 552], showOnMap: true },
    { id: 'spring-dock', kind: 'dock', name: '温泉乡码头', position: [566, 0, 652], showOnMap: true },
    { id: 'ruins-gate', kind: 'cave', name: '异变遗迹', position: [44, 0, -428], interior: 'tide-ruins', doorYaw: 0, showOnMap: true },
    { id: 'forest-shrine', kind: 'landmark', name: '古树神龛', position: [-410, 0, -470], showOnMap: true },
    { id: 'coral-wreck', kind: 'landmark', name: '珊瑚沉船', position: [-820, 0, 60], showOnMap: true },
  ],
  blockers: [
    // 异变遗迹入口平台：3 枚本岛徽章前被紫色异变结界封住
    { id: 'ruins-seal', type: 'story', requiresFlag: 'ruins-seal-open', position: [44, 0, -420], radius: 12, hint: '一层紫色的异变结界挡住了遗迹入口……\n听说集齐碧潮群岛的三枚徽章，结界就会回应。' },
    // 碧潮古森：藤蔓封住的小径（割草开路）
    { id: 'forest-vines', type: 'vines', requiresFlag: 'field-cut', position: [-372, 0, -414], radius: 4, hint: '粗壮的藤蔓缠住了小径……似乎需要某种能力才能通过。' },
    { id: 'forest-vines-shrine', type: 'vines', requiresFlag: 'field-cut', position: [-396, 0, -452], radius: 3.5, hint: '藤蔓后面隐约能看到一座古老的神龛……似乎需要某种能力才能通过。' },
    // 温泉溪谷上游：落石堵住了泉眼（支线·温泉源头疏通，需要冲撞骑乘）
    { id: 'spring-source-rock', type: 'rock-smash', requiresFlag: 'hm05-rock-smash', position: [588, 0, 312], radius: 3, hint: '巨大的落石堵住了泉眼……似乎需要某种能力才能撞开。' },
    // 赭石丘陵：滚落的巨石堵住骨冢小径（需要怪力，支线·矿洞救援后获得）
    { id: 'ochre-boulder', type: 'strength', requiresFlag: 'hm06-strength', position: [54, 0, 486], radius: 2.6, hint: '一块巨石挡住了小径……似乎需要某种能力才能推开。' },
    // 温泉乡码头：碧潮—雷鸣海域在 M3 开放
    { id: 'thunder-route', type: 'story', requiresFlag: 'thunder-route-open', position: [566, 0, 668], radius: 7, hint: '船老大：碧潮—雷鸣海域最近洋流很乱，航线暂时关闭了。' },
    // 火山口：登山道尽头的熔岩热浪（地热异常调查前）
    { id: 'crater-heat', type: 'story', requiresFlag: 'volcano-heat-cleared', position: [598, 0, -213], radius: 6, hint: '灼人的热浪从火山口涌出……先去火山镇的地热观测站问问情况吧。' },
  ],
};
