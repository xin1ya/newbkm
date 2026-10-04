/**
 * M1-06 · 某个地点（岛屿 / 室内房间）的 NPC 集合：按日程与 flag 生成、移除、换位，逐帧更新，挑选对话目标。
 */
import * as THREE from 'three';
import type { CollisionWorld } from '@/world';
import { pickInFront, placementsFor, type Flags, type NpcDef, type NpcPlace, type NpcPlacement, type SpotRef } from '@/systems/npcs';
import { Npc, type NpcGround } from './Npc';

export interface NpcManagerOptions {
  defs: readonly NpcDef[];
  place: NpcPlace;
  ground: NpcGround;
  collision: CollisionWorld;
  parent: THREE.Object3D;
  spots?: readonly SpotRef[] | undefined;
  /** 确定性随机（测试用） */
  rand?: (() => number) | undefined;
}

/** 日程要求离开 / 换位时，玩家在这个距离内就先不动它（避免 NPC 当着玩家的面凭空消失） */
const DEFER_DIST = 9;

export class NpcManager {
  /** key → NPC 实例 */
  readonly npcs = new Map<string, Npc>();
  readonly group = new THREE.Group();
  private spots: readonly SpotRef[];

  constructor(private readonly o: NpcManagerOptions) {
    this.group.name = 'npcs';
    o.parent.add(this.group);
    this.spots = o.spots ?? [];
  }

  /** 换房间（室内楼层切换） */
  setPlace(place: NpcPlace, spots: readonly SpotRef[]): void {
    this.clear();
    this.o.place = place;
    this.spots = spots;
  }

  /** 按当前小时与 flags 同步 NPC；player 用于推迟当面消失 */
  sync(hour: number, flags: Flags, player?: { x: number; z: number }, force = false): void {
    const want = placementsFor(this.o.defs, this.o.place, hour, flags, this.spots);
    const wantKeys = new Set(want.map((p) => p.key));
    const near = (n: Npc) => !force && !n.def.vanishInstantly && player !== undefined && Math.hypot(n.position.x - player.x, n.position.z - player.z) < DEFER_DIST;
    for (const [key, npc] of this.npcs) {
      if (wantKeys.has(key) || npc.talking || near(npc)) continue;
      npc.dispose();
      this.npcs.delete(key);
    }
    for (const p of want) {
      if (this.npcs.has(p.key)) continue;
      // 同一个 NPC 的旧实例还在（被推迟移除），先不生成新的，避免同一人出现两次
      if ([...this.npcs.values()].some((n) => n.def.id === p.def.id)) continue;
      this.spawn(p);
    }
  }

  private spawn(p: NpcPlacement): Npc {
    const npc = new Npc(p, this.o.ground, this.o.collision, this.o.rand);
    this.group.add(npc.root);
    this.npcs.set(p.key, npc);
    return npc;
  }

  update(dt: number, time: number): void {
    for (const n of this.npcs.values()) n.update(dt, time);
  }

  /** 玩家前方扇形内最近的 NPC */
  talkTarget(px: number, pz: number, facing: number, range = 2): Npc | null {
    const items = [...this.npcs.values()].map((n) => ({ key: n.key, x: n.position.x, z: n.position.z, npc: n }));
    return pickInFront(px, pz, facing, items, range)?.npc ?? null;
  }

  byId(id: string): Npc | undefined {
    return [...this.npcs.values()].find((n) => n.def.id === id);
  }

  list(): { id: string; key: string; name: string; x: number; y: number; z: number; yaw: number; talking: boolean }[] {
    return [...this.npcs.values()].map((n) => ({ id: n.def.id, key: n.key, name: n.def.name, x: n.position.x, y: n.position.y, z: n.position.z, yaw: n.yaw, talking: n.talking }));
  }

  clear(): void {
    for (const n of this.npcs.values()) n.dispose();
    this.npcs.clear();
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
