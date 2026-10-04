/**
 * SYS-003 · 战斗引擎（1v1 单打、回合制，全保真规则见 07-21 §4.1）。
 *
 * 用法：
 *   const battle = new Battle(setup);
 *   const events = battle.start();
 *   const req = battle.request(0);            // 玩家当前需要做什么
 *   battle.submit({ type: 'move', moveIndex: 0 });   // 对手行动由 AI 决定
 *   battle.submitSwitch(0, 1);                // 濒死 / U 型回转后的换人
 *
 * 引擎只产生结构化事件（BattleEvent），不含任何渲染或 UI 文案；
 * 场景层（scenes/battle）按事件顺序播放动画，UI 层（ui/battle/format.ts）把事件转换成中文文本。
 */
import { BERRY_BY_ID } from '@/config/berries';
import type { Dex } from '../data/Dex';
import type { MoveData, StatId, TypeId } from '../data/types';
import type { MajorStatus, PokemonInstance } from '../pokemon/Pokemon';
import { displayName, getStats, maxHp as instanceMaxHp } from '../pokemon/Pokemon';
import { accuracyStageMultiplier, stageMultiplier } from '../pokemon/stats';
import type { Rng } from '../rng';
import type { BattleApi, HitInfo } from './api';
import { getAbility, hasSecondary } from './abilities';
import { getItem } from './items';
import { calcDamage, confusionDamage, critStage, CRIT_CHANCES, isGrounded, rawStat } from './damage';
import {
  ailmentToStatus,
  ATTRACT_IMMOBILE_CHANCE,
  BURN_DAMAGE_FRACTION,
  CONFUSION_SELF_HIT_CHANCE,
  confusionDuration,
  FREEZE_THAW_CHANCE,
  PARALYSIS_FULL_CHANCE,
  PARALYSIS_SPEED_MULTIPLIER,
  POISON_DAMAGE_FRACTION,
  sleepDuration,
  toxicDamage,
  typeBlocksStatus,
} from './status';
import { takesWeatherDamage, WEATHER_MOVES, WEATHER_TURNS } from './status/weather';
import {
  BINDING_MOVES,
  DEFROST_MOVES,
  EXPLOSION_MOVES,
  HITS_AIRBORNE,
  isSelfTargeting,
  OHKO_MOVES,
  PIVOT_MOVES,
  POWDER_MOVES,
  PROTECT_MOVES,
  RAMPAGE_MOVES,
  RECHARGE_MOVES,
  ROLLOUT_MOVES,
  TWO_TURN_MOVES,
  SOUND_MOVES,
  SLEEP_USABLE,
  CALL_MOVE_BAN,
} from './moves';
import { attemptCapture, isBall } from '../capture';
import { expGain, gainEvs, gainExp } from '../progression';
import { chooseAction, chooseReplacement } from './ai';
import type {
  BattleAction,
  BattleEvent,
  BattleKind,
  BattleMon,
  BattleOutcome,
  DamageSource,
  Side,
  SideId,
  Terrain,
  TrainerInfo,
  Weather,
} from './types';
import { ALPHA_BATTLE } from '../alpha';
import { CALM_CAPTURE_BONUS } from '../blocks';
import { emptySideConditions, emptyStages, emptyVolatiles } from './types';

export interface BattleSetup {
  dex: Dex;
  rng: Rng;
  kind: BattleKind;
  player: { name: string; party: PokemonInstance[] };
  foe: { party: PokemonInstance[]; trainer?: TrainerInfo };
  /** 初始天气（来自大地图天气时为永久） */
  weather?: Weather;
  weatherPermanent?: boolean;
  /** 野外接触时的先手方（设计 §5.3），只影响第 1 回合同优先度内的顺序 */
  initiative?: SideId | null;
  isNight?: boolean;
  inCave?: boolean;
  /** 野外投球情境系数等额外捕获倍率 */
  captureMultiplier?: number;
  /** 关闭经验（测试 / 表演赛） */
  noExp?: boolean;
  /**
   * 野生头目（计划文档 §3.2）：开场头目气场双防 +1；巢穴头目第一次 HP 低于一半时咆哮，攻击 +1
   */
  foeAlpha?: 'den' | 'roaming' | undefined;
  /** 头目已被能量方块安抚（计划文档 §9.5）：开场不获得气场能力提升、不会咆哮，整场捕获率 ×1.3 */
  foeCalmed?: boolean | undefined;
}

export interface MoveOption {
  index: number;
  id: string;
  pp: number;
  maxPp: number;
  disabled: boolean;
  reason?: 'no-pp' | 'choice' | 'taunt' | 'torment';
}

export type BattleRequest =
  | { kind: 'action'; moves: MoveOption[]; forced: boolean; canSwitch: boolean; canRun: boolean; canCatch: boolean }
  | { kind: 'switch'; reason: 'faint' | 'pivot' }
  | { kind: 'wait' }
  | { kind: 'ended'; outcome: BattleOutcome };

interface QueuedAction {
  side: SideId;
  action: BattleAction;
  priority: number;
  speed: number;
  order: number;
}

export interface PendingLearn {
  uid: string;
  move: string;
}

export class Battle implements BattleApi {
  readonly dex: Dex;
  readonly rng: Rng;
  readonly kind: BattleKind;
  readonly sides: [Side, Side];
  readonly playerName: string;
  turn = 0;
  weather: Weather = 'none';
  /** null = 永久（场地天气） */
  weatherTurns: number | null = null;
  /** 场地（电气 / 青草场地，5 回合） */
  terrain: Terrain = 'none';
  private terrainTurns = 0;
  /** 戏法空间 / 重力剩余回合 */
  private trickRoom = 0;
  private gravity = 0;
  /** 祈愿：下回合末回复（按场地方位） */
  private wishes: [{ turns: number; amount: number } | null, { turns: number; amount: number } | null] = [null, null];
  /** 预知未来：2 回合后命中（按目标方位） */
  private futureSight: [{ turns: number; user: BattleMon } | null, { turns: number; user: BattleMon } | null] = [null, null];
  /** 场上最后使出的招式（仿效） */
  private lastMoveUsed: string | null = null;
  /** 战斗中被改写的特性 / 携带物，结束时还原 */
  private readonly abilityRestore = new Map<PokemonInstance, string>();
  private readonly itemRestore = new Map<PokemonInstance, string | null>();
  outcome: BattleOutcome | null = null;
  /** 等待玩家决定是否替换的新招式 */
  readonly pendingLearns: PendingLearn[] = [];
  /** 本场战斗中捕获的个体 */
  captured: PokemonInstance | null = null;

  private events: BattleEvent[] = [];
  private queue: QueuedAction[] = [];
  private pendingSwitch: { side: SideId; reason: 'faint' | 'pivot' } | null = null;
  private runAttempts = 0;
  /** 巢穴头目已经半血咆哮过 */
  private alphaEnraged = false;
  private readonly setup: BattleSetup;
  private started = false;

  constructor(setup: BattleSetup) {
    this.setup = setup;
    this.dex = setup.dex;
    this.rng = setup.rng;
    this.kind = setup.kind;
    this.playerName = setup.player.name;
    if (!setup.player.party.length || !setup.foe.party.length) throw new Error('Battle: 双方队伍都不能为空');
    const mk = (p: PokemonInstance, side: SideId, index: number): BattleMon => ({
      pokemon: p,
      side,
      index,
      stages: emptyStages(),
      v: emptyVolatiles(),
      toxicCounter: 0,
      turnsActive: 0,
      faced: new Set(),
      itemUsed: false,
    });
    const firstHealthy = (ps: PokemonInstance[]) => Math.max(0, ps.findIndex((p) => p.hp > 0));
    const foeSide: Side = {
      id: 1,
      kind: setup.kind === 'wild' ? 'wild' : 'trainer',
      party: setup.foe.party.map((p, i) => mk(p, 1, i)),
      active: firstHealthy(setup.foe.party),
      conditions: emptySideConditions(),
    };
    if (setup.foe.trainer) foeSide.trainer = { ...setup.foe.trainer, items: setup.foe.trainer.items?.map((i) => ({ ...i })) ?? [] };
    this.sides = [
      { id: 0, kind: 'player', party: setup.player.party.map((p, i) => mk(p, 0, i)), active: firstHealthy(setup.player.party), conditions: emptySideConditions() },
      foeSide,
    ];
  }

  // ———————————————————— 公共 API ————————————————————

  start(): BattleEvent[] {
    if (this.started) return [];
    this.started = true;
    this.emit({ type: 'start', kind: this.kind, weather: this.setup.weather ?? 'none' });
    if (this.setup.weather && this.setup.weather !== 'none') {
      this.weather = this.setup.weather;
      this.weatherTurns = this.setup.weatherPermanent === false ? WEATHER_TURNS : null;
      this.emit({ type: 'weather', weather: this.weather, source: 'field' });
    }
    if (!this.alive(0).length) {
      this.end(1, 'forced');
      return this.flush();
    }
    const a = this.active(0);
    const b = this.active(1);
    this.announceSwitchIn(b);
    this.announceSwitchIn(a);
    a.faced.add(b.pokemon.uid);
    b.faced.add(a.pokemon.uid);
    // 出场特性按速度顺序
    for (const m of this.bySpeed([a, b])) getAbility(m.pokemon.ability).onSwitchIn?.(this, m);
    if (this.setup.foeAlpha && this.setup.foeCalmed) {
      this.emit({ type: 'message', text: `${this.name(b)}还沉浸在能量方块的美味里，没有摆出头目的架势。` });
    } else if (this.setup.foeAlpha) {
      this.emit({ type: 'message', text: `${this.name(b)}散发出头目的气场！` });
      for (const o of ALPHA_BATTLE.opening) this.boost(b, o.stat, o.delta, false);
    }
    return this.flush();
  }

  active(side: SideId): BattleMon {
    const s = this.sides[side];
    const m = s.party[s.active];
    if (!m) throw new Error('Battle: 无效的出场位置');
    return m;
  }

  request(side: SideId): BattleRequest {
    if (this.outcome) return { kind: 'ended', outcome: this.outcome };
    if (this.pendingSwitch) {
      return this.pendingSwitch.side === side ? { kind: 'switch', reason: this.pendingSwitch.reason } : { kind: 'wait' };
    }
    const mon = this.active(side);
    const moves = this.moveOptions(mon);
    const forced = this.forcedMove(mon) !== null;
    const bound = mon.v.bound !== null;
    return {
      kind: 'action',
      moves,
      forced,
      canSwitch: !forced && !bound && this.alive(side).some((m) => m !== mon),
      canRun: this.kind === 'wild' && !forced,
      canCatch: this.kind === 'wild' && side === 0 && !forced,
    };
  }

  /** 玩家（side 0）提交行动；对手行动由 AI 决定，也可以显式传入（测试 / 回放） */
  submit(playerAction: BattleAction, foeAction?: BattleAction): BattleEvent[] {
    if (this.outcome) return [];
    if (this.pendingSwitch) throw new Error('Battle: 需要先完成换人（submitSwitch）');
    const pa = this.validate(0, playerAction);
    const fa = foeAction ? this.validate(1, foeAction) : this.validate(1, chooseAction(this, 1));
    this.turn++;
    this.emit({ type: 'turn', turn: this.turn });
    for (const s of this.sides) {
      const m = s.party[s.active];
      if (m) {
        m.v.damagedThisTurn = false;
        m.v.movedThisTurn = false;
        m.v.plannedMove = null;
      }
    }
    const actions: QueuedAction[] = [
      { side: 0, action: pa, priority: 0, speed: 0, order: 0 },
      { side: 1, action: fa, priority: 0, speed: 0, order: 1 },
    ];
    for (const q of actions) {
      const mon = this.active(q.side);
      q.priority = this.actionPriority(mon, q.action);
      q.speed = this.effectiveSpeed(mon);
      if (q.action.type === 'move') mon.v.plannedMove = this.resolveMoveId(mon, q.action.moveIndex);
    }
    const tie = this.rng.next() < 0.5;
    actions.sort((x, y) => {
      if (x.priority !== y.priority) return y.priority - x.priority;
      if (this.turn === 1 && this.setup.initiative != null && x.priority < 6) return x.side === this.setup.initiative ? -1 : 1;
      if (x.speed !== y.speed) return (this.trickRoom > 0 ? -1 : 1) * (y.speed - x.speed);
      return tie ? x.order - y.order : y.order - x.order;
    });
    this.queue = actions;
    this.continueTurn();
    return this.flush();
  }

  /** 濒死或 U 型回转后提交换人 */
  submitSwitch(side: SideId, partyIndex: number): BattleEvent[] {
    if (!this.pendingSwitch || this.pendingSwitch.side !== side) throw new Error('Battle: 当前不需要换人');
    const target = this.sides[side].party[partyIndex];
    if (!target || target.pokemon.hp <= 0 || partyIndex === this.sides[side].active) throw new Error('Battle: 无效的换人目标');
    const reason = this.pendingSwitch.reason;
    this.pendingSwitch = null;
    this.doSwitch(side, partyIndex, reason === 'faint');
    if (reason === 'pivot') this.continueTurn();
    else this.afterFaintReplacements();
    return this.flush();
  }

  /** 玩家决定新招式（replaceIndex 为 null 表示放弃学习） */
  resolveLearn(uid: string, move: string, replaceIndex: number | null): boolean {
    const i = this.pendingLearns.findIndex((p) => p.uid === uid && p.move === move);
    if (i < 0) return false;
    this.pendingLearns.splice(i, 1);
    if (replaceIndex === null) return true;
    const mon = this.sides[0].party.find((m) => m.pokemon.uid === uid);
    if (!mon || replaceIndex < 0 || replaceIndex >= mon.pokemon.moves.length) return false;
    const pp = this.dex.move(move).pp;
    mon.pokemon.moves[replaceIndex] = { id: move, pp, maxPp: pp };
    return true;
  }

  /** 可用招式（AI 也调用） */
  moveOptions(mon: BattleMon): MoveOption[] {
    const item = getItem(mon);
    return mon.pokemon.moves.map((m, index) => {
      const move = this.dex.move(m.id);
      let reason: MoveOption['reason'];
      if (m.pp <= 0) reason = 'no-pp';
      else if (item.choice && mon.v.choiceLock && mon.v.choiceLock !== m.id) reason = 'choice';
      else if (mon.v.taunt > 0 && move.category === 'status') reason = 'taunt';
      else if (mon.v.torment && mon.v.lastMove === m.id) reason = 'torment';
      const o: MoveOption = { index, id: m.id, pp: m.pp, maxPp: m.maxPp, disabled: reason !== undefined };
      if (reason) o.reason = reason;
      return o;
    });
  }

  alive(side: SideId): BattleMon[] {
    return this.sides[side].party.filter((m) => m.pokemon.hp > 0);
  }

  // ———————————————————— BattleApi（供特性 / 携带物调用） ————————————————————

  emit(e: BattleEvent): void {
    this.events.push(e);
  }

  name(mon: BattleMon): string {
    return displayName(this.dex, mon.pokemon);
  }

  maxHp(mon: BattleMon): number {
    return instanceMaxHp(this.dex, mon.pokemon);
  }

  types(mon: BattleMon): TypeId[] {
    return mon.v.typeOverride ?? this.dex.species(mon.pokemon.speciesId).types;
  }

  foeOf(mon: BattleMon): BattleMon {
    return this.active(mon.side === 0 ? 1 : 0);
  }

  isActive(mon: BattleMon): boolean {
    return this.sides[mon.side].active === mon.index;
  }

  damage(mon: BattleMon, amount: number, source: DamageSource, extra: Partial<Extract<BattleEvent, { type: 'damage' }>> = {}): number {
    if (mon.pokemon.hp <= 0 || amount <= 0) return 0;
    const dealt = Math.min(mon.pokemon.hp, Math.floor(amount));
    mon.pokemon.hp -= dealt;
    this.emit({ type: 'damage', side: mon.side, name: this.name(mon), amount: dealt, hp: mon.pokemon.hp, maxHp: this.maxHp(mon), source, ...extra });
    if (mon.pokemon.hp <= 0) this.faint(mon);
    else {
      getItem(mon).onHpChange?.(this, mon);
      if (this.setup.foeAlpha === 'den' && !this.setup.foeCalmed && mon.side === 1 && !this.alphaEnraged && mon.pokemon.hp <= this.maxHp(mon) / 2) {
        this.alphaEnraged = true;
        this.emit({ type: 'message', text: `${this.name(mon)}愤怒地咆哮起来！` });
        this.boost(mon, ALPHA_BATTLE.enrage.stat, ALPHA_BATTLE.enrage.delta, false);
      }
    }
    return dealt;
  }

  heal(mon: BattleMon, amount: number, source: string): number {
    const max = this.maxHp(mon);
    if (mon.pokemon.hp <= 0 || mon.pokemon.hp >= max || amount <= 0) return 0;
    const healed = Math.min(max - mon.pokemon.hp, Math.floor(amount));
    mon.pokemon.hp += healed;
    this.emit({ type: 'heal', side: mon.side, name: this.name(mon), amount: healed, hp: mon.pokemon.hp, maxHp: max, source });
    return healed;
  }

  boost(mon: BattleMon, stat: StatId, delta: number, byFoe: boolean): number {
    if (mon.pokemon.hp <= 0 || delta === 0) return 0;
    if (mon.pokemon.ability === 'simple') delta *= 2; // 单纯：能力变化翻倍
    const name = this.name(mon);
    const cur = mon.stages[stat];
    if (delta < 0 && byFoe) {
      if (this.sides[mon.side].conditions.mist > 0) {
        this.emit({ type: 'stage', side: mon.side, name, stat, delta: 0, now: cur, blocked: 'mist' });
        return 0;
      }
      if (getAbility(mon.pokemon.ability).blocksStatDrop?.(stat)) {
        this.showAbility(mon);
        this.emit({ type: 'stage', side: mon.side, name, stat, delta: 0, now: cur, blocked: 'ability' });
        return 0;
      }
    }
    if (mon.pokemon.ability === 'simple') delta *= 2;
    const next = Math.max(-6, Math.min(6, cur + delta));
    if (next === cur) {
      this.emit({ type: 'stage', side: mon.side, name, stat, delta: 0, now: cur, blocked: delta > 0 ? 'max' : 'min' });
      return 0;
    }
    mon.stages[stat] = next;
    this.emit({ type: 'stage', side: mon.side, name, stat, delta: next - cur, now: next });
    return next - cur;
  }

  trySetStatus(mon: BattleMon, status: MajorStatus, source: BattleMon | null, silentFail = false): boolean {
    const name = this.name(mon);
    const fail = (reason: string) => {
      if (!silentFail && source) this.emit({ type: 'fail', side: mon.side, name, reason });
      return false;
    };
    if (mon.pokemon.hp <= 0) return false;
    if (mon.pokemon.status) {
      if (!silentFail && source) this.emit({ type: 'status-already', side: mon.side, name, status: mon.pokemon.status.kind });
      return false;
    }
    if (typeBlocksStatus(status, this.types(mon))) return fail('type-immune');
    if (source && source !== mon && this.sides[mon.side].conditions.safeguard > 0) return fail('safeguard');
    if (status === 'frz' && this.weather === 'sun') return fail('weather');
    if (getAbility(mon.pokemon.ability).blocksStatus?.(this, mon, status)) {
      if (!silentFail) this.showAbility(mon);
      return fail('ability');
    }
    mon.pokemon.status = { kind: status };
    if (status === 'slp') mon.pokemon.status.sleepTurns = sleepDuration(this.rng);
    if (status === 'tox') mon.toxicCounter = 0;
    this.emit({ type: 'status', side: mon.side, name, status });
    getItem(mon).onStatus?.(this, mon);
    return true;
  }

  tryConfuse(mon: BattleMon, source: BattleMon | null): boolean {
    if (mon.pokemon.hp <= 0 || mon.v.confusion > 0) {
      if (source && mon.v.confusion > 0) this.emit({ type: 'fail', side: mon.side, name: this.name(mon), reason: 'already-confused' });
      return false;
    }
    if (getAbility(mon.pokemon.ability).blocksConfusion) {
      this.showAbility(mon);
      return false;
    }
    if (source && source !== mon && this.sides[mon.side].conditions.safeguard > 0) return false;
    mon.v.confusion = confusionDuration(this.rng);
    this.emit({ type: 'volatile', side: mon.side, name: this.name(mon), volatile: 'confusion' });
    getItem(mon).onStatus?.(this, mon);
    return true;
  }

  cureStatus(mon: BattleMon): void {
    const st = mon.pokemon.status;
    if (!st) return;
    mon.pokemon.status = null;
    mon.toxicCounter = 0;
    this.emit({ type: 'cure', side: mon.side, name: this.name(mon), status: st.kind });
  }

  setWeather(w: Weather, source: 'move' | 'ability', by: BattleMon): boolean {
    if (this.weather === w) return false;
    this.weather = w;
    this.weatherTurns = w === 'none' ? null : WEATHER_TURNS;
    this.emit({ type: 'weather', weather: w, source, by: this.name(by) });
    return true;
  }

  showAbility(mon: BattleMon): void {
    const a = this.dex.ability(mon.pokemon.ability);
    this.emit({ type: 'ability', side: mon.side, name: this.name(mon), ability: mon.pokemon.ability, abilityName: a?.name.zh ?? mon.pokemon.ability });
  }

  showItem(mon: BattleMon, consumed: boolean): void {
    const id = mon.pokemon.heldItem ?? '';
    const it = this.dex.item(id);
    this.emit({ type: 'item', side: mon.side, name: this.name(mon), item: id, itemName: it?.name.zh ?? BERRY_BY_ID.get(id)?.name ?? id, consumed });
  }

  // ———————————————————— 回合流程 ————————————————————

  private flush(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private validate(side: SideId, a: BattleAction): BattleAction {
    const mon = this.active(side);
    if (this.forcedMove(mon)) return { type: 'move', moveIndex: 0 };
    if (a.type === 'move') {
      const opts = this.moveOptions(mon);
      const o = opts[a.moveIndex];
      if (!o || o.disabled) {
        // 全部不可用 → 挣扎；否则非法输入
        if (opts.every((x) => x.disabled)) return { type: 'move', moveIndex: -1 };
        throw new Error(`Battle: 招式 ${a.moveIndex} 当前不可用（${o?.reason ?? '不存在'}）`);
      }
    }
    if (a.type === 'switch') {
      const t = this.sides[side].party[a.partyIndex];
      if (!t || t.pokemon.hp <= 0 || a.partyIndex === this.sides[side].active) throw new Error('Battle: 无效的换人目标');
      if (mon.v.bound) throw new Error('Battle: 被束缚时无法替换');
    }
    if ((a.type === 'run' || a.type === 'ball') && this.kind !== 'wild') {
      // 训练家战：仍然允许提交，由执行阶段给出失败提示（与正作一致）
    }
    return a;
  }

  private actionPriority(mon: BattleMon, a: BattleAction): number {
    if (a.type !== 'move') return a.type === 'run' ? 8 : a.type === 'switch' ? 7 : 6;
    const id = this.resolveMoveId(mon, a.moveIndex);
    return this.dex.move(id).priority;
  }

  private resolveMoveId(mon: BattleMon, moveIndex: number): string {
    const forced = this.forcedMove(mon);
    if (forced) return forced;
    if (moveIndex < 0) return 'struggle';
    return mon.pokemon.moves[moveIndex]?.id ?? 'struggle';
  }

  /** 蓄力第二回合 / 连续招式锁定 */
  private forcedMove(mon: BattleMon): string | null {
    if (mon.v.charging) return mon.v.charging;
    if (mon.v.locked) return mon.v.locked.move;
    if (mon.v.recharge) return 'recharge';
    if (mon.v.encore) {
      const slot = mon.pokemon.moves.find((m) => m.id === mon.v.encore!.move);
      if (slot && slot.pp > 0) return slot.id;
      mon.v.encore = null;
    }
    return null;
  }

  effectiveSpeed(mon: BattleMon): number {
    let s = rawStat(this, mon, 'spe') * stageMultiplier(mon.stages.spe);
    s *= getAbility(mon.pokemon.ability).modifySpeed?.(this, mon) ?? 1;
    s *= getItem(mon).modifySpeed?.(mon) ?? 1;
    if (mon.pokemon.status?.kind === 'par' && mon.pokemon.ability !== 'quick-feet') s *= PARALYSIS_SPEED_MULTIPLIER;
    if (this.sides[mon.side].conditions.tailwind > 0) s *= 2;
    return Math.floor(s);
  }

  private bySpeed(mons: BattleMon[]): BattleMon[] {
    const dir = this.trickRoom > 0 ? -1 : 1;
    return [...mons].sort((a, b) => dir * (this.effectiveSpeed(b) - this.effectiveSpeed(a)));
  }

  private continueTurn(): void {
    while (this.queue.length && !this.outcome && !this.pendingSwitch) {
      const q = this.queue.shift() as QueuedAction;
      const mon = this.active(q.side);
      if (mon.pokemon.hp <= 0) continue;
      this.executeAction(q.side, q.action);
    }
    if (this.outcome || this.pendingSwitch) {
      if (this.outcome) this.queue = [];
      return;
    }
    this.endOfTurn();
    this.afterFaintReplacements();
  }

  private executeAction(side: SideId, a: BattleAction): void {
    switch (a.type) {
      case 'move':
        this.runMove(this.active(side), a.moveIndex);
        break;
      case 'switch': {
        const mon = this.active(side);
        if (mon.v.trapped && this.foeOf(mon).pokemon.hp > 0 && !this.types(mon).includes('ghost')) {
          this.emit({ type: 'message', text: `trapped:${this.name(mon)}` });
          break;
        }
        this.doSwitch(side, a.partyIndex, false);
        break;
      }
      case 'run':
        this.tryRun(side);
        break;
      case 'ball':
        this.throwBall(a.itemId);
        break;
      case 'item':
        this.useItem(side, a.itemId, a.partyIndex);
        break;
    }
  }

  // ———————————————————— 换人 ————————————————————

  private announceSwitchIn(mon: BattleMon): void {
    this.emit({
      type: 'switch-in',
      side: mon.side,
      index: mon.index,
      uid: mon.pokemon.uid,
      name: this.name(mon),
      hp: mon.pokemon.hp,
      maxHp: this.maxHp(mon),
      level: mon.pokemon.level,
    });
  }

  private doSwitch(side: SideId, index: number, afterFaint: boolean): void {
    const s = this.sides[side];
    const out = this.active(side);
    if (!afterFaint && out.pokemon.hp > 0) {
      getAbility(out.pokemon.ability).onSwitchOut?.(this, out);
      this.emit({ type: 'switch-out', side, index: out.index, name: this.name(out) });
    }
    out.stages = emptyStages();
    out.v = emptyVolatiles();
    out.toxicCounter = 0;
    out.turnsActive = 0;
    s.active = index;
    const inc = this.active(side);
    if (side === 1 && s.trainer) this.emit({ type: 'trainer-switch', side, trainer: s.trainer.name });
    this.announceSwitchIn(inc);
    const foe = this.foeOf(inc);
    inc.faced.add(foe.pokemon.uid);
    foe.faced.add(inc.pokemon.uid);
    getAbility(inc.pokemon.ability).onSwitchIn?.(this, inc);
  }

  /** 回合结束后处理濒死替换 */
  private afterFaintReplacements(): void {
    if (this.outcome) return;
    const foe = this.active(1);
    if (foe.pokemon.hp <= 0) {
      const idx = chooseReplacement(this, 1);
      if (idx >= 0) this.doSwitch(1, idx, true);
    }
    const me = this.active(0);
    if (me.pokemon.hp <= 0 && this.alive(0).length) {
      this.pendingSwitch = { side: 0, reason: 'faint' };
      this.emit({ type: 'request-switch', side: 0 });
    }
  }

  // ———————————————————— 招式 ————————————————————

  private runMove(user: BattleMon, moveIndex: number): void {
    const name = this.name(user);
    // 必须休息
    if (user.v.recharge) {
      user.v.recharge = false;
      this.emit({ type: 'cant-move', side: user.side, name, reason: 'recharge' });
      user.v.movedThisTurn = true;
      return;
    }
    const continuing = user.v.charging !== null || user.v.locked !== null;
    const moveId = this.resolveMoveId(user, moveIndex);
    const move = this.dex.move(moveId);

    if (!this.canAct(user, move)) {
      user.v.movedThisTurn = true;
      user.v.charging = null;
      user.v.semiInvulnerable = false;
      if (user.v.locked && RAMPAGE_MOVES.has(user.v.locked.move)) user.v.locked = null;
      if (user.v.locked && ROLLOUT_MOVES.has(user.v.locked.move)) user.v.locked = null;
      return;
    }

    // 扣 PP（连续 / 蓄力第二回合 / 挣扎不扣）
    if (!continuing && moveId !== 'struggle') {
      const slot = user.pokemon.moves.find((m) => m.id === moveId);
      if (slot) slot.pp = Math.max(0, slot.pp - 1);
    }
    if (getItem(user).choice && !user.v.choiceLock && moveId !== 'struggle') user.v.choiceLock = moveId;
    user.v.lastMove = moveId;
    user.v.movedThisTurn = true;
    if (!PROTECT_MOVES.has(moveId)) user.v.protectStreak = 0;

    this.emit({ type: 'move', side: user.side, name, move: moveId, moveName: move.name.zh, moveType: move.type });
    if (moveId !== 'copycat' && moveId !== 'struggle') this.lastMoveUsed = moveId;
    this.executeMove(user, move);
  }

  /** 挥指 / 梦话 / 仿效 / 自然之力：改用另一个招式 */
  private callMove(user: BattleMon, id: string): void {
    if (!this.dex.hasMove(id)) {
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'failed' });
      return;
    }
    const m = this.dex.move(id);
    this.emit({ type: 'move', side: user.side, name: this.name(user), move: m.id, moveName: m.name.zh, moveType: m.type });
    this.executeMove(user, m);
  }

  /** 行动前的异常判定；返回 false 表示本回合无法行动 */
  private canAct(user: BattleMon, move: MoveData): boolean {
    const name = this.name(user);
    const st = user.pokemon.status;
    if (st?.kind === 'slp') {
      st.sleepTurns = (st.sleepTurns ?? 1) - (user.pokemon.ability === 'early-bird' ? 2 : 1); // 早起：睡眠回合减半
      if (st.sleepTurns > 0) {
        this.emit({ type: 'cant-move', side: user.side, name, reason: 'slp' });
        if (SLEEP_USABLE.has(move.id)) return true;
        return false;
      }
      user.pokemon.status = null;
      this.emit({ type: 'wake', side: user.side, name });
    } else if (st?.kind === 'frz') {
      if (DEFROST_MOVES.has(move.id) || this.rng.chance(FREEZE_THAW_CHANCE)) {
        user.pokemon.status = null;
        this.emit({ type: 'thaw', side: user.side, name });
      } else {
        this.emit({ type: 'cant-move', side: user.side, name, reason: 'frz' });
        return false;
      }
    }
    if (user.v.flinch) {
      user.v.flinch = false;
      this.emit({ type: 'cant-move', side: user.side, name, reason: 'flinch' });
      if (user.pokemon.ability === 'steadfast') {
        this.showAbility(user);
        this.boost(user, 'spe', 1, false);
      }
      return false;
    }
    if (user.v.confusion > 0) {
      user.v.confusion--;
      if (user.v.confusion === 0) {
        this.emit({ type: 'cure', side: user.side, name, status: 'confusion' });
      } else {
        this.emit({ type: 'volatile', side: user.side, name, volatile: 'confusion' });
        if (this.rng.chance(CONFUSION_SELF_HIT_CHANCE)) {
          this.emit({ type: 'confusion-self-hit', side: user.side, name });
          this.damage(user, confusionDamage(this, user), 'confusion');
          return false;
        }
      }
    }
    if (user.v.attract) {
      const foe = this.foeOf(user);
      if (foe.pokemon.hp <= 0) user.v.attract = false;
      else if (this.rng.chance(ATTRACT_IMMOBILE_CHANCE)) {
        this.emit({ type: 'cant-move', side: user.side, name, reason: 'attract' });
        return false;
      }
    }
    if (user.pokemon.status?.kind === 'par' && this.rng.chance(PARALYSIS_FULL_CHANCE)) {
      this.emit({ type: 'cant-move', side: user.side, name, reason: 'par' });
      return false;
    }
    if (user.v.taunt > 0 && move.category === 'status') {
      this.emit({ type: 'cant-move', side: user.side, name, reason: 'taunt' });
      return false;
    }
    return true;
  }

  private executeMove(user: BattleMon, move: MoveData): void {
    const target = this.foeOf(user);
    const selfTarget = isSelfTargeting(move);

    // 两回合招式
    if (move.id in TWO_TURN_MOVES) {
      const instantSolar = move.id === 'solar-beam' && this.weather === 'sun';
      if (!user.v.charging && !instantSolar) {
        user.v.charging = move.id;
        user.v.semiInvulnerable = TWO_TURN_MOVES[move.id] === true;
        this.emit({ type: 'charge', side: user.side, name: this.name(user), move: move.id });
        if (move.id === 'skull-bash') this.boost(user, 'def', 1, false);
        return;
      }
      user.v.charging = null;
      user.v.semiInvulnerable = false;
    }

    // 重力：无法飞上天
    if (this.gravity > 0 && ['fly', 'bounce'].includes(move.id)) {
      user.v.charging = null;
      user.v.semiInvulnerable = false;
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'gravity' });
      return;
    }
    // 梦话 / 鼾声只能在睡眠中使用
    if (SLEEP_USABLE.has(move.id) && user.pokemon.status?.kind !== 'slp') {
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'not-asleep' });
      return;
    }
    // 自身 / 场地类
    if (selfTarget || move.category === 'status' && ['whole-field-effect', 'field-effect'].includes(move.meta.category)) {
      this.statusMove(user, user, move);
      return;
    }
    if (target.pokemon.hp <= 0) {
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'no-target' });
      return;
    }
    // 守住
    if (target.v.protect && move.id !== 'feint') {
      this.emit({ type: 'protected', side: target.side, name: this.name(target) });
      if (user.v.locked) user.v.locked = null;
      return;
    }
    if (move.id === 'feint' && target.v.protect) target.v.protect = false;
    // 半无敌
    if (target.v.semiInvulnerable && !(HITS_AIRBORNE.has(move.id) && ['bounce', 'fly'].includes(target.v.charging ?? ''))) {
      this.emit({ type: 'miss', side: user.side, name: this.name(user), target: this.name(target) });
      return;
    }
    // 突袭：目标本回合未选择伤害招式或已行动则失败
    if (move.id === 'sucker-punch') {
      const planned = target.v.plannedMove ? this.dex.move(target.v.plannedMove) : null;
      if (!planned || planned.category === 'status' || target.v.movedThisTurn) {
        this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'sucker-punch' });
        return;
      }
    }
    if (EXPLOSION_MOVES.has(move.id) && [user, target].some((m) => getAbility(m.pokemon.ability).damp)) {
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'damp' });
      return;
    }
    // 命中判定
    if (!OHKO_MOVES.has(move.id) && !this.accuracyCheck(user, target, move)) {
      this.emit({ type: 'miss', side: user.side, name: this.name(user), target: this.name(target) });
      if (user.v.locked && ROLLOUT_MOVES.has(user.v.locked.move)) user.v.locked = null;
      return;
    }
    const type = this.moveType(user, move);
    // 属性免疫（伤害招式 + 电磁波等受属性影响的变化招式）
    const typeMatters = move.category !== 'status' || move.id === 'thunder-wave';
    if (typeMatters && this.dex.effectiveness(type, this.types(target)) === 0) {
      this.emit({ type: 'immune', side: target.side, name: this.name(target), reason: 'type' });
      if (user.v.locked) user.v.locked = null;
      return;
    }
    if (POWDER_MOVES.has(move.id) && this.types(target).includes('grass')) {
      this.emit({ type: 'immune', side: target.side, name: this.name(target), reason: 'type' });
      return;
    }
    // 特性吸收 / 免疫
    const tryHit = getAbility(target.pokemon.ability).onTryHit;
    if (tryHit && !tryHit(this, target, user, move, type)) {
      if (user.v.locked) user.v.locked = null;
      return;
    }
    // 替身挡住对方的变化招式（声音类穿透）
    if (move.category === 'status' && target.v.substitute > 0 && !SOUND_MOVES.has(move.id)) {
      this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'substitute' });
      return;
    }
    // 快手还击：对手本回合使用先制招式且尚未行动才成功
    if (move.id === 'upper-hand') {
      const planned = target.v.plannedMove && this.dex.hasMove(target.v.plannedMove) ? this.dex.move(target.v.plannedMove) : null;
      if (!planned || planned.priority <= 0 || planned.category === 'status' || target.v.movedThisTurn) {
        this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'upper-hand' });
        return;
      }
    }
    if (move.category === 'status') this.statusMove(user, target, move);
    else this.damagingMove(user, target, move, type);
  }

  private moveType(_user: BattleMon, move: MoveData): TypeId {
    return move.type;
  }

  private accuracyCheck(user: BattleMon, target: BattleMon, move: MoveData): boolean {
    if (move.accuracy === null) return true;
    if (user.pokemon.ability === 'no-guard' || target.pokemon.ability === 'no-guard') return true;
    if (move.id === 'thunder' || move.id === 'hurricane') {
      if (this.weather === 'rain') return true;
    }
    let acc = move.accuracy;
    if ((move.id === 'thunder' || move.id === 'hurricane') && this.weather === 'sun') acc = 50;
    let evaStage = target.stages.eva;
    const ua = getAbility(user.pokemon.ability);
    if (ua.ignoreEvasion && evaStage > 0) evaStage = 0;
    const stage = Math.max(-6, Math.min(6, user.stages.acc - evaStage));
    let p = acc * accuracyStageMultiplier(stage);
    if (this.gravity > 0) p *= 5 / 3;
    p *= ua.modifyAccuracy?.(this, user, move) ?? 1;
    if (target.pokemon.ability === 'tangled-feet' && target.v.confusion > 0) p *= 0.5;
    if (target.pokemon.ability === 'sand-veil' && this.weather === 'sand') p *= 0.8;
    if (target.pokemon.ability === 'snow-cloak' && this.weather === 'hail') p *= 0.8;
    return this.rng.next() * 100 < p;
  }

  /** 可变威力招式 */
  private basePower(user: BattleMon, target: BattleMon, move: MoveData): number {
    const hpRatio = user.pokemon.hp / this.maxHp(user);
    switch (move.id) {
      case 'flail':
      case 'reversal': {
        const p = Math.floor((48 * user.pokemon.hp) / this.maxHp(user));
        return p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20;
      }
      case 'eruption':
      case 'water-spout':
        return Math.max(1, Math.floor(150 * hpRatio));
      case 'electro-ball': {
        const r = this.effectiveSpeed(user) / Math.max(1, this.effectiveSpeed(target));
        return r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40;
      }
      case 'gyro-ball':
        return Math.min(150, Math.floor((25 * this.effectiveSpeed(target)) / Math.max(1, this.effectiveSpeed(user))) + 1);
      case 'spit-up':
        return 100 * user.v.stockpile;
      case 'fling':
        return (user.pokemon.heldItem && this.dex.item(user.pokemon.heldItem)?.flingPower) || 30;
      case 'brine':
        return target.pokemon.hp <= this.maxHp(target) / 2 ? move.power * 2 : move.power;
      case 'hex':
        return target.pokemon.status ? move.power * 2 : move.power;
      case 'assurance':
        return target.v.damagedThisTurn ? move.power * 2 : move.power;
      case 'knock-off':
        return target.pokemon.heldItem && !target.itemUsed ? Math.floor(move.power * 1.5) : move.power;
      case 'pursuit':
        return move.power;
      case 'stomp':
        return move.power;
      case 'hard-press':
        return Math.max(1, Math.floor((100 * target.pokemon.hp) / this.maxHp(target)));
      default:
        break;
    }
    if (user.v.locked && ROLLOUT_MOVES.has(move.id)) {
      return move.power * 2 ** (user.v.locked.hits + (user.v.stockpile > 0 && move.id === 'rollout' ? 1 : 0));
    }
    return move.power || 60;
  }

  private hitCount(move: MoveData, user?: BattleMon): number {
    const min = move.meta.minHits;
    const max = move.meta.maxHits;
    if (!min || !max) return 1;
    if (user?.pokemon.ability === 'skill-link') return max;
    if (min === max) return min;
    if (min === 2 && max === 5) {
      // Gen5+：2/3 各 35%，4/5 各 15%
      return [2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5][this.rng.int(0, 19)] ?? 2;
    }
    return this.rng.int(min, max);
  }

  private damagingMove(user: BattleMon, target: BattleMon, move: MoveData, type: TypeId): void {
    const userName = this.name(user);
    const targetSide = this.sides[target.side];
    const ua = getAbility(user.pokemon.ability);
    const ta = getAbility(target.pokemon.ability);

    // —— 固定伤害类 ——
    if (OHKO_MOVES.has(move.id)) {
      if (user.pokemon.level < target.pokemon.level) {
        this.emit({ type: 'fail', side: user.side, name: userName, reason: 'level' });
        return;
      }
      if (this.rng.next() * 100 >= 30 + user.pokemon.level - target.pokemon.level) {
        this.emit({ type: 'miss', side: user.side, name: userName, target: this.name(target) });
        return;
      }
      if (ta.sturdy) {
        this.showAbility(target);
        this.emit({ type: 'immune', side: target.side, name: this.name(target), reason: 'ability' });
        return;
      }
      this.damage(target, target.pokemon.hp, 'move', { effectiveness: 1 });
      this.emit({ type: 'message', text: 'ohko' });
      return;
    }
    if (move.id === 'super-fang') {
      this.damage(target, Math.max(1, Math.floor(target.pokemon.hp / 2)), 'move', { effectiveness: 1 });
      target.v.damagedThisTurn = true;
      return;
    }
    if (move.id === 'endeavor') {
      if (target.pokemon.hp <= user.pokemon.hp) {
        this.emit({ type: 'fail', side: user.side, name: userName, reason: 'endeavor' });
        return;
      }
      this.damage(target, target.pokemon.hp - user.pokemon.hp, 'move', { effectiveness: 1 });
      return;
    }
    if (move.id === 'spit-up' && user.v.stockpile === 0) {
      this.emit({ type: 'fail', side: user.side, name: userName, reason: 'stockpile' });
      return;
    }
    if (move.id === 'fling' && (!user.pokemon.heldItem || user.itemUsed)) {
      this.emit({ type: 'fail', side: user.side, name: userName, reason: 'no-item' });
      return;
    }

    const hits = this.hitCount(move, user);
    const basePower = this.basePower(user, target, move);
    let totalDealt = 0;
    let lastHit: HitInfo | null = null;
    let landed = 0;
    let subHit = false;
    for (let i = 0; i < hits; i++) {
      if (target.pokemon.hp <= 0 || user.pokemon.hp <= 0) break;
      const cs = critStage(user, move);
      const crit = !ta.critImmune && (user.v.laserFocus > 0 || this.rng.chance(CRIT_CHANCES[cs] ?? 1 / 24));
      const res = calcDamage(this, { user, target, move, basePower, type, crit, targetSide });
      let dmg = res.damage;
      // 替身代为承受（声音类穿透）
      if (target.v.substitute > 0 && !SOUND_MOVES.has(move.id) && target !== user) {
        const absorbed = Math.min(dmg, target.v.substitute);
        target.v.substitute -= absorbed;
        subHit = true;
        landed++;
        lastHit = { move, type, damage: 0, crit: res.crit, effectiveness: res.effectiveness };
        this.emit({ type: 'message', text: `sub-hit:${this.name(target)}` });
        if (target.v.substitute <= 0) {
          target.v.substitute = 0;
          this.emit({ type: 'message', text: `sub-break:${this.name(target)}` });
        }
        continue;
      }
      if (res.resistBerry) {
        // 半减树果：先演出食用，再结算伤害
        this.showItem(target, true);
        target.itemUsed = true;
      }
      // 结实 / 气势披带：满 HP 时保留 1 点
      if (dmg >= target.pokemon.hp && target.pokemon.hp === this.maxHp(target)) {
        if (ta.sturdy) {
          dmg = target.pokemon.hp - 1;
          this.showAbility(target);
        } else if (getItem(target).focusSash) {
          dmg = target.pokemon.hp - 1;
          this.showItem(target, true);
          target.itemUsed = true;
        }
      }
      const dealt = this.damage(target, dmg, 'move', { effectiveness: res.effectiveness, crit: res.crit, hitIndex: i });
      landed++;
      totalDealt += dealt;
      target.v.damagedThisTurn = true;
      lastHit = { move, type, damage: dealt, crit: res.crit, effectiveness: res.effectiveness };
      // 吸取 / 反伤
      if (move.meta.drain > 0 && dealt > 0) {
        const amt = Math.max(1, Math.floor((dealt * move.meta.drain) / 100));
        if (ta.liquidOoze) {
          this.showAbility(target);
          this.damage(user, amt, 'ability');
        } else this.heal(user, amt, 'drain');
      } else if (move.meta.drain < 0 && dealt > 0 && user.pokemon.ability !== 'rock-head') {
        this.damage(user, Math.max(1, Math.floor((dealt * -move.meta.drain) / 100)), 'recoil');
      }
      if (move.id === 'struggle') this.damage(user, Math.max(1, Math.floor(this.maxHp(user) / 4)), 'struggle');
      ta.onDamagingHit?.(this, target, user, lastHit);
    }
    if (hits > 1) this.emit({ type: 'hits', count: landed });
    if (landed && user.v.laserFocus > 0) user.v.laserFocus = 0;
    if (!lastHit) return;

    getItem(user).afterDealDamage?.(this, user, lastHit);

    // —— 追加效果 ——
    const sheer = !!ua.sheerForce && hasSecondary(move);
    const shielded = !!ta.ignoresSecondary || subHit;
    const targetAlive = target.pokemon.hp > 0;
    if (!sheer) {
      const m = move.meta;
      if (targetAlive && !shielded) {
        const chance = (m.ailmentChance || 100) / 100;
        if (m.category === 'damage-ailment' && this.rng.chance(chance)) this.applyAilment(user, target, move, true);
        let flinch = m.flinchChance;
        if (!flinch && user.pokemon.ability === 'stench') flinch = 10;
        if (flinch && this.rng.chance(flinch / 100) && !getAbility(target.pokemon.ability).blocksFlinch && !target.v.movedThisTurn) {
          target.v.flinch = true;
        }
        if (m.category === 'damage-lower' && this.rng.chance((m.statChance || 100) / 100)) {
          for (const sc of move.statChanges) this.boost(target, sc.stat, sc.change, true);
        }
      }
      if (m.category === 'damage-raise' && user.pokemon.hp > 0 && this.rng.chance((m.statChance || 100) / 100)) {
        for (const sc of move.statChanges) this.boost(user, sc.stat, sc.change, false);
      }
    }

    // —— PokeAPI 标为 unique 的伤害招式追加效果 ——
    if (!sheer && targetAlive && !shielded) {
      if (move.id === 'chilling-water') this.boost(target, 'atk', -1, true);
      if (move.id === 'pounce') this.boost(target, 'spe', -1, true);
      if (move.id === 'upper-hand' && !target.v.movedThisTurn && !getAbility(target.pokemon.ability).blocksFlinch) target.v.flinch = true;
    }
    if (!sheer && move.id === 'trailblaze' && user.pokemon.hp > 0) this.boost(user, 'spe', 1, false);

    // —— 招式专属后续 ——
    if (move.id === 'knock-off' && targetAlive && target.pokemon.heldItem && !target.itemUsed) {
      this.showItem(target, true);
      target.itemUsed = true;
    }
    if ((move.id === 'bug-bite' || move.id === 'pluck') && target.pokemon.heldItem?.endsWith('-berry') && !target.itemUsed) {
      this.showItem(target, true);
      target.itemUsed = true;
      if (target.pokemon.heldItem === 'sitrus-berry') this.heal(user, Math.floor(this.maxHp(user) / 4), 'item');
      if (target.pokemon.heldItem === 'oran-berry') this.heal(user, 10, 'item');
    }
    if (move.id === 'fling') user.itemUsed = true;
    if (move.id === 'rapid-spin' && user.v.bound) user.v.bound = null;
    if (move.id === 'spit-up') this.resetStockpile(user);
    if (BINDING_MOVES.has(move.id) && targetAlive && !target.v.bound) {
      target.v.bound = { turns: this.rng.int(4, 5), move: move.id };
      this.emit({ type: 'volatile', side: target.side, name: this.name(target), volatile: 'bound' });
    }
    if (RECHARGE_MOVES.has(move.id) && user.pokemon.hp > 0) user.v.recharge = true;
    if (RAMPAGE_MOVES.has(move.id)) {
      if (!user.v.locked) user.v.locked = { move: move.id, turns: this.rng.int(2, 3) - 1, hits: 1 };
      else if (--user.v.locked.turns <= 0) {
        user.v.locked = null;
        this.tryConfuse(user, null);
      }
    }
    if (ROLLOUT_MOVES.has(move.id)) {
      if (!user.v.locked) user.v.locked = { move: move.id, turns: 4, hits: 1 };
      else {
        user.v.locked.hits++;
        if (--user.v.locked.turns <= 0) user.v.locked = null;
      }
    }
    if (target.pokemon.hp <= 0) ua.onFoeFainted?.(this, user);
    if (PIVOT_MOVES.has(move.id) && user.pokemon.hp > 0 && this.alive(user.side).length > 1 && !this.outcome) {
      if (user.side === 0) {
        this.pendingSwitch = { side: 0, reason: 'pivot' };
        this.emit({ type: 'request-switch', side: 0 });
      } else {
        const idx = chooseReplacement(this, 1, user.index);
        if (idx >= 0) this.doSwitch(1, idx, false);
      }
    }
    void totalDealt;
  }

  private applyAilment(user: BattleMon, target: BattleMon, move: MoveData, secondary: boolean): boolean {
    const ail = move.meta.ailment;
    const status = ailmentToStatus(ail, move.id);
    if (status) return this.trySetStatus(target, status, user, secondary);
    switch (ail) {
      case 'confusion':
        return this.tryConfuse(target, secondary ? null : user);
      case 'infatuation': {
        const g1 = user.pokemon.gender;
        const g2 = target.pokemon.gender;
        if (g1 === 'none' || g2 === 'none' || g1 === g2 || target.v.attract || getAbility(target.pokemon.ability).blocksAttract) {
          if (!secondary) this.emit({ type: 'fail', side: target.side, name: this.name(target), reason: 'attract' });
          return false;
        }
        target.v.attract = true;
        this.emit({ type: 'volatile', side: target.side, name: this.name(target), volatile: 'attract' });
        return true;
      }
      case 'torment':
        if (target.v.torment) return false;
        target.v.torment = true;
        this.emit({ type: 'volatile', side: target.side, name: this.name(target), volatile: 'torment' });
        return true;
      case 'trap':
        return false; // 束缚在 damagingMove 中处理
      default:
        if (!secondary) this.emit({ type: 'fail', side: user.side, name: this.name(user), reason: 'unimplemented' });
        return false;
    }
  }

  private resetStockpile(mon: BattleMon): void {
    if (mon.v.stockpile > 0) {
      this.boost(mon, 'def', -mon.v.stockpile, false);
      this.boost(mon, 'spd', -mon.v.stockpile, false);
      mon.v.stockpile = 0;
    }
  }

  private statusMove(user: BattleMon, target: BattleMon, move: MoveData): void {
    const userName = this.name(user);
    const fail = (reason = 'failed') => this.emit({ type: 'fail', side: user.side, name: userName, reason });
    const side = this.sides[user.side];
    const maxHp = this.maxHp(user);

    // —— 专属规则 ——
    if (move.id in WEATHER_MOVES) {
      if (!this.setWeather(WEATHER_MOVES[move.id] as Weather, 'move', user)) fail();
      return;
    }
    switch (move.id) {
      case 'protect':
      case 'detect': {
        const chance = 1 / 3 ** user.v.protectStreak;
        if (!this.rng.chance(chance)) {
          user.v.protectStreak = 0;
          fail();
          return;
        }
        user.v.protect = true;
        user.v.protectStreak++;
        this.emit({ type: 'volatile', side: user.side, name: userName, volatile: 'protect' });
        return;
      }
      case 'rest':
        if (user.pokemon.hp >= maxHp || getAbility(user.pokemon.ability).blocksStatus?.(this, user, 'slp')) {
          fail();
          return;
        }
        user.pokemon.status = { kind: 'slp', sleepTurns: 3 };
        this.emit({ type: 'status', side: user.side, name: userName, status: 'slp' });
        this.heal(user, maxHp, 'rest');
        return;
      case 'splash':
        this.emit({ type: 'message', text: 'splash' });
        return;
      case 'focus-energy':
        if (user.v.focusEnergy) return fail();
        user.v.focusEnergy = true;
        this.emit({ type: 'volatile', side: user.side, name: userName, volatile: 'focus-energy' });
        return;
      case 'belly-drum':
        if (user.pokemon.hp <= maxHp / 2 || user.stages.atk >= 6) return fail();
        this.damage(user, Math.floor(maxHp / 2), 'belly-drum');
        this.boost(user, 'atk', 12, false);
        return;
      case 'light-screen':
      case 'reflect':
      case 'mist':
      case 'safeguard':
      case 'tailwind': {
        const key = move.id === 'light-screen' ? 'lightScreen' : move.id;
        const cond = key as keyof typeof side.conditions;
        if (side.conditions[cond] > 0) return fail();
        side.conditions[cond] = move.id === 'tailwind' ? 4 : 5;
        this.emit({ type: 'side-condition', side: user.side, condition: cond, started: true });
        return;
      }
      case 'taunt':
        if (target.v.taunt > 0) return fail();
        target.v.taunt = 3;
        this.emit({ type: 'volatile', side: target.side, name: this.name(target), volatile: 'taunt' });
        return;
      case 'spite': {
        const last = target.v.lastMove;
        const slot = target.pokemon.moves.find((m) => m.id === last);
        if (!slot || slot.pp <= 0) return fail();
        slot.pp = Math.max(0, slot.pp - 4);
        this.emit({ type: 'message', text: `spite:${this.name(target)}:${last}` });
        return;
      }
      case 'soak':
        if (this.types(target).length === 1 && this.types(target)[0] === 'water') return fail();
        target.v.typeOverride = ['water'];
        this.emit({ type: 'volatile', side: target.side, name: this.name(target), volatile: 'type-change' });
        return;
      case 'reflect-type':
        user.v.typeOverride = [...this.types(this.foeOf(user))];
        this.emit({ type: 'volatile', side: user.side, name: userName, volatile: 'type-change' });
        return;
      case 'stockpile':
        if (user.v.stockpile >= 3) return fail();
        user.v.stockpile++;
        this.emit({ type: 'volatile', side: user.side, name: userName, volatile: 'stockpile' });
        this.boost(user, 'def', 1, false);
        this.boost(user, 'spd', 1, false);
        return;
      case 'swallow': {
        if (user.v.stockpile === 0) return fail();
        const frac = user.v.stockpile === 1 ? 0.25 : user.v.stockpile === 2 ? 0.5 : 1;
        this.heal(user, Math.floor(maxHp * frac), 'move');
        this.resetStockpile(user);
        return;
      }
      case 'mirror-move': {
        const last = this.foeOf(user).v.lastMove;
        if (!last || last === 'mirror-move' || last === 'struggle' || !this.dex.hasMove(last)) return fail();
        const m = this.dex.move(last);
        this.emit({ type: 'move', side: user.side, name: userName, move: m.id, moveName: m.name.zh, moveType: m.type });
        this.executeMove(user, m);
        return;
      }
      case 'whirlwind':
      case 'roar': {
        const foe = this.foeOf(user);
        if (this.kind === 'wild') {
          this.end(user.side, 'run');
          return;
        }
        const options = this.alive(foe.side).filter((m) => m !== foe);
        if (!options.length) return fail();
        this.doSwitch(foe.side, this.rng.pick(options).index, false);
        return;
      }
      case 'substitute': {
        const cost = Math.floor(maxHp / 4);
        if (user.v.substitute > 0 || user.pokemon.hp <= cost) return fail();
        this.damage(user, cost, 'substitute');
        user.v.substitute = cost;
        this.emit({ type: 'message', text: `sub-make:${userName}` });
        return;
      }
      case 'encore': {
        const last = target.v.lastMove;
        const slot = target.pokemon.moves.find((x) => x.id === last);
        if (target.v.encore || !last || !slot || slot.pp <= 0 || CALL_MOVE_BAN.has(last) || last === 'encore') return fail();
        target.v.encore = { move: last, turns: 3 };
        this.emit({ type: 'message', text: `encore:${this.name(target)}` });
        return;
      }
      case 'pain-split': {
        const avg = Math.floor((user.pokemon.hp + target.pokemon.hp) / 2);
        for (const mon of [user, target]) {
          const d = mon.pokemon.hp - Math.min(avg, this.maxHp(mon));
          if (d > 0) this.damage(mon, d, 'pain-split');
          else if (d < 0) this.heal(mon, -d, 'pain-split');
        }
        this.emit({ type: 'message', text: 'pain-split' });
        return;
      }
      case 'wish':
        if (this.wishes[user.side]) return fail();
        this.wishes[user.side] = { turns: 2, amount: Math.floor(maxHp / 2) };
        this.emit({ type: 'message', text: `wish:${userName}` });
        return;
      case 'sleep-talk': {
        const pool = user.pokemon.moves.map((x) => x.id).filter((id) => !CALL_MOVE_BAN.has(id) && !(id in TWO_TURN_MOVES) && id !== 'snore');
        if (!pool.length) return fail();
        this.callMove(user, this.rng.pick(pool));
        return;
      }
      case 'metronome': {
        const pool = this.dex.allMoves().filter((x) => !CALL_MOVE_BAN.has(x.id) && !(x.id in TWO_TURN_MOVES));
        this.callMove(user, this.rng.pick(pool).id);
        return;
      }
      case 'copycat': {
        const last = this.lastMoveUsed;
        if (!last || CALL_MOVE_BAN.has(last)) return fail();
        this.callMove(user, last);
        return;
      }
      case 'nature-power':
        this.callMove(user, this.terrain === 'electric' ? 'thunderbolt' : this.terrain === 'grassy' ? 'energy-ball' : 'tri-attack');
        return;
      case 'memento': {
        const foe = this.foeOf(user);
        if (foe.pokemon.hp > 0 && foe.v.substitute <= 0) {
          this.boost(foe, 'atk', -2, true);
          this.boost(foe, 'spa', -2, true);
        }
        this.damage(user, user.pokemon.hp, 'memento');
        return;
      }
      case 'worry-seed':
      case 'simple-beam': {
        const to = move.id === 'worry-seed' ? 'insomnia' : 'simple';
        if (target.pokemon.ability === to || target.pokemon.ability === 'truant') return fail();
        if (!this.abilityRestore.has(target.pokemon)) this.abilityRestore.set(target.pokemon, target.pokemon.ability);
        target.pokemon.ability = to;
        if (to === 'insomnia' && target.pokemon.status?.kind === 'slp') this.cureStatus(target);
        this.emit({ type: 'message', text: `ability-set:${this.name(target)}:${to}` });
        return;
      }
      case 'skill-swap': {
        const a = user.pokemon.ability;
        const b = target.pokemon.ability;
        if (a === b || [a, b].includes('wonder-guard')) return fail();
        for (const p of [user.pokemon, target.pokemon]) if (!this.abilityRestore.has(p)) this.abilityRestore.set(p, p.ability);
        user.pokemon.ability = b;
        target.pokemon.ability = a;
        this.emit({ type: 'message', text: `skill-swap:${userName}` });
        return;
      }
      case 'trick': {
        const a = user.itemUsed ? null : user.pokemon.heldItem;
        const b = target.itemUsed ? null : target.pokemon.heldItem;
        if (!a && !b) return fail();
        if (target.pokemon.ability === 'sticky-hold') return fail();
        for (const p of [user.pokemon, target.pokemon]) if (!this.itemRestore.has(p)) this.itemRestore.set(p, p.heldItem);
        user.pokemon.heldItem = b;
        target.pokemon.heldItem = a;
        user.v.choiceLock = null;
        target.v.choiceLock = null;
        this.emit({ type: 'message', text: `trick:${userName}` });
        return;
      }
      case 'power-split': {
        const o: Partial<Record<'atk' | 'def' | 'spa' | 'spd', number>> = {};
        for (const st of ['atk', 'spa'] as const) o[st] = Math.floor((rawStat(this, user, st) + rawStat(this, target, st)) / 2);
        user.v.statOverride = { ...user.v.statOverride, ...o };
        target.v.statOverride = { ...target.v.statOverride, ...o };
        this.emit({ type: 'message', text: `power-split:${userName}` });
        return;
      }
      case 'acupressure': {
        const opts = (['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as StatId[]).filter((k) => user.stages[k] < 6);
        if (!opts.length) return fail();
        this.boost(user, this.rng.pick(opts), 2, false);
        return;
      }
      case 'tidy-up':
        for (const mon of [user, this.foeOf(user)]) if (mon.v.substitute > 0) mon.v.substitute = 0;
        this.boost(user, 'atk', 1, false);
        this.boost(user, 'spe', 1, false);
        return;
      case 'laser-focus':
        user.v.laserFocus = 2;
        this.emit({ type: 'message', text: `laser-focus:${userName}` });
        return;
      case 'block': {
        const foe = this.foeOf(user);
        if (foe.v.trapped || foe.pokemon.hp <= 0) return fail();
        foe.v.trapped = true;
        this.emit({ type: 'message', text: `block:${this.name(foe)}` });
        return;
      }
      case 'future-sight': {
        const foeSide = (1 - user.side) as SideId;
        if (this.futureSight[foeSide]) return fail();
        this.futureSight[foeSide] = { turns: 3, user };
        this.emit({ type: 'message', text: `future-sight:${userName}` });
        return;
      }
      case 'trick-room':
        this.trickRoom = this.trickRoom > 0 ? 0 : 5;
        this.emit({ type: 'message', text: this.trickRoom > 0 ? 'trick-room:on' : 'trick-room:off' });
        return;
      case 'gravity':
        if (this.gravity > 0) return fail();
        this.gravity = 5;
        for (const mon of [this.active(0), this.active(1)]) {
          if (mon.v.semiInvulnerable && ['fly', 'bounce'].includes(mon.v.charging ?? '')) {
            mon.v.charging = null;
            mon.v.semiInvulnerable = false;
          }
        }
        this.emit({ type: 'message', text: 'gravity:on' });
        return;
      case 'electric-terrain':
      case 'grassy-terrain': {
        const t: Terrain = move.id === 'electric-terrain' ? 'electric' : 'grassy';
        if (this.terrain === t) return fail();
        this.terrain = t;
        this.terrainTurns = 5;
        this.emit({ type: 'message', text: `terrain:${t}` });
        return;
      }
      case 'imprison':
      case 'rage-powder':
      case 'wide-guard':
      case 'quick-guard':
      case 'after-you':
      case 'ally-switch':
      case 'dragon-cheer':
        // 单打中无效果
        fail('no-effect-singles');
        return;
      default:
        break;
    }

    // —— 通用 meta 分类 ——
    const m = move.meta;
    switch (m.category) {
      case 'ailment':
        this.applyAilment(user, target, move, false);
        return;
      case 'net-good-stats': {
        const onSelf = isSelfTargeting(move) || target === user;
        for (const sc of move.statChanges) this.boost(onSelf ? user : target, sc.stat, sc.change, !onSelf);
        return;
      }
      case 'heal': {
        let frac = m.healing / 100;
        if (['moonlight', 'synthesis', 'morning-sun'].includes(move.id)) {
          frac = this.weather === 'sun' ? 2 / 3 : this.weather === 'none' ? 0.5 : 0.25;
        }
        if (this.heal(user, Math.floor(maxHp * frac), 'move') === 0) fail('full-hp');
        return;
      }
      case 'swagger':
        for (const sc of move.statChanges) this.boost(target, sc.stat, sc.change, true);
        this.tryConfuse(target, user);
        return;
      default:
        fail('unimplemented');
    }
  }

  // ———————————————————— 回合结束 ————————————————————

  private endOfTurn(): void {
    // 1) 天气
    if (this.weather !== 'none') {
      if (this.weatherTurns !== null && --this.weatherTurns <= 0) {
        this.emit({ type: 'weather-end', weather: this.weather });
        this.weather = 'none';
        this.weatherTurns = null;
      } else {
        this.emit({ type: 'weather-continue', weather: this.weather });
        for (const mon of this.bySpeed([this.active(0), this.active(1)])) {
          if (mon.pokemon.hp <= 0) continue;
          const ab = getAbility(mon.pokemon.ability);
          if (ab.weatherImmune?.(this.weather)) continue;
          if (takesWeatherDamage(this.weather, this.types(mon))) this.damage(mon, Math.max(1, Math.floor(this.maxHp(mon) / 16)), 'weather');
        }
      }
    }
    if (this.outcome) return;
    const order = this.bySpeed([this.active(0), this.active(1)]);
    // 2) 携带物 / 特性回复
    for (const mon of order) {
      if (mon.pokemon.hp <= 0) continue;
      getItem(mon).onResidual?.(this, mon);
      if (mon.pokemon.hp > 0) getAbility(mon.pokemon.ability).onResidual?.(this, mon);
    }
    // 3) 异常伤害
    for (const mon of order) {
      if (mon.pokemon.hp <= 0 || this.outcome) continue;
      const st = mon.pokemon.status?.kind;
      const max = this.maxHp(mon);
      if (st === 'brn') this.damage(mon, Math.max(1, Math.floor(max * BURN_DAMAGE_FRACTION)), 'brn');
      else if ((st === 'psn' || st === 'tox') && mon.pokemon.ability === 'poison-heal') {
        // 毒疗：中毒时每回合回复 1/8 HP，代替扣血
        if (mon.pokemon.hp < max) {
          this.showAbility(mon);
          this.heal(mon, Math.max(1, Math.floor(max / 8)), 'poison-heal');
        }
      } else if (st === 'psn') this.damage(mon, Math.max(1, Math.floor(max * POISON_DAMAGE_FRACTION)), 'psn');
      else if (st === 'tox') {
        mon.toxicCounter++;
        this.damage(mon, toxicDamage(max, mon.toxicCounter), 'tox');
      }
    }
    // 4) 束缚
    for (const mon of order) {
      if (mon.pokemon.hp <= 0 || !mon.v.bound || this.outcome) continue;
      if (this.foeOf(mon).pokemon.hp <= 0) {
        mon.v.bound = null;
        continue;
      }
      this.damage(mon, Math.max(1, Math.floor(this.maxHp(mon) / 8)), 'bind');
      if (--mon.v.bound.turns <= 0) mon.v.bound = null;
    }
    // 4.5) 祈愿 / 预知未来 / 青草场地
    for (const side of [0, 1] as SideId[]) {
      const w = this.wishes[side];
      if (w && --w.turns <= 0) {
        this.wishes[side] = null;
        const mon = this.active(side);
        if (mon.pokemon.hp > 0 && !this.outcome) {
          this.emit({ type: 'message', text: `wish-come:${this.name(mon)}` });
          this.heal(mon, w.amount, 'wish');
        }
      }
      const fs = this.futureSight[side];
      if (fs && --fs.turns <= 0) {
        this.futureSight[side] = null;
        const target = this.active(side);
        if (target.pokemon.hp > 0 && !this.outcome && this.dex.hasMove('future-sight')) {
          const mv = this.dex.move('future-sight');
          this.emit({ type: 'message', text: `future-sight-hit:${this.name(target)}` });
          const res = calcDamage(this, { user: fs.user, target, move: mv, basePower: mv.power || 120, type: mv.type, crit: false, targetSide: this.sides[side] });
          if (res.effectiveness > 0) this.damage(target, res.damage, 'move', { effectiveness: res.effectiveness });
        }
      }
    }
    if (this.terrain === 'grassy') {
      for (const mon of order) if (mon.pokemon.hp > 0 && isGrounded(this, mon) && !this.outcome) this.heal(mon, Math.max(1, Math.floor(this.maxHp(mon) / 16)), 'terrain');
    }
    // 5) 计时器
    for (const mon of order) {
      if (mon.v.encore && --mon.v.encore.turns <= 0) {
        mon.v.encore = null;
        this.emit({ type: 'message', text: `encore-end:${this.name(mon)}` });
      }
      if (mon.v.laserFocus > 0) mon.v.laserFocus--;
      if (mon.v.taunt > 0) mon.v.taunt--;
      mon.v.protect = false;
      mon.v.flinch = false;
      if (mon.pokemon.hp > 0) mon.turnsActive++;
    }
    if (this.terrainTurns > 0 && --this.terrainTurns === 0) {
      this.emit({ type: 'message', text: `terrain-end:${this.terrain}` });
      this.terrain = 'none';
    }
    if (this.trickRoom > 0 && --this.trickRoom === 0) this.emit({ type: 'message', text: 'trick-room:off' });
    if (this.gravity > 0 && --this.gravity === 0) this.emit({ type: 'message', text: 'gravity:off' });
    for (const s of this.sides) {
      for (const k of Object.keys(s.conditions) as (keyof typeof s.conditions)[]) {
        if (s.conditions[k] > 0 && --s.conditions[k] === 0) this.emit({ type: 'side-condition', side: s.id, condition: k, started: false });
      }
    }
  }

  // ———————————————————— 濒死 / 经验 / 结束 ————————————————————

  private faint(mon: BattleMon): void {
    mon.pokemon.status = null;
    mon.v = emptyVolatiles();
    this.emit({ type: 'faint', side: mon.side, name: this.name(mon), uid: mon.pokemon.uid });
    if (mon.side === 1) this.awardExp(mon);
    // 结束判定
    const loser = mon.side;
    if (!this.alive(loser).length) this.end(loser === 0 ? 1 : 0, 'faint');
  }

  private awardExp(defeated: BattleMon): void {
    if (this.setup.noExp) return;
    const participants = this.sides[0].party.filter((m) => m.pokemon.hp > 0 && m.faced.has(defeated.pokemon.uid));
    if (!participants.length) return;
    const sp = this.dex.species(defeated.pokemon.speciesId);
    for (const p of participants) {
      const amount = expGain({
        defeatedSpeciesBaseExp: sp.baseExp,
        defeatedLevel: defeated.pokemon.level,
        victorLevel: p.pokemon.level,
        isTrainer: this.kind === 'trainer',
        participants: participants.length,
      });
      const name = this.name(p);
      gainEvs(this.dex, p.pokemon, sp.id);
      this.emit({ type: 'exp', uid: p.pokemon.uid, name, amount });
      for (const r of gainExp(this.dex, p.pokemon, amount)) {
        this.emit({ type: 'level-up', uid: p.pokemon.uid, name, level: r.level });
        for (const mv of r.learned) this.emit({ type: 'learn-move', uid: p.pokemon.uid, name, move: mv, moveName: this.dex.move(mv).name.zh });
        for (const mv of r.pending) {
          this.pendingLearns.push({ uid: p.pokemon.uid, move: mv });
          this.emit({ type: 'learn-move-pending', uid: p.pokemon.uid, name, move: mv, moveName: this.dex.move(mv).name.zh });
        }
      }
    }
  }

  private end(winner: SideId | null, reason: BattleOutcome['reason']): void {
    if (this.outcome) return;
    this.outcome = { winner, reason };
    for (const [p, a] of this.abilityRestore) p.ability = a;
    for (const [p, it] of this.itemRestore) p.heldItem = it;
    this.abilityRestore.clear();
    this.itemRestore.clear();
    if (reason === 'capture' && this.captured) this.outcome.capturedUid = this.captured.uid;
    this.pendingSwitch = null;
    this.emit({ type: 'end', winner, reason });
  }

  private tryRun(side: SideId): void {
    if (this.kind !== 'wild') {
      this.emit({ type: 'fail', side, name: this.name(this.active(side)), reason: 'no-run-trainer' });
      return;
    }
    const me = this.active(side);
    if (me.v.trapped && this.foeOf(me).pokemon.hp > 0 && !this.types(me).includes('ghost')) {
      this.emit({ type: 'run', success: false });
      return;
    }
    this.runAttempts++;
    let success = !!getAbility(me.pokemon.ability).runAway;
    if (!success) {
      // Gen5+：F = ⌊A×128/B⌋ + 30×C；F > 255 必定成功
      const a = this.effectiveSpeed(me);
      const b = Math.max(1, this.effectiveSpeed(this.foeOf(me)));
      const f = Math.floor((a * 128) / b) + 30 * (this.runAttempts - 1);
      success = a >= b || f > 255 || this.rng.int(0, 255) < f;
    }
    this.emit({ type: 'run', success });
    if (success) this.end(null, 'run');
  }

  private throwBall(ballId: string): void {
    const foe = this.active(1);
    const ballName = this.dex.item(ballId)?.name.zh ?? ballId;
    this.emit({ type: 'ball-throw', ball: ballId, target: this.name(foe) });
    if (this.kind !== 'wild') {
      this.emit({ type: 'fail', side: 0, name: ballName, reason: 'trainer-pokemon' });
      return;
    }
    if (!isBall(ballId)) throw new Error(`Battle: ${ballId} 不是精灵球`);
    const sp = this.dex.species(foe.pokemon.speciesId);
    const res = attemptCapture(
      {
        maxHp: this.maxHp(foe),
        hp: foe.pokemon.hp,
        captureRate: sp.captureRate,
        ball: ballId,
        ballContext: { turn: this.turn, targetTypes: this.types(foe), isNight: !!this.setup.isNight, inCave: !!this.setup.inCave },
        status: foe.pokemon.status?.kind,
        extraMultiplier: (this.turn <= 1 ? this.setup.captureMultiplier ?? 1 : 1) * (this.setup.foeCalmed ? CALM_CAPTURE_BONUS : 1),
      },
      this.rng,
    );
    this.emit({ type: 'capture', success: res.success, shakes: res.shakes, name: this.name(foe) });
    if (res.success) {
      foe.pokemon.ball = ballId;
      this.captured = foe.pokemon;
      this.end(0, 'capture');
    }
  }

  private useItem(side: SideId, itemId: string, partyIndex: number): void {
    const mon = this.sides[side].party[partyIndex];
    if (!mon) throw new Error('Battle: 无效的道具目标');
    const itemName = this.dex.item(itemId)?.name.zh ?? BERRY_BY_ID.get(itemId)?.name ?? itemId;
    const who = this.name(mon);
    this.emit({ type: 'item-use', item: itemId, itemName, target: who });
    if (side === 1) {
      const inv = this.sides[1].trainer?.items?.find((i) => i.id === itemId);
      if (inv) inv.qty--;
    }
    const max = this.maxHp(mon);
    const healAmount: Record<string, number> = { potion: 20, 'super-potion': 60, 'hyper-potion': 120 };
    const cures: Record<string, MajorStatus[]> = {
      antidote: ['psn', 'tox'],
      'paralyze-heal': ['par'],
      awakening: ['slp'],
      'burn-heal': ['brn'],
      'ice-heal': ['frz'],
      'full-heal': ['psn', 'tox', 'par', 'slp', 'brn', 'frz'],
    };
    if (itemId === 'revive') {
      if (mon.pokemon.hp > 0) return void this.emit({ type: 'fail', side, name: who, reason: 'item-no-effect' });
      mon.pokemon.hp = Math.floor(max / 2);
      this.emit({ type: 'heal', side, name: who, amount: mon.pokemon.hp, hp: mon.pokemon.hp, maxHp: max, source: 'item' });
      return;
    }
    if (mon.pokemon.hp <= 0) return void this.emit({ type: 'fail', side, name: who, reason: 'item-no-effect' });
    if (itemId in healAmount) {
      if (mon.pokemon.hp >= max) return void this.emit({ type: 'fail', side, name: who, reason: 'item-no-effect' });
      const amt = Math.min(max - mon.pokemon.hp, healAmount[itemId] ?? 0);
      mon.pokemon.hp += amt;
      this.emit({ type: 'heal', side, name: who, amount: amt, hp: mon.pokemon.hp, maxHp: max, source: 'item' });
      return;
    }
    if (itemId === 'leppa-berry') {
      // 苹野果：回复 PP 消耗最多的招式 10 点（自动战斗的 PP 道具）
      let best: { pp: number; maxPp: number } | null = null;
      for (const m of mon.pokemon.moves) if (m.pp < m.maxPp && (!best || m.maxPp - m.pp > best.maxPp - best.pp)) best = m;
      if (!best) return void this.emit({ type: 'fail', side, name: who, reason: 'item-no-effect' });
      best.pp = Math.min(best.maxPp, best.pp + 10);
      return;
    }
    const cure = cures[itemId];
    if (cure) {
      const st = mon.pokemon.status?.kind;
      const cureConfusion = itemId === 'full-heal' && mon.v.confusion > 0 && this.isActive(mon);
      if ((!st || !cure.includes(st)) && !cureConfusion) return void this.emit({ type: 'fail', side, name: who, reason: 'item-no-effect' });
      if (st && cure.includes(st)) this.cureStatus(mon);
      if (cureConfusion) {
        mon.v.confusion = 0;
        this.emit({ type: 'cure', side, name: who, status: 'confusion' });
      }
      return;
    }
    this.emit({ type: 'fail', side, name: who, reason: 'item-unusable' });
  }

  /** 调试用：当前双方快照 */
  snapshot(): { turn: number; weather: Weather; active: [string, string]; hp: [number, number] } {
    return {
      turn: this.turn,
      weather: this.weather,
      active: [this.name(this.active(0)), this.name(this.active(1))],
      hp: [this.active(0).pokemon.hp, this.active(1).pokemon.hp],
    };
  }

  /** 用于 AI 估算：当前能力值（含能力阶） */
  statWithStages(mon: BattleMon, stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe'): number {
    return Math.floor(getStats(this.dex, mon.pokemon)[stat] * stageMultiplier(mon.stages[stat]));
  }
}
