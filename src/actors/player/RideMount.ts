/**
 * M1-12 · 水上骑乘坐骑（挂在玩家根节点下）：
 * - 程序化 Toon 坐骑：流线型身体 + 头部 + 眼睛 + 背鳍 + 胸鳍 + 尾鳍 + 鞍垫，按宝可梦主属性 / 副属性配色
 *   （M1-21 手工模型接入后，由 createRideModel 返回真实模型替换）
 * - 游动动画：身体起伏、尾鳍摆动、转向时侧倾
 * - 尾迹：移动时向后生成扩散的波纹圈（世界坐标，挂在 wakeParent 下）与两侧水花
 */
import * as THREE from 'three';
import { TYPE_COLORS } from '@/core/assets';
import { addHullOutlines, createToonMaterial, LAYER } from '@/render';

export interface MountLook {
  speciesId: number;
  types: string[];
  nickname: string;
  shiny: boolean;
}

/** 鞍座高度：玩家模型抬高多少 */
export const SADDLE_HEIGHT = 0.42;

export class RideMount {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private tail: THREE.Object3D;
  private finL: THREE.Object3D;
  private finR: THREE.Object3D;
  private t = 0;
  private wakeTimer = 0;
  private rings: { mesh: THREE.Mesh; age: number; life: number }[] = [];
  private spray: { mesh: THREE.Mesh; v: THREE.Vector3; age: number }[] = [];
  private ringGeo = new THREE.RingGeometry(0.55, 0.7, 28);
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  private sprayGeo = new THREE.SphereGeometry(0.07, 6, 5);
  private sprayMat = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.9 });
  private lastYaw = 0;
  private lean = 0;

  constructor(
    readonly look: MountLook,
    private readonly wakeParent: THREE.Object3D,
  ) {
    this.root.name = `ride-mount:${look.speciesId}`;
    const main = new THREE.Color(TYPE_COLORS[look.types[0] ?? 'water'] ?? '#4a90d9');
    if (look.shiny) main.offsetHSL(0.45, 0.1, 0.05);
    const second = new THREE.Color(TYPE_COLORS[look.types[1] ?? ''] ?? main.clone().offsetHSL(0, -0.1, 0.25));
    const belly = main.clone().lerp(new THREE.Color('#fff6e0'), 0.65);
    const mat = (c: THREE.Color) => createToonMaterial({ color: c, kind: 'character' });

    // 身体：拉长的椭球（前后 1.7 m）
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), mat(main));
    torso.scale.set(0.9, 0.55, 1.7);
    torso.position.y = 0.05;
    const underside = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat(belly));
    underside.scale.set(0.88, 0.5, 1.66);
    underside.position.y = 0.04;
    // 头部
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), mat(main));
    head.position.set(0, 0.28, 0.82);
    head.scale.set(1, 0.9, 1.1);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), mat(belly));
    snout.position.set(0, 0.2, 1.08);
    snout.scale.set(1, 0.7, 0.9);
    const eyeMat = createToonMaterial({ color: '#1d2340', kind: 'character', specular: true });
    const eyeWhite = createToonMaterial({ color: '#ffffff', kind: 'character' });
    const eyes = [-1, 1].map((s) => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), eyeWhite);
      w.position.set(0.19 * s, 0.38, 0.99);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
      pupil.position.set(0.02 * s, 0.01, 0.055);
      w.add(pupil);
      return w;
    });
    // 背鳍（副色）
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 4), mat(second));
    dorsal.position.set(0, 0.42, -0.35);
    dorsal.rotation.x = -0.5;
    dorsal.scale.z = 0.3;
    // 胸鳍
    const finGeo = new THREE.SphereGeometry(0.22, 12, 8);
    this.finL = new THREE.Mesh(finGeo, mat(second));
    this.finL.scale.set(1.2, 0.18, 0.7);
    this.finL.position.set(0.5, -0.02, 0.35);
    this.finR = this.finL.clone();
    this.finR.position.x = -0.5;
    // 尾鳍
    const tail = new THREE.Group();
    tail.position.set(0, 0.05, -0.85);
    const tailFin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8), mat(second));
    tailFin.scale.set(1.4, 0.16, 0.8);
    tailFin.position.z = -0.28;
    tail.add(tailFin);
    this.tail = tail;
    // 鞍垫
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.08, 20), mat(new THREE.Color('#c0503a')));
    saddle.position.set(0, 0.33, 0.05);
    saddle.scale.z = 1.25;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.03, 6, 24, Math.PI), mat(new THREE.Color('#7a3b22')));
    strap.rotation.set(0, Math.PI / 2, 0);
    strap.position.set(0, 0.05, 0.05);
    strap.scale.set(1, 0.72, 1);

    this.body.add(torso, underside, head, snout, ...eyes, dorsal, this.finL, this.finR, tail, saddle, strap);
    this.body.position.y = 0;
    this.root.add(this.body);
    this.root.traverse((o) => {
      o.layers.set(LAYER.CHARACTERS);
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    addHullOutlines(this.root, { force: true });
  }

  /** 每帧：speed = 水平速度，yaw = 当前朝向，world = 玩家世界位置（尾迹用），waterY = 水面高度 */
  update(dt: number, speed: number, yaw: number, world: THREE.Vector3, waterY: number): void {
    this.t += dt;
    const k = Math.min(1, speed / 6);
    // 游动：身体起伏、尾鳍与胸鳍摆动
    this.body.position.y = Math.sin(this.t * 2.1) * 0.03;
    this.body.rotation.x = Math.sin(this.t * 2.1 + 0.8) * 0.04 - k * 0.06;
    this.tail.rotation.y = Math.sin(this.t * (3 + k * 6)) * (0.25 + k * 0.25);
    this.finL.rotation.z = Math.sin(this.t * (2.5 + k * 5)) * 0.25;
    this.finR.rotation.z = -this.finL.rotation.z;
    // 转向侧倾
    let dy = yaw - this.lastYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.lastYaw = yaw;
    const want = THREE.MathUtils.clamp((-dy / Math.max(dt, 1e-3)) * 0.08, -0.35, 0.35);
    this.lean += (want - this.lean) * Math.min(1, dt * 6);
    this.body.rotation.z = this.lean;
    // 尾迹
    this.wakeTimer -= dt;
    if (speed > 1 && this.wakeTimer <= 0) {
      this.wakeTimer = 0.22 - k * 0.1;
      const back = new THREE.Vector3(-Math.sin(yaw) * 0.9, 0, -Math.cos(yaw) * 0.9);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(world.x + back.x, waterY + 0.03, world.z + back.z);
      ring.layers.set(LAYER.FX);
      this.wakeParent.add(ring);
      this.rings.push({ mesh: ring, age: 0, life: 1.4 });
      // 两侧水花
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(this.sprayGeo, this.sprayMat);
        const sx = Math.cos(yaw) * 0.5 * side;
        const sz = -Math.sin(yaw) * 0.5 * side;
        m.position.set(world.x + sx + back.x * -0.6, waterY + 0.05, world.z + sz + back.z * -0.6);
        m.layers.set(LAYER.FX);
        this.wakeParent.add(m);
        this.spray.push({ mesh: m, v: new THREE.Vector3(sx * 2.2, 1.6 + Math.random() * 0.8 * k, sz * 2.2), age: 0 });
      }
    }
    for (const r of this.rings) {
      r.age += dt;
      const a = r.age / r.life;
      r.mesh.scale.setScalar(1 + a * 2.2);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - a);
    }
    for (const s of this.spray) {
      s.age += dt;
      s.v.y -= 9 * dt;
      s.mesh.position.addScaledVector(s.v, dt);
    }
    this.rings = this.rings.filter((r) => {
      if (r.age < r.life) return true;
      r.mesh.removeFromParent();
      (r.mesh.material as THREE.Material).dispose();
      return false;
    });
    this.spray = this.spray.filter((s) => {
      if (s.age < 0.6 && s.mesh.position.y > waterY - 0.1) return true;
      s.mesh.removeFromParent();
      return false;
    });
  }

  dispose(): void {
    for (const r of this.rings) {
      r.mesh.removeFromParent();
      (r.mesh.material as THREE.Material).dispose();
    }
    for (const s of this.spray) s.mesh.removeFromParent();
    this.rings = [];
    this.spray = [];
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.ringGeo.dispose();
    this.sprayGeo.dispose();
  }
}
