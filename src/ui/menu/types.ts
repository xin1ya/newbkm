/**
 * M1-18 · 菜单与宿主场景之间的接口（ui 层不能依赖 scenes / world，所以由场景实现 MenuHost 传进来）。
 */
import type { Input } from '@/core/input';
import type { Dex } from '@/systems/data/Dex';
import type { KeyItemDef } from '@/systems/items';
import type { GameState } from '@/systems/state/GameState';
import type { UiRoot } from '../core/UiRoot';
import type { Quest, QuestRegistry } from '@/systems/quests';
import type { RewardLine } from '@/systems/quests/runtime';

/** M1-16 任务日志需要的宿主能力（由 QuestDirector 提供） */
export interface QuestLogHost {
  registry: QuestRegistry;
  /** 当前实际追踪的任务（含自动追踪） */
  tracked(): Quest | null;
  /** 玩家是否手动指定了追踪（false = 自动 / 已取消） */
  manual(): boolean;
  track(questId: string): void;
  untrack(): void;
  /** 恢复自动追踪 */
  auto(): void;
  rewardText(line: RewardLine): string;
  npcName(id: string): string | null;
  /** 大地图（M1-17）接入后提供；未提供时「在地图上查看」置灰 */
  showOnMap?: ((questId: string) => void) | undefined;
}

/** 区域图鉴：一个野外区域（场景层从岛屿配置 + 遇敌表生成） */
export interface ZoneDexSpecies {
  speciesId: number;
  levels: [number, number];
  /** 出现方式：草丛 / 可见 / 水面 / 钓鱼 */
  methods: string[];
  /** 条件：白天 / 夜晚 / 雨天 / 稀有 / 成群 */
  notes: string[];
  /** 出现权重占比（0–1，按全表权重） */
  share: number;
}

export interface ZoneDexZone {
  id: string;
  name: string;
  kind: 'wild' | 'sea' | 'town' | 'dungeon-entrance';
  levelRange: [number, number] | null;
  /** 常见天气（按权重） */
  weather: string[];
  visited: boolean;
  /** 区域中心（地图坐标，显示用） */
  center: [number, number];
  /** 区域头目巢穴（有则显示） */
  alpha: { speciesId: number; level: number } | null;
  species: ZoneDexSpecies[];
}

export interface MenuHost {
  dex: Dex;
  state: GameState;
  keyItems: ReadonlyMap<string, KeyItemDef>;
  regionalDex: { name: string; species: readonly number[] };
  /** 区域图鉴（当前岛屿的野外区域）；未提供时页面显示为空 */
  zoneDex?: { island: string; zones: ZoneDexZone[] } | undefined;
  /** 当前所在地：「萌芽群岛 · 萌芽镇」 */
  location(): string;
  timeOfDay(): 'day' | 'night';
  clock(): string;
  badges(): number;
  /** 存档；返回是否成功 */
  save(): Promise<boolean>;
  /** 当前存档位 id（slot1…） */
  saveSlot?: (() => string) | undefined;
  /** 设置项被修改后立即应用（文字速度、镜头、名字标签等） */
  applySettings(): void;
  /** 任务日志（M1-16） */
  quests: QuestLogHost;
  /**
   * 计划文档 §9.5：在玩家脚下放置能量方块诱饵（大地图户外才提供）。
   * 返回 null 表示成功，否则为不能放置的原因。
   */
  placeLure?: ((blockUid: string) => string | null) | undefined;
}

export interface PageContext {
  host: MenuHost;
  ui: UiRoot;
  /** 执行一段异步流程（对话、选择），期间菜单不响应按键，结束后重绘 */
  run(task: () => Promise<void>): void;
  /** 当前输入设备下动作对应的键帽文字 */
  keyLabel(action: 'confirm' | 'back' | 'menu' | 'uiLeft' | 'uiRight'): string;
}

export interface MenuPage {
  readonly id: string;
  readonly title: string;
  readonly el: HTMLElement;
  /** 侧栏选中（预览）时调用 */
  show(): void;
  /** 进入内容焦点 */
  focus(): void;
  blur(): void;
  /** 内容焦点时每帧调用；返回 'exit' 表示回到侧栏 */
  handle(input: Input): 'exit' | void;
  render(): void;
  /** 底部操作提示 */
  hints(): string;
}
