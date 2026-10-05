/**
 * 岛 3 · 雷鸣群岛（设计 §3.2 / §3.3，M3-02 / M3-03）。
 * 坐标：原点在地图中心，+X 东，+Z 南，Y 为高度（米）。地图 2048 m 见方：
 *   - 西段 x < -620：碧潮—雷鸣海域（航线走廊 z 120–680，宽约 560 m）。两股南北向的横流洋流把冲浪者推离航线，
 *     三个漩涡（靠近会被卷走甩回）；走廊外是暗礁与巨浪。走廊西端 x = -1024 与碧潮地图东缘相连（systems/travel）。
 *   - 东段：雷鸣群岛主岛（约 2.0 km²），地形分层（设计 §3.2）：
 *       南部平原：西南雷鸣镇（16 m 台地南缘（11 m），避雷塔之城，常年雷暴）→ 5 号路「雷鸣平原」→ 东南晨光镇（8 m，风车平原）；
 *       西：雷暴高原（30–52 m 紫灰色板岩台地，东北缘是晶石洞窟）；东南：古灯塔岬；
 *       中部：6 号路「晨光丘陵」北上 → 雪原镇（30 m，冰川脚下）→ 冰川雪原（向北升到 58 m，冰湖 / 冰川遗迹）；
 *       北部：云顶高崖（74 m 台地，南侧 16–20 m 崖壁）与云雀镇。攀爬（道馆 7 奖励）前沿东侧的盘山雪道绕上去；
 *       云雀镇码头在北岸海湾（崖顶沿崖路下到海边），雷鸣—琉璃海域在 M3-05 开放。
 * 高度图 / 材质图 / 摆放物由 `pnpm gen:thunder` 根据本文件生成（scripts/gen-thunder.ts）。
 * 主色板（设计 §8.4）：紫灰 / 金黄 / 冰蓝。
 */
import { THUNDER_TOWNS } from './towns/thunder';
import type { IslandConfig } from './types';
import { makeWaterfall } from './waterfalls';

/** M3-19 冰舌瀑布：冰川冰舌前的岩台，融水从台顶冰池落进融雪溪源头（落差约 18 m） */
export const THUNDER_FALLS = [
  makeWaterfall({
    id: 'glacier-falls',
    name: '冰舌瀑布',
    center: [262, -322],
    radius: 12,
    height: 52,
    dirAngle: Math.PI / 2,
    baseLevel: 33.5,
    width: 5,
    hint: '冰舌前的岩台挂满冰凌，四面滑不留手，风雪也让飞行宝可梦靠不过去……从瀑潭逆流而上或许可以。',
  }),
];

export const THUNDER: IslandConfig = {
  id: 'thunder',
  name: '雷鸣群岛',
  size: [2048, 2048],
  heightmap: 'islands/thunder/height.png',
  heightRange: [-30, 200],
  splatmaps: ['islands/thunder/splat0.png', 'islands/thunder/splat1.png', 'islands/thunder/splat2.png'],
  seaLevel: 0,
  chunkSize: 128,
  props: 'islands/thunder/props.json',
  palette: { primary: '#6f6a86', secondary: '#e8b73a', accent: '#9fd2ee' },
  // 扩展覆盖层：积雪 / 冰面 / 板岩 / 石楠（没有熔岩）
  ext: { names: ['snow', 'ice', 'slate', 'heath'], colors: ['#eef3f8', '#a9d3ea', '#5f5b70', '#8c7a96'], lava: false },
  // 读档兜底出生点：雷鸣镇宝可梦中心门口
  spawnPoint: [-470, 0, 402],
  spawnYaw: 0,
  // 冲浪 / 飞行：航线走廊 + 主岛近海（北岸码头外的水路 3 在 M3-05 加入）
  travelBounds: [
    [-1024, 110], [-700, 110], [-660, 0], [-680, -420], [-560, -640], [-300, -840], [-330, -1024], [30, -1024], [40, -860], [400, -860], [800, -800], [1010, -560], [1010, 640], [900, 740], [0, 790], [-560, 760], [-680, 700], [-1024, 690],
  ],
  zones: [
    // ———————— 城镇 ————————
    {
      id: 'thunder-town',
      name: '雷鸣镇',
      kind: 'town',
      polygon: [[-596, 330], [-420, 310], [-372, 400], [-400, 500], [-520, 500], [-600, 460]],
      bgm: 'town-thunder',
      legacyMapId: 'thunder-town',
    },
    {
      id: 'dawn-town',
      name: '晨光镇',
      kind: 'town',
      polygon: [[290, 350], [470, 340], [520, 430], [490, 520], [320, 530], [280, 440]],
      bgm: 'town-dawn',
      legacyMapId: 'dawn-town',
    },
    {
      id: 'snow-town',
      name: '雪原镇',
      kind: 'town',
      polygon: [[30, -250], [210, -260], [250, -170], [220, -90], [60, -80], [0, -160]],
      bgm: 'town-snow',
      legacyMapId: 'snow-town',
    },
    {
      id: 'lark-town',
      name: '云雀镇',
      kind: 'town',
      polygon: [[200, -720], [420, -722], [452, -640], [412, -584], [232, -584], [190, -640]],
      bgm: 'town-lark',
      legacyMapId: 'lark-town',
    },
    // ———————— 野外（顺序 = 重叠时的优先级：小区域在前） ————————
    {
      id: 'lighthouse-cape',
      name: '古灯塔岬',
      kind: 'wild',
      polygon: [[560, 420], [600, 300], [900, 100], [950, 180], [920, 300], [900, 400], [940, 470], [930, 550], [880, 600], [700, 630], [560, 560]],
      bgm: 'field-coast',
      encounterTable: 'lighthouse-cape',
      levelRange: [35, 39],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'seafog', weight: 3 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'storm-highland',
      name: '雷暴高原',
      kind: 'wild',
      polygon: [[-600, -300], [-380, -320], [-200, -200], [-150, 0], [-250, 200], [-420, 310], [-596, 330]],
      bgm: 'field-storm',
      encounterTable: 'storm-highland',
      levelRange: [32, 36],
      weather: [
        { weather: 'storm', weight: 5 },
        { weather: 'rain', weight: 2 },
        { weather: 'clear', weight: 1 },
      ],
    },
    {
      id: 'thunder-plain',
      name: '雷鸣平原',
      kind: 'wild',
      polygon: [[-372, 400], [-420, 310], [-250, 200], [-60, 260], [150, 300], [290, 350], [280, 440], [320, 530], [300, 690], [0, 712], [-240, 700], [-460, 660], [-520, 500], [-400, 500]],
      bgm: 'field-plain',
      encounterTable: 'thunder-plain',
      levelRange: [31, 35],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'storm', weight: 2 },
        { weather: 'rain', weight: 1 },
      ],
      legacyMapId: 'route-5',
    },
    {
      id: 'dawn-hills',
      name: '晨光丘陵',
      kind: 'wild',
      polygon: [[150, 300], [-60, 260], [-150, 0], [0, -160], [60, -80], [220, -90], [250, -170], [420, -150], [560, 0], [600, 300], [560, 420], [520, 430], [470, 340], [290, 350]],
      bgm: 'field-plain',
      encounterTable: 'dawn-hills',
      levelRange: [34, 38],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'fog', weight: 1 },
        { weather: 'snow', weight: 1 },
      ],
      legacyMapId: 'route-6',
    },
    {
      id: 'glacier',
      name: '冰川雪原',
      kind: 'wild',
      polygon: [[-380, -320], [-600, -380], [-560, -480], [-420, -560], [-200, -560], [100, -560], [420, -540], [460, -380], [420, -150], [250, -170], [210, -260], [30, -250], [0, -160], [-150, 0], [-200, -200]],
      bgm: 'field-snow',
      encounterTable: 'glacier',
      levelRange: [38, 42],
      weather: [
        { weather: 'snow', weight: 4 },
        { weather: 'blizzard', weight: 2 },
        { weather: 'clear', weight: 2 },
        { weather: 'fog', weight: 1 },
      ],
    },
    {
      id: 'frost-road',
      name: '盘山雪道',
      kind: 'wild',
      polygon: [[420, -150], [460, -380], [420, -540], [460, -600], [640, -700], [850, -610], [930, -380], [950, -100], [900, 100], [600, 300], [560, 0]],
      bgm: 'field-snow',
      encounterTable: 'frost-road',
      levelRange: [40, 44],
      weather: [
        { weather: 'snow', weight: 4 },
        { weather: 'blizzard', weight: 1 },
        { weather: 'clear', weight: 2 },
        { weather: 'fog', weight: 1 },
      ],
      legacyMapId: 'snow-lark-route',
    },
    {
      id: 'cloud-cliffs',
      name: '云顶高崖',
      kind: 'wild',
      polygon: [[-420, -560], [-500, -580], [-420, -660], [-200, -760], [200, -792], [640, -760], [640, -700], [460, -600], [420, -540], [100, -560], [-200, -560]],
      bgm: 'field-cliff',
      encounterTable: 'cloud-cliffs',
      levelRange: [42, 46],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'fog', weight: 2 },
        { weather: 'blizzard', weight: 1 },
        { weather: 'storm', weight: 1 },
      ],
    },
    // ———————— 海域 ————————
    {
      id: 'thunder-sea-route',
      name: '碧潮—雷鸣海域',
      kind: 'sea',
      polygon: [[-1024, 110], [-660, 110], [-612, 240], [-612, 560], [-660, 690], [-1024, 690]],
      bgm: 'sea-route',
      encounterTable: 'thunder-sea-route',
      levelRange: [26, 32],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'rain', weight: 2 },
        { weather: 'seafog', weight: 1 },
        { weather: 'storm', weight: 2 },
      ],
      legacyMapId: 'water-route-2',
    },
    {
      id: 'thunder-glaze-route',
      name: '雷鸣—琉璃海域',
      kind: 'sea',
      polygon: [[-330, -1024], [30, -1024], [40, -800], [-320, -800]],
      bgm: 'sea-route',
      encounterTable: 'glaze-sea-route',
      levelRange: [40, 46],
      weather: [
        { weather: 'seafog', weight: 5 },
        { weather: 'clear', weight: 1 },
      ],
      legacyMapId: 'water-route-3',
    },
    {
      id: 'thunder-nearshore',
      name: '雷鸣近海',
      kind: 'sea',
      polygon: [[-680, -860], [1024, -860], [1024, 800], [-680, 800]],
      bgm: 'sea-route',
      encounterTable: 'thunder-nearshore',
      levelRange: [32, 38],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'seafog', weight: 2 },
        { weather: 'storm', weight: 1 },
      ],
    },
  ],
  waterfalls: THUNDER_FALLS.map((f) => f.fall),
  waterBodies: [
    ...THUNDER_FALLS.flatMap((f) => f.bodies),
    // 晨光镇的风车水塘
    { id: 'dawn-pond', level: 8.6, center: [430, 300], radius: [22, 14] },
  ],
  rivers: [
    // 冰川融水：冰舌 → 雪原镇东 → 晨光丘陵 → 晨光镇西 → 南岸入海
    { id: 'melt-creek', name: '融雪溪', width: 8, points: [[262, -300], [258, -200], [272, -90], [300, 40], [318, 170], [290, 300], [250, 420], [232, 560], [222, 716]], levels: [33.5, 29.5, 25.5, 19.5, 13.5, 8.6, 4.6, 1.8, 0.2] },
  ],
  currents: [
    // 碧潮—雷鸣海域的横流（向北 / 向南）：冲浪时把玩家推离航线
    { id: 'current-west', points: [[-900, 690], [-905, 520], [-895, 330], [-900, 110]], width: 70, speed: 3.2 },
    { id: 'current-east', points: [[-740, 110], [-745, 300], [-735, 500], [-740, 690]], width: 60, speed: 2.6 },
  ],
  whirlpools: [
    { id: 'whirl-north', center: [-820, 190], radius: 26 },
    { id: 'whirl-mid', center: [-980, 420], radius: 22 },
    { id: 'whirl-south', center: [-800, 610], radius: 24 },
  ],
  // 头目巢穴在 M3-28 生态定稿时加入
  alphaDens: [],
  roads: [
    // 雷鸣镇码头 → 镇西口（坡道上台地）
    { id: 'road-thunder-dock', surface: 'stone', width: 6, points: [[-600, 420], [-586, 420], [-566, 418]] },
    // 雷鸣镇 → 雷鸣平原 → 晨光镇（5 号路）
    { id: 'road-route5', surface: 'dirt', width: 6, points: [[-376, 420], [-300, 430], [-200, 452], [-80, 470], [60, 470], [180, 456], [236, 448], [290, 440]] },
    // 晨光镇 → 晨光丘陵 → 雪原镇（6 号路）
    { id: 'road-route6', surface: 'dirt', width: 6, points: [[410, 344], [420, 250], [420, 140], [380, 40], [330, -20], [296, -40], [250, -120]] },
    // 雷鸣镇北口 → 雷暴高原 → 晶石洞窟
    { id: 'road-highland', surface: 'dirt', width: 5, points: [[-480, 318], [-450, 220], [-400, 120], [-330, 40], [-260, -20], [-214, -50]] },
    // 雪原镇东口 → 盘山雪道 → 云雀镇（新路线）
    { id: 'road-frost', surface: 'dirt', width: 5, points: [[248, -170], [340, -190], [450, -230], [560, -280], [620, -340], [640, -440], [610, -530], [570, -610], [510, -650], [452, -640]] },
    // 云雀镇西口 → 崖路 → 北岸码头
    { id: 'road-lark-dock', surface: 'stone', width: 4, points: [[194, -660], [120, -690], [40, -700], [-40, -716], [-100, -700], [-146, -688]] },
    // 雪原镇北口 → 冰川 → 冰川遗迹
    { id: 'road-glacier', surface: 'dirt', width: 4, points: [[110, -250], [70, -300], [10, -340], [-50, -360], [-70, -368]] },
    // 晨光镇东口 → 古灯塔岬
    { id: 'road-cape', surface: 'dirt', width: 4, points: [[512, 450], [600, 470], [700, 500], [790, 530], [836, 548]] },
    // 城镇主街
    { id: 'town-thunder-main', surface: 'stone', width: 8, points: [[-566, 418], [-376, 420]] },
    { id: 'town-dawn-main', surface: 'stone', width: 8, points: [[290, 440], [512, 450]] },
    { id: 'town-snow-main', surface: 'stone', width: 7, points: [[16, -170], [248, -170]] },
    { id: 'town-lark-main', surface: 'stone', width: 7, points: [[194, -660], [452, -640]] },
    // 木桥
    { id: 'bridge-melt-route5', surface: 'boardwalk', width: 6, points: [[226, 449], [260, 444]] },
    { id: 'bridge-melt-route6', surface: 'boardwalk', width: 6, points: [[316, -12], [276, -54]] },
    ...THUNDER_TOWNS.flatMap((t) => t.paths),
  ],
  pois: [
    { id: 'glacier-falls-cache', kind: 'landmark', name: '瀑顶石匣', position: [257, 0, -327] },
    { id: 'thunder-dock', kind: 'dock', name: '雷鸣镇码头', position: [-606, 0, 420], showOnMap: true },
    { id: 'pokecenter-thunder', kind: 'pokecenter', name: '宝可梦中心（雷鸣镇）', position: [-470, 0, 412], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-thunder', kind: 'mart', name: '友好商店（雷鸣镇）', position: [-420, 0, 412], interior: 'mart', showOnMap: true },
    { id: 'gym-thunder', kind: 'gym', name: '雷鸣道馆', position: [-500, 0, 360], interior: 'gym-thunder', showOnMap: true },
    { id: 'pokecenter-dawn', kind: 'pokecenter', name: '宝可梦中心（晨光镇）', position: [340, 0, 432], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-dawn', kind: 'mart', name: '友好商店（晨光镇）', position: [390, 0, 432], interior: 'mart', showOnMap: true },
    { id: 'gym-dawn', kind: 'gym', name: '晨光道馆', position: [430, 0, 480], interior: 'gym-dawn', showOnMap: true },
    { id: 'pokecenter-snow', kind: 'pokecenter', name: '宝可梦中心（雪原镇）', position: [80, 0, -180], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-snow', kind: 'mart', name: '友好商店（雪原镇）', position: [130, 0, -180], interior: 'mart', showOnMap: true },
    { id: 'gym-snow', kind: 'gym', name: '雪原道馆', position: [160, 0, -132], interior: 'gym-snow', showOnMap: true },
    { id: 'pokecenter-lark', kind: 'pokecenter', name: '宝可梦中心（云雀镇）', position: [260, 0, -661], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-lark', kind: 'mart', name: '友好商店（云雀镇）', position: [310, 0, -657], interior: 'mart', showOnMap: true },
    { id: 'gym-lark', kind: 'gym', name: '云雀道馆', position: [370, 0, -690], interior: 'gym-lark', showOnMap: true },
    { id: 'thunder-engineer-house', kind: 'door', name: '发电工程师之家', position: [-395, 0, 412], interior: 'thunder-engineer-house', showOnMap: true },
    { id: 'thunder-tower-sign', kind: 'landmark', name: '主避雷塔', position: [-470, 0, 430] },
    { id: 'dawn-miller-house', kind: 'door', name: '磨坊主之家', position: [372, 0, 450], interior: 'dawn-miller-house', showOnMap: true },
    { id: 'dawn-sundial-sign', kind: 'landmark', name: '晨光日晷', position: [455, 0, 425] },
    { id: 'snow-igloo-elder', kind: 'door', name: '冰屋老人的家', position: [110, 0, -130], interior: 'snow-igloo-elder', showOnMap: true },
    { id: 'lark-glider-club', kind: 'door', name: '云雀滑翔俱乐部', position: [270, 0, -648], interior: 'lark-glider-club', showOnMap: true },
    { id: 'lark-glide-deck', kind: 'landmark', name: '北崖滑翔台', position: [250, 0, -772], showOnMap: true },
    { id: 'lark-dock', kind: 'dock', name: '云雀镇码头', position: [-150, 0, -694], showOnMap: true },
    { id: 'crystal-cave', kind: 'cave', name: '晶石洞窟', position: [-210, 0, -56], interior: 'crystal-cave', doorYaw: 2.3, showOnMap: true },
    { id: 'glacier-ruins', kind: 'cave', name: '冰川遗迹', position: [-74, 0, -372], interior: 'glacier-ruins', doorYaw: 2.0, showOnMap: true },
    { id: 'old-lighthouse', kind: 'landmark', name: '古灯塔', position: [850, 0, 556], showOnMap: true },
    { id: 'frozen-lake', kind: 'landmark', name: '冰湖', position: [-150, 0, -440], showOnMap: true },
    { id: 'storm-observatory', kind: 'landmark', name: '雷云观测站', position: [-330, 0, -150], showOnMap: true },
    { id: 'glacier-ledge-cache', kind: 'landmark', name: '冰岩台上的古代石匣', position: [-87.3, 0, -362.6] },
  ],
  // M3-17 云顶高崖南侧陡崖（16 m）：生成器沿此折线刻出崖壁；东端并入盘山雪道所在的山脊
  scarps: [{ id: 'cloud-scarp', points: [[-490, -552], [-420, -574], [-300, -582], [-150, -584], [0, -585], [150, -585], [300, -583], [400, -580], [460, -592], [530, -608]] }],
  // M3-17 攀爬点：高崖南壁三处藤蔓 / 裂缝（近路直上云雀镇与码头），冰川遗迹侧面一处冰裂纹（冰岩台）
  climbWalls: [
    { id: 'cloud-scarp-west', name: '高崖西壁 · 藤蔓', style: 'vines', base: [-150, -576], top: [-150, -593], width: 3.2 },
    { id: 'cloud-scarp-mid', name: '高崖中壁 · 裂缝', style: 'crack', base: [100, -577], top: [100, -594], width: 2.6 },
    { id: 'cloud-scarp-east', name: '高崖东壁 · 藤蔓', style: 'vines', base: [300, -575], top: [300, -592], width: 3.2 },
    { id: 'glacier-ledge-wall', name: '冰岩台 · 冰裂纹', style: 'ice', base: [-92.8, -384.3], top: [-88.6, -375.2], width: 2.4 },
  ],
  blockers: [
    ...THUNDER_FALLS.map((f) => f.blocker),
    // M3-17 冰川遗迹背后的冰岩台：没有「攀岩」时步行 / 飞行都进不去（飞行限岛规则同步：封锁点同样挡飞行）
    { id: 'glacier-ledge', type: 'climb', requiresFlag: 'hm08-rock-climb', position: [-85.8, 0, -366.5], radius: 9, hint: '冰岩台四面都是陡立的冰壁，飞行宝可梦也找不到落脚的地方……侧面的冰裂纹似乎可以攀上去。' },
    // 云雀镇码头：雷鸣—琉璃海域在 M3-05 开放
    { id: 'glaze-route', type: 'story', requiresFlag: 'glaze-route-open', position: [-150, 0, -740], radius: 8, hint: '钓竿爷：北边雾大礁多，没本事的人进去就出不来。先把雷鸣四座道馆打下来再说吧！' },
  ],
};
