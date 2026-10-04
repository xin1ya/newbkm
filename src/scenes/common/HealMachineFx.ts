/**
 * 宝可梦恢复机完整演出（宝可梦中心 / 研究所共用）：
 *  1. 护士转身面向恢复机（研究所无护士时由玩家自己放）；
 *  2. 精灵球逐个从玩家手边沿弧线飞入机器球位，落位「嘀」一声、球位亮起光圈；
 *  3. 回复中：机器上方升起粉色光柱与上行光环，球位跑马灯依次闪烁，球自转，点光源随恢复乐脉动；
 *  4. 完成：白色闪光 + 光点迸发；
 *  5. 护士转回玩家，精灵球逐个飞回玩家手边并收起。
 * 房间里有 `furniture:healer` 时由 InteriorScene 创建并注册为 current；没有时调用方退回旧的计时流程。
 */
import * as THREE from 'three';
import { jingle, sfx } from '@/core/audio';
import { createToonMaterial, LAYER } from '@/render';

export interface HealNurse {
  readonly position: THREE.Vector3;
  face(yaw: number | null): void;
  playGesture(kind: 'bow', dur?: number): Promise<void>;
}

interface Tween {
  t: number;
  dur: number;
  step: (k: number) => void;
  done: () => void;
}

const PINK = new THREE.Color(0xff7aa8);
const ease = {
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
};

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,200,225,0.55)');
  gr.addColorStop(1, 'rgba(255,160,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export class HealMachineFx {
  static current: HealMachineFx | null = null;

  private readonly group = new THREE.Group();
  private tweens: Tween[] = [];
  private balls: { mesh: THREE.Group; glow: THREE.Sprite }[] = [];
  private readonly slots: THREE.Vector3[] = [];
  private readonly top = new THREE.Vector3();
  private readonly light: THREE.PointLight;
  private readonly column: THREE.Mesh;
  private readonly columnMat: THREE.ShaderMaterial;
  private rings: { m: THREE.Mesh; t: number }[] = [];
  private processing = false;
  private time = 0;
  private ringTimer = 0;
  private flash = 0;
  private playing = false;
  private readonly ballGeo = new THREE.SphereGeometry(0.075, 16, 12);
  private readonly halfGeo = new THREE.SphereGeometry(0.0758, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  private readonly bandGeo = new THREE.TorusGeometry(0.0755, 0.008, 6, 24);
  private readonly ringGeo = new THREE.RingGeometry(0.62, 0.7, 48);
  private readonly matTop = createToonMaterial({ color: '#e8484a' });
  private readonly matBottom = createToonMaterial({ color: '#ffffff' });
  private readonly matBand = new THREE.MeshBasicMaterial({ color: 0x1d2340 });

  /**
   * @param machine 恢复机家具根节点（球位按 InteriorBuilder 的 healer 布局：2 × 3，y = 1.0）
   * @param hand 玩家手边的世界坐标（球的出发 / 返回点）
   */
  constructor(
    private readonly world: THREE.Object3D,
    machine: THREE.Object3D,
    private readonly hand: () => THREE.Vector3,
  ) {
    this.group.name = 'heal-machine-fx';
    world.add(this.group);
    machine.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(machine);
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(this.top);
    this.top.y = box.max.y;
    // 本地球位（与 InteriorBuilder healer 一致）→ 世界坐标；尺寸用包围盒在机器本地轴上的近似
    const inv = new THREE.Matrix4().copy(machine.matrixWorld);
    const w = Math.max(size.x, size.z);
    const d = Math.min(size.x, size.z);
    for (let i = 0; i < 6; i++) {
      const local = new THREE.Vector3(-w * 0.3 + (i % 3) * w * 0.3, 1.08, (i < 3 ? -1 : 1) * d * 0.2);
      this.slots.push(local.applyMatrix4(inv));
    }
    this.light = new THREE.PointLight(PINK, 0, 5, 2);
    this.light.position.copy(this.top).add(new THREE.Vector3(0, 0.5, 0));
    this.group.add(this.light);
    // 光柱：底部亮、向上渐隐，带上行扫描纹
    this.columnMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: PINK.clone() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;' +
        'void main(){ float a = pow(1.0 - vUv.y, 1.6); float band = 0.65 + 0.35 * sin(vUv.y * 26.0 - uTime * 7.0);' +
        ' gl_FragColor = vec4(uColor * 1.2, clamp(a * band * uOpacity, 0.0, 1.0)); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const colGeo = new THREE.CylinderGeometry(w * 0.42, w * 0.5, 1.4, 32, 1, true);
    colGeo.translate(0, 0.7, 0);
    this.column = new THREE.Mesh(colGeo, this.columnMat);
    this.column.position.copy(this.top);
    this.column.renderOrder = 8;
    this.column.visible = false;
    this.group.add(this.column);
    this.group.traverse((o) => o.layers.set(LAYER.CHARACTERS));
  }

  get busy(): boolean {
    return this.playing;
  }

  /** 当前在机器上 / 飞行中的球数（调试 / e2e） */
  get ballCount(): number {
    return this.balls.length;
  }

  activate(): this {
    HealMachineFx.current = this;
    return this;
  }

  private tween(seconds: number, step: (k: number) => void): Promise<void> {
    return new Promise((r) => {
      step(0);
      this.tweens.push({ t: 0, dur: Math.max(0.001, seconds), step, done: r });
    });
  }

  private wait(seconds: number): Promise<void> {
    return this.tween(seconds, () => {});
  }

  private makeBall(): { mesh: THREE.Group; glow: THREE.Sprite } {
    const g = new THREE.Group();
    const top = new THREE.Mesh(this.ballGeo, this.matTop);
    const bottom = new THREE.Mesh(this.halfGeo, this.matBottom);
    const band = new THREE.Mesh(this.bandGeo, this.matBand);
    band.rotation.x = Math.PI / 2;
    g.add(top, bottom, band);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: PINK, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.scale.setScalar(0.42);
    glow.renderOrder = 9;
    g.add(glow);
    g.traverse((o) => o.layers.set(LAYER.CHARACTERS));
    this.group.add(g);
    return { mesh: g, glow };
  }

  /** 弧线飞行（起点 → 终点，最高点高出 h） */
  private fly(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, seconds: number, h: number, shrink = false): Promise<void> {
    return this.tween(seconds, (k) => {
      const e = ease.inOut(k);
      obj.position.lerpVectors(from, to, e);
      obj.position.y += Math.sin(Math.PI * e) * h;
      obj.rotation.x = e * Math.PI * 3;
      if (shrink) obj.scale.setScalar(Math.max(0.001, 1 - Math.max(0, (k - 0.7) / 0.3)));
    });
  }

  private ringFlash(at: THREE.Vector3, scale: number, seconds: number): void {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: PINK, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at);
    m.layers.set(LAYER.CHARACTERS);
    this.group.add(m);
    void this.tween(seconds, (k) => {
      m.scale.setScalar(scale * (0.2 + ease.outCubic(k)));
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }).then(() => {
      m.removeFromParent();
      (m.material as THREE.Material).dispose();
    });
  }

  private burst(at: THREE.Vector3): void {
    const n = 60;
    const pos = new Float32Array(n * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      vel.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(0.6 + Math.random() * 0.9));
      pos.set([at.x, at.y, at.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffe0ee, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.layers.set(LAYER.CHARACTERS);
    this.group.add(pts);
    void this.tween(0.9, (k) => {
      const e = ease.outCubic(k);
      for (let i = 0; i < n; i++) {
        const v = vel[i]!;
        pos[i * 3] = at.x + v.x * e;
        pos[i * 3 + 1] = at.y + v.y * e - 0.5 * k * k;
        pos[i * 3 + 2] = at.z + v.z * e;
      }
      g.attributes.position!.needsUpdate = true;
      mat.opacity = 1 - k;
    }).then(() => {
      pts.removeFromParent();
      g.dispose();
      mat.dispose();
    });
  }

  /**
   * 播放完整演出。onComplete 在「完成闪光」时调用（调用方在此真正回复队伍），之后球飞回玩家。
   */
  async play(count: number, o: { nurse?: HealNurse | undefined; onComplete?: (() => void) | undefined } = {}): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    const n = Math.min(6, Math.max(1, count));
    try {
      // 1. 护士转向恢复机
      if (o.nurse) {
        const p = o.nurse.position;
        o.nurse.face(Math.atan2(this.top.x - p.x, this.top.z - p.z));
        await this.wait(0.4);
      }
      // 2. 球逐个飞入（相邻两颗重叠飞行）
      const flights: Promise<void>[] = [];
      for (let i = 0; i < n; i++) {
        const b = this.makeBall();
        this.balls.push(b);
        const from = this.hand();
        const to = this.slots[i]!;
        b.mesh.position.copy(from);
        flights.push(
          this.fly(b.mesh, from, to, 0.42, 0.55).then(() => {
            b.mesh.rotation.set(0, 0, 0);
            sfx('heal-machine');
            this.ringFlash(to.clone().setY(to.y - 0.05), 0.25, 0.35);
            this.flash = Math.max(this.flash, 0.35);
          }),
        );
        await this.wait(0.3);
      }
      await Promise.all(flights);
      await this.wait(0.25);
      // 3. 回复中：光柱 + 上行光环 + 跑马灯（至少 2.4 s，与恢复乐同步结束）
      this.processing = true;
      this.column.visible = true;
      await Promise.all([jingle('jingle-heal'), this.wait(2.4)]);
      this.processing = false;
      // 4. 完成闪光
      sfx('heal');
      this.flash = 1.6;
      this.burst(this.top.clone().setY(this.top.y + 0.15));
      this.ringFlash(this.top.clone().setY(this.top.y + 0.02), 1.6, 0.6);
      o.onComplete?.();
      await this.wait(0.5);
      // 5. 护士转回玩家，球飞回
      o.nurse?.face(null);
      await this.wait(0.2);
      const back: Promise<void>[] = [];
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const b = this.balls[i]!;
        b.glow.material.opacity = 0;
        back.push(this.fly(b.mesh, b.mesh.position.clone(), this.hand(), 0.34, 0.4, true));
        await this.wait(0.12);
      }
      await Promise.all(back);
    } finally {
      this.clearBalls();
      this.column.visible = false;
      this.processing = false;
      this.playing = false;
    }
  }

  update(dt: number): void {
    this.time += dt;
    // 推进补间（拷贝一份：回调里可能追加新补间）
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done();
      }
    }
    const t = this.time;
    // 光柱淡入淡出
    const colTarget = this.processing ? 0.85 : 0;
    const cu = this.columnMat.uniforms;
    cu.uTime!.value = t;
    cu.uOpacity!.value = THREE.MathUtils.damp(cu.uOpacity!.value as number, colTarget, 6, dt);
    if (!this.processing && (cu.uOpacity!.value as number) < 0.01) this.column.visible = false;
    // 上行光环
    if (this.processing) {
      this.ringTimer -= dt;
      if (this.ringTimer <= 0) {
        this.ringTimer = 0.32;
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: PINK, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(this.top);
        m.layers.set(LAYER.CHARACTERS);
        this.group.add(m);
        this.rings.push({ m, t: 0 });
      }
    }
    for (const r of [...this.rings]) {
      r.t += dt;
      const k = r.t / 1.2;
      r.m.position.y = this.top.y + k * 1.3;
      r.m.scale.setScalar(0.9 - k * 0.35);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) {
        r.m.removeFromParent();
        (r.m.material as THREE.Material).dispose();
        this.rings.splice(this.rings.indexOf(r), 1);
      }
    }
    // 跑马灯：球位依次闪亮，球自转
    this.balls.forEach((b, i) => {
      if (this.processing) {
        const phase = (t * 3.2 - i * 0.55) % (this.balls.length * 0.55 + 0.6);
        const on = Math.max(0, 1 - Math.abs(phase - 0.3) / 0.3);
        b.glow.material.opacity = 0.25 + on * 0.75;
        b.mesh.rotation.y += dt * 5;
      } else if (b.glow.material.opacity > 0) {
        b.glow.material.opacity = Math.max(0, b.glow.material.opacity - dt * 2);
      }
    });
    // 点光源：回复中随节拍脉动；落位 / 完成时闪一下
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const pulse = this.processing ? 1.2 + 0.9 * Math.abs(Math.sin(t * 6)) : 0;
    this.light.intensity = pulse * 1.6 + this.flash * 4;
  }

  private clearBalls(): void {
    for (const b of this.balls) {
      b.mesh.removeFromParent();
      b.glow.material.dispose();
    }
    this.balls = [];
  }

  dispose(): void {
    if (HealMachineFx.current === this) HealMachineFx.current = null;
    for (const tw of this.tweens) tw.done();
    this.tweens = [];
    this.clearBalls();
    for (const r of this.rings) (r.m.material as THREE.Material).dispose();
    this.rings = [];
    this.group.removeFromParent();
    this.column.geometry.dispose();
    this.columnMat.dispose();
    for (const g of [this.ballGeo, this.halfGeo, this.bandGeo, this.ringGeo]) g.dispose();
    for (const m of [this.matTop, this.matBottom, this.matBand]) m.dispose();
    void this.world;
  }
}
