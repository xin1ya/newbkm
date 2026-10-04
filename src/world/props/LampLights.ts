/**
 * 路灯真实光源（夜晚）。
 *
 * - 光源池：固定数量的 PointLight（low 4 / medium 8 / high 12）。数量永不变化，避免 three.js 因光源数变化重编译着色器；
 *   白天强度为 0。每 0.2 秒按与玩家的距离挑出最近的灯，把池里的光源移过去；远处边缘按距离淡出，换灯不会突然跳变。
 * - 地面光斑：每盏路灯脚下一个加法混合的暖色光晕（InstancedMesh，1 次 draw call），远处没分到真实光源的路灯也能照亮地面。
 * - townGlow：玩家附近路灯的密度（0..1），夜晚给半球光加一点暖色补光，城镇里不会一片漆黑。
 */
import * as THREE from 'three';

export interface LampLightsOptions {
  /** 光源池大小 */
  pool: number;
  /** 真实光源的分配半径（米） */
  radius?: number;
  /** 灯脚下地面高度；返回 -Infinity 表示没有地面（不放光斑） */
  groundAt: (x: number, z: number, maxY: number) => number;
}

const LAMP_COLOR = new THREE.Color('#ffc477');
const RANGE = 15;
const PEAK = 26;

function glowTexture(): THREE.Texture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const a = Math.pow(1 - r, 2.2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const t = new THREE.DataTexture(data, size, size);
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  return t;
}

export class LampLights {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private pools: THREE.InstancedMesh | null = null;
  private poolMat: THREE.MeshBasicMaterial;
  private tex: THREE.Texture;
  private lamps: THREE.Vector3[];
  private timer = 0;
  private night = 0;
  private assigned: number[] = [];
  /** 玩家附近路灯密度 0..1（平滑） */
  townGlow = 0;
  private readonly radius: number;

  constructor(lamps: readonly THREE.Vector3[], o: LampLightsOptions) {
    this.group.name = 'lamp-lights';
    this.radius = o.radius ?? 55;
    // 去重：同一位置的灯（双头灯柱）合并
    const uniq: THREE.Vector3[] = [];
    for (const p of lamps) if (!uniq.some((q) => q.distanceToSquared(p) < 0.8)) uniq.push(p.clone());
    this.lamps = uniq;
    for (let i = 0; i < o.pool; i++) {
      const l = new THREE.PointLight(LAMP_COLOR, 0, RANGE, 1.6);
      l.castShadow = false;
      l.visible = true;
      this.lights.push(l);
      this.group.add(l);
      this.assigned.push(-1);
    }
    // 地面光斑
    this.tex = glowTexture();
    this.poolMat = new THREE.MeshBasicMaterial({
      map: this.tex,
      color: LAMP_COLOR,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const spots: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    for (const p of this.lamps) {
      const g = o.groundAt(p.x, p.z, p.y - 0.5);
      if (!Number.isFinite(g) || p.y - g > 9) continue;
      const s = 4.2 + (p.y - g) * 0.9;
      spots.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, g + 0.06, p.z), q, new THREE.Vector3(s, s, s)));
    }
    if (spots.length) {
      this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.poolMat, spots.length);
      spots.forEach((m, i) => this.pools!.setMatrixAt(i, m));
      this.pools.instanceMatrix.needsUpdate = true;
      this.pools.computeBoundingSphere();
      this.pools.renderOrder = 2;
      this.pools.frustumCulled = true;
      this.pools.visible = false;
      this.group.add(this.pools);
    }
  }

  get count(): number {
    return this.lamps.length;
  }

  /** night：0 白天 .. 1 深夜（Sky 输出） */
  update(dt: number, player: THREE.Vector3, night: number): void {
    // 傍晚 0.35 开始亮，0.8 全亮
    this.night = THREE.MathUtils.smoothstep(night, 0.35, 0.8);
    const on = this.night > 0.001;
    if (this.pools) {
      this.pools.visible = on;
      this.poolMat.opacity = this.night * 0.55;
    }
    this.timer -= dt;
    if (on && this.timer <= 0) {
      this.timer = 0.2;
      this.reassign(player);
    }
    let near = 0;
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]!;
      const idx = this.assigned[i]!;
      if (!on || idx < 0) {
        l.intensity = 0;
        continue;
      }
      const d = l.position.distanceTo(player);
      const fade = 1 - THREE.MathUtils.smoothstep(d, this.radius * 0.7, this.radius);
      // 平滑趋近目标亮度（换灯时淡入）
      const target = PEAK * this.night * fade;
      l.intensity += (target - l.intensity) * Math.min(1, dt * 6);
      if (d < 26) near++;
    }
    const glow = on ? Math.min(1, near / 4) * this.night : 0;
    this.townGlow += (glow - this.townGlow) * Math.min(1, dt * 1.5);
  }

  private reassign(player: THREE.Vector3): void {
    const r2 = this.radius * this.radius;
    const cand: { i: number; d: number }[] = [];
    for (let i = 0; i < this.lamps.length; i++) {
      const d = this.lamps[i]!.distanceToSquared(player);
      if (d < r2) cand.push({ i, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const want = new Set(cand.slice(0, this.lights.length).map((c) => c.i));
    // 保留仍在名单内的分配，释放其余
    const free: number[] = [];
    for (let k = 0; k < this.lights.length; k++) {
      const a = this.assigned[k]!;
      if (a >= 0 && want.has(a)) want.delete(a);
      else free.push(k);
    }
    for (const lampIdx of want) {
      const k = free.shift();
      if (k === undefined) break;
      this.assigned[k] = lampIdx;
      this.lights[k]!.position.copy(this.lamps[lampIdx]!);
      this.lights[k]!.intensity = 0;
    }
    for (const k of free) this.assigned[k] = -1;
  }

  dispose(): void {
    this.pools?.geometry.dispose();
    this.poolMat.dispose();
    this.tex.dispose();
    for (const l of this.lights) l.dispose();
    this.group.removeFromParent();
  }
}
