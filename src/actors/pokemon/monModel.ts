/**
 * 宝可梦模型工厂（战斗 / 跟随 / 野外共用）。
 * M1-21：手工模型（Blender → scripts/build-models.ts → assets/models/pokemon/manifest.json）。
 * - createMonModel 保持同步：先返回挂着灰模的根节点，glb 就绪后原地换成手工模型（缓存命中时下一帧即换）；
 * - 模型按 monHeight 等比缩放（与灰模同高，战斗机位 / 碰撞 / 头顶气泡不用改），Toon 材质 + 蒙皮描边；
 * - 异色：清单里有 shiny 贴图时换调色板贴图，否则整体色相偏移；
 * - 动画：根节点上挂 MonAnimator（见 monAnimator / setMonLoop / updateMonModel），模型未就绪时记下想要的状态。
 * 清单里没有的物种继续用按属性着色的灰模。
 */
import * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { SpeciesData } from '@/systems/data/types';
import type { PokemonInstance } from '@/systems/pokemon';
import type { AssetLoader } from '@/core/assets';
import { createPlaceholder, makeLabelSprite, TYPE_COLORS } from '@/core/assets';
import { addAlphaAura, addHullOutlines, toonify } from '@/render';
import { alphaScale } from '@/systems/alpha';
import { MonAnimator, type MonLoop } from './MonAnimator';

export interface MonManifestEntry {
  id: number;
  name: string;
  file: string;
  heightM: number;
  tris: number;
  clips: string[];
  hitTime: Record<string, number>;
  plan?: string;
  /** 'length'：图鉴数值是体长（鱼 / 蛇形），按前后长度缩放；缺省按站高 */
  fit?: 'height' | 'length';
  /** 异色调色板贴图（与 glb 同目录） */
  shiny?: string;
}

interface Registry {
  loader: AssetLoader;
  byId: Map<number, MonManifestEntry>;
}

const MODEL_DIR = 'models/pokemon/';
let registry: Registry | null = null;
let pending: Promise<void> | null = null;

/** 启动时调用一次：读取模型清单。失败时全部物种用灰模。 */
export function initMonModels(loader: AssetLoader): Promise<void> {
  pending = loader
    .json<{ version: number; models: MonManifestEntry[] }>(`${MODEL_DIR}manifest.json`)
    .then((m) => {
      registry = { loader, byId: new Map(m.models.map((e) => [e.id, e])) };
    })
    .catch((err: unknown) => {
      console.warn('[mon] 模型清单加载失败，使用灰模', err);
      registry = { loader, byId: new Map() };
    });
  return pending;
}

export function monManifest(speciesId: number): MonManifestEntry | null {
  return registry?.byId.get(speciesId) ?? null;
}

export function hasMonModel(speciesId: number): boolean {
  return !!registry?.byId.has(speciesId);
}

/** 预加载（进战斗 / 读档前把队伍的模型拉进缓存，避免灰模闪一下） */
export async function preloadMonModels(speciesIds: Iterable<number>): Promise<void> {
  if (pending) await pending;
  const r = registry;
  if (!r) return;
  const jobs: Promise<unknown>[] = [];
  for (const id of new Set(speciesIds)) {
    const e = r.byId.get(id);
    if (e) jobs.push(r.loader.loadGltf(MODEL_DIR + e.file));
  }
  await Promise.all(jobs);
}

export function monHeight(dex: Dex, p: PokemonInstance): number {
  return dex.species(p.speciesId).heightM * alphaScale(p) + 0.25;
}

export interface MonModelOptions {
  /** 头顶名字标签（野外遭遇用） */
  label?: string | undefined;
  labelColor?: string | undefined;
  /** 直接指定高度（缺省 monHeight） */
  height?: number | undefined;
}

/** 挂在根节点 userData.mon 上的句柄 */
interface MonHandle {
  speciesId: number;
  placeholder: THREE.Object3D;
  body: THREE.Object3D | null;
  animator: MonAnimator | null;
  want: { loop: MonLoop; timeScale: number };
  ready: Promise<boolean>;
}

function handleOf(root: THREE.Object3D): MonHandle | null {
  return (root.userData.mon as MonHandle | undefined) ?? null;
}

/** 已换上手工模型时返回动画机，否则 null（调用方回退程序化动画） */
export function monAnimator(root: THREE.Object3D): MonAnimator | null {
  return handleOf(root)?.animator ?? null;
}

/** glb 就绪（true）或确定只能用灰模（false） */
export function monModelReady(root: THREE.Object3D): Promise<boolean> {
  return handleOf(root)?.ready ?? Promise.resolve(false);
}

/** 设置基础循环状态；模型还没加载完时记下，就绪后生效 */
export function setMonLoop(root: THREE.Object3D, loop: MonLoop, timeScale = 1): void {
  const h = handleOf(root);
  if (!h) return;
  h.want = { loop, timeScale };
  h.animator?.loop(loop, { timeScale });
}

export function updateMonModel(root: THREE.Object3D, dt: number): void {
  handleOf(root)?.animator?.update(dt);
}

export function createMonModel(dex: Dex, p: PokemonInstance, opts: MonModelOptions = {}): THREE.Group {
  return createMonModelFor(dex.species(p.speciesId), p, { height: monHeight(dex, p), ...opts });
}

/** 已有物种数据时直接用（野外生成） */
export function createMonModelFor(sp: SpeciesData, p: PokemonInstance, opts: MonModelOptions = {}): THREE.Group {
  const base = TYPE_COLORS[sp.types[0] ?? 'normal'] ?? '#aaaaaa';
  const color = p.shiny ? new THREE.Color(base).offsetHSL(0.45, 0.1, 0.05) : new THREE.Color(base);
  const height = opts.height ?? sp.heightM * alphaScale(p) + 0.25;
  const root = new THREE.Group();
  root.name = `mon:${sp.key}`;
  const ph = createPlaceholder({ label: '', showLabel: false, height, color });
  toonify(ph, 'character');
  addHullOutlines(ph);
  if (p.alpha) addAlphaAura(ph);
  root.add(ph);
  root.userData.height = ph.userData.height as number;
  root.userData.radius = ph.userData.radius as number;
  if (opts.label) {
    const label = makeLabelSprite(opts.label, opts.labelColor);
    label.position.y = (root.userData.height as number) + 0.35;
    label.name = 'label';
    root.add(label);
  }
  const handle: MonHandle = {
    speciesId: p.speciesId,
    placeholder: ph,
    body: null,
    animator: null,
    want: { loop: 'idle', timeScale: 1 },
    ready: Promise.resolve(false),
  };
  root.userData.mon = handle;
  handle.ready = swapIn(root, handle, !!p.shiny, root.userData.height as number, !!p.alpha);
  return root;
}

async function swapIn(root: THREE.Group, h: MonHandle, shiny: boolean, height: number, alpha = false): Promise<boolean> {
  if (pending) await pending;
  const r = registry;
  const entry = r?.byId.get(h.speciesId);
  if (!r || !entry) return false;
  const asset = await r.loader.model(MODEL_DIR + entry.file, { label: entry.name, showLabel: false });
  if (asset.placeholder) return false;
  const body = asset.scene;
  body.name = `model:${entry.name}`;
  // 绑定姿势下量高度 → 等比缩放到目标高度，脚底对齐原点
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  // 灰模高度 = 图鉴身高 + 0.25（可读性余量）；体长型按 z 向长度缩放，余量减小
  const s = entry.fit === 'length' ? (height - 0.15) / Math.max(1e-4, size.z) : size.y > 1e-4 ? height / size.y : 1;
  const holder = new THREE.Group();
  holder.name = 'mon-body';
  body.scale.multiplyScalar(s);
  body.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  holder.add(body);
  body.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if ((m as THREE.Mesh).isMesh) m.userData.sharedGeometry = true; // 与缓存共享，不能 dispose
  });
  if (shiny) await applyShiny(r.loader, body, entry);
  toonify(holder, 'character');
  addHullOutlines(holder);
  // 视锥剔除（M1-22）：动画会把顶点带出绑定包围盒，所以用绑定姿势包围球放大 1.6 倍（每个对象一份，不改共享几何体）；
  // 描边外壳与本体共用同一个包围球。以前直接关掉剔除，屏幕外的野生宝可梦也会整只绘制
  holder.updateMatrixWorld(true);
  holder.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || m.userData.outlineHull) return;
    m.computeBoundingSphere();
    m.boundingSphere!.radius *= 1.6;
    for (const ch of m.children) {
      const hull = ch as THREE.SkinnedMesh;
      if (hull.isSkinnedMesh && hull.userData.outlineHull) hull.boundingSphere = m.boundingSphere;
    }
  });
  // 头目：红色光晕外壳（在剔除包围球放大之后，外壳共用同一个包围球）
  if (alpha) addAlphaAura(holder);
  // 替换：保持灰模当前的变换（程序化动画可能正作用在根节点上，这里只换孩子）
  h.placeholder.removeFromParent();
  disposeTree(h.placeholder);
  root.add(holder);
  h.body = holder;
  h.animator = new MonAnimator(body, asset.animations, entry.hitTime);
  h.animator.loop(h.want.loop, { timeScale: h.want.timeScale, fade: 0.01 });
  h.animator.update(0);
  root.userData.height = size.y * s;
  root.userData.modelLoaded = true;
  return true;
}

async function applyShiny(loader: AssetLoader, body: THREE.Object3D, e: MonManifestEntry): Promise<void> {
  const tex = e.shiny ? await loader.texture(MODEL_DIR + e.shiny, { srgb: true }) : null;
  if (tex) {
    tex.flipY = false; // glTF 贴图约定
    tex.magFilter = THREE.NearestFilter; // 调色板色块
    tex.needsUpdate = true;
  }
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((src) => {
      const c = (src as THREE.MeshStandardMaterial).clone();
      if (tex && c.map) c.map = tex;
      else c.color.offsetHSL(0.45, 0.1, 0.05);
      return c;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;
  });
}

function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || m.userData.outlineHull || m.userData.sharedGeometry) return;
    m.geometry?.dispose();
  });
}

/** 释放模型实例（几何体是缓存共享的，只停动画） */
export function disposeMonModel(root: THREE.Object3D): void {
  const h = handleOf(root);
  h?.animator?.dispose();
  if (h) h.animator = null;
}

/** 在包装节点（WildMon.root / Follower.root）里找到挂着模型句柄的节点 */
export function findMonRoot(obj: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  obj.traverse((o) => {
    if (!found && o.userData.mon) found = o;
  });
  return found;
}

/** 供 world/spawns 注入的野外模型工厂（main.ts 注册） */
export const wildBodyFactory = {
  create: (
    species: SpeciesData,
    mon: PokemonInstance,
    o: { label: string; labelColor: string | undefined; height: number },
  ): THREE.Group => createMonModelFor(species, mon, o),
  animated: (body: THREE.Object3D): boolean => monAnimator(body) !== null,
  setLoop: (body: THREE.Object3D, loop: MonLoop, timeScale: number): void => setMonLoop(body, loop, timeScale),
  update: (body: THREE.Object3D, dt: number): void => updateMonModel(body, dt),
  dispose: (body: THREE.Object3D): void => disposeMonModel(body),
};
