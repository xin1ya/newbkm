/**
 * 岛屿配置格式（设计 §4.1）。本文件只放类型；每座岛一个 <id>.ts。
 */
import type { IslandId } from '@/systems/state/GameState';
import type { FieldWeather } from '@/systems/encounters';
import type { AlphaDenDef } from '@/systems/alpha';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface WeatherRule {
  weather: FieldWeather;
  /** 相对权重 */
  weight: number;
  /** 只在这些时段出现 */
  time?: 'day' | 'night';
}

export interface ZoneConfig {
  id: string;
  name: string;
  kind: 'town' | 'wild' | 'sea' | 'dungeon-entrance';
  polygon: Vec2[];
  bgm: string;
  encounterTable?: string;
  levelRange?: [number, number];
  weather?: WeatherRule[];
  /** 对应 2D 设计中的地图 / 路线名，便于对照原设计 */
  legacyMapId?: string;
}

export type PoiKind = 'door' | 'dock' | 'gym' | 'pokecenter' | 'mart' | 'landmark' | 'quest' | 'fishing' | 'ferry' | 'cave';

export interface PoiConfig {
  id: string;
  kind: PoiKind;
  name: string;
  position: Vec3;
  /** 门：进入的室内场景 id */
  interior?: string;
  /** 从这个门进入时落在哪个房间（缺省 = 室内的 entryRoom；出生在该房间 to.poi = 本门的出口旁） */
  room?: string;
  /** 没有建筑摆放物的入口（洞穴等）：门外朝向（弧度，0 = +Z）；位置即 position */
  doorYaw?: number;
  /** 在大地图上显示 */
  showOnMap?: boolean;
}

export interface BlockerConfig {
  id: string;
  type: 'rock-smash' | 'strength' | 'vines' | 'climb' | 'waterfall' | 'dive' | 'dark' | 'story' | 'surf';
  requiresFlag: string;
  position: Vec3;
  /** 阻挡半径（米） */
  radius?: number;
  hint: string;
  /** 可见特效：结界穹顶 / 热浪帘（M2-14）/ 高空乱流墙（M3-20） */
  fx?: 'barrier' | 'heat' | 'windwall';
  /** M3-20 多边形范围（给出时代替圆形 radius；position 仅作提示锚点） */
  polygon?: Vec2[];
  /** M3-20 只挡飞行（步行 / 冲浪不受影响）：联盟高原的高空乱流，防止飞越冠军之路 */
  flyOnly?: boolean;
}

/**
 * M3-17 攀爬点：崖脚 base → 崖顶 top 的一条可攀爬岩壁（藤蔓 / 裂缝 / 冰裂纹）。
 * 骑乘「攀岩」（flag hm08-rock-climb）后在两端互动即可上 / 下；没有能力时靠近会提示。
 */
export interface ClimbWallConfig {
  id: string;
  name: string;
  style: 'vines' | 'crack' | 'ice';
  /** 崖脚站立点（x, z） */
  base: Vec2;
  /** 崖顶站立点（x, z） */
  top: Vec2;
  /** 岩壁纹路宽度（米，视觉） */
  width?: number;
}

/**
 * M3-19 瀑布（登瀑）：瀑顶是一座四面绝壁的石台（地形生成器按 mesa 抬起，台顶有泉池），
 * 泉水从石台边缘的缺口落进崖脚的瀑潭。冲浪到瀑潭 base 附近、按互动键「攀瀑」（flag hm07-waterfall）
 * 逆流冲上台顶泉池 top；在 top 附近按互动键「顺瀑布而下」。没有能力时上不去（步行 / 飞行也被同 id 的 blocker 挡住）。
 * 由 config/islands/waterfalls.ts 的 makeWaterfall 生成（同时给出泉池 / 瀑潭水体与 blocker）。
 */
export interface WaterfallConfig {
  id: string;
  name: string;
  /** 瀑顶石台：中心、半径（米）、台面高度（绝对高度） */
  mesa: { center: Vec2; radius: number; height: number };
  /** 瀑潭冲浪站位（崖脚） */
  base: Vec2;
  baseLevel: number;
  /** 台顶泉池冲浪站位 */
  top: Vec2;
  topLevel: number;
  /** 瀑口（石台边缘缺口中心） */
  lip: Vec2;
  /** 泉池中心与半径 */
  pool: { center: Vec2; radius: number };
  /** 瀑潭半径 */
  plungeRadius: number;
  /** 水幕宽度（米） */
  width: number;
}

/**
 * M3-18 潜水点：海面上颜色发暗、冒气泡的深水区。冲浪进入半径后按互动键下潜（骑乘「潜水」，flag hm08-dive），
 * 进入室内场景 interior 的 room（第一个出口 = 上浮光柱）；从任意 surfaceAt = 本 id 的出口上浮回到这里。
 */
export interface DiveSpotConfig {
  id: string;
  name: string;
  /** 中心（x, z） */
  center: Vec2;
  radius: number;
  interior: string;
  room: string;
}

/** M3-17 陡崖（地形生成器沿折线刻出 > 60° 的崖壁；左侧 = 行进方向左手 = 高处） */
export interface ScarpConfig {
  id: string;
  points: Vec2[];
}

/** 湖泊等高于海平面的水体 */
export interface WaterBody {
  id: string;
  level: number;
  /** 椭圆：中心与半径 */
  center: Vec2;
  radius: Vec2;
}

/**
 * M1-01 河流：折线 + 各点水面高度（沿线线性插值，从上游到下游递减）。
 * 河床由地形生成器刻出；运行时 waterAt 在「离中线 width/2 + 3 m 内且地面低于水面」时视为水。
 */
export interface RiverConfig {
  id: string;
  name: string;
  points: Vec2[];
  /** 各点水面高度（与 points 等长） */
  levels: number[];
  /** 水面宽度（米） */
  width: number;
}

/** 道路（灰盒生成地表与寻路用） */
export interface RoadConfig {
  id: string;
  points: Vec2[];
  width: number;
  surface: 'dirt' | 'stone' | 'boardwalk';
}

/** 地表材质通道（设计 §4.2），两张 RGBA 权重图共 8 个通道 */
export const SURFACE_CHANNELS = ['grass', 'forest', 'tallgrass', 'dirt', 'sand', 'rock', 'stone', 'flowers'] as const;
export type SurfaceChannel = (typeof SURFACE_CHANNELS)[number];

export interface IslandConfig {
  id: IslandId;
  name: string;
  /** 世界尺寸（米），原点在岛屿中心 */
  size: [number, number];
  /** 16 位 PNG 高度图（相对 assets/ 的路径） */
  heightmap: string;
  /** 高度图 0 与 65535 对应的世界高度（米） */
  heightRange: [number, number];
  /** 材质权重图（每张 RGBA = 4 种材质，顺序见 SURFACE_CHANNELS） */
  splatmaps: string[];
  seaLevel: number;
  zones: ZoneConfig[];
  /** 摆放物数据文件（glb 实例列表）；灰盒阶段为空 */
  props: string;
  pois: PoiConfig[];
  blockers: BlockerConfig[];
  spawnPoint: Vec3;
  spawnYaw?: number;
  waterBodies: WaterBody[];
  /** M1-01 河流（可选） */
  rivers?: RiverConfig[];
  roads: RoadConfig[];
  /** 头目巢穴（计划文档 §3.3）：固定点位的巢穴头目 */
  alphaDens?: AlphaDenDef[];
  /** M2-22 冲浪 / 飞行的可达范围（多边形；缺省 = 整张地图） */
  travelBounds?: Vec2[];
  /** M2-02 熔岩流（地形生成器刻出熔岩河道；运行时不可踏入） */
  lavaFlows?: Array<{ id: string; points: Vec2[]; width: number }>;
  /** M3-02 第三张 splat 的扩展覆盖层：名称 / 颜色；lava=false 时第 3 通道不是熔岩（可走、不发光）。缺省 = 碧潮（赭石 / 火山灰 / 熔岩 / 苔藓） */
  ext?: { names: [string, string, string, string]; colors: [string, string, string, string]; lava: boolean };
  /** M3-03 洋流：冲浪时沿折线方向推动（米/秒） */
  currents?: Array<{ id: string; points: Vec2[]; width: number; speed: number }>;
  /** M3-03 漩涡：冲浪靠近会被卷入并甩回航线 */
  whirlpools?: Array<{ id: string; center: Vec2; radius: number }>;
  /** M3-17 攀爬点 */
  climbWalls?: ClimbWallConfig[];
  /** M3-19 瀑布（登瀑） */
  waterfalls?: WaterfallConfig[];
  /** M3-18 潜水点 */
  diveSpots?: DiveSpotConfig[];
  /** M3-17 陡崖（生成器用；运行时只做文档 / 自检） */
  scarps?: ScarpConfig[];
  /** 本岛主色板（设计 §8.4） */
  palette: { primary: string; secondary: string; accent: string };
  /** 分块尺寸（米），默认 128 */
  chunkSize: number;
}

/**
 * 摆放物（props.json）。灰盒阶段由 gen-sprout-graybox 生成程序化建筑；
 * 美术模型到位后同一格式换成 { type: 'glb', model } 即可。
 */
export type PropType =
  | 'house'
  | 'lab'
  | 'pokecenter'
  | 'mart'
  | 'gym'
  | 'lighthouse'
  | 'warehouse'
  | 'dock'
  | 'boardwalk'
  | 'fence'
  | 'lamp'
  | 'sign'
  | 'crate'
  | 'boat'
  | 'breakable-rock'
  /** 崖壁洞口（洞框 + 黑色洞腔） */
  | 'cave-mouth'
  | 'well'
  | 'market-stall'
  // ——— M1-02/03/04 城镇细化 ———
  /** 可进入 / 装饰大型建筑 */
  | 'market-hall'
  | 'terminal'
  | 'greenhouse'
  | 'stilt-house'
  | 'shed'
  | 'windmill'
  | 'crane'
  /** 水上平台（湖上栈道 / 码头），可站立；rails 指定哪几边有栏杆 */
  | 'deck'
  | 'seawall'
  /** 小品 */
  | 'tree'
  | 'bench'
  | 'flowerbed'
  | 'hedge'
  | 'mailbox'
  | 'barrel'
  | 'bollard'
  | 'buoy'
  | 'rowboat'
  | 'net-rack'
  | 'fountain'
  | 'statue'
  | 'container'
  | 'lantern'
  | 'reeds'
  | 'lilypads'
  | 'bunting'
  | 'noticeboard'
  | 'laundry'
  | 'garden'
  | 'rocks'
  // ——— M2 碧潮群岛 ———
  | 'giant-tree'
  | 'treehouse'
  | 'rope-bridge'
  /** 藤蔓封锁（ref = 阻挡 id，割开后移除） */
  | 'vine-wall'
  | 'headframe'
  /** 矿车轨道（points 折线） */
  | 'rail'
  | 'mine-cart'
  | 'ore-pile'
  | 'lava-vent'
  | 'basalt'
  | 'spring-rim'
  | 'pailou'
  | 'stone-lantern'
  | 'bamboo-fence'
  | 'ruin-pillar'
  | 'ruin-arch'
  | 'stele'
  | 'coral'
  | 'shipwreck'
  /** 怪力巨石（ref = 阻挡 id，推开后移除） */
  | 'boulder'
  // ——— M3 雷鸣群岛 ———
  /** 避雷塔（格构塔 + 发光针尖） */
  | 'lightning-tower'
  | 'sundial'
  | 'igloo'
  | 'sled'
  | 'snowman'
  /** 滑翔台（悬挑平台，可站立） */
  | 'glide-deck'
  | 'wind-turbine'
  // ——— M3-04 琉璃群岛 ———
  /** 喀斯特石笋（海蚀石林） */
  | 'karst-pinnacle'
  /** 枯树（variant: marsh / bleached） */
  | 'dead-tree'
  /** 墓碑（variant: slab / round / cross） */
  | 'tombstone'
  /** 玻璃晶簇 */
  | 'glass-crystal'
  /** 鬼火（只发光，无碰撞） */
  | 'wisp'
  // ——— M3-11 幻影镇 ———
  /** 宣礼塔式蜃楼塔 */
  | 'minaret'
  /** 马蹄拱城门（size.x = 门洞宽） */
  | 'mirage-gate'
  /** 预言石柱（发光符文） */
  | 'prophecy-obelisk'
  /** 月影塔（夜间蜃楼） */
  | 'moon-tower'
  // ——— M3-12 幽冥镇 ———
  /** 钟楼 */
  | 'bell-tower'
  /** 幽灯（冷光铁灯） */
  | 'ghost-lamp'
  // ——— M3-13 琉璃镇 ———
  /** 海底神殿之门（海中石台门楼，M3-18 潜水入口） */
  | 'temple-gate'
  // ——— M3-14 彩幽市 ———
  /** 精灵联盟大门（白金凯旋门） */
  | 'league-gate'
  | 'glb';

export interface PropInstance {
  type: PropType;
  id?: string;
  /** 世界坐标 x, z；y 由地形决定，除非给了 y */
  position: Vec2;
  y?: number;
  /** 绕 Y 轴旋转（弧度），0 = 正面朝 +Z */
  yaw: number;
  /** 宽（x）、高（y）、深（z），米 */
  size: Vec3;
  /** 墙 / 屋顶颜色 */
  color?: string;
  roof?: string;
  /** fence / boardwalk 用的折线 */
  points?: Vec2[];
  /** glb 路径 */
  model?: string;
  /** 是否参与碰撞，默认 true */
  collide?: boolean;
  /** 关联的 POI 或阻挡 id */
  ref?: string;
  /** 造型变体（house: gable / two-storey / timber / cottage；tree: round / pine / palm / blossom …） */
  variant?: string;
  /** 第三种颜色（门、装饰、花） */
  accent?: string;
  /** 细节随机种子（窗户数量、花色等），同一 seed 结果固定 */
  seed?: number;
  /** deck：有栏杆的边（局部 n=-Z / s=+Z / e=+X / w=-X），缺省四边都有 */
  rails?: string;
  /** deck：栏杆开口 [边, 沿边中心偏移, 宽度] */
  gaps?: Array<[string, number, number]>;
  /** M3-11 只在这段时间（小时 [起, 止)，可跨午夜）出现；缺省 = 一直都在 */
  hours?: [number, number];
  /** M3-11 幻象：半透明闪烁、没有碰撞（白天的海市蜃楼） */
  mirage?: boolean;
}

/** M1-02/03/04 · 城镇布局（手工摆放，gen-sprout 读取后写入 props.json） */
export interface TownLayout {
  id: string;
  zone: string;
  /** 额外石板 / 泥土小路（与岛屿道路一起刷材质） */
  paths: RoadConfig[];
  /** 压平地块：矩形中心、宽深、朝向；y 缺省取区域中位高度 */
  pads?: Array<{ position: Vec2; size: Vec2; yaw?: number; y?: number; blend?: number }>;
  props: PropInstance[];
}

export interface PropsFile {
  version: 1;
  island: IslandId;
  generatedBy: string;
  props: PropInstance[];
}
