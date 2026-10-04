/**
 * M1-06 · NPC 运行时：模型 + 位置 + 活动（站立 / 散步 / 巡逻）+ 对话时转向玩家 + 碰撞体。
 */
import * as THREE from 'three';
import type { TrainerModel } from '@/actors/player/TrainerModel';
import type { CollisionWorld } from '@/world';
import type { NpcDef, NpcPlacement } from '@/systems/npcs';
import { createNpcModel } from './NpcModel';
import { EmoteBubble } from '@/actors/common/EmoteBubble';

/** NPC 需要的地面接口（大地图 Terrain 与室内平地都满足） */
export interface NpcGround {
  heightAt(x: number, z: number): number;
  hf: { inBounds(x: number, z: number): boolean; waterAt(x: number, z: number): unknown; slopeAt(x: number, z: number): number };
}

export const NPC_RADIUS = 0.32;
const WALK_SPEED = 1.25;
const TURN_RATE = 6;
const MAX_SLOPE = 32;

function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Npc {
  readonly root = new THREE.Group();
  readonly model: TrainerModel;
  readonly def: NpcDef;
  placement: NpcPlacement;
  readonly position = new THREE.Vector3();
  yaw = 0;
  private homeYaw = 0;
  private anchor = new THREE.Vector2();
  private target: THREE.Vector2 | null = null;
  private wait = 0;
  private patrolIdx = 0;
  private speed = 0;
  private talkingTo: THREE.Vector3 | null = null;
  private lookTimer = 0;
  private lookYaw = 0;
  private colliderKey: string;
  private lastColliderAt = new THREE.Vector2(Infinity, Infinity);
  /** 被阻挡的累计时间（散步卡住时换目标） */
  private stuck = 0;
  /** 头顶表情（训练家发现玩家「!」） */
  readonly emote: EmoteBubble;
  /** 剧情脚本移动（训练家走向玩家）：优先于活动逻辑 */
  private script: { x: number; z: number; speed: number; resolve: () => void } | null = null;
  /** 剧情锁定朝向（对战前后） */
  private holdYaw: number | null = null;
  private turnIdx = 0;
  /** 登场 / 战败动作 */
  private gesture: { kind: 'wave' | 'point' | 'flex' | 'bow' | 'throw' | 'slump'; t: number; dur: number } | null = null;

  constructor(
    placement: NpcPlacement,
    private readonly ground: NpcGround,
    private readonly collision: CollisionWorld,
    private readonly rand: () => number = Math.random,
  ) {
    this.def = placement.def;
    this.placement = placement;
    this.colliderKey = `npc:${placement.key}`;
    this.model = createNpcModel(placement.def.appearance);
    this.root.add(this.model.root);
    this.root.name = `npc:${placement.def.id}`;
    this.root.userData.npcId = placement.def.id;
    this.emote = new EmoteBubble(this.root, 2.25 * this.model.style.scale);
    this.place(placement);
  }

  get key(): string {
    return this.placement.key;
  }

  get talking(): boolean {
    return this.talkingTo !== null;
  }

  /** 瞬移到放置点（日程切换 / 初次生成） */
  place(p: NpcPlacement): void {
    this.placement = p;
    this.collision.removeGroup(this.colliderKey);
    const [x, z] = this.findStandable(p.position[0], p.position[1]);
    this.anchor.set(x, z);
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.yaw = this.homeYaw = p.yaw;
    this.target = null;
    this.patrolIdx = 0;
    this.wait = 1 + this.rand() * 3;
    this.syncVisual();
    this.syncCollider(true);
  }

  /** 放置点落在水里 / 碰撞体里时，就近螺旋搜索可站立点（配置容错；开发模式下会打印警告） */
  private findStandable(x: number, z: number): [number, number] {
    if (this.standable(x, z)) return [x, z];
    for (let r = 0.5; r <= 8; r += 0.5) {
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        const cx = x + Math.cos(t) * r;
        const cz = z + Math.sin(t) * r;
        if (this.standable(cx, cz)) {
          if (import.meta.env?.DEV) console.warn(`[npc] ${this.def.id} 放置点 (${x}, ${z}) 不可站立，已移到 (${cx.toFixed(1)}, ${cz.toFixed(1)})`);
          return [cx, cz];
        }
      }
    }
    return [x, z];
  }

  /** 可站立：在岛内、不在水里、坡度可走、不与摆放物 / 其他 NPC 重叠（自己的碰撞体在 place 时已移除） */
  standable(x: number, z: number): boolean {
    return this.canStep(x, z);
  }

  private syncCollider(force = false): void {
    if (!force && Math.hypot(this.position.x - this.lastColliderAt.x, this.position.z - this.lastColliderAt.y) < 0.05) return;
    this.collision.removeGroup(this.colliderKey);
    this.collision.add(this.colliderKey, { kind: 'circle', x: this.position.x, z: this.position.z, r: NPC_RADIUS, y0: this.position.y, y1: this.position.y + 1.6, tag: this.colliderKey });
    this.lastColliderAt.set(this.position.x, this.position.z);
  }

  /** 开始对话：停下并转向说话对象 */
  beginTalk(to: THREE.Vector3): void {
    this.talkingTo = to.clone();
    this.target = null;
    this.speed = 0;
  }

  /** 脚本：走到 (x, z)（不做寻路，直线；受阻时就地结束）；speed 缺省为快走 */
  walkTo(x: number, z: number, speed = 3.2): Promise<void> {
    this.script?.resolve();
    return new Promise((resolve) => {
      this.script = { x, z, speed, resolve };
    });
  }

  /** 战后走回原位并恢复原来的活动 */
  async returnHome(): Promise<void> {
    this.face(null);
    await this.walkTo(this.anchor.x, this.anchor.y, 1.5);
    this.yaw = this.homeYaw;
  }

  /** 原位（训练家视线 / 战后归位） */
  get home(): { x: number; z: number; yaw: number } {
    return { x: this.anchor.x, z: this.anchor.y, yaw: this.homeYaw };
  }

  /** 剧情锁定朝向；null 解除 */
  face(yaw: number | null): void {
    this.holdYaw = yaw;
  }

  /** 播放动作（登场招手 / 指向 / 秀肌肉 / 鞠躬 / 扔球 / 战败垂头） */
  playGesture(kind: 'wave' | 'point' | 'flex' | 'bow' | 'throw' | 'slump', dur = 1.1): Promise<void> {
    this.gesture = { kind, t: 0, dur };
    return new Promise((r) => setTimeout(r, dur * 1000));
  }

  /** 瞬移到指定位置（剧情），保留当前放置配置 */
  setPose(x: number, z: number, yaw: number): void {
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.yaw = yaw;
    this.syncVisual();
    this.syncCollider(true);
  }

  endTalk(): void {
    this.talkingTo = null;
    this.wait = 2 + this.rand() * 2;
  }

  update(dt: number, time: number): void {
    let wantYaw = this.yaw;
    this.emote.update(dt);
    if (this.script) {
      wantYaw = this.runScript(dt);
    } else if (this.holdYaw !== null) {
      wantYaw = this.holdYaw;
      this.speed = 0;
    } else if (this.talkingTo) {
      wantYaw = Math.atan2(this.talkingTo.x - this.position.x, this.talkingTo.z - this.position.z);
      this.speed = 0;
    } else {
      wantYaw = this.think(dt);
    }
    this.yaw += angleDelta(this.yaw, wantYaw) * Math.min(1, dt * TURN_RATE);
    this.syncVisual();
    this.model.animate(dt, this.speed, time + this.anchor.x * 0.37);
    this.applyGesture(dt);
    // 站立时偶尔转头张望
    if (this.speed < 0.1 && !this.talkingTo) {
      this.lookTimer -= dt;
      if (this.lookTimer <= 0) {
        this.lookTimer = 2.5 + this.rand() * 4;
        this.lookYaw = (this.rand() - 0.5) * 1.1;
      }
      const head = this.model.bones.head;
      head.rotation.y += (this.lookYaw - head.rotation.y) * Math.min(1, dt * 2);
    } else {
      this.model.bones.head.rotation.y *= 1 - Math.min(1, dt * 6);
    }
    this.syncCollider();
  }

  private runScript(dt: number): number {
    const sc = this.script!;
    const dx = sc.x - this.position.x;
    const dz = sc.z - this.position.z;
    const d = Math.hypot(dx, dz);
    const want = d > 0.01 ? Math.atan2(dx, dz) : this.yaw;
    if (d < 0.08) {
      this.speed = 0;
      this.script = null;
      sc.resolve();
      return want;
    }
    this.speed = Math.min(sc.speed, d * 4 + 0.6);
    const step = Math.min(d, this.speed * dt);
    const nx = this.position.x + (dx / d) * step;
    const nz = this.position.z + (dz / d) * step;
    if (this.canStep(nx, nz)) this.position.set(nx, this.ground.heightAt(nx, nz), nz);
    else {
      this.stuck += dt;
      if (this.stuck > 0.4) {
        this.stuck = 0;
        this.script = null;
        this.speed = 0;
        sc.resolve();
      }
    }
    return want;
  }

  /** 手臂 / 躯干叠加动作（在走路动画之后覆盖） */
  private applyGesture(dt: number): void {
    const g = this.gesture;
    if (!g) return;
    g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    const env = Math.sin(k * Math.PI); // 0 → 1 → 0
    const b = this.model.bones;
    switch (g.kind) {
      case 'wave':
        b.armR.rotation.x = -2.6 * env;
        b.armR.rotation.z = -0.3 * env + Math.sin(g.t * 14) * 0.35 * env;
        break;
      case 'point':
        b.armR.rotation.x = -1.55 * Math.min(1, k * 4);
        b.spine.rotation.x = 0.08 * env;
        break;
      case 'flex':
        b.armL.rotation.x = -2.2 * env;
        b.armR.rotation.x = -2.2 * env;
        b.armL.rotation.z = 0.9 * env;
        b.armR.rotation.z = -0.9 * env;
        break;
      case 'bow':
        b.spine.rotation.x = 0.55 * env;
        b.head.rotation.x = 0.25 * env;
        break;
      case 'throw': {
        // 后摆 → 前甩
        const a = k < 0.45 ? -(k / 0.45) * 2.8 : -2.8 + ((k - 0.45) / 0.55) * 3.6;
        b.armR.rotation.x = a * (1 - Math.max(0, k - 0.85) / 0.15);
        b.spine.rotation.y = (k < 0.45 ? 0.35 : -0.25) * env;
        break;
      }
      case 'slump':
        b.spine.rotation.x = 0.35 * Math.min(1, k * 3);
        b.head.rotation.x = 0.45 * Math.min(1, k * 3);
        b.armL.rotation.x = 0.1;
        b.armR.rotation.x = 0.1;
        break;
    }
    if (k >= 1 && g.kind !== 'slump' && g.kind !== 'point') this.gesture = null;
    if (k >= 1 && (g.kind === 'point' || g.kind === 'slump') && g.t > g.dur + 0.6) {
      b.spine.rotation.x = 0;
      b.head.rotation.x = 0;
      this.gesture = null;
    }
  }

  /** 活动逻辑：返回期望朝向 */
  private think(dt: number): number {
    const act = this.placement.activity;
    if (act.kind === 'stand') {
      this.speed = 0;
      return this.homeYaw;
    }
    if (act.kind === 'turn') {
      this.speed = 0;
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = act.every;
        this.turnIdx = (this.turnIdx + 1) % act.yaws.length;
      }
      return act.yaws[this.turnIdx] ?? this.homeYaw;
    }
    if (!this.target) {
      this.speed = 0;
      this.wait -= dt;
      if (this.wait > 0) return this.yaw;
      this.target = this.nextTarget();
      this.stuck = 0;
      if (!this.target) {
        this.wait = 1.5;
        return this.yaw;
      }
    }
    const dx = this.target.x - this.position.x;
    const dz = this.target.y - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      this.target = null;
      this.wait = act.kind === 'patrol' ? 0.8 + this.rand() * 1.2 : 2 + this.rand() * 4;
      this.speed = 0;
      return this.yaw;
    }
    const want = Math.atan2(dx, dz);
    // 先转身再走，避免滑步
    const facingOk = Math.abs(angleDelta(this.yaw, want)) < 0.6;
    this.speed = facingOk ? Math.min(WALK_SPEED, d * 2) : 0;
    if (this.speed > 0) {
      const step = Math.min(d, this.speed * dt);
      const nx = this.position.x + (dx / d) * step;
      const nz = this.position.z + (dz / d) * step;
      if (this.canStep(nx, nz)) {
        this.position.set(nx, this.ground.heightAt(nx, nz), nz);
      } else {
        this.stuck += dt;
        if (this.stuck > 0.6) {
          this.target = null;
          this.wait = 1;
        }
      }
    }
    return want;
  }

  private canStep(x: number, z: number): boolean {
    const hf = this.ground.hf;
    if (!hf.inBounds(x, z) || hf.waterAt(x, z) || hf.slopeAt(x, z) > MAX_SLOPE) return false;
    const y = this.ground.heightAt(x, z);
    for (const c of this.collision.query(x, z, NPC_RADIUS + 1)) {
      if (c.tag === this.colliderKey) continue;
      if (c.y1 < y + 0.35 || c.y0 > y + 1.5) continue;
      if (c.kind === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + NPC_RADIUS) return false;
      } else {
        const s = Math.sin(-c.yaw);
        const co = Math.cos(-c.yaw);
        const lx = (x - c.x) * co - (z - c.z) * s;
        const lz = (x - c.x) * s + (z - c.z) * co;
        if (Math.abs(lx) < c.hx + NPC_RADIUS && Math.abs(lz) < c.hz + NPC_RADIUS) return false;
      }
    }
    return true;
  }

  private nextTarget(): THREE.Vector2 | null {
    const act = this.placement.activity;
    if (act.kind === 'patrol') {
      this.patrolIdx = (this.patrolIdx + 1) % act.path.length;
      const [ox, oz] = act.path[this.patrolIdx]!;
      return new THREE.Vector2(this.anchor.x + ox, this.anchor.y + oz);
    }
    if (act.kind === 'wander') {
      for (let i = 0; i < 6; i++) {
        const a = this.rand() * Math.PI * 2;
        const r = Math.sqrt(this.rand()) * act.radius;
        const x = this.anchor.x + Math.cos(a) * r;
        const z = this.anchor.y + Math.sin(a) * r;
        if (this.canStep(x, z)) return new THREE.Vector2(x, z);
      }
    }
    return null;
  }

  private syncVisual(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  /** 头顶（名字标签锚点） */
  headPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.position).setY(this.position.y + 1.95 * this.model.style.scale);
  }

  dispose(): void {
    this.collision.removeGroup(this.colliderKey);
    this.root.removeFromParent();
    const mats = new Set<THREE.Material>();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
    });
    for (const m of mats) m.dispose();
  }
}
