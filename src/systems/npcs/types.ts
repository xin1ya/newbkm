/**
 * M1-06 · NPC 数据模型（07-22 §3.5 NpcDef + 设计 §8.5 的 3D 表现）。
 *
 * 放置规则：
 * - 有 `schedule`：只按日程出现（每条日程给出所在岛屿或室内房间、位置、活动方式）；日程没覆盖的时段 NPC 不出现（在家 / 下班）。
 * - 没有 `schedule`：出现在室内配置里所有引用它 id 的 `NpcSpot`（例如两座宝可梦中心共用一位护士造型）。
 * - `showIf` / `hideIf` 用 flag 控制剧情前后是否出现。
 */
import type { DialogSource, QuestStatus } from '../quests/types';
import type { IslandId } from '../state/GameState';

/** 人物配色（程序化人物 TrainerModel 与以后的 glb 换色共用） */
export interface TrainerPalette {
  skin: string;
  hair: string;
  cap: string;
  capBrim: string;
  jacket: string;
  shirt: string;
  pants: string;
  shoes: string;
  bag: string;
}

/**
 * 人物造型（M1-06 NPC 复用同一套程序化人物）。缺省值 = 玩家造型。
 */
export interface TrainerStyle {
  hat: 'cap' | 'none' | 'nurse' | 'bucket' | 'sailor' | 'bandana';
  hair: 'short' | 'long' | 'bun' | 'bald' | 'spiky' | 'pony';
  bag: boolean;
  /** 外套下摆：short = 夹克，long = 长外套 / 白大褂，dress = 连衣裙 */
  coat: 'short' | 'long' | 'dress';
  apron: boolean;
  cane: boolean;
  beard: boolean;
  glasses: boolean;
  /** 整体缩放（小孩约 0.72，老人约 0.93） */
  scale: number;
  /** 驼背（老人） */
  stoop: number;
}

export interface TrainerExtraPalette {
  /** 围裙 / 裙子 / 帽子装饰等附加色 */
  accent?: string | undefined;
}


export type Vec2 = [number, number];

/** 造型模板（NpcModel 负责把模板翻译成人物部件与配色） */
export type NpcLook =
  | 'mom'
  | 'professor'
  | 'aide'
  | 'elder'
  | 'nurse'
  | 'clerk'
  | 'villager-m'
  | 'villager-f'
  | 'child-m'
  | 'child-f'
  | 'fisher'
  | 'sailor'
  | 'vendor'
  | 'hiker'
  | 'bug-catcher'
  | 'guide'
  | 'swimmer'
  | 'leader-water'
  | 'guard'
  | 'youngster'
  | 'lass'
  | 'camper';

export interface NpcAppearance {
  look: NpcLook;
  /** 在模板配色基础上覆盖 */
  palette?: Partial<TrainerPalette>;
  style?: Partial<TrainerStyle>;
  accent?: string;
}

export type NpcLocation =
  | { island: IslandId; position: Vec2; yaw?: number }
  | { interior: string; room: string; position: Vec2; yaw?: number };

/**
 * 活动方式：
 * - stand：原地站立（缓慢转头）
 * - wander：在 `radius` 米内随机散步
 * - patrol：沿 `path` 往返巡逻（相对位置，以 position 为原点）
 */
export type NpcActivity =
  | { kind: 'stand' }
  | { kind: 'wander'; radius: number }
  | { kind: 'patrol'; path: Vec2[] }
  /** 原地轮流面向几个方向（训练家「左顾右盼」，M1-10） */
  | { kind: 'turn'; yaws: number[]; every: number };

export interface ScheduleEntry {
  /** 起止小时（0–24，可跨午夜：from 22 to 6） */
  from: number;
  to: number;
  at: NpcLocation;
  activity?: NpcActivity;
}

export interface NpcDef extends DialogSource {
  id: string;
  name: string;
  /** 名字标签下方的小字身份（护士、店员、渔夫……） */
  title?: string;
  appearance: NpcAppearance;
  schedule?: ScheduleEntry[];
  /** 全部 flag 为真才出现 */
  showIf?: string[];
  /** 任一 flag 为真就不出现 */
  hideIf?: string[];
  /** M1-14 剧情消失（如索罗亚现出原形）：hideIf 生效时即使玩家就在旁边也立即移除（默认会推迟到玩家走远） */
  vanishInstantly?: boolean;
  /** 室内固定位 NPC 的活动方式（缺省 stand） */
  activity?: NpcActivity;
  /** 头顶名字标签（缺省显示） */
  nameTag?: boolean;
  /** 训练家（M1-10）：config/trainers 的 id；未击败时视线发现玩家 / 对话触发对战 */
  trainer?: string;
  /**
   * M1-19 服务：对话结束后提供的功能。
   * - heal：宝可梦中心回复（护士）
   * - shop：打开 config/shops 里的商店
   * - recall：想起招式（心之鳞片或 1000 円）
   */
  service?: NpcService;
  /** M1-15 赠礼：第一次对话后送出物品（flag 记录已送出，之后不再送） */
  gift?: NpcGift;
}

/** breeder：培育家菜单（蒲婆婆，计划文档 §9.4）；workshop：工坊合成（计划文档 §9.5） */
export type NpcService = { kind: 'heal' } | { kind: 'shop'; shop: string } | { kind: 'recall' } | { kind: 'breeder' } | { kind: 'workshop' };

export interface NpcGift {
  item: string;
  qty: number;
  /** 已送出标记 */
  flag: string;
  /** 送出前的台词 */
  lines: string[];
  /** 送出后的说明（如何使用） */
  after?: string[];
  /** 需要这些 flag 才会送 */
  requires?: string[];
  /** 一并送出的其他道具 */
  extra?: { item: string; qty: number }[];
}

export type { QuestStatus };
