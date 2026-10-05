import type { WaterPuzzleConfig } from '@/systems/puzzles/waterLevel';
import type { GymMechanismConfig } from '@/systems/puzzles/gymMechanism';
import type { BoulderPuzzleConfig } from '@/systems/puzzles/boulders';
/**
 * M1-05 · 室内场景配置格式。
 *
 * 坐标约定（局部坐标，米）：房间中心为原点，地板 y = 0；x ∈ [-w/2, w/2]，z ∈ [-d/2, d/2]。
 * 正门固定在 **+Z 墙**（靠镜头一侧），镜头从 +Z 方向俯视，+Z 墙做成剖切（只画踢脚线）。
 * 一个室内场景可以有多个房间（楼层），用 `exits` 里的 `to: { room }` 相连（楼梯）。
 */
import type { Vec2 } from '../islands/types';

export type LightingPreset = 'home' | 'lab' | 'center' | 'mart' | 'gym' | 'market' | 'cave' | 'undersea' | 'abyss';

export type FurnitureType =
  | 'table'
  | 'chair'
  | 'sofa'
  | 'bed'
  | 'shelf'
  | 'bookshelf'
  | 'counter'
  | 'tv'
  | 'plant'
  | 'rug'
  | 'stairs'
  | 'machine'
  /** 能量方块机（计划文档 §9.5） */
  | 'blender'
  /** 工坊工作台（计划文档 §9.5） */
  | 'workbench'
  | 'healer'
  | 'pc'
  | 'crate'
  | 'poster'
  | 'window'
  | 'lamp'
  | 'fridge'
  | 'stove'
  | 'pool'
  | 'stall'
  | 'barrel'
  | 'aquarium'
  | 'desk'
  | 'boulder'
  | 'crystal'
  // 道馆深化（翠澜道馆）：立柱 / 挂旗 / 看台 / 墙面徽纹 / 顶梁 / 馆主台阶
  | 'column'
  | 'banner'
  | 'bleacher'
  | 'emblem'
  | 'beam'
  | 'dais'
  // 道馆第二轮：水幕喷泉（对战时启动）/ 接待台 / 奖杯柜 / 天窗光柱 / 池壁水下灯（夜间点亮）
  | 'fountain'
  | 'reception'
  | 'trophy'
  | 'skylight'
  | 'poolLight'
  // M3-18 海底：海带丛 / 珊瑚 / 巨蚌（可调查）/ 残柱拱门 / 海葵
  | 'kelp'
  | 'coral'
  | 'clam'
  | 'ruin'
  | 'anemone'
  // M3-20 冠军之路：瀑布（流水幕 + 水潭 + 水雾）/ 暗河水道 / 石笋 / 可攀岩壁 / 火把 / 木桥 / 联盟旗
  | 'waterfall'
  | 'river'
  | 'stalagmite'
  | 'cliffwall'
  | 'torch'
  | 'bridge'
  | 'pennant';

export interface FurnitureConfig {
  type: FurnitureType;
  /** 局部坐标 x, z（贴墙物件 poster / window 的 z 或 x 取墙面坐标） */
  position: Vec2;
  /** 绕 Y 旋转（弧度），0 = 正面朝 +Z */
  yaw?: number;
  /** 宽、高、深（米）；缺省用该类型的默认尺寸 */
  size?: [number, number, number];
  /** 挂高（米）：banner 顶边 / emblem 中心 / beam 中心；缺省按类型 */
  y?: number;
  color?: string;
  /** 次要颜色（布料、屏幕、顶板等） */
  accent?: string;
  /** 不生成碰撞（地毯、海报、窗户默认就没有） */
  noCollide?: boolean;
  /** 可调查的对象 id（M1-07 互动提示使用） */
  interact?: string;
}

export type ExitTarget =
  /** 回到大地图：出现在 PoiConfig 对应门口（poi 指定从哪个门出去：一个室内有多个洞口时用，M3-20 冠军之路） */
  | { overworld: true; poi?: string }
  /** 同一室内场景的另一个房间（楼梯），出现在目标房间的 exit 旁 */
  | { room: string; exit: string };

export interface ExitConfig {
  id: string;
  /** 触发区中心（局部坐标） */
  position: Vec2;
  /** 触发半径（米） */
  radius?: number;
  /** 从这个出口进入房间时，玩家出生在出口内侧多远处、面朝哪里 */
  spawnOffset?: Vec2;
  spawnYaw?: number;
  to: ExitTarget;
  /** 地垫 / 楼梯提示文字 */
  label?: string;
  /** M3-18 上浮光柱：回到大地图时出现在这个潜水点（IslandConfig.diveSpots 的 id），继续冲浪 */
  surfaceAt?: string;
  /**
   * M3-20 通行条件：全部 flag 为真才能通过。
   * - 普通出口（徽章检查门）：没满足时走进去弹出 lockedHint 并被挡回
   * - action 出口（瀑布 / 岩壁）：不靠走进触发，而是在触发区里按互动键「攀瀑 / 攀岩」
   */
  requires?: string[];
  lockedHint?: string;
  action?: 'waterfall' | 'climb';
  /** M3-21 通过前确认（是 / 否）：pages 说明文字；选「否」被挡回 */
  confirm?: string[];
  /** M3-21 通过时修改 flag（联盟：进入四天王之间时重置上一轮的击败记录） */
  onPass?: { set?: string[]; clear?: string[] };
}

export interface NpcSpot {
  /** NPC id（M1-06 NPC 系统接管；此处只占位） */
  id: string;
  position: Vec2;
  yaw?: number;
}

export interface RoomConfig {
  id: string;
  name: string;
  /** 宽（x）、深（z）、层高（米） */
  size: [number, number, number];
  floor: { color: string; pattern?: 'plank' | 'tile' | 'checker' | 'plain' | 'rock' | 'wave'; accent?: string; deep?: string };
  /** relief：护墙板浮雕（'wave' = 两道错开的水波浮雕带，颜色 reliefColor / trim） */
  wall: { color: string; trim?: string; wainscot?: string; relief?: 'wave'; reliefColor?: string };
  lighting: LightingPreset;
  furniture: FurnitureConfig[];
  exits: ExitConfig[];
  npcs?: NpcSpot[];
  /** 镜头距离（米，缺省按房间大小计算） */
  cameraDistance?: number;
  /** 地板开洞（x0, z0, x1, z1）：水池等下沉区域，地板与花纹在此范围内不绘制 */
  floorHole?: readonly [number, number, number, number];
  /** M1-11 水位机关（道馆 1） */
  waterPuzzle?: WaterPuzzleConfig;
  /** M3-15 道馆 5–8 馆内机关（导电开关 / 昼夜日晷 / 滑冰 / 风力桥） */
  mechanism?: GymMechanismConfig;
  /** 战斗舞台（对战时玩家站位与朝向；缺省在玩家前方就地开战） */
  /** radius：战斗场半径（默认 ARENA_RADIUS 7 m；室内按房间缩小） */
  battleStage?: { position: Vec2; yaw: number; radius?: number };
  /** M2-15 洞窟暗雷：在房间里走动按遇敌表触发野生战斗（config/encounters 的表 id） */
  encounters?: { table: string; ratePerMeter?: number };
  /** M2-12 黑暗房间：flag 未置位时只剩玩家身边一圈微光（「闪光」照亮） */
  dark?: { flag: string; hint: string };
  /** M2-10/11/13 室内场地能力阻挡（与大地图 blockers 同一套 cleared:<id> 标记） */
  blockers?: InteriorBlocker[];
  /**
   * M3-18 海底房间：水下雾色 / 光束 / 气泡 / 焦散，玩家骑着潜水坐骑悬浮移动，音频整体低通；
   * 墙用礁岩遮挡（rocks = 沿墙堆的礁石密度 0..1）。
   */
  underwater?: { rocks?: number; depth?: number };
  /** 房间背景音乐（缺省用 InteriorConfig.bgm） */
  bgm?: string;
  /** 室内剧情触发区（走进范围自动执行一次） */
  triggers?: InteriorTrigger[];
  /** M3-20 怪力推石谜题（冠军之路） */
  boulders?: BoulderPuzzleConfig;
}

export interface InteriorBlocker {
  id: string;
  type: 'strength' | 'rock-smash' | 'vines';
  requiresFlag: string;
  position: Vec2;
  /** 宽、高、深（米） */
  size: [number, number, number];
  yaw?: number;
  hint: string;
  color?: string;
}

export interface InteriorTrigger {
  id: string;
  position: Vec2;
  radius: number;
  script: string;
  doneFlag: string;
  /** 可重复触发直到脚本自己置位 doneFlag（剧情战斗：输了下次再来） */
  repeat?: boolean;
  showIf?: string[];
  hideIf?: string[];
}

export interface InteriorConfig {
  id: string;
  name: string;
  /** 从大地图进入时所在的房间 */
  entryRoom: string;
  /** 从大地图进入时使用的出口 id（通常是正门） */
  entryExit: string;
  rooms: RoomConfig[];
  /** 室内背景音乐 id（M1-20 接入） */
  bgm?: string;
}
