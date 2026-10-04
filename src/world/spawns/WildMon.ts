/**
 * ACT-002 · 野生宝可梦实体：个体数据 + 行为大脑 + 视觉（灰模占位 / 模型）。
 */
import * as THREE from 'three';
import type { PokemonInstance } from '@/systems/pokemon';
import type { SpeciesData } from '@/systems/data/types';
import { createPlaceholder, makeLabelSprite, TYPE_COLORS } from '@/core/assets';
import { addHullOutlines, toonify } from '@/render';
import { alphaScale } from '@/systems/alpha';
import type { WildBrain } from './wildAI';

let nextId = 1;

/** 野外遭遇的模型循环状态（与 actors/pokemon/MonAnimator 的 MonLoop 一致） */
export type WildLoop = 'idle' | 'walk' | 'run' | 'sleep' | 'fly' | 'swim';

/**
 * 模型工厂注入点：world/ 不能依赖 actors/，由 main.ts 注册手工模型实现（actors/pokemon/monModel）。
 * 未注册时用按属性着色的灰模（单元测试 / 工具页）。
 */
export interface WildBodyFactory {
  create(
    species: SpeciesData,
    mon: PokemonInstance,
    o: { label: string; labelColor: string | undefined; height: number },
  ): THREE.Group;
  /** 已换上带骨骼动画的手工模型 */
  animated(body: THREE.Object3D): boolean;
  setLoop(body: THREE.Object3D, loop: WildLoop, timeScale: number): void;
  update(body: THREE.Object3D, dt: number): void;
  dispose(body: THREE.Object3D): void;
}

let bodyFactory: WildBodyFactory | null = null;

export function setWildBodyFactory(f: WildBodyFactory | null): void {
  bodyFactory = f;
}

export type Habitat = 'ground' | 'air' | 'water' | 'shore';

export class WildMon {
  readonly id = nextId++;
  readonly root = new THREE.Group();
  readonly body: THREE.Group;
  private emoteSprite: THREE.Sprite | null = null;
  private emoteKind: string | null = null;
  private sparkles: THREE.Points | null = null;
  private walkPhase = Math.random() * 10;
  /** 被战斗占用（暂停 AI） */
  frozen = false;
  /** 巢穴头目所属巢穴（普通个体为 null） */
  denId: string | null = null;
  /** 刷新时刻（SpawnManager 内部时间，游荡头目超时离开用） */
  bornAt = 0;
  /** 头目脚下光圈与余烬粒子 */
  private auraRing: THREE.Mesh | null = null;
  private embers: THREE.Points | null = null;
  readonly height: number;
  readonly radius: number;

  constructor(
    readonly mon: PokemonInstance,
    readonly species: SpeciesData,
    readonly brain: WildBrain,
    readonly habitat: Habitat,
    readonly zoneId: string,
    readonly method: 'visible' | 'surf',
  ) {
    const alpha = !!mon.alpha;
    const shiny = !!mon.shiny;
    const label = `${species.name.zh} Lv.${mon.level}${alpha ? (mon.alphaKind === 'den' ? ' ★巢穴头目' : ' ★头目') : ''}${shiny ? ' ✦' : ''}`;
    const labelColor = alpha ? 'rgba(150,30,40,0.85)' : shiny ? 'rgba(160,120,20,0.85)' : undefined;
    const height = species.heightM * alphaScale(mon) + 0.25;
    if (bodyFactory) {
      this.body = bodyFactory.create(species, mon, { label, labelColor, height });
    } else {
      const baseColor = TYPE_COLORS[species.types[0] ?? 'normal'] ?? '#aaaaaa';
      const color = shiny ? new THREE.Color(baseColor).offsetHSL(0.45, 0.1, 0.05) : new THREE.Color(baseColor);
      this.body = createPlaceholder({ label, height, color, labelColor });
      toonify(this.body, 'character');
      addHullOutlines(this.body);
    }
    this.height = this.body.userData.height as number;
    this.radius = this.body.userData.radius as number;
    this.root.add(this.body);
    this.root.name = `wild-${species.key}-${this.id}`;
    this.root.userData.wildId = this.id;
    if (shiny) this.addSparkles();
    if (alpha) this.addAlphaFx();
  }

  private addSparkles(): void {
    const n = 24;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
      pos.set([(Math.random() - 0.5) * 1.4, Math.random() * this.height * 1.3, (Math.random() - 0.5) * 1.4], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xfff3a0, size: 0.09, transparent: true, depthWrite: false }),
    );
    this.root.add(this.sparkles);
  }

  /** 头目（计划文档 §3.4）：脚下暗红光圈 + 缓缓上升的余烬（加色混合，夜里更显眼） */
  private addAlphaFx(): void {
    const r = Math.max(0.9, this.radius * 2.4);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.55, r, 48, 1),
      new THREE.MeshBasicMaterial({ color: 0xb01820, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.renderOrder = 2;
    ring.name = 'alpha-ring';
    ring.userData.noShadow = true;
    this.auraRing = ring;
    this.root.add(ring);
    const n = 36;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r;
      pos.set([Math.sin(a) * d, Math.random() * this.height * 1.2, Math.cos(a) * d], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xff4a30, size: 0.13, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.embers.name = 'alpha-embers';
    this.root.add(this.embers);
  }

  private animateAlphaFx(dt: number, time: number): void {
    if (this.auraRing) {
      const k = 1 + Math.sin(time * 2.4 + this.id) * 0.06;
      this.auraRing.scale.set(k, k, 1);
      (this.auraRing.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 2.4 + this.id) * 0.12;
    }
    if (this.embers) {
      const a = this.embers.geometry.getAttribute('position') as THREE.BufferAttribute;
      const top = this.height * 1.25;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * (0.45 + (i % 5) * 0.12);
        if (y > top) y -= top;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
  }

  /** 远近细节（M1-22 性能）：远处关闭描边外壳与投影，三角面约降到 1/3；只在状态切换时遍历 */
  private detailNear = true;
  get near(): boolean {
    return this.detailNear;
  }
  private detailLoaded = false;
  setDetail(near: boolean): void {
    // 真实模型是异步换入的（monModel.swapIn）：换入后需要对新网格再应用一次
    const loaded = !!this.body.userData.modelLoaded;
    if (near === this.detailNear && loaded === this.detailLoaded) return;
    this.detailNear = near;
    this.detailLoaded = loaded;
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.userData.outlineHull) m.visible = near;
      else if (!m.userData.noShadow && !m.userData.auraHull) m.castShadow = near;
    });
  }

  setEmote(kind: '!' | '?' | 'z' | '♥' | null): void {
    if (kind === this.emoteKind) return;
    this.emoteKind = kind;
    if (this.emoteSprite) {
      this.root.remove(this.emoteSprite);
      this.emoteSprite = null;
    }
    if (!kind) return;
    const s = makeLabelSprite(
      kind === 'z' ? 'Zz' : kind,
      kind === '!' ? 'rgba(220,60,50,0.92)' : kind === '♥' ? 'rgba(236,96,150,0.92)' : kind === '?' ? 'rgba(60,120,220,0.92)' : 'rgba(80,80,120,0.8)',
    );
    s.position.y = this.height + 0.8;
    s.scale.multiplyScalar(1.2);
    this.emoteSprite = s;
    this.root.add(s);
  }

  /**
   * 性能 P1 · 动画 LOD：0 = 每帧更新骨骼；1 = 30 m 外按 15 fps 更新；2 = 60 m 外停止骨骼更新（只做位移 / 朝向）。
   * 由 SpawnManager 按与玩家的距离设置（带滞回）。
   */
  animLod: 0 | 1 | 2 = 0;
  private animAcc = 0;

  /** 视觉动画：走路小跳、睡觉压扁、游泳浮动、飞行上下 */
  animate(dt: number, speed: number, time: number): void {
    this.walkPhase += dt * (4 + speed * 3);
    const b = this.body;
    if (bodyFactory?.animated(b)) {
      // 手工模型：骨骼动画负责四肢，这里只留空中 / 水面的整体浮动
      const asleep = this.brain.state === 'sleep';
      let loop: WildLoop = 'idle';
      let ts = 1;
      if (asleep) loop = 'sleep';
      else if (this.habitat === 'air') loop = 'fly';
      else if (this.habitat === 'water' && this.method === 'surf') loop = 'swim';
      else if (speed > 2.6) {
        loop = 'run';
        ts = THREE.MathUtils.clamp(speed / 4, 0.8, 1.5);
      } else if (speed > 0.05) {
        loop = 'walk';
        ts = THREE.MathUtils.clamp(speed / 1.6, 0.6, 1.6);
      }
      bodyFactory.setLoop(b, loop, ts);
      this.animAcc += dt;
      if (this.animLod === 0 || (this.animLod === 1 && this.animAcc >= 1 / 15)) {
        bodyFactory.update(b, this.animAcc);
        this.animAcc = 0;
      } else if (this.animLod === 2) {
        // 停止蒙皮更新：累计时间封顶，回到近处时不会一下跳很多帧
        this.animAcc = Math.min(this.animAcc, 0.25);
      }
      b.scale.set(1, 1, 1);
      b.rotation.z = 0;
      b.position.y = asleep
        ? 0
        : this.habitat === 'air'
          ? Math.sin(time * 2 + this.id) * 0.15
          : this.habitat === 'water'
            ? Math.sin(time * 1.4 + this.id) * 0.05
            : 0;
    } else if (this.brain.state === 'sleep') {
      b.position.y = 0;
      b.scale.set(1.08, 0.82 + Math.sin(time * 1.5) * 0.02, 1.08);
      b.rotation.z = 0;
    } else if (this.habitat === 'air' || this.habitat === 'water') {
      b.position.y =
        Math.sin(time * (this.habitat === 'air' ? 3 : 1.4) + this.id) * (this.habitat === 'air' ? 0.25 : 0.06);
      b.scale.set(1, 1, 1);
      b.rotation.z = Math.sin(time * 1.2 + this.id) * 0.06;
    } else {
      const hop = speed > 0.05 ? Math.abs(Math.sin(this.walkPhase)) * 0.12 * Math.min(1.5, speed / 2) : 0;
      b.position.y = hop;
      const squash =
        speed > 0.05 ? 1 - Math.abs(Math.cos(this.walkPhase)) * 0.05 : 1 + Math.sin(time * 2 + this.id) * 0.015;
      b.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      b.rotation.z = speed > 0.05 ? Math.sin(this.walkPhase) * 0.06 : 0;
    }
    if (this.sparkles) this.sparkles.rotation.y += dt * 1.5;
    if (this.auraRing || this.embers) this.animateAlphaFx(dt, time);
    this.root.rotation.y = this.brain.yaw;
  }

  dispose(): void {
    bodyFactory?.dispose(this.body);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.outlineHull && !m.userData.sharedGeometry) m.geometry.dispose();
    });
    this.sparkles?.geometry.dispose();
    this.embers?.geometry.dispose();
  }
}
