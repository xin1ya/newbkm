/**
 * M1-08 · 跟随宝可梦：沿玩家的面包屑轨迹走在身后，远了加速追赶，太远（传送 / 卡住）直接瞬移到身后；
 * 深水里收回球中，上岸再出来；站着不动时转向玩家、偶尔张望 / 蹦跳；头顶表情气泡。
 * 战斗时模型被 BattleScene 借用（borrowed = true 期间不更新）。
 */
import * as THREE from 'three';
import { FollowerTrail, followSpeed } from '@/systems/follower';
import { EmoteBubble } from '@/actors/common/EmoteBubble';
import { disposeMonModel, monAnimator, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';

export interface FollowerGround {
  heightAt(x: number, z: number): number;
  /** 水深（米），陆地返回 0 */
  waterDepth(x: number, z: number): number;
  /** 可站立（室内墙 / 家具）；缺省只看水深 */
  canStand?(x: number, z: number): boolean;
}

export interface FollowTarget {
  position: THREE.Vector3;
  facing: number;
  velocity: THREE.Vector3;
}

const WARP_DIST = 18;
const MIN_GAP = 1.05;
const TURN_RATE = 8;

function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Follower {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly emote: EmoteBubble;
  yaw = 0;
  speed = 0;
  /** 模型被战斗借用中 */
  borrowed = false;
  /** 在水里收回球中 */
  inBall = false;
  private trail = new FollowerTrail();
  private t = Math.random() * 10;
  private idleTime = 0;
  private hop = 0;
  private lookYaw = 0;
  private lookTimer = 2;
  private baseScale: number;

  constructor(
    readonly uid: string,
    readonly speciesId: number,
    readonly model: THREE.Object3D,
    readonly height: number,
    private ground: FollowerGround,
  ) {
    this.root.name = 'follower';
    this.root.add(model);
    this.baseScale = model.scale.x;
    this.emote = new EmoteBubble(this.root, height + 0.55);
  }

  /** 有 fly 动作的手工模型：跟随时始终保持飞行（悬停高度随体型） */
  get flying(): boolean {
    return !!monAnimator(this.model)?.has('fly');
  }

  /** 飞行离地高度 */
  private get hoverHeight(): number {
    return THREE.MathUtils.clamp(0.7 + this.height * 0.35, 0.8, 1.8);
  }

  /** 身后的跟随距离：体型越大离得越远 */
  get gap(): number {
    return 1.35 + Math.min(1.6, this.height * 0.45);
  }

  setGround(g: FollowerGround): void {
    this.ground = g;
  }

  /** 瞬移到玩家身后（进场景 / 传送 / 读档） */
  warpBehind(p: FollowTarget): void {
    // 候选：身后 → 左后 / 右后 → 左右 → 前方斜侧（室内刚进门时身后是墙）
    const g = this.gap;
    const ok = (x: number, z: number) => this.ground.waterDepth(x, z) < 0.5 && (this.ground.canStand?.(x, z) ?? true);
    let x = p.position.x;
    let z = p.position.z;
    for (const a of [Math.PI, Math.PI * 0.75, -Math.PI * 0.75, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      const cx = p.position.x + Math.sin(p.facing + a) * g;
      const cz = p.position.z + Math.cos(p.facing + a) * g;
      if (ok(cx, cz)) {
        x = cx;
        z = cz;
        break;
      }
    }
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.yaw = p.facing;
    this.trail.reset(x, z);
    this.trail.push(p.position.x, p.position.z);
    this.speed = 0;
    this.sync();
  }

  /** 让跟随者小跳一下（对话 / 开心） */
  jump(): void {
    this.hop = 1;
  }

  update(dt: number, player: FollowTarget, frozen = false): void {
    if (this.borrowed) return;
    this.t += dt;
    this.emote.update(dt);
    const pp = player.position;
    if (!frozen) this.trail.push(pp.x, pp.z);
    const toPlayer = Math.hypot(pp.x - this.position.x, pp.z - this.position.z);
    if (toPlayer > WARP_DIST) this.warpBehind(player);

    // 目标点：轨迹上身后 gap 米
    const goal = this.trail.pointBehind(this.gap);
    let dx = goal.x - this.position.x;
    let dz = goal.z - this.position.z;
    let d = Math.hypot(dx, dz);
    const playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (frozen) d = 0;
    this.speed = followSpeed(d, playerSpeed);
    if (this.speed > 0 && d > 0) {
      const step = Math.min(d, this.speed * dt);
      let nx = this.position.x + (dx / d) * step;
      let nz = this.position.z + (dz / d) * step;
      // 不贴到玩家身上
      const gx = nx - pp.x;
      const gz = nz - pp.z;
      const g = Math.hypot(gx, gz);
      if (g < MIN_GAP && g > 1e-4) {
        nx = pp.x + (gx / g) * MIN_GAP;
        nz = pp.z + (gz / g) * MIN_GAP;
      }
      this.position.set(nx, this.ground.heightAt(nx, nz), nz);
      dx = nx - this.position.x;
      dz = nz - this.position.z;
    } else {
      this.position.y = this.ground.heightAt(this.position.x, this.position.z);
    }

    // 深水：收回球中（会飞的宝可梦照样飞在水面上）
    const deep = !this.flying && this.ground.waterDepth(this.position.x, this.position.z) > 0.55;
    if (deep !== this.inBall) {
      this.inBall = deep;
      this.root.visible = !deep;
    }

    // 朝向：移动时朝移动方向；站立时慢慢转向玩家，偶尔张望
    let want = this.yaw;
    if (this.speed > 0.2) {
      want = Math.atan2(goal.x - this.position.x || dx, goal.z - this.position.z || dz);
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
      this.lookTimer -= dt;
      if (this.lookTimer <= 0) {
        this.lookTimer = 2.5 + Math.random() * 3.5;
        this.lookYaw = (Math.random() - 0.5) * 1.4;
        if (this.idleTime > 6 && Math.random() < 0.35) this.hop = 1;
      }
      want = Math.atan2(pp.x - this.position.x, pp.z - this.position.z) + (this.idleTime > 1.5 ? this.lookYaw : 0);
    }
    this.yaw += angleDelta(this.yaw, want) * Math.min(1, dt * TURN_RATE);
    this.sync();
    updateMonModel(this.model, dt);
  }

  private sync(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    const m = this.model;
    if (this.hop > 0) this.hop = Math.max(0, this.hop - 0.035);
    const jump = Math.sin((1 - this.hop) * Math.PI) * 0.45 * (this.hop > 0 ? 1 : 0);
    const anim = monAnimator(m);
    if (anim?.has('fly')) {
      // 会飞：始终播放飞行循环，离地悬停 + 上下起伏；移动时略微前倾、加快扇翅
      setMonLoop(m, 'fly', THREE.MathUtils.clamp(0.9 + this.speed / 6, 0.9, 1.8));
      const water = this.ground.waterDepth(this.position.x, this.position.z);
      m.position.y = this.hoverHeight + water + Math.sin(this.t * 2.2) * 0.12 + jump * 0.5;
      m.scale.setScalar(this.baseScale);
      m.rotation.x = Math.min(0.25, this.speed * 0.03);
      m.rotation.z = 0;
      return;
    }
    m.rotation.x = 0;
    if (anim) {
      // 手工模型：骨骼动画走路 / 奔跑，播放速度跟随移动速度；只保留开心蹦跳
      if (this.speed > 3.4) setMonLoop(m, 'run', THREE.MathUtils.clamp(this.speed / 5, 0.8, 1.6));
      else if (this.speed > 0.2) setMonLoop(m, 'walk', THREE.MathUtils.clamp(this.speed / 2, 0.6, 1.7));
      else setMonLoop(m, 'idle');
      m.position.y = jump;
      m.scale.setScalar(this.baseScale);
      m.rotation.z = 0;
      return;
    }
    // 走路小跳 + 待机呼吸 + 开心蹦跳
    const moving = Math.min(1, this.speed / 3);
    const bob = Math.abs(Math.sin(this.t * (7 + this.speed * 1.6))) * 0.12 * moving;
    m.position.y = bob + jump;
    const breathe = 1 + Math.sin(this.t * 2.4) * 0.02 * (1 - moving);
    m.scale.set(this.baseScale * (2 - breathe), this.baseScale * breathe, this.baseScale * (2 - breathe));
    m.rotation.z = Math.sin(this.t * 7) * 0.06 * moving;
  }

  /** 与玩家对话的锚点（头顶） */
  headPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.position).setY(this.position.y + this.height + 0.2 + (this.flying ? this.hoverHeight : 0));
  }

  dispose(): void {
    this.emote.clear();
    disposeMonModel(this.model);
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.userData.sharedGeometry) mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
