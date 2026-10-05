/**
 * M3-17 · 攀爬点的场景表现（世界层）。逻辑见 systems/ride/climb.ts，交互见 scenes/common/SceneClimb.ts。
 *
 * 每面岩壁沿崖脚 → 崖顶贴着地形铺一条纹路带（宽 width），让「哪里能爬」在远处就看得出来：
 * - vines：5–7 股粗藤（Tube，左右轻摆）+ 叶片 + 零星小白花，藤根在崖脚扎进一丛灌木；
 * - crack：一道锯齿状的深色裂缝 + 两侧凸起的灰色岩点（抓手），崖顶钉一根旧铁桩；
 * - ice：冰裂纹（自发光淡蓝）+ 冰凸点，崖脚散落碎冰。
 * 崖脚另立一个石堆路标（漆着攀爬记号），崖顶一圈小石块标出落脚点。
 * 只做显示，不加碰撞（崖面本身就是地形）。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { ClimbWallConfig } from '@/config/islands/types';

type HeightFn = (x: number, z: number) => number;

const STYLE_COLORS: Record<ClimbWallConfig['style'], { main: string; dark: string; accent: string }> = {
  vines: { main: '#3f7a32', dark: '#2a5222', accent: '#f4f0e0' },
  crack: { main: '#3a3640', dark: '#1e1c22', accent: '#9a96a2' },
  ice: { main: '#bfe8ff', dark: '#6ab0e0', accent: '#ffffff' },
};

export class ClimbWalls {
  readonly group = new THREE.Group();
  private sway: Array<{ mesh: THREE.Object3D; phase: number; amp: number }> = [];
  private glints: THREE.MeshToonMaterial[] = [];
  private mats: THREE.Material[] = [];
  private time = 0;

  constructor(
    walls: readonly ClimbWallConfig[],
    private readonly heightAt: HeightFn,
  ) {
    this.group.name = 'climb-walls';
    for (const w of walls) this.group.add(this.buildWall(w));
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const s of this.sway) s.mesh.rotation.z = Math.sin(t * 1.3 + s.phase) * s.amp;
    for (const [i, m] of this.glints.entries()) m.emissiveIntensity = 0.55 + Math.sin(t * 2.2 + i) * 0.25;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const m of this.mats) m.dispose();
    this.mats = [];
  }

  private mat(o: Parameters<typeof createToonMaterial>[0]): THREE.MeshToonMaterial {
    const m = createToonMaterial({ kind: 'scene', ...o });
    this.mats.push(m);
    return m;
  }

  /** 崖面上的一点：沿 base→top 的比例 k、横向偏移 u（米），贴地抬高 lift */
  private facePoint(w: ClimbWallConfig, k: number, u: number, lift = 0.08): THREE.Vector3 {
    const [bx, bz] = w.base;
    const [tx, tz] = w.top;
    const dx = tx - bx;
    const dz = tz - bz;
    const len = Math.hypot(dx, dz) || 1;
    // 横向 = 水平垂直方向
    const px = -dz / len;
    const pz = dx / len;
    const x = bx + dx * k + px * u;
    const z = bz + dz * k + pz * u;
    // 往崖外（朝崖脚方向）抬一点，免得纹路埋进地形
    const h = this.heightAt(x, z);
    return new THREE.Vector3(x - (dx / len) * lift, h + lift, z - (dz / len) * lift);
  }

  private buildWall(w: ClimbWallConfig): THREE.Group {
    const g = new THREE.Group();
    g.name = `climb-wall:${w.id}`;
    const width = w.width ?? 3;
    const col = STYLE_COLORS[w.style];
    if (w.style === 'vines') this.buildVines(g, w, width, col);
    else this.buildCrack(g, w, width, col, w.style === 'ice');
    this.buildMarkers(g, w, col);
    return g;
  }

  private buildVines(g: THREE.Group, w: ClimbWallConfig, width: number, col: { main: string; dark: string; accent: string }): void {
    const vine = this.mat({ color: col.main });
    const vineDark = this.mat({ color: col.dark });
    const leaf = this.mat({ color: '#5aa040', side: THREE.DoubleSide });
    const leafDark = this.mat({ color: '#3e8a30', side: THREE.DoubleSide });
    const flower = this.mat({ color: col.accent, emissive: '#fff4c0', emissiveIntensity: 0.2 });
    const strands = Math.max(5, Math.round(width * 2));
    for (let s = 0; s < strands; s++) {
      const u0 = (s / (strands - 1) - 0.5) * width;
      const pts: THREE.Vector3[] = [];
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const k = -0.02 + (i / steps) * 1.04;
        const u = u0 + Math.sin(k * 9 + s * 1.7) * 0.25;
        pts.push(this.facePoint(w, k, u, 0.12 + (s % 2) * 0.05));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.07 + (s % 3) * 0.02, 6, false), s % 2 ? vine : vineDark);
      tube.castShadow = true;
      g.add(tube);
      // 叶片：沿藤每 ~0.6 m 一片，交替左右
      const n = Math.round(curve.getLength() / 0.6);
      for (let i = 0; i < n; i++) {
        const p = curve.getPointAt((i + 0.5) / n);
        const holder = new THREE.Group();
        holder.position.copy(p);
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.2 + ((i * 0.37) % 1) * 0.12, 5), i % 3 ? leaf : leafDark);
        l.scale.set(1, 0.6, 1);
        l.rotation.set(-0.4 + ((i * 0.53) % 1) * 0.8, (i % 2 ? 1 : -1) * 0.9 + s, 0.3);
        l.position.set((i % 2 ? 1 : -1) * 0.14, 0, 0);
        holder.add(l);
        g.add(holder);
        if (i % 4 === 0) this.sway.push({ mesh: holder, phase: i * 0.7 + s, amp: 0.12 });
        if ((i + s) % 9 === 0) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), flower);
          f.position.copy(p).add(new THREE.Vector3(0, 0.05, 0));
          g.add(f);
        }
      }
    }
    // 藤根：崖脚一丛灌木
    const root = this.facePoint(w, -0.08, 0, 0);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + i * 0.1, 0), i % 2 ? leaf : leafDark);
      b.position.set(root.x + (i - 1.5) * width * 0.25, root.y + 0.35, root.z + ((i * 0.37) % 1) * 0.4);
      b.scale.y = 0.75;
      b.castShadow = true;
      g.add(b);
    }
  }

  private buildCrack(g: THREE.Group, w: ClimbWallConfig, width: number, col: { main: string; dark: string; accent: string }, ice: boolean): void {
    const crackMat = ice ? this.mat({ color: '#e8f8ff', emissive: col.dark, emissiveIntensity: 0.6 }) : this.mat({ color: col.dark });
    if (ice) this.glints.push(crackMat);
    const knob = this.mat(ice ? { color: col.main, transparent: true, opacity: 0.9, emissive: '#5aa8e0', emissiveIntensity: 0.2 } : { color: col.accent });
    // 锯齿裂缝：主缝 + 两道细支缝
    for (const [u0, thick, amp] of [
      [0, 0.16, 0.45],
      [-width * 0.3, 0.07, 0.25],
      [width * 0.32, 0.07, 0.3],
    ] as const) {
      const pts: THREE.Vector3[] = [];
      const steps = 16;
      const k0 = u0 === 0 ? -0.02 : 0.15;
      const k1 = u0 === 0 ? 1.02 : 0.85;
      for (let i = 0; i <= steps; i++) {
        const k = k0 + (i / steps) * (k1 - k0);
        pts.push(this.facePoint(w, k, u0 + (i % 2 ? 1 : -1) * amp * (0.5 + ((i * 0.618) % 1) * 0.5), 0.06));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 48, thick, 4, false), crackMat);
      g.add(tube);
    }
    // 抓手：两侧交错的岩点 / 冰凸
    const holds = 26;
    for (let i = 0; i < holds; i++) {
      const k = 0.04 + (i / holds) * 0.92;
      const side = i % 2 ? 1 : -1;
      const p = this.facePoint(w, k, side * (0.5 + ((i * 0.37) % 1) * width * 0.25), 0.1);
      const m = new THREE.Mesh(ice ? new THREE.OctahedronGeometry(0.16 + ((i * 0.53) % 1) * 0.08) : new THREE.DodecahedronGeometry(0.15 + ((i * 0.53) % 1) * 0.08, 0), knob);
      m.position.copy(p);
      m.rotation.set(i, i * 0.7, 0);
      m.castShadow = true;
      g.add(m);
    }
    // 崖顶：旧铁桩 + 一截绳子（裂缝）/ 冰柱（冰）
    const top = this.facePoint(w, 1.06, 0.6, 0);
    if (ice) {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6 + i * 0.2, 5), knob);
        c.position.set(top.x + (i - 1) * 0.4, top.y + 0.3, top.z);
        g.add(c);
      }
      // 崖脚碎冰
      const foot = this.facePoint(w, -0.1, 0, 0);
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + (i % 3) * 0.08), knob);
        c.position.set(foot.x + Math.sin(i * 2.1) * 1.2, foot.y + 0.1, foot.z + Math.cos(i * 2.1) * 0.8);
        c.rotation.set(i, i * 1.3, 0);
        g.add(c);
      }
    } else {
      const iron = this.mat({ color: '#6a5a4a' });
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), iron);
      stake.position.set(top.x, top.y + 0.3, top.z);
      g.add(stake);
      const rope = this.mat({ color: '#c8a870' });
      const pts = [new THREE.Vector3(top.x, top.y + 0.5, top.z), this.facePoint(w, 0.85, 0.5, 0.18), this.facePoint(w, 0.6, 0.35, 0.18)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.035, 5, false), rope));
    }
  }

  /** 崖脚石堆路标（漆着攀爬记号）+ 崖顶落脚点小石圈 */
  private buildMarkers(g: THREE.Group, w: ClimbWallConfig, col: { main: string; dark: string; accent: string }): void {
    const stone = this.mat({ color: '#8a8a90' });
    const paint = this.mat({ color: '#e8b73a', emissive: '#6a4a00', emissiveIntensity: 0.25 });
    const [bx, bz] = w.base;
    const [tx, tz] = w.top;
    const len = Math.hypot(tx - bx, tz - bz) || 1;
    const px = -(tz - bz) / len;
    const pz = (tx - bx) / len;
    const cx = bx + px * ((w.width ?? 3) / 2 + 1.2);
    const cz = bz + pz * ((w.width ?? 3) / 2 + 1.2);
    const cy = this.heightAt(cx, cz);
    for (let i = 0; i < 3; i++) {
      const r = 0.42 - i * 0.1;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stone);
      s.position.set(cx, cy + 0.25 + i * 0.5, cz);
      s.scale.y = 0.7;
      s.rotation.y = i;
      s.castShadow = true;
      g.add(s);
    }
    // 记号：向上的山形箭头（两块漆板）
    const yaw = Math.atan2(tx - bx, tz - bz);
    for (const sgn of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.04), paint);
      bar.position.set(cx - Math.sin(yaw) * 0.32, cy + 0.85, cz - Math.cos(yaw) * 0.32);
      bar.rotation.set(0, yaw, sgn * 0.7);
      bar.position.x += Math.cos(yaw) * sgn * 0.11;
      bar.position.z -= Math.sin(yaw) * sgn * 0.11;
      g.add(bar);
    }
    // 崖顶落脚点
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = tx + Math.cos(a) * 1.3;
      const z = tz + Math.sin(a) * 1.3;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), i % 2 ? stone : this.mat({ color: col.accent }));
      s.position.set(x, this.heightAt(x, z) + 0.08, z);
      g.add(s);
    }
  }
}
