/**
 * 性能 P1 · 树木远景替身（impostor）。
 *
 * 开场时把每个树种的低模用正交相机从侧面渲染进一张图集（4×2 格，每格 256²，带 alpha），
 * 远处的树换成两片十字交叉的面片（4 个三角形，低模树 60–200 个），alphaTest 抠出轮廓。
 * - 烘焙时实例色为白色，运行时与原来一样乘实例色，所以林子的明暗 / 冷暖不变；
 * - 烘焙光照为柔和的顶光 + 环境光，面片法线朝上，运行时 Toon 光照再按昼夜染色；
 * - 只在 LOD1 分块、且分块中心离相机超过 impostorDistance 时使用（近处仍是 3D 低模）。
 */
import * as THREE from 'three';
import type { TreeSpecies } from '../ecology/biome';
import { createFoliageMaterial } from './materials';

export const IMPOSTOR_SPECIES: readonly TreeSpecies[] = ['broadleaf', 'pine', 'birch', 'blossom', 'willow', 'palm', 'windpine'];
const COLS = 4;
const ROWS = 2;
const CELL = 256;

export interface TreeImpostors {
  readonly atlas: THREE.Texture;
  readonly material: THREE.MeshToonMaterial;
  readonly geometry: Record<TreeSpecies, THREE.BufferGeometry>;
  dispose(): void;
}

/** 两片十字交叉的面片：宽 w、高 h，uv 映射到图集第 cell 格 */
export function crossQuadGeometry(w: number, h: number, y0: number, cell: number): THREE.BufferGeometry {
  const cx = cell % COLS;
  const cy = Math.floor(cell / COLS);
  const u0 = cx / COLS;
  const u1 = (cx + 1) / COLS;
  // RenderTarget 纹理 v=0 在底部：第 cy 行从上往下数
  const v0 = 1 - (cy + 1) / ROWS;
  const v1 = 1 - cy / ROWS;
  const hw = w / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const sway: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < 2; k++) {
    const ax = k === 0 ? 1 : 0;
    const az = k === 0 ? 0 : 1;
    const b = pos.length / 3;
    pos.push(-hw * ax, y0, -hw * az, hw * ax, y0, hw * az, hw * ax, y0 + h, hw * az, -hw * ax, y0 + h, -hw * az);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    sway.push(0, 0, 1, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // 法线朝上偏外：远处整片林冠受光均匀（与草的做法一致），细节明暗来自烘焙
  const n: number[] = [];
  for (let i = 0; i < 8; i++) n.push(0, 1, 0);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * 烘焙图集。geometries：每个树种用于烘焙的网格（带顶点色）。
 * 渲染器状态（渲染目标、清屏色、阴影）调用前后保持不变。
 */
export function bakeTreeImpostors(renderer: THREE.WebGLRenderer, geometries: Record<TreeSpecies, THREE.BufferGeometry>): TreeImpostors {
  const rt = new THREE.WebGLRenderTarget(CELL * COLS, CELL * ROWS, { samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.4, 1, 0.8);
  scene.add(sun);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const prev = {
    target: renderer.getRenderTarget(),
    clear: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear,
    shadow: renderer.shadowMap.enabled,
    scissor: renderer.getScissorTest(),
    viewport: renderer.getViewport(new THREE.Vector4()),
  };
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.shadowMap.enabled = false;
  renderer.clear(true, true, true);
  renderer.setScissorTest(true);

  const out = {} as Record<TreeSpecies, THREE.BufferGeometry>;
  IMPOSTOR_SPECIES.forEach((sp, cell) => {
    const geo = geometries[sp];
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 1.04;
    const h = (bb.max.y - Math.min(0, bb.min.y)) * 1.02;
    const y0 = Math.min(0, bb.min.y);
    const size = Math.max(w, h);
    // 正方形格子：按较大边取景，面片按实际宽高裁剪 uv
    cam.left = -size / 2;
    cam.right = size / 2;
    cam.bottom = y0;
    cam.top = y0 + size;
    cam.position.set(0, 0, 50);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const cx = cell % COLS;
    const cy = Math.floor(cell / COLS);
    // 视口原点在左下：第 cy 行（从上数）→ y = (ROWS-1-cy)·CELL
    const vy = (ROWS - 1 - cy) * CELL;
    renderer.setViewport(cx * CELL, vy, CELL, CELL);
    renderer.setScissor(cx * CELL, vy, CELL, CELL);
    renderer.render(scene, cam);
    scene.remove(mesh);
    // 面片与取景同为正方形（边长 = 较大边），树冠外的透明部分由 alphaTest 抠掉
    out[sp] = crossQuadGeometry(size, size, y0, cell);
  });

  renderer.setScissorTest(prev.scissor);
  renderer.setViewport(prev.viewport);
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.clear, prev.alpha);
  renderer.autoClear = prev.autoClear;
  renderer.shadowMap.enabled = prev.shadow;
  mat.dispose();

  const atlas = rt.texture;
  // 渲染目标里是线性颜色（未做输出转换），作为贴图按线性读取
  const material = createFoliageMaterial({ kind: 'tree', fade: null, vertexColors: false, swayScale: 0.06 });
  material.map = atlas;
  material.alphaTest = 0.45;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  material.name = 'tree-impostor';
  return {
    atlas,
    material,
    geometry: out,
    dispose() {
      rt.dispose();
      material.dispose();
      for (const g of Object.values(out)) g.dispose();
    },
  };
}
