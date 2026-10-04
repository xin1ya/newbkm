/**
 * 性能 P1 · 静态合批：把一个对象树里「不单独动」的网格按材质合并成一个网格（每种材质 1 个 draw call）。
 *
 * 规则：
 * - 只合并普通 Mesh（不含 SkinnedMesh / InstancedMesh / Points / Line / Sprite）；
 * - 跳过 userData.dynamic / keepSeparate、带 uTime 等动画句柄、以及描边外壳的网格；
 * - 同一材质至少 2 个才合并；顶点属性取交集（position / normal 必须有，uv / color 全有才保留）；
 * - 变换烘焙为相对 root 的局部坐标，合并后的网格挂在 root 下，原网格移除并释放几何体（共享几何体除外）。
 * 返回减少的 draw call 数。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SKIP_KEYS = ['dynamic', 'keepSeparate', 'uTime', 'outlineHull', 'glow', 'lampHeight', 'poolCollider', 'auraHull'];

function mergeable(m: THREE.Mesh): boolean {
  if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return false;
  if (Array.isArray(m.material)) return false;
  if (m.morphTargetInfluences?.length) return false;
  for (const k of SKIP_KEYS) if (m.userData[k] !== undefined) return false;
  const g = m.geometry;
  return !!g.getAttribute('position') && !!g.getAttribute('normal');
}

/** 祖先链上有 dynamic 标记（会单独动的子树）则整棵子树不合并 */
function underDynamic(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic || p.userData.keepSeparate) return true;
  return false;
}

export function mergeStaticByMaterial(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (o === root || !mergeable(m) || underDynamic(o, root)) return;
    const mat = m.material as THREE.Material;
    const list = groups.get(mat) ?? [];
    list.push(m);
    groups.set(mat, list);
  });
  let saved = 0;
  const dropped = new Set<THREE.BufferGeometry>();
  for (const [mat, all] of groups) {
    // 负缩放会翻转绕序，这类网格保持原样
    const meshes = all.filter((m) => m.matrixWorld.determinant() > 0);
    if (meshes.length < 2) continue;
    const hasUv = meshes.every((m) => !!m.geometry.getAttribute('uv'));
    const hasColor = meshes.every((m) => !!m.geometry.getAttribute('color'));
    const parts = meshes.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) {
        if (name === 'position' || name === 'normal' || (name === 'uv' && hasUv) || (name === 'color' && hasColor)) continue;
        g.deleteAttribute(name);
      }
      g.morphAttributes = {};
      g.clearGroups();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const out = new THREE.Mesh(merged, mat);
    out.name = `batched:${mat.name || mat.type}`;
    const first = meshes[0]!;
    out.castShadow = meshes.some((m) => m.castShadow);
    out.receiveShadow = meshes.some((m) => m.receiveShadow);
    out.layers.mask = first.layers.mask;
    out.renderOrder = first.renderOrder;
    if (meshes.every((m) => m.userData.noShadow)) out.userData.noShadow = true;
    if (meshes.some((m) => m.userData.outline)) out.userData.outline = true;
    out.userData.ownedGeometry = true;
    out.userData.batched = meshes.length;
    for (const m of meshes) {
      m.removeFromParent();
      if (!m.userData.sharedGeometry) dropped.add(m.geometry);
    }
    root.add(out);
    saved += meshes.length - 1;
  }
  // 释放不再被任何网格引用的原几何体
  root.traverse((o) => dropped.delete((o as THREE.Mesh).geometry));
  for (const g of dropped) g.dispose();
  return saved;
}
