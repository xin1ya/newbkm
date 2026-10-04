/**
 * SCN-001 · 就地展开的战斗场（设计 §5.4：不切场景，在遭遇点铺开）：
 * - 以遭遇中点为圆心、玩家→野生方向为轴；贴地的发光边界环（按地形高度逐顶点采样）
 * - 半透明场地圆盘 + 双方站位标记 + 上升光尘
 * - 提供站位坐标与机位计算
 */
import * as THREE from 'three';

export interface ArenaSpots {
  center: THREE.Vector3;
  /** 单位向量：我方 → 对方 */
  axis: THREE.Vector3;
  mine: THREE.Vector3;
  foe: THREE.Vector3;
  trainer: THREE.Vector3;
  /** 对方训练家站位（M1-10） */
  foeTrainer: THREE.Vector3;
}

export const ARENA_RADIUS = 7;
const MON_OFFSET = 3.2;
const TRAINER_OFFSET = 5.6;

/** 战斗固定机位（相对我方站位：沿对战轴后退 back、向右 lat、抬高 up，米） */
const FIXED_CAM = { back: 4.6, lat: 3.2, up: 3.0 };
/** 各镜头视野角（度）：全景 / 指令较宽，特写靠缩小视野 */
const SHOT_FOV = { wide: 52, command: 46, intro: 30, mine: 34, foe: 30, capture: 26 } as const;

export class BattleArena {
  readonly group = new THREE.Group();
  readonly spots: ArenaSpots;
  private ring: THREE.Mesh;
  private disk: THREE.Mesh;
  private motes: THREE.Points;
  private moteSeeds: Float32Array;
  private markers: THREE.Mesh[] = [];
  private t = 0;
  private reveal = 0;

  constructor(
    center: THREE.Vector3,
    towardFoe: THREE.Vector3,
    private readonly heightAt: (x: number, z: number) => number,
    accent: THREE.ColorRepresentation = 0x7fe0c0,
    /** 场地半径：室内舞台可按房间尺寸缩小（翠澜道馆 5.5 m，避免压到水池与池沿） */
    private readonly radius = ARENA_RADIUS,
  ) {
    this.group.name = 'battle-arena';
    const axis = new THREE.Vector3(towardFoe.x, 0, towardFoe.z);
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    axis.normalize();
    const c = center.clone();
    c.y = heightAt(c.x, c.z);
    const at = (d: number) => {
      const p = c.clone().addScaledVector(axis, d);
      p.y = heightAt(p.x, p.z);
      return p;
    };
    this.spots = {
      center: c,
      axis,
      mine: at(-MON_OFFSET),
      foe: at(MON_OFFSET),
      trainer: at(-TRAINER_OFFSET),
      foeTrainer: at(TRAINER_OFFSET),
    };

    this.ring = this.buildRing(accent);
    this.disk = this.buildDisk(accent);
    this.group.add(this.disk, this.ring);
    for (const p of [this.spots.mine, this.spots.foe]) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.05, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, p.y + 0.06, p.z);
      m.renderOrder = 2;
      this.markers.push(m);
      this.group.add(m);
    }
    const n = 90;
    this.moteSeeds = new Float32Array(n * 3);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
      this.moteSeeds.set([Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * this.radius, Math.random()], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: accent,
        size: 0.08,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.group.add(this.motes);
    this.setReveal(0);
  }

  /** 贴地的环带：内外两圈顶点都按地形采样 */
  private buildRing(color: THREE.ColorRepresentation): THREE.Mesh {
    const seg = 96;
    const r0 = this.radius - 0.18;
    const r1 = this.radius + 0.18;
    const pos: number[] = [];
    const idx: number[] = [];
    const { center } = this.spots;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      for (const r of [r0, r1]) {
        const x = center.x + Math.cos(a) * r;
        const z = center.z + Math.sin(a) * r;
        pos.push(x, this.heightAt(x, z) + 0.094, z);
      }
      if (i < seg) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.renderOrder = 3;
    return m;
  }

  /** 场地圆盘：极坐标网格贴地，径向渐变透明度（顶点色 alpha） */
  private buildDisk(color: THREE.ColorRepresentation): THREE.Mesh {
    const rings = 10;
    const seg = 64;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const { center } = this.spots;
    const base = new THREE.Color(color);
    for (let r = 0; r <= rings; r++) {
      const rr = (r / rings) * this.radius;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const x = center.x + Math.cos(a) * rr;
        const z = center.z + Math.sin(a) * rr;
        pos.push(x, this.heightAt(x, z) + 0.062, z);
        const f = 0.08 + 0.18 * (r / rings) ** 3;
        col.push(base.r, base.g, base.b, f);
      }
    }
    for (let r = 0; r < rings; r++)
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s;
        const b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    );
    m.renderOrder = 1;
    return m;
  }

  /** 0 = 隐藏，1 = 完全展开（环从中心扩散） */
  setReveal(k: number): void {
    this.reveal = k;
    const e = 1 - (1 - k) ** 3;
    const { center } = this.spots;
    for (const m of [this.ring, this.disk]) {
      m.scale.set(Math.max(0.001, e), 1, Math.max(0.001, e));
      m.position.set(center.x * (1 - e), 0, center.z * (1 - e));
      m.visible = k > 0;
    }
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * k;
    (this.disk.material as THREE.MeshBasicMaterial).opacity = k;
    for (const mk of this.markers) {
      (mk.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.max(0, k * 2 - 1);
      mk.visible = k > 0.5;
    }
    (this.motes.material as THREE.PointsMaterial).opacity = 0.8 * k;
  }

  update(dt: number): void {
    this.t += dt;
    const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const { center } = this.spots;
    const n = arr.length / 3;
    for (let i = 0; i < n; i++) {
      const a = this.moteSeeds[i * 3]! + this.t * 0.05;
      const r = this.moteSeeds[i * 3 + 1]!;
      const ph = (this.moteSeeds[i * 3 + 2]! + this.t * 0.15) % 1;
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      arr[i * 3] = x;
      arr[i * 3 + 1] = center.y + ph * 3;
      arr[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    const pulse = 0.75 + Math.sin(this.t * 2.4) * 0.15;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = pulse * this.reveal;
    for (const mk of this.markers) mk.rotation.z += dt * 0.4;
  }

  /**
   * 机位（M1 体验修正）：整场战斗相机固定在我方后侧上方的总览位置，不再在各机位之间飞来飞去；
   * 特写只靠「转向目标 + 缩小视野角（FOV）」实现，避免晃动头晕。返回该镜头的视野角。
   */
  shot(
    kind: 'intro' | 'command' | 'mine' | 'foe' | 'wide' | 'capture',
    outPos: THREE.Vector3,
    outLook: THREE.Vector3,
  ): number {
    const { center, axis, mine, foe } = this.spots;
    const side = new THREE.Vector3(axis.z, 0, -axis.x); // 轴的右侧
    // 固定机位：我方身后 BACK、右侧 LAT、高 UP（双方与场地都在画面内）
    outPos.copy(mine).addScaledVector(axis, -FIXED_CAM.back).addScaledVector(side, FIXED_CAM.lat);
    outPos.y = Math.max(mine.y, this.heightAt(outPos.x, outPos.z)) + FIXED_CAM.up;
    const look = (p: THREE.Vector3, up: number) => outLook.copy(p).setY(p.y + up);
    switch (kind) {
      case 'intro':
        look(foe, 0.5);
        return SHOT_FOV.intro;
      case 'command':
        look(center.clone().lerp(foe, 0.2), 0.4);
        return SHOT_FOV.command;
      case 'mine':
        look(mine, 0.45);
        return SHOT_FOV.mine;
      case 'foe':
        look(foe, 0.5);
        return SHOT_FOV.foe;
      case 'capture':
        look(foe, 0.3);
        return SHOT_FOV.capture;
      case 'wide':
      default:
        look(center, 0.35);
        return SHOT_FOV.wide;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }
}
