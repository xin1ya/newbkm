/**
 * ACT-001 · 镜头：第三人称环绕（鼠标拖拽 / 右摇杆）+ 第一人称（指针锁定），V 切换。
 * - 第三人称（MMORPG 式跟随，FF14 / 原神手感）：
 *     · 注视点在角色胸口偏上（pivotHeight），不是脚底，人物落在画面下 1/3 处
 *     · 鼠标拖拽 / 右摇杆自由环绕；松手 followDelay 秒后，移动时镜头按速度平滑转回角色背后
 *       （朝镜头方向倒走时不回正，避免镜头乱甩）
 *     · 滚轮平滑缩放 1.8–14 m；遮挡时先抬俯仰、再拉近，遮挡解除后缓慢恢复
 * - 遮挡：由外部注入 occlusion(from, to) → 0–1（命中比例），镜头拉近到遮挡物前
 * - 镜头下限：不低于地面 + 0.4 m（由 groundAt 注入）
 * - 第一人称：眼高 1.55 m，俯仰 ±80°，隐藏角色模型（由调用方根据 mode 处理）
 * - 支持脚本镜头（战斗）：setOverride(pos, lookAt) 期间不处理输入
 */
import * as THREE from 'three';
import type { Input } from '../input/Input';

export type CameraMode = 'third' | 'first';

export interface CameraEnv {
  occlusion?: (from: THREE.Vector3, to: THREE.Vector3) => number;
  groundAt?: (x: number, z: number) => number;
}

export class CameraRig {
  mode: CameraMode = 'third';
  yaw = Math.PI;
  pitch = 0.32;
  distance = 6;
  /** 第三人称注视点高度（相对脚底，米） */
  pivotHeight = 1.45;
  /** 自动回正到角色背后 */
  autoFollow = true;
  /** 手动转镜头后多久开始自动回正（秒） */
  followDelay = 1.1;
  /** 自动回正速度（弧度/秒的比例系数，跑步时满速） */
  followRate = 1.6;
  private sinceManual = 99;
  private followHeading = 0;
  private followSpeed = 0;
  private zoomDist = 6;
  /** 为越过遮挡自动增加的俯仰角（弧度，平滑） */
  private autoLift = 0;
  private static readonly LIFT_STEPS = [0, 0.12, 0.25, 0.4, 0.55, 0.7];
  minDistance = 1.8;
  maxDistance = 14;
  sensitivity = 0.0035;
  /** 设置：上下反转 */
  invertY = false;
  readonly target = new THREE.Vector3();
  /** 第一人称眼高（米，相对 target 即脚底） */
  eyeHeight = 1.55;
  private smoothTarget = new THREE.Vector3();
  private currentDist = 6;
  private readonly pivot = new THREE.Vector3();
  private override: { pos: THREE.Vector3; look: THREE.Vector3; lerp: number; fov: number | null; owner: string | null } | null = null;
  /** 脚本镜头结束后平滑回到跟随机位（秒） */
  private returnT = 0;
  private static readonly RETURN_TIME = 0.6;
  private readonly returnPos = new THREE.Vector3();
  private readonly returnQuat = new THREE.Quaternion();
  /** override 结束后恢复的视野角（第一次设置 fov 覆盖时记录） */
  private baseFov: number | null = null;
  private punchT = 0;
  private punchAmt = 0;
  private punchApplied = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  private initialized = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly env: CameraEnv = {},
  ) {}

  /** 第三人称也锁定鼠标（设置「锁定鼠标」；第一人称始终锁定） */
  lockThird = true;
  private input: Input | null = null;

  /**
   * 切换镜头模式。request = false 时只更新「想要锁定」标记，不立即抢鼠标（菜单开着时）；
   * 锁定后鼠标移动直接转镜头，Esc 解锁，点击画面重新锁定。
   */
  setMode(m: CameraMode, input?: Input, request = true): void {
    this.mode = m;
    if (input) this.input = input;
    const inp = input ?? this.input;
    const want = m === 'first' || this.lockThird;
    if (inp) inp.wantPointerLock = want;
    if (m === 'first') this.pitch = 0;
    else this.pitch = Math.max(this.pitch, 0.2);
    if (!request) return;
    if (want) inp?.requestPointerLock();
    else inp?.exitPointerLock();
  }

  toggleMode(input?: Input): void {
    this.setMode(this.mode === 'third' ? 'first' : 'third', input);
  }

  /** 镜头回到角色背后 */
  resetBehind(facingYaw: number): void {
    this.yaw = facingYaw + Math.PI;
    this.pitch = 0.32;
  }

  /** 每帧由场景提供角色朝向（弧度）与水平速度（m/s），用于自动回正 */
  setFollow(headingYaw: number, speed: number): void {
    this.followHeading = headingYaw;
    this.followSpeed = speed;
  }

  /** 设置镜头距离（立即生效，不走缩放平滑） */
  setDistance(d: number): void {
    this.distance = this.zoomDist = this.currentDist = THREE.MathUtils.clamp(d, this.minDistance, this.maxDistance);
  }

  /** 外部机位（战斗等）。fov 给定时同时缩放视野（战斗特写用缩放代替移动机位） */
  setOverride(pos: THREE.Vector3, look: THREE.Vector3, lerp = 1, fov: number | null = null, owner: string | null = null): void {
    if (fov !== null && this.baseFov === null) this.baseFov = this.camera.fov;
    this.returnT = 0;
    if (!this.override) this.override = { pos: pos.clone(), look: look.clone(), lerp, fov, owner };
    else {
      this.override.pos.copy(pos);
      this.override.look.copy(look);
      this.override.lerp = lerp;
      this.override.fov = fov;
      this.override.owner = owner;
    }
  }
  /** 当前脚本镜头的持有者（'talk' 对话镜头 / null 战斗等） */
  get overrideOwner(): string | null {
    return this.override?.owner ?? null;
  }
  /**
   * 结束脚本镜头。owner 给定时只清除该持有者的镜头（对话结束不会误清战斗镜头）；
   * smooth = true 时从当前机位平滑过渡回跟随机位。
   */
  clearOverride(owner?: string, smooth = false): void {
    if (!this.override) return;
    if (owner !== undefined && this.override.owner !== owner) return;
    this.override = null;
    if (smooth && this.mode === 'third') {
      this.returnPos.copy(this.camera.position);
      this.returnQuat.copy(this.camera.quaternion);
      this.returnT = CameraRig.RETURN_TIME;
    }
    if (this.baseFov !== null) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.baseFov = null;
    }
  }
  get overridden(): boolean {
    return this.override !== null;
  }

  /** 视野冲击：瞬间收窄 amt 度后回弹（受击打击感） */
  punch(amt: number, seconds = 0.22): void {
    this.punchAmt = amt;
    this.punchT = seconds;
    this.punchDur = seconds;
  }
  private punchDur = 0.22;

  shake(amp: number, seconds: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, seconds);
  }

  /** 相机水平朝向（角色移动相对于它） */
  get forwardYaw(): number {
    return this.mode === 'first' ? this.yaw : this.yaw + Math.PI;
  }

  snap(): void {
    this.smoothTarget.copy(this.target);
    this.currentDist = this.zoomDist = this.distance;
    this.initialized = true;
  }

  update(dt: number, input: Input | null): void {
    // 先撤销上一帧的视野冲击，避免影响镜头逻辑
    if (this.punchApplied !== 0) {
      this.camera.fov += this.punchApplied;
      this.punchApplied = 0;
      this.camera.updateProjectionMatrix();
    }
    const cam = this.camera;
    if (this.override) {
      const k = 1 - Math.exp(-dt * 6 * this.override.lerp);
      cam.position.lerp(this.override.pos, this.override.lerp >= 1 ? 1 : k);
      const look = new THREE.Vector3();
      cam.getWorldDirection(look);
      const want = this.override.look.clone().sub(cam.position).normalize();
      look.lerp(want, this.override.lerp >= 1 ? 1 : k);
      cam.lookAt(cam.position.clone().add(look));
      const wantFov = this.override.fov ?? this.baseFov;
      if (wantFov !== null && Math.abs(cam.fov - wantFov) > 0.01) {
        cam.fov += (wantFov - cam.fov) * (this.override.lerp >= 1 ? 1 : k);
        cam.updateProjectionMatrix();
      }
      this.applyShake(dt);
      return;
    }
    if (input) {
      const l = input.consumeLook(dt);
      if (l.x || l.y) this.sinceManual = 0;
      this.yaw -= l.x * this.sensitivity;
      this.pitch += l.y * this.sensitivity * (this.mode === 'first' ? -1 : 1) * (this.invertY ? -1 : 1);
      const w = input.consumeWheel();
      // 缩放步长随距离变化（近处细、远处粗）
      if (w && this.mode === 'third') this.distance = THREE.MathUtils.clamp(this.distance + w * (0.35 + this.distance * 0.12), this.minDistance, this.maxDistance);
    }
    this.sinceManual += dt;
    if (!this.initialized) this.snap();
    if (this.mode === 'first') {
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.4, 1.4);
      // target 是角色脚底：第一人称抬到眼高（此前镜头在脚部）
      cam.position.copy(this.target);
      cam.position.y += this.eyeHeight;
      const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      cam.lookAt(cam.position.clone().add(dir));
      this.smoothTarget.copy(this.target);
      this.applyShake(dt);
      return;
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.26, 1.13);
    // 目标跟随阻尼（竖直更柔和，避免上下台阶时晃动）
    const kh = 1 - Math.exp(-dt * 14);
    const kv = 1 - Math.exp(-dt * 7);
    this.smoothTarget.x += (this.target.x - this.smoothTarget.x) * kh;
    this.smoothTarget.z += (this.target.z - this.smoothTarget.z) * kh;
    this.smoothTarget.y += (this.target.y - this.smoothTarget.y) * kv;
    // 自动回正：移动中、一段时间没手动转镜头 → 镜头平滑绕到角色背后
    if (this.autoFollow && this.sinceManual > this.followDelay && this.followSpeed > 0.6) {
      let d = this.followHeading + Math.PI - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // |d| 接近 π = 角色正朝镜头走：不回正（否则镜头会绕半圈甩到前面）
      if (Math.abs(d) < 2.3) {
        const ramp = Math.min(1, (this.sinceManual - this.followDelay) / 0.8);
        // 横移时回正很慢（否则按住 A/D 会绕圈跑），向前跑时最快
        const fwd = 0.2 + 0.8 * Math.max(0, Math.cos(d));
        const rate = this.followRate * Math.min(1, this.followSpeed / 6) * ramp * fwd;
        this.yaw += d * (1 - Math.exp(-dt * rate));
      }
    }
    // 滚轮缩放平滑
    this.zoomDist += (this.distance - this.zoomDist) * (1 - Math.exp(-dt * 10));
    const pivot = this.pivot.copy(this.smoothTarget);
    pivot.y += this.pivotHeight;
    // 遮挡处理：先尝试抬高俯仰角越过（上坡、矮墙、灌木），都不行才拉近（墙角、树干）
    const dirAt = (pitch: number) => new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    let dist = this.zoomDist;
    let wantLift = 0;
    let f = 1;
    if (this.env.occlusion) {
      for (const lift of CameraRig.LIFT_STEPS) {
        const p = Math.min(1.13, this.pitch + lift);
        f = this.env.occlusion(pivot, pivot.clone().addScaledVector(dirAt(p), dist));
        wantLift = p - this.pitch;
        if (f >= 1) break;
      }
      if (f < 1) {
        // 所有角度都被挡：回到原角度按最近遮挡拉近
        wantLift = 0;
        f = this.env.occlusion(pivot, pivot.clone().addScaledVector(dirAt(this.pitch), dist));
        dist = Math.max(1.2, dist * f - 0.3);
      }
    }
    // 抬升快、回落慢，避免上下抖动
    const kl = wantLift > this.autoLift ? 1 - Math.exp(-dt * 8) : 1 - Math.exp(-dt * 1.5);
    this.autoLift += (wantLift - this.autoLift) * kl;
    const offset = dirAt(Math.min(1.13, this.pitch + this.autoLift));
    // 拉近快、恢复慢
    const kd = dist < this.currentDist ? 1 - Math.exp(-dt * 20) : 1 - Math.exp(-dt * 3);
    this.currentDist += (dist - this.currentDist) * kd;
    cam.position.copy(pivot).addScaledVector(offset, this.currentDist);
    if (this.env.groundAt) {
      const g = this.env.groundAt(cam.position.x, cam.position.z) + 0.4;
      if (cam.position.y < g) cam.position.y = g;
    }
    cam.lookAt(pivot);
    if (this.returnT > 0) {
      // 从脚本镜头平滑回到跟随机位（缓入缓出）
      this.returnT = Math.max(0, this.returnT - dt);
      const t = 1 - this.returnT / CameraRig.RETURN_TIME;
      const e = t * t * (3 - 2 * t);
      cam.position.lerpVectors(this.returnPos, cam.position, e);
      cam.quaternion.slerpQuaternions(this.returnQuat, cam.quaternion, e);
    }
    this.applyShake(dt);
  }

  private applyShake(dt: number): void {
    // 本帧的视野冲击（上一帧的已在 update 开头撤销）
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const k = this.punchT / this.punchDur;
      this.punchApplied = this.punchAmt * Math.sin(k * Math.PI * 0.5);
      this.camera.fov -= this.punchApplied;
      this.camera.updateProjectionMatrix();
    }
    if (this.shakeT <= 0) return;
    this.shakeT -= dt;
    const a = this.shakeAmp * Math.min(1, this.shakeT * 3);
    this.camera.position.x += (Math.random() - 0.5) * a;
    this.camera.position.y += (Math.random() - 0.5) * a;
    if (this.shakeT <= 0) this.shakeAmp = 0;
  }
}
