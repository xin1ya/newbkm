/**
 * 岛 4 · 琉璃群岛（设计 §3.2 / §3.3，M3-04）。
 * 坐标：原点在地图中心，+X 东，+Z 南，Y 为高度（米）。地图 2048 m 见方，主岛约 1.6 km²：
 *   - 南岸：幻影镇（6 m，海市蜃楼之城）坐在南岸沙丘带西端，码头朝南；南方外海（z > 600）是雷鸣—琉璃海域（M3-05）。
 *   - 东南：蜃景沙丘（4–16 m，风成新月丘，热天远处会出现海市蜃楼）；海上有一片低平的蜃景沙洲。
 *   - 西岸：8 号路「海蚀石林」（8–22 m 喀斯特石笋 + 近岸海蚀柱群）北上到幽冥镇。
 *   - 西：幽冥镇（3.5 m）与幽灵沼泽（2–4 m，沼泽水塘 / 枯树 / 古墓群，常夜雾），沼泽北缘贴着冠军山西侧绝壁，暗影洞窟在绝壁脚下。
 *   - 中：暗影林（12–26 m 起伏的暗色森林），新路线从幽冥镇向东穿林到琉璃镇；
 *         冠军之路南口在林子北边的山脚（冠军山南侧绝壁下）。
 *   - 东：琉璃镇（7 m）与玻璃海岸（玻璃质的青色细沙、晶簇），琉璃水脉从山脚流经镇北入海；镇外海是深水暗区（海底神殿，M3-13 / M3-18）。
 *   - 中北：冠军山（外围山麓 20–45 m → 80 m 高的环形绝壁 → 140–210 m 的山顶），步行无法翻越。
 *   - 北：联盟高原（96 m 台地，三面海崖、南面是冠军山绝壁），彩幽市与精灵联盟大门；只能穿过冠军之路（地下城，M3-20）到达。
 * 高度图 / 材质图 / 摆放物由 `pnpm gen:glaze` 根据本文件生成（scripts/gen-glaze.ts）。
 * 主色板（设计 §8.4）：玻璃青 / 暗紫。
 */
import type { IslandConfig } from './types';
import { GLAZE_TOWNS } from './towns/glaze';

export const GLAZE: IslandConfig = {
  id: 'glaze',
  name: '琉璃群岛',
  size: [2048, 2048],
  heightmap: 'islands/glaze/height.png',
  heightRange: [-40, 240],
  splatmaps: ['islands/glaze/splat0.png', 'islands/glaze/splat1.png', 'islands/glaze/splat2.png'],
  seaLevel: 0,
  chunkSize: 128,
  props: 'islands/glaze/props.json',
  palette: { primary: '#7fd6d8', secondary: '#5b4a78', accent: '#c8f4f2' },
  // 扩展覆盖层：玻璃沙 / 沼泥 / 暗紫苔 / 浅色沙丘（没有熔岩）
  ext: { names: ['glass', 'marsh', 'moss', 'dune'], colors: ['#a6e9e6', '#4b4636', '#5e5372', '#f1e2bd'], lava: false },
  // 读档兜底出生点：幻影镇中心
  spawnPoint: [-380, 0, 452],
  spawnYaw: Math.PI,
  // 冲浪 / 飞行：主岛近海 + 南方的雷鸣—琉璃海域（礁石迷宫，南口连接雷鸣地图北缘）。联盟高原的飞行限制在 M3-20 用结界处理。
  travelBounds: [
    // 南缘只有礁石迷宫的入口（x -640 ~ -120）通往雷鸣地图；迷宫两侧在 z 990 封口
    [-640, 1024], [-120, 1024], [-120, 990], [900, 990], [900, 640], [880, 300], [900, -100], [760, -560], [620, -900], [300, -1000], [-300, -1000], [-620, -920], [-860, -620], [-920, -200], [-920, 300], [-900, 640], [-900, 990], [-640, 990],
  ],
  zones: [
    // ———————— 城镇 ————————
    {
      id: 'mirage-town',
      name: '幻影镇',
      kind: 'town',
      polygon: [[-480, 390], [-300, 380], [-260, 450], [-290, 520], [-460, 525], [-500, 460]],
      bgm: 'town-mirage',
      legacyMapId: 'mirage-town',
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'seafog', weight: 2 },
      ],
    },
    {
      id: 'ghost-town',
      name: '幽冥镇',
      kind: 'town',
      polygon: [[-520, -230], [-370, -240], [-340, -170], [-370, -100], [-500, -95], [-540, -160]],
      bgm: 'town-ghost',
      legacyMapId: 'ghost-town',
      // 常夜雾：小镇终年笼罩在昏暗的雾里
      weather: [{ weather: 'nightfog', weight: 1 }],
    },
    {
      id: 'glaze-town',
      name: '琉璃镇',
      kind: 'town',
      polygon: [[390, 80], [540, 70], [585, 150], [550, 230], [410, 235], [370, 160]],
      bgm: 'town-glaze',
      legacyMapId: 'glaze-town',
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 2 },
      ],
    },
    {
      id: 'ever-city',
      name: '彩幽市',
      kind: 'town',
      polygon: [[-60, -830], [150, -830], [190, -760], [150, -700], [-60, -700], [-100, -760]],
      bgm: 'town-ever',
      legacyMapId: 'ever-grande',
    },
    // ———————— 野外（顺序 = 重叠时的优先级：小区域在前） ————————
    {
      id: 'stone-forest',
      name: '海蚀石林',
      kind: 'wild',
      polygon: [[-480, 390], [-500, 460], [-600, 430], [-660, 250], [-650, 40], [-560, -60], [-500, -95], [-370, -100], [-340, 0], [-300, 200], [-180, 300], [-300, 380]],
      bgm: 'field-stone-forest',
      encounterTable: 'stone-forest',
      levelRange: [44, 48],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'seafog', weight: 2 },
        { weather: 'rain', weight: 1 },
      ],
      legacyMapId: 'route-8',
    },
    {
      id: 'ghost-marsh',
      name: '幽灵沼泽',
      kind: 'wild',
      polygon: [[-540, -160], [-520, -230], [-370, -240], [-290, -320], [-300, -480], [-470, -580], [-620, -460], [-670, -260], [-650, 40], [-560, -60], [-500, -95]],
      bgm: 'field-marsh',
      encounterTable: 'ghost-marsh',
      levelRange: [46, 50],
      weather: [
        { weather: 'nightfog', weight: 4 },
        { weather: 'fog', weight: 2 },
        { weather: 'rain', weight: 1 },
      ],
    },
    {
      id: 'shadow-wood',
      name: '暗影林',
      kind: 'wild',
      polygon: [[-340, -170], [-370, -240], [-290, -320], [-180, -220], [0, -150], [200, -140], [360, -60], [390, 80], [370, 160], [300, 300], [60, 260], [-180, 300], [-300, 200], [-340, 0], [-370, -100]],
      bgm: 'field-shadow-wood',
      encounterTable: 'shadow-wood',
      levelRange: [46, 50],
      weather: [
        { weather: 'clear', weight: 3 },
        { weather: 'fog', weight: 2 },
        { weather: 'nightfog', weight: 1 },
      ],
      legacyMapId: 'ghost-glaze-route',
    },
    {
      id: 'mirage-dunes',
      name: '蜃景沙丘',
      kind: 'wild',
      polygon: [[-260, 450], [-300, 380], [-180, 300], [60, 260], [300, 300], [410, 235], [550, 230], [560, 380], [400, 470], [200, 520], [0, 540], [-200, 545], [-290, 520]],
      bgm: 'field-dunes',
      encounterTable: 'mirage-dunes',
      levelRange: [44, 48],
      weather: [
        { weather: 'clear', weight: 6 },
        { weather: 'sandstorm', weight: 2 },
        { weather: 'anomaly', weight: 1 },
      ],
    },
    {
      id: 'glass-coast',
      name: '玻璃海岸',
      kind: 'wild',
      polygon: [[540, 70], [390, 80], [360, -60], [430, -200], [560, -260], [690, -140], [720, 60], [680, 260], [620, 400], [560, 380], [550, 230], [585, 150]],
      bgm: 'field-glass-coast',
      encounterTable: 'glass-coast',
      levelRange: [47, 51],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'rain', weight: 2 },
        { weather: 'seafog', weight: 1 },
      ],
    },
    {
      id: 'victory-mountain',
      name: '冠军山',
      kind: 'wild',
      polygon: [[-290, -320], [-180, -220], [0, -150], [200, -140], [360, -60], [430, -200], [560, -260], [470, -540], [300, -610], [-100, -625], [-300, -610], [-470, -580], [-300, -480]],
      bgm: 'field-victory-mountain',
      encounterTable: 'victory-mountain',
      levelRange: [48, 52],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'fog', weight: 2 },
        { weather: 'storm', weight: 1 },
      ],
    },
    {
      id: 'league-plateau',
      name: '联盟高原',
      kind: 'wild',
      polygon: [[-470, -592], [-410, -570], [-350, -604], [-300, -612], [-100, -625], [300, -612], [360, -586], [420, -618], [480, -600], [620, -640], [620, -1000], [-720, -1000], [-720, -650]],
      bgm: 'field-victory-mountain',
      encounterTable: 'league-plateau',
      levelRange: [50, 54],
      weather: [
        { weather: 'clear', weight: 5 },
        { weather: 'rain', weight: 1 },
      ],
    },
    // ———————— 海域 ————————
    {
      id: 'glaze-sea-route',
      name: '雷鸣—琉璃海域',
      kind: 'sea',
      polygon: [[-1024, 620], [1024, 620], [1024, 1024], [-1024, 1024]],
      bgm: 'sea-route',
      encounterTable: 'glaze-sea-route',
      levelRange: [40, 46],
      // 礁石迷宫常年海雾
      weather: [
        { weather: 'seafog', weight: 6 },
        { weather: 'rain', weight: 1 },
      ],
      legacyMapId: 'water-route-3',
    },
    {
      id: 'glaze-nearshore',
      name: '琉璃近海',
      kind: 'sea',
      polygon: [[-1024, -1024], [1024, -1024], [1024, 620], [-1024, 620]],
      bgm: 'sea-route',
      encounterTable: 'glaze-nearshore',
      levelRange: [44, 50],
      weather: [
        { weather: 'clear', weight: 4 },
        { weather: 'seafog', weight: 2 },
        { weather: 'rain', weight: 1 },
      ],
    },
  ],
  waterBodies: [
    // 幽灵沼泽的黑水塘（水面 2.2 m）
    { id: 'marsh-pool-w', level: 2.2, center: [-575, -300], radius: [42, 26] },
    { id: 'marsh-pool-n', level: 2.2, center: [-445, -350], radius: [30, 20] },
    { id: 'marsh-pool-c', level: 2.2, center: [-360, -420], radius: [26, 34] },
    { id: 'marsh-pool-s', level: 2.2, center: [-600, -110], radius: [22, 30] },
    { id: 'marsh-pool-e', level: 2.2, center: [-290, -260], radius: [16, 12] },
    // 暗影林的林间池
    { id: 'shadow-pond', level: 13.2, center: [-150, 40], radius: [26, 18] },
  ],
  rivers: [
    // 琉璃水脉：冠军山东麓的泉眼 → 玻璃海岸 → 琉璃镇北侧入海（支线「琉璃水脉修复」）
    { id: 'glaze-vein', name: '琉璃水脉', width: 7, points: [[300, -220], [350, -150], [410, -80], [470, -20], [540, 20], [610, 30], [690, 30]], levels: [34, 27, 19, 12, 6.5, 2.4, 0.2] },
  ],
  // 头目巢穴在 M3-28 生态定稿时加入
  alphaDens: [],
  roads: [
    // 幻影镇：码头 → 镇中心
    { id: 'road-mirage-dock', surface: 'stone', width: 6, points: [[-380, 470], [-380, 540], [-380, 562]] },
    // 幻影镇西北口 → 海蚀石林 → 幽冥镇（8 号路）
    { id: 'road-route8', surface: 'dirt', width: 6, points: [[-470, 450], [-510, 410], [-548, 330], [-566, 220], [-548, 100], [-505, 10], [-470, -60], [-450, -110]] },
    // 幽冥镇东口 → 暗影林 → 琉璃镇（新路线）
    { id: 'road-shadow', surface: 'dirt', width: 5, points: [[-345, -165], [-280, -175], [-200, -160], [-100, -110], [0, -80], [100, -60], [200, -20], [290, 40], [340, 110], [372, 155]] },
    // 暗影林 → 冠军之路南口
    { id: 'road-victory', surface: 'stone', width: 6, points: [[100, -62], [140, -100], [150, -150], [110, -180], [70, -200], [80, -228]] },
    // 幻影镇东口 → 蜃景沙丘 → 琉璃镇南口
    { id: 'road-dunes', surface: 'dirt', width: 5, points: [[-290, 450], [-180, 440], [-40, 422], [100, 404], [240, 384], [340, 330], [400, 280], [430, 232]] },
    // 琉璃镇 → 码头
    { id: 'road-glaze-dock', surface: 'stone', width: 5, points: [[585, 150], [604, 150]] },
    // 彩幽市：冠军之路北口 → 市区 → 联盟大门
    { id: 'road-league-exit', surface: 'stone', width: 7, points: [[40, -640], [40, -700]] },
    { id: 'road-league-gate', surface: 'stone', width: 9, points: [[40, -830], [40, -872]] },
    // 城镇主街
    { id: 'town-mirage-main', surface: 'stone', width: 8, points: [[-470, 450], [-290, 450]] },
    { id: 'town-ghost-main', surface: 'stone', width: 7, points: [[-530, -165], [-345, -165]] },
    { id: 'town-ghost-south', surface: 'stone', width: 6, points: [[-450, -110], [-450, -165]] },
    { id: 'town-glaze-main', surface: 'stone', width: 8, points: [[372, 155], [585, 150]] },
    { id: 'town-glaze-south', surface: 'stone', width: 6, points: [[430, 232], [430, 153]] },
    { id: 'town-ever-main', surface: 'stone', width: 9, points: [[40, -700], [40, -830]] },
    { id: 'town-ever-cross', surface: 'stone', width: 7, points: [[-70, -765], [170, -765]] },
    // 城镇小路（towns/glaze.ts）
    ...GLAZE_TOWNS.flatMap((t) => t.paths),
    // 沼泽木栈道（跨黑水塘之间的泥沼）
    { id: 'marsh-boardwalk', surface: 'boardwalk', width: 3, points: [[-520, -250], [-500, -300], [-470, -330]] },
  ],
  pois: [
    { id: 'mirage-dock', kind: 'dock', name: '幻影镇码头', position: [-380, 0, 572], showOnMap: true },
    // M3-11 幻影镇
    { id: 'pokecenter-mirage', kind: 'pokecenter', name: '宝可梦中心（幻影镇）', position: [-420, 0, 444], interior: 'pokecenter', showOnMap: true },
    { id: 'mart-mirage', kind: 'mart', name: '友好商店（幻影镇）', position: [-345, 0, 444], interior: 'mart', showOnMap: true },
    { id: 'gym-mirage', kind: 'gym', name: '幻影道馆', position: [-380, 0, 400], interior: 'gym-mirage', showOnMap: true },
    { id: 'mirage-seer-house', kind: 'door', name: '先知之家', position: [-436, 0, 490], interior: 'mirage-seer-house', showOnMap: true },
    { id: 'mirage-obelisk', kind: 'landmark', name: '预言石柱', position: [-396, 0, 439] },
    { id: 'mirage-palace', kind: 'landmark', name: '蜃楼宫观景处', position: [-250, 0, 470], showOnMap: true },
    { id: 'mirage-moon-tower', kind: 'landmark', name: '月影塔遗址', position: [-472, 0, 506], showOnMap: true },
    { id: 'glaze-dock', kind: 'dock', name: '琉璃镇码头', position: [612, 0, 150], showOnMap: true },
    { id: 'victory-road-south', kind: 'cave', name: '冠军之路（南口）', position: [80, 0, -232], interior: 'victory-road', doorYaw: 0, showOnMap: true },
    { id: 'victory-road-north', kind: 'cave', name: '冠军之路（北口）', position: [40, 0, -634], interior: 'victory-road', doorYaw: Math.PI, showOnMap: true },
    { id: 'shadow-cave', kind: 'cave', name: '暗影洞窟', position: [-268, 0, -318], interior: 'shadow-cave', doorYaw: -1.05, showOnMap: true },
    { id: 'stone-forest-sign', kind: 'landmark', name: '海蚀石林', position: [-560, 0, 160], showOnMap: true },
    { id: 'marsh-graves', kind: 'landmark', name: '沼泽古墓群', position: [-520, 0, -440], showOnMap: true },
    { id: 'glass-beach', kind: 'landmark', name: '琉璃沙滩', position: [640, 0, 300], showOnMap: true },
    { id: 'mirage-sandbar', kind: 'landmark', name: '蜃景沙洲', position: [-60, 0, 650], showOnMap: true },
    { id: 'vein-spring', kind: 'landmark', name: '琉璃水脉泉眼', position: [292, 0, -232], showOnMap: true },
    { id: 'league-gate', kind: 'landmark', name: '精灵联盟大门', position: [40, 0, -876], showOnMap: true },
  ],
  blockers: [
    // 冠军之路的徽章检查 / 联盟高原的飞行结界在 M3-20 加入；雷鸣—琉璃海域在 M3-05 连接
  ],
};
