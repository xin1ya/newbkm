/**
 * M1-18 · 场景侧的暂停菜单接入：实现 MenuHost、暂停游戏时钟、应用设置。
 * 大地图与室内共用；菜单打开期间场景继续渲染（水面、NPC 待机），但时钟停止、玩家输入被 UI 栈拦截。
 */
import type { Game } from '@/core/Game';
import type { CameraRig } from '@/core/camera/CameraRig';
import type { Dex } from '@/systems/data/Dex';
import type { GameState, Settings } from '@/systems/state/GameState';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { CUILAN_DEX } from '@/config/pokedex';
import { Dialog } from '@/ui/core/Dialog';
import type { UiRoot } from '@/ui/core/UiRoot';
import { PauseMenu, type MenuHost, type MenuTab, type QuestLogHost } from '@/ui/menu';
import { QUEST_REGISTRY } from '@/config/quests';
import { ISLANDS } from '@/config/islands';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { buildZoneDex } from './zoneDex';
import { QuestDirector } from './QuestDirector';
import { sfx } from '@/core/audio';

/** 文字速度 → 每秒字数 */
export const TEXT_CPS: Record<Settings['textSpeed'], number> = { slow: 22, normal: 40, fast: 80, instant: Infinity };
/** 镜头灵敏度 1.0× 对应的弧度/像素 */
export const BASE_SENSITIVITY = 0.0035;

/** 把设置应用到全局与当前场景（启动、读档、菜单修改时调用） */
export function applySettings(s: Settings, rig?: CameraRig, game?: Game): void {
  Dialog.defaultCps = TEXT_CPS[s.textSpeed] ?? 40;
  if (rig) {
    rig.sensitivity = BASE_SENSITIVITY * s.mouseSensitivity;
    rig.invertY = s.invertY;
    // 菜单开着时不抢鼠标锁定：只更新模式与「想要锁定」，关闭菜单时再请求
    rig.lockThird = s.mouseLock;
    rig.setMode(s.cameraMode, game?.input, false);
  }
  if (game) {
    game.loop.maxFps = s.fpsLimit ?? 120;
    game.dynRes.enabled = s.dynamicResolution ?? true;
    if (!game.dynRes.enabled) game.dynRes.reset();
  }
  game?.events.emit('settings:change', {});
}

export interface PauseMenuOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  location(): string;
  save(): Promise<boolean>;
  saveSlot?: (() => string) | undefined;
  rig?: CameraRig | undefined;
  tab?: MenuTab | undefined;
  /** 计划文档 §9.5：放置能量方块诱饵（大地图户外提供） */
  placeLure?: ((blockUid: string) => string | null) | undefined;
}

let current: PauseMenu | null = null;

/** 没有任务导演时（单元 / 场景测试）使用的空实现 */
function emptyQuestHost(): QuestLogHost {
  return {
    registry: QUEST_REGISTRY,
    tracked: () => null,
    manual: () => false,
    track: () => undefined,
    untrack: () => undefined,
    auto: () => undefined,
    rewardText: (l) => `${l.id} ×${l.qty}`,
    npcName: () => null,
  };
}

/** 当前打开的菜单（e2e 调试钩子使用） */
export function currentPauseMenu(): PauseMenu | null {
  return current;
}

export async function openPauseMenu(o: PauseMenuOptions): Promise<void> {
  if (current) return;
  sfx('menu-open');
  const { game, state } = o;
  const host: MenuHost = {
    dex: o.dex,
    state,
    keyItems: KEY_ITEM_BY_ID,
    regionalDex: CUILAN_DEX,
    zoneDex: (() => {
      const isl = ISLANDS[state.position.island];
      return isl ? buildZoneDex(isl, ENCOUNTER_TABLES, state.flags) : undefined;
    })(),
    location: o.location,
    timeOfDay: () => (game.clock.timeOfDay === 'night' ? 'night' : 'day'),
    clock: () => game.clock.format(),
    badges: () => Object.keys(state.flags).filter((f) => f.startsWith('badge-') && state.flags[f]).length,
    save: o.save,
    saveSlot: o.saveSlot,
    applySettings: () => applySettings(state.settings, o.rig, game),
    quests: QuestDirector.current?.logHost() ?? emptyQuestHost(),
    placeLure: o.placeLure,
  };
  const wasRunning = game.clockRunning;
  game.clockRunning = false;
  game.input.exitPointerLock();
  const menu = new PauseMenu(o.ui, host, o.tab);
  // 指定页签（J 任务日志等快捷键）时直接进入内容页
  if (o.tab) menu.open(o.tab, true);
  current = menu;
  game.events.emit('menu:open', { tab: menu.current?.id ?? 'party' });
  try {
    o.ui.push(menu);
    await menu.done;
  } finally {
    current = null;
    game.clockRunning = wasRunning;
    game.events.emit('menu:close', {});
    if (game.input.wantPointerLock) game.input.requestPointerLock();
  }
}
