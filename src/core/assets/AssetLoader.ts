/**
 * ENG-008 · 资源加载。
 * - glTF/GLB：Draco 与 Meshopt 压缩几何、KTX2（Basis）纹理；解码器随构建发布（assets/_decoders/，不走 CDN）
 * - 缓存：同一路径只加载一次，返回克隆（SkeletonUtils.clone 保留骨骼绑定）
 * - 进度：按“已完成/总数 + 当前文件字节进度”汇总，供加载界面使用
 * - 失败回退：模型缺失或解析失败时返回灰模占位（设计 §6.3：统一胶囊体 + 名字标签），并记录警告，不中断游戏
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AssetsApi } from '@/platform';
import { createPlaceholder, type PlaceholderOptions } from './placeholders';

export interface LoadProgress {
  loaded: number;
  total: number;
  /** 0–1 */
  ratio: number;
  current: string | null;
  failed: string[];
}

export interface ModelAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  /** true = 灰模占位 */
  placeholder: boolean;
}

export class AssetLoader {
  private gltf: GLTFLoader;
  private draco: DRACOLoader;
  private ktx2: KTX2Loader;
  private texLoader = new THREE.TextureLoader();
  private models = new Map<string, Promise<GLTF | null>>();
  private textures = new Map<string, Promise<THREE.Texture | null>>();
  private buffers = new Map<string, Promise<ArrayBuffer>>();
  private progress: LoadProgress = { loaded: 0, total: 0, ratio: 1, current: null, failed: [] };
  private fileProgress = new Map<string, number>();
  private listeners = new Set<(p: LoadProgress) => void>();

  constructor(
    private readonly assets: AssetsApi,
    renderer?: THREE.WebGLRenderer,
  ) {
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(assets.url('_decoders/draco/'));
    this.ktx2 = new KTX2Loader();
    this.ktx2.setTranscoderPath(assets.url('_decoders/basis/'));
    if (renderer) this.ktx2.detectSupport(renderer);
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
    this.gltf.setKTX2Loader(this.ktx2);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
  }

  /** 渲染器创建之后再调用，KTX2 需要根据 GPU 选择转码格式 */
  bindRenderer(renderer: THREE.WebGLRenderer): void {
    this.ktx2.detectSupport(renderer);
  }

  onProgress(fn: (p: LoadProgress) => void): () => void {
    this.listeners.add(fn);
    fn(this.progress);
    return () => this.listeners.delete(fn);
  }

  get state(): LoadProgress {
    return this.progress;
  }

  private track<T>(path: string, p: Promise<T>): Promise<T> {
    this.progress.total++;
    this.progress.current = path;
    this.fileProgress.set(path, 0);
    this.emit();
    return p.finally(() => {
      this.progress.loaded++;
      this.fileProgress.delete(path);
      if (this.progress.loaded >= this.progress.total) this.progress.current = null;
      this.emit();
    });
  }

  private emit(): void {
    const partial = [...this.fileProgress.values()].reduce((a, b) => a + b, 0);
    const p = this.progress;
    p.ratio = p.total === 0 ? 1 : Math.min(1, (p.loaded + partial) / p.total);
    for (const fn of this.listeners) fn(p);
  }

  /** 加载 glTF；失败返回 null（调用方可回退占位） */
  loadGltf(path: string): Promise<GLTF | null> {
    let p = this.models.get(path);
    if (!p) {
      p = this.track(
        path,
        new Promise<GLTF | null>((resolve) => {
          this.gltf.load(
            this.assets.url(path),
            (g) => resolve(g),
            (e) => {
              if (e.lengthComputable) {
                this.fileProgress.set(path, e.loaded / e.total);
                this.emit();
              }
            },
            (err) => {
              console.warn(`[assets] 模型加载失败，使用灰模占位：${path}`, err);
              this.progress.failed.push(path);
              resolve(null);
            },
          );
        }),
      );
      this.models.set(path, p);
    }
    return p;
  }

  /**
   * 加载模型实例（每次返回独立克隆）。失败或 path 为空时返回占位。
   */
  async model(path: string | null, fallback: PlaceholderOptions): Promise<ModelAsset> {
    const g = path ? await this.loadGltf(path) : null;
    if (!g) return { scene: createPlaceholder(fallback), animations: [], placeholder: true };
    const scene = skeletonClone(g.scene) as THREE.Group;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return { scene, animations: g.animations, placeholder: false };
  }

  texture(path: string, opts: { srgb?: boolean; repeat?: boolean } = {}): Promise<THREE.Texture | null> {
    let p = this.textures.get(path);
    if (!p) {
      const loader = path.endsWith('.ktx2') ? this.ktx2 : this.texLoader;
      p = this.track(
        path,
        new Promise<THREE.Texture | null>((resolve) => {
          loader.load(
            this.assets.url(path),
            (t) => {
              if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
              if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
              resolve(t);
            },
            undefined,
            (err) => {
              console.warn(`[assets] 纹理加载失败：${path}`, err);
              this.progress.failed.push(path);
              resolve(null);
            },
          );
        }),
      );
      this.textures.set(path, p);
    }
    return p;
  }

  /** 原始二进制（高度图、splat 等） */
  arrayBuffer(path: string): Promise<ArrayBuffer> {
    let p = this.buffers.get(path);
    if (!p) {
      p = this.track(path, this.assets.fetchArrayBuffer(path));
      this.buffers.set(path, p);
      p.catch(() => {
        this.buffers.delete(path);
        this.progress.failed.push(path);
      });
    }
    return p;
  }

  json<T>(path: string): Promise<T> {
    return this.track(path, this.assets.fetchJson<T>(path));
  }

  /** 释放缓存的 GPU 资源（切岛时调用） */
  disposeAll(): void {
    for (const p of this.textures.values()) void p.then((t) => t?.dispose());
    this.textures.clear();
    this.models.clear();
    this.buffers.clear();
  }

  dispose(): void {
    this.disposeAll();
    this.draco.dispose();
    this.ktx2.dispose();
  }
}
