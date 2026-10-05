/**
 * ACT-001 · 玩家控制器：竖直胶囊（半径 0.32 m，高 1.6 m）。
 * - 相对镜头的移动；走 4.2 m/s、跑 7.6 m/s，加减速平滑
 * - 地面 = max(地形, 可站立顶面)；可跨上 0.55 m 以内的台阶
 * - 坡度：上坡超过 40° 不可走，沿可走方向滑移（分轴尝试）
 * - 水：浅水（< 0.7 m）减速涉水；0.7–2.6 m 的浅水区可以游泳（漂浮在水面，自由泳 / 踩水动作），更深处需要水上骑乘
 *   （翠澜湖在拿到初始宝可梦前不能游泳，避免绕过道馆栈桥的剧情阻挡）
 * - 跳跃：步行与自行车都可跳（自行车为兔跳，顶点约 0.8 m）；游泳、冲浪时不可跳
 * - M1-12 水上骑乘（mode = 'surf'）：只能在水深 ≥ 0.45 m 的水面移动，贴水面漂浮；
 *   朝岸边推进时记录 shoreAhead（可登岸点），由 SceneRide 决定自动下水；上下水用 hop() 跳跃弧线
 * - 阻挡：岛屿 blockers 里未满足 flag 的圆形区域（派发 blocker:hit）
 * - 离开边缘（码头）时受重力下落
 * - 飞行骑乘（mode = 'fly'）：自由 3D 飞行，空格上升、Shift / Ctrl 下降，X 加速；可越过海面与山地，
 *   离下方地面 / 水面最高 FLY_CEILING 米，世界绝对高度不超过 FLY_ABS_MAX；
 *   剧情 / 能力封锁圈（异变结界、藤蔓、裂岩等）在飞行时同样阻挡（视为直通天顶的屏障），只有「开阔海面需要冲浪」的 surf 封锁对飞行无效
 */
import * as THREE from 'three';
import type { Input } from '@/core/input';
import type { EventBus } from '@/core/events/EventBus';
import type { BlockerConfig } from '@/config/islands/types';
import type { Terrain, CollisionWorld } from '@/world';
import { HumanModel } from './HumanModel';
import { sfx } from '@/core/audio';
import { blockerOpen } from '@/systems/interaction';
import { BIKE_DEFAULT_GEAR, BIKE_GEARS, bikeGear, bikeTargetSpeed, FLY_ABS_MAX, FLY_CEILING, FLY_CLEARANCE, FLY_CLIMB, SURF_MIN_DEPTH, SURF_SINK, type RideMode } from '@/systems/ride';

export const PLAYER_RADIUS = 0.32;
export const PLAYER_HEIGHT = 1.6;
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 7.6;
export const MAX_SLOPE = 40;
export const STEP_HEIGHT = 0.55;
/** 起跳初速度：顶点约 1.15 m，可跳上矮墙 / 箱子 / 围栏 */
export const JUMP_VELOCITY = 7.1;
export const GRAVITY = 22;
export const WADE_DEPTH = 0.7;
/** 自行车兔跳初速度：顶点约 0.82 m（比步行跳低，能跳上路肩 / 小坎） */
export const BIKE_JUMP_VELOCITY = 6.0;
/** 游泳：水深超过此值时漂浮（脚底在水面下 SWIM_FLOAT 处） */
export const SWIM_FLOAT = 1.05;
/** 浅水区上限：更深的水只能用水上骑乘 */
export const SWIM_MAX_DEPTH = 2.6;
export const SWIM_SPEED = 2.3;
export const SWIM_SPRINT = 3.4;

export class PlayerController {
  readonly root = new THREE.Group();
  /** 男主角模型（glb 就绪前显示程序化占位） */
  readonly model = new HumanModel('hero_m');
  readonly position = new THREE.Vector3();
  /** 上一个固定步的位置 / 朝向：渲染时按 alpha 插值，避免高刷新率下角色按 60 Hz 一跳一跳（第三人称抖动） */
  private readonly prevPosition = new THREE.Vector3();
  private prevFacing = 0;
  /** 插值后的渲染位置（镜头跟随用它，而不是固定步位置） */
  readonly renderPosition = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  facing = Math.PI;
  running = false;
  /** 奔跑切换模式（设置 runMode = toggle） */
  runToggle = true;
  /** 切换模式下当前是否处于奔跑状态 */
  runLatched = false;
  private runHeld = false;
  grounded = true;
  /** 当前水深（0 = 不在水中） */
  waterDepth = 0;
  /** 本帧水平移动距离（暗雷计算） */
  movedThisStep = 0;
  /** 累计移动距离（统计） */
  odometer = 0;
  private vy = 0;
  /** 主动跳跃中（落地前不贴地吸附） */
  private jumping = false;
  private jumpHeld = false;
  private lastBlockerHint = new Map<string, number>();
  private time = 0;
  /** 调试：穿墙飞行 */
  noclip = false;
  /** M1-12 骑乘模式 */
  mode: RideMode = 'walk';
  /** M3-03 洋流速度（米/秒，世界坐标），场景每步写入；只在冲浪时生效 */
  readonly drift = { x: 0, z: 0 };
  surfSpeed = 6.2;
  surfSprint = 9;
  flySpeed = 14;
  flySprint = 20;
  /** 飞行：本步是否按下降键（SceneFly 判断落地） */
  flyDescending = false;
  /** 飞行：离下方地面 / 水面的高度 */
  flyAltitude = 0;
  /** 飞行：下方是水面 */
  flyOverWater = false;
  /** 飞行：机身俯仰（渲染，正 = 抬头） */
  flyPitch = 0;
  private flyVy = 0;
  /** 水上骑乘时前方可登岸的点（每步刷新；null = 前方不是岸） */
  shoreAhead: { x: number; z: number; y: number } | null = null;
  /** 脚本跳跃（上水 / 下水） */
  private hopState: {
    fx: number;
    fy: number;
    fz: number;
    tx: number;
    ty: number;
    tz: number;
    t: number;
    dur: number;
    height: number;
    done: () => void;
  } | null = null;
  flags: (flag: string) => boolean = () => false;

  constructor(
    private readonly terrain: Terrain,
    private readonly collision: CollisionWorld,
    private readonly blockers: readonly BlockerConfig[],
    private readonly events: EventBus,
  ) {
    this.root.add(this.model.root);
    this.root.name = 'player';
    this.model.onStroke = () => sfx('step-water', 0.9);
  }

  teleport(x: number, z: number, yaw = this.facing): void {
    this.position.set(x, this.groundAt(x, z, 1e4), z);
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.jumping = false;
    this.facing = yaw;
    // 瞬移不做插值
    this.prevPosition.copy(this.position);
    this.prevFacing = yaw;
    this.syncVisual();
  }

  /** 平移（不改高度 / 速度），用于把玩家推回边界内 */
  nudge(dx: number, dz: number): void {
    this.position.x += dx;
    this.position.z += dz;
    this.prevPosition.copy(this.position);
    this.syncVisual();
  }

  /** 可站立高度（考虑码头 / 栈桥，maxY 为当前可跨上的最高顶面） */
  groundAt(x: number, z: number, maxY: number): number {
    const g = this.terrain.heightAt(x, z);
    const top = this.collision.walkableTopAt(x, z, maxY);
    return Math.max(g, top);
  }

  /** M2-22 冲浪 / 飞行可达范围（岛屿 travelBounds 之外是暗礁与巨浪） */
  outOfTravelBounds(x: number, z: number): boolean {
    const poly = this.terrain.hf.config.travelBounds;
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]!;
      const [xj, zj] = poly[j]!;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return !inside;
  }

  private blockedByBlocker(x: number, z: number): BlockerConfig | null {
    for (const b of this.blockers) {
      if (blockerOpen(b, this.flags)) continue;
      if (this.mode === 'fly' && b.type === 'surf') continue;
      const r = (b.radius ?? 2) + PLAYER_RADIUS;
      if (Math.hypot(x - b.position[0], z - b.position[2]) < r) return b;
    }
    return null;
  }

  /** 位置是否可走（不含碰撞体） */
  private canStand(fromY: number, x: number, z: number): { ok: boolean; y: number; depth: number; reason?: string } {
    const hf = this.terrain.hf;
    if (!hf.inBounds(x, z)) return { ok: false, y: fromY, depth: 0, reason: 'bounds' };
    if (this.mode === 'surf') {
      if (this.outOfTravelBounds(x, z)) return { ok: false, y: fromY, depth: 0, reason: 'bounds' };
      const w = hf.waterAt(x, z);
      const depth = w ? w.level - this.terrain.heightAt(x, z) : 0;
      // 码头 / 栈桥下方不能穿过（顶面高出水面）
      const top = this.collision.walkableTopAt(x, z, 1e4);
      if (!w || depth < SURF_MIN_DEPTH || top > (w?.level ?? 0) - 0.05)
        return { ok: false, y: fromY, depth, reason: 'shallow' };
      return { ok: true, y: w.level - SURF_SINK, depth };
    }
    const y = this.groundAt(x, z, fromY + STEP_HEIGHT);
    const onProp = y > this.terrain.heightAt(x, z) + 0.01;
    const water = onProp ? null : hf.waterAt(x, z);
    const depth = water ? water.level - y : 0;
    // 熔岩：看得见、走不进
    if (!onProp && hf.isLava(x, z)) return { ok: false, y, depth, reason: 'lava' };
    // 自行车不能骑进没过车轴的水（0.3 m）
    if (depth > (this.mode === 'bike' ? 0.3 : WADE_DEPTH)) {
      if (this.mode === 'bike' || !water || !this.swimAllowed(water.body)) return { ok: false, y, depth, reason: 'water' };
      if (depth > SWIM_MAX_DEPTH) return { ok: false, y, depth, reason: 'deep' };
      // 游泳：漂浮在水面（水不够深时脚踩水底）
      return { ok: true, y: Math.max(y, water.level - SWIM_FLOAT), depth };
    }
    if (!onProp && y > fromY + 0.02) {
      const slope = hf.slopeAt(x, z);
      if (slope > MAX_SLOPE) return { ok: false, y, depth, reason: 'slope' };
    }
    if (y > fromY + STEP_HEIGHT + 0.3 && onProp) return { ok: false, y, depth, reason: 'step' };
    return { ok: true, y, depth };
  }

  /** 该水体能否游泳（翠澜湖要先拿到初始宝可梦） */
  private swimAllowed(body: string): boolean {
    return body !== 'cuilan-lake' || this.flags('starter-chosen');
  }

  /** 正在游泳（漂浮在水面上） */
  get swimming(): boolean {
    return this.mode === 'walk' && !this.hopState && this.waterDepth >= SWIM_FLOAT - 0.08;
  }

  /** 腾空中（跳跃 / 下落） */
  get airborne(): boolean {
    return this.jumping || !this.grounded;
  }

  /** 竖直速度（米/秒，向上为正） */
  get verticalSpeed(): number {
    return this.vy;
  }

  /** 可在此处以步行方式站立（登岸检查，不改变状态） */
  standableOnFoot(x: number, z: number, fromY: number): { ok: boolean; y: number } {
    const m = this.mode;
    this.mode = 'walk';
    const r = this.canStand(fromY + 0.35, x, z);
    this.mode = m;
    const tooHigh = r.y > fromY + 1.6;
    return { ok: r.ok && !tooHigh && r.depth < 0.5, y: r.y };
  }

  /** 跳跃弧线移动到目标（上水 / 下水），期间忽略输入 */
  hop(tx: number, ty: number, tz: number, dur = 0.45, height = 0.9): Promise<void> {
    return new Promise((done) => {
      const p = this.position;
      this.velocity.set(0, 0, 0);
      this.hopState = { fx: p.x, fy: p.y, fz: p.z, tx, ty, tz, t: 0, dur, height, done };
      this.facing = Math.atan2(tx - p.x, tz - p.z);
    });
  }

  get hopping(): boolean {
    return !!this.hopState;
  }

  private stepHop(dt: number): void {
    const h = this.hopState!;
    h.t += dt;
    const k = Math.min(1, h.t / h.dur);
    const p = this.position;
    p.x = h.fx + (h.tx - h.fx) * k;
    p.z = h.fz + (h.tz - h.fz) * k;
    p.y = h.fy + (h.ty - h.fy) * k + Math.sin(k * Math.PI) * h.height;
    this.movedThisStep = 0;
    if (k >= 1) {
      this.hopState = null;
      this.vy = 0;
      h.done();
    }
  }

  fixedUpdate(dt: number, input: Input | null, cameraYaw: number): void {
    this.prevPosition.copy(this.position);
    this.prevFacing = this.facing;
    this.time += dt;
    if (this.hopState) {
      this.stepHop(dt);
      return;
    }
    const axis = input ? input.moveAxis() : { x: 0, y: 0 };
    if (this.mode === 'fly') {
      this.fixedFly(dt, input, cameraYaw, axis);
      return;
    }
    const runDown = !!input?.isDown('run');
    if (this.runToggle && runDown && !this.runHeld) this.runLatched = !this.runLatched;
    if (input) this.runHeld = runDown;
    this.running = (this.runToggle ? this.runLatched : runDown) && (axis.x !== 0 || axis.y !== 0);
    // 跳跃：边沿触发（按住不连跳）；冲浪 / 深水中不可跳
    const jumpDown = !!input?.isDown('jump');
    const canJump = (this.mode === 'walk' && this.waterDepth < 0.45) || (this.mode === 'bike' && this.waterDepth < 0.05);
    if (jumpDown && !this.jumpHeld && this.grounded && !this.jumping && canJump) {
      this.vy = this.mode === 'bike' ? BIKE_JUMP_VELOCITY : JUMP_VELOCITY;
      this.jumping = true;
      this.grounded = false;
      sfx('jump', this.mode === 'bike' ? 0.45 : 0.6);
    }
    this.jumpHeld = jumpDown;
    // 自行车变速：Q 降档 / X 升档，数字键 1–3 直接选档（边沿触发）
    if (this.mode === 'bike' && input) {
      const up = input.isDown('gearUp');
      const down = input.isDown('gearDown');
      let g = this.bikeGear;
      if (up && !this.gearUpHeld) g++;
      if (down && !this.gearDownHeld) g--;
      for (let i = 1; i <= BIKE_GEARS.length; i++) if (input.pressedCode(`Digit${i}`)) g = i;
      this.gearUpHeld = up;
      this.gearDownHeld = down;
      g = Math.max(1, Math.min(BIKE_GEARS.length, g));
      if (g !== this.bikeGear) {
        this.bikeGear = g;
        sfx('bike-tick', 0.9);
        this.onGearChange?.(g);
      }
    }
    const speed =
      this.mode === 'surf'
        ? this.running
          ? this.surfSprint
          : this.surfSpeed
        : this.mode === 'bike'
          ? bikeTargetSpeed(this.bikeGear, this.bikeSlope(cameraYaw, axis), this.waterDepth)
          : this.swimming
            ? this.running
              ? SWIM_SPRINT
              : SWIM_SPEED
            : (this.running ? RUN_SPEED : WALK_SPEED) * (this.waterDepth > 0.25 ? 0.55 : 1);
    // 镜头朝向 → 世界方向（相机 forwardYaw 指向画面深处）
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const rx = -fz;
    const rz = fx;
    // M3-03 洋流：冲浪时叠加到目标速度（经过正常的碰撞 / 可达范围检查）
    const surfDrift = this.mode === 'surf';
    const wantX = (fx * axis.y + rx * axis.x) * speed + (surfDrift ? this.drift.x : 0);
    const wantZ = (fz * axis.y + rz * axis.x) * speed + (surfDrift ? this.drift.z : 0);
    // 自行车：起步与刹车更柔和（有滑行惯性）
    const drifting = surfDrift && (this.drift.x !== 0 || this.drift.z !== 0);
    const accel = this.mode === 'bike' ? (axis.x || axis.y ? bikeGear(this.bikeGear).accel : 3.2) : axis.x || axis.y ? 14 : drifting ? 2.5 : 18;
    const k = 1 - Math.exp(-accel * dt);
    this.velocity.x += (wantX - this.velocity.x) * k;
    this.velocity.z += (wantZ - this.velocity.z) * k;
    this.move(dt);
  }

  /** 飞行骑乘：地面 / 水面下限（下方最高的那个） */
  flyFloor(x: number, z: number): { y: number; water: boolean } {
    const g = this.groundAt(x, z, 1e4);
    const w = this.terrain.hf.waterAt(x, z);
    return w && w.level > g ? { y: w.level, water: true } : { y: g, water: false };
  }

  private fixedFly(dt: number, input: Input | null, cameraYaw: number, axis: { x: number; y: number }): void {
    const up = !!input?.isDown('jump');
    const down = !!input && (input.isDown('descend') || input.isDown('run'));
    const boost = !!input?.isDown('gearUp');
    this.running = boost && (axis.x !== 0 || axis.y !== 0);
    this.flyDescending = down && !up;
    const speed = boost ? this.flySprint : this.flySpeed;
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const wantX = (fx * axis.y - fz * axis.x) * speed;
    const wantZ = (fz * axis.y + fx * axis.x) * speed;
    const k = 1 - Math.exp(-(axis.x || axis.y ? 3.5 : 2.2) * dt);
    this.velocity.x += (wantX - this.velocity.x) * k;
    this.velocity.z += (wantZ - this.velocity.z) * k;
    const wantVy = up && !down ? FLY_CLIMB : down && !up ? -FLY_CLIMB * 1.3 : 0;
    this.flyVy += (wantVy - this.flyVy) * (1 - Math.exp(-5 * dt));
    this.moveFly(dt);
  }

  private moveFly(dt: number): void {
    const p = this.position;
    const sx = p.x;
    const sz = p.z;
    let nx = p.x + this.velocity.x * dt;
    let nz = p.z + this.velocity.z * dt;
    const hf = this.terrain.hf;
    // 岛屿边界：沿边界滑行
    if (!hf.inBounds(nx, nz)) {
      if (hf.inBounds(nx, sz)) nz = sz;
      else if (hf.inBounds(sx, nz)) nx = sx;
      else {
        nx = sx;
        nz = sz;
      }
      this.velocity.x *= 0.5;
      this.velocity.z *= 0.5;
    }
    // 飞行范围：航线走廊与近海之外（暗礁、巨浪、海雾）飞不过去
    if (this.outOfTravelBounds(nx, nz)) {
      if ((this.lastBlockerHint.get('travel-bounds') ?? -99) + 4 < this.time) {
        this.lastBlockerHint.set('travel-bounds', this.time);
        this.events.emit('blocker:hit', { id: 'travel-bounds', hint: '前方是终年不散的海雾与暗礁，再往外飞就迷失方向了。' });
      }
      nx = sx;
      nz = sz;
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }
    // 封锁圈（异变结界等）：飞行同样阻挡，沿圆周滑开并提示
    const blk = this.blockedByBlocker(nx, nz);
    if (blk) {
      if ((this.lastBlockerHint.get(blk.id) ?? -99) + 4 < this.time) {
        this.lastBlockerHint.set(blk.id, this.time);
        this.events.emit('blocker:hit', { id: blk.id, hint: blk.hint });
      }
      const dx = nx - blk.position[0];
      const dz = nz - blk.position[2];
      const d = Math.hypot(dx, dz) || 1;
      const r = (blk.radius ?? 2) + PLAYER_RADIUS + 0.01;
      nx = blk.position[0] + (dx / d) * r;
      nz = blk.position[2] + (dz / d) * r;
    }
    // 建筑 / 树木：只在该高度范围内阻挡（飞得够高就越过去）
    const res = this.collision.resolve(nx, nz, PLAYER_RADIUS + 0.4, p.y - 0.6, p.y + PLAYER_HEIGHT);
    nx = res.x;
    nz = res.z;
    const floor = this.flyFloor(nx, nz);
    const minY = floor.y + FLY_CLEARANCE;
    const maxY = Math.min(FLY_ABS_MAX, floor.y + FLY_CEILING);
    let ny = p.y + this.flyVy * dt;
    if (ny < minY) {
      // 撞上山坡：被抬升（不会钻进地形）
      ny = p.y < minY ? p.y + (minY - p.y) * Math.min(1, dt * 12) : minY;
      if (this.flyVy < 0) this.flyVy = 0;
    }
    if (ny > maxY) {
      ny = Math.max(maxY, Math.min(p.y, ny) - 4 * dt);
      if (this.flyVy > 0) this.flyVy *= 0.5;
    }
    this.movedThisStep = Math.hypot(nx - sx, nz - sz);
    this.odometer += this.movedThisStep;
    p.set(nx, ny, nz);
    this.flyAltitude = ny - floor.y;
    this.flyOverWater = floor.water;
    this.grounded = false;
    this.jumping = false;
    this.vy = this.flyVy;
    this.waterDepth = 0;
    this.shoreAhead = null;
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (hs > 0.3) {
      let d = Math.atan2(this.velocity.x, this.velocity.z) - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 4);
    }
    const pitch = THREE.MathUtils.clamp(this.flyVy / FLY_CLIMB, -1, 1) * 0.28 - Math.min(1, hs / this.flySprint) * 0.12;
    this.flyPitch += (pitch - this.flyPitch) * Math.min(1, dt * 4);
  }

  /** 进入飞行（SceneFly 调用）：从当前位置起飞 */
  beginFly(): void {
    this.mode = 'fly';
    this.flyVy = FLY_CLIMB * 0.8;
    this.flyPitch = 0;
    this.runLatched = false;
  }

  /** 退出飞行（落地点由 SceneFly 处理） */
  endFly(): void {
    this.flyVy = 0;
    this.flyPitch = 0;
    this.flyDescending = false;
    this.vy = 0;
    if (this.mode === 'fly') this.mode = 'walk';
  }

  /** 自行车当前档位（1–3） */
  bikeGear = BIKE_DEFAULT_GEAR;
  private gearUpHeld = false;
  private gearDownHeld = false;
  /** 换挡回调（HUD / 音效） */
  onGearChange: ((gear: number) => void) | null = null;

  /** 沿输入方向前方 1.5 m 的坡度（上坡为正） */
  private bikeSlope(cameraYaw: number, axis: { x: number; y: number }): number {
    if (!axis.x && !axis.y) return 0;
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const dx = fx * axis.y - fz * axis.x;
    const dz = fz * axis.y + fx * axis.x;
    const l = Math.hypot(dx, dz) || 1;
    const p = this.position;
    const d = 1.5;
    const h0 = this.groundAt(p.x, p.z, p.y + 1);
    const h1 = this.groundAt(p.x + (dx / l) * d, p.z + (dz / l) * d, p.y + 2);
    return Number.isFinite(h0) && Number.isFinite(h1) ? (h1 - h0) / d : 0;
  }

  /** 外部驱动（自动驾驶、脚本移动）：直接给期望速度 */
  moveWithVelocity(dt: number, vx: number, vz: number, running: boolean, flyVy?: number): void {
    this.prevPosition.copy(this.position);
    this.prevFacing = this.facing;
    if (this.mode === 'fly') {
      this.velocity.x = vx;
      this.velocity.z = vz;
      // 外部驱动的飞行：给了垂直速度就平滑跟随，否则保持高度
      this.flyVy += ((flyVy ?? 0) - this.flyVy) * (1 - Math.exp(-5 * dt));
      this.flyDescending = (flyVy ?? 0) < -0.5;
      this.time += dt;
      this.moveFly(dt);
      return;
    }
    if (this.hopState) {
      this.time += dt;
      this.stepHop(dt);
      return;
    }
    this.velocity.x = vx;
    this.velocity.z = vz;
    this.running = running;
    this.time += dt;
    this.move(dt);
  }

  private move(dt: number): void {
    const p = this.position;
    const sx = p.x;
    const sz = p.z;
    let nx = p.x + this.velocity.x * dt;
    let nz = p.z + this.velocity.z * dt;
    if (this.noclip) {
      p.x = nx;
      p.z = nz;
      p.y = Math.max(this.groundAt(nx, nz, 1e4), p.y);
      this.syncVisual();
      return;
    }
    // 碰撞体推出
    const res = this.collision.resolve(nx, nz, PLAYER_RADIUS, p.y, p.y + PLAYER_HEIGHT);
    nx = res.x;
    nz = res.z;
    // 阻挡
    const blk = this.blockedByBlocker(nx, nz);
    if (blk) {
      const now = this.time;
      if ((this.lastBlockerHint.get(blk.id) ?? -99) + 4 < now) {
        this.lastBlockerHint.set(blk.id, now);
        this.events.emit('blocker:hit', { id: blk.id, hint: blk.hint });
      }
      // 沿阻挡圆周滑开
      const dx = nx - blk.position[0];
      const dz = nz - blk.position[2];
      const d = Math.hypot(dx, dz) || 1;
      const r = (blk.radius ?? 2) + PLAYER_RADIUS + 0.01;
      nx = blk.position[0] + (dx / d) * r;
      nz = blk.position[2] + (dz / d) * r;
    }
    // 地形可走性，失败时分轴滑移
    let st = this.canStand(p.y, nx, nz);
    if (this.mode === 'surf') {
      this.shoreAhead = null;
      const hs = Math.hypot(this.velocity.x, this.velocity.z);
      if (!st.ok && st.reason === 'shallow' && hs > 0.5) {
        // 沿移动方向找 0.8–2.2 m 外可站立的陆地
        const dx = this.velocity.x / hs;
        const dz = this.velocity.z / hs;
        for (const d of [0.8, 1.3, 1.8, 2.2]) {
          const lx = p.x + dx * d;
          const lz = p.z + dz * d;
          const f = this.standableOnFoot(lx, lz, p.y);
          if (f.ok) {
            this.shoreAhead = { x: lx, z: lz, y: f.y };
            break;
          }
        }
      }
    }
    if (!st.ok && st.reason === 'deep') {
      const now = this.time;
      if ((this.lastBlockerHint.get('deep-water') ?? -99) + 4 < now) {
        this.lastBlockerHint.set('deep-water', now);
        this.events.emit('blocker:hit', { id: 'deep-water', hint: '再往前水太深了，游不过去……需要「水上骑乘」。' });
      }
    }
    if (!st.ok) {
      const a = this.canStand(p.y, nx, sz);
      const b = this.canStand(p.y, sx, nz);
      if (a.ok && Math.abs(nx - sx) > 1e-4) {
        nz = sz;
        st = a;
      } else if (b.ok && Math.abs(nz - sz) > 1e-4) {
        nx = sx;
        st = b;
      } else {
        nx = sx;
        nz = sz;
        st = this.canStand(p.y, sx, sz);
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }
    this.movedThisStep = Math.hypot(nx - sx, nz - sz);
    this.odometer += this.movedThisStep;
    p.x = nx;
    p.z = nz;
    // 竖直：贴地或下落
    const ground = st.y;
    if (this.mode === 'surf') {
      p.y += (ground - p.y) * Math.min(1, dt * 10);
      this.vy = 0;
      this.grounded = true;
    } else if (this.jumping || p.y - ground > 0.35) {
      const falling = this.vy;
      this.vy -= GRAVITY * dt;
      p.y += this.vy * dt;
      if (p.y <= ground && this.vy <= 0) {
        p.y = ground;
        this.vy = 0;
        this.grounded = true;
        const wl = this.terrain.hf.waterAt(p.x, p.z);
        const intoWater = !!wl && wl.level - this.terrain.heightAt(p.x, p.z) > SWIM_FLOAT - 0.1;
        if (intoWater && (this.jumping || falling < -3)) sfx('splash', Math.min(1, 0.5 + -falling / 12));
        else if (this.jumping || falling < -5) sfx('land', Math.min(1, 0.4 + -falling / 14));
        this.jumping = false;
      } else this.grounded = false;
    } else {
      // 平滑贴地（上台阶快，下坡跟随）
      p.y += (ground - p.y) * Math.min(1, dt * 20);
      this.vy = 0;
      this.grounded = true;
    }
    const water = this.terrain.hf.waterAt(p.x, p.z);
    this.waterDepth = water && p.y < water.level ? water.level - p.y : 0;
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (hs > 0.3) {
      const want = Math.atan2(this.velocity.x, this.velocity.z);
      let d = want - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.facing += d * Math.min(1, dt * (this.mode === 'bike' ? 7 : 12));
    }
  }

  /** 渲染帧：同步模型 */
  update(dt: number): void {
    // 骑乘时坐在坐骑背上（ride 坐姿，不播放走路动画）
    this.model.pose = this.hopState ? null : this.mode === 'surf' || this.mode === 'fly' ? 'ride' : this.mode === 'bike' ? 'sit' : null;
    this.model.airborne = this.mode === 'walk' && !this.swimming && (this.jumping || (!this.grounded && this.vy < -2));
    this.model.swimming = this.swimming;
    this.model.animate(
      dt,
      this.mode !== 'walk' || this.hopState ? 0 : Math.hypot(this.velocity.x, this.velocity.z),
      this.time,
    );
    this.syncVisual();
  }

  /** 渲染前调用：在上一固定步与当前固定步之间插值（alpha ∈ [0,1)） */
  interpolate(alpha: number): void {
    const a = Math.min(1, Math.max(0, alpha));
    this.renderPosition.lerpVectors(this.prevPosition, this.position, a);
    this.root.position.copy(this.renderPosition);
    if (this.mode === 'surf' && !this.hopState) this.root.position.y += Math.sin(this.time * 2.1) * 0.05;
    else if (this.swimming) this.root.position.y += Math.sin(this.time * 2.6) * 0.035; // 随波起伏
    let d = this.facing - this.prevFacing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y = this.prevFacing + d * a;
  }

  private syncVisual(): void {
    this.renderPosition.copy(this.position);
    this.root.position.copy(this.position);
    if (this.mode === 'surf' && !this.hopState) this.root.position.y += Math.sin(this.time * 2.1) * 0.05;
    else if (this.swimming) this.root.position.y += Math.sin(this.time * 2.6) * 0.035; // 随波起伏
    this.root.rotation.y = this.facing;
  }

  /** 头部高度（第一人称镜头 / 第三人称注视点） */
  eye(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.position.x, this.position.y + 1.5, this.position.z);
  }
}
