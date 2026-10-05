/**
 * 任务自动寻路（T 键）：沿 A* 路线自动走 / 骑车到当前追踪任务的目标。
 * - 路线与地面指引同一套代价（道路优先，绕开陡坡 / 建筑 / 未解锁阻挡），但深水视为不可通行（自动寻路不会自己冲浪）
 * - 每 3 s、偏离路线 > 6 m、目标变化或卡住时重新寻路；距离远时自动骑上自行车
 * - 停止：再按 T、按移动键、到达目标（进入目标区域 / 半径内）、目标在别的岛、走不过去、进入室内、自动战斗开始
 * - 战斗 / 对话 / 菜单期间暂停，结束后继续
 */
import type { PlayerController } from '@/actors/player';
import { RUN_SPEED } from '@/actors/player/PlayerController';
import { findPath, type CostFn } from '@/world/nav/pathfind';

export interface AutoPathTarget {
  island: string;
  x: number;
  z: number;
  radius: number;
  zoneId: string | null;
}

export interface SceneAutoPathDeps {
  player: PlayerController;
  island(): string;
  /** 当前追踪目标（没有追踪 / 没有位置 → null） */
  target(): AutoPathTarget | null;
  /** 追踪任务的名字（提示用） */
  questName(): string | null;
  zoneAt(x: number, z: number): string | null;
  cost: CostFn;
  toast(text: string): void;
  /** 大地图空闲（非战斗 / 对话 / 菜单 / 过场） */
  idle(): boolean;
  /** 不能自动寻路的状态（飞行 / 冲浪 / 钓鱼 / 自动战斗）返回原因 */
  blocked(): string | null;
  mountBike(): boolean;
  islandName(id: string): string;
}

const REPLAN_S = 3;
const STUCK_S = 2.5;
const ARRIVE_M = 1.5;
/** 普通目标进入这个距离算到达（地面指引同样在 12 m 内淡出） */
const NEAR_M = 6;

export class SceneAutoPath {
  private running = false;
  private route: Array<[number, number]> = [];
  private idx = 0;
  private replan = 0;
  private stuck = { t: 0, x: 0, z: 0, n: 0 };
  private last = { x: NaN, z: NaN };

  constructor(private readonly d: SceneAutoPathDeps) {}

  get active(): boolean {
    return this.running;
  }

  /** 当前路线（测试 / 调试） */
  get path(): ReadonlyArray<[number, number]> {
    return this.route;
  }

  toggle(): void {
    if (this.running) return this.stop('已取消自动寻路');
    this.start();
  }

  start(): boolean {
    const why = this.d.blocked();
    if (why) {
      this.d.toast(why);
      return false;
    }
    const t = this.d.target();
    if (!t) {
      this.d.toast(this.d.questName() ? '这个任务目前没有可前往的位置' : '没有追踪中的任务（J 打开任务日志选择追踪）');
      return false;
    }
    if (t.island !== this.d.island()) {
      this.d.toast(`目标在${this.d.islandName(t.island)}，请先乘船或飞过去`);
      return false;
    }
    if (this.arrived(t)) {
      this.d.toast('已经在目标附近了');
      return false;
    }
    if (!this.plan(t)) {
      this.d.toast('找不到能走过去的路线（可能隔着深水或未解锁的阻挡）');
      return false;
    }
    this.running = true;
    this.stuck = { t: 0, x: this.d.player.position.x, z: this.d.player.position.z, n: 0 };
    const q = this.d.questName();
    this.d.toast(`自动寻路：${q ?? '任务目标'}（按 T 或移动键停止）`);
    return true;
  }

  stop(reason?: string): void {
    if (!this.running) return;
    this.running = false;
    this.route = [];
    if (reason) this.d.toast(reason);
  }

  private arrived(t: AutoPathTarget): boolean {
    const p = this.d.player.position;
    if (t.zoneId && this.d.zoneAt(p.x, p.z) === t.zoneId) return true;
    return Math.hypot(t.x - p.x, t.z - p.z) <= Math.max(NEAR_M, t.radius);
  }

  private plan(t: AutoPathTarget): boolean {
    const p = this.d.player.position;
    const path = findPath(p.x, p.z, t.x, t.z, this.d.cost, { margin: 60, maxCells: 160, minCell: 1.5 });
    this.replan = REPLAN_S;
    this.last = { x: t.x, z: t.z };
    if (!path || path.length < 2) return false;
    this.route = path;
    this.idx = 1;
    return true;
  }

  /** 固定步：返回 true 表示本步接管了玩家移动 */
  fixedUpdate(dt: number, moving: boolean): boolean {
    if (!this.running) return false;
    if (moving) {
      this.stop('手动移动，自动寻路已停止');
      return false;
    }
    if (!this.d.idle()) return false;
    const why = this.d.blocked();
    if (why) {
      this.stop(why);
      return false;
    }
    const t = this.d.target();
    if (!t) {
      this.stop('追踪的任务目标已变化');
      return false;
    }
    if (t.island !== this.d.island()) {
      this.stop(`目标在${this.d.islandName(t.island)}`);
      return false;
    }
    if (this.arrived(t)) {
      this.stop('已到达任务目标附近');
      return false;
    }
    const p = this.d.player.position;
    this.replan -= dt;
    const targetMoved = Math.hypot(t.x - this.last.x, t.z - this.last.z) > 1;
    if (targetMoved || this.replan <= 0 || this.offRoute() > 6) {
      if (!this.plan(t)) {
        this.stop('前方没有能走过去的路线了');
        return false;
      }
    }
    // 跳过已经走到的路点
    while (this.idx < this.route.length - 1) {
      const [wx, wz] = this.route[this.idx]!;
      if (Math.hypot(wx - p.x, wz - p.z) > ARRIVE_M) break;
      this.idx++;
    }
    const [tx, tz] = this.route[Math.min(this.idx, this.route.length - 1)]!;
    const pl = this.d.player;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const l = Math.hypot(dx, dz);
    const remain = Math.hypot(t.x - p.x, t.z - p.z);
    if (pl.mode === 'walk' && remain > 30 && pl.grounded) this.d.mountBike();
    const speed = pl.mode === 'bike' ? 9 : RUN_SPEED;
    const k = l > 0.01 ? Math.min(1, l / 1.2) : 0;
    pl.moveWithVelocity(dt, (dx / (l || 1)) * speed * k, (dz / (l || 1)) * speed * k, true);
    // 卡住：重新寻路；连续 3 次卡住则放弃
    this.stuck.t += dt;
    if (this.stuck.t >= STUCK_S) {
      const moved = Math.hypot(p.x - this.stuck.x, p.z - this.stuck.z);
      this.stuck.n = moved < 1.2 ? this.stuck.n + 1 : 0;
      this.stuck.t = 0;
      this.stuck.x = p.x;
      this.stuck.z = p.z;
      if (this.stuck.n >= 3) {
        this.stop('被挡住了，自动寻路已停止');
        return false;
      }
      if (this.stuck.n > 0) this.replan = 0;
    }
    return true;
  }

  private offRoute(): number {
    const p = this.d.player.position;
    let best = Infinity;
    for (let i = Math.max(1, this.idx - 1); i < Math.min(this.route.length, this.idx + 3); i++) {
      const [ax, az] = this.route[i - 1]!;
      const [bx, bz] = this.route[i]!;
      const vx = bx - ax;
      const vz = bz - az;
      const L = vx * vx + vz * vz || 1;
      const u = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.z - az) * vz) / L));
      best = Math.min(best, Math.hypot(ax + vx * u - p.x, az + vz * u - p.z));
    }
    return best;
  }
}
