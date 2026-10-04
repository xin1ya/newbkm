import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { animLodFor } from '@/world/spawns/SpawnManager';
import { boxOccluded, HorizonCuller, pointOccluded, type CullTarget } from '@/world/streaming/HorizonCuller';
import type { Heightfield } from '@/world/terrain/Heightfield';
import { crossQuadGeometry } from '@/world/foliage/impostors';
import { grassClumpGeometry } from '@/world/foliage/geometries';
import { mergeStaticByMaterial } from '@/render/batch';

/** 假高度场：x 在 [40, 60] 之间有一道 30 m 高的山脊，其余为 0 */
const ridge = { inBounds: () => true, heightAt: (x: number) => (x > 40 && x < 60 ? 30 : 0) } as unknown as Heightfield;

describe('性能 P1 · 野生宝可梦动画 LOD', () => {
  it('30 / 60 m 分档，±3 m 滞回', () => {
    expect(animLodFor(0, 10)).toBe(0);
    expect(animLodFor(0, 32)).toBe(0);
    expect(animLodFor(0, 34)).toBe(1);
    expect(animLodFor(1, 28)).toBe(1);
    expect(animLodFor(1, 26)).toBe(0);
    expect(animLodFor(1, 64)).toBe(2);
    expect(animLodFor(2, 58)).toBe(2);
    expect(animLodFor(2, 56)).toBe(1);
  });
});

describe('性能 P1 · 地平线遮挡剔除', () => {
  const eye = new THREE.Vector3(0, 2, 0);
  it('山脊背后的低点被挡，高点 / 山脊前的点可见', () => {
    expect(pointOccluded(ridge, eye, 120, 1, 0)).toBe(true);
    expect(pointOccluded(ridge, eye, 120, 200, 0)).toBe(false);
    expect(pointOccluded(ridge, eye, 30, 1, 0)).toBe(false);
    expect(pointOccluded(ridge, eye, 10, 1, 0)).toBe(false); // 太近不判
  });

  it('包围盒顶面 9 点全被挡才算不可见', () => {
    expect(boxOccluded(ridge, eye, new THREE.Box3(new THREE.Vector3(100, 0, -20), new THREE.Vector3(160, 10, 20)))).toBe(true);
    expect(boxOccluded(ridge, eye, new THREE.Box3(new THREE.Vector3(100, 0, -20), new THREE.Vector3(160, 120, 20)))).toBe(false);
    // 跨过山脊的盒子（一部分在山脊前）可见
    expect(boxOccluded(ridge, eye, new THREE.Box3(new THREE.Vector3(20, 0, -20), new THREE.Vector3(140, 10, 20)))).toBe(false);
  });

  it('连续 2 次判定才隐藏；pinned 永不隐藏；reset 恢复', () => {
    const c = new HorizonCuller(ridge);
    const obj = new THREE.Object3D();
    const pinnedObj = new THREE.Object3D();
    const box = new THREE.Box3(new THREE.Vector3(100, 0, -20), new THREE.Vector3(160, 10, 20));
    const t: CullTarget = { box, objects: [obj] };
    const p: CullTarget = { box: box.clone(), objects: [pinnedObj], pinned: true };
    c.update(1, eye, [t, p]);
    expect(obj.visible).toBe(true);
    c.update(1, eye, [t, p]);
    expect(obj.visible).toBe(false);
    expect(pinnedObj.visible).toBe(true);
    expect(c.culled).toBe(1);
    HorizonCuller.reset([t]);
    expect(obj.visible).toBe(true);
  });
});

describe('性能 P1 · 植被', () => {
  it('远景草簇三角面约为近处的 1/5 以下', () => {
    const near = grassClumpGeometry().index!.count / 3;
    const far = grassClumpGeometry(3, 1).index!.count / 3;
    expect(near).toBe(30);
    expect(far).toBe(6);
  });

  it('树木替身：两片十字面片，uv 落在图集对应格', () => {
    const g = crossQuadGeometry(4, 4, 0, 5);
    expect(g.index!.count).toBe(12);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0.25 - 1e-6);
      expect(uv.getX(i)).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(uv.getY(i)).toBeLessThanOrEqual(0.5 + 1e-6);
    }
    expect(g.getAttribute('aSway')).toBeTruthy();
  });
});

describe('性能 P1 · 静态合批', () => {
  it('同材质合并，动态 / 带动画句柄的零件保留', () => {
    const root = new THREE.Group();
    const a = new THREE.MeshBasicMaterial();
    const b = new THREE.MeshBasicMaterial();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), a);
      m.position.x = i * 2;
      root.add(m);
    }
    root.add(new THREE.Mesh(new THREE.SphereGeometry(1), b));
    const anim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), a);
    anim.userData.uTime = { value: 0 };
    root.add(anim);
    const saved = mergeStaticByMaterial(root);
    expect(saved).toBe(3);
    const meshes = root.children as THREE.Mesh[];
    expect(meshes.length).toBe(3);
    const merged = meshes.find((m) => m.userData.batched)!;
    expect(merged.userData.batched).toBe(4);
    merged.geometry.computeBoundingBox();
    expect(merged.geometry.boundingBox!.max.x).toBeCloseTo(6.5);
    expect(meshes.includes(anim)).toBe(true);
  });
});
