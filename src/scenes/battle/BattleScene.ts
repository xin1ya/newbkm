/**
 * SCN-001 · 战斗场景（叠加在大地图之上的 Scene）。
 * 流程：转场 → 就地展开战斗场 → 野生个体走位 / 我方出场 → 指令循环（战斗/背包/宝可梦/逃跑）
 *      → 事件逐条播放（文字 + 镜头 + 特效 + HP 动画）→ 学招 / 进化 → 收场 → host.finish(result)
 * 战斗逻辑全部在 systems/battle（纯逻辑），这里只负责表现与玩家输入。
 */
import * as THREE from 'three';
import { autoSwitchIndex, decideAutoAction, type AutoBattleConfig, type AutoGoal } from '@/systems/autobattle';
import type { Scene } from '@/core/scene/SceneManager';
import type { CameraRig } from '@/core/camera';
import type { Input } from '@/core/input';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { PokemonInstance } from '@/systems/pokemon';
import { displayName } from '@/systems/pokemon';
import { Battle, type BattleEvent, type SideId, type TrainerInfo, type Weather } from '@/systems/battle';
import { checkEvolution, evolve, expProgress } from '@/systems/progression';
import { fieldThrowMultiplier, isBall } from '@/systems/capture';
import { encounterOpening } from '@/systems/encounters';
import type { FieldWeather, TimeOfDay } from '@/systems/encounters';
import { addMoney, markCaught, markSeen, receivePokemon, removeItem, type GameState } from '@/systems/state';
import type { WildMon } from '@/world/spawns';
import type { PlayerController } from '@/actors/player';
import { say, choose, type UiRoot, type Transition } from '@/ui/core';
import {
  BattleHud,
  bagMenu,
  commandMenu,
  describeEvent,
  forgetMenu,
  moveMenu,
  partyMenu,
  type Command,
  type MessageContext,
} from '@/ui/battle';
import { TYPE_COLORS } from '@/core/assets';
import { ARENA_RADIUS, BattleArena } from './BattleArena';
import { ArenaOccluders } from './occluders';

/** 遮挡物隐藏半径 = 战斗场半径 + 余量（覆盖固定机位 ~8.4 m 与对方训练家站位） */
const OCCLUDER_MARGIN = 2.5;
import { jingle, sfx } from '@/core/audio';
import type { EventBus } from '@/core/events/EventBus';
import { BattleFx } from './BattleFx';
import { BattleActor, createMonModel } from './BattleActor';
import { preloadMonModels } from '@/actors/pokemon/monModel';

export type BattleResultKind = 'win' | 'lose' | 'run' | 'capture';

export interface BattleResult {
  result: BattleResultKind;
  entityId: number;
  captured?: PokemonInstance;
  /** 训练家对战胜利时的训练家 id（任务 defeat 触发，M1-16） */
  trainerId?: string;
}

/** 自动战斗驾驶员（场景层 SceneAutoBattle 提供） */
export interface BattleAutoPilot {
  readonly active: boolean;
  readonly config: AutoBattleConfig;
  /** 该野生个体的目标（null = 非目标，逃跑） */
  goalFor(speciesId: number, alpha: boolean): AutoGoal | null;
  /** 停止自动（原因显示给玩家） */
  stop(reason: string): void;
  /** 自动战斗中招式已满、放弃学习的新招式（停止时汇总提示） */
  missedMove?(monName: string, moveName: string): void;
}

export interface BattleHost {
  readonly world: THREE.Scene;
  readonly rig: CameraRig;
  readonly ui: UiRoot;
  readonly transition: Transition;
  readonly input: Input;
  readonly dex: Dex;
  readonly rng: Rng;
  /** M1-20 事件总线（battle:start / battle:victory → 音乐导演） */
  readonly events: EventBus;
  readonly state: GameState;
  readonly player: PlayerController;
  heightAt(x: number, z: number): number;
  timeOfDay(): TimeOfDay;
  fieldWeather(): FieldWeather;
  /** 渲染大地图（战斗叠加在其上） */
  renderWorld(alpha: number, dt: number): void;
  /** 大地图环境动画（天空 / 水面 / 植被风摆），战斗中继续 */
  animateWorld(dt: number): void;
  /** 战斗中继续推进场景角色（对方训练家走位 / 动作 / 表情） */
  animateActors?(dt: number): void;
  /** 战斗结束：host 负责出栈、移除实体、黑屏回复等 */
  finish(result: BattleResult): void;
  /**
   * 固定战斗舞台（M1-11 道馆）：返回玩家站位与朝向，战斗开始时玩家被移到这里、战斗场建在其前方；
   * 缺省 / null = 就地开战（大地图）。host 负责战斗结束后把玩家放回原处。
   */
  battleStage?(): { x: number; z: number; yaw: number; radius?: number | undefined } | null;
  /** 自动战斗（野生战斗中接管指令） */
  autoPilot?(): BattleAutoPilot | null;
}

/** 跟随宝可梦（M1-08）：作为首发时直接跑进战斗场，不扔球 */
export interface BattleFollower {
  root: THREE.Object3D;
  height: number;
  uid: string;
}

/** 对方训练家的场景模型（M1-10）：走到对面站位、登场动作、扔球、战败垂头 */
export interface BattleTrainerActor {
  walkTo(x: number, z: number, speed?: number): Promise<void>;
  setPose(x: number, z: number, yaw: number): void;
  gesture(kind: 'wave' | 'point' | 'flex' | 'bow' | 'throw' | 'slump'): Promise<void>;
  handPosition(): THREE.Vector3;
  /** 训练家模型根节点（战斗领域隐藏遮挡物时豁免） */
  readonly root?: THREE.Object3D;
}

export type BattleStartData = (
  | {
      kind: 'wild';
      wild: PokemonInstance;
      wildEntity: WildMon | null;
      initiative: 'player' | 'wild' | null;
      method: 'visible' | 'grass' | 'surf' | 'fish';
      entityId: number;
      wildPosition: { x: number; y: number; z: number };
      /** 野外 AI 状态（捕获情境系数） */
      sleeping?: boolean;
      alerted?: boolean;
      /** 头目已被能量方块安抚（计划文档 §9.5） */
      calmed?: boolean;
      /** M1-13/14 剧情战斗：禁止捕捉 / 逃跑（如索罗亚的信任之战） */
      scripted?: { noCapture?: boolean | undefined; noRun?: boolean | undefined; boss?: boolean | undefined } | undefined;
    }
  | {
      kind: 'trainer';
      trainer: TrainerInfo;
      party: PokemonInstance[];
      foePosition: { x: number; y: number; z: number };
      entityId: number;
      /** 战败台词（战斗中说） */
      defeatLines?: string[] | undefined;
      entrance?: 'wave' | 'point' | 'flex' | 'bow' | undefined;
      trainerActor?: BattleTrainerActor | null | undefined;
    }
) & { follower?: BattleFollower | null | undefined };

const FIELD_TO_BATTLE_WEATHER: Partial<Record<FieldWeather, Weather>> = {
  rain: 'rain',
  storm: 'rain',
  snow: 'hail',
  sandstorm: 'sand',
};
const WEATHER_ZH: Record<Weather, string> = { none: '', rain: '下雨', sun: '大晴天', sand: '沙暴', hail: '冰雹' };
const BALL_COLORS: Record<string, number> = {
  'poke-ball': 0xe8484a,
  'great-ball': 0x3a7bd5,
  'ultra-ball': 0x2d2d2d,
  'master-ball': 0x8a3ab8,
  'quick-ball': 0x3aa7d5,
  'net-ball': 0x38b8a8,
  'dusk-ball': 0x2f7a3a,
};

export class BattleScene implements Scene {
  readonly name = 'battle';
  private battle!: Battle;
  private arena!: BattleArena;
  private fx = new BattleFx();
  private hud!: BattleHud;
  private actors = new Map<string, BattleActor>();
  private activeUid: [string | null, string | null] = [null, null];
  private data!: BattleStartData;
  private msgCtx!: MessageContext;
  private lastCommand: Command = 'fight';
  /** 每只宝可梦上次使用的招式位置（光标记忆） */
  private lastMove = new Map<string, number>();
  private shotPos = new THREE.Vector3();
  private shotLook = new THREE.Vector3();
  private time = 0;
  private skip = false;
  /** 受击顿帧剩余时间（秒，真实时间） */
  private hitstop = 0;
  /** 本场升过级的我方宝可梦（战后进化判定） */
  private leveled = new Set<string>();
  private pendingBall: { ball: THREE.Group; itemId: string } | null = null;
  private moveColor = '#ffffff';
  /** 跟随宝可梦 uid（首次出场跑进场，之后按普通方式扔球） */
  private followerUid: string | null = null;
  private followerOut = false;
  /** 野生遭遇开场白已播放 */
  private opened = false;

  constructor(private readonly host: BattleHost) {}

  enter(_from: Scene | null, data?: unknown): void {
    this.data = data as BattleStartData;
    const { host } = this;
    const d = this.data;
    this.battleKind = d.kind === 'trainer' ? ((d.trainer.title ?? '').includes('馆主') ? 'gym' : 'trainer') : d.scripted?.boss ? 'boss' : 'wild';
    host.events.emit(
      'battle:start',
      d.kind === 'trainer' ? { kind: this.battleKind, trainerId: d.trainer.id } : { kind: this.battleKind },
    );
    const stage = host.battleStage?.() ?? null;
    if (stage) host.player.teleport(stage.x, stage.z, stage.yaw);
    const pp = host.player.position.clone();
    const foePos = d.kind === 'wild' ? d.wildPosition : d.foePosition;
    const toward = stage
      ? new THREE.Vector3(Math.sin(stage.yaw), 0, Math.cos(stage.yaw))
      : new THREE.Vector3(foePos.x - pp.x, 0, foePos.z - pp.z);
    if (toward.lengthSq() < 0.01) toward.set(Math.sin(host.player.facing), 0, Math.cos(host.player.facing));
    toward.normalize();
    // 训练家站在原地；战斗场中心在玩家前方 5.6 m
    const center = pp.clone().addScaledVector(toward, 5.6);
    this.arena = new BattleArena(center, toward, (x, z) => host.heightAt(x, z), undefined, stage?.radius);
    host.world.add(this.arena.group, this.fx.group);
    this.occluderRadius = (stage?.radius ?? ARENA_RADIUS) + OCCLUDER_MARGIN;

    const weather = FIELD_TO_BATTLE_WEATHER[host.fieldWeather()] ?? 'none';
    const foeParty = d.kind === 'wild' ? [d.wild] : d.party;
    const lead = host.state.party.find((p) => p.hp > 0);
    let captureMultiplier = 1;
    if (d.kind === 'wild') {
      captureMultiplier = fieldThrowMultiplier({
        sleeping: !!d.sleeping,
        fromBehind: d.initiative === 'player',
        levelAdvantage: lead ? lead.level - d.wild.level : 0,
        alerted: !!d.alerted,
        alpha: !!d.wild.alpha,
      });
    }
    this.battle = new Battle({
      dex: host.dex,
      rng: host.rng,
      kind: d.kind,
      player: { name: host.state.player.name, party: host.state.party },
      foe: d.kind === 'trainer' ? { party: foeParty, trainer: d.trainer } : { party: foeParty },
      weather,
      weatherPermanent: weather !== 'none',
      initiative: d.kind === 'wild' ? (d.initiative === 'player' ? 0 : d.initiative === 'wild' ? 1 : null) : null,
      isNight: host.timeOfDay() === 'night',
      captureMultiplier,
      foeAlpha: d.kind === 'wild' && d.wild.alpha ? (d.wild.alphaKind ?? 'roaming') : undefined,
      foeCalmed: d.kind === 'wild' && !!d.calmed,
    });
    this.msgCtx = {
      kind: d.kind,
      playerName: host.state.player.name,
      ...(d.kind === 'trainer' ? { foeTrainer: `${d.trainer.title ?? ''}${d.trainer.name}` } : {}),
    };
    for (const p of foeParty) markSeen(host.state, p.speciesId);
    this.hud = new BattleHud(host.ui);
    // 野外可见遭遇：借用世界里的模型
    if (d.kind === 'wild' && d.wildEntity) {
      const w = d.wildEntity;
      w.frozen = true;
      w.setEmote(null);
      this.actors.set(d.wild.uid, new BattleActor(w.root, w.height, true));
    }
    // 跟随宝可梦：借用模型，首发时从身后跑进战斗场
    if (d.follower && d.follower.uid === lead?.uid) {
      this.followerUid = d.follower.uid;
      this.actors.set(d.follower.uid, new BattleActor(d.follower.root, d.follower.height, true));
    }
    // 协程在场景切换完成后开始推进（SceneManager 切换期间不 update）
    void this.run().catch((err) => {
      console.error('[battle] 战斗流程异常', err);
      this.end({ result: 'run', entityId: this.data.entityId });
    });
  }

  exit(): void {
    this.occluders.restore();
    this.fx.clear();
    this.arena.dispose();
    this.fx.group.removeFromParent();
    this.hud.dispose();
    for (const a of this.actors.values()) a.release();
    this.actors.clear();
    this.host.rig.clearOverride();
  }

  update(dt: number): void {
    this.time += dt;
    const input = this.host.input;
    // 按住确认 / 取消键快进动画
    this.skip = input.pressed('run') || false;
    // 战斗速度（设置）× 快进 × 受击顿帧
    const stop = this.hitstop > 0 ? 0.05 : 1;
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.fx.speed = this.host.state.settings.battleSpeed * (this.skip ? 2.5 : 1) * stop;
    this.fx.update(dt);
    this.arena.update(dt);
    this.hud.update(dt * this.fx.speed);
    for (const a of this.actors.values()) a.update(dt * stop);
    this.host.player.update(dt);
    this.host.animateWorld(dt);
    this.host.animateActors?.(dt);
    this.host.rig.update(dt, null);
  }

  render(alpha: number, dt: number): void {
    this.host.renderWorld(alpha, dt);
  }

  // ———————————————————— 流程 ————————————————————

  private shot(kind: Parameters<BattleArena['shot']>[0], lerp = 0.6): void {
    const fov = this.arena.shot(kind, this.shotPos, this.shotLook);
    // 机位固定，转向 / 缩放放慢一些（lerp 上限 0.55），减少头晕
    this.host.rig.setOverride(this.shotPos, this.shotLook, lerp >= 1 ? 1 : Math.min(lerp, 0.55), fov);
  }

  /** 自动战斗驾驶员（仅野生战斗；玩家按返回 / 菜单键接管） */
  private get pilot(): BattleAutoPilot | null {
    if (this.data.kind !== 'wild') return null;
    const p = this.host.autoPilot?.() ?? null;
    return p?.active ? p : null;
  }

  private say(text: string | string[], wait = false): Promise<void> {
    // 自动战斗时所有对话自动翻页
    if (wait && this.pilot) wait = false;
    return say(this.host.ui, text, wait ? {} : { autoMs: this.skip ? 350 : Math.round(1000 / this.host.state.settings.battleSpeed) });
  }

  private async run(): Promise<void> {
    const { host, fx, arena } = this;
    const d = this.data;
    const alphaIntro = d.kind === 'wild' && !!d.wild.alpha;
    // 双方队伍的手工模型与过场动画并行加载（缓存命中时立即完成）
    const species = [...this.battle.sides[0].party, ...this.battle.sides[1].party].map((b) => b.pokemon.speciesId);
    await Promise.all([host.transition.battleIntro(900, alphaIntro), preloadMonModels(species)]);
    // 镜头切到侧面，展开战斗场
    this.shot('wide', 1);
    // 训练家站位即玩家当前位置（战斗场以玩家为基准展开），只需转身面向对手
    this.facePlayer(arena.spots.foe);
    const revealP = host.transition.battleReveal(400);
    this.hideOccluders();
    await fx.tween(0.9, (k) => arena.setReveal(k));
    await revealP;

    // 训练家：走到对面站位 → 登场动作
    if (d.kind === 'trainer' && d.trainerActor) {
      const ta = d.trainerActor;
      const ft = arena.spots.foeTrainer;
      this.shot('wide', 0.7);
      await Promise.race([ta.walkTo(ft.x, ft.z, 3.6), fx.wait(3)]);
      const pp = host.player.position;
      ta.setPose(ft.x, ft.z, Math.atan2(pp.x - ft.x, pp.z - ft.z));
      this.shot('foe', 0.7);
      await ta.gesture(d.entrance ?? 'point');
    }

    // 对方就位
    const foeMon = this.battle.active(1).pokemon;
    let foeActor = this.actors.get(foeMon.uid);
    if (foeActor) {
      const from = foeActor.root.position.clone();
      const to = arena.spots.foe;
      foeActor.idle = false;
      await fx.tween(0.6, (k) => {
        foeActor!.root.position.lerpVectors(from, to, k);
        foeActor!.root.position.y = host.heightAt(foeActor!.root.position.x, foeActor!.root.position.z);
      });
      foeActor.place(to, arena.spots.mine);
      foeActor.idle = true;
    } else if (d.kind === 'wild') {
      foeActor = this.spawnActor(foeMon, 1);
      foeActor.place(arena.spots.foe, arena.spots.mine);
      await foeActor.appear(fx);
    }
    this.shot('intro', 0.8);
    if (d.kind === 'trainer') await this.say(`${this.msgCtx.foeTrainer}向你发起了对战！`);

    await this.play(this.battle.start());

    // 指令循环
    for (;;) {
      await this.resolvePendingLearns();
      const req = this.battle.request(0);
      if (req.kind === 'ended') break;
      if (req.kind === 'wait') {
        await fx.wait(0.1);
        continue;
      }
      if (req.kind === 'switch' && this.pilot) {
        const idx = autoSwitchIndex(this.battle);
        if (idx !== null) {
          await this.play(this.battle.submitSwitch(0, idx));
          continue;
        }
      }
      if (req.kind === 'switch') {
        const idx = await partyMenu(host.ui, host.dex, host.state.party, this.battle.sides[0].active, true);
        if (idx === null) continue;
        await this.play(this.battle.submitSwitch(0, idx));
        continue;
      }
      this.shot('command');
      if (req.forced) {
        await this.play(this.battle.submit({ type: 'move', moveIndex: 0 }));
        continue;
      }
      // 自动战斗：返回 / 菜单键接管
      const pilot = this.pilot;
      if (pilot && (host.input.pressed('back') || host.input.pressed('menu'))) pilot.stop('已切换为手动操作');
      else if (pilot && this.data.kind === 'wild') {
        const wild = this.data.wild;
        const dec = decideAutoAction(this.battle, req, pilot.goalFor(wild.speciesId, !!wild.alpha), pilot.config, host.state.bag);
        if (dec.kind === 'stop') pilot.stop(dec.reason);
        else {
          await fx.wait(0.25);
          const act = dec.action;
          if (act.type === 'ball') {
            removeItem(host.state, act.itemId);
            this.pendingBall = null;
            await this.play(this.battle.submit(act), act.itemId);
          } else {
            if (act.type === 'item') removeItem(host.state, act.itemId);
            await this.play(this.battle.submit(act));
          }
          continue;
        }
      }
      const scripted = this.data.kind === 'wild' ? this.data.scripted : undefined;
      const canRun = req.canRun && !scripted?.noRun;
      const canCatch = req.canCatch && !scripted?.noCapture;
      const cmd = await commandMenu(host.ui, { canRun, canSwitch: req.canSwitch, canCatch, initial: this.lastCommand });
      if (!cmd) continue;
      this.lastCommand = cmd;
      if (cmd === 'fight') {
        const uid = this.battle.active(0).pokemon.uid;
        // 招式菜单标出对当前对手的效果（效果绝佳 / 不好 / 没有效果）
        const foe = this.battle.active(1);
        const idx = await moveMenu(host.ui, host.dex, req.moves, this.lastMove.get(uid) ?? 0, {
          foeTypes: this.battle.types(foe),
          foeName: displayName(host.dex, foe.pokemon),
          userTypes: this.battle.types(this.battle.active(0)),
        });
        if (idx === null) continue;
        this.lastMove.set(uid, idx);
        await this.play(this.battle.submit({ type: 'move', moveIndex: idx }));
      } else if (cmd === 'bag') {
        const item = await bagMenu(host.ui, host.dex, host.state.bag, canCatch);
        if (!item) continue;
        if (isBall(item)) {
          removeItem(host.state, item);
          this.pendingBall = null;
          await this.play(this.battle.submit({ type: 'ball', itemId: item }), item);
        } else {
          const target = await partyMenu(host.ui, host.dex, host.state.party, -1, false);
          if (target === null) continue;
          removeItem(host.state, item);
          await this.play(this.battle.submit({ type: 'item', itemId: item, partyIndex: target }));
        }
      } else if (cmd === 'party') {
        const idx = await partyMenu(host.ui, host.dex, host.state.party, this.battle.sides[0].active, false);
        if (idx === null) continue;
        await this.play(this.battle.submit({ type: 'switch', partyIndex: idx }));
      } else if (cmd === 'run') {
        await this.play(this.battle.submit({ type: 'run' }));
      }
    }
    await this.resolvePendingLearns();
    await this.conclude();
  }

  private facePlayer(target: THREE.Vector3): void {
    const p = this.host.player;
    p.facing = Math.atan2(target.x - p.position.x, target.z - p.position.z);
  }

  private spawnActor(p: PokemonInstance, side: SideId): BattleActor {
    const model = createMonModel(this.host.dex, p);
    model.visible = false;
    this.host.world.add(model);
    const a = new BattleActor(model, model.userData.height as number, false);
    this.actors.set(p.uid, a);
    const spot = side === 0 ? this.arena.spots.mine : this.arena.spots.foe;
    const face = side === 0 ? this.arena.spots.foe : this.arena.spots.mine;
    a.place(spot, face);
    return a;
  }

  /** 战斗领域展开：隐藏圈内（含机位余量）的遮挡物；战斗双方、训练家、战斗场本身豁免 */
  private readonly occluders = new ArenaOccluders();
  private occluderRadius = ARENA_RADIUS + OCCLUDER_MARGIN;
  private hideOccluders(): void {
    const d = this.data;
    const keep: Array<THREE.Object3D | null | undefined> = [this.arena.group, this.fx.group, this.host.player.root];
    for (const a of this.actors.values()) keep.push(a.root);
    if (d.kind === 'trainer') keep.push(d.trainerActor?.root);
    this.occluders.hide(this.host.world, this.arena.spots.center, this.occluderRadius, keep);
  }

  private actorOf(side: SideId): BattleActor | null {
    const uid = this.activeUid[side];
    return uid ? (this.actors.get(uid) ?? null) : null;
  }

  private monByUid(uid: string): PokemonInstance | undefined {
    for (const s of this.battle.sides) for (const m of s.party) if (m.pokemon.uid === uid) return m.pokemon;
    return undefined;
  }

  private refreshPanel(side: SideId, instant: boolean): void {
    const m = this.battle.active(side);
    const p = m.pokemon;
    const sideData = this.battle.sides[side];
    this.hud.panel(side).set(
      {
        name: this.battle.name(m),
        level: p.level,
        gender: p.gender,
        hp: p.hp,
        maxHp: this.battle.maxHp(m),
        status: p.status?.kind ?? null,
        alpha: !!p.alpha,
        shiny: p.shiny,
        ...(side === 0 ? { exp: expProgress(this.host.dex, p).ratio } : {}),
        ...(sideData.kind !== 'wild' ? { party: sideData.party.map((x) => x.pokemon.hp > 0) } : {}),
      },
      instant,
    );
  }

  /** 异色闪光：音效 + 四角星（野生遭遇开场 / 出场时） */
  private shinyFx(a: { feet: THREE.Vector3; height: number }): Promise<void> {
    sfx('shiny');
    return this.fx.shinySparkle(a.feet, a.height);
  }

  // ———————————————————— 事件播放 ————————————————————

  private async play(events: BattleEvent[], ballItem?: string): Promise<void> {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      await this.animate(e, events[i + 1], ballItem);
      const text = describeEvent(e, this.msgCtx);
      if (text && e.type !== 'switch-in' && e.type !== 'move' && e.type !== 'ball-throw') await this.say(text);
    }
    this.hud.setTurn(this.battle.turn, WEATHER_ZH[this.battle.weather]);
  }

  private async animate(e: BattleEvent, next: BattleEvent | undefined, ballItem?: string): Promise<void> {
    const { fx, arena, hud } = this;
    switch (e.type) {
      case 'switch-in': {
        const p = this.monByUid(e.uid);
        if (!p) return;
        sfx('ball-open');
        this.activeUid[e.side] = e.uid;
        let a = this.actors.get(e.uid);
        const text = describeEvent(e, this.msgCtx);
        if (e.side === 0) {
          this.shot('mine');
          if (text) void this.say(text);
          if (a && e.uid === this.followerUid && !this.followerOut && a.root.visible) {
            // 跟随宝可梦从身后跑进战斗场
            this.followerOut = true;
            const from = a.root.position.clone();
            const to = arena.spots.mine;
            a.idle = false;
            a.root.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
            await fx.tween(0.65, (k) => {
              a!.root.position.lerpVectors(from, to, k);
              a!.root.position.y =
                this.host.heightAt(a!.root.position.x, a!.root.position.z) + Math.abs(Math.sin(k * Math.PI * 3)) * 0.18;
            });
            a.place(to, arena.spots.foe);
            a.idle = true;
            await a.hop(fx);
          } else {
            if (!a) a = this.spawnActor(p, 0);
            a.place(arena.spots.mine, arena.spots.foe);
            const ball = await fx.throwBall(
              this.host.player.eye(),
              arena.spots.mine.clone().setY(arena.spots.mine.y + 0.6),
            );
            fx.disposeBall(ball);
            await a.appear(fx);
          }
          // 我方异色宝可梦出场同样闪光
          if (p.shiny) await this.shinyFx(a);
        } else {
          this.shot('foe');
          const d = this.data;
          const ta = d.kind === 'trainer' ? d.trainerActor : null;
          if (!a) {
            a = this.spawnActor(p, 1);
            a.place(arena.spots.foe, arena.spots.mine);
            if (ta) {
              // 训练家扔球
              void ta.gesture('throw');
              await fx.wait(0.45);
              const ball = await fx.throwBall(ta.handPosition(), arena.spots.foe.clone().setY(arena.spots.foe.y + 0.6));
              fx.disposeBall(ball);
            }
            await a.appear(fx);
            // 训练家的异色宝可梦
            if (p.shiny && d.kind !== 'wild') await this.shinyFx(a);
          } else if (!a.root.visible) await a.appear(fx);
          if (d.kind === 'wild' && !this.opened) {
            this.opened = true;
            const lines = encounterOpening({
              name: p === d.wild ? displayName(this.host.dex, p) : e.name,
              method: d.method,
              initiative: d.initiative,
              sleeping: !!d.sleeping,
              alpha: !!d.wild.alpha,
              shiny: !!d.wild.shiny,
            });
            if (d.wild.shiny) await this.shinyFx(a);
            await this.say(lines, false);
          } else if (text) await this.say(text);
        }
        this.refreshPanel(e.side, true);
        hud.panel(e.side).show(true);
        return;
      }
      case 'switch-out': {
        const a = this.actorOf(e.side);
        if (a) await a.recall(fx);
        hud.panel(e.side).show(false);
        return;
      }
      case 'move': {
        const attacker = this.actorOf(e.side);
        const target = this.actorOf((1 - e.side) as SideId);
        const md = this.host.dex.move(e.move);
        this.moveColor = TYPE_COLORS[md.type] ?? '#ffffff';
        this.shot(e.side === 0 ? 'mine' : 'foe', 0.8);
        await this.say(describeEvent(e, this.msgCtx) ?? '');
        if (!attacker) return;
        // 设置里关闭了战斗动画：跳过招式演出
        if (!this.host.state.settings.battleAnims) return;
        const selfTarget =
          md.target === 'user' ||
          md.target === 'users-field' ||
          md.target === 'user-and-allies' ||
          md.target === 'entire-field';
        if (md.category === 'status' || !target) {
          await attacker.hop(fx);
          if (selfTarget || !target)
            await fx.burst(attacker.chest, this.moveColor, { count: 36, radius: 1.2, up: 0.8 });
          else await fx.projectile(attacker.chest, target.chest, this.moveColor, { size: 0.18, arc: 1.2 });
          return;
        }
        this.shot('wide', 0.9);
        if (md.category === 'physical' && md.flags.contact) await attacker.lunge(fx, target.feet);
        else if (md.power >= 90) {
          await attacker.cast(fx);
          await fx.beam(attacker.chest, target.chest, this.moveColor, 0.55);
        } else {
          await attacker.cast(fx);
          await fx.projectile(attacker.chest, target.chest, this.moveColor, {
            arc: md.category === 'physical' ? 1.5 : 0.5,
          });
        }
        return;
      }
      case 'charge': {
        const a = this.actorOf(e.side);
        if (a) await fx.burst(a.chest, 0xffffff, { count: 24, radius: 0.8, up: 1 });
        return;
      }
      case 'damage': {
        const a = this.actorOf(e.side);
        const strong = !!e.crit || (e.effectiveness ?? 1) > 1;
        if (e.source === 'move') sfx(strong ? 'hit-strong' : (e.effectiveness ?? 1) < 1 ? 'hit-weak' : 'hit');
        if (a && e.source === 'move') {
          void fx.burst(a.chest, this.moveColor, { count: strong ? 60 : 36, radius: strong ? 1.8 : 1.2 });
          // 打击感：顿帧 + 视野冲击（暴击 / 效果绝佳更重）+ 震屏
          this.hitstop = strong ? 0.12 : 0.06;
          this.host.rig.punch(strong ? 4.5 : 1.6, strong ? 0.3 : 0.18);
          if (strong) this.host.rig.shake(0.18, 0.35);
          await Promise.all([a.hit(fx, strong), hud.panel(e.side).tweenTo(e.hp, e.maxHp)]);
        } else {
          if (a) void a.hit(fx, false);
          await hud.panel(e.side).tweenTo(e.hp, e.maxHp);
        }
        return;
      }
      case 'heal': {
        sfx('heal');
        const a = this.actorOf(e.side);
        if (a) void fx.heal(a.feet, a.height);
        await hud.panel(e.side).tweenTo(e.hp, e.maxHp);
        return;
      }
      case 'status': {
        const a = this.actorOf(e.side);
        const c: Record<string, number> = {
          brn: 0xff7a3a,
          par: 0xf6d845,
          psn: 0xb05ad8,
          tox: 0x8a2ab8,
          slp: 0xaab0d0,
          frz: 0x9fe6ff,
        };
        if (a) await fx.burst(a.chest, c[e.status] ?? 0xffffff, { count: 30, radius: 0.9 });
        hud.panel(e.side).setStatus(e.status);
        return;
      }
      case 'cure':
        if (e.status !== 'confusion' && e.status !== 'attract') hud.panel(e.side).setStatus(null);
        return;
      case 'stage': {
        if (e.blocked) return;
        sfx(e.delta > 0 ? 'stat-up' : 'stat-down');
        const a = this.actorOf(e.side);
        if (a) await fx.stat(a.feet, a.height, e.delta > 0);
        return;
      }
      case 'miss': {
        return;
      }
      case 'faint': {
        sfx('faint');
        const a = this.actors.get(e.uid);
        if (a) await a.faint(fx);
        hud.panel(e.side).show(false);
        return;
      }
      case 'exp': {
        const p = this.monByUid(e.uid);
        if (p && this.host.state.party.includes(p)) sfx('exp');
        if (p && this.battle.active(0).pokemon.uid === e.uid) hud.me.setExp(expProgress(this.host.dex, p).ratio);
        return;
      }
      case 'level-up': {
        this.leveled.add(e.uid);
        void jingle('jingle-level');
        const a = this.actors.get(e.uid);
        if (a && a.root.visible) void fx.stat(a.feet, a.height, true);
        if (this.battle.active(0).pokemon.uid === e.uid) this.refreshPanel(0, false);
        return;
      }
      case 'ball-throw': {
        const target = this.actorOf(1);
        if (!target) return;
        sfx('ball-throw');
        this.shot('capture', 0.8);
        await this.say(describeEvent(e, this.msgCtx) ?? '');
        const model = this.host.player.model;
        void fx.tween(0.5, (k) => model.throwPose(k));
        const itemId = ballItem ?? e.ball;
        const ball = await fx.throwBall(
          this.host.player.eye(),
          target.chest.add(new THREE.Vector3(0, 0.3, 0)),
          BALL_COLORS[itemId],
        );
        this.pendingBall = { ball, itemId };
        await target.absorb(fx, ball.position);
        await fx.ballDrop(ball, target.feet.y);
        return;
      }
      case 'capture': {
        const target = this.actorOf(1);
        const pb = this.pendingBall;
        if (!pb) return;
        const shakes = Math.min(3, e.shakes);
        // 悬念：每次摇晃前的停顿越来越长，镜头逐次轻推
        for (let i = 0; i < shakes; i++) {
          await fx.wait(0.2 + i * 0.25);
          sfx('ball-shake');
          this.host.rig.punch(1.2 + i * 0.9, 0.5);
          await fx.ballShake(pb.ball);
        }
        if (e.success) {
          await fx.wait(0.35);
          sfx('ball-click');
          this.hitstop = 0.1;
          this.host.rig.punch(3, 0.35);
          void fx.burst(pb.ball.position, 0xffffff, { count: 24, radius: 0.6, up: 1.2 });
          void jingle('jingle-catch');
          await fx.burst(pb.ball.position, 0xfff3a0, { count: 40, radius: 1.2, up: 0.6 });
        } else {
          sfx('ball-break');
          this.host.rig.shake(0.1, 0.25);
          fx.disposeBall(pb.ball);
          this.pendingBall = null;
          if (target) await target.breakFree(fx);
        }
        return;
      }
      case 'item-use': {
        const a = this.actorOf(0);
        if (a) void fx.heal(a.feet, a.height);
        return;
      }
      case 'turn':
        hud.setTurn(e.turn, WEATHER_ZH[this.battle.weather]);
        return;
      case 'end':
        return;
      default:
        void next;
        return;
    }
  }

  // ———————————————————— 学招 / 收场 ————————————————————

  private async resolvePendingLearns(): Promise<void> {
    const { host } = this;
    while (this.battle.pendingLearns.length) {
      const pl = this.battle.pendingLearns[0]!;
      const p = this.monByUid(pl.uid);
      if (!p) {
        this.battle.resolveLearn(pl.uid, pl.move, null);
        continue;
      }
      const name = displayName(host.dex, p);
      const mv = host.dex.move(pl.move).name.zh;
      if (this.pilot) {
        // 自动战斗：不打断，放弃学习（之后可在回忆招式处补学）
        this.battle.resolveLearn(pl.uid, pl.move, null);
        this.pilot.missedMove?.(name, mv);
        await this.say(`${name}想学习「${mv}」，但招式已满——自动战斗中不学习，之后可以找宝可梦中心的回想老人补学。`);
        continue;
      }
      await this.say([`${name}想要学习新招式「${mv}」。`, `但是${name}已经学会了 4 个招式……`], true);
      const yes = await choose(
        host.ui,
        [
          { label: '忘记一个招式', value: true },
          { label: `放弃学习「${mv}」`, value: false },
        ],
        { cancellable: false },
      );
      if (!yes) {
        this.battle.resolveLearn(pl.uid, pl.move, null);
        await this.say(`${name}没有学会「${mv}」。`);
        continue;
      }
      const idx = await forgetMenu(host.ui, host.dex, p, pl.move);
      if (idx === null) {
        this.battle.resolveLearn(pl.uid, pl.move, null);
        await this.say(`${name}没有学会「${mv}」。`);
        continue;
      }
      const old = host.dex.move(p.moves[idx]!.id).name.zh;
      this.battle.resolveLearn(pl.uid, pl.move, idx);
      await this.say([`1、2……噗！`, `${name}忘记了「${old}」，学会了「${mv}」！`], true);
    }
  }

  /** M1-20 战斗类型（选 BGM） */
  battleKind: 'wild' | 'trainer' | 'gym' | 'boss' = 'wild';

  private async conclude(): Promise<void> {
    const { host, fx } = this;
    const d = this.data;
    const outcome = this.battle.outcome;
    let result: BattleResult = { result: 'run', entityId: d.entityId };
    if (outcome?.winner === 0 || (outcome?.reason === 'capture' && this.battle.captured))
      host.events.emit('battle:victory', { kind: this.battleKind });
    if (outcome?.reason === 'capture' && this.battle.captured) {
      const mon = this.battle.captured;
      markCaught(host.state, mon.speciesId);
      const where = receivePokemon(host.state, mon);
      const name = displayName(host.dex, mon);
      await this.say(
        where === 'box'
          ? `${name}被送到了电脑的盒子里。`
          : where === 'full'
            ? `盒子已满，${name}被放生了……`
            : `${name}成为了伙伴！`,
        true,
      );
      if (this.pendingBall) fx.disposeBall(this.pendingBall.ball);
      this.pendingBall = null;
      result = { result: 'capture', entityId: d.entityId, captured: mon };
    } else if (outcome?.winner === 0) {
      result = { result: 'win', entityId: d.entityId };
      if (d.kind === 'trainer') {
        result.trainerId = d.trainer.id;
        const prize = d.trainer.prizeMoney ?? 0;
        if (d.trainerActor) {
          this.shot('foe', 0.7);
          void d.trainerActor.gesture('slump');
        }
        if (d.defeatLines?.length)
          await this.say(
            d.defeatLines.map((l) => `${this.msgCtx.foeTrainer}：「${l}」`),
            true,
          );
        await this.say(
          [`你战胜了${this.msgCtx.foeTrainer}！`, ...(prize > 0 ? [`获得了 ${prize} 元奖金。`] : [])],
          true,
        );
        if (prize > 0) addMoney(host.state, prize);
      }
    } else if (outcome?.winner === 1) {
      result = { result: 'lose', entityId: d.entityId };
      await this.say([`${host.state.player.name}已经没有可以战斗的宝可梦了！`, '眼前一片漆黑……'], true);
    }

    // 进化（胜利 / 捕获后，按升过级的宝可梦判定）
    if (result.result !== 'lose') {
      for (const uid of this.leveled) {
        const p = host.state.party.find((x) => x.uid === uid);
        if (!p || p.hp <= 0) continue;
        const to = checkEvolution(host.dex, p, { timeOfDay: host.timeOfDay() });
        if (to === null) continue;
        const before = displayName(host.dex, p);
        await this.say(`咦？${before}的样子……`, true);
        const from = p.speciesId;
        const r = evolve(host.dex, p, to);
        host.events.emit('pokemon:evolve', { uid: p.uid, from, to });
        markSeen(host.state, to);
        markCaught(host.state, to);
        await this.say(`恭喜！${before}进化成了${host.dex.species(to).name.zh}！`, true);
        for (const m of r.learned) await this.say(`${displayName(host.dex, p)}学会了「${host.dex.move(m).name.zh}」！`);
      }
    }

    // 收场：我方收回、战斗场收起
    const mine = this.actorOf(0);
    if (mine && mine.root.visible && result.result !== 'lose') await mine.recall(fx);
    this.hud.me.show(false);
    this.hud.foe.show(false);
    if (result.result === 'run' && d.kind === 'wild' && d.wildEntity) {
      // 野生个体原地保留，恢复 AI
      d.wildEntity.frozen = false;
    }
    await fx.tween(0.5, (k) => this.arena.setReveal(1 - k));
    this.occluders.restore();
    this.end(result);
  }

  private ended = false;
  private end(result: BattleResult): void {
    if (this.ended) return;
    this.ended = true;
    this.host.finish(result);
  }
}
