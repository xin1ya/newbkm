/**
 * REN-002 · 角色描边：反向外壳法（inverted hull）。
 * 对标记了 userData.outline 的网格添加一个共享几何体的子网格：只渲染背面，
 * 在视空间沿法线外扩，外扩量与深度成正比 → 屏幕上宽度基本恒定；远处限制最大宽度避免“糊成一团”。
 * 支持蒙皮（SkinnedMesh 共享骨骼）和实例化网格；描边色 = 基色 × darken，与统一描边色混合。
 * 注意：硬边模型（法线不连续）外扩会裂开，建模规范要求角色使用平滑法线或额外的描边法线（docs/art/model-spec.md）。
 */
import * as THREE from 'three';
import { toonGlobals } from '../toon/ToonMaterial';

const outlineUniforms = {
  uOutlineWidth: { value: toonGlobals.style.outline.hullWidth },
  uOutlineMaxPx: { value: 0.06 },
  uOutlineScale: { value: 1 },
};

/** 画质档位 / 样张调参修改全局描边宽度 */
export function setHullOutlineWidth(width: number, qualityScale = outlineUniforms.uOutlineScale.value): void {
  outlineUniforms.uOutlineWidth.value = width;
  outlineUniforms.uOutlineScale.value = qualityScale;
}

const vertexShader = /* glsl */ `
#include <common>
#include <batching_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
uniform float uOutlineWidth;
uniform float uOutlineScale;
uniform float uOutlineMaxPx;
void main() {
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	vec3 nView = normalize( transformedNormal );
	float dist = -mvPosition.z;
	float w = min( uOutlineWidth * uOutlineScale * dist, uOutlineMaxPx );
	mvPosition.xyz += nView * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( uColor, uOpacity );
	#include <colorspace_fragment>
	#include <fog_fragment>
}
`;

const materialCache = new Map<string, THREE.ShaderMaterial>();

export function outlineMaterialFor(base: THREE.Color, opts: { darken?: number | undefined; tint?: THREE.ColorRepresentation } = {}): THREE.ShaderMaterial {
  const darken = opts.darken ?? toonGlobals.style.outline.hullDarken;
  const tint = new THREE.Color(opts.tint ?? toonGlobals.style.outline.hullTint);
  const c = base.clone().multiplyScalar(darken).lerp(tint, 0.45);
  const key = c.getHexString();
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      name: 'outline-hull',
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: c }, uOpacity: { value: 1 } }]),
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      fog: true,
    });
    // 共享全局宽度 uniform（merge 会复制，这里重新挂引用）
    Object.assign(m.uniforms, outlineUniforms);
    m.userData.outlineHull = true;
    materialCache.set(key, m);
  }
  return m;
}

function baseColorOf(mat: THREE.Material | THREE.Material[]): THREE.Color {
  const m = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshToonMaterial | undefined;
  return m?.color?.clone() ?? new THREE.Color(0x888888);
}

/** 全局开关（由画质设置 hullOutline 决定，PostChain.applyQuality 写入）。关闭时 addHullOutlines 不再创建外壳 */
let hullEnabled = false; // 默认与三档画质预设一致（已取消描边）
export function setHullOutlinesEnabled(v: boolean): void {
  hullEnabled = v;
}
export function hullOutlinesEnabled(): boolean {
  return hullEnabled;
}

/**
 * 给 root 里所有 userData.outline（或材质 userData.outline）的网格添加外壳。重复调用是安全的。
 */
export function addHullOutlines(root: THREE.Object3D, opts: { force?: boolean; darken?: number | undefined } = {}): number {
  if (!hullEnabled) return 0;
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.outlineHull || m.userData.hasHull) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const want = opts.force || m.userData.outline === true || (m.userData.outline !== false && mat?.userData?.outline === true);
    if (want) targets.push(m);
  });
  for (const m of targets) {
    const mat = outlineMaterialFor(baseColorOf(m.material), { darken: opts.darken });
    let hull: THREE.Mesh;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = m as THREE.SkinnedMesh;
      const h = new THREE.SkinnedMesh(sm.geometry, mat);
      h.bind(sm.skeleton, sm.bindMatrix);
      hull = h;
    } else if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const im = m as THREE.InstancedMesh;
      const h = new THREE.InstancedMesh(im.geometry, mat, im.count);
      h.instanceMatrix = im.instanceMatrix;
      hull = h;
    } else {
      hull = new THREE.Mesh(m.geometry, mat);
    }
    hull.name = `${m.name}-hull`;
    hull.userData.outlineHull = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.renderOrder = m.renderOrder;
    hull.frustumCulled = m.frustumCulled;
    hull.layers.mask = m.layers.mask;
    m.add(hull);
    m.userData.hasHull = true;
  }
  return targets.length;
}

export function setHullsVisible(root: THREE.Object3D, visible: boolean): void {
  root.traverse((o) => {
    if (o.userData.outlineHull) o.visible = visible;
  });
}

/** 把新描边颜色参数应用到已缓存材质（样张调参） */
export function refreshHullColors(): void {
  // 颜色在创建时计算；调参时清空缓存，由调用方重新 addHullOutlines
  materialCache.clear();
}

// ———————————————————— 头目光晕外壳（计划文档 §3.4） ————————————————————
// 与全局描边开关无关：取消描边后只有头目单独保留一层红色反向外壳（用户 2026-10-03 确认）。

const auraUniforms = {
  uOutlineWidth: { value: 0.0045 },
  uOutlineMaxPx: { value: 0.11 },
  uOutlineScale: { value: 1 },
};
let auraMaterial: THREE.ShaderMaterial | null = null;

function auraMaterialGet(): THREE.ShaderMaterial {
  if (!auraMaterial) {
    auraMaterial = new THREE.ShaderMaterial({
      name: 'alpha-aura-hull',
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(0xd8202a) }, uOpacity: { value: 0.85 } }]),
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    Object.assign(auraMaterial.uniforms, auraUniforms);
    auraMaterial.userData.auraHull = true;
  }
  return auraMaterial;
}

/** 头目光晕脉动（每帧调用一次即可，所有头目共用材质） */
export function pulseAlphaAura(time: number): void {
  const m = auraMaterial;
  if (!m) return;
  auraUniforms.uOutlineWidth.value = 0.0045 + Math.sin(time * 3) * 0.0012;
  (m.uniforms.uOpacity as { value: number }).value = 0.7 + Math.sin(time * 3) * 0.15;
}

/** 给 root 里所有可见网格（蒙皮 / 普通）加红色光晕外壳；重复调用安全 */
export function addAlphaAura(root: THREE.Object3D): number {
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.outlineHull || m.userData.auraHull || m.userData.hasAura) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
    if (mat?.transparent && mat.opacity < 0.6) return; // 半透明部件（鬼斯毒气等）不加
    targets.push(m);
  });
  const mat = auraMaterialGet();
  for (const m of targets) {
    let hull: THREE.Mesh;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = m as THREE.SkinnedMesh;
      const h = new THREE.SkinnedMesh(sm.geometry, mat);
      h.bind(sm.skeleton, sm.bindMatrix);
      if (sm.boundingSphere) h.boundingSphere = sm.boundingSphere; // 与本体共用放大过的剔除包围球
      hull = h;
    } else hull = new THREE.Mesh(m.geometry, mat);
    hull.name = `${m.name}-aura`;
    hull.userData.auraHull = true;
    hull.userData.sharedGeometry = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.frustumCulled = m.frustumCulled;
    m.add(hull);
    m.userData.hasAura = true;
  }
  return targets.length;
}
