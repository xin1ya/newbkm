/**
 * 任务地面指引：从玩家脚下到追踪目标，沿 A* 路线铺一串贴地的发光箭头（优先走道路，绕开深水 / 陡坡 / 建筑）。
 * - 只画前方 70 m；一道亮光沿路线流向目标（“跟着光走”）
 * - 玩家离开路线 > 6 m、目标变化或每 2.5 s 重新寻路
 * - 进入目标 12 m 内、战斗 / 过场、设置关闭世界标记时淡出
 */
import * as THREE from 'three';
import { findPath, resample, type CostFn } from '@/world/nav/pathfind';

const SPACING = 1.9;
const MAX_LEN = 70;
const MAX_DOTS = Math.ceil(MAX_LEN / SPACING) + 1;

function chevronGeometry(): THREE.BufferGeometry {
  // 平放的“〉”形箭头，尖端指向 +Z
  const g = new THREE.BufferGeometry();
  const w = 0.32;
  const t = 0.11;
  const v = [-w, 0, -0.16, 0, 0, 0.14, 0, 0, 0.14 - t * 1.6, -w, 0, -0.16, 0, 0, 0.14 - t * 1.6, -w, 0, -0.16 - t * 1.6, w, 0, -0.16, w, 0, -0.16 - t * 1.6, 0, 0, 0.14 - t * 1.6, w, 0, -0.16, 0, 0, 0.14 - t * 1.6, 0, 0, 0.14];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

export class QuestPath {
  readonly mesh: THREE.InstancedMesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private path: Array<[number, number]> | null = null;
  private dots: Array<[number, number, number]> = [];
  private lastTarget = { x: NaN, z: NaN };
  private lastStart = { x: NaN, z: NaN };
  private timer = 0;
  private alpha = 0;
  private time = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.InstancedMesh(chevronGeometry(), this.mat, MAX_DOTS);
    this.mesh.name = 'quest-path';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.userData.outline = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** 主线金色 / 支线青色 */
  setCategory(cat: 'main' | 'side' | 'hidden'): void {
    this.mat.color.set(cat === 'main' ? '#ffd45a' : cat === 'side' ? '#7fe6ff' : '#d6a8ff');
  }

  /** 当前路线（测试 / 调试） */
  get route(): ReadonlyArray<[number, number]> | null {
    return this.path;
  }

  update(dt: number, target: { x: number; z: number; radius: number } | null, player: THREE.Vector3, heightAt: (x: number, z: number) => number, cost: CostFn | undefined, show: boolean): void {
    this.time += dt;
    const dist = target ? Math.hypot(target.x - player.x, target.z - player.z) : 0;
    const want = show && !!target && !!cost && dist > Math.max(12, target.radius);
    this.alpha += ((want ? 1 : 0) - this.alpha) * Math.min(1, dt * 3);
    this.mat.opacity = this.alpha * 0.85;
    if (this.alpha < 0.01) {
      this.mesh.visible = false;
      if (!want) this.path = null;
      return;
    }
    this.mesh.visible = true;
    if (want && target && cost) {
      this.timer -= dt;
      const moved = Math.hypot(player.x - this.lastStart.x, player.z - this.lastStart.z);
      const targetMoved = Math.hypot(target.x - this.lastTarget.x, target.z - this.lastTarget.z) > 1 || Number.isNaN(this.lastTarget.x);
      if (targetMoved || !this.path || this.timer <= 0 || (moved > 6 && this.offRoute(player) > 6)) this.recompute(player, target, cost);
    }
    // 只画玩家当前位置之后的部分：找到路线上离玩家最近的点作为起点
    const dots = this.dots;
    let startD = 0;
    let best = Infinity;
    for (const d of dots) {
      const dd = (d[0] - player.x) ** 2 + (d[1] - player.z) ** 2;
      if (dd < best) {
        best = dd;
        startD = d[2];
      }
    }
    let n = 0;
    const flow = (this.time * 9) % 26;
    for (let i = 0; i < dots.length && n < MAX_DOTS; i++) {
      const d = dots[i]!;
      const rel = d[2] - startD;
      if (rel < 1.6 || rel > MAX_LEN) continue;
      const nx = dots[i + 1] ?? d;
      const pv = dots[i - 1] ?? d;
      const yaw = Math.atan2(nx[0] - pv[0], nx[1] - pv[1]);
      // 亮光波：沿路线向前流动；两端渐隐
      const wave = Math.max(0, 1 - Math.abs(((rel - flow) % 26 + 26) % 26 - 3) / 3);
      const fade = Math.min(1, (rel - 1.6) / 4) * Math.min(1, (MAX_LEN - rel) / 12);
      const sc = (0.75 + wave * 0.45) * fade;
      if (sc < 0.02) continue;
      this.q.setFromAxisAngle(this.up, yaw);
      this.p.set(d[0], heightAt(d[0], d[1]) + 0.09, d[1]);
      this.m.compose(this.p, this.q, this.s.set(sc, 1, sc));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private offRoute(player: THREE.Vector3): number {
    let best = Infinity;
    for (const d of this.dots) best = Math.min(best, Math.hypot(d[0] - player.x, d[1] - player.z));
    return best;
  }

  private recompute(player: THREE.Vector3, target: { x: number; z: number }, cost: CostFn): void {
    this.timer = 2.5;
    this.lastStart = { x: player.x, z: player.z };
    this.lastTarget = { x: target.x, z: target.z };
    // 远目标：只规划前方 ~260 m 的一段（朝目标方向截取中间点），避免网格过粗
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const L = Math.hypot(dx, dz);
    const k = L > 260 ? 260 / L : 1;
    const gx = player.x + dx * k;
    const gz = player.z + dz * k;
    const p = findPath(player.x, player.z, gx, gz, cost, { margin: 36, maxCells: 110, minCell: 2.5, minCost: 0.55 });
    // 找不到（例如需要水上骑乘才能过去）：退化为直线，至少给出方向
    this.path = p ?? [
      [player.x, player.z],
      [gx, gz],
    ];
    this.dots = resample(this.path, SPACING, 400);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
