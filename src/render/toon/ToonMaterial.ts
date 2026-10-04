/**
 * REN-001 · Toon 材质。
 * 基于 MeshToonMaterial（保留 three 的灯光、阴影、雾、蒙皮、实例化支持），通过 onBeforeCompile 注入：
 *  1. 3 阶色带：横坐标 = (N·L*0.5+0.5) × 投影系数 → 投影与明暗交界共用同一套色阶（阴影量化）
 *  2. 硬高光：半程向量阈值，只出现在亮部
 *  3. 边缘光：视线掠射角阈值，亮侧更强
 * 全局参数（色带、边缘光、高光）放在共享 uniform 里，样张页调参对所有材质实时生效。
 * 额外的着色逻辑（地形 splat、草的风摆等）通过 extend 钩子追加。
 */
import * as THREE from 'three';
import { createRampTexture, updateRampTexture } from './ramps';
import { DEFAULT_STYLE, type ToonStyle } from './presets';

export const toonGlobals = {
  style: structuredClone(DEFAULT_STYLE) as ToonStyle,
  characterRamp: createRampTexture(DEFAULT_STYLE.characterRamp),
  sceneRamp: createRampTexture(DEFAULT_STYLE.sceneRamp),
  uniforms: {
    uRimColor: { value: new THREE.Color(DEFAULT_STYLE.rim.color) },
    uRimStrength: { value: DEFAULT_STYLE.rim.strength },
    uRimThreshold: { value: DEFAULT_STYLE.rim.threshold },
    uRimWidth: { value: DEFAULT_STYLE.rim.width },
    uSpecStrength: { value: DEFAULT_STYLE.specular.strength },
    uSpecSize: { value: DEFAULT_STYLE.specular.size },
    uTime: { value: 0 },
  },
};

/** 应用一套新的画风参数（样张页 / 读取设置时调用） */
export function applyToonStyle(style: ToonStyle): void {
  toonGlobals.style = structuredClone(style);
  updateRampTexture(toonGlobals.characterRamp, style.characterRamp);
  updateRampTexture(toonGlobals.sceneRamp, style.sceneRamp);
  const u = toonGlobals.uniforms;
  u.uRimColor.value.set(style.rim.color);
  u.uRimStrength.value = style.rim.strength;
  u.uRimThreshold.value = style.rim.threshold;
  u.uRimWidth.value = style.rim.width;
  u.uSpecStrength.value = style.specular.strength;
  u.uSpecSize.value = style.specular.size;
}

export type ShaderHook = (shader: THREE.WebGLProgramParametersWithUniforms, material: THREE.Material) => void;

export interface ToonOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  /** 角色（窄过渡、边缘光、高光）或场景（宽过渡、无边缘光） */
  kind?: 'character' | 'scene';
  rim?: boolean;
  specular?: boolean;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  alphaTest?: number;
  fog?: boolean;
  /** 追加着色逻辑；cacheKey 用于区分不同的扩展 */
  extend?: ShaderHook;
  cacheKey?: string;
  /** 是否挂反向外壳描边（由 outline/InvertedHull 处理） */
  outline?: boolean;
  name?: string;
}

const TOON_PARS = /* glsl */ `
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimThreshold;
uniform float uRimWidth;
uniform float uSpecStrength;
uniform float uSpecSize;
float gToonShadow = 1.0;
float gToonLit = 0.0;
`;

const TOON_DIRECT = /* glsl */ `
varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = dot( geometryNormal, directLight.direction );
	float x = clamp( ( dotNL * 0.5 + 0.5 ) * gToonShadow, 0.0, 1.0 );
	#ifdef USE_GRADIENTMAP
		vec3 ramp = texture2D( gradientMap, vec2( x, 0.0 ) ).rgb;
	#else
		vec3 ramp = vec3( x < 0.5 ? 0.6 : 1.0 );
	#endif
	reflectedLight.directDiffuse += ramp * directLight.color * BRDF_Lambert( material.diffuseColor );
	gToonLit = max( gToonLit, smoothstep( 0.55, 0.65, x ) );
	#ifdef TOON_SPECULAR
		vec3 h = normalize( directLight.direction + geometryViewDir );
		float s = smoothstep( uSpecSize - 0.004, uSpecSize + 0.004, dot( geometryNormal, h ) ) * step( 0.6, x );
		reflectedLight.directDiffuse += s * uSpecStrength * directLight.color;
	#endif
	gToonShadow = 1.0;
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;

const RIM = /* glsl */ `
#ifdef TOON_RIM
{
	float rimDot = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
	float rim = smoothstep( uRimThreshold, uRimThreshold + uRimWidth, rimDot ) * uRimStrength;
	outgoingLight += rim * uRimColor * ( 0.35 + 0.65 * gToonLit ) * diffuseColor.rgb * 1.6;
}
#endif
#include <opaque_fragment>
`;

const shadowPattern = /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap/;

/** 把 Toon 注入逻辑应用到任意 MeshToonMaterial 着色器上（地形 / 植被等自定义材质也复用） */
export function patchToonShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, toonGlobals.uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TOON_PARS}`)
    .replace('#include <lights_toon_pars_fragment>', TOON_DIRECT)
    .replace(
      '#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin.replace(
        shadowPattern,
        'gToonShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap',
      ),
    )
    .replace('#include <opaque_fragment>', RIM);
}

export function createToonMaterial(o: ToonOptions = {}): THREE.MeshToonMaterial {
  const kind = o.kind ?? 'character';
  const m = new THREE.MeshToonMaterial({
    color: o.color ?? 0xffffff,
    map: o.map ?? null,
    gradientMap: kind === 'character' ? toonGlobals.characterRamp : toonGlobals.sceneRamp,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    vertexColors: o.vertexColors ?? false,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    alphaTest: o.alphaTest ?? 0,
    fog: o.fog ?? true,
  });
  if (o.name) m.name = o.name;
  const rim = o.rim ?? kind === 'character';
  const spec = o.specular ?? kind === 'character';
  m.defines = { ...(m.defines ?? {}), ...(rim ? { TOON_RIM: '' } : {}), ...(spec ? { TOON_SPECULAR: '' } : {}) };
  m.onBeforeCompile = (shader) => {
    patchToonShader(shader);
    o.extend?.(shader, m);
  };
  m.customProgramCacheKey = () => `toon|${kind}|${rim}|${spec}|${o.cacheKey ?? ''}`;
  m.userData.toon = true;
  m.userData.outline = o.outline ?? kind === 'character';
  return m;
}

/**
 * 把一个对象树里的非 Toon 材质替换成 Toon 材质（加载的 glTF、占位体使用）。
 * 保留颜色、贴图、顶点色、透明设置。
 */
export function toonify(root: THREE.Object3D, kind: 'character' | 'scene' = 'character'): void {
  const cache = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.keepMaterial) return;
    const convert = (src: THREE.Material): THREE.Material => {
      if (src.userData.toon || (src as THREE.MeshBasicMaterial).isMeshBasicMaterial || (src as THREE.ShaderMaterial).isShaderMaterial)
        return src;
      let dst = cache.get(src);
      if (!dst) {
        const s = src as THREE.MeshStandardMaterial;
        dst = createToonMaterial({
          kind,
          color: s.color ?? 0xffffff,
          map: s.map ?? null,
          emissive: s.emissive ?? 0,
          emissiveIntensity: s.emissiveIntensity ?? 1,
          vertexColors: s.vertexColors,
          transparent: s.transparent,
          opacity: s.opacity,
          side: s.side,
          alphaTest: s.alphaTest,
        });
        dst.name = src.name;
        cache.set(src, dst);
      }
      return dst;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    if (mesh.userData.outline === undefined) mesh.userData.outline = kind === 'character';
  });
}
