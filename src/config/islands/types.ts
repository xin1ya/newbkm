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
