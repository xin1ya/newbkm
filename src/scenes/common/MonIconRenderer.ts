/**
 * 宝可梦头像渲染器：用独立的离屏 WebGL 渲染器把手工 3D 模型（idle 姿势、3/4 侧面）拍成透明背景缩略图，
 * 缓存为 dataURL，供菜单 / 图鉴 / 存档页 / 战斗换人菜单显示（ui/menu/common.ts 的 MonIconProvider）。
 * - 串行渲染（一个队列），首次打开菜单时逐个出图，之后同步命中缓存；
 * - 没有手工模型（只有灰模）的物种返回 null，界面保留属性色徽标；
 * - 异色个体单独缓存。
 */
import * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import { createPokemon } from '@/systems/pokemon';
import { createRng } from '@/systems/rng';
import { createMonModel, disposeMonModel, hasMonModel, monModelReady, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';

export class MonIconRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  private readonly cache = new Map<string, string | null>();
  private readonly pending = new Map<string, Promise<string | null>>();
  private chain: Promise<unknown> = Promise.resolve();
  private failed = false;

  constructor(
    private readonly dex: Dex,
    private readonly size = 160,
  ) {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d8, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 5);
    const rim = new THREE.DirectionalLight(0xcfe8ff, 1.2);
    rim.position.set(-3, 2, -4);
    this.scene.add(key, rim);
  }

  private key(id: number, shiny: boolean): string {
    return `${id}${shiny ? 's' : ''}`;
  }

  peek(speciesId: number, shiny: boolean): string | null {
    return this.cache.get(this.key(speciesId, shiny)) ?? null;
  }

  request(speciesId: number, shiny: boolean): Promise<string | null> {
    const k = this.key(speciesId, shiny);
    if (this.cache.has(k)) return Promise.resolve(this.cache.get(k) ?? null);
    const p0 = this.pending.get(k);
    if (p0) return p0;
    if (this.failed || !hasMonModel(speciesId) || !this.dex.hasSpecies(speciesId)) {
      this.cache.set(k, null);
      return Promise.resolve(null);
    }
    const p = this.chain.then(() => this.render(speciesId, shiny)).catch((err: unknown) => {
      console.warn('[mon-icon] 渲染失败', speciesId, err);
      return null;
    });
    this.chain = p;
    this.pending.set(k, p);
    void p.then((url) => {
      this.cache.set(k, url);
      this.pending.delete(k);
    });
    return p;
  }

  private ensureRenderer(): THREE.WebGLRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      const canvas = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(this.size, this.size, false);
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = r;
      return r;
    } catch (err) {
      console.warn('[mon-icon] 无法创建离屏渲染器，使用属性色徽标', err);
      this.failed = true;
      return null;
    }
  }

  private async render(speciesId: number, shiny: boolean): Promise<string | null> {
    const r = this.ensureRenderer();
    if (!r) return null;
    const p = createPokemon(this.dex, speciesId, 5, createRng(speciesId), { shiny });
    const root = createMonModel(this.dex, p, { height: 1 });
    try {
      if (!(await monModelReady(root))) return null;
      setMonLoop(root, 'idle');
      updateMonModel(root, 0.35);
      // 3/4 侧面朝向镜头（模型正面 = +Z）
      root.rotation.y = 0.5;
      this.scene.add(root);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) return null;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const half = Math.max(size.y, Math.max(size.x, size.z) * 0.9) * 0.5;
      const dist = (half / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.12;
      this.camera.position.set(center.x, center.y + size.y * 0.12, center.z + dist);
      this.camera.lookAt(center);
      this.camera.near = Math.max(0.01, dist - size.z * 2);
      this.camera.far = dist + size.z * 4 + 10;
      this.camera.updateProjectionMatrix();
      r.render(this.scene, this.camera);
      return r.domElement.toDataURL('image/png');
    } finally {
      root.removeFromParent();
      disposeMonModel(root);
    }
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
