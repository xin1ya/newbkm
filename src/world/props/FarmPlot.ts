/**
 * 计划文档 §9.3 / §9.6 · 田地模型（实例化，同类部件合批）：
 * - 土垄：2 m 见方、3 道隆起的垄，湿润时深褐、干燥时浅黄褐（实例色）；四周原木围边；
 * - 作物：种子期是一小撮埋土的种子堆；之后同一株低多边形植株按阶段放大（发芽 0.35 → 长高 0.75 → 开花 / 结果 1.0），
 *   叶色取树果植株配色；开花期花瓣取果色提亮；结果期挂 6 个对应颜色的果实；
 * - 杂草：田角冒出的几簇尖草；虫害：在叶子上爬动的小甲虫（只在有虫害的田动画）。
 * 共 9 个 draw call。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '@/render';
import type { PlotDef, Stage } from '@/systems/farming';
import { at, fruitGeo, jitterVerts, paint } from './gatherProps';

export interface PlotVisual {
  /** null = 空田 */
  stage: Stage | null;
  wet: boolean;
  weeds: boolean;
  pests: boolean;
  leaf: string;
  fruit: string;
}

const FRUITS = 6;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SOIL_WET = new THREE.Color('#5a3a22');
const SOIL_DRY = new THREE.Color('#a07a4c');

function soilGeo(): THREE.BufferGeometry {
  const parts = [at(new THREE.BoxGeometry(2, 0.16, 2), 0, 0.08, 0)];
  for (let i = -1; i <= 1; i++) parts.push(at(new THREE.CylinderGeometry(0.22, 0.26, 1.8, 6, 1), i * 0.6, 0.16, 0, 1, 1, 0.5, 0, Math.PI / 2));
  return mergeGeometries(parts.map((g) => paint(g, '#ffffff', 0.12)))!;
}

function frameGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const log = at(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 6), 0, 0.09, 1.1, 1, 1, 1, 0, 0, Math.PI / 2);
    log.rotateY((k * Math.PI) / 2);
    parts.push(paint(log, k % 2 ? '#8a5a34' : '#7a4e2c', 0.15));
  }
  for (const [x, z] of [
    [1.1, 1.1],
    [-1.1, 1.1],
    [1.1, -1.1],
    [-1.1, -1.1],
  ] as const)
    parts.push(paint(at(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 6), x, 0.17, z), '#6e4a2c'));
  return mergeGeometries(parts)!;
}

function seedGeo(): THREE.BufferGeometry {
  const parts = [paint(at(new THREE.SphereGeometry(0.22, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.2, 0, 1, 0.6, 1), '#6a4528', 0.15)];
  for (let i = 0; i < 3; i++) parts.push(paint(at(new THREE.IcosahedronGeometry(0.035, 0), Math.sin(i * 2.1) * 0.08, 0.32, Math.cos(i * 2.1) * 0.08), '#e8d6a0'));
  return mergeGeometries(parts)!;
}

/** 植株（原点在土面，按阶段整体缩放；顶点色偏白，实例色乘叶色） */
function plantGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(at(new THREE.CylinderGeometry(0.035, 0.06, 1.1, 5), 0, 0.55, 0), '#c9e0b0'));
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const y = 0.25 + i * 0.12;
    const leaf = at(new THREE.ConeGeometry(0.12, 0.42, 4), Math.sin(a) * 0.17, y, Math.cos(a) * 0.17, 1, 1, 0.3, a, 1.1);
    parts.push(paint(leaf, i % 2 ? '#f0fae6' : '#dcebd0', 0.12));
  }
  parts.push(paint(at(jitterVerts(new THREE.IcosahedronGeometry(0.32, 0), 0.04, 7), 0, 1.15, 0, 1, 0.8, 1), '#e6f2dc', 0.15));
  return mergeGeometries(parts)!;
}

function bloomGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spots: Array<[number, number, number]> = [
    [0.25, 1.2, 0.05],
    [-0.2, 1.1, 0.2],
    [0.05, 1.35, -0.2],
    [-0.15, 0.9, -0.25],
  ];
  for (const [x, y, z] of spots) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(paint(at(new THREE.SphereGeometry(0.05, 4, 2), x + Math.cos(a) * 0.06, y, z + Math.sin(a) * 0.06, 1, 0.4, 1), '#ffffff'));
    }
    parts.push(paint(at(new THREE.IcosahedronGeometry(0.03, 0), x, y + 0.02, z), '#f2c230'));
  }
  return mergeGeometries(parts)!;
}

function weedGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const clumps: Array<[number, number]> = [
    [0.75, 0.7],
    [-0.7, -0.6],
    [0.6, -0.75],
  ];
  clumps.forEach(([x, z], c) => {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + c;
      const len = 0.25 + (i % 3) * 0.08;
      parts.push(paint(at(new THREE.ConeGeometry(0.03, len, 3), x + Math.sin(a) * 0.05, 0.18 + len / 2, z + Math.cos(a) * 0.05, 1, 1, 1, a, 0.3), i % 2 ? '#7a9a3a' : '#8aa848', 0.15));
    }
  });
  return mergeGeometries(parts)!;
}

function bugGeo(): THREE.BufferGeometry {
  const body = at(new THREE.SphereGeometry(0.05, 6, 4), 0, 0, 0, 1, 0.7, 1.3);
  const head = at(new THREE.SphereGeometry(0.03, 5, 3), 0, 0.005, 0.065);
  const spot = at(new THREE.SphereGeometry(0.018, 4, 2), 0.02, 0.035, -0.01);
  return mergeGeometries([paint(body, '#c0302a'), paint(head, '#2a2420'), paint(spot, '#2a2420')])!;
}

interface Part {
  mesh: THREE.InstancedMesh;
  base: THREE.Matrix4[];
  owner: number[];
}

export class FarmPlots {
  readonly root = new THREE.Group();
  private parts = new Map<string, Part>();
  private mats: THREE.Material[] = [];
  private states: PlotVisual[] = [];
  private yOf: number[];

  constructor(
    readonly defs: readonly PlotDef[],
    parent: THREE.Object3D,
    heightAt: (x: number, z: number) => number,
  ) {
    this.root.name = 'farm-plots';
    // 田地四角取最低点，避免悬空
    this.yOf = defs.map((d) => {
      const [x, z] = d.position;
      return Math.min(heightAt(x, z), heightAt(x - 1, z - 1), heightAt(x + 1, z - 1), heightAt(x - 1, z + 1), heightAt(x + 1, z + 1)) - 0.04;
    });
    const plain = createToonMaterial({ kind: 'scene', vertexColors: true, name: 'farm' });
    this.mats.push(plain);
    const idx = defs.map((_, i) => i);
    const m4 = (i: number, dx = 0, dy = 0, dz = 0, s = 1, yaw = 0) => {
      const [x, z] = defs[i]!.position;
      return new THREE.Matrix4().compose(new THREE.Vector3(x + dx, this.yOf[i]! + dy, z + dz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
    };
    this.add('soil', soilGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i), c: SOIL_DRY })));
    this.add('frame', frameGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i) })));
    this.add('seed', seedGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i, 0, 0.05) })));
    this.add('plant', plantGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i, 0, 0.2, 0, 1, i * 1.7), c: new THREE.Color('#4f9a48') })));
    this.add('bloom', bloomGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i, 0, 0.2, 0, 1, i * 1.7), c: new THREE.Color('#ffffff') })));
    const fruits: Array<{ owner: number; m: THREE.Matrix4; c: THREE.Color }> = [];
    for (const i of idx)
      for (let k = 0; k < FRUITS; k++) {
        const a = (k / FRUITS) * Math.PI * 2 + i;
        fruits.push({ owner: i, m: m4(i, Math.cos(a) * 0.3, 0.2 + 0.85 + (k % 3) * 0.17, Math.sin(a) * 0.3, 1.05), c: new THREE.Color('#e8484a') });
      }
    this.add('fruit', fruitGeo(), plain, fruits);
    this.add('weeds', weedGeo(), plain, idx.map((i) => ({ owner: i, m: m4(i, 0, 0, 0, 1, i * 0.9) })));
    this.add('bug', bugGeo(), plain, idx.flatMap((i) => [0, 1].map((k) => ({ owner: i, m: m4(i, k ? -0.2 : 0.18, 0.75 + k * 0.2, k ? 0.1 : -0.12) }))));
    parent.add(this.root);
  }

  private add(name: string, geo: THREE.BufferGeometry, mat: THREE.Material, items: Array<{ owner: number; m: THREE.Matrix4; c?: THREE.Color }>): void {
    if (!items.length) {
      geo.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.userData.dynamicInstances = true; // 矩阵按状态重写：战斗领域隐藏遮挡物时跳过
    mesh.name = `farm-${name}`;
    mesh.castShadow = name !== 'soil';
    mesh.receiveShadow = true;
    items.forEach((it, k) => {
      mesh.setMatrixAt(k, name === 'soil' || name === 'frame' ? it.m : ZERO);
      if (it.c) mesh.setColorAt(k, it.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.root.add(mesh);
    this.parts.set(name, { mesh, base: items.map((i) => i.m), owner: items.map((i) => i.owner) });
  }

  groundY(i: number): number {
    return this.yOf[i] ?? 0;
  }

  sync(states: readonly PlotVisual[]): void {
    const prev = this.states;
    this.states = states.map((s) => ({ ...s }));
    const changed = (i: number) => JSON.stringify(prev[i]) !== JSON.stringify(states[i]);
    const tmp = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const apply = (name: string, scale: (s: PlotVisual) => number, color?: (s: PlotVisual) => THREE.ColorRepresentation) => {
      const p = this.parts.get(name);
      if (!p) return;
      let dirty = false;
      p.owner.forEach((i, k) => {
        if (!changed(i)) return;
        const st = states[i]!;
        const s = scale(st);
        if (s <= 0) p.mesh.setMatrixAt(k, ZERO);
        else {
          p.base[k]!.decompose(pos, q, sc);
          p.mesh.setMatrixAt(k, tmp.compose(pos, q, sc.multiplyScalar(s)));
        }
        if (color) p.mesh.setColorAt(k, new THREE.Color(color(st)));
        dirty = true;
      });
      if (dirty) {
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
        p.mesh.computeBoundingSphere();
      }
    };
    apply('soil', () => 1, (s) => (s.wet ? SOIL_WET : SOIL_DRY));
    apply('seed', (s) => (s.stage === 0 ? 1 : 0));
    apply('plant', (s) => (s.stage === null || s.stage === 0 ? 0 : s.stage === 1 ? 0.35 : s.stage === 2 ? 0.75 : 1), (s) => s.leaf);
    apply('bloom', (s) => (s.stage === 3 ? 1 : 0), (s) => new THREE.Color(s.fruit).lerp(new THREE.Color('#ffffff'), 0.45));
    apply('fruit', (s) => (s.stage === 4 ? 1 : 0), (s) => s.fruit);
    apply('weeds', (s) => (s.weeds ? 1 : 0));
    apply('bug', (s) => (s.pests && s.stage !== null && s.stage > 0 ? 1 : 0));
  }

  /** 甲虫在叶子上来回爬 */
  animate(t: number): void {
    const p = this.parts.get('bug');
    if (!p) return;
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    let dirty = false;
    p.owner.forEach((i, k) => {
      const st = this.states[i];
      if (!st?.pests || !st.stage) return;
      p.base[k]!.decompose(pos, q, sc);
      const a = t * 0.8 + k * 2;
      pos.x += Math.sin(a) * 0.08;
      pos.z += Math.cos(a * 0.7) * 0.08;
      q.setFromAxisAngle(up, a + Math.PI / 2);
      p.mesh.setMatrixAt(k, m.compose(pos, q, sc));
      dirty = true;
    });
    if (dirty) p.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
    for (const p of this.parts.values()) p.mesh.geometry.dispose();
    for (const m of this.mats) m.dispose();
    this.parts.clear();
  }
}
