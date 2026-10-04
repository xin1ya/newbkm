/**
 * M1-13 / M1-14 · 剧情脚本纯逻辑（无 three / DOM）。
 *
 * 剧情 = 一串步骤（StoryStep），由 scenes/common/StoryDirector 逐条执行：
 * - 对话 / 旁白（梦境、章节卡）、置位 flag、累加计数变量、给道具、选择御三家、脚本战斗、演出特效、等待、传送、条件分支、选择题。
 * 触发来源：
 * - 新游戏（开场梦境）；
 * - NPC 对话：QuestDialog.story 指向脚本 id（替代普通对白）；
 * - 世界中的剧情拾取物（StoryPickup：药草、漂流的钓具箱、灯塔灯室、脚印……），互动后执行脚本；
 * - 抵达地点（StoryTrigger：进入范围自动执行一次）。
 * 所有状态都写进 flags / vars，存档无需新增字段（设计 §7.2）。
 */
import type { Flags } from '../quests/types';

export type StoryFx = 'dream-in' | 'dream-out' | 'flash' | 'poof' | 'fade-out' | 'fade-in' | 'shake' | 'lighthouse' | 'fog-clear';

export type StoryStep =
  | { kind: 'say'; lines: string[]; speaker?: string }
  /** 旁白（梦境 / 心声）：全屏暗幕中央文字 */
  | { kind: 'narrate'; lines: string[]; voice?: string }
  | { kind: 'flag'; set: string }
  | { kind: 'var'; name: string; add: number }
  | { kind: 'item'; id: string; qty: number }
  /** 选择御三家（UI），写入 flags starter-chosen 与 starter-<物种> */
  | { kind: 'starter'; species: number[]; level: number }
  /** 脚本野生战斗：胜利 / 失败 / 逃跑后分别执行分支 */
  | { kind: 'battle'; species: number; level: number; moves?: string[]; noCapture?: boolean; noRun?: boolean; onWin?: StoryStep[]; onLose?: StoryStep[] }
  | { kind: 'fx'; name: StoryFx; ms?: number }
  | { kind: 'wait'; ms: number }
  /** 章节卡 / 结尾卡 */
  | { kind: 'card'; title: string; subtitle?: string; ms?: number }
  | { kind: 'teleport'; x: number; z: number; yaw?: number }
  /** 把玩家送回触发前最后所在的安全位置（离开限制区域时的「拉回」） */
  | { kind: 'pushBack' }
  | { kind: 'if'; flags: string[]; then: StoryStep[]; else?: StoryStep[] }
  /** 二选一 / 多选：按选中项执行分支 */
  | { kind: 'choice'; prompt?: string; options: Array<{ label: string; steps: StoryStep[] }> };

export interface StoryScript {
  id: string;
  steps: StoryStep[];
}

/** 世界中的剧情拾取物 / 可互动点 */
export interface StoryPickup {
  id: string;
  island: string;
  position: [number, number];
  /** 表现（world/props/storyProps 负责建模） */
  model: 'herb' | 'tackle-box' | 'lamp' | 'footprints' | 'sparkle' | 'tm-disc';
  /** 互动提示文字 */
  label: string;
  script: string;
  /** 全部为真才出现 */
  showIf?: string[];
  /** 任一为真就消失 */
  hideIf?: string[];
  /** 互动半径（米，缺省 1.6；海上漂流物更大） */
  range?: number;
  /** 漂在水面上（跟随水位起伏；只有水上骑乘时能靠近） */
  floating?: boolean;
  /** 脚印：朝向（弧度） */
  yaw?: number;
}

/** 走进范围自动执行（一次，由 flag 记录） */
export interface StoryTrigger {
  id: string;
  island: string;
  position: [number, number];
  radius: number;
  /** 矩形范围 [x0, z0, x1, z1]（给出时代替圆形） */
  rect?: [number, number, number, number];
  /** 玩家不在这个区域内时触发（代替位置判定；用于「离开萌芽镇」） */
  outsideZone?: string;
  script: string;
  /** 该 flag 为真后不再触发；非 repeat 触发执行完若脚本没置位，由运行时置位 */
  doneFlag: string;
  /** 可重复触发（直到 doneFlag 为真） */
  repeat?: boolean;
  showIf?: string[];
  hideIf?: string[];
}

export function flagsAll(flags: Flags, need?: readonly string[]): boolean {
  return !need || need.every((f) => flags[f] === true);
}

export function flagsAny(flags: Flags, any?: readonly string[]): boolean {
  return !!any && any.some((f) => flags[f] === true);
}

export function pickupVisible(p: StoryPickup, flags: Flags): boolean {
  return flagsAll(flags, p.showIf) && !flagsAny(flags, p.hideIf);
}

export function triggerDue(t: StoryTrigger, flags: Flags, island: string, x: number, z: number, zoneId: string | null = null): boolean {
  if (t.island !== island || flags[t.doneFlag]) return false;
  if (!flagsAll(flags, t.showIf) || flagsAny(flags, t.hideIf)) return false;
  if (t.outsideZone) return zoneId !== t.outsideZone;
  if (t.rect) {
    const [x0, z0, x1, z1] = t.rect;
    return x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1);
  }
  return Math.hypot(x - t.position[0], z - t.position[1]) <= t.radius;
}

/** 脚本里所有引用的 flag（写入的），用于校验「任务 completeFlag 都有来源」 */
export function flagsWritten(steps: readonly StoryStep[], out = new Set<string>()): Set<string> {
  for (const s of steps) {
    if (s.kind === 'flag') out.add(s.set);
    if (s.kind === 'starter') {
      out.add('starter-chosen');
      for (const sp of s.species) out.add(`starter-${sp}`);
    }
    if (s.kind === 'battle') {
      flagsWritten(s.onWin ?? [], out);
      flagsWritten(s.onLose ?? [], out);
    }
    if (s.kind === 'if') {
      flagsWritten(s.then, out);
      flagsWritten(s.else ?? [], out);
    }
    if (s.kind === 'choice') for (const o of s.options) flagsWritten(o.steps, out);
  }
  return out;
}

/** 脚本里引用的道具 id（校验道具存在） */
export function itemsGiven(steps: readonly StoryStep[], out = new Set<string>()): Set<string> {
  for (const s of steps) {
    if (s.kind === 'item') out.add(s.id);
    if (s.kind === 'battle') {
      itemsGiven(s.onWin ?? [], out);
      itemsGiven(s.onLose ?? [], out);
    }
    if (s.kind === 'if') {
      itemsGiven(s.then, out);
      itemsGiven(s.else ?? [], out);
    }
    if (s.kind === 'choice') for (const o of s.options) itemsGiven(o.steps, out);
  }
  return out;
}
