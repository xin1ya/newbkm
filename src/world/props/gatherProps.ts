/**
 * 计划文档 §9.2 / §9.6 · 野外采集点的低多边形模型（实例化渲染：同类部件合成 1 个 InstancedMesh）：
 * - 树果树：锥形树干 + 3 团多面体树冠（按树果植株配色）+ 挂在树冠外沿的果实（按树果果色；摘完后隐藏，
 *   夜熟的异奇果白天显示为小小的青果）；
 * - 草药丛：一簇尖叶 + 白色小花，采完后只剩矮茬；
 * - 贝壳滩：沙上的扇贝 / 海螺 + 闪光点（只在退潮且可采时出现，涨潮时整体沉进水下）；
 * - 蘑菇圈：7 朵大小不一的红伞白点蘑菇围成一圈，夜里中间冒出发青光的蘑菇；
 * - 矿点：多面体岩石 + 蓝色晶簇（敲完后晶簇消失）；
 * - 蜂蜜树：粗树干 + 树洞 + 挂着的蜂巢（取蜜后蜂巢变暗），涂过甜甜蜜的树干上有发亮的蜜痕。
 * 部件全部是顶点色 + 实例色，平面着色（与 Tripo 草模的低多边形切面风格一致）。总计 13 个 draw call。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '@/render';
import type { GatherKind, GatherPointDef } from '@/systems/gathering';
import type { CollisionWorld } from '@/world/collision/CollisionWorld';

/** 每个采集点的显示状态（SceneGather 每秒同步） */
export interface GatherVisual {
  /** 可采（树果挂满 / 草药茂盛 / 晶簇在 / 蜂巢满） */
  ready: boolean;
  /** 贝壳：退潮露出 */
  exposed?: boolean;
  /** 树果：未成熟（夜熟树果在白天） */
  unripe?: boolean;
  /** 蜂蜜树：涂了甜甜蜜 */
  honeyed?: boolean;
  /** 蘑菇圈：夜里的发光蘑菇 */
  glow?: boolean;
}

export interface GatherFieldDeps {
  parent: THREE.Object3D;
  heightAt(x: number, z: number): number;
  collision: CollisionWorld;
  /** 树果 id → 果色 / 叶色 */
  berryColor(id: string): { fruit: string; leaf: string };
}

const COLLIDER_GROUP = 'gather';
const FRUITS_PER_TREE = 9;
const GLINT_PER_SHELL = 2;

/** 稳定伪随机（点 id + 序号），保证每次加载外观一致 */
function rand(id: string, i: number): number {
  let h = 2166136261 ^ (i * 374761393);
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619);
  h ^= h >>> 15;
  return ((Math.imul(h, 2246822519) >>> 0) % 100000) / 100000;
}

/** 给几何体刷顶点色并转成非索引（平面着色的切面感） */
export function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  const n = ng.attributes.position!.count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (jitter ? (((i * 7919) % 97) / 97 - 0.5) * jitter : 0);
    for (let v = 0; v < 3 && i + v < n; v++) {
      arr[(i + v) * 3] = c.r * k;
      arr[(i + v) * 3 + 1] = c.g * k;
      arr[(i + v) * 3 + 2] = c.b * k;
    }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  return ng;
}

export function jitterVerts(g: THREE.BufferGeometry, amt: number, seed: number): THREE.BufferGeometry {
  const p = g.attributes.position!;
  // 同位置顶点同样偏移（保持闭合）
  const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const off = new Map<string, [number, number, number]>();
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * amt;
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    let o = off.get(k);
    if (!o) off.set(k, (o = [r(), r(), r()]));
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  return g;
}

export const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0): THREE.BufferGeometry => {
  g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
};

// ———————————————————— 部件几何 ————————————————————

function treeTrunkGeo(): THREE.BufferGeometry {
  const trunk = at(new THREE.CylinderGeometry(0.16, 0.26, 1.7, 6, 2), 0, 0.85, 0);
  const root1 = at(new THREE.ConeGeometry(0.14, 0.5, 4), 0.22, 0.12, 0, 1, 1, 1, 0, 0, -1.1);
  const root2 = at(new THREE.ConeGeometry(0.12, 0.45, 4), -0.15, 0.1, 0.17, 1, 1, 1, 0.8, 0.9, 0.6);
  const branch = at(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5), 0.25, 1.45, 0.05, 1, 1, 1, 0, 0, -0.9);
  return mergeGeometries([paint(trunk, '#8a5a34', 0.15), paint(root1, '#7a4e2c'), paint(root2, '#7a4e2c'), paint(branch, '#8a5a34')])!;
}

/** 树冠：白偏绿的顶点色，实例色乘上植株叶色 */
function treeCanopyGeo(): THREE.BufferGeometry {
  const parts = [
    at(jitterVerts(new THREE.IcosahedronGeometry(0.85, 1), 0.08, 11), 0, 2.2, 0, 1.1, 0.85, 1.1),
    at(jitterVerts(new THREE.IcosahedronGeometry(0.6, 1), 0.07, 23), 0.55, 1.95, 0.25),
    at(jitterVerts(new THREE.IcosahedronGeometry(0.58, 1), 0.07, 37), -0.45, 2.0, -0.35),
    at(jitterVerts(new THREE.IcosahedronGeometry(0.5, 0), 0.05, 41), 0.05, 2.75, 0.1),
  ];
  return mergeGeometries(parts.map((g, i) => paint(g, i === 3 ? '#f4ffe8' : '#e6f2dc', 0.18)))!;
}

/** 单个树果（实例色 = 果色）：多面体 + 小叶柄 */
export function fruitGeo(): THREE.BufferGeometry {
  const f = at(new THREE.IcosahedronGeometry(0.13, 0), 0, 0, 0, 1, 1.1, 1);
  const stem = at(new THREE.CylinderGeometry(0.012, 0.018, 0.1, 4), 0, 0.15, 0);
  const leaf = at(new THREE.ConeGeometry(0.05, 0.12, 3), 0.05, 0.18, 0, 1, 1, 0.3, 0, 0, -1);
  return mergeGeometries([paint(f, '#ffffff', 0.12), paint(stem, '#5a3a20'), paint(leaf, '#4f9a48')])!;
}

function herbGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = 0.45 + (i % 3) * 0.12;
    const blade = at(new THREE.ConeGeometry(0.07, len, 3), Math.sin(a) * 0.12, len / 2, Math.cos(a) * 0.12, 1, 1, 0.35, a, 0.35 + (i % 2) * 0.15);
    parts.push(paint(blade, i % 2 ? '#5fbf5a' : '#4aa04f', 0.15));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    parts.push(paint(at(new THREE.IcosahedronGeometry(0.06, 0), Math.sin(a) * 0.2, 0.62 + i * 0.05, Math.cos(a) * 0.2), '#fbf6e0'));
    parts.push(paint(at(new THREE.IcosahedronGeometry(0.025, 0), Math.sin(a) * 0.2, 0.68 + i * 0.05, Math.cos(a) * 0.2), '#f2c230'));
  }
  return mergeGeometries(parts)!;
}

function shellGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 扇贝：压扁的半锥（6 棱 = 扇面肋纹）
  const scallop = (x: number, z: number, ry: number, s: number, c: string) =>
    parts.push(paint(at(new THREE.ConeGeometry(0.16, 0.06, 7, 1, false, 0, Math.PI), x, 0.03, z, s, s, s, ry), c, 0.2));
  scallop(0, 0, 0.3, 1, '#f7c9b0');
  scallop(0.32, 0.18, 2.1, 0.8, '#f4e2d0');
  scallop(-0.25, 0.28, -1.2, 0.7, '#f59ab8');
  // 海螺：拉长的锥
  parts.push(paint(at(new THREE.ConeGeometry(0.07, 0.24, 5), -0.1, 0.05, -0.3, 1, 1, 1, 0.5, 0, Math.PI / 2), '#e8d0a8', 0.2));
  parts.push(paint(at(new THREE.ConeGeometry(0.05, 0.18, 5), 0.28, 0.04, -0.2, 1, 1, 1, -0.8, 0, Math.PI / 2), '#d9907a', 0.2));
  return mergeGeometries(parts)!;
}

function glintGeo(): THREE.BufferGeometry {
  // 四角星闪光（两片交叉的菱形）
  const a = at(new THREE.OctahedronGeometry(0.09, 0), 0, 0, 0, 0.35, 1.6, 0.35);
  const b = at(new THREE.OctahedronGeometry(0.09, 0), 0, 0, 0, 1.6, 0.35, 0.35);
  return mergeGeometries([paint(a, '#ffffff'), paint(b, '#ffffff')])!;
}

function mushroomRingGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.7 + (i % 2) * 0.12;
    const s = 0.75 + ((i * 37) % 10) / 20;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    parts.push(paint(at(new THREE.CylinderGeometry(0.05, 0.07, 0.24, 5), x, 0.12 * s, z, s), '#f3ead6'));
    parts.push(paint(at(new THREE.SphereGeometry(0.17, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.22 * s, z, s, s * 0.85, s), i % 3 === 2 ? '#c96a2a' : '#e8484a', 0.12));
    for (let d = 0; d < 3; d++) {
      const da = a + d * 2.1;
      parts.push(paint(at(new THREE.IcosahedronGeometry(0.03, 0), x + Math.sin(da) * 0.09 * s, 0.33 * s, z + Math.cos(da) * 0.09 * s, s), '#ffffff'));
    }
  }
  // 中间的苔藓垫
  parts.push(paint(at(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 7), 0, 0.02, 0), '#5f8a3a', 0.2));
  return mergeGeometries(parts)!;
}

function glowMushroomGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    const x = Math.sin(a) * 0.2;
    const z = Math.cos(a) * 0.2;
    parts.push(paint(at(new THREE.CylinderGeometry(0.03, 0.045, 0.28, 5), x, 0.14, z), '#d8fbff'));
    parts.push(paint(at(new THREE.SphereGeometry(0.11, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.27, z), '#5ad6e0'));
  }
  return mergeGeometries(parts)!;
}

function oreRockGeo(): THREE.BufferGeometry {
  const a = at(jitterVerts(new THREE.IcosahedronGeometry(0.9, 1), 0.14, 101), 0, 0.5, 0, 1.25, 0.85, 1.05);
  const b = at(jitterVerts(new THREE.IcosahedronGeometry(0.5, 0), 0.08, 131), 0.85, 0.25, 0.35);
  const c = at(jitterVerts(new THREE.IcosahedronGeometry(0.35, 0), 0.06, 151), -0.7, 0.18, -0.55);
  return mergeGeometries([paint(a, '#8d8a84', 0.22), paint(b, '#7a776f', 0.2), paint(c, '#9a968c', 0.2)])!;
}

function oreCrystalGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spikes: Array<[number, number, number, number, number, number]> = [
    [0.35, 1.05, 0.25, 0.4, -0.35, 0.2],
    [0.15, 1.15, 0.05, 0.55, 0.1, -0.15],
    [0.5, 0.95, -0.05, 0.32, 0.25, 0.55],
    [-0.45, 0.85, 0.4, 0.36, -0.5, -0.3],
    [0.95, 0.45, 0.45, 0.28, 0.6, 0.7],
  ];
  spikes.forEach(([x, y, z, s, rx, rz], i) => parts.push(paint(at(new THREE.OctahedronGeometry(0.16, 0), x, y, z, s * 0.9, s * 2.4, s * 0.9, i, rx, rz), i % 2 ? '#7fd0ff' : '#a8e6ff')));
  return mergeGeometries(parts)!;
}

function honeyTreeGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(at(new THREE.CylinderGeometry(0.32, 0.5, 3.0, 7, 3), 0, 1.5, 0), '#6e4a2c', 0.18));
  parts.push(paint(at(new THREE.SphereGeometry(0.18, 6, 4), 0, 1.25, 0.36, 1, 1.4, 0.4), '#2a1a10')); // 树洞
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    parts.push(paint(at(new THREE.ConeGeometry(0.2, 0.7, 4), Math.sin(a) * 0.45, 0.15, Math.cos(a) * 0.45, 1, 1, 1, a, Math.cos(a) * 1.1, -Math.sin(a) * 1.1), '#5e3e24'));
  }
  parts.push(paint(at(new THREE.CylinderGeometry(0.07, 0.11, 1.2, 5), 0.55, 2.6, 0, 1, 1, 1, 0, 0, -1.0), '#6e4a2c'));
  const leaves = [
    at(jitterVerts(new THREE.IcosahedronGeometry(1.25, 1), 0.12, 201), 0, 3.6, 0, 1.15, 0.8, 1.15),
    at(jitterVerts(new THREE.IcosahedronGeometry(0.8, 1), 0.1, 211), 0.9, 3.2, 0.3),
    at(jitterVerts(new THREE.IcosahedronGeometry(0.75, 1), 0.1, 223), -0.8, 3.3, -0.4),
  ];
  for (const l of leaves) parts.push(paint(l, '#3f7a3a', 0.2));
  return mergeGeometries(parts)!;
}

function hiveGeo(): THREE.BufferGeometry {
  // 挂在侧枝下的蜂巢：3 层叠起的多面体 + 吊绳；实例色控制满 / 空
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(at(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), 0, 0.2, 0), '#4a3020'));
  parts.push(paint(at(new THREE.SphereGeometry(0.26, 7, 4), 0, -0.05, 0, 1, 0.55, 1), '#f2b541', 0.15));
  parts.push(paint(at(new THREE.SphereGeometry(0.3, 7, 4), 0, -0.25, 0, 1, 0.55, 1), '#e8a030', 0.15));
  parts.push(paint(at(new THREE.SphereGeometry(0.22, 7, 4), 0, -0.45, 0, 1, 0.55, 1), '#f2b541', 0.15));
  parts.push(paint(at(new THREE.CircleGeometry(0.06, 6), 0, -0.27, 0.3), '#3a2412'));
  return mergeGeometries(parts)!;
}

function honeySmearGeo(): THREE.BufferGeometry {
  // 涂在树干上的蜜痕（几道往下流的蜜滴）
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -0.6 + i * 0.4;
    const len = 0.3 + (i % 2) * 0.25;
    parts.push(paint(at(new THREE.CapsuleGeometry(0.045, len, 2, 5), Math.sin(a) * 0.4, 1.55 - len / 2, Math.cos(a) * 0.4), '#f6c445'));
  }
  return mergeGeometries(parts)!;
}

// ———————————————————— 实例化场 ————————————————————

interface Part {
  mesh: THREE.InstancedMesh;
  /** 每个实例的基准矩阵（隐藏时缩放为 0） */
  base: THREE.Matrix4[];
  owner: number[];
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class GatherField {
  readonly root = new THREE.Group();
  private parts = new Map<string, Part>();
  private mats: THREE.Material[] = [];
  private indexOf = new Map<string, number>();
  private yOf: number[] = [];
  private glintPhase: number[] = [];

  constructor(
    readonly defs: readonly GatherPointDef[],
    private readonly d: GatherFieldDeps,
  ) {
    this.root.name = 'gather-points';
    defs.forEach((def, i) => {
      this.indexOf.set(def.id, i);
      this.yOf.push(d.heightAt(def.position[0], def.position[1]));
    });
    const plain = createToonMaterial({ kind: 'scene', vertexColors: true, name: 'gather' });
    const glow = createToonMaterial({ kind: 'scene', vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.55, name: 'gather-glow' });
    const glint = new THREE.MeshBasicMaterial({ color: 0xfff8d8, transparent: true, opacity: 0.9, depthWrite: false, fog: true });
    this.mats.push(plain, glow, glint);

    const of = (k: GatherKind) => defs.map((x, i) => (x.kind === k ? i : -1)).filter((i) => i >= 0);
    const yawOf = (i: number) => rand(defs[i]!.id, 0) * Math.PI * 2;
    const m4 = (i: number, dx = 0, dy = 0, dz = 0, s = 1, yaw = yawOf(i)): THREE.Matrix4 => {
      const [x, z] = defs[i]!.position;
      const off = new THREE.Vector3(dx, dy, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      return new THREE.Matrix4().compose(new THREE.Vector3(x + off.x, this.yOf[i]! + off.y, z + off.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
    };

    // 树果树
    const trees = of('berryTree');
    const treeScale = (i: number) => 0.9 + rand(defs[i]!.id, 1) * 0.3;
    this.addPart('trunk', treeTrunkGeo(), plain, trees.map((i) => ({ owner: i, m: m4(i, 0, -0.05, 0, treeScale(i)) })));
    this.addPart(
      'canopy',
      treeCanopyGeo(),
      plain,
      trees.map((i) => ({ owner: i, m: m4(i, 0, -0.05, 0, treeScale(i)), c: new THREE.Color(d.berryColor(defs[i]!.berry ?? '').leaf) })),
    );
    const fruits: Array<{ owner: number; m: THREE.Matrix4; c: THREE.Color }> = [];
    for (const i of trees) {
      const s = treeScale(i);
      const col = new THREE.Color(d.berryColor(defs[i]!.berry ?? '').fruit);
      for (let k = 0; k < FRUITS_PER_TREE; k++) {
        // 树冠外沿（主团 + 两侧团），偏下半球，像挂在枝头
        const a = rand(defs[i]!.id, 10 + k) * Math.PI * 2;
        const lift = 1.75 + rand(defs[i]!.id, 30 + k) * 0.75;
        const rr = 0.95 + rand(defs[i]!.id, 50 + k) * 0.2;
        fruits.push({ owner: i, m: m4(i, Math.cos(a) * rr * s, lift * s, Math.sin(a) * rr * s, s), c: col });
      }
    }
    this.addPart('fruit', fruitGeo(), plain, fruits);

    // 草药丛
    this.addPart('herb', herbGeo(), plain, of('herb').map((i) => ({ owner: i, m: m4(i, 0, -0.02, 0, 1.15) })));
    // 贝壳
    const shells = of('shell');
    this.addPart('shell', shellGeo(), plain, shells.map((i) => ({ owner: i, m: m4(i, 0, 0.0, 0, 1.4) })));
    const glints: Array<{ owner: number; m: THREE.Matrix4 }> = [];
    for (const i of shells) for (let k = 0; k < GLINT_PER_SHELL; k++) glints.push({ owner: i, m: m4(i, k ? 0.35 : -0.1, 0.35 + k * 0.1, k ? 0.15 : -0.05, 1) });
    this.addPart('glint', glintGeo(), glint, glints);
    this.glintPhase = glints.map((g, k) => rand(defs[g.owner]!.id, 70 + k) * Math.PI * 2);
    // 蘑菇圈
    const mush = of('mushroom');
    this.addPart('mushroom', mushroomRingGeo(), plain, mush.map((i) => ({ owner: i, m: m4(i, 0, -0.02, 0, 1.2) })));
    this.addPart('glowshroom', glowMushroomGeo(), glow, mush.map((i) => ({ owner: i, m: m4(i, 0, -0.02, 0, 1.2) })));
    // 矿点
    const ore = of('ore');
    this.addPart('rock', oreRockGeo(), plain, ore.map((i) => ({ owner: i, m: m4(i, 0, -0.15, 0, 1) })));
    this.addPart('crystal', oreCrystalGeo(), glow, ore.map((i) => ({ owner: i, m: m4(i, 0, -0.15, 0, 1) })));
    // 蜂蜜树
    const honey = of('honey');
    this.addPart('honeytree', honeyTreeGeo(), plain, honey.map((i) => ({ owner: i, m: m4(i, 0, -0.1, 0, 1) })));
    this.addPart('hive', hiveGeo(), plain, honey.map((i) => ({ owner: i, m: m4(i, 0.95, 2.05, 0, 1) })));
    this.addPart('smear', honeySmearGeo(), glow, honey.map((i) => ({ owner: i, m: m4(i, 0, -0.1, 0, 1) })));

    // 碰撞：树干 / 岩石 / 蜂蜜树挡路；草药与蘑菇圈中心也给一个小圆，避免植被长进去
    const R: Partial<Record<GatherKind, number>> = { berryTree: 0.4, honey: 0.6, ore: 1.05, herb: 0.3, mushroom: 0.25 };
    defs.forEach((def, i) => {
      const r = R[def.kind];
      if (r === undefined) return;
      const y = this.yOf[i]!;
      d.collision.add(COLLIDER_GROUP, { kind: 'circle', x: def.position[0], z: def.position[1], r, y0: y - 1, y1: y + (def.kind === 'herb' || def.kind === 'mushroom' ? 0.4 : 3), tag: 'gather' });
    });
    d.parent.add(this.root);
  }

  private addPart(name: string, geo: THREE.BufferGeometry, mat: THREE.Material, items: Array<{ owner: number; m: THREE.Matrix4; c?: THREE.Color }>): void {
    if (!items.length) {
      geo.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.userData.dynamicInstances = true; // 矩阵按状态重写：战斗领域隐藏遮挡物时跳过
    mesh.name = `gather-${name}`;
    mesh.castShadow = name !== 'glint' && name !== 'smear';
    mesh.receiveShadow = true;
    items.forEach((it, k) => {
      mesh.setMatrixAt(k, it.m);
      if (it.c) mesh.setColorAt(k, it.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.root.add(mesh);
    this.parts.set(name, { mesh, base: items.map((i) => i.m), owner: items.map((i) => i.owner) });
  }

  /** 提示气泡的世界高度 */
  promptY(def: GatherPointDef): number {
    const y = this.yOf[this.indexOf.get(def.id) ?? 0] ?? 0;
    return y + ({ berryTree: 3.1, honey: 3.0, ore: 1.6, herb: 1.0, shell: 0.7, mushroom: 0.8 } as const)[def.kind];
  }

  groundY(def: GatherPointDef): number {
    return this.yOf[this.indexOf.get(def.id) ?? 0] ?? 0;
  }

  private states: GatherVisual[] = [];

  /** 同步显示状态（只在变化时写实例矩阵） */
  sync(states: readonly GatherVisual[]): void {
    const prev = this.states;
    this.states = states.map((s) => ({ ...s }));
    const changed = (i: number) => {
      const a = prev[i];
      const b = states[i]!;
      return !a || a.ready !== b.ready || a.exposed !== b.exposed || a.unripe !== b.unripe || a.honeyed !== b.honeyed || a.glow !== b.glow;
    };
    const tmp = new THREE.Matrix4();
    const apply = (name: string, f: (s: GatherVisual, k: number) => number) => {
      const p = this.parts.get(name);
      if (!p) return;
      let dirty = false;
      p.owner.forEach((i, k) => {
        if (!changed(i)) return;
        const sc = f(states[i]!, k);
        if (sc <= 0) p.mesh.setMatrixAt(k, ZERO);
        else if (sc === 1) p.mesh.setMatrixAt(k, p.base[k]!);
        else {
          // 原地缩小（以底部为中心）
          const pos = new THREE.Vector3();
          const q = new THREE.Quaternion();
          const s = new THREE.Vector3();
          p.base[k]!.decompose(pos, q, s);
          p.mesh.setMatrixAt(k, tmp.compose(pos, q, s.multiplyScalar(sc)));
        }
        dirty = true;
      });
      if (dirty) {
        p.mesh.instanceMatrix.needsUpdate = true;
        p.mesh.computeBoundingSphere();
      }
    };
    // 夜熟树果白天：只挂 3 个小青果
    apply('fruit', (s, k) => (!s.ready ? 0 : s.unripe ? (k % FRUITS_PER_TREE < 3 ? 0.55 : 0) : 1));
    const fruit = this.parts.get('fruit');
    if (fruit?.mesh.instanceColor) {
      let dirty = false;
      fruit.owner.forEach((i, k) => {
        if (!changed(i)) return;
        const def = this.defs[i]!;
        fruit.mesh.setColorAt(k, new THREE.Color(states[i]!.unripe ? '#8fbf5a' : this.d.berryColor(def.berry ?? '').fruit));
        dirty = true;
      });
      if (dirty) fruit.mesh.instanceColor.needsUpdate = true;
    }
    apply('herb', (s) => (s.ready ? 1 : 0.35));
    apply('shell', (s) => (s.exposed ? 1 : 0));
    apply('glint', (s) => (s.exposed && s.ready ? 1 : 0));
    apply('glowshroom', (s) => (s.glow && s.ready ? 1 : 0));
    apply('mushroom', (s) => (s.ready ? 1 : 0.55));
    apply('crystal', (s) => (s.ready ? 1 : 0));
    apply('smear', (s) => (s.honeyed ? 1 : 0));
    const hive = this.parts.get('hive');
    if (hive) {
      let dirty = false;
      hive.owner.forEach((i, k) => {
        if (!changed(i)) return;
        hive.mesh.setColorAt(k, new THREE.Color(states[i]!.ready ? '#ffffff' : '#8a7a6a'));
        dirty = true;
      });
      if (dirty && hive.mesh.instanceColor) hive.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** 闪光点旋转 / 明灭（只有贝壳闪光，实例很少） */
  animate(t: number): void {
    const p = this.parts.get('glint');
    if (!p) return;
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    let dirty = false;
    p.owner.forEach((i, k) => {
      const st = this.states[i];
      if (!st?.exposed || !st.ready) return;
      p.base[k]!.decompose(pos, q, s);
      const ph = this.glintPhase[k]!;
      const pulse = Math.max(0, Math.sin(t * 2.2 + ph));
      q.setFromAxisAngle(up, t * 1.5 + ph);
      s.setScalar(0.25 + pulse * 0.9);
      p.mesh.setMatrixAt(k, m.compose(pos, q, s));
      dirty = true;
    });
    if (dirty) p.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.d.collision.removeGroup(COLLIDER_GROUP);
    this.d.parent.remove(this.root);
    for (const p of this.parts.values()) p.mesh.geometry.dispose();
    for (const m of this.mats) m.dispose();
    this.parts.clear();
  }
}
