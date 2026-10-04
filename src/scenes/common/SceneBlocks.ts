/**
 * 计划文档 §9.5 · 大地图上的能量方块：
 * - 诱饵：背包 → 方块盒 → 放置诱饵，在玩家脚下摆一个小盘子 + 方块（香气粒子 + 地面光圈），
 *   3 分钟（游戏 180 分钟，金色方块 1.5 倍）内半径 45 m 里偏好该口味的物种出现率 ×3、区域目标数 +2；
 * - 安抚头目：面朝 9 m 内未被安抚的头目按 E「投喂方块」，选方块 → 抛物线飞过去 →
 *   合口味：安抚（头顶爱心、不再追击；开战时不获得气场能力提升、捕获率 ×1.3）；
 *   不合口味：不理睬（方块浪费）；黑色方块：激怒（立刻冲锋）。
 */
import * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { GameState } from '@/systems/state';
import { createToonMaterial } from '@/render';
import {
  activeLure,
  BLOCK_COLOR,
  blockBox,
  blockName,
  blockSummary,
  calmAlpha,
  placeLure,
  takeBlock,
  type LureState,
} from '@/systems/blocks';
import type { Flavor } from '@/config/berries';
import type { PlayerController } from '@/actors/player';
import type { WildMon } from '@/world/spawns/WildMon';
import type { Interactable, InteractSource } from './SceneInteractions';
import { choose, type UiRoot } from '@/ui/core';
import { blockIconSvg } from '@/ui/blocks/BlockMachineScreen';
import { sfx } from '@/core/audio';

export interface SceneBlocksDeps {
  island: string;
  parent: THREE.Object3D;
  player: PlayerController;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  wild(): Iterable<WildMon>;
  heightAt(x: number, z: number): number;
  minutes(): number;
  /** 不能放诱饵的原因（室内 / 水上 / 骑车等），可以放时返回 null */
  lureBlocked(): string | null;
  toast(text: string, ms?: number): void;
}

const FEED_RANGE = 9;

export class SceneBlocks {
  private lureObj: THREE.Group | null = null;
  private lureKey = '';
  private sparks: THREE.Points | null = null;
  private ring: THREE.Mesh | null = null;
  private flying: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; done: () => void } | null = null;
  private t = 0;
  busy = false;
  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(private readonly d: SceneBlocksDeps) {}

  /** 当前位置生效的诱饵口味（SpawnContext / 草丛遇敌用） */
  lureAt(x: number, z: number): Flavor | null {
    return activeLure(this.d.state, this.d.island, x, z, this.d.minutes());
  }

  /** 菜单宿主：放置诱饵 */
  placeLure = (uid: string): string | null => {
    const why = this.d.lureBlocked();
    if (why) return why;
    const b = blockBox(this.d.state).find((x) => x.uid === uid);
    if (!b) return '找不到这个方块。';
    const p = this.d.player.position;
    const f = this.d.player.facing;
    const x = p.x + Math.sin(f) * 1.2;
    const z = p.z + Math.cos(f) * 1.2;
    takeBlock(this.d.state, uid);
    placeLure(this.d.state, b, this.d.island, x, z, this.d.minutes());
    this.syncLure();
    return null;
  };

  private mat(color: string, opts: { transparent?: boolean; opacity?: number } = {}): THREE.Material {
    const m = createToonMaterial({ color, kind: 'scene', ...opts });
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private clearLure(): void {
    if (!this.lureObj) return;
    this.d.parent.remove(this.lureObj);
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    this.mats.length = 0;
    this.geos.length = 0;
    this.lureObj = null;
    this.sparks = null;
    this.ring = null;
    this.lureKey = '';
  }

  /** 按存档同步诱饵模型 */
  private syncLure(): void {
    const l = this.d.state.lure;
    const live = l && l.island === this.d.island && l.until > this.d.minutes() ? l : null;
    const key = live ? `${live.x},${live.z},${live.kind},${live.until}` : '';
    if (key === this.lureKey) return;
    this.clearLure();
    if (!live) return;
    this.lureKey = key;
    this.lureObj = this.buildLure(live);
    this.d.parent.add(this.lureObj);
  }

  private buildLure(l: LureState): THREE.Group {
    const g = new THREE.Group();
    g.name = 'block-lure';
    const y = this.d.heightAt(l.x, l.z);
    g.position.set(l.x, y, l.z);
    // 小木盘 + 布垫
    const plate = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.34, 0.3, 0.06, 14)), this.mat('#b07a48'));
    plate.position.y = 0.03;
    g.add(plate);
    const cloth = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.27, 0.27, 0.012, 14)), this.mat('#f4efe4'));
    cloth.position.y = 0.066;
    g.add(cloth);
    // 方块（略倾斜的立方体 + 顶面高光）
    const col = BLOCK_COLOR[l.kind];
    const cube = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.2, 0.2, 0.2)), this.mat(col));
    cube.position.y = 0.17;
    cube.rotation.set(0.12, 0.6, 0.05);
    cube.name = 'lure-cube';
    g.add(cube);
    // 地面光圈
    const ring = new THREE.Mesh(this.geo(new THREE.RingGeometry(0.6, 0.75, 32).rotateX(-Math.PI / 2)), this.mat(col, { transparent: true, opacity: 0.45 }));
    ring.position.y = 0.04;
    ring.userData.noShadow = true;
    g.add(ring);
    this.ring = ring;
    // 香气粒子
    const n = 24;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = Math.random() * 1.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const pg = this.geo(new THREE.BufferGeometry());
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ color: col, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
    this.mats.push(pm);
    const sp = new THREE.Points(pg, pm);
    sp.frustumCulled = false;
    g.add(sp);
    this.sparks = sp;
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) o.castShadow = true;
    });
    return g;
  }

  // ———————————————— 投喂头目 ————————————————

  source(): InteractSource {
    return (_player, out: Interactable[]) => {
      if (this.busy) return;
      const pp = this.d.player.position;
      for (const w of this.d.wild()) {
        if (!w.mon.alpha || w.brain.calmed || w.frozen) continue;
        const p = w.root.position;
        if (Math.abs(p.x - pp.x) > FEED_RANGE || Math.abs(p.z - pp.z) > FEED_RANGE) continue;
        out.push({
          id: `feed-alpha:${w.id}`,
          kind: 'use',
          x: p.x,
          z: p.z,
          y: p.y + w.height + 0.6,
          range: FEED_RANGE,
          priority: 3,
          action: 'interact',
          label: '投喂能量方块',
          run: () => this.feedAlpha(w),
        });
      }
    };
  }

  private async feedAlpha(w: WildMon): Promise<void> {
    const box = blockBox(this.d.state);
    const name = this.d.dex.species(w.mon.speciesId).name.zh;
    if (!box.length) {
      this.d.toast('方块盒里没有能量方块。在家里的方块机用树果做一些吧。', 2600);
      return;
    }
    this.busy = true;
    try {
      const pick = await choose(
        this.d.ui,
        box.map((b) => ({ label: blockName(b), value: b.uid, sub: blockSummary(b), icon: blockIconSvg(b.kind, 28) })),
        { cancellable: true, style: { maxHeight: '60vh', overflowY: 'auto' } },
      );
      if (!pick || w.frozen || !w.root.parent) return;
      const b = takeBlock(this.d.state, pick);
      if (!b) return;
      sfx('jump', 0.4);
      await this.throwTo(w, BLOCK_COLOR[b.kind]);
      const r = calmAlpha(w.species.types, b);
      if (r === 'calmed') {
        w.brain.calmed = true;
        w.brain.state = 'idle';
        sfx('heal', 0.6);
        this.d.toast(`${name}吃掉了${blockName(b)}，平静了下来！\n现在靠近它开战，它不会摆出头目的架势，也更容易捕获。`, 3600);
      } else if (r === 'angered') {
        w.brain.state = 'chase';
        sfx('error', 0.7);
        this.d.toast(`${name}闻了闻黑色方块……被激怒了！`, 2600);
      } else {
        sfx('back', 0.5);
        this.d.toast(`${name}看都不看${blockName(b)}一眼。好像不合它的口味。`, 2800);
      }
    } finally {
      this.busy = false;
    }
  }

  private throwTo(w: WildMon, color: string): Promise<void> {
    return new Promise((resolve) => {
      const p = this.d.player.position;
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const mat = createToonMaterial({ color, kind: 'scene' });
      const mesh = new THREE.Mesh(geo, mat);
      const from = new THREE.Vector3(p.x, p.y + 1.3, p.z);
      const tp = w.root.position;
      const to = new THREE.Vector3(tp.x, tp.y + Math.min(1.2, w.height * 0.5), tp.z);
      mesh.position.copy(from);
      this.d.parent.add(mesh);
      this.d.player.model.gesture('reach', 0.5);
      this.flying = {
        mesh,
        from,
        to,
        t: 0,
        done: () => {
          this.d.parent.remove(mesh);
          geo.dispose();
          mat.dispose();
          resolve();
        },
      };
    });
  }

  update(dt: number): void {
    this.t += dt;
    // 每 30 帧左右检查一次过期
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) {
      if (this.d.state.lure && this.d.state.lure.until <= this.d.minutes()) this.d.state.lure = undefined;
      this.syncLure();
    }
    if (this.lureObj) {
      const cube = this.lureObj.getObjectByName('lure-cube');
      if (cube) cube.position.y = 0.17 + Math.sin(this.t * 2) * 0.01;
      if (this.ring) {
        const k = 1 + ((this.t * 0.6) % 1) * 1.6;
        this.ring.scale.set(k, 1, k);
        (this.ring.material as THREE.Material & { opacity: number }).opacity = 0.5 * (1 - ((this.t * 0.6) % 1));
      }
      if (this.sparks) {
        const a = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < a.count; i++) {
          let y = a.getY(i) + dt * (0.35 + (i % 5) * 0.06);
          if (y > 1.8) y = 0.1;
          a.setY(i, y);
          a.setX(i, a.getX(i) + Math.sin(this.t * 1.7 + i) * dt * 0.08);
        }
        a.needsUpdate = true;
      }
    }
    const f = this.flying;
    if (f) {
      f.t = Math.min(1, f.t + dt / 0.6);
      f.mesh.position.lerpVectors(f.from, f.to, f.t);
      f.mesh.position.y += Math.sin(f.t * Math.PI) * 1.4;
      f.mesh.rotation.x += dt * 9;
      f.mesh.rotation.z += dt * 6;
      if (f.t >= 1) {
        this.flying = null;
        f.done();
      }
    }
  }

  dispose(): void {
    if (this.flying) {
      this.d.parent.remove(this.flying.mesh);
      this.flying.done();
      this.flying = null;
    }
    this.clearLure();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}
