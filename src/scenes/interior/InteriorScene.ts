/**
 * M1-05 · 室内场景。
 *
 * - 由大地图 push 到栈顶（大地图 paused，不渲染），离开时 pop 回大地图门口。
 * - 固定俯视斜角镜头（经典室内视角），跟随玩家并限制在房间范围内；+Z 墙剖切。
 * - 出口：正门地垫 / 楼梯触发区。只有「朝出口方向移动」才触发；刚进入时出口处于未激活状态，
 *   玩家离开所有出口范围后才激活，避免一进门就被弹出去。
 * - 同一室内场景的楼层切换（楼梯）在场景内部完成：淡出 → 重建房间 → 淡入。
 * - 室内光照：预设灯光 + 窗户随时间变化 + 落地灯（InteriorBuilder）。
 */
import { IslandMap } from '@/scenes/common/IslandMap';
import { SceneFollower } from '@/scenes/common/SceneFollower';
import { applySettings, openPauseMenu } from '../common/pauseMenu';
import type { QuestContext } from '../common/QuestDirector';
import type { MenuTab } from '@/ui/menu';
import * as THREE from 'three';
import type { Scene } from '@/core/scene/SceneManager';
import type { Game } from '@/core/Game';
import type { UiRoot, Transition } from '@/ui/core';
import type { Hud } from '@/ui/hud';
import type { GameState } from '@/systems/state/GameState';
import { getExit, getInterior, getRoom, spawnAtExit, type ExitConfig, type InteriorConfig, type RoomConfig } from '@/config/interiors';
import { PlayerController } from '@/actors/player';
import { CollisionWorld, type Terrain } from '@/world';
import { InteriorBuilder, LIGHT_PRESETS, type BuiltRoom } from '@/world/interiors/InteriorBuilder';
import { SceneNpcs } from '@/scenes/common/SceneNpcs';
import { attachTalkCamera } from '@/scenes/common/talkCamera';
import { StarterTable } from '@/scenes/common/StarterTable';
import { STARTER_CARDS } from '@/config/story';
import { SceneInteractions } from '@/scenes/common/SceneInteractions';
import { HealMachineFx } from '@/scenes/common/HealMachineFx';
import { furnitureSource, npcSource } from '@/scenes/common/interactSources';
import type { Dex } from '@/systems/data/Dex';
import { LAYER, PostChain, type QualitySettings } from '@/render';
import { createNpcServices, type NpcServices } from '@/scenes/common/npcServices';
import { Footsteps } from '@/scenes/common/Footsteps';
import type { AudioContextInfo } from '@/scenes/common/AudioDirector';
import type { FieldWeather, TimeOfDay } from '@/systems/encounters';
import { CameraRig } from '@/core/camera/CameraRig';
import type { Rng } from '@/systems/rng';
import { TrainerBattles } from '@/scenes/common/TrainerBattles';
import { BattleScene, type BattleHost, type BattleResult, type BattleStartData } from '@/scenes/battle/BattleScene';
import { WaterPuzzleView } from '@/world/interiors/WaterPuzzleView';
import { toggleLevel, valveAt } from '@/systems/puzzles/waterLevel';
import { GYMS } from '@/config/encounters';
import { TRAINER_BY_ID } from '@/config/trainers';
import { say } from '@/ui/core';
import { jingle, sfx } from '@/core/audio';
import { isTalking } from '@/scenes/common/npcTalk';
import { InteriorField } from './InteriorField';
import type { StoryBattleResult, StoryHost } from '@/scenes/common/StoryDirector';
import { createPokemon, type PokemonInstance } from '@/systems/pokemon/Pokemon';

export interface InteriorDeps {
  game: Game;
  ui: UiRoot;
  hud: Hud;
  transition: Transition;
  state: GameState;
  quality: QualitySettings;
  islandName: string;
  /** 快速存档（由大地图实现） */
  save(): Promise<boolean>;
  /** 从正门离开：由大地图负责 pop 与门口定位 */
  leave(interiorId: string): Promise<void>;
  toast?: ((text: string) => void) | undefined;
  dex: Dex;
  /** M1-11 室内对战（道馆）：随机源、时间 / 天气（战斗场光照）、战败黑屏（由大地图实现：离开室内 → 复活点） */
  rng: Rng;
  timeOfDay(): TimeOfDay;
  fieldWeather(): FieldWeather;
  blackout(trainerName: string | null): Promise<void>;
}

export interface InteriorEnterData {
  room?: string;
  exit?: string;
}

/**
 * 室内地面：平地 y = 0，无水、无坡度、边界无限（墙由碰撞体负责）。
 * PlayerController 用到的地形接口：heightAt 与 hf.inBounds / waterAt / slopeAt。
 */
const FLAT_HF = { inBounds: () => true, waterAt: () => null, slopeAt: () => 0 };
/** 室内跟随镜头：比室外近、俯角稍大，小房间也能看清家具布局 */
const INDOOR_DISTANCE = 5.2;
const INDOOR_PITCH = 0.48;
const FADE_MS = 280;

export class InteriorScene implements Scene, BattleHost {
  readonly name = 'interior';
  readonly world = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly collision = new CollisionWorld();
  readonly config: InteriorConfig;
  player: PlayerController;
  room!: RoomConfig;
  private built: BuiltRoom | null = null;
  private starterTable: StarterTable | null = null;
  private builder: InteriorBuilder;
  post: PostChain;
  private exitsArmed = false;
  private switching = false;
  private time = 0;
  /** M1-06 NPC（按房间 npcs 固定位 + 日程生成） */
  npcs: SceneNpcs;
  /** M1-07 互动提示（NPC + 家具） */
  interactions: SceneInteractions;
  /** M1-08 跟随宝可梦（室内也跟着） */
  follower: SceneFollower;
  /** M1-19 回复 / 商店 / 赠礼 */
  services: NpcServices;
  /** M1-20 脚步声 */
  footsteps = new Footsteps((x, z) => {
    // 室内：木地板 → 木板声；瓷砖 / 岩石 / 素地面 → 硬地声
    void x;
    void z;
    const pat = this.room?.floor.pattern ?? 'plank';
    return pat === 'plank' ? 'step-wood' : 'step-ground';
  });
  /** M1-19 恢复机演出 */
  /** 恢复机演出（房间里有 healer 家具时） */
  private healMachine: HealMachineFx | null = null;
  private unsub: (() => void)[] = [];
  /** M1-11 水位机关（道馆房间才有） */
  puzzle: WaterPuzzleView | null = null;
  /** M1-11 室内训练家对战（道馆） */
  trainers: TrainerBattles;
  /** 战斗镜头（只在战斗中由 BattleScene 驱动；平时使用固定俯视镜头） */
  readonly rig: CameraRig;
  inBattle = false;
  private prevTrainers: TrainerBattles | null = null;
  /** M2 地城玩法：阻挡 / 黑暗 / 暗雷 / 触发区 */
  field: InteriorField;
  /** 固定舞台开战前的玩家位置（战斗结束后放回） */
  private preBattle: { x: number; z: number; yaw: number } | null = null;
  /** 地面：平地 y = 0；道馆水池内由机关给出石岛 / 木筏 / 栈道高度 */
  private readonly ground = {
    heightAt: (x: number, z: number) => this.puzzle?.heightAt(x, z) ?? 0,
    hf: FLAT_HF,
  };

  constructor(
    private readonly d: InteriorDeps,
    interiorId: string,
  ) {
    this.config = getInterior(interiorId);
    this.camera = new THREE.PerspectiveCamera(42, d.game.width / d.game.height, 0.1, 200);
    for (const l of [LAYER.TERRAIN, LAYER.CHARACTERS, LAYER.FX]) this.camera.layers.enable(l);
    this.builder = new InteriorBuilder(this.collision);
    this.player = new PlayerController(this.ground as unknown as Terrain, this.collision, [], d.game.events);
    // 室内同样是 MMORPG 式自由环绕跟随镜头；墙由剖切（cutaway）隐藏，不做墙体遮挡拉近
    this.rig = new CameraRig(this.camera, { groundAt: () => 0 });
    this.rig.maxDistance = 10;
    this.rig.setDistance(INDOOR_DISTANCE);
    applySettings(d.state.settings, this.rig, d.game);
    // 室内也可第一人称（沿用设置 cameraMode）
    if (d.state.settings.cameraMode === 'first') this.rig.setMode('first', d.game.input);
    this.world.add(this.player.root);
    this.npcs = new SceneNpcs({
      game: d.game,
      ui: d.ui,
      state: d.state,
      ground: this.ground,
      collision: this.collision,
      parent: this.world,
      place: { kind: 'interior', interior: this.config.id, room: this.config.entryRoom },
      toast: d.toast,
      tagDistance: [30, 40],
      talkRange: 2.8,
      services: (this.services = createNpcServices({ game: d.game, ui: d.ui, state: d.state, dex: d.dex, toast: d.toast })),
    });
    this.interactions = new SceneInteractions({ game: d.game, ui: d.ui, state: d.state, dex: d.dex, transition: d.transition, toast: d.toast });
    this.interactions.addSource(npcSource(this.npcs));
    this.interactions.addSource(furnitureSource(this.interactions, () => this.built?.interactFootprints ?? new Map()));
    this.follower = new SceneFollower({
      game: d.game,
      ui: d.ui,
      state: d.state,
      dex: d.dex,
      parent: this.world,
      player: this.player,
      ground: {
        heightAt: (x, z) => this.ground.heightAt(x, z),
        waterDepth: () => 0,
        canStand: (x, z) => !this.collision.query(x, z, 0.6).some((c) => (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.35 : this.insideBox(c, x, z, 0.35))),
      },
      zoneKind: () => 'interior',
      weather: () => 'clear',
    });
    this.interactions.addSource(this.follower.source());
    this.interactions.addSource((player, out) => this.valveSource(player, out));
    this.field = new InteriorField({
      game: d.game,
      ui: d.ui,
      state: d.state,
      dex: d.dex,
      rng: d.rng,
      world: this.world,
      collision: this.collision,
      timeOfDay: () => d.timeOfDay(),
      startWild: (wild) => this.startWildBattle(wild),
      canTrigger: () => !this.inBattle && !this.switching && !this.d.ui.busy && !this.interactions.busy && !this.trainers.busy && !isTalking(),
      toast: d.toast,
    });
    this.interactions.addSource(this.field.source());
    this.prevTrainers = TrainerBattles.current;
    this.trainers = new TrainerBattles({
      game: d.game,
      ui: d.ui,
      state: d.state,
      dex: d.dex,
      rng: d.rng,
      npcs: this.npcs,
      player: this.player,
      heightAt: (x, z) => this.ground.heightAt(x, z),
      canSpot: () => !this.inBattle && !this.switching && !this.d.ui.busy && !this.interactions.busy && !isTalking(),
      startBattle: (data) => this.startTrainerBattle(data),
      returnHome: 'snap',
    });
    this.post = new PostChain(d.game.renderer, this.world, this.camera);
    // 室内一直有灯具 / 屏幕 / 水池光，bloom 常开（房间小，开销低）
    this.post.bloomAlways = true;
    this.post.applyQuality(d.quality);
    this.post.setSize(d.game.width, d.game.height);
  }

  /** 当前所在房间（调试 / e2e） */
  get roomId(): string {
    return this.room.id;
  }

  get interactables(): ReadonlyMap<string, THREE.Vector3> {
    return this.built?.interactables ?? new Map();
  }

  enter(_from: Scene | null, data?: unknown): void {
    const e = (data ?? {}) as InteriorEnterData;
    this.loadRoom(e.room ?? this.config.entryRoom, e.exit ?? this.config.entryExit);
    this.d.hud.setVisible(true);
    this.d.hud.showZone(this.config.name, this.d.islandName);
    this.d.hud.setLocation(`${this.d.islandName} · ${this.config.name}`);
    this.unsub.push(
      // 剧情引导：对话时切到过肩镜头（墙由剖切自动隐藏）
      attachTalkCamera({
        game: this.d.game,
        rig: this.rig,
        npcHead: (id, out) => this.npcs.manager.npcs.get(id)?.headPosition(out) ?? null,
        player: () => this.player.position,
        enabled: () => this.rig.mode === 'third' && !this.inBattle,
      }),
    );
  }

  // ———————————————————— M1-19 恢复机（演出见 HealMachineFx） ————————————————————

  /** 调试：恢复机上的球数 */
  get healBalls(): number {
    return this.healMachine?.ballCount ?? 0;
  }

  /** 当前房间名（存档摘要用） */
  locationName(): string {
    return this.config.name;
  }

  exit(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.npcs.hide();
    this.interactions.prompt.hide();
    this.d.state.position.interior = null;
  }

  private loadRoom(roomId: string, exitId: string): void {
    this.built?.group.removeFromParent();
    this.built?.lights.removeFromParent();
    this.built?.dispose();
    this.puzzle?.dispose();
    this.puzzle = null;
    this.room = getRoom(this.config, roomId);
    this.built = this.builder.build(this.room);
    this.world.add(this.built.group, this.built.lights);
    this.healMachine?.dispose();
    this.healMachine = null;
    const healer = this.built.group.getObjectByName('furniture:healer');
    if (healer) {
      // 球从玩家手边（身前 0.35 m、腰高）出发 / 返回
      this.healMachine = new HealMachineFx(this.world, healer, () => {
        const p = this.player.position;
        return new THREE.Vector3(p.x + Math.sin(this.player.facing) * 0.35, p.y + 1.0, p.z + Math.cos(this.player.facing) * 0.35);
      }).activate();
    }
    this.starterTable?.dispose();
    this.starterTable = null;
    const tableFp = this.built.interactFootprints.get('starter-table');
    if (tableFp) {
      const flags = this.d.state.flags;
      this.starterTable = new StarterTable(
        tableFp,
        STARTER_CARDS.map((c) => c.species),
        (id) => !!flags[`starter-${id}`],
      )
        .attachCamera(this.rig, this.camera)
        .activate();
      this.world.add(this.starterTable.group);
    }
    if (this.room.waterPuzzle) {
      // 每次进门水位复位（机关不存档；也保证不会带着「困住」的水位进来）
      this.puzzle = new WaterPuzzleView(this.room.waterPuzzle, this.collision);
      this.world.add(this.puzzle.group);
    }
    this.field.load(this.room, this.built.lights);
    const preset = LIGHT_PRESETS[this.room.lighting];
    this.world.background = new THREE.Color(preset.fog);
    this.world.fog = null;
    const s = spawnAtExit(getExit(this.room, exitId));
    this.player.teleport(s.x, s.z, s.yaw);
    this.follower.warp();
    this.exitsArmed = false;
    this.d.state.position.interior = `${this.config.id}#${this.room.id}`;
    this.snapCamera();
    // 第一人称：进门时视线朝向出生朝向
    if (this.rig.mode === 'first') {
      this.rig.yaw = this.player.facing;
      this.rig.pitch = 0;
    }
    // 房间碰撞体已重建：NPC 按新房间的固定位重新生成
    this.npcs.setPlace({ kind: 'interior', interior: this.config.id, room: this.room.id }, this.room.npcs ?? [], this.player.position);
  }

  // ———————————————————— 帧更新 ————————————————————

  private get gameplayInput() {
    return this.d.ui.busy || this.switching || this.trainers.busy || this.inBattle ? null : this.d.game.input;
  }

  fixedUpdate(dt: number): void {
    // 第三 / 第一人称都按镜头朝向移动
    this.player.fixedUpdate(dt, this.gameplayInput, this.rig.forwardYaw);
    this.footsteps.fixedUpdate(this.player);
    this.checkExits();
  }

  update(dt: number): void {
    this.time += dt;
    this.d.state.playTime += dt;
    const input = this.d.game.input;
    if (!this.d.ui.busy && !this.switching) {
      if (input.pressed('menu') && !this.interactions.busy) void this.openMenu();
      else if (input.pressed('questLog') && !this.interactions.busy) void this.openMenu('quests');
      else if (input.pressed('map') && !this.interactions.busy) void IslandMap.current?.open();
      if (input.pressed('quicksave')) void this.d.save();
      if (input.pressed('toggleView')) {
        this.rig.toggleMode(input);
        this.d.state.settings.cameraMode = this.rig.mode;
        if (this.rig.mode === 'first') this.rig.yaw = this.player.facing;
        else this.snapCamera();
      }
      if (input.pressed('debug')) this.d.hud.toggleDebug();
    }
    this.player.update(dt);
    this.updateCamera(dt);
    this.npcs.update(dt, this.time, this.player, this.camera);
    this.follower.update(dt, this.d.ui.busy || this.switching);
    this.interactions.update(dt, this.player, this.camera, !this.switching);
    const hour = this.d.game.clock.hour;
    const day = THREE.MathUtils.clamp(Math.min((hour - 5.5) / 2, (19.5 - hour) / 2), 0, 1);
    this.built?.update(this.time, day);
    this.puzzle?.update(dt);
    this.starterTable?.update(dt);
    this.trainers.update(dt);
    this.field.update(dt, this.player);
    this.healMachine?.update(dt);
    this.d.hud.setClock(this.d.game.clock.format(), '');
  }

  /** M1-20 音频情境：室内曲 + 房间 / 洞穴环境音 */
  /** 配音空间：道馆 / 洞穴为大厅混响，其他室内为小房间 */
  get voiceSpace(): 'interior' | 'hall' {
    return this.config.id.includes('gym') || this.config.bgm === 'cave' || !!this.room.waterPuzzle ? 'hall' : 'interior';
  }

  audioContext(outside: { time: TimeOfDay; weather: FieldWeather }): AudioContextInfo {
    const p = this.player.position;
    const bgm = this.config.bgm ?? null;
    return {
      inBattle: this.inBattle && this.d.game.scenes.top !== this,
      interiorBgm: bgm,
      indoor: bgm === 'cave' ? 'cave' : 'room',
      zoneBgm: null,
      zoneKind: null,
      surfing: false,
      time: outside.time,
      weather: outside.weather,
      player: { x: p.x, y: p.y, z: p.z },
      waterAt: () => null,
    };
  }

  /** M1-16 任务导演查询（室内只显示追踪面板） */
  questContext(): QuestContext {
    return { kind: 'interior', island: this.d.state.position.island, roomName: this.config.name, active: !this.switching };
  }

  /** M1-18 暂停菜单 */
  openMenu(tab?: MenuTab): Promise<void> {
    return openPauseMenu({
      game: this.d.game,
      ui: this.d.ui,
      state: this.d.state,
      dex: this.d.dex,
      tab,
      location: () => `${this.d.islandName} · ${this.config.name}`,
      save: () => this.d.save(),
    });
  }

  render(): void {
    this.d.game.renderer.shadowMap.autoUpdate = true; // 大地图的阴影节流不带进室内
    this.post.render(1 / 60);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  }

  // ———————————————————— 出口 ————————————————————

  private checkExits(): void {
    if (this.switching) return;
    const p = this.player.position;
    const v = this.player.velocity;
    let inside: ExitConfig | null = null;
    for (const e of this.room.exits) {
      const r = e.radius ?? 0.8;
      if (Math.hypot(p.x - e.position[0], p.z - e.position[1]) < r) inside = e;
    }
    if (!inside) {
      this.exitsArmed = true;
      return;
    }
    if (!this.exitsArmed) return;
    const speed = Math.hypot(v.x, v.z);
    if (speed < 0.5) return;
    // 朝出口方向移动：正门要求向 +Z 走；楼梯要求朝触发区中心走
    const isDoor = 'overworld' in inside.to;
    const toward = isDoor ? v.z / speed : ((inside.position[0] - p.x) * v.x + (inside.position[1] - p.z) * v.z) / (speed * Math.max(0.1, Math.hypot(inside.position[0] - p.x, inside.position[1] - p.z)));
    if (toward < (isDoor ? 0.5 : 0.3)) return;
    void this.useExit(inside);
  }

  /** 使用出口（也供 e2e / 剧情脚本直接调用） */
  async useExit(e: ExitConfig): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    this.player.velocity.set(0, 0, 0);
    try {
      if ('overworld' in e.to) {
        await this.d.leave(this.config.id);
        return;
      }
      await this.d.transition.fadeOut(FADE_MS);
      this.loadRoom(e.to.room, e.to.exit);
      this.d.hud.showZone(this.room.name, this.config.name);
      await this.d.transition.fadeIn(FADE_MS);
    } finally {
      this.switching = false;
    }
  }

  // ———————————————————— 镜头 ————————————————————

  /** 镜头回到角色背后并立即就位（进门、战斗结束、切回第三人称） */
  private snapCamera(): void {
    this.rig.target.copy(this.player.position);
    this.rig.resetBehind(this.player.facing);
    this.rig.pitch = INDOOR_PITCH;
    this.rig.snap();
    this.rig.update(0, null);
    this.built?.updateCutaway(this.camera.position);
  }

  /** 室内第一人称（V 切换，与大地图共用设置 cameraMode） */
  private get firstPerson(): boolean {
    return this.rig.mode === 'first' && !this.rig.overridden;
  }

  private updateCamera(dt: number): void {
    this.rig.target.copy(this.player.position);
    this.rig.setFollow(this.player.facing, Math.hypot(this.player.velocity.x, this.player.velocity.z));
    this.rig.update(dt, this.gameplayInput);
    this.player.model.root.visible = !this.firstPerson;
    this.built?.updateCutaway(this.camera.position);
  }

  // ———————————————————— M1-11 水位机关 ————————————————————

  private valveSource(player: PlayerController, out: Parameters<Parameters<SceneInteractions['addSource']>[0]>[1]): void {
    const pz = this.puzzle;
    if (!pz) return;
    const p = player.position;
    for (const v of pz.cfg.valves) {
      const [x, z] = v.position;
      out.push({
        id: `valve:${v.id}`,
        kind: 'use',
        x,
        z,
        y: 1.9,
        label: '转动阀门',
        action: 'interact',
        range: (v.range ?? 1.4) + 0.2,
        priority: 2,
        run: async () => {
          await this.turnValve(v.id);
        },
      });
    }
    void p;
  }

  /** 转动阀门：切换水位（也供 e2e 直接调用） */
  async turnValve(id: string): Promise<boolean> {
    const pz = this.puzzle;
    if (!pz || pz.animating) return false;
    const v = pz.cfg.valves.find((q) => q.id === id);
    if (!v) return false;
    const p = this.player.position;
    // 互动距离外（e2e 直接调用时也要站在阀门旁）
    if (valveAt(pz.cfg, p.x, p.z)?.id !== id && Math.hypot(p.x - v.position[0], p.z - v.position[1]) > (v.range ?? 1.4) + 0.4) return false;
    const next = toggleLevel(pz.level);
    this.player.velocity.set(0, 0, 0);
    this.player.teleport(p.x, p.z, Math.atan2(v.position[0] - p.x, v.position[1] - p.z));
    pz.spinValve(id);
    sfx('valve');
    pz.setLevel(next);
    this.d.game.events.emit('puzzle:water', { valve: id, level: next });
    this.d.toast?.(next === 'low' ? '水位下降了！石栈道露了出来。' : '水位上升了！木筏浮了起来。');
    return true;
  }

  /** 当前水位（e2e） */
  get waterLevel(): 'high' | 'low' | null {
    return this.puzzle?.level ?? null;
  }

  // ———————————————————— M1-11 室内对战（BattleHost） ————————————————————

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
  get events() {
    return this.d.game.events;
  }
  get state(): GameState {
    return this.d.state;
  }
  heightAt(x: number, z: number): number {
    return this.ground.heightAt(x, z);
  }
  timeOfDay(): TimeOfDay {
    return this.d.timeOfDay();
  }
  fieldWeather(): FieldWeather {
    // 室内不受天气影响
    return 'clear';
  }
  renderWorld(): void {
    // 战斗镜头也可能在墙外：同样剖切
    this.built?.updateCutaway(this.camera.position);
    this.d.game.renderer.shadowMap.autoUpdate = true;
    this.post.render(1 / 60);
  }
  animateWorld(dt: number): void {
    this.time += dt;
    this.puzzle?.update(dt);
    const hour = this.d.game.clock.hour;
    const day = THREE.MathUtils.clamp(Math.min((hour - 5.5) / 2, (19.5 - hour) / 2), 0, 1);
    this.built?.update(this.time, day);
  }
  animateActors(dt: number): void {
    this.npcs.manager.update(dt, this.time);
  }
  battleStage(): { x: number; z: number; yaw: number; radius?: number | undefined } | null {
    const st = this.room.battleStage;
    return st ? { x: st.position[0], z: st.position[1], yaw: st.yaw, radius: st.radius } : null;
  }

  /** M2-15 洞窟暗雷 / 剧情野生战斗：在玩家前方 3.5 m 开战 */
  private startWildBattle(wild: PokemonInstance, scripted?: { noCapture?: boolean | undefined; noRun?: boolean | undefined; boss?: boolean | undefined }): void {
    this.inBattle = true;
    this.player.velocity.set(0, 0, 0);
    const p = this.player.position;
    const f = this.player.facing;
    const wx = p.x + Math.sin(f) * 3.5;
    const wz = p.z + Math.cos(f) * 3.5;
    const look = new THREE.Vector3();
    this.camera.getWorldDirection(look);
    this.rig.setOverride(this.camera.position.clone(), this.camera.position.clone().add(look.multiplyScalar(10)), 1);
    this.d.hud.setVisible(false);
    this.d.game.clockRunning = false;
    void this.d.game.scenes.push(new BattleScene(this), {
      follower: this.follower.lend(),
      kind: 'wild',
      wild,
      wildEntity: null,
      initiative: null,
      method: 'grass',
      entityId: -1,
      wildPosition: { x: wx, y: 0, z: wz },
      ...(scripted ? { scripted } : {}),
    });
  }

  /** 剧情宿主（室内：对话类步骤 + 剧情野生战斗） */
  storyHost(): StoryHost {
    return {
      kind: 'interior',
      battle: (o) => {
        const wild = createPokemon(this.d.dex, o.species, o.level, this.d.rng, o.moves ? { moves: o.moves } : {});
        const done = new Promise<StoryBattleResult>((resolve) => {
          this.d.game.events.once('battle:end', (e) => resolve(e.result as StoryBattleResult));
        });
        this.startWildBattle(wild, { noCapture: o.noCapture, noRun: o.noRun, boss: o.boss });
        return done;
      },
    };
  }

  private startTrainerBattle(data: BattleStartData): void {
    this.inBattle = true;
    // 道馆第二轮：馆主台两侧水幕喷泉随对战升起
    this.built?.setBattle(true);
    this.player.velocity.set(0, 0, 0);
    const p = this.player.position;
    const stage = this.battleStage();
    this.preBattle = stage ? { x: p.x, z: p.z, yaw: this.player.facing } : null;
    if (stage) {
      // 移到舞台后再把跟随宝可梦放到身边，保证它从舞台旁跑进战斗场
      this.player.teleport(stage.x, stage.z, stage.yaw);
      this.follower.warp();
    }
    // 战斗镜头从当前跟随镜头开始过渡
    const look = new THREE.Vector3();
    this.camera.getWorldDirection(look);
    this.rig.setOverride(this.camera.position.clone(), this.camera.position.clone().add(look.multiplyScalar(10)), 1);
    this.d.hud.setVisible(false);
    this.d.game.clockRunning = false;
    void this.d.game.scenes.push(new BattleScene(this), { ...data, follower: this.follower.lend() });
  }

  finish(r: BattleResult): void {
    void this.d.game.scenes.pop(r).then(() => this.afterBattle(r));
  }

  private async afterBattle(r: BattleResult): Promise<void> {
    const { game } = this.d;
    this.built?.setBattle(false);
    this.follower.giveBack();
    const def = this.trainers.active?.def ?? null;
    this.trainers.onBattleEnd(r.result, r.trainerId);
    this.rig.clearOverride();
    game.clockRunning = true;
    if (r.result === 'lose') {
      this.inBattle = false;
      game.events.emit('battle:end', { result: r.result, entityId: r.entityId, ...(r.trainerId ? { trainerId: r.trainerId } : {}) });
      // 黑屏：离开道馆，回到最近的复活点（机关随之复位）
      await this.d.blackout(def ? `${def.title}${def.name}` : null);
      return;
    }
    // 放回开战前的位置（石岛上）
    const pb = this.preBattle;
    this.preBattle = null;
    if (pb) {
      this.player.teleport(pb.x, pb.z, pb.yaw);
      this.follower.warp();
    }
    this.snapCamera();
    this.d.hud.setVisible(true);
    const won = r.result === 'win' && !!def && r.trainerId === def.id;
    if (won && def?.gym) await this.badgeCeremony(def.gym, def.name);
    this.inBattle = false;
    game.events.emit('battle:end', {
      result: r.result,
      entityId: r.entityId,
      ...(r.captured ? { capturedSpecies: r.captured.speciesId } : {}),
      ...(r.trainerId ? { trainerId: r.trainerId } : {}),
    });
  }

  /**
   * 道馆胜利仪式：馆主走到面前 → 授予徽章（徽章展示 + 音效）→ 讲解徽章效果与奖励。
   * 徽章 flag 在这里置位；奖励（招式学习器、水上骑乘能力）由任务系统在任务完成时发放。
   */
  private async badgeCeremony(gymId: string, leader: string): Promise<void> {
    const gym = GYMS.find((g) => g.id === gymId);
    if (!gym) return;
    const npc = [...this.npcs.manager.npcs.values()].find((n) => n.def.trainer && TRAINER_BY_ID.get(n.def.trainer)?.gym === gymId);
    const p = this.player.position;
    if (npc) {
      npc.face(Math.atan2(p.x - npc.position.x, p.z - npc.position.z));
      this.player.teleport(p.x, p.z, Math.atan2(npc.position.x - p.x, npc.position.z - p.z));
    }
    const speaker = `翠澜道馆馆主 ${leader}`;
    await say(this.d.ui, gym.ceremony?.win ?? ['精彩的对战。你和伙伴之间，流淌着和湖水一样深的信任。', '按照道馆的规矩，这枚徽章属于你了。'], { speaker });
    void jingle('jingle-badge');
    // 徽章不依赖任务目标顺序：直接置位；「水之试炼」以 badge-verdant 为 completeFlag，随之完成并发放奖励
    this.d.state.flags[gym.badgeFlag] = true;
    this.d.game.events.emit('flag:set', { flag: gym.badgeFlag, value: true });
    this.d.game.events.emit('gym:badge', { gym: gym.id, badgeFlag: gym.badgeFlag });
    await say(this.d.ui, [`获得了「${gym.badgeName ?? '翠澜徽章'}」！`], { speaker: '' });
    await say(
      this.d.ui,
      gym.ceremony?.effect ?? ['有了翠澜徽章，伙伴们会更信任你，等级 20 以内的宝可梦都会乖乖听话。', '另外，收下这个吧——招式学习器「水之波动」，还有「冲浪」的骑乘许可。', '驾着水上的伙伴，湖对岸、海上的小岛，你都能去看看了。'],
      { speaker },
    );
  }

  private insideBox(c: { x: number; z: number; hx: number; hz: number; yaw: number }, x: number, z: number, r: number): boolean {
    const s = Math.sin(-c.yaw);
    const co = Math.cos(-c.yaw);
    const lx = (x - c.x) * co - (z - c.z) * s;
    const lz = (x - c.x) * s + (z - c.z) * co;
    return Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r;
  }

  dispose(): void {
    this.healMachine?.dispose();
    this.healMachine = null;
    this.starterTable?.dispose();
    this.starterTable = null;
    if (TrainerBattles.current === this.trainers) TrainerBattles.current = this.prevTrainers;
    this.puzzle?.dispose();
    this.puzzle = null;
    this.field.dispose();
    this.follower.dispose();
    this.npcs.dispose();
    this.interactions.dispose();
    this.built?.dispose();
    this.built = null;
    this.post.dispose();
    this.player.root.removeFromParent();
  }
}
