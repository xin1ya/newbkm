/**
 * 大地图场景（M0 原型）：整合地形 / 水面 / 植被流式加载 / 灰盒建筑 / 天空昼夜天气 / 玩家与镜头 /
 * 野生宝可梦刷新与可见遇敌 / 草丛暗雷 / 区域横幅 / 探索迷雾 / 快速存档，并作为战斗场景的宿主（BattleHost）。
 */
import { SceneMiniMap } from '@/scenes/common/SceneMiniMap';
import { BIKE_GEARS, bikeGear } from '@/systems/ride';
import { onBreederGain } from '@/systems/breeder';
import { HEART_SCALE, rollWildHeartScale } from '@/systems/tms';
import { IslandMap } from '@/scenes/common/IslandMap';
import { SceneFollower } from '@/scenes/common/SceneFollower';
import { TrainerBattles } from '@/scenes/common/TrainerBattles';
import { isTalking } from '@/scenes/common/npcTalk';
import { blackoutPenalty, contactEmote } from '@/systems/encounters';
import { applySettings, openPauseMenu } from '../common/pauseMenu';
import type { QuestContext } from '../common/QuestDirector';
import { polygonCentroid } from '@/systems/quests/runtime';
import type { MenuTab } from '@/ui/menu';
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { Scene } from '@/core/scene/SceneManager';
import { CameraRig } from '@/core/camera';
import { AssetLoader } from '@/core/assets';
import type { EncounterStartEvent } from '@/core/events/events';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import { createWild, grassEncounterCheck, rollEncounter, type FieldWeather, type TimeOfDay } from '@/systems/encounters';
import { healFully, createPokemon, displayName } from '@/systems/pokemon';
import { EXPLORE_CELL, addItem, ZONE_VISITED_PREFIX, markExplored, markExploredPolygon, serializeSave, summarize, type ExploreGrid, type GameState } from '@/systems/state';
import type { BlockerConfig, IslandConfig, PropsFile } from '@/config/islands';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import {
  AmbientLife,
  ChunkManager,
  CollisionWorld,
  EcologyMap,
  FoliageLibrary,
  GrayboxProps,
  LampLights,
  Sky,
  SpawnManager,
  Terrain,
  Water,
  WeatherState,
  ZoneMap,
  type SpawnContext,
  BarrierDome,
} from '@/world';
import { LAYER, PostChain, type QualitySettings } from '@/render';
import { PlayerController } from '@/actors/player';
import type { UiRoot, Transition, Toaster } from '@/ui/core';
import type { Hud } from '@/ui/hud';
import { InteriorScene } from '@/scenes/interior';
import { INTERIORS } from '@/config/interiors';
import { SceneNpcs } from '@/scenes/common/SceneNpcs';
import { attachTalkCamera } from '@/scenes/common/talkCamera';
import { SceneInteractions } from '@/scenes/common/SceneInteractions';
import { npcSource, overworldSources } from '@/scenes/common/interactSources';
import { say } from '@/ui/core';
import { SceneRide } from '@/scenes/common/SceneRide';
import { SceneBike } from '@/scenes/common/SceneBike';
import { SceneFly } from '@/scenes/common/SceneFly';
import { SceneAutoBattle } from '@/scenes/common/SceneAutoBattle';
import { SceneFishing } from '@/scenes/common/SceneFishing';
import { createNpcServices, type NpcServices } from '@/scenes/common/npcServices';
import { Footsteps } from '@/scenes/common/Footsteps';
import type { AudioContextInfo } from '@/scenes/common/AudioDirector';
import { sfx } from '@/core/audio';
import { SURF_MIN_DEPTH } from '@/systems/ride';
import { SceneStory } from '@/scenes/common/SceneStory';
import { SceneGather } from '@/scenes/common/SceneGather';
import { SceneFarm } from '@/scenes/common/SceneFarm';
import { SceneBlocks } from '@/scenes/common/SceneBlocks';
import { SceneAlpha } from '@/scenes/common/SceneAlpha';
import { makeRoaming } from '@/systems/alpha';
import { applyTravel, canUseLink, linkAt, TRAVEL_SLOT_KEY } from '@/systems/travel';
import { BLOCKER_ABILITY, CLEARABLE_BLOCKERS, blockerOpen } from '@/systems/interaction';
import type { IslandId } from '@/systems/state/GameState';
import { BattleScene, type BattleHost, type BattleResult, type BattleResultKind, type BattleStartData } from '@/scenes/battle';

export const SAVE_SLOT = 'slot1';
/** 最近使用的存档位（标题画面「继续游戏」） */
export const LAST_SLOT_PREF = 'cl.lastSlot';
/** 3 个存档位 */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
const WEATHER_ZH: Record<FieldWeather, string> = { clear: '晴', rain: '雨', fog: '雾', snow: '雪', storm: '雷雨', sandstorm: '沙暴', anomaly: '异象' };
const ENCOUNTER_COOLDOWN = 3;
const GRASS_THRESHOLD = 0.45;

export interface OverworldDeps {
  game: Game;
  ui: UiRoot;
  hud: Hud;
  toaster: Toaster;
  transition: Transition;
  dex: Dex;
  rng: Rng;
  state: GameState;
  island: IslandConfig;
  quality: QualitySettings;
  /** 当前存档位（标题画面选择；缺省 slot1） */
  slot?: string | undefined;
}

/** 城镇夜间补光色（路灯暖光漫射） */
const TOWN_NIGHT_TINT = new THREE.Color('#c9a8a0');
const TOWN_NIGHT_GROUND = new THREE.Color('#5a4636');

export class OverworldScene implements Scene, BattleHost {
  readonly name = 'overworld';
  readonly world = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly collision = new CollisionWorld();
  readonly weather: WeatherState;
  rig!: CameraRig;
  player!: PlayerController;
  terrain!: Terrain;
  private water!: Water;
  private foliage!: FoliageLibrary;
  private life!: AmbientLife;
  private chunks!: ChunkManager;
  private props!: GrayboxProps;
  /** 夜晚路灯真实光源 + 地面光斑 */
  private lamps!: LampLights;
  private sky!: Sky;
  private zones!: ZoneMap;
  private readonly revealedTowns = new Set<string>();
  private spawns!: SpawnManager;
  /** 头目（巢穴钩子 / 石冢 / 战后结算） */
  private alpha!: SceneAlpha;
  private post!: PostChain;
  private exploreGrid!: ExploreGrid;
  private currentZone: string | null = null;
  private time = 0;
  /** M2-14 剧情封锁特效（结界 / 热浪） */
  private barriers: { dome: BarrierDome; flag: string }[] = [];
  private encounterCooldown = 0;
  private inBattle = false;
  private paused = false;
  /** M2-01 岛间旅行进行中（等待存档 / 重新加载） */
  private traveling = false;
  private linkHintAt = -99;
  private windDir = new THREE.Vector2(0.8, 0.6).normalize();
  private pushers: Array<{ x: number; y: number; z: number; r: number }> = [];
  private spawnCtx: SpawnContext = { time: 'day', weather: 'clear', playerX: 0, playerY: 0, playerZ: 0, playerRunning: false, playerInGrass: false, active: true };
  private unsub: Array<() => void> = [];
  private debugTimer = 0;
  private lastExploreCell = '';
  /** M1-06 NPC */
  npcs!: SceneNpcs;
  /** M1-07 互动提示与执行 */
  interactions!: SceneInteractions;
  /** M1-08 跟随宝可梦 */
  follower!: SceneFollower;
  /** M1-10 训练家视线 / 对战 */
  trainers!: TrainerBattles;
  /** M1-12 骑乘（水上） */
  ride!: SceneRide;
  /** 自行车（萌芽镇友好商店购买） */
  bike!: SceneBike;
  fly!: SceneFly;
  auto!: SceneAutoBattle;
  /** M1-15 钓鱼 */
  fishing!: SceneFishing;
  /** M1-13/14 剧情拾取物 / 抵达触发 / 剧情宿主 */
  story!: SceneStory;
  /** 计划文档 §9.2 野外采集 */
  gather!: SceneGather;
  /** 计划文档 §9.3 种植 */
  farm!: SceneFarm;
  /** 计划文档 §9.5 能量方块：诱饵 + 安抚头目 */
  blocks!: SceneBlocks;
  private offBreeder: (() => void) | null = null;
  /** HUD 小地图 + 自定义标点导航 */
  minimap!: SceneMiniMap;
  /** M1-19 回复 / 商店 / 赠礼 */
  services!: NpcServices;
  /** M1-20 脚步声（按地表） */
  footsteps = new Footsteps((x, z, pl) => {
    const hf = this.terrain.hf;
    if ((hf.waterAt(x, z)?.depth ?? 0) > 0.05) return 'step-water';
    if (pl.position.y > this.terrain.heightAt(x, z) + 0.15) return 'step-wood';
    const soft = hf.surfaceWeight(x, z, 'grass') + hf.surfaceWeight(x, z, 'tallgrass') + hf.surfaceWeight(x, z, 'flowers') + hf.surfaceWeight(x, z, 'forest');
    return soft > 0.5 ? 'step-grass' : 'step-ground';
  });
  /** M1-09 接触后的停顿演出（「!」表情 → 0.55 s 后进入战斗） */
  private pendingEncounter: { e: EncounterStartEvent; t: number } | null = null;

  constructor(private readonly d: OverworldDeps) {
    this.camera = new THREE.PerspectiveCamera(55, d.game.width / d.game.height, 0.1, d.quality.farPlane);
    for (const l of [LAYER.TERRAIN, LAYER.CHARACTERS, LAYER.FX]) this.camera.layers.enable(l);
    this.weather = new WeatherState(() => d.rng.next());
  }

  // BattleHost 需要的只读成员
  get events() {
    return this.d.game.events;
  }
  get ui(): UiRoot {
    return this.d.ui;
  }
  get transition(): Transition {
    return this.d.transition;
  }
  get input() {
    return this.d.game.input;
  }
  get dex(): Dex {
    return this.d.dex;
  }
  get rng(): Rng {
    return this.d.rng;
  }
  get state(): GameState {
    return this.d.state;
  }

  /** 加载整座岛（进度 0–1） */
  async load(progress: (ratio: number, msg: string) => void): Promise<void> {
    const { game, island, quality } = this.d;
    const loader = new AssetLoader(game.platform.assets, game.renderer);
    progress(0.05, '读取高度图……');
    this.terrain = await Terrain.load(island, loader);
    progress(0.35, '放置建筑与道具……');
    const propsFile = await game.platform.assets.fetchJson<PropsFile>(island.props);
    this.props = new GrayboxProps(this.terrain.hf, this.collision, propsFile);
    // 已清除的能力阻挡（读档）
    for (const b of island.blockers) if (CLEARABLE_BLOCKERS.has(b.type) && blockerOpen(b, (f) => this.d.state.flags[f] === true)) this.props.clearBlocker(b.id);
    for (const b of island.blockers) {
      if (!b.fx || this.d.state.flags[b.requiresFlag] === true) continue;
      const y = this.terrain.hf.heightAt(b.position[0], b.position[2]);
      const dome = new BarrierDome(b.fx, new THREE.Vector3(b.position[0], y - 0.3, b.position[2]), (b.radius ?? 4) + 1);
      this.barriers.push({ dome, flag: b.requiresFlag });
    }
    this.lamps = new LampLights(this.props.lampPositions, {
      pool: quality.tier === 'high' ? 12 : quality.tier === 'medium' ? 8 : 4,
      groundAt: (x, z, maxY) => {
        const top = this.collision.walkableTopAt(x, z, maxY);
        return Number.isFinite(top) ? top : this.terrain.hf.heightAt(x, z);
      },
    });
    progress(0.5, '生成水面与天空……');
    this.water = new Water(this.terrain.hf, quality.water === 'full');
    this.sky = new Sky(quality);
    this.foliage = new FoliageLibrary(quality);
    // 生态自然化：分区决定树种 / 林下植物 / 环境生物
    this.foliage.ecology = new EcologyMap(island, this.terrain.hf);
    this.life = new AmbientLife(this.terrain.hf, this.foliage.ecology);
    this.chunks = new ChunkManager(this.terrain, this.foliage, this.collision, quality);
    // 性能 P1：树木远景替身图集（一次性烘焙）
    this.foliage.bakeImpostors(game.renderer);
    // 性能 P1：地平线遮挡剔除用相机位置；城镇建筑合并块也参与剔除
    this.chunks.camera = this.camera.position;
    for (const o of this.props.group.children) {
      const m = o as THREE.Mesh;
      if (!m.isMesh) continue;
      m.geometry.computeBoundingBox();
      this.chunks.extraCull.push({ box: m.geometry.boundingBox!.clone(), objects: [m] });
    }
    this.zones = new ZoneMap(island);
    this.spawns = new SpawnManager(this.d.dex, ENCOUNTER_TABLES, this.terrain, this.zones, this.collision, game.events, this.d.rng);
    this.spawns.maxWild = quality.maxWild;
    this.alpha = new SceneAlpha({
      game,
      dex: this.d.dex,
      rng: this.d.rng,
      state: this.d.state,
      island,
      spawns: this.spawns,
      hf: this.terrain.hf,
      toast: (t, ms) => this.d.toaster.show(t, ms),
    });
    this.player = new PlayerController(this.terrain, this.collision, island.blockers, game.events);
    this.player.flags = (f) => this.d.state.flags[f] === true;
    this.rig = new CameraRig(this.camera, {
      // 遮挡射线从镜头注视点（胸口偏上，CameraRig.pivotHeight）发出
      occlusion: (target, to) => {
        const from = target.clone();
        const t = this.collision.segmentHit(from.x, from.z, from.y, to.x, to.z, to.y);
        const dir = to.clone().sub(from);
        const len = dir.length();
        const hit = this.terrain.raycast(from, dir.normalize(), len);
        const ht = hit ? hit.distanceTo(from) / len : 1;
        return Math.min(t, ht * len < 0.3 ? 1 : ht);
      },
      groundAt: (x, z) => this.terrain.heightAt(x, z),
    });
    // M1-18 读档后的设置（灵敏度 / 反转 / 镜头模式 / 文字速度）
    applySettings(this.d.state.settings, this.rig, this.d.game);
    this.exploreGrid = { size: island.size };
    this.npcs = new SceneNpcs({
      game,
      ui: this.d.ui,
      state: this.d.state,
      ground: this.terrain,
      collision: this.collision,
      parent: this.world,
      place: { kind: 'island', island: island.id },
      toast: (t) => this.d.toaster.show(t),
      services: (this.services = createNpcServices({ game, ui: this.d.ui, state: this.d.state, dex: this.d.dex, toast: (t) => this.d.toaster.show(t) })),
    });
    this.interactions = new SceneInteractions({ game, ui: this.d.ui, state: this.d.state, dex: this.d.dex, transition: this.d.transition, toast: (t) => this.d.toaster.show(t) });
    this.interactions.addSource(npcSource(this.npcs));
    this.follower = new SceneFollower({
      game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      parent: this.world,
      player: this.player,
      // 栈桥 / 码头 / 道馆平台：跟随者与玩家一样站在可走顶面上（以玩家高度为参考，免得钻到桥下）
      ground: {
        heightAt: (x, z) => Math.max(this.terrain.heightAt(x, z), this.followerDeck(x, z)),
        waterDepth: (x, z) => {
          const w = this.terrain.hf.waterAt(x, z);
          if (!w) return 0;
          return this.followerDeck(x, z) >= w.level - 0.3 ? 0 : w.depth;
        },
      },
      zoneKind: () => (this.currentZone ? (this.zones.get(this.currentZone)?.kind ?? null) : null),
      weather: () => this.weather.current,
    });
    this.interactions.addSource(this.follower.source());
    this.trainers = new TrainerBattles({
      game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      npcs: this.npcs,
      player: this.player,
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      canSpot: () => !this.fly?.flying && !this.inBattle && !this.paused && !this.enteringDoor && !this.d.ui.busy && !this.interactions.busy && !this.pendingEncounter && !isTalking(),
      startBattle: (data) => this.startTrainerBattle(data),
    });
    for (const src of overworldSources(this.interactions, {
      island,
      ground: this.terrain,
      flag: (f) => this.d.state.flags[f] === true,
      bag: () => this.d.state.bag,
      doorOf: (poi) => this.doorOf(poi),
      enter: (interior, poiId) => this.enterInterior(interior, poiId),
      say: (pages) => say(this.d.ui, pages),
      toast: (t) => this.d.toaster.show(t),
      fish: () => {
        this.bike.dismount(true);
        return this.fishing.start();
      },
      surf: async (hit) => {
        this.bike.dismount(true);
        await this.ride.start(hit);
      },
      surfing: () => this.ride.surfing,
      clearBlocker: (b) => this.clearBlocker(b),
    }))
      this.interactions.addSource(src);

    const w = this.world;
    w.fog = this.sky.fog;
    w.add(this.sky.group, this.terrain.farMesh, this.chunks.group, this.life.group, this.water.group, this.props.group, this.lamps.group, this.spawns.group, this.alpha.group, this.player.root);
    for (const br of this.barriers) w.add(br.dome.group);
    this.minimap = new SceneMiniMap({ ui: this.d.ui, hud: this.d.hud, state: this.d.state, island: this.d.island, hf: this.terrain.hf, toast: (t) => this.d.toaster.show(t) });
    this.minimap.attach(w);

    const waterAt = (x: number, z: number) => this.terrain.hf.waterAt(x, z);
    const busyNow = () => this.inBattle || this.paused || this.enteringDoor || this.d.ui.busy || this.interactions.busy || !!this.pendingEncounter || isTalking();
    this.bike = new SceneBike({ game, state: this.d.state, player: this.player, toast: (t) => this.d.toaster.show(t) });
    this.fly = new SceneFly({
      game,
      state: this.d.state,
      dex: this.d.dex,
      player: this.player,
      toast: (t) => this.d.toaster.show(t),
      canAct: () => !busyNow() && !this.fishing.active && !this.enteringDoor,
      beforeTakeoff: () => this.bike.dismount(true),
      surfing: () => this.ride.surfing,
    });
    this.auto = new SceneAutoBattle({
      game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      player: this.player,
      spawns: this.spawns,
      zones: this.zones,
      tableOf: (z) => (z.encounterTable ? ENCOUNTER_TABLES[z.encounterTable] : undefined),
      inBounds: (x, z) => this.terrain.hf.inBounds(x, z),
      walkable: (x, z) => {
        const hf = this.terrain.hf;
        const w = hf.waterAt(x, z);
        return (!w || w.depth < 0.5) && hf.slopeAt(x, z) < 34;
      },
      toast: (t) => this.d.toaster.show(t),
      idle: () => !busyNow() && !this.fishing.active && !this.enteringDoor && !this.inBattle,
      blocked: () => (this.fly.flying ? '飞行中不能自动战斗' : this.ride.surfing ? '冲浪中不能自动战斗' : this.fishing.active ? '钓鱼中' : null),
      mountBike: () => this.bike.owned && this.bike.mount(),
      healTrip: () => this.autoHealTrip(),
    });
    this.ride = new SceneRide({
      game,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      player: this.player,
      parent: this.world,
      ground: { heightAt: (x, z) => this.terrain.heightAt(x, z), waterAt },
      toast: (t) => this.d.toaster.show(t),
      surfTableAt: (x, z) => {
        const zone = this.zones.at(x, z);
        const table = zone?.encounterTable ? ENCOUNTER_TABLES[zone.encounterTable] : undefined;
        if (!zone || !table || !table.entries.some((e) => e.methods?.includes('surf'))) return null;
        return { table, zoneId: zone.id };
      },
      time: () => this.timeOfDay(),
      weather: () => this.weather.current,
      canAct: () => !busyNow() && !this.fishing.active,
      canEncounter: () => !busyNow() && this.encounterCooldown <= 0,
    });
    this.fishing = new SceneFishing({
      game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      player: this.player,
      parent: this.world,
      ground: { heightAt: (x, z) => this.terrain.heightAt(x, z), waterAt },
      zoneAt: (x, z) => this.zones.at(x, z)?.id ?? null,
      time: () => this.timeOfDay(),
      toast: (t) => this.d.toaster.show(t),
    });

    this.story = new SceneStory({
      island: island.id,
      parent: this.world,
      player: this.player,
      flags: () => this.d.state.flags,
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      waterLevelAt: (x, z) => this.terrain.hf.waterAt(x, z)?.level ?? null,
      zoneAt: (x, z) => this.zones.at(x, z)?.id ?? null,
      busy: () => busyNow() || this.fishing.active || this.d.game.scenes.top !== this,
      night: () => this.timeOfDay() === 'night',
      battle: (o) => this.storyBattle(o),
      teleport: (x, z, yaw) => this.storyTeleport(x, z, yaw),
      travel: (to, x, z, yaw) => this.travelTo(to, x, z, yaw),
      clearFog: () => {
        this.weather.current = 'clear';
        this.weather.until = this.d.game.clock.totalMinutes + 180;
      },
    });
    this.interactions.addSource(this.story.source());

    // 野外采集点（碰撞体在地块植被生成之前登记，植被会自动避让）
    this.gather = new SceneGather({
      island: island.id,
      parent: this.world,
      player: this.player,
      collision: this.collision,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      minutes: () => this.d.game.clock.totalMinutes,
      weather: () => this.weather.current,
      follower: () => {
        const f = this.follower.follower;
        return f && !f.inBall && !f.borrowed ? { speciesId: f.speciesId, emote: (t) => f.emote.show(t, 1.2) } : null;
      },
      toast: (t, ms) => this.d.toaster.show(t, ms),
      encounter: (wild, at) => {
        const p = this.player.position;
        this.d.game.events.post('encounter:start', { wild, position: { x: p.x, y: p.y, z: p.z }, wildPosition: at, initiative: null, entityId: -1, zoneId: this.zones.at(at.x, at.z)?.id ?? '', alpha: false, method: 'grass' });
      },
      busy: () => busyNow() || this.d.game.scenes.top !== this,
    });
    this.interactions.addSource(this.gather.source());

    this.farm = new SceneFarm({
      island: island.id,
      parent: this.world,
      player: this.player,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      rng: this.d.rng,
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      minutes: () => this.d.game.clock.totalMinutes,
      weather: () => this.weather.current,
      follower: () => {
        const f = this.follower.follower;
        return f && !f.inBall && !f.borrowed ? { speciesId: f.speciesId, emote: (t) => f.emote.show(t, 1.2) } : null;
      },
      toast: (t, ms) => this.d.toaster.show(t, ms),
    });
    this.interactions.addSource(this.farm.source());

    this.blocks = new SceneBlocks({
      island: island.id,
      parent: this.world,
      player: this.player,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      wild: () => this.spawns.wild.values(),
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      minutes: () => this.d.game.clock.totalMinutes,
      lureBlocked: () =>
        this.d.game.scenes.find<InteriorScene>('interior') ? '室内不能放置诱饵。' : this.ride.surfing ? '在水上不能放置诱饵。' : this.bike.riding ? '先从自行车上下来吧。' : null,
      toast: (t, ms) => this.d.toaster.show(t, ms),
    });
    this.interactions.addSource(this.blocks.source());
    // 计划文档 §9.4：培育家升级提示
    this.offBreeder = onBreederGain((g) => {
      if (g.to > g.from && g.from > 0) {
        sfx('shiny', 0.6);
        this.d.toaster.show(`培育家升到了 ${g.to} 级！\n${g.rewards.join('\n')}`, 5000);
      } else if (g.rewards.length) this.d.toaster.show(g.rewards.join('\n'), 4000);
    });

    progress(0.65, '加载周围地块……');
    const [px, , pz] = this.d.state.position.xyz;
    this.player.teleport(px, pz, this.d.state.position.yaw);
    this.chunks.loadAround(px, pz);
    this.restoreOnWater();
    this.npcs.sync(this.player.position);
    this.follower.warp();
    progress(0.9, '准备渲染管线……');
    this.post = new PostChain(game.renderer, w, this.camera);
    this.post.applyQuality(quality);
    this.post.setSize(game.width, game.height);
    this.rig.target.copy(this.player.position);
    this.rig.resetBehind(this.player.facing);
    this.rig.snap();
    this.rig.update(0, null);
    progress(1, '完成');
  }

  enter(): void {
    const { game, hud } = this.d;
    this.unsub.push(
      game.events.on('encounter:start', (e) => this.onEncounter(e)),
      game.events.on('blocker:hit', (e) => this.d.toaster.show(e.hint)),
      game.events.on('ui:toast', (e) => this.d.toaster.show(e.text, e.ms)),
      // M1-09 复活点：在室内（宝可梦中心 / 家）回复时记录该建筑门口
      game.events.on('party:healed', () => this.recordRespawn()),
      // 剧情引导：对话时切到过肩镜头
      attachTalkCamera({
        game,
        rig: this.rig,
        npcHead: (id, out) => this.npcs.manager.npcs.get(id)?.headPosition(out) ?? null,
        player: () => this.player.position,
        enabled: () => this.rig.mode === 'third' && !this.inBattle,
      }),
    );
    hud.setVisible(true);
    this.updateZone(true);
  }

  exit(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  pause(): void {
    this.paused = true;
    this.npcs.hide();
    this.interactions.prompt.hide();
  }
  resume(): void {
    this.paused = false;
    // 从室内 / 战斗回来：常驻地名恢复为当前区域（不重复弹横幅）
    const z = this.currentZone ? this.zones.get(this.currentZone) : undefined;
    this.d.hud.setLocation(z ? `${this.d.island.name} · ${z.name}` : this.d.island.name);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  }

  // ———————————————————— 帧更新 ————————————————————

  private get gameplayInput() {
    return this.d.ui.busy || this.inBattle || this.trainers?.busy || this.pendingEncounter || this.gather?.busy || this.farm?.busy || this.blocks?.busy ? null : this.d.game.input;
  }

  fixedUpdate(dt: number): void {
    const input = this.gameplayInput;
    this.player.runToggle = this.d.state.settings.runMode !== 'hold';
    const wasRunning = this.player.runLatched;
    {
      const ax = input ? input.moveAxis() : { x: 0, y: 0 };
      if (input?.pressed('autoBattle') && !this.inBattle && !this.fishing.active && !this.enteringDoor) this.auto.onKey();
      // 自动战斗接管移动（玩家按移动键 → 停止）
      const driven = this.auto.fixedUpdate(dt, !!input && (ax.x !== 0 || ax.y !== 0));
      if (!driven) this.player.fixedUpdate(dt, this.fishing.active ? null : input, this.rig.forwardYaw);
    }
    if (this.player.runToggle && wasRunning !== this.player.runLatched) this.d.game.events.emit('ui:toast', { text: this.player.runLatched ? '奔跑：开' : '奔跑：关', ms: 900 });
    // 骑乘键：上水走互动提示（面朝水面时），这里只处理水上的下水 / 登岸
    const ridePressed = !!input && input.pressed('ride');
    const rideKey = ridePressed && this.ride.surfing;
    // 陆地上的 C：面朝水面（水上骑乘互动）时交给互动系统，否则上 / 下自行车
    if (ridePressed && !this.fly.flying && !this.ride.surfing && !this.ride.busy && !this.fishing.active && !this.interactions.busy && !this.enteringDoor) {
      const f = this.interactions.focus;
      const waterRide = f?.action === 'ride' || f?.secondary?.action === 'ride';
      if (!waterRide || this.bike.riding) this.bike.toggle();
    }
    const axis = input ? input.moveAxis() : { x: 0, y: 0 };
    this.ride.fixedUpdate(dt, rideKey, Math.hypot(axis.x, axis.y) > 0.2);
    this.fly.fixedUpdate(dt, !!input && input.pressed('fly'));
    this.footsteps.fixedUpdate(this.player);
    const p = this.player.position;
    const inGrass = !this.ride.surfing && !this.fly.flying && this.terrain.hf.surfaceWeight(p.x, p.z, 'tallgrass') > GRASS_THRESHOLD;
    const ctx = this.spawnCtx;
    ctx.time = this.timeOfDay();
    ctx.weather = this.weather.current;
    ctx.playerX = p.x;
    ctx.playerY = p.y;
    ctx.playerZ = p.z;
    ctx.playerRunning = this.player.running;
    ctx.playerInGrass = inGrass;
    ctx.lure = this.blocks.lureAt(p.x, p.z);
    ctx.active = !this.inBattle && !this.d.ui.busy && this.encounterCooldown <= 0 && !this.fly.flying;
    this.spawns.fixedUpdate(dt, ctx);
    if (this.encounterCooldown > 0) this.encounterCooldown -= dt;
    else if (ctx.active && inGrass && this.player.movedThisStep > 0) this.grassCheck(this.player.movedThisStep);
  }

  /** 草丛暗雷（保留经典玩法，§5.1）：按移动距离掷骰 */
  private grassCheck(dist: number): void {
    const zone = this.zones.at(this.player.position.x, this.player.position.z);
    const table = zone?.encounterTable ? ENCOUNTER_TABLES[zone.encounterTable] : undefined;
    if (!zone || !table) return;
    if (!grassEncounterCheck(table, dist, this.d.rng)) return;
    const enc = rollEncounter(table, { time: this.timeOfDay(), weather: this.weather.current, method: 'grass', lure: this.blocks.lureAt(this.player.position.x, this.player.position.z) }, this.d.rng, this.d.dex);
    if (!enc) return;
    const base = createWild(this.d.dex, enc, this.d.rng, { island: this.d.island.id, zone: zone.id, level: enc.level });
    // 草丛里撞上的游荡头目：等级 = 区域上限 + 4
    const wild = enc.alpha ? makeRoaming(this.d.dex, base, zone.levelRange?.[1] ?? base.level, this.d.rng) : base;
    const p = this.player.position;
    const f = this.player.facing;
    const wp = { x: p.x + Math.sin(f) * 8.8, y: p.y, z: p.z + Math.cos(f) * 8.8 };
    this.d.game.events.post('encounter:start', { wild, position: { x: p.x, y: p.y, z: p.z }, wildPosition: wp, initiative: null, entityId: -1, zoneId: zone.id, alpha: !!wild.alpha, method: 'grass' });
  }

  update(dt: number): void {
    if (this.paused) return;
    const { game, hud } = this.d;
    const input = game.input;
    this.time += dt;
    this.d.state.playTime += dt;
    if (!this.d.ui.busy) {
      if (input.pressed('menu') && !this.inBattle && !this.fishing.active && !this.enteringDoor && !this.interactions.busy) void this.openMenu();
      else if (input.pressed('questLog') && !this.inBattle && !this.fishing.active && !this.enteringDoor && !this.interactions.busy) void this.openMenu('quests');
      else if (input.pressed('map') && !this.inBattle && !this.fishing.active && !this.enteringDoor && !this.interactions.busy) void IslandMap.current?.open();
      if (input.pressed('toggleView')) {
        this.rig.toggleMode(input);
        this.d.state.settings.cameraMode = this.rig.mode;
      }
      if (input.pressed('camReset')) this.rig.resetBehind(this.player.facing);
      if (input.pressed('debug')) hud.toggleDebug();
      if (input.pressed('quicksave')) void this.save();
    }
    this.terrain.tick(this.time);
    this.bike.update(dt);
    this.player.update(dt);
    this.ride.update(dt);
    this.fly.update(dt);
    this.fishing.update(dt);
    if (!this.inBattle || this.trainers.busy) this.npcs.update(dt, this.time, this.player, this.camera);
    this.follower.update(dt, this.inBattle || this.d.ui.busy || this.trainers.busy || !!this.pendingEncounter);
    this.trainers.update(dt);
    this.story.update(dt);
    this.gather.update(dt);
    this.farm.update(dt);
    this.blocks.update(dt);
    this.updateEncounterBeat(dt);
    // 互动（NPC / 门 / 地标 / 封锁点 / 水边）统一由 SceneInteractions 选焦点并执行；门另外保留“走进去自动进入”
    this.interactions.update(dt, this.player, this.camera, !this.inBattle && !this.enteringDoor);
    if (!this.d.ui.busy && !this.interactions.busy) this.checkDoors(false);
    // 镜头在 render(alpha) 里跟随插值后的角色位置（M1 体验修正：第三人称抖动）
    this.animateWorld(dt);
    this.updateZone(false);
    this.syncState();
    this.checkIslandLink();
    this.updateHud(dt);
  }

  /** M2-01 海域走廊尽头：冲浪 / 已到访岛屿的飞行可以前往下一座岛，否则挡回 */
  /** M2-10/11/13 场地能力清除阻挡：宝可梦登场 → 阻挡物缩小消失 → 记 cleared 标记 */
  private async clearBlocker(b: BlockerConfig): Promise<void> {
    const lead = this.d.state.party.find((m) => m.hp > 0);
    const ability = BLOCKER_ABILITY[b.type] ?? '能力';
    const who = lead ? displayName(this.d.dex, lead) : '宝可梦';
    await say(this.d.ui, [`${who} 使用了「${ability}」！`]);
    sfx(b.type === 'vines' ? 'hit' : b.type === 'strength' ? 'bump' : 'hit-strong');
    const meshes = this.props.blockerObjects(b.id);
    const t0 = performance.now();
    const fx = Math.sin(this.player.facing);
    const fz = Math.cos(this.player.facing);
    // 0.6 s：藤蔓下沉枯萎 / 岩石碎裂下沉 / 巨石沿玩家朝向滚开
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 600);
        for (const m of meshes) {
          if (b.type === 'strength') m.position.set(fx * k * 3, 0, fz * k * 3);
          else m.position.y = -k * (b.type === 'vines' ? 4 : 2.5);
        }
        if (k >= 1) resolve();
        else requestAnimationFrame(step);
      };
      step();
    });
    this.d.state.flags[`cleared:${b.id}`] = true;
    this.props.clearBlocker(b.id);
    this.d.game.events.emit('blocker:cleared', { id: b.id, type: b.type });
  }

  private checkIslandLink(): void {
    if (this.traveling || this.inBattle || this.d.ui.busy) return;
    const p = this.player.position;
    const link = linkAt(this.d.island.id, p.x, p.z);
    if (!link) return;
    const v = canUseLink(this.d.state, link, this.player.mode);
    if (v.ok) {
      const a = link.arrive(p.x, p.z);
      void this.travelTo(link.to, a.x, a.z, a.yaw);
      return;
    }
    // 首次跨海由剧情触发器（同一矩形）放行，这里不挡
    if (v.reason === 'locked' || v.reason === 'on-foot') return;
    this.player.nudge(link.pushBack[0] * 2.5, link.pushBack[1] * 2.5);
    if (v.hint && this.time - this.linkHintAt > 4) {
      this.linkHintAt = this.time;
      this.d.toaster.show(v.hint);
    }
  }

  /** M2-01 前往另一座岛：写入目的地 → 存档 → 重新加载（场景按 state.position.island 重建） */
  async travelTo(to: IslandId, x: number, z: number, yaw: number): Promise<void> {
    if (this.traveling) return;
    this.traveling = true;
    this.d.game.events.emit('island:travel', { from: this.d.island.id, to });
    await this.d.transition.fadeOut(700);
    applyTravel(this.d.state, to, x, z, yaw);
    await this.save({ silent: true });
    try {
      sessionStorage.setItem(TRAVEL_SLOT_KEY, this.saveSlot);
    } catch {
      // 隐私模式下 sessionStorage 不可用：退回标题画面，玩家手动「继续」
    }
    location.reload();
  }

  /** 战斗中推进 NPC（对方训练家走到站位、登场动作） */
  animateActors(dt: number): void {
    this.time += dt;
    this.npcs.manager.update(dt, this.time);
  }

  /** 环境动画（大地图与战斗共用） */
  animateWorld(dt: number): void {
    const p = this.player.position;
    const hour = this.d.game.clock.hour;
    const zone = this.currentZone ? this.zones.get(this.currentZone) : undefined;
    if (this.weather.update(dt, this.d.game.clock.totalMinutes, this.currentZone, zone?.weather, this.timeOfDay() === 'night')) {
      this.d.game.events.emit('weather:change', { weather: this.weather.current, zoneId: this.currentZone });
    }
    const vis = this.weather.visual;
    const sky = this.sky.update(dt, hour, p, this.camera.position, vis, this.windDir);
    this.water.update(this.time);
    for (const br of this.barriers) {
      if (!br.dome.done && this.d.state.flags[br.flag] === true) br.dome.dissolve();
      br.dome.update(dt, this.time);
    }
    this.water.setLighting(sky.sunDir, sky.sunColor, sky.ambient, vis.rain);
    this.props.setNight(sky.night);
    this.lamps.update(dt, p, sky.night);
    // 性能 P1 · Bloom 按需：夜晚（路灯 / 窗户 / 发光蘑菇）、附近有头目（火星粒子）时才开启
    if (sky.night > 0.25 || this.lamps.townGlow > 0.01 || this.alpha.glowNear) this.post.requestBloom(0.5);
    // 城镇夜间补光：附近路灯越密，半球光越亮、越暖（不影响野外的夜色）
    if (this.lamps.townGlow > 0.01) {
      const g = this.lamps.townGlow;
      this.sky.hemi.intensity += g * 0.55;
      this.sky.hemi.color.lerp(TOWN_NIGHT_TINT, g * 0.35);
      this.sky.hemi.groundColor.lerp(TOWN_NIGHT_GROUND, g * 0.45);
    }
    // 阵风：两个不相关的慢正弦相乘，偶尔叠加出一阵强风（草木一起压弯再回弹）
    const t = this.time;
    const gust = Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.53 + 1.7)) ** 2 * (0.45 + vis.wind * 0.6);
    const windStrength = 0.35 + vis.wind + gust;
    this.foliage.setWind(this.windDir.x, this.windDir.y, windStrength);
    this.life.update(dt, this.time, p, {
      night: sky.night,
      rain: vis.rain,
      light: Math.min(1, sky.ambient.r + sky.ambient.g + sky.ambient.b + (1 - sky.night) * 0.6),
      windX: this.windDir.x,
      windZ: this.windDir.y,
      wind: windStrength,
      sunDir: sky.sunDir,
    });
    this.pushers.length = 0;
    this.pushers.push({ x: p.x, y: p.y, z: p.z, r: 0.7 });
    this.spawns.pushers(5, this.pushers);
    this.foliage.update(this.time, this.pushers);
    for (const wm of this.spawns.wild.values()) if (wm.frozen) wm.animate(dt, 0, this.time);
    this.alpha.update(this.time, p.x, p.z);
    this.chunks.update(p.x, p.z);
  }

  render(alpha: number, dt: number): void {
    this.player.interpolate(alpha);
    this.rig.target.copy(this.player.renderPosition);
    this.rig.setFollow(this.player.facing, Math.hypot(this.player.velocity.x, this.player.velocity.z));
    this.rig.update(dt, this.gameplayInput);
    // 第一人称隐藏自己的模型（坐骑保留，骑乘时能看到坐骑）
    this.player.model.root.visible = this.rig.mode !== 'first' || this.rig.overridden;
    this.updateShadowMap();
    this.post.render(dt);
  }

  /**
   * 性能 P0 · 阴影按需更新：阴影贴图隔帧重画（≥ 90 fps 时隔 2 帧），镜头 / 玩家瞬移时立即重画。
   * 太阳方向变化很慢，角色移动在 40–60 Hz 的阴影更新下肉眼无差别，阴影 pass 开销减半以上。
   */
  private shadowTick = 0;
  private readonly lastShadowAt = new THREE.Vector3();
  private updateShadowMap(): void {
    const sm = this.d.game.renderer.shadowMap;
    sm.autoUpdate = false;
    const fps = this.d.game.loop.stats.fps;
    const every = fps > 90 ? 3 : fps > 50 ? 2 : 1;
    const p = this.player.renderPosition;
    const jumped = this.lastShadowAt.distanceToSquared(p) > 9;
    if (jumped || ++this.shadowTick >= every) {
      this.shadowTick = 0;
      sm.needsUpdate = true;
      this.lastShadowAt.copy(p);
    }
  }

  /** 战斗场景驱动的绘制：镜头由战斗自己更新，这里只做角色插值 */
  renderWorld(alpha: number, dt: number): void {
    this.player.interpolate(alpha);
    this.d.game.renderer.shadowMap.needsUpdate = true;
    // 战斗特效（属性光效、闪光）需要 bloom
    this.post.requestBloom(0.5);
    this.post.render(dt);
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  timeOfDay(): TimeOfDay {
    return this.d.game.clock.timeOfDay;
  }

  fieldWeather(): FieldWeather {
    return this.weather.current;
  }

  // ———————————————————— 区域 / HUD / 存档 ————————————————————

  private updateZone(force: boolean): void {
    const p = this.player.position;
    const z = this.zones.at(p.x, p.z);
    const id = z?.id ?? null;
    if (id === this.currentZone && !force) return;
    const prev = this.currentZone;
    this.currentZone = id;
    this.d.hud.setLocation(z ? `${this.d.island.name} · ${z.name}` : this.d.island.name);
    if (z) {
      // 记为到访（直接写，不发 flag:set，避免频繁触发任务判定）
      this.d.state.flags[`${ZONE_VISITED_PREFIX}${z.id}`] = true;
      const sub = z.levelRange ? `Lv.${z.levelRange[0]}–${z.levelRange[1]}` : this.d.island.name;
      this.d.hud.showZone(z.name, sub);
      this.d.game.events.emit('zone:enter', { zoneId: z.id, name: z.name, previous: prev });
    }
  }

  private syncState(): void {
    const s = this.d.state;
    const p = this.player.position;
    s.position.xyz = [p.x, p.y, p.z];
    s.position.yaw = this.player.facing;
    s.clockMinutes = Math.floor(this.d.game.clock.totalMinutes % 1440);
    s.day = this.d.game.clock.day;
    // 探索迷雾：只在进入新格子时写入（markExplored 需要编解码位图）
    const cell = `${Math.floor(p.x / EXPLORE_CELL)},${Math.floor(p.z / EXPLORE_CELL)}`;
    if (cell !== this.lastExploreCell) {
      this.lastExploreCell = cell;
      markExplored(s, this.d.island.id, this.exploreGrid, p.x, p.z, 24);
      // 进入城镇：整片揭开（每个城镇只需一次）
      const zone = this.zones.at(p.x, p.z);
      if (zone?.kind === 'town' && !this.revealedTowns.has(zone.id)) {
        this.revealedTowns.add(zone.id);
        markExploredPolygon(s, this.d.island.id, this.exploreGrid, zone.polygon);
      }
    }
  }

  private updateHud(dt: number): void {
    const { hud, game } = this.d;
    hud.setClock(game.clock.format(), WEATHER_ZH[this.weather.current]);
    {
      const p = this.player.position;
      const z = this.zoneAt(p.x, p.z);
      this.minimap.update(dt, { x: p.x, z: p.z, facing: this.player.facing }, this.rig.forwardYaw, z ? z.name : this.d.island.name);
    }
    if (this.bike.riding) {
      const g = bikeGear(this.player.bikeGear);
      hud.setBike({ gear: g.gear, gears: BIKE_GEARS.length, name: g.name, speed: Math.hypot(this.player.velocity.x, this.player.velocity.z), top: g.top });
    } else hud.setBike(null);
    this.debugTimer -= dt;
    if (hud.debugVisible && this.debugTimer <= 0) {
      this.debugTimer = 0.25;
      const p = this.player.position;
      const info = game.renderer.info;
      const st = this.chunks.stats;
      hud.setDebug(
        [
          `FPS ${game.loop.stats.fps.toFixed(0)}${game.loop.maxFps ? `/${game.loop.maxFps}` : ''}  帧 ${game.loop.stats.avg.toFixed(1)}ms  CPU ${game.cpu.avg.toFixed(1)}ms  GPU ${game.gpu.available ? `${game.gpu.ms.toFixed(1)}ms` : '不支持'}`,
          `像素比 ${game.renderer.getPixelRatio().toFixed(2)}（动态 ${Math.round(game.dynRes.scale * 100)}%）  刷新间隔 ${game.loop.rafIntervalMs.toFixed(1)}ms`,
          `draw ${info.render.calls}  tri ${(info.render.triangles / 1000).toFixed(0)}k  geo ${info.memory.geometries}  tex ${info.memory.textures}`,
          `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}  区域 ${this.currentZone ?? '—'}`,
          `地块 ${st.loaded} (L0 ${st.lod0} / L1 ${st.lod1}) 待建 ${st.pending}  实例 ${st.instances}`,
          `遮挡剔除 ${st.horizonCulled}  树木替身块 ${st.impostorChunks}  草格 ${st.detailTiles}  Bloom ${this.post.bloomPass?.enabled ? '开' : '关'}`,
          `野生 ${this.spawns.wild.size}/${this.spawns.maxWild}  刷新 ${this.spawns.stats.spawned}  回收 ${this.spawns.stats.despawned}`,
          `时间 ${game.clock.format()}  天气 ${this.weather.current}  画质 ${this.d.quality.tier}`,
          `场景栈 ${game.scenes.names.join(' > ')}`,
        ].join('\n'),
      );
    }
  }

  /** M1-17 大地图：当前岛屿与区域查询 */
  get islandConfig(): IslandConfig {
    return this.d.island;
  }

  zoneAt(x: number, z: number): { name: string } | null {
    return this.zones.at(x, z);
  }

  /** M1-16 任务导演查询：玩家、镜头、区域与地形 */
  questContext(): QuestContext {
    return {
      kind: 'overworld',
      island: this.d.island.id,
      player: this.player.position,
      camera: this.camera,
      world: this.world,
      zoneAt: (x, z) => this.zones.at(x, z)?.id ?? null,
      zoneCenter: (id) => {
        const z = this.zones.get(id);
        return z ? polygonCentroid(z.polygon) : null;
      },
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      pathCost: this.pathCost,
      active: !this.inBattle && !this.enteringDoor && !this.paused,
    };
  }

  /**
   * 任务地面指引的寻路代价：道路（土路 / 石板）最便宜，草地次之，高草略贵（会遇敌），
   * 浅水慢、深水需要水上骑乘能力，陡坡 / 建筑 / 未解锁阻挡不可通行。
   */
  private readonly pathCost = (x: number, z: number): number => {
    const hf = this.terrain.hf;
    if (!hf.inBounds(x, z)) return Infinity;
    const w = hf.waterAt(x, z);
    if (w && w.depth > 0.45) return this.d.state.flags['hm03-surf'] ? 2.2 : Infinity;
    if (hf.slopeAt(x, z) > 36) return Infinity;
    for (const b of this.d.island.blockers) if (!blockerOpen(b, (f) => this.d.state.flags[f] === true) && Math.hypot(x - b.position[0], z - b.position[2]) < (b.radius ?? 2) + 0.6) return Infinity;
    for (const c of this.collision.query(x, z, 0.6)) {
      if (c.tag === 'foliage-tree') continue;
      if (c.kind === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + 0.6) return Infinity;
      } else {
        // 盒子：转到盒子局部坐标判断
        const cs = Math.cos(c.yaw);
        const sn = Math.sin(c.yaw);
        const lx = (x - c.x) * cs - (z - c.z) * sn;
        const lz = (x - c.x) * sn + (z - c.z) * cs;
        if (Math.abs(lx) < c.hx + 0.6 && Math.abs(lz) < c.hz + 0.6) return Infinity;
      }
    }
    const s = hf.surfaceAt(x, z, this.pathSurf);
    const road = (s[3] ?? 0) + (s[6] ?? 0);
    return (w ? 1.6 : 1) * (road > 0.4 ? 0.55 : 1 + (s[2] ?? 0) * 0.4);
  };
  private readonly pathSurf = new Float32Array(8);

  /** M1-18 暂停菜单 */
  openMenu(tab?: MenuTab): Promise<void> {
    return openPauseMenu({
      game: this.d.game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      rig: this.rig,
      tab,
      location: () => this.locationText(),
      save: () => this.save(),
      saveSlot: () => this.saveSlot,
      placeLure: this.blocks.placeLure,
    });
  }

  /** 跟随宝可梦脚下的可走顶面（玩家高度 +0.8 以内），没有返回 -Infinity */
  private followerDeck(x: number, z: number): number {
    return this.collision.walkableTopAt(x, z, this.player.position.y + 0.8);
  }

  get saveSlot(): string {
    return this.d.slot ?? SAVE_SLOT;
  }

  /** 当前所在地文字（存档摘要 / 菜单） */
  locationText(): string {
    const room = this.d.game.scenes.find<InteriorScene>('interior')?.locationName();
    if (room) return `${this.d.island.name} · ${room}`;
    const z = this.currentZone ? this.zones.get(this.currentZone) : undefined;
    return z ? `${this.d.island.name} · ${z.name}` : this.d.island.name;
  }

  /** 自动存档时机是否安全：不在战斗 / 遭遇演出 / 训练家对战中 */
  get canAutoSave(): boolean {
    return !this.inBattle && !this.pendingEncounter && !this.trainers?.busy;
  }

  async save(opts: { auto?: boolean; silent?: boolean } = {}): Promise<boolean> {
    const { game, state } = this.d;
    const slot = this.saveSlot;
    try {
      state.savedAt = new Date().toISOString();
      await game.platform.storage.write(slot, serializeSave(state), summarize(state, this.locationText()));
      game.platform.storage.setPref(LAST_SLOT_PREF, slot);
      if (opts.silent) {
        // 新游戏建档：不提示
      } else if (opts.auto) this.d.toaster.show('✓ 已自动存档', 1400);
      else {
        this.d.toaster.show('已存档');
        sfx('save');
      }
      game.events.emit('game:save', { slot, ok: true });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.d.toaster.show(`${opts.auto ? '自动' : ''}存档失败：${msg}`, 4000);
      game.events.emit('game:save', { slot, ok: false, error: msg });
      return false;
    }
  }

  // ———————————————————— 战斗 ————————————————————

  private onEncounter(e: EncounterStartEvent): void {
    if (this.inBattle || this.fly.flying) return;
    this.auto.onEncounter();
    this.bike.dismount(true);
    if (!this.d.state.party.some((p) => p.hp > 0)) {
      // 没有能战斗的宝可梦：野生个体受惊逃走
      if (e.entityId >= 0) this.spawns.remove(e.entityId);
      this.d.toaster.show('没有能战斗的宝可梦，快去治疗吧！');
      this.encounterCooldown = ENCOUNTER_COOLDOWN;
      return;
    }
    this.inBattle = true;
    this.spawns.setFrozen(true);
    this.player.velocity.set(0, 0, 0);
    // 接触演出：野生个体头顶表情、玩家转身；暗雷时跟随宝可梦警觉
    const entity = e.entityId >= 0 ? (this.spawns.wild.get(e.entityId) ?? null) : null;
    if (entity) {
      entity.setEmote(contactEmote(e.initiative, entity.brain.state === 'sleep'));
      const p = this.player.position;
      this.player.teleport(p.x, p.z, Math.atan2(entity.root.position.x - p.x, entity.root.position.z - p.z));
    } else this.follower.follower?.emote.show('!', 1);
    this.pendingEncounter = { e, t: 0.55 };
  }

  private updateEncounterBeat(dt: number): void {
    const pe = this.pendingEncounter;
    if (!pe) return;
    pe.t -= dt;
    if (pe.t > 0) return;
    this.pendingEncounter = null;
    this.beginWildBattle(pe.e);
  }

  private beginWildBattle(e: EncounterStartEvent): void {
    this.alpha.onBattleStart(e);
    this.d.game.clockRunning = false;
    this.d.hud.setVisible(false);
    const entity = e.entityId >= 0 ? (this.spawns.wild.get(e.entityId) ?? null) : null;
    const brain = entity?.brain;
    void this.d.game.scenes.push(new BattleScene(this), {
      follower: this.follower.lend(),
      kind: 'wild',
      wild: e.wild,
      wildEntity: entity,
      initiative: e.initiative,
      method: e.method,
      entityId: e.entityId,
      wildPosition: e.wildPosition,
      sleeping: brain?.state === 'sleep',
      alerted: !brain?.calmed && (brain?.state === 'alert' || brain?.state === 'chase'),
      calmed: !!brain?.calmed,
    });
  }

  /** M1-10 训练家对战（TrainerBattles 演出结束后调用） */
  private startTrainerBattle(data: BattleStartData): void {
    this.bike.dismount(true);
    this.inBattle = true;
    this.spawns.setFrozen(true);
    this.d.game.clockRunning = false;
    this.d.hud.setVisible(false);
    this.player.velocity.set(0, 0, 0);
    void this.d.game.scenes.push(new BattleScene(this), { ...data, follower: this.follower.lend() });
  }

  /** M1-13/14 剧情战斗（脚本）：战败不扣钱、不回复活点，只回复全队（学习向友好） */
  private scriptedBattle = false;

  /** 剧情脚本发起的野生战斗；返回战斗结果 */
  storyBattle(o: { species: number; level: number; moves?: string[] | undefined; noCapture?: boolean | undefined; noRun?: boolean | undefined; boss?: boolean | undefined }): Promise<BattleResultKind> {
    const wild = createPokemon(this.d.dex, o.species, o.level, this.d.rng, o.moves ? { moves: o.moves } : {});
    const p = this.player.position;
    const f = this.player.facing;
    const wx = p.x + Math.sin(f) * 4;
    const wz = p.z + Math.cos(f) * 4;
    this.inBattle = true;
    this.scriptedBattle = true;
    this.spawns.setFrozen(true);
    this.player.velocity.set(0, 0, 0);
    this.d.game.clockRunning = false;
    this.d.hud.setVisible(false);
    const done = new Promise<BattleResultKind>((resolve) => {
      this.d.game.events.once('battle:end', (e) => resolve(e.result));
    });
    void this.d.game.scenes.push(new BattleScene(this), {
      follower: this.follower.lend(),
      kind: 'wild',
      wild,
      wildEntity: null,
      initiative: null,
      method: 'visible',
      entityId: -1,
      wildPosition: { x: wx, y: this.terrain.heightAt(wx, wz), z: wz },
      scripted: { noCapture: o.noCapture, noRun: o.noRun, boss: o.boss },
    });
    return done;
  }

  /** 剧情传送（带黑场由调用方负责）：水上骑乘中先落地 */
  async storyTeleport(x: number, z: number, yaw: number): Promise<void> {
    if (this.ride.surfing) await this.ride.stop(null, true);
    if (this.fly.flying) await this.fly.land(true);
    this.bike.dismount(true);
    this.player.teleport(x, z, yaw);
    this.spawns.clear();
    this.chunks.loadAround(x, z);
    this.follower.warp();
    this.rig.target.copy(this.player.position);
    this.rig.resetBehind(this.player.facing);
    this.rig.snap();
    this.updateZone(true);
    this.npcs.sync(this.player.position);
  }

  /** 最近一次室内回复所在建筑的门口（黑屏复活点） */
  private recordRespawn(): void {
    const interior = this.d.state.position.interior;
    const poi = this.lastDoor ? this.d.island.pois.find((q) => q.id === this.lastDoor) : undefined;
    if (!interior || !poi) return;
    const door = this.doorOf(poi);
    const x = door ? door.position.x + Math.sin(door.yaw) * 1.2 : poi.position[0];
    const z = door ? door.position.z + Math.cos(door.yaw) * 1.2 : poi.position[2];
    this.d.state.respawn = { island: this.d.island.id, xyz: [x, this.terrain.heightAt(x, z), z], yaw: door?.yaw ?? 0, label: poi.name };
  }

  /** 自动战斗驾驶员（BattleHost） */
  autoPilot(): SceneAutoBattle | null {
    return this.auto.active ? this.auto : null;
  }

  finish(r: BattleResult): void {
    void this.d.game.scenes.pop(r).then(() => this.afterBattle(r));
  }

  private async afterBattle(r: BattleResult): Promise<void> {
    const { game } = this.d;
    if (r.entityId >= 0 && r.result !== 'run') this.spawns.remove(r.entityId);
    if (r.entityId >= 0 && r.result === 'run') {
      // 逃跑后野生个体受惊跑开，短时间内不会再撞上来；巢穴头目回巢（警告重置，玩家需退出警告圈）
      const w = this.spawns.wild.get(r.entityId);
      if (w) {
        w.brain.state = w.brain.territory ? 'return' : 'flee';
        w.setEmote(null);
      }
    }
    const alphaLines = this.scriptedBattle ? [] : this.alpha.onBattleEnd(r.result);
    if (!r.trainerId) this.auto.onBattleEnd(r);
    else this.auto.stop('训练家对战');
    // 计划文档 §6：普通野生宝可梦被打倒后，偶尔留下心之鳞片（想起招式的费用）
    if (!this.scriptedBattle && !r.trainerId && r.entityId >= 0 && r.result === 'win' && !alphaLines.length && rollWildHeartScale(this.d.rng)) {
      addItem(this.d.state, HEART_SCALE, 1);
      alphaLines.push('咦？野生宝可梦离开的地方，留下了一片闪闪发光的鳞片……', `获得了 心之鳞片！`);
    }
    this.spawns.setFrozen(false);
    this.follower.giveBack();
    const trainerDef = this.trainers.active ? this.trainers.active.def : null;
    this.trainers.onBattleEnd(r.result, r.trainerId);
    if (r.result === 'lose' && this.scriptedBattle) for (const p of this.d.state.party) healFully(this.d.dex, p);
    else if (r.result === 'lose') await this.blackout(trainerDef ? `${trainerDef.title}${trainerDef.name}` : null);
    this.scriptedBattle = false;
    this.inBattle = false;
    this.encounterCooldown = r.result === 'run' ? Math.max(ENCOUNTER_COOLDOWN, 4) : ENCOUNTER_COOLDOWN;
    game.clockRunning = true;
    this.d.hud.setVisible(true);
    this.rig.clearOverride();
    this.rig.resetBehind(this.player.facing);
    if (alphaLines.length) await say(this.d.ui, alphaLines);
    game.events.emit('battle:end', {
      result: r.result,
      entityId: r.entityId,
      ...(r.captured ? { capturedSpecies: r.captured.speciesId } : {}),
      ...(r.trainerId ? { trainerId: r.trainerId } : {}),
    });
  }

  /**
   * 黑屏（M1-09）：付款（第四世代公式）→ 回到最近回复过的宝可梦中心 / 家门口（没有则岛屿出生点）→ 全队回复。
   */
  private async blackout(trainerName: string | null): Promise<void> {
    const { state } = this.d;
    const badges = Object.keys(state.flags).filter((f) => f.startsWith('badge-') && state.flags[f]).length;
    const top = Math.max(1, ...state.party.map((p) => p.level));
    const pay = blackoutPenalty(state.money, top, badges);
    state.money -= pay;
    await this.d.transition.fadeOut(500);
    for (const p of state.party) healFully(this.d.dex, p);
    const rp = state.respawn && state.respawn.island === this.d.island.id ? state.respawn : null;
    const [sx, , sz] = rp ? rp.xyz : this.d.island.spawnPoint;
    const yaw = rp ? rp.yaw : (this.d.island.spawnYaw ?? 0);
    if (this.ride.surfing) await this.ride.stop(null, true);
    if (this.fly.flying) await this.fly.land(true);
    this.bike.dismount(true);
    this.player.teleport(sx, sz, yaw);
    this.spawns.clear();
    this.chunks.loadAround(sx, sz);
    this.follower.warp();
    this.rig.resetBehind(this.player.facing);
    this.rig.snap();
    this.d.game.events.emit('player:blackout', { money: pay, respawn: rp?.label ?? null });
    await this.d.transition.fadeIn(600);
    const name = state.player.name;
    const lines = [
      pay > 0 ? (trainerName ? `${name}付给了${trainerName} ${pay} 元……` : `${name}慌忙中弄丢了 ${pay} 元……`) : `${name}拼命地逃了回来……`,
      rp ? `${name}急忙赶回了${rp.label}，宝可梦们都恢复了精神。` : `${name}急忙赶回了家，宝可梦们都恢复了精神。`,
    ];
    await say(this.d.ui, lines);
  }

  // ———————————————————— 室内（M1-05） ————————————————————

  private enteringDoor = false;

  /** 门：面朝门走进 1 m 内自动进入，或在 1.8 m 内按互动键进入 */
  private checkDoors(interact: boolean): void {
    if (this.enteringDoor || this.inBattle) return;
    const p = this.player.position;
    const v = this.player.velocity;
    const speed = Math.hypot(v.x, v.z);
    for (const poi of this.d.island.pois) {
      if (!poi.interior || !INTERIORS[poi.interior]) continue;
      const door = this.doorOf(poi);
      if (!door) continue;
      const dist = Math.hypot(p.x - door.position.x, p.z - door.position.z);
      if (dist > 1.8) continue;
      // 门外位置的朝外方向为 door.yaw；走进门 = 速度朝向 door.yaw + π
      const inx = -Math.sin(door.yaw);
      const inz = -Math.cos(door.yaw);
      const walkingIn = speed > 0.5 && (v.x * inx + v.z * inz) / speed > 0.6 && dist < 1.0;
      const facingIn = Math.sin(this.player.facing) * inx + Math.cos(this.player.facing) * inz > 0.3;
      if (walkingIn || (interact && facingIn)) {
        void this.enterInterior(poi.interior, poi.id);
        return;
      }
    }
  }

  private lastDoor: string | null = null;

  /** 进入室内（也用于读档恢复：room 指定楼层，此时不做淡出） */
  async enterInterior(interiorId: string, doorId: string | null, room?: string, instant = false): Promise<void> {
    if (this.enteringDoor) return;
    this.enteringDoor = true;
    this.lastDoor = doorId ?? this.d.island.pois.find((q) => q.interior === interiorId)?.id ?? null;
    this.player.velocity.set(0, 0, 0);
    if (this.ride.surfing) await this.ride.stop(null, true);
    if (this.fly.flying) await this.fly.land(true);
    this.auto.stop('进入了室内');
    this.bike.dismount(true);
    sfx('door');
    this.d.game.events.emit('interior:enter', { interior: interiorId, door: this.lastDoor });
    if (!instant) await this.d.transition.fadeOut(300);
    const scene = new InteriorScene(
      {
        game: this.d.game,
        ui: this.d.ui,
        hud: this.d.hud,
        transition: this.d.transition,
        state: this.d.state,
        quality: this.d.quality,
        islandName: this.d.island.name,
        save: () => this.save(),
        leave: (id) => this.leaveInterior(id),
        toast: (t) => this.d.toaster.show(t),
        dex: this.d.dex,
        rng: this.d.rng,
        timeOfDay: () => this.timeOfDay(),
        fieldWeather: () => this.fieldWeather(),
        blackout: (name) => this.blackoutFromInterior(name),
      },
      interiorId,
    );
    await this.d.game.scenes.push(scene, room ? { room, exit: scene.config.rooms.find((r) => r.id === room)?.exits[0]?.id } : undefined);
    await this.d.transition.fadeIn(300);
    this.enteringDoor = false;
  }

  /** M1-11 室内（道馆）战败：先黑屏离开室内，再走大地图黑屏流程（付款 → 复活点 → 回复） */
  private async blackoutFromInterior(trainerName: string | null): Promise<void> {
    await this.d.transition.fadeOut(400);
    await this.d.game.scenes.pop();
    this.d.hud.setVisible(true);
    await this.blackout(trainerName);
  }

  /** 从室内正门离开：pop 回大地图，出现在门外、面朝外 */
  async leaveInterior(interiorId: string): Promise<void> {
    await this.d.transition.fadeOut(300);
    sfx('door');
    await this.d.game.scenes.pop();
    const lastPoi = this.lastDoor ? this.d.island.pois.find((q) => q.id === this.lastDoor) : undefined;
    const door = (lastPoi && this.doorOf(lastPoi)) || this.doorFor(interiorId);
    if (door) {
      const x = door.position.x + Math.sin(door.yaw) * 0.9;
      const z = door.position.z + Math.cos(door.yaw) * 0.9;
      this.player.teleport(x, z, door.yaw);
      this.chunks.loadAround(x, z);
    }
    this.d.state.position.interior = null;
    this.follower.warp();
    this.rig.target.copy(this.player.position);
    this.rig.resetBehind(this.player.facing);
    this.rig.snap();
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.d.hud.setVisible(true);
    this.updateZone(true);
    this.npcs.sync(this.player.position);
    this.d.game.events.emit('interior:leave', { interior: interiorId });
    await this.d.transition.fadeIn(300);
  }

  /** 自动战斗：骑宝可梦飞回最近的宝可梦中心，治疗全队，再飞回原地 */
  private async autoHealTrip(): Promise<string | null> {
    const why = this.fly.takeoffBlock();
    if (why) return why;
    const p = this.player.position;
    let best: { name: string; pos: THREE.Vector3; yaw: number } | null = null;
    let bd = Infinity;
    for (const poi of this.d.island.pois) {
      if (poi.kind !== 'pokecenter') continue;
      const door = this.doorOf(poi);
      if (!door) continue;
      const dd = Math.hypot(door.position.x - p.x, door.position.z - p.z);
      if (dd < bd) {
        bd = dd;
        best = { name: poi.name, pos: door.position, yaw: door.yaw };
      }
    }
    if (!best) return '这座岛上没有可以飞回的宝可梦中心';
    const back = { x: p.x, z: p.z, yaw: this.player.facing };
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    this.bike.dismount(true);
    if (!this.fly.takeoff()) return '没法起飞';
    this.enteringDoor = true;
    try {
      // 骑上飞行宝可梦，再黑屏「飞」过去
      await wait(900);
      await this.d.transition.fadeOut(500);
      await this.fly.land(true);
      const out = best.pos;
      this.player.teleport(out.x + Math.sin(best.yaw) * 2.5, out.z + Math.cos(best.yaw) * 2.5, best.yaw + Math.PI);
      this.npcs.sync(this.player.position);
      await this.d.transition.fadeIn(400);
      this.d.toaster.show(`飞回了${best.name}，把宝可梦交给了乔伊小姐……`);
      await wait(700);
      await this.d.transition.fadeOut(450);
      for (const m of this.d.state.party) healFully(this.d.dex, m);
      this.d.game.events.emit('party:healed', { source: 'auto-battle' });
      await wait(600);
      this.player.teleport(back.x, back.z, back.yaw);
      this.npcs.sync(this.player.position);
      await this.d.transition.fadeIn(450);
      this.d.toaster.show('宝可梦都恢复了精神！已飞回原地，继续自动战斗。');
    } finally {
      this.enteringDoor = false;
    }
    return null;
  }

  private doorFor(interiorId: string): { position: THREE.Vector3; yaw: number } | null {
    const poi = this.d.island.pois.find((q) => q.interior === interiorId);
    return poi ? this.doorOf(poi) : null;
  }

  /** 门外位置与朝外方向：建筑摆放物优先，否则用 POI 的 position + doorYaw（洞穴等） */
  private doorOf(poi: IslandConfig['pois'][number]): { position: THREE.Vector3; yaw: number } | null {
    const d = this.props.doors.get(poi.id);
    if (d) return d;
    if (poi.doorYaw === undefined) return null;
    const [x, , z] = poi.position;
    return { position: new THREE.Vector3(x, this.terrain.heightAt(x, z), z), yaw: poi.doorYaw };
  }

  /** 读档：存档位置在室内时，直接进入对应房间 */
  async restoreInterior(): Promise<void> {
    const tag = this.d.state.position.interior;
    if (!tag) return;
    const [id, room] = tag.split('#');
    if (!id || !INTERIORS[id]) {
      this.d.state.position.interior = null;
      return;
    }
    await this.enterInterior(id, null, room, true);
  }

  /** M1-20 音频情境（AudioDirector 每帧读取） */
  audioContext(): AudioContextInfo {
    const zone = this.currentZone ? this.zones.get(this.currentZone) : undefined;
    const p = this.player.position;
    return {
      inBattle: this.inBattle && this.d.game.scenes.top !== this,
      interiorBgm: null,
      indoor: null,
      zoneBgm: zone?.bgm ?? null,
      zoneKind: zone?.kind ?? null,
      surfing: this.ride.surfing,
      time: this.timeOfDay(),
      weather: this.weather.current,
      player: { x: p.x, y: p.y, z: p.z },
      waterAt: (x, z) => this.terrain.hf.waterAt(x, z),
    };
  }

  /** 读档在水面上：有水上骑乘能力直接骑上，否则送回最近的出生点 */
  private restoreOnWater(): void {
    const p = this.player.position;
    const w = this.terrain.hf.waterAt(p.x, p.z);
    if (!w || w.depth < SURF_MIN_DEPTH + 0.3) return;
    if (this.ride.waterRide()) {
      void this.ride.start({ x: p.x, z: p.z, level: w.level }, true);
      return;
    }
    const [sx, , sz] = this.d.island.spawnPoint;
    this.player.teleport(sx, sz, this.d.island.spawnYaw ?? 0);
  }

  dispose(): void {
    this.story.dispose();
    for (const br of this.barriers) br.dome.dispose();
    this.barriers = [];
    this.gather.dispose();
    this.farm.dispose();
    this.blocks.dispose();
    this.offBreeder?.();
    this.minimap.dispose();
    this.alpha.dispose();
    this.ride.dispose();
    this.bike.dispose();
    this.fly.dispose();
    this.auto.dispose();
    this.fishing.dispose();
    this.npcs.dispose();
    this.interactions.dispose();
    this.spawns.clear();
    this.post.dispose();
    this.sky.dispose();
    this.water.dispose();
    this.foliage.dispose();
    this.life.dispose();
    this.props.dispose();
    this.lamps.dispose();
    this.terrain.dispose();
  }
}
