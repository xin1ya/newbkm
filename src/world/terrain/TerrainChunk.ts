/**
 * WLD-001 / WLD-004 · 地形块网格。
 * - 覆盖 chunkSize² 米；step = 采样步长（1 = 高度图原始 2 m 分辨率，LOD1 用 4 → 8 m）
 * - 三角剖分方向与 Heightfield.heightAt 一致（对角线 (i,j)-(i+1,j+1)）
 * - 法线取自高度场（跨块连续，接缝处无明暗断层）
 * - 四周加 3 m 下垂的“裙边”，遮住相邻不同 LOD 之间的裂缝
 */
import * as THREE from 'three';
import type { Heightfield } from './Heightfield';

export function buildTerrainGeometry(hf: Heightfield, x0: number, z0: number, sizeM: number, step: number, skirt = 3, drop = 0): THREE.BufferGeometry {
  const cellM = hf.cell * step;
  const segs = Math.max(1, Math.round(sizeM / cellM));
  const vpr = segs + 1;
  const main = vpr * vpr;
  const edge = segs * 4;
  const total = main + edge;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const n = { x: 0, y: 1, z: 0 };
  const i0 = Math.round((x0 + hf.half) / hf.cell);
  const j0 = Math.round((z0 + hf.half) / hf.cell);
  let v = 0;
  for (let j = 0; j < vpr; j++)
    for (let i = 0; i < vpr; i++) {
      const gi = i0 + i * step;
      const gj = j0 + j * step;
      const x = -hf.half + gi * hf.cell;
      const z = -hf.half + gj * hf.cell;
      pos[v * 3] = x;
      pos[v * 3 + 1] = hf.vertexHeight(gi, gj) - drop;
      pos[v * 3 + 2] = z;
      hf.normalAt(x, z, n);
      nor[v * 3] = n.x;
      nor[v * 3 + 1] = n.y;
      nor[v * 3 + 2] = n.z;
      v++;
    }
  const idx: number[] = [];
  for (let j = 0; j < segs; j++)
    for (let i = 0; i < segs; i++) {
      const a = j * vpr + i;
      const b = a + 1;
      const c = a + vpr;
      const d = c + 1;
      // (a,d,b) 与 (a,c,d)：对角线 a-d，正面朝上（逆时针从上看）
      idx.push(a, d, b, a, c, d);
    }
  // 裙边：沿边界顺序复制顶点并下沉
  const ring: number[] = [];
  for (let i = 0; i < segs; i++) ring.push(i); // 上边 j=0
  for (let j = 0; j < segs; j++) ring.push(j * vpr + segs); // 右边
  for (let i = segs; i > 0; i--) ring.push(segs * vpr + i); // 下边
  for (let j = segs; j > 0; j--) ring.push(j * vpr); // 左边
  for (let k = 0; k < ring.length; k++) {
    const src = ring[k]!;
    pos[v * 3] = pos[src * 3]!;
    pos[v * 3 + 1] = pos[src * 3 + 1]! - skirt;
    pos[v * 3 + 2] = pos[src * 3 + 2]!;
    nor[v * 3] = nor[src * 3]!;
    nor[v * 3 + 1] = nor[src * 3 + 1]!;
    nor[v * 3 + 2] = nor[src * 3 + 2]!;
    v++;
  }
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k]!;
    const b = ring[(k + 1) % ring.length]!;
    const sa = main + k;
    const sb = main + ((k + 1) % ring.length);
    idx.push(a, sa, b, b, sa, sb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(total > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
