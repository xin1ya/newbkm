/**
 * M3-20 · 怪力推石谜题的场景表现 + 碰撞（逻辑见 systems/puzzles/boulders.ts）。
 *
 * - 岩柱（walls）：粗糙的多面体石柱，柱脚碎石
 * - 裂谷（chasm）：深色凹陷地面 + 浅色崖沿 + 谷底飘的冷雾
 * - 地洞（holes）：圆形深坑 + 一圈崖沿；被填平后变成嵌在地面里的碎石盘
 * - 巨石（boulders）：大块扁圆岩石，正面刻着「怪力」掌印纹（发暗金色微光，提示可推）
 * - M3-23 压力板（plates）：嵌在地面的晶石符文盘，压上石头时亮起；石闸（gate）：一排晶石栅柱，全部压上后沉入地面
 * 推动有 0.35 s 缓动；掉进洞的石头下沉 + 扬尘。
 */
import * as THREE from 'three';
import type { CollisionWorld } from '../collision/CollisionWorld';
import { createToonMaterial } from '@/render';
import { cellCenter, loadBoulderState, pushBoulder, type BoulderPuzzleConfig, type BoulderState, type PushResult } from '@/systems/puzzles/boulders';

const PUSH_MS = 350;

interface BoulderMesh {
  group: THREE.Group;
  anim: { from: THREE.Vector3; to: THREE.Vector3; t0: number; sink: boolean } | null;
}

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function rockGeometry(seed: number, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.getAttribute('position');
  for (let k = 0; k < pos.count; k++) {
    const j = 0.82 + hash(k * 1.37 + seed * 7.1) * 0.32;
    pos.setXYZ(k, pos.getX(k) * j, pos.getY(k) * j, pos.getZ(k) * j);
  }
  geo.computeVertexNormals();
  return geo;
}

export class BoulderPuzzleView {
  readonly group = new THREE.Group();
  state: BoulderState;
  private boulders: Array<BoulderMesh | null> = [];
  private holeMeshes: Array<{ pit: THREE.Group; fill: THREE.Group }> = [];
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private mist: Array<{ mesh: THREE.Mesh; phase: number; base: THREE.Vector3 }> = [];
  private dust: Array<{ mesh: THREE.Mesh; t: number; v: THREE.Vector3 }> = [];
  private time = 0;
  private plateMeshes: Array<{ glow: THREE.MeshToonMaterial; cell: readonly [number, number] }> = [];
  private gateGroup: THREE.Group | null = null;
  private gateAnim = -1;

  constructor(
    readonly cfg: BoulderPuzzleConfig,
    private readonly collision: CollisionWorld,
    flags: Readonly<Record<string, boolean | undefined>>,
  ) {
    this.group.name = `boulders:${cfg.id}`;
    this.state = loadBoulderState(cfg, flags);
    this.build();
    this.applyCollision();
  }

  private mat(o: Parameters<typeof createToonMaterial>[0]): THREE.MeshToonMaterial {
    const m = createToonMaterial({ kind: 'scene', ...o });
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private build(): void {
    const { cfg } = this;
    const cs = cfg.cell;
    // —— 岩柱 ——
    const pillarMat = this.mat({ color: '#7a6a58' });
    const pillarTop = this.mat({ color: '#968470' });
    const pebble = this.mat({ color: '#5e5244' });
    cfg.walls.forEach(([c, r], i) => {
      const [x, z] = cellCenter(cfg, c, r);
      const h = 2.6 + hash(i * 3.1) * 1.8;
      const m = new THREE.Mesh(this.geo(rockGeometry(i, 1)), pillarMat);
      m.scale.set(cs * 0.5, h / 2, cs * 0.5);
      m.position.set(x, h / 2 - 0.1, z);
      m.rotation.y = hash(i) * 6;
      m.castShadow = m.receiveShadow = true;
      const cap = new THREE.Mesh(this.geo(rockGeometry(i + 50, 0)), pillarTop);
      cap.scale.set(cs * 0.36, 0.4, cs * 0.36);
      cap.position.set(x + (hash(i + 2) - 0.5) * 0.3, h - 0.15, z);
      this.group.add(m, cap);
      for (let k = 0; k < 3; k++) {
        const p = new THREE.Mesh(this.geo(rockGeometry(i * 9 + k, 0)), pebble);
        const a = hash(i * 5 + k) * Math.PI * 2;
        p.scale.setScalar(0.16 + hash(i + k * 3) * 0.14);
        p.position.set(x + Math.cos(a) * cs * 0.55, 0.08, z + Math.sin(a) * cs * 0.55);
        this.group.add(p);
      }
    });
    // —— 裂谷 ——
    const chasm = cfg.chasm ?? [];
    if (chasm.length) {
      const set = new Set(chasm.map(([c, r]) => `${c},${r}`));
      const floorMat = this.mat({ color: '#141a24', emissive: '#0a1220', emissiveIntensity: 0.5 });
      const rimMat = this.mat({ color: '#b8aa92' });
      const wallMat = this.mat({ color: '#3a3230', side: THREE.DoubleSide });
      for (const [c, r] of chasm) {
        const [x, z] = cellCenter(cfg, c, r);
        const f = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(cs, cs)), floorMat);
        f.rotation.x = -Math.PI / 2;
        f.position.set(x, -0.02 + 0.03, z);
        this.group.add(f);
        // 崖沿：只在与非裂谷格相邻的边画（裂谷的边界）+ 向下的崖壁
        const edges: Array<[number, number, number, number]> = [
          [0, -1, 0, -cs / 2],
          [0, 1, 0, cs / 2],
          [-1, 0, -cs / 2, 0],
          [1, 0, cs / 2, 0],
        ];
        for (const [dc, dr, ox, oz] of edges) {
          if (set.has(`${c + dc},${r + dr}`)) continue;
          // 洞格（填平前）与裂谷相连，不画崖沿
          if (cfg.holes.some((h) => h[0] === c + dc && h[1] === r + dr)) continue;
          const along = dr !== 0;
          const rim = new THREE.Mesh(this.geo(new THREE.BoxGeometry(along ? cs : 0.2, 0.12, along ? 0.2 : cs)), rimMat);
          rim.position.set(x + ox, 0.06, z + oz);
          const wall = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(cs, 2.4)), wallMat);
          wall.position.set(x + ox * 0.96, -1.2 + 0.02, z + oz * 0.96);
          wall.rotation.y = along ? 0 : Math.PI / 2;
          this.group.add(rim, wall);
        }
        if (hash(c * 31 + r * 7) < 0.45) {
          const m = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.9, 8, 6)), this.mat({ color: '#c8d4e0', transparent: true, opacity: 0.22 }));
          m.scale.set(1.3, 0.18, 0.9);
          const base = new THREE.Vector3(x, 0.08, z);
          m.position.copy(base);
          this.group.add(m);
          this.mist.push({ mesh: m, phase: hash(c + r * 13) * 6, base });
        }
      }
    }
    // —— 地洞 ——
    const pitMat = this.mat({ color: '#0c1018', emissive: '#060a12', emissiveIntensity: 0.6 });
    const pitRim = this.mat({ color: '#a89880' });
    const rubble = this.mat({ color: '#8a7a64' });
    const rubbleDark = this.mat({ color: '#6a5c4a' });
    cfg.holes.forEach(([c, r], i) => {
      const [x, z] = cellCenter(cfg, c, r);
      const pit = new THREE.Group();
      const disk = new THREE.Mesh(this.geo(new THREE.CircleGeometry(cs * 0.47, 20)), pitMat);
      disk.rotation.x = -Math.PI / 2;
      disk.position.y = 0.02;
      const ring = new THREE.Mesh(this.geo(new THREE.TorusGeometry(cs * 0.47, 0.09, 6, 24)), pitRim);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      pit.add(disk, ring);
      pit.position.set(x, 0, z);
      const fill = new THREE.Group();
      const plate = new THREE.Mesh(this.geo(new THREE.CircleGeometry(cs * 0.47, 20)), rubbleDark);
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = 0.025;
      fill.add(plate);
      for (let k = 0; k < 7; k++) {
        const s = new THREE.Mesh(this.geo(rockGeometry(i * 11 + k, 0)), k % 2 ? rubble : rubbleDark);
        const a = (k / 7) * Math.PI * 2 + hash(i + k);
        const rr = k === 0 ? 0 : cs * 0.26;
        s.scale.set(0.34, 0.12, 0.3);
        s.position.set(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
        s.rotation.y = a;
        fill.add(s);
      }
      fill.position.set(x, 0, z);
      this.group.add(pit, fill);
      this.holeMeshes.push({ pit, fill });
    });
    // —— M3-23 压力板 ——
    const plateBase = this.mat({ color: '#5a5470' });
    for (const cell of cfg.plates ?? []) {
      const [x, z] = cellCenter(cfg, cell[0], cell[1]);
      const base = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(cs * 0.44, cs * 0.47, 0.08, 6)), plateBase);
      base.position.set(x, 0.04, z);
      base.receiveShadow = true;
      const glow = this.mat({ color: '#8fd8ff', emissive: '#3aa0ff', emissiveIntensity: 0.15 });
      const rune = new THREE.Mesh(this.geo(new THREE.RingGeometry(cs * 0.18, cs * 0.3, 6)), glow);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(x, 0.085, z);
      const dot = new THREE.Mesh(this.geo(new THREE.CircleGeometry(cs * 0.08, 6)), glow);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(x, 0.086, z);
      this.group.add(base, rune, dot);
      this.plateMeshes.push({ glow, cell });
    }
    // —— M3-23 石闸：晶石栅柱 ——
    if (cfg.gate?.length) {
      const gg = new THREE.Group();
      gg.name = 'boulder-gate';
      const crystal = this.mat({ color: '#a8c8ff', emissive: '#4a70d0', emissiveIntensity: 0.35, transparent: true, opacity: 0.88 });
      const frame = this.mat({ color: '#4a4660' });
      cfg.gate.forEach(([c, r], i) => {
        const [x, z] = cellCenter(cfg, c, r);
        for (let k = 0; k < 3; k++) {
          const h = 2.6 + hash(i * 7 + k) * 0.9;
          const m = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0, 0.32, h, 6)), crystal);
          const off = (k - 1) * cs * 0.32;
          m.position.set(x + off, h / 2, z + (hash(i + k) - 0.5) * 0.3);
          m.rotation.z = (hash(i * 3 + k) - 0.5) * 0.2;
          gg.add(m);
        }
        const sill = new THREE.Mesh(this.geo(new THREE.BoxGeometry(cs, 0.2, cs * 0.5)), frame);
        sill.position.set(x, 0.1, z);
        gg.add(sill);
      });
      this.group.add(gg);
      this.gateGroup = gg;
      if (this.state.gateOpen) gg.position.y = -3.2;
    }
    // —— 巨石 ——
    cfg.boulders.forEach((_, j) => {
      this.boulders.push(this.buildBoulder(j));
    });
    this.syncHoles();
  }

  private buildBoulder(j: number): BoulderMesh | null {
    const b = this.state.boulders[j];
    if (!b) return null;
    const cs = this.cfg.cell;
    const g = new THREE.Group();
    g.name = `boulder:${j}`;
    const rock = new THREE.Mesh(this.geo(rockGeometry(j * 17 + 3, 1)), this.mat({ color: '#9a8a74' }));
    rock.scale.set(cs * 0.44, cs * 0.42, cs * 0.44);
    rock.position.y = cs * 0.4;
    rock.castShadow = rock.receiveShadow = true;
    g.add(rock);
    // 掌印纹（四面各一个，暗金微光）
    const runeMat = this.mat({ color: '#e8c070', emissive: '#a07020', emissiveIntensity: 0.55 });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const palm = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.2, 10)), runeMat);
      const d = cs * 0.4;
      palm.position.set(Math.sin(a) * d, cs * 0.42, Math.cos(a) * d);
      palm.rotation.y = a;
      g.add(palm);
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.06, 0.18)), runeMat);
        finger.position.set(Math.sin(a) * (d + 0.005) + Math.cos(a) * (f - 1.5) * 0.09, cs * 0.42 + 0.27, Math.cos(a) * (d + 0.005) - Math.sin(a) * (f - 1.5) * 0.09);
        finger.rotation.y = a;
        g.add(finger);
      }
    }
    const [x, z] = cellCenter(this.cfg, b[0], b[1]);
    g.position.set(x, 0, z);
    this.group.add(g);
    return { group: g, anim: null };
  }

  private syncHoles(): void {
    this.holeMeshes.forEach((h, i) => {
      const f = this.state.filled[i]!;
      h.pit.visible = !f;
      h.fill.visible = f;
    });
  }

  /** 墙 / 裂谷 / 未填的洞 / 石头的碰撞（每次推动后重建） */
  private applyCollision(): void {
    this.collision.removeGroup(`boulders:${this.cfg.id}`);
    const cs = this.cfg.cell;
    const tag = `boulders:${this.cfg.id}`;
    const add = (c: number, r: number, inset: number, h: number) => {
      const [x, z] = cellCenter(this.cfg, c, r);
      this.collision.add(tag, { kind: 'box', x, z, hx: cs / 2 - inset, hz: cs / 2 - inset, yaw: 0, y0: -3, y1: h });
    };
    for (const [c, r] of this.cfg.walls) add(c, r, 0.12, 4);
    for (const [c, r] of this.cfg.chasm ?? []) add(c, r, 0, 4);
    this.cfg.holes.forEach(([c, r], i) => {
      if (!this.state.filled[i]) add(c, r, 0.05, 4);
    });
    for (const b of this.state.boulders) if (b) add(b[0], b[1], 0.08, 2);
    if (!this.state.gateOpen) for (const [c, r] of this.cfg.gate ?? []) add(c, r, 0, 4);
  }

  /** 推一块石头（动画 + 碰撞更新）；返回逻辑结果 */
  push(c: number, r: number, dc: number, dr: number): PushResult {
    const j = this.state.boulders.findIndex((b) => b && b[0] === c && b[1] === r);
    const res = pushBoulder(this.cfg, this.state, c, r, dc, dr);
    if (!res.ok || j < 0) return res;
    this.state = res.state;
    if (res.openedGate) this.gateAnim = this.time + PUSH_MS / 1000;
    const m = this.boulders[j];
    if (m) {
      const [tx, tz] = cellCenter(this.cfg, res.to[0], res.to[1]);
      m.anim = { from: m.group.position.clone(), to: new THREE.Vector3(tx, 0, tz), t0: this.time, sink: res.filledHole !== null };
    }
    this.applyCollision();
    return res;
  }

  /** 是否有石头正在移动（移动中不接受下一次推） */
  get busy(): boolean {
    return this.boulders.some((b) => b?.anim);
  }

  update(dt: number): void {
    this.time += dt;
    // 压力板：压着石头时亮起（脉动）
    for (const pm of this.plateMeshes) {
      const on = this.state.boulders.some((b) => b && b[0] === pm.cell[0] && b[1] === pm.cell[1]) && !this.boulders.some((b) => b?.anim);
      const want = on ? 1.4 + Math.sin(this.time * 4) * 0.25 : 0.15;
      pm.glow.emissiveIntensity += (want - pm.glow.emissiveIntensity) * Math.min(1, dt * 6);
    }
    // 石闸沉入地面（1.6 s，带轻微抖动）
    if (this.gateGroup && this.gateAnim >= 0 && this.time >= this.gateAnim) {
      const k = Math.min(1, (this.time - this.gateAnim) / 1.6);
      this.gateGroup.position.y = -3.2 * k * k;
      this.gateGroup.position.x = k < 1 ? Math.sin(this.time * 60) * 0.05 : 0;
      if (k >= 1) this.gateAnim = -1;
    }
    for (const [j, b] of this.boulders.entries()) {
      if (!b?.anim) continue;
      const a = b.anim;
      const k = Math.min(1, ((this.time - a.t0) * 1000) / PUSH_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      b.group.position.lerpVectors(a.from, a.to, e);
      // 滚动感：沿推动方向轻微翻转
      const dir = new THREE.Vector3().subVectors(a.to, a.from);
      b.group.rotation.x = dir.z * e * 0.25;
      b.group.rotation.z = -dir.x * e * 0.25;
      if (k >= 1) {
        if (a.sink) {
          // 掉进洞：下沉 + 扬尘，然后把洞换成碎石盘
          const s = Math.min(1, ((this.time - a.t0) * 1000 - PUSH_MS) / 400);
          b.group.position.y = -s * this.cfg.cell * 0.9;
          if (s === 0) this.spawnDust(a.to);
          if (s >= 1) {
            b.group.removeFromParent();
            this.boulders[j] = null;
            this.syncHoles();
          }
        } else {
          b.group.rotation.set(0, 0, 0);
          b.anim = null;
        }
      }
    }
    for (const m of this.mist) {
      const t = this.time * 0.3 + m.phase;
      m.mesh.position.set(m.base.x + Math.sin(t) * 0.4, m.base.y + Math.sin(t * 1.7) * 0.04, m.base.z + Math.cos(t * 0.8) * 0.3);
      (m.mesh.material as THREE.MeshToonMaterial).opacity = 0.16 + Math.sin(t * 1.3) * 0.06;
    }
    for (const d of this.dust) {
      d.t += dt;
      d.mesh.position.addScaledVector(d.v, dt);
      d.v.y -= dt * 0.6;
      d.mesh.scale.setScalar(0.3 + d.t * 0.9);
      (d.mesh.material as THREE.MeshToonMaterial).opacity = Math.max(0, 0.5 * (1 - d.t / 1.2));
    }
    this.dust = this.dust.filter((d) => {
      if (d.t < 1.2) return true;
      d.mesh.removeFromParent();
      (d.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  private spawnDust(at: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.4, 6, 5)), createToonMaterial({ kind: 'scene', color: '#c8b89a', transparent: true, opacity: 0.5 }));
      const a = (i / 10) * Math.PI * 2;
      m.position.set(at.x + Math.cos(a) * 0.6, 0.3, at.z + Math.sin(a) * 0.6);
      this.group.add(m);
      this.dust.push({ mesh: m, t: 0, v: new THREE.Vector3(Math.cos(a) * 1.4, 1.2 + hash(i) * 0.8, Math.sin(a) * 1.4) });
    }
  }

  dispose(): void {
    this.collision.removeGroup(`boulders:${this.cfg.id}`);
    this.group.removeFromParent();
    for (const d of this.dust) (d.mesh.material as THREE.Material).dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}
