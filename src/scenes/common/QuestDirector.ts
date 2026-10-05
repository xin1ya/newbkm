/**
 * M1-16 · 任务导演（全局唯一，由 main.ts 创建）：
 * - 自动完成：监听 zone:enter / battle:end / flag:set，并按 0.25 s 采样玩家位置，调用 evaluateTriggers；
 *   计数目标（vars）达标、所有目标完成但任务未置位（pendingCompletions）时补置 flag。
 * - 奖励：任务完成后发放一次（rewardFlag 记录，读档后补发）。
 * - 通知：按进度快照差异推送「新任务 / 目标完成 / 任务完成」卡片与 quest:update 事件。
 * - 引导：追踪面板、罗盘条、DOM 浮空标记、3D 光柱 / 地面光环。
 * 场景通过 QuestContext 提供玩家位置、镜头、区域与地形查询；室内只显示追踪面板。
 */
import { onBreederGain } from '@/systems/breeder';
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { NPC_BY_ID } from '@/config/npcs';
import { QUEST_REGISTRY } from '@/config/quests';
import type { Dex } from '@/systems/data/Dex';
import { itemInfo } from '@/systems/items';
import { currentObjective, evaluateTriggers, pendingCompletions, statCounterVars, trackedMarker, type Quest, type QuestEvent, type QuestStat, type QuestRegistry } from '@/systems/quests';
import {
  ISLAND_NAMES,
  TRACK_NONE,
  compassReading,
  counterCompletions,
  diffProgress,
  formatDistance,
  grantReward,
  objectiveProgress,
  resolveMarker,
  resolveTracked,
  snapshotQuests,
  unrewarded,
  type MarkerTarget,
  type QuestNotice,
  type QuestProgress,
  type RewardLine,
} from '@/systems/quests/runtime';
import type { Rng } from '@/systems/rng';
import { setFlag, type GameState, type IslandId } from '@/systems/state/GameState';
import { keyLabel } from '@/systems/interaction';
import type { UiRoot } from '@/ui/core/UiRoot';
import { QuestHud, type QuestNoticeView } from '@/ui/hud/QuestHud';
import type { QuestLogHost } from '@/ui/menu';
import { QuestBeacon } from './QuestBeacon';
import { QuestPath } from './QuestPath';

export type QuestContext =
  | {
      kind: 'overworld';
      island: IslandId;
      player: THREE.Vector3;
      camera: THREE.Camera;
      world: THREE.Scene;
      zoneAt(x: number, z: number): string | null;
      zoneCenter(id: string): { x: number; z: number } | null;
      heightAt(x: number, z: number): number;
      /** 地面指引寻路代价（道路 < 1 < 草地；Infinity 不可通行）；不提供时不画地面路线 */
      pathCost?: ((x: number, z: number) => number) | undefined;
      /** 战斗、进门、过场时为 false：HUD 隐藏，位置触发暂停 */
      active: boolean;
    }
  | {
      kind: 'interior';
      island: IslandId;
      roomName: string;
      active: boolean;
    };

export interface QuestDirectorOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  context(): QuestContext | null;
  registry?: QuestRegistry;
}

/** 骑乘能力 flag 的显示名（原 HM，设计 §3.4） */
const ABILITY_NAMES: Record<string, string> = {
  'hm01-cut': '居合骑乘',
  'hm02-fly': '飞行骑乘',
  'hm03-surf': '水上骑乘',
  'hm04-strength': '怪力骑乘',
  'hm05-rock-smash': '冲撞骑乘',
  'hm05-flash': '闪光骑乘',
  'hm06-rock-smash': '冲撞骑乘',
  'hm07-waterfall': '攀瀑骑乘',
  'hm08-dive': '潜水骑乘',
};

const POSITION_INTERVAL = 0.25;
const PROGRESS_INTERVAL = 0.25;

export class QuestDirector {
  /** 当前实例（暂停菜单的任务日志通过它访问追踪与奖励文字） */
  static current: QuestDirector | null = null;
  readonly hud: QuestHud;
  readonly registry: QuestRegistry;
  private beacon = new QuestBeacon();
  private path = new QuestPath();
  private progress: QuestProgress;
  private posTimer = 0;
  private progTimer = 0;
  private dirty = true;
  private offs: (() => void)[] = [];
  private lastZone: string | null = null;
  private readonly fwd = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  /** 最近一次解析出的追踪目标（e2e / 大地图 M1-17 使用） */
  target: MarkerTarget | null = null;
  tracked: Quest | null = null;

  constructor(private readonly o: QuestDirectorOptions) {
    this.registry = o.registry ?? QUEST_REGISTRY;
    QuestDirector.current = this;
    this.hud = new QuestHud(o.ui);
    this.hud.setKeyHint(keyLabel(o.game.input.bindings.questLog.keys[0] ?? 'KeyJ'));
    // 读档时静默建立基线：已有进度不重复通知；未发放的奖励补发并提示
    this.settle(false);
    this.progress = snapshotQuests(this.registry, o.state.flags);
    // 读档时补发奖励静默处理（没有奖励的任务也只是记录）
    this.grantPending(false);
    const ev = o.game.events;
    this.offs.push(
      ev.on('zone:enter', (e) => this.handle({ type: 'enter-zone', zoneId: e.zoneId })),
      ev.on('battle:end', (e) => {
        if (e.capturedSpecies !== undefined) {
          const total = o.state.pokedex.caught.includes(e.capturedSpecies) ? 1 : 0;
          this.handle({ type: 'catch', speciesId: e.capturedSpecies, totalCaughtOfSpecies: Math.max(1, total) });
        }
        if (e.trainerId) this.handle({ type: 'defeat', trainerId: e.trainerId });
      }),
      // 玩法统计 → 计数型目标（剧情线覆盖全部玩法）
      ev.on('battle:end', (e) => {
        if (e.result === 'capture') this.stat('catch');
      }),
      ev.on('battle:victory', (e) => this.stat(e.kind === 'wild' ? 'wild-win' : 'trainer-win')),
      ev.on('fishing:end', (e) => {
        if (e.speciesId !== null) this.stat('fish');
      }),
      ev.on('party:healed', () => this.stat('heal')),
      ev.on('shop:trade', (e) => {
        if (e.kind === 'buy') this.stat('buy');
      }),
      ev.on('ride:change', (e) => {
        if (e.mode === 'surf') this.stat('surf');
      }),
      ev.on('pokemon:evolve', () => this.stat('evolve')),
      // 计划文档 §9.4：培育行为（systems/breeder 通知）
      onBreederGain((g) => this.stat(g.act)),
      ev.on('flag:set', () => (this.dirty = true)),
      ev.on('var:change', () => (this.dirty = true)),
    );
  }

  // ———————————————— 进度 ————————————————

  /** 处理一次触发事件：置位 flag 后立即结算 */
  handle(e: QuestEvent): string[] {
    const flags = evaluateTriggers(this.registry, this.o.state.flags, e);
    if (flags.length) this.setFlags(flags);
    return flags;
  }

  /** 玩法统计 +1（只累加进行中目标的计数变量） */
  stat(kind: QuestStat): void {
    const s = this.o.state;
    for (const v of statCounterVars(this.registry, s.flags, kind)) {
      s.vars[v] = (s.vars[v] ?? 0) + 1;
      this.o.game.events.emit('var:change', { name: v, value: s.vars[v] ?? 0 });
    }
  }

  private setFlags(flags: string[]): void {
    for (const f of flags) {
      if (this.o.state.flags[f]) continue;
      setFlag(this.o.state, f);
      this.o.game.events.emit('flag:set', { flag: f, value: true });
    }
    this.dirty = true;
    this.flush();
  }

  /** 补置派生 flag（计数目标、全部目标完成的任务），直到稳定 */
  private settle(emit: boolean): void {
    const s = this.o.state;
    for (let guard = 0; guard < 8; guard++) {
      const add = [...counterCompletions(this.registry, s.flags, s.vars), ...pendingCompletions(this.registry, s.flags).map((q) => q.completeFlag)].filter((f) => !s.flags[f]);
      if (!add.length) return;
      for (const f of new Set(add)) {
        setFlag(s, f);
        if (emit) this.o.game.events.emit('flag:set', { flag: f, value: true });
      }
    }
  }

  /** 结算：派生 flag → 进度差异通知 → 奖励 */
  flush(): void {
    this.dirty = false;
    this.settle(true);
    const next = snapshotQuests(this.registry, this.o.state.flags);
    const notices = diffProgress(this.registry, this.progress, next);
    this.progress = next;
    for (const n of notices) {
      if (n.kind === 'completed') continue; // 奖励发放后统一通知
      this.hud.notify(this.noticeView(n));
      this.o.game.events.emit('quest:update', { questId: n.quest.id, kind: n.kind });
    }
    this.grantPending(true);
    // 奖励可能包含前置 flag（例如骑乘能力），再结算一次解锁的任务
    const after = snapshotQuests(this.registry, this.o.state.flags);
    for (const n of diffProgress(this.registry, this.progress, after)) {
      if (n.kind === 'completed') continue;
      this.hud.notify(this.noticeView(n));
      this.o.game.events.emit('quest:update', { questId: n.quest.id, kind: n.kind });
    }
    this.progress = after;
  }

  private grantPending(notify: boolean): void {
    for (const q of unrewarded(this.registry, this.o.state.flags)) {
      const lines = grantReward(this.o.dex, this.o.state, q, this.o.rng);
      if (!lines) continue;
      if (notify && lines.length) {
        this.hud.notify({ kind: 'completed', title: q.title, category: q.category, lines: lines.map((l) => this.rewardText(l)) });
      } else if (notify) {
        this.hud.notify({ kind: 'completed', title: q.title, category: q.category, lines: [] });
      }
      if (notify) this.o.game.events.emit('quest:update', { questId: q.id, kind: 'completed' });
      // 玩家追踪的任务完成后恢复自动追踪
      if (this.o.state.settings.trackedQuest === q.id) this.o.state.settings.trackedQuest = null;
    }
  }

  rewardText(l: RewardLine): string {
    switch (l.kind) {
      case 'item':
        return `获得 ${itemInfo(this.o.dex, l.id, KEY_ITEM_BY_ID).name}${l.qty > 1 ? ` ×${l.qty}` : ''}`;
      case 'money':
        return `获得 ¥${l.qty.toLocaleString()}`;
      case 'ability':
        return `习得 ${ABILITY_NAMES[l.id] ?? '新的骑乘能力'}`;
      case 'pokemon':
        return `${this.o.dex.species(Number(l.id)).name.zh}（Lv.${l.qty}）成为了伙伴`;
    }
  }

  private noticeView(n: QuestNotice): QuestNoticeView {
    const q = n.quest;
    const base = { title: q.title, category: q.category };
    switch (n.kind) {
      case 'available': {
        const npc = q.startNpc ? NPC_BY_ID.get(q.startNpc) : undefined;
        return { ...base, kind: 'available', lines: [npc ? `找${npc.name}聊聊吧` : q.summary] };
      }
      case 'started': {
        const cur = currentObjective(q, this.o.state.flags);
        return { ...base, kind: 'started', lines: cur ? [`○ ${cur.text}`] : [q.summary] };
      }
      case 'objective':
        return { ...base, kind: 'objective', lines: [`✓ ${n.done.text}`, ...(n.next ? [`○ ${n.next.text}`] : [])] };
      case 'completed':
        return { ...base, kind: 'completed', lines: [] };
    }
  }

  // ———————————————— 追踪 ————————————————

  track(questId: string | null): void {
    this.o.state.settings.trackedQuest = questId;
  }

  untrack(): void {
    this.o.state.settings.trackedQuest = TRACK_NONE;
  }

  /** 任务日志宿主接口（暂停菜单） */
  logHost(): QuestLogHost {
    const s = this.o.state;
    return {
      registry: this.registry,
      tracked: () => resolveTracked(this.registry, s.flags, s.settings.trackedQuest),
      manual: () => !!s.settings.trackedQuest && s.settings.trackedQuest !== TRACK_NONE,
      track: (id) => this.track(id),
      untrack: () => this.untrack(),
      auto: () => this.track(null),
      rewardText: (l) => this.rewardText(l),
      npcName: (id) => NPC_BY_ID.get(id)?.name ?? null,
      showOnMap: this.showOnMap ?? undefined,
    };
  }

  /** 大地图（M1-17）注册后启用「在地图上查看」 */
  showOnMap: ((questId: string) => void) | null = null;

  // ———————————————— 每帧 ————————————————

  update(dt: number): void {
    const ctx = this.o.context();
    const s = this.o.state;
    if (ctx?.kind === 'overworld' && ctx.active) {
      this.posTimer += dt;
      if (this.posTimer >= POSITION_INTERVAL) {
        this.posTimer = 0;
        const p = ctx.player;
        this.handle({ type: 'position', island: ctx.island, position: [p.x, p.y, p.z], night: this.o.game.clock.timeOfDay === 'night' });
        // 读档 / 传送后已身处目标区域（没有 zone:enter 事件）时也要能完成 enter-zone 目标
        const z = ctx.zoneAt(p.x, p.z);
        if (z && z !== this.lastZone) this.handle({ type: 'enter-zone', zoneId: z });
        this.lastZone = z;
      }
    }
    this.progTimer += dt;
    if (this.dirty || this.progTimer >= PROGRESS_INTERVAL) {
      this.progTimer = 0;
      this.flush();
    }
    this.hud.update(dt);

    // 引导
    const q = resolveTracked(this.registry, s.flags, s.settings.trackedQuest);
    this.tracked = q;
    const obj = q ? currentObjective(q, s.flags) : null;
    const marker = q ? trackedMarker(q, s.flags) : null;
    const visible = !!ctx?.active && !this.o.ui.busy;
    this.hud.setVisible(!!ctx?.active);
    if (!ctx || !q || !obj) {
      this.target = null;
      this.hud.setTracker(null);
      this.hud.setCompass(null);
      this.hud.setWorldMarker(null, new THREE.Camera(), 0, 0, 0, '', false);
      this.updateBeacon(dt, ctx, null);
      return;
    }
    const prog = objectiveProgress(obj, s.vars);
    const progress = prog ? `${prog.current}/${prog.target}` : undefined;
    if (ctx.kind === 'interior') {
      this.target = null;
      const other = marker && marker.island !== ctx.island;
      this.hud.setTracker({ category: q.category, title: q.title, objective: obj.text, progress, note: other ? `目标在${ISLAND_NAMES[marker.island]}` : marker ? `在${ctx.roomName}中 · 出门后查看方向` : undefined });
      this.hud.setCompass(null);
      this.hud.setWorldMarker(null, new THREE.Camera(), 0, 0, 0, '', false);
      this.updateBeacon(dt, ctx, null);
      return;
    }
    const target = marker ? resolveMarker(marker, (id) => ctx.zoneCenter(id)) : null;
    this.target = target;
    const p = ctx.player;
    if (!target || target.island !== ctx.island) {
      const note = target ? `目标在${ISLAND_NAMES[target.island]}` : marker ? undefined : '没有标记位置';
      this.hud.setTracker({ category: q.category, title: q.title, objective: obj.text, progress, note });
      ctx.camera.getWorldDirection(this.fwd);
      this.hud.setCompass({ heading: compassReading(p, this.fwd, { island: ctx.island, x: p.x, z: p.z - 1, radius: 0, zoneId: null }).heading, target: null, note });
      this.hud.setWorldMarker(null, ctx.camera, 0, 0, 0, '', false);
      this.updateBeacon(dt, ctx, null);
      return;
    }
    ctx.camera.getWorldDirection(this.fwd);
    const inZone = !!target.zoneId && ctx.zoneAt(p.x, p.z) === target.zoneId;
    const r = compassReading(p, this.fwd, target, inZone);
    const area = target.radius > 0 || !!target.zoneId;
    const note = r.inside ? (target.zoneId ? '已进入目标区域' : '目标就在附近，仔细找找') : formatDistance(r.distance);
    this.hud.setTracker({ category: q.category, title: q.title, objective: obj.text, progress, note: r.inside ? note : `${note} · T 自动寻路` });
    this.hud.setCompass({ heading: r.heading, target: { relative: r.relative, distance: formatDistance(r.distance), inside: r.inside, area } });
    const showWorld = s.settings.showWorldMarkers && visible && !r.inside;
    this.anchor.set(target.x, ctx.heightAt(target.x, target.z) + (area ? 3 : 4.2), target.z);
    this.hud.setWorldMarker(showWorld ? this.anchor : null, ctx.camera, this.o.game.width, this.o.game.height, r.distance, formatDistance(r.distance), area);
    // 区域标记（zoneId）范围太大，不画地面光环，只用光柱指示中心
    this.updateBeacon(dt, ctx, s.settings.showWorldMarkers ? { x: target.x, z: target.z, radius: target.zoneId ? 0 : target.radius } : null, !!target.zoneId && r.inside);
  }

  private updateBeacon(dt: number, ctx: QuestContext | null, t: { x: number; z: number; radius: number } | null, hide = false): void {
    if (ctx?.kind !== 'overworld') {
      this.beacon.update(dt, null, { x: 0, z: 0 }, () => 0, false);
      this.path.update(dt, null, new THREE.Vector3(), () => 0, undefined, false);
      return;
    }
    if (this.beacon.group.parent !== ctx.world) ctx.world.add(this.beacon.group);
    if (this.path.mesh.parent !== ctx.world) ctx.world.add(this.path.mesh);
    this.beacon.update(dt, hide ? null : t, ctx.player, ctx.heightAt, ctx.active);
    // 地面指引：跟随世界标记设置；区域目标进入后不再画
    if (this.tracked) this.path.setCategory(this.tracked.category);
    this.path.update(dt, hide ? null : t, ctx.player, ctx.heightAt, ctx.pathCost, ctx.active && !this.o.ui.busy && this.o.state.settings.showWorldMarkers);
  }

  get beaconState(): { beam: boolean; ring: boolean } {
    return { beam: this.beacon.beamVisible, ring: this.beacon.ringVisible };
  }

  dispose(): void {
    if (QuestDirector.current === this) QuestDirector.current = null;
    for (const f of this.offs) f();
    this.hud.dispose();
    this.beacon.dispose();
    this.path.mesh.removeFromParent();
    this.path.dispose();
  }
}
