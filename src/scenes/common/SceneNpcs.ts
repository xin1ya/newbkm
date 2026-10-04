/**
 * M1-06 · 场景内 NPC 宿主（大地图与室内共用）：NpcManager + 名字标签 + 互动对话 + 定期按日程/flag 重新同步。
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { UiRoot } from '@/ui/core';
import { NameTags, type NameTagItem } from '@/ui/hud';
import { npcQuestMark } from '@/systems/quests';
import { QUEST_REGISTRY } from '@/config/quests';
import type { GameState } from '@/systems/state/GameState';
import type { NpcPlace, SpotRef } from '@/systems/npcs';
import type { CollisionWorld } from '@/world';
import { NpcManager, type Npc, type NpcGround } from '@/actors/npc';
import type { PlayerController } from '@/actors/player';
import { ALL_NPCS } from '@/config/npcs';
import { isTalking, talkToNpc } from './npcTalk';
import type { NpcServices } from './npcServices';

export interface SceneNpcsOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  ground: NpcGround;
  collision: CollisionWorld;
  parent: THREE.Object3D;
  place: NpcPlace;
  spots?: readonly SpotRef[] | undefined;
  toast?: ((text: string) => void) | undefined;
  /** 名字标签显示距离（室内房间小，全部显示） */
  tagDistance?: [full: number, show: number];
  /** 对话距离（室内隔着柜台 / 桌子也能说话，放宽） */
  talkRange?: number;
  /** M1-19 回复 / 商店 / 赠礼 */
  services?: NpcServices | undefined;
}

const RESYNC_EVERY = 0.5;

export class SceneNpcs {
  readonly manager: NpcManager;
  readonly tags: NameTags;
  private readonly marks = new Map<string, '!' | '?' | null>();
  private markTimer = 0;
  private resync = 0;
  private items: NameTagItem[] = [];
  private tmp = new THREE.Vector3();
  get talkRange(): number {
    return this.o.talkRange ?? 2;
  }

  /** 当前可对话的目标（HUD 提示 / e2e） */
  focus: Npc | null = null;

  constructor(private readonly o: SceneNpcsOptions) {
    this.manager = new NpcManager({ defs: ALL_NPCS, place: o.place, ground: o.ground, collision: o.collision, parent: o.parent, spots: o.spots });
    const [full, show] = o.tagDistance ?? [10, 15];
    this.tags = new NameTags(o.ui, show, full);
  }

  /** 立即同步（进入场景 / 换房间 / 读档）；force 时不推迟玩家附近的换位 */
  sync(player: THREE.Vector3, force = true): void {
    this.manager.sync(this.o.game.clock.hour, this.o.state.flags, { x: player.x, z: player.z }, force);
    this.resync = RESYNC_EVERY;
  }

  setPlace(place: NpcPlace, spots: readonly SpotRef[], player: THREE.Vector3): void {
    this.manager.setPlace(place, spots);
    this.tags.clear();
    this.sync(player, true);
  }

  /** 逐帧更新（对话的触发由 SceneInteractions 统一处理，见 interactSources.npcSource） */
  update(dt: number, time: number, player: PlayerController, camera: THREE.Camera): void {
    const p = player.position;
    this.resync -= dt;
    if (this.resync <= 0) this.sync(p, false);
    this.manager.update(dt, time);
    const busy = this.o.ui.busy || isTalking();
    this.focus = busy ? null : this.manager.talkTarget(p.x, p.z, player.facing, this.talkRange);
    // 名字标签：对话中隐藏；设置里可整体关闭
    this.tags.visible = !busy;
    this.tags.namesVisible = this.o.state.settings.showNameTags;
    // 任务标记每 0.5 s 重算一次（flag 变化不频繁）
    this.markTimer -= dt;
    const remark = this.markTimer <= 0;
    if (remark) this.markTimer = 0.5;
    const night = this.o.game.clock.timeOfDay === 'night';
    this.items.length = 0;
    for (const n of this.manager.npcs.values()) {
      if (n.def.nameTag === false) continue;
      if (remark || !this.marks.has(n.def.id)) this.marks.set(n.def.id, npcQuestMark(n.def, QUEST_REGISTRY, this.o.state.flags, night));
      this.items.push({ key: n.def.id, name: n.def.name, title: n.def.title, anchor: n.headPosition(this.tmp.clone()), distance: Math.hypot(n.position.x - p.x, n.position.z - p.z), mark: this.marks.get(n.def.id) });
    }
    this.tags.update(this.items, camera, this.o.game.width, this.o.game.height);
  }

  /** 对话前拦截（训练家未击败时改为发起对战，M1-10）；返回 true 表示已处理 */
  beforeTalk: ((npc: Npc) => boolean) | null = null;

  /** 与指定 NPC 对话（也供 e2e 调用） */
  talk(npc: Npc, player: PlayerController): Promise<void> {
    player.velocity.set(0, 0, 0);
    if (this.beforeTalk?.(npc)) return Promise.resolve();
    return talkToNpc(npc, {
      game: this.o.game,
      ui: this.o.ui,
      state: this.o.state,
      playerPosition: player.position,
      facePlayer: (yaw) => player.teleport(player.position.x, player.position.z, yaw),
      toast: this.o.toast,
      services: this.o.services,
    });
  }

  hide(): void {
    this.tags.clear();
  }

  dispose(): void {
    this.manager.dispose();
    this.tags.dispose();
  }
}
