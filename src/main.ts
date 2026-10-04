/**
 * 入口：初始化 Platform → Game → 读档（或新游戏）→ 加载萌芽群岛 → 大地图场景。
 * URL 参数：?quality=low|medium|high、?lite（低画质 + 低分辨率，用于软件渲染 / 截图）、?new（忽略存档开新游戏）、
 *          ?seed=123（固定随机种子，e2e / 性能基线使用）
 */
import { currentPauseMenu } from './scenes/common/pauseMenu';
import { IslandMap } from './scenes/common/IslandMap';
import { QuestDirector } from './scenes/common/QuestDirector';
import { StoryDirector, registerStoryDirector } from './scenes/common/StoryDirector';
import { itemInfo } from '@/systems/items';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { AudioDirector } from './scenes/common/AudioDirector';
import { AudioEngine, registerAudio, initVoice, setVoiceEnv } from '@/core/audio';
import { MUSIC } from '@/config/audio/music';
import type { MenuTab } from './ui/menu';
import { createWebPlatform } from '@/platform';
import { Game } from '@/core/Game';
import { AssetLoader } from '@/core/assets';
import { initMonModels, preloadMonModels, wildBodyFactory } from '@/actors/pokemon/monModel';
import { initHumanModels } from '@/actors/player';
import { setWildBodyFactory } from '@/world/spawns';
import { dex } from '@/config/data';
import { getIsland, ISLANDS } from '@/config/islands';
import { TRAVEL_SLOT_KEY } from '@/systems/travel';
import { createRng } from '@/systems/rng';
import { createPokemon } from '@/systems/pokemon';
import {
  addItem,
  createNewGame,
  deserializeSave,
  receivePokemon,
  markSeen,
  markCaught,
  setFlag,
  type GameState,
} from '@/systems/state';
import { pixelRatioFor, qualityFromUrl, resolveQuality } from '@/render';
import { UiRoot, Toaster, Transition } from '@/ui/core';
import { Hud, LoadingScreen } from '@/ui/hud';
import { LAST_SLOT_PREF, OverworldScene, SAVE_SLOT, SAVE_SLOTS } from '@/scenes/overworld';
import { AutoSave } from '@/scenes/common/AutoSave';
import { MonIconRenderer } from '@/scenes/common/MonIconRenderer';
import { setMonIconProvider } from '@/ui/menu/common';
import { TitleScreen, type TitleSlot } from '@/ui/title/TitleScreen';
import type { InteriorScene } from '@/scenes/interior';
import type { SceneNpcs } from '@/scenes/common/SceneNpcs';
import type { PlayerController } from '@/actors/player';

declare global {
  interface Window {
    /** 调试 / e2e / 性能脚本的挂钩（不属于游戏逻辑） */
    __cuilan?: { game: Game; overworld: OverworldScene; state: GameState; ready: boolean };
    __cuilanInterior?: () => InteriorScene | null;
    /** M1-20 音频状态（e2e） */
    __cuilanAudio?: {
      state(): Record<string, unknown> & {
        wanted: string | null;
        battle: string | null;
        victory: string | null;
        mix: Record<string, number>;
      };
      unlock(): void;
    };
    /** M1-12 骑乘（e2e） */
    __cuilanRide?: {
      flying: () => boolean;
      takeoff: () => boolean;
      land: (instant?: boolean) => Promise<boolean>;
      surfing(): boolean;
      start(): Promise<boolean>;
      stop(): Promise<void>;
      toggle(): Promise<void>;
      shadows(): { x: number; z: number; r: number }[];
      mount(): { speciesId: number; uid: string | null; nickname: string } | null;
      entry(): { x: number; z: number; level: number } | null;
    };
    /** M1-15 钓鱼（e2e） */
    __cuilanFishing?: {
      start(): Promise<void>;
      active(): boolean;
      rod(): string | null;
      spots(): { id: string; x: number; z: number; r: number }[];
      result(): { result: string | null; caught: number | null };
    };
    /** M1-19 商店 / 回复（e2e） */
    __cuilanServices?: { shop(): { listing: unknown; talk: unknown } | null; healBalls(): number };
    /** M1-06：当前场景（室内优先）的 NPC 列表与对话入口（e2e） */
    __cuilanNpcs?: {
      list(): ReturnType<SceneNpcs['manager']['list']>;
      focus(): string | null;
      talk(id: string): Promise<boolean>;
      tags(): string[];
    };
    /** M1-07：当前互动焦点与提示气泡（e2e） */
    __cuilanInteract?: {
      focus(): { id: string; kind: string; label: string } | null;
      prompt(): { id: string; text: string } | null;
      use(): Promise<boolean>;
    };
    /** M1-16：任务导演与 HUD 状态（e2e） */
    /** M1-08/09/10：跟随宝可梦、训练家、复活点（e2e） */
    __cuilanPlay?: {
      follower(): {
        uid: string;
        x: number;
        z: number;
        visible: boolean;
        borrowed: boolean;
        mood: string | null;
      } | null;
      trainer(): { active: string | null; phase: string | null; lastSpotted: string | null };
      trainers(): { id: string; trainer: string; x: number; z: number; yaw: number }[];
      respawn(): unknown;
    };
    __cuilanMap?: {
      open(questId?: string): void;
      shown(): { markers: string[]; zones: string[] } | null;
      view(): unknown;
      camera(): { cu: number; cv: number; zoom: number } | null;
    };
    __cuilanQuests?: {
      director: QuestDirector;
      tracker(): string;
      compass(): { left: number; text: string } | null;
      notices(): string[];
      target(): { x: number; z: number; radius: number; zoneId: string | null } | null;
      tracked(): string | null;
      marker(): boolean;
      beacon(): { beam: boolean; ring: boolean };
    };
    /** M1-18：暂停菜单（e2e）。open 不等待关闭；state 返回当前页签与焦点 */
    __cuilanSave?: { slot(): string; lastAuto(): string | null; request(reason: string): void };
    __cuilanStory?: {
      director: StoryDirector;
      running(): string | null;
      history(): string[];
      dreaming(): boolean;
      card(): string | null;
      pickups(): string[];
      beam(): boolean;
      lastTrigger(): string | null;
      run(id: string): Promise<boolean>;
    };
    __cuilanMenu?: {
      open(tab?: MenuTab): boolean;
      state(): { tab: string | null; inPage: boolean } | null;
      close(): void;
    };
  }
}

/**
 * 开发快捷方式（URL `?quick`）：跳过开场梦境与御三家剧情，直接发放测试伙伴。
 * 正式新游戏从自家二楼的开场梦境开始（M1-13，config/story）；大部分 e2e 用 quick 进入可玩状态。
 */
function grantPrototypeStarter(state: GameState, rng: ReturnType<typeof createRng>): void {
  const starter = createPokemon(dex, 722, 5, rng, { ot: state.player.name });
  receivePokemon(state, starter);
  markSeen(state, 722);
  markCaught(state, 722);
  addItem(state, 'poke-ball', 10);
  addItem(state, 'potion', 2);
  setFlag(state, 'm0.prototype-starter');
  // 开场梦境尚未制作：原型直接视为已开始游戏并看完梦境，主线从「前往木兰博士研究所」开始（M1-16 任务追踪可见）
  setFlag(state, 'game-started');
  setFlag(state, 'dream-prelude-done');
}

async function boot(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app not found');
  document.getElementById('boot')?.remove();
  const params = new URLSearchParams(location.search);
  const loading = new LoadingScreen(document.body);
  loading.set(0.02, '初始化平台……');

  const platform = await createWebPlatform();
  const seedParam = params.get('seed');
  const rng = createRng(seedParam ? Number(seedParam) >>> 0 : undefined);
  const home = getIsland('sprout');
  // M2-01 岛间旅行后重新加载：直接进入同一存档位
  const travelSlot = sessionStorage.getItem(TRAVEL_SLOT_KEY);
  if (travelSlot) sessionStorage.removeItem(TRAVEL_SLOT_KEY);

  // 标题画面：继续 / 新游戏 / 读档（3 个存档位）。
  // 开发与自动化测试跳过：?quick / ?new / ?notitle / ?slot=… 或 webdriver（e2e）
  let slot: string = travelSlot ?? params.get('slot') ?? SAVE_SLOT;
  let forceNew = !travelSlot && params.has('new');
  const skipTitle = !!travelSlot || params.has('quick') || params.has('new') || params.has('notitle') || params.has('slot') || navigator.webdriver;
  if (!skipTitle) {
    const metas = await platform.storage.list().catch(() => []);
    const slots: TitleSlot[] = SAVE_SLOTS.map((id, i) => {
      const m = metas.find((x) => x.slot === id);
      return { slot: id, label: `存档 ${i + 1}`, summary: (m?.summary as TitleSlot['summary']) ?? null, savedAt: m?.savedAt ?? null };
    });
    // 旧版存档只有数据没有摘要时也算有档
    for (const s of slots) {
      if (!s.summary && (await platform.storage.read(s.slot).catch(() => null))) s.summary = { playerName: '训练家' };
    }
    loading.set(0.04, '');
    const pick = await new TitleScreen(document.body, slots, { version: platform.info.version, remove: (id) => platform.storage.remove(id) }).run();
    slot = pick.slot;
    forceNew = pick.mode === 'new';
  }

  // 读档
  let state: GameState | null = null;
  if (!forceNew) {
    try {
      const text = await platform.storage.read(slot);
      if (text) {
        const r = deserializeSave(text);
        state = r.state;
        if (r.repairs.length) console.warn('[save] 读档时自动修复：', r.repairs);
      }
    } catch (err) {
      console.error('[save] 存档损坏，开始新游戏', err);
    }
  }
  const isNew = !state;
  if (!state) {
    state = createNewGame({
      name: '小澜',
      gender: 'boy',
      trainerId: Math.floor(rng.next() * 65536),
      spawn: { island: 'sprout', xyz: [...home.spawnPoint], yaw: home.spawnYaw ?? 0 },
    });
    if (params.has('quick')) grantPrototypeStarter(state, rng);
    else {
      // M1-13 正式开场：游戏开始 → 自家二楼卧室醒来前的梦境
      setFlag(state, 'game-started');
      state.position.interior = 'sprout-player-house#2f';
    }
  }

  // 画质
  const urlQ = qualityFromUrl(location.search);
  const quality = resolveQuality(urlQ.tier ?? state.settings.quality, platform.info.gpuTier);
  if (urlQ.lite) {
    quality.maxPixelRatio = 1;
    quality.pixelRatioScale = 0.6;
  }

  const game = new Game({ container, platform, clockMinutes: (state.day ?? 0) * 1440 + state.clockMinutes, antialias: false });
  game.basePixelRatio = pixelRatioFor(quality, platform.info.devicePixelRatio);
  game.renderer.setPixelRatio(game.basePixelRatio);
  game.loop.maxFps = state.settings.fpsLimit ?? 120;
  game.dynRes.enabled = state.settings.dynamicResolution ?? true;
  const ui = new UiRoot(game.input);
  const hud = new Hud(ui);
  hud.setVisible(false);
  const toaster = new Toaster(ui);
  const transition = new Transition(ui);
  game.afterUpdate.push((dt) => {
    ui.update(dt);
    toaster.update(dt);
    hud.update(dt);
  });

  // M1-21 手工宝可梦模型：读清单、注册野外模型工厂、预加载队伍（跟随宝可梦开场就是正式模型）
  await initMonModels(new AssetLoader(platform.assets, game.renderer));
  // 人物模型（男主角等）：读清单后 HumanModel 原地把程序化占位换成 glb
  void initHumanModels(new AssetLoader(platform.assets, game.renderer));
  setWildBodyFactory(wildBodyFactory);
  // 菜单 / 图鉴 / 换人菜单的宝可梦头像：离屏渲染手工模型缩略图
  setMonIconProvider(new MonIconRenderer(dex));
  await preloadMonModels(state.party.map((p) => p.speciesId));

  // M2-01 当前所在岛屿（未配置的岛回退到萌芽群岛出生点）
  if (!ISLANDS[state.position.island]) state.position = { island: 'sprout', xyz: [...home.spawnPoint], yaw: home.spawnYaw ?? 0, interior: null };
  const island = getIsland(state.position.island);
  const overworld = new OverworldScene({ game, ui, hud, toaster, transition, dex, rng, state, island, quality, slot });
  await overworld.load((r, msg) => loading.set(0.1 + r * 0.85, msg));
  await game.scenes.push(overworld);
  await overworld.restoreInterior();
  game.start();
  // M1-16 任务导演：自动完成、奖励、通知、追踪面板 / 罗盘 / 世界标记
  const quests = new QuestDirector({
    game,
    ui,
    state,
    dex,
    rng,
    context: () => {
      const inside = game.scenes.find<InteriorScene>('interior');
      if (inside) return inside.questContext();
      return game.scenes.top === overworld ? overworld.questContext() : { ...overworld.questContext(), active: false };
    },
  });
  game.afterUpdate.push((dt) => quests.update(dt));
  // M1-13 / M1-14 剧情导演：宿主 = 当前活动场景（大地图有战斗 / 传送 / 特效；室内只执行对话类步骤）
  const story = new StoryDirector({
    game,
    ui,
    state,
    dex,
    rng,
    transition,
    toast: (t) => toaster.show(t),
    host: () => (game.scenes.find('interior') ? { kind: 'interior' } : overworld.story),
    itemName: (id) => itemInfo(dex, id, KEY_ITEM_BY_ID).name,
  });
  registerStoryDirector(story);
  // M1-20 音频：程序化合成的 BGM / 音效 / 环境音；第一次按键或点击时解锁（浏览器自动播放策略）
  const audioEngine = new AudioEngine(MUSIC);
  audioEngine.setVolumes(state.settings.volume);
  audioEngine.attachUnlock(window);
  registerAudio(audioEngine);
  const audioDirector = new AudioDirector({
    game,
    state,
    context: () => {
      const inside = game.scenes.find<InteriorScene>('interior');
      if (inside) return inside.audioContext({ time: overworld.timeOfDay(), weather: overworld.fieldWeather() });
      return overworld.audioContext();
    },
  });
  game.afterUpdate.push((dt) => audioDirector.update(dt));
  // 剧情配音：manifest 异步加载；每帧同步配音空间（室外 / 室内 / 道馆）与夜晚
  void initVoice(import.meta.env.BASE_URL);
  game.afterUpdate.push(() => {
    const inside = game.scenes.find<InteriorScene>('interior');
    setVoiceEnv(inside ? inside.voiceSpace : 'outdoor', overworld.timeOfDay() === 'night' ? 1 : 0);
  });
  window.__cuilanAudio = {
    state: () => ({
      ...audioEngine.state(),
      wanted: audioDirector.wanted,
      battle: audioDirector.battle,
      victory: audioDirector.victory,
      mix: audioDirector.mix,
    }),
    unlock: () => audioEngine.unlock(),
  };
  window.__cuilanRide = {
    flying: () => overworld.fly.flying,
    takeoff: () => overworld.fly.takeoff(),
    land: (instant?: boolean) => overworld.fly.land(instant),
    surfing: () => overworld.ride.surfing,
    start: () => overworld.ride.start(),
    stop: () => {
      const land = overworld.ride.findLandNearby();
      return overworld.ride.stop(land, !land);
    },
    toggle: () => overworld.ride.toggle(),
    shadows: () => overworld.ride.shadowPositions(),
    mount: () => overworld.ride.mountChoice,
    entry: () => overworld.ride.entryPoint(),
  };
  window.__cuilanFishing = {
    start: () => overworld.fishing.start(),
    active: () => overworld.fishing.active,
    rod: () => overworld.fishing.rodId,
    spots: () => overworld.fishing.spotList(),
    result: () => ({ result: overworld.fishing.lastResult, caught: overworld.fishing.lastCatch }),
  };
  window.__cuilanServices = {
    shop: () => {
      const inside = game.scenes.find<InteriorScene>('interior');
      const sc = inside?.services.shopScreen ?? overworld.services.shopScreen;
      return sc ? { listing: sc.listing, talk: sc.talk } : null;
    },
    healBalls: () => game.scenes.find<InteriorScene>('interior')?.healBalls ?? 0,
  };
  // M1-17 大地图：M 键 / 任务日志「在地图上查看」
  const islandMap = new IslandMap({
    game,
    ui,
    state,
    director: () => quests,
    source: () => {
      const inside = game.scenes.find<InteriorScene>('interior');
      const ctx = inside?.questContext();
      return {
        island: overworld.islandConfig,
        hf: overworld.terrain.hf,
        zoneAt: (x, z) => overworld.zoneAt(x, z),
        player: () => {
          if (inside && ctx?.kind === 'interior') {
            const [x, , z] = state.position.xyz;
            return { x, z, facing: state.position.yaw, note: `你在「${ctx.roomName}」里（标记为建筑门口）` };
          }
          const p = overworld.player.position;
          return { x: p.x, z: p.z, facing: overworld.player.facing };
        },
      };
    },
  });
  quests.showOnMap = (id) => void islandMap.open({ questId: id });
  window.__cuilan = { game, overworld, state, ready: true };
  window.__cuilanQuests = {
    director: quests,
    tracker: () => quests.hud.trackerText,
    compass: () => quests.hud.compassGoal,
    notices: () => quests.hud.history.map((n) => `${n.kind}:${n.title}`),
    target: () => quests.target,
    tracked: () => quests.tracked?.id ?? null,
    marker: () => quests.hud.markerShown,
    beacon: () => quests.beaconState,
  };
  window.__cuilanPlay = {
    follower: () => {
      const inside = game.scenes.find<InteriorScene>('interior');
      const sf = inside ? inside.follower : overworld.follower;
      const f = sf.follower;
      return f
        ? {
            uid: f.uid,
            x: f.position.x,
            z: f.position.z,
            visible: f.root.visible,
            borrowed: f.borrowed,
            mood: sf.lastMood?.emote ?? null,
          }
        : null;
    },
    trainer: () => {
      const t = game.scenes.find<InteriorScene>('interior')?.trainers ?? overworld.trainers;
      return { active: t.active?.def.id ?? null, phase: t.active?.phase ?? null, lastSpotted: t.lastSpotted };
    },
    trainers: () =>
      [...overworld.npcs.manager.npcs.values()]
        .filter((n) => n.def.trainer)
        .map((n) => ({ id: n.def.id, trainer: n.def.trainer!, x: n.position.x, z: n.position.z, yaw: n.yaw })),
    respawn: () => state.respawn ?? null,
  };
  window.__cuilanMap = {
    open: (questId?: string) => void islandMap.open({ questId }),
    shown: () => islandMap.screen?.shown ?? null,
    view: () => {
      const v = islandMap.screen?.view;
      return v
        ? { quest: v.quest, player: v.player, currentZone: v.currentZone, note: v.playerNote ?? null, focus: v.focus }
        : null;
    },
    camera: () => islandMap.screen?.cam ?? null,
  };
  window.__cuilanInterior = () => game.scenes.find('interior');
  const activeNpcs = (): { npcs: SceneNpcs; player: PlayerController } => {
    const inside = game.scenes.find<InteriorScene>('interior');
    return inside ? { npcs: inside.npcs, player: inside.player } : { npcs: overworld.npcs, player: overworld.player };
  };
  window.__cuilanNpcs = {
    list: () => activeNpcs().npcs.manager.list(),
    focus: () => activeNpcs().npcs.focus?.def.id ?? null,
    talk: async (id) => {
      const { npcs, player } = activeNpcs();
      const npc = npcs.manager.byId(id);
      if (!npc) return false;
      await npcs.talk(npc, player);
      return true;
    },
    tags: () => activeNpcs().npcs.tags.shown(),
  };
  const activeInteract = () => game.scenes.find<InteriorScene>('interior')?.interactions ?? overworld.interactions;
  window.__cuilanInteract = {
    focus: () => {
      const f = activeInteract().focus;
      return f ? { id: f.id, kind: f.kind, label: f.label } : null;
    },
    prompt: () => activeInteract().prompt.shown,
    use: async () => {
      const it = activeInteract();
      if (!it.focus?.run) return false;
      await it.execute(it.focus);
      return true;
    },
  };
  window.__cuilanMenu = {
    open: (tab) => {
      if (currentPauseMenu() || ui.busy) return false;
      const interior = game.scenes.find<InteriorScene>('interior');
      void (interior ? interior.openMenu(tab) : overworld.openMenu(tab));
      if (tab) currentPauseMenu()?.open(tab);
      return true;
    },
    state: () => {
      const m = currentPauseMenu();
      return m ? { tab: m.current?.id ?? 'close', inPage: m.inPage } : null;
    },
    close: () => currentPauseMenu()?.close(),
  };
  window.__cuilanStory = {
    director: story,
    running: () => story.running,
    history: () => [...story.history],
    dreaming: () => story.overlay.dreaming,
    card: () => story.overlay.lastCard,
    pickups: () => overworld.story.visible,
    beam: () => overworld.story.beamOn,
    lastTrigger: () => overworld.story.lastTrigger,
    run: (id) => story.run(id),
  };
  // 自动存档：任务节点 / 战斗结束 / 剧情结束 / 进出建筑 / 定时
  const autoSave = new AutoSave({
    game,
    state,
    canSave: () => overworld.canAutoSave && !story.running,
    save: () => overworld.save({ auto: true }),
  });
  game.afterUpdate.push((dt) => autoSave.update(dt));
  window.__cuilanSave = { slot: () => overworld.saveSlot, lastAuto: () => autoSave.lastReason, request: (r) => autoSave.request(r) };
  await loading.hide();
  platform.storage.setPref(LAST_SLOT_PREF, slot);
  // 新游戏立即建档（标题画面选择了档位；覆盖已二次确认）
  if (isNew && !skipTitle) await overworld.save({ silent: true });
  if (isNew && params.has('quick')) toaster.show('开发快捷方式：已发放测试伙伴木木枭与 10 个精灵球', 4000);
  else if (isNew) await story.run('dream-prelude');
}

boot().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText =
    'position:fixed;inset:0;margin:0;padding:24px;color:#ffb4b4;background:#1a0b10;font:13px/1.5 monospace;white-space:pre-wrap;z-index:99';
  pre.textContent = `启动失败：\n${err instanceof Error ? (err.stack ?? err.message) : String(err)}`;
  document.body.appendChild(pre);
});
