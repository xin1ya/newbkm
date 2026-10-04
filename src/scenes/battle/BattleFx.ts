/**
 * SCN-001 · 通用战斗特效（全部程序化，属性色驱动）：
 * - tween：通用补间（Promise）
 * - projectile：特殊招式弹道（发光球 + 拖尾粒子）
 * - burst：命中爆散；beam：光束；stat：能力升降箭头；heal：回复光点
 * - ball：精灵球抛物线 / 摇晃 / 成功星星
 * 每个特效自己创建与释放几何体，不依赖外部资源。
 */
import * as THREE from 'three';

interface Tween {
  t: number;
  dur: number;
  step: (k: number, dt: number) => void;
  done: () => void;
}

const ease = {
  linear: (k: number) => k,
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  outBack: (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
};
export { ease };

export class BattleFx {
  readonly group = new THREE.Group();
  private tweens: Tween[] = [];
  /** 全局播放速度（设置里的战斗动画速度 / 快进） */
  speed = 1;

  constructor() {
    this.group.name = 'battle-fx';
  }

  tween(seconds: number, step: (k: number, dt: number) => void): Promise<void> {
    return new Promise((resolve) => {
      if (seconds <= 0) {
        step(1, 0);
        resolve();
        return;
      }
      this.tweens.push({ t: 0, dur: seconds, step, done: resolve });
    });
  }

  wait(seconds: number): Promise<void> {
    return this.tween(seconds, () => {});
  }

  get busy(): boolean {
    return this.tweens.length > 0;
  }

  update(dt: number): void {
    const d = dt * this.speed;
    const list = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    for (const tw of list) {
      tw.t += d;
      const k = Math.min(1, tw.t / tw.dur);
      tw.step(k, d);
      if (k >= 1) tw.done();
      else keep.push(tw);
    }
    this.tweens.push(...keep);
  }

  private glowMat(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  private disposeObj(o: THREE.Object3D): void {
    o.removeFromParent();
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  /** 粒子爆散：count 个点从中心向外飞散并淡出 */
  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, o: { count?: number; radius?: number; seconds?: number; size?: number; up?: number } = {}): Promise<void> {
    const n = o.count ?? 40;
    const r = o.radius ?? 1.4;
    const pos = new Float32Array(n * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.2 + (o.up ?? 0), Math.random() - 0.5).normalize().multiplyScalar(r * (0.5 + Math.random() * 0.8));
      vel.push(v);
      pos.set([at.x, at.y, at.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: o.size ?? 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    this.group.add(pts);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.25, 32), this.glowMat(color, 0.9));
    ring.position.copy(at);
    ring.lookAt(at.x, at.y + 1, at.z);
    this.group.add(ring);
    return this.tween(o.seconds ?? 0.55, (k) => {
      const e = ease.outCubic(k);
      for (let i = 0; i < n; i++) {
        const v = vel[i]!;
        pos[i * 3] = at.x + v.x * e;
        pos[i * 3 + 1] = at.y + v.y * e - 0.6 * k * k;
        pos[i * 3 + 2] = at.z + v.z * e;
      }
      g.attributes.position!.needsUpdate = true;
      mat.opacity = 1 - k;
      ring.scale.setScalar(1 + e * r * 5);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }).then(() => {
      this.disposeObj(pts);
      this.disposeObj(ring);
    });
  }

  /**
   * 异色登场：三波四角星在宝可梦周围依次闪现（放大 → 旋转 → 消散），伴随一圈金色光点。
   * 星星贴图为程序生成的画布纹理（模块级缓存）。
   */
  shinySparkle(at: THREE.Vector3, height: number): Promise<void> {
    const tex = starTexture();
    const waves = 3;
    const per = 5;
    const stars: { s: THREE.Sprite; t0: number; base: number; spin: number }[] = [];
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < per; i++) {
        const a = (i / per) * Math.PI * 2 + w * 0.7 + Math.random() * 0.4;
        const r = height * (0.45 + Math.random() * 0.35);
        const mat = new THREE.SpriteMaterial({ map: tex, color: w === 1 ? 0xfff0a0 : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
        const s = new THREE.Sprite(mat);
        s.position.set(at.x + Math.cos(a) * r, at.y + height * (0.25 + Math.random() * 0.7), at.z + Math.sin(a) * r);
        s.scale.setScalar(0.001);
        s.renderOrder = 9;
        this.group.add(s);
        stars.push({ s, t0: w * 0.32 + i * 0.05, base: height * (0.22 + Math.random() * 0.14), spin: (Math.random() - 0.5) * 6 });
      }
    }
    void this.burst(at.clone().setY(at.y + height * 0.5), 0xfff3a0, { count: 46, radius: height * 1.1, seconds: 1.0, size: 0.16, up: 0.4 });
    const total = 1.5;
    return this.tween(total, (k) => {
      const t = k * total;
      for (const st of stars) {
        const u = THREE.MathUtils.clamp((t - st.t0) / 0.55, 0, 1);
        const pop = u < 0.35 ? ease.outCubic(u / 0.35) : 1 - ease.outCubic((u - 0.35) / 0.65) * 0.85;
        st.s.scale.setScalar(Math.max(0.001, st.base * pop));
        (st.s.material as THREE.SpriteMaterial).opacity = u <= 0 || u >= 1 ? 0 : Math.min(1, pop * 1.4);
        (st.s.material as THREE.SpriteMaterial).rotation = st.spin * u;
      }
    }).then(() => {
      for (const st of stars) {
        st.s.removeFromParent();
        st.s.material.dispose();
      }
    });
  }

  /** 弹道：发光球沿弧线飞向目标，带拖尾 */
  projectile(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, o: { seconds?: number; arc?: number; size?: number } = {}): Promise<void> {
    const size = o.size ?? 0.28;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), this.glowMat(color));
    const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ball.add(core);
    this.group.add(ball);
    const trailN = 18;
    const tpos = new Float32Array(trailN * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
    const tmat = new THREE.PointsMaterial({ color, size: size * 0.9, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const trail = new THREE.Points(tg, tmat);
    this.group.add(trail);
    for (let i = 0; i < trailN; i++) tpos.set([from.x, from.y, from.z], i * 3);
    const arc = o.arc ?? 0.8;
    const p = new THREE.Vector3();
    return this.tween(o.seconds ?? 0.45, (k) => {
      p.lerpVectors(from, to, k);
      p.y += Math.sin(k * Math.PI) * arc;
      ball.position.copy(p);
      tpos.copyWithin(3, 0, (trailN - 1) * 3);
      tpos.set([p.x + (Math.random() - 0.5) * 0.1, p.y + (Math.random() - 0.5) * 0.1, p.z + (Math.random() - 0.5) * 0.1], 0);
      tg.attributes.position!.needsUpdate = true;
    }).then(() => {
      this.disposeObj(ball);
      this.disposeObj(trail);
    });
  }

  /** 光束：从 from 到 to 的圆柱，先伸长再淡出 */
  beam(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, seconds = 0.5): Promise<void> {
    const len = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.12, 0.2, 1, 12, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, this.glowMat(color, 0.85));
    m.position.copy(from);
    m.lookAt(to);
    this.group.add(m);
    return this.tween(seconds, (k) => {
      const grow = Math.min(1, k * 3);
      m.scale.set(1 + Math.sin(k * 40) * 0.15, 1 + Math.sin(k * 40) * 0.15, len * grow);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (k > 0.7 ? (1 - k) / 0.3 : 1);
    }).then(() => this.disposeObj(m));
  }

  /** 能力升降：一圈箭头粒子上升（蓝紫）或下降（红） */
  stat(at: THREE.Vector3, height: number, up: boolean): Promise<void> {
    const n = 26;
    const pos = new Float32Array(n * 3);
    const seeds = Array.from({ length: n }, () => [Math.random() * Math.PI * 2, 0.4 + Math.random() * 0.5, Math.random()] as const);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: up ? 0x7fb2ff : 0xff6a6a, size: 0.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    this.group.add(pts);
    return this.tween(0.8, (k) => {
      for (let i = 0; i < n; i++) {
        const [a, r, ph] = seeds[i]!;
        const f = (k + ph) % 1;
        const y = up ? f * height * 1.3 : (1 - f) * height * 1.3;
        pos.set([at.x + Math.cos(a) * r, at.y + y, at.z + Math.sin(a) * r], i * 3);
      }
      g.attributes.position!.needsUpdate = true;
      mat.opacity = Math.sin(k * Math.PI);
    }).then(() => this.disposeObj(pts));
  }

  /** 回复：绿色光点螺旋上升 */
  heal(at: THREE.Vector3, height: number): Promise<void> {
    const n = 30;
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x8dffb0, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    this.group.add(pts);
    return this.tween(0.9, (k) => {
      for (let i = 0; i < n; i++) {
        const a = i * 2.4 + k * 6;
        const y = ((i / n + k) % 1) * height * 1.2;
        pos.set([at.x + Math.cos(a) * 0.6, at.y + y, at.z + Math.sin(a) * 0.6], i * 3);
      }
      g.attributes.position!.needsUpdate = true;
      mat.opacity = Math.sin(k * Math.PI);
    }).then(() => this.disposeObj(pts));
  }

  /** 精灵球模型（红白两半 + 按钮 + 黑色腰线） */
  makeBall(top: THREE.ColorRepresentation = 0xe8484a): THREE.Group {
    const g = new THREE.Group();
    const r = 0.16;
    const upper = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: top }));
    const lower = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xf4f4f4 }));
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 6, 24), new THREE.MeshBasicMaterial({ color: 0x1d2340 }));
    band.rotation.x = Math.PI / 2;
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), new THREE.MeshToonMaterial({ color: 0xffffff }));
    btn.rotation.x = Math.PI / 2;
    btn.position.z = r;
    g.add(upper, lower, band, btn);
    return g;
  }

  /** 抛出精灵球：返回球对象（调用方负责后续摇晃并 disposeBall） */
  async throwBall(from: THREE.Vector3, to: THREE.Vector3, ballColor?: THREE.ColorRepresentation): Promise<THREE.Group> {
    const ball = this.makeBall(ballColor);
    this.group.add(ball);
    const p = new THREE.Vector3();
    await this.tween(0.7, (k) => {
      p.lerpVectors(from, to, k);
      p.y += Math.sin(k * Math.PI) * 2.2;
      ball.position.copy(p);
      ball.rotation.x = -k * Math.PI * 5;
    });
    ball.rotation.set(0, 0, 0);
    return ball;
  }

  async ballDrop(ball: THREE.Group, groundY: number): Promise<void> {
    const y0 = ball.position.y;
    await this.tween(0.45, (k) => {
      const bounce = Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k);
      ball.position.y = groundY + 0.16 + (y0 - groundY - 0.16) * (1 - ease.outCubic(k)) * 0.3 + bounce * 0.4;
    });
    ball.position.y = groundY + 0.16;
  }

  ballShake(ball: THREE.Group): Promise<void> {
    return this.tween(0.55, (k) => {
      ball.rotation.z = Math.sin(k * Math.PI * 2) * 0.45 * (1 - k * 0.3);
    }).then(() => this.wait(0.35));
  }

  disposeBall(ball: THREE.Group): void {
    this.disposeObj(ball);
  }

  clear(): void {
    for (const tw of this.tweens) tw.done();
    this.tweens = [];
    for (const c of [...this.group.children]) this.disposeObj(c);
  }
}

let starTex: THREE.CanvasTexture | null = null;
/** 四角星（异色闪光）贴图：中心白、四个尖角 + 柔和光晕 */
function starTexture(): THREE.CanvasTexture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.25, 'rgba(255,240,170,0.35)');
  glow.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? 62 : 9;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}
