/**
 * 任务数据模型：07-22 §3.1 原样保留 + 3D 扩展（设计 §7.2 marker / trigger）。
 */
import type { IslandId } from '../state/GameState';

export type QuestCategory = 'main' | 'side' | 'hidden';
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

export type Vec3 = [number, number, number];

export interface QuestMarker {
  island: IslandId;
  position?: Vec3;
  /** 只标记区域时用 */
  zoneId?: string;
  /** 搜索范围（圈出一片区域，不给精确点） */
  radius?: number;
  /** 多个可选地点（如 3 株药草）：标记依次指向第一个 doneFlag 未置位的地点 */
  points?: Array<{ position: Vec3; doneFlag: string }>;
}

export type QuestTrigger =
  | { type: 'enter-zone'; zoneId: string }
  | { type: 'reach-point'; position: Vec3; radius: number; /** 只在夜晚生效（夜间足迹等） */ night?: boolean }
  | { type: 'catch'; speciesId: number; count?: number }
  | { type: 'defeat'; trainerId: string };

export interface QuestObjective {
  id: string;
  text: string;
  completeFlag: string;
  marker?: QuestMarker;
  trigger?: QuestTrigger;
  /** 计数型目标（M1-16）：进度取 GameState.vars[var]，日志显示「x/target」 */
  counter?: { var: string; target: number; /** 由玩法统计自动累加（只在该目标进行中时计数） */ stat?: QuestStat };
}

/**
 * 玩法统计（剧情线覆盖全部玩法）：对应事件发生时，正在进行且 counter.stat 匹配的目标计数 +1
 *  catch 捕获 · trainer-win 战胜训练家 · wild-win 打倒野生宝可梦 · fish 钓上宝可梦
 *  heal 宝可梦中心回复 · buy 商店购买 · surf 冲浪下水 · evolve 宝可梦进化
 */
/** 计划文档 §9.4 培育：harvest 收获 · block 制作方块 · feed 喂食 · daycare 培育屋领回 · craft 工坊合成 · mint 合成薄荷 */
export type QuestStat = 'catch' | 'trainer-win' | 'wild-win' | 'fish' | 'heal' | 'buy' | 'surf' | 'evolve' | 'harvest' | 'block' | 'feed' | 'daycare' | 'craft' | 'mint';

export interface QuestReward {
  items?: { id: string; qty: number }[];
  money?: number;
  /** 骑乘能力 flag（原 HM，flag 名不变，设计 §3.4） */
  hm?: string;
  /** 赠送的 speciesId */
  pokemon?: number;
  /** 赠送宝可梦的等级（默认 10） */
  pokemonLevel?: number;
}

export interface Quest {
  id: string;
  title: string;
  category: QuestCategory;
  island: string;
  summary: string;
  objectives: QuestObjective[];
  /** quest id 或 flag 名，全部满足才 available */
  prerequisites: string[];
  startNpc?: string;
  startFlag?: string;
  completeFlag: string;
  reward?: QuestReward;
}

/** NPC 按任务状态切换的对话（07-22 §3.5） */
export interface QuestDialog {
  questId: string;
  when: QuestStatus;
  dialog: string[];
  /** 这段对话说完后置位的 flag（如接受支线：startFlag）（M1-06） */
  setFlags?: string[];
  /** M1-13：这些 flag 全部为真时才匹配（同一任务不同阶段的对话，如「交付药草」） */
  requires?: string[];
  /** M1-13：这些 flag 任一为真时不匹配 */
  unless?: string[];
  /** M1-13：说完对白后执行的剧情脚本 id（config/story；可配空 dialog 直接进剧情） */
  story?: string;
}

export interface DialogSource {
  dialogByQuest?: QuestDialog[];
  dialogDay?: string[];
  dialogNight?: string[];
  dialog: string[];
}

export type Flags = Record<string, boolean>;
