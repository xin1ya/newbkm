/**
 * 岛 5 · 秘境岛（设计 §3.2 岛5 / 完整设计 §第五章，M4-01）。
 * 坐标：原点在地图中心，+X 东，+Z 南，Y 为高度（米）。地图 2048 m 见方，主岛约 0.8 km²：
 *   - 南：码头平原（3–8 m 的宽阔沙岸与草甸），秘境航线的码头在南岸中部（M4-02 琉璃镇 ↔ 秘境岛）。
 *   - 中：龙之峡谷 —— 南北走向的大峡谷，谷底 14–28 m，两侧绝壁 50–70 m；
 *         峡谷南端开阔成盆地，寐龙镇（14 m）坐落其中，南口直通码头平原。
 *   - 北：月魇荒原（24–36 m 起伏的荒原，风化岩丘），月魇镇遗址在荒原中部（白天是废墟，M4-04 夜间才出现小镇）。
 *   - 东北：永冻冰原（40–85 m 的冰川山脊），永冻之窟入口在冰原南麓（M4-09）。
 *   - 西：神兽祭坛台地（20 m 台地上一座 38 m 的平顶方山，祭坛在山顶，M4-09）。
 *   - 东：龙脊岩原（峡谷东侧向海缓降的岩原），东南海崖上是梦之实验室（M4-05）。
 * 高度图 / 材质图 / 摆放物由 `pnpm gen:secret` 根据本文件生成（scripts/gen-secret.ts）。
 * 主色板（设计 §8.4）：暗金 / 深紫。
 */
import type { IslandConfig } from './types';
import { SECRET_TOWNS } from './towns/secret';

export const SECRET: IslandConfig = {
  id: 'secret',
  name: '秘境岛',
  size: [2048, 2048],
  heightmap: 'islands/secret/height.png',
  heightRange: [-40, 160],
  splatmaps: ['islands/secret/splat0.png', 'islands/secret/splat1.png', 'islands/secret/splat2.png'],
  seaLevel: 0,
  chunkSize: 128,
  props: 'islands/secret/props.json',
  palette: { primary: '#c9a24a', secondary: '#4a3466', accent: '#f0d98a' },
  // 扩展覆盖层：积雪 / 荒原赭土 / 暗紫苔 / 冰面（没有熔岩）
  ext: { names: ['snow', 'waste', 'moss', 'ice'], colors: ['#eef3f7', '#8a7458', '#5a4a6e', '#bfe2f0'], lava: false },
  // 读档兜底出生点：码头
  spawnPoint: [60, 0, 520],
  spawnYaw: 0,
  // 冲浪 / 飞行：只到主岛近海（航线在 M4-02 接入）
  travelBounds: [
    [-640, 660], [640, 660], [660, 0], [620, -520], [0, -640], [-620, -520], [-660, 0],
  ],
  zones: [
    // ———————— 城镇 ————————
    {
      id: 'dragon-town',
      name: '寐龙镇',
      kind: 'town',
      polygon: [[-70, 170], [70, 170], [95, 235], [75, 300], [-75, 300], [-95, 235]],
      bgm: 'town-dragon',
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'fog', weight: 1 },
      ],
    },
    {
      id: 'moon-town',
      name: '月魇镇',
      kind: 'town',
      polygon: [[-40, -370], [110, -370], [135, -305], [105, -250], [-30, -250], [-60, -310]],
      bgm: 'town-moon',
      weather: [{ weather: 'nightfog', weight: 1 }],
    },
    // ———————— 野外（顺序 = 重叠时的优先级：小区域在前） ————————
    {
      id: 'dragon-canyon',
      name: '龙之峡谷',
      kind: 'wild',
      polygon: [[-70, 170], [-58, 60], [-75, -60], [-60, -185], [60, -185], [80, -60], [58, 60], [70, 170]],
      bgm: 'field-dragon-canyon',
      levelRange: [61, 64],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'sandstorm', weight: 1 },
        { weather: 'fog', weight: 1 },
      ],
    },
    {
      id: 'frost-ridge',
      name: '永冻冰原',
      kind: 'wild',
      polygon: [[200, -200], [300, -120], [450, -130], [445, -240], [395, -330], [270, -440], [225, -270]],
      bgm: 'field-snow',
      levelRange: [65, 68],
      weather: [
        { weather: 'snow', weight: 4 },
        { weather: 'clear', weight: 1 },
      ],
    },
    {
      id: 'moon-wastes',
      name: '月魇荒原',
      kind: 'wild',
      polygon: [[-360, -330], [-200, -200], [-60, -185], [60, -185], [200, -200], [225, -270], [270, -440], [80, -520], [-110, -520], [-290, -450]],
      bgm: 'field-moon-wastes',
      levelRange: [63, 66],
      weather: [
        { weather: 'nightfog', weight: 3 },
        { weather: 'clear', weight: 2 },
        { weather: 'anomaly', weight: 1 },
      ],
    },
    {
      id: 'altar-mesa',
      name: '神兽祭坛台地',
      kind: 'wild',
      polygon: [[-520, -120], [-360, -330], [-200, -200], [-60, -185], [-75, -60], [-58, 60], [-70, 170], [-95, 235], [-110, 310], [-250, 320], [-480, 210], [-530, 60]],
      bgm: 'field-plateau',
      levelRange: [64, 67],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'dragon-crags',
      name: '龙脊岩原',
      kind: 'wild',
      polygon: [[80, -60], [60, -185], [200, -200], [300, -125], [500, -125], [520, 120], [430, 290], [300, 300], [190, 250], [95, 235], [70, 170], [58, 60]],
      bgm: 'field-dragon-canyon',
      levelRange: [62, 65],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'secret-shore',
      name: '码头平原',
      kind: 'wild',
      polygon: [[-530, 200], [-250, 320], [-110, 310], [-75, 300], [75, 300], [190, 250], [300, 300], [430, 290], [500, 220], [430, 380], [300, 450], [120, 560], [0, 540], [-160, 470], [-300, 390], [-430, 300], [-500, 240]],
      bgm: 'field-coast',
      levelRange: [60, 62],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 1 },
        { weather: 'seafog', weight: 1 },
      ],
    },
    // ———————— 海域 ————————
    {
      id: 'secret-nearshore',
      name: '秘境近海',
      kind: 'sea',
      polygon: [[-1024, -1024], [1024, -1024], [1024, 1024], [-1024, 1024]],
      bgm: 'sea-route',
      levelRange: [60, 64],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'seafog', weight: 2 },
      ],
    },
  ],
  waterBodies: [
    // 月魇荒原的月镜池（遗址西侧）
    { id: 'moon-mirror-pool', level: 25.4, center: [-150, -330], radius: [34, 22] },
    // 冰原脚下的冰湖（表面结冰的颜色由 ext 冰面层表现）
    { id: 'frost-lake', level: 38.4, center: [300, -170], radius: [30, 18] },
  ],
  rivers: [
    // 龙涎溪：峡谷北段的泉 → 谷底 → 寐龙镇东侧 → 码头平原入海
    { id: 'dragon-brook', name: '龙涎溪', width: 6, points: [[45, -150], [40, -60], [38, 40], [48, 140], [100, 300], [150, 400], [200, 470], [240, 520]], levels: [25, 21, 18, 15.4, 10, 5.5, 2.2, 0.2] },
  ],
  roads: [
    // 码头 → 码头平原 → 寐龙镇南口
    { id: 'road-secret-dock', surface: 'stone', width: 6, points: [[0, 300], [20, 380], [55, 450], [60, 530]] },
    // 寐龙镇北口 → 龙之峡谷谷底 → 月魇镇
    { id: 'road-canyon', surface: 'dirt', width: 6, points: [[0, 175], [-8, 100], [-12, 40], [-6, -40], [-4, -120], [0, -190], [20, -250]] },
    // 月魇镇东口 → 永冻之窟
    { id: 'road-frost', surface: 'dirt', width: 5, points: [[130, -305], [200, -296], [262, -282], [322, -262]] },
    // 码头平原西 → 神兽祭坛（台地坡道 → 方山顶）
    { id: 'road-altar', surface: 'dirt', width: 5, points: [[30, 400], [-80, 400], [-190, 372], [-280, 310], [-330, 220], [-345, 130], [-335, 60], [-330, 18]] },
    // 码头平原东 → 梦之实验室
    { id: 'road-lab', surface: 'dirt', width: 5, points: [[58, 470], [160, 440], [260, 395], [330, 330]] },
    // 城镇主街（建筑在 M4-03 / M4-04）
    { id: 'town-dragon-main', surface: 'stone', width: 8, points: [[0, 175], [0, 300]] },
    { id: 'town-moon-main', surface: 'stone', width: 6, points: [[-40, -310], [130, -305]] },
    { id: 'town-moon-north', surface: 'stone', width: 5, points: [[20, -250], [30, -310]] },
    ...SECRET_TOWNS.flatMap((t) => t.paths),
  ],
  pois: [
    { id: 'secret-dock', kind: 'dock', name: '秘境岛码头', position: [60, 0, 540], showOnMap: true },
    { id: 'dragon-town-gate', kind: 'landmark', name: '寐龙镇', position: [0, 0, 300], showOnMap: true },
    { id: 'pokecenter-dragon', kind: 'pokecenter', name: '宝可梦中心（寐龙镇）', position: [-8, 0, 206], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-dragon', kind: 'mart', name: '友好商店（寐龙镇）', position: [-8, 0, 224], interior: 'mart', showOnMap: true },
    { id: 'dragon-keeper-house', kind: 'door', name: '守龙老人之家', position: [8, 0, 212], interior: 'dragon-keeper-house', showOnMap: true },
    { id: 'dragon-bones', kind: 'landmark', name: '巨兽龙骨发掘场', position: [24, 0, 244], showOnMap: true },
    { id: 'dragon-town-notice', kind: 'landmark', name: '寐龙镇公告板', position: [-6, 0, 296] },
    { id: 'dragon-canyon-sign', kind: 'landmark', name: '龙之峡谷', position: [-6, 0, 178], showOnMap: true },
    { id: 'moon-ruins', kind: 'landmark', name: '月魇镇遗址', position: [40, 0, -320], showOnMap: true },
    { id: 'moon-town-board', kind: 'landmark', name: '魇镇镇口牌', position: [-6.5, 0, -306] },
    { id: 'moon-gym-board', kind: 'landmark', name: '魇月道馆告示板', position: [45.5, 0, -341] },
    { id: 'moon-statue', kind: 'landmark', name: '新月像', position: [40, 0, -330] },
    { id: 'moon-mirror-stele', kind: 'landmark', name: '月镜池石碑', position: [-150, 0, -292] },
    { id: 'frost-cave-gate', kind: 'landmark', name: '永冻之窟入口', position: [330, 0, -258], showOnMap: true },
    { id: 'beast-altar', kind: 'landmark', name: '神兽祭坛', position: [-330, 0, 0], showOnMap: true },
    { id: 'dream-lab-site', kind: 'landmark', name: '梦之实验室', position: [340, 0, 322], showOnMap: true },
    { id: 'moon-mirror', kind: 'landmark', name: '月镜池', position: [-150, 0, -296], showOnMap: true },
  ],
  blockers: [],
};
