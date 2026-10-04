/**
 * WLD-001 · 地形材质：Toon 场景色带 + 8 通道 splat 混合。
 * 每个通道一个基色；片元里再叠两层程序噪声做色斑（大尺度色温变化 + 小尺度笔触），
 * 陡坡自动过渡为岩石，水线附近加深（湿沙），整体仍保持平涂卡通感。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { Heightfield } from './Heightfield';

/** 通道颜色（顺序 = SURFACE_CHANNELS），与样张定稿一致 */
export const SURFACE_COLORS = ['#86c95c', '#5c9a45', '#6cb24a', '#caa56c', '#f0e2ad', '#9a958d', '#c5c0b5', '#8fd068'];
/** M2 扩展覆盖层（第三张 splat，可选）：赭石 / 火山灰 / 熔岩（自发光）/ 苔藓 */
export const EXT_COLORS = ['#c8874a', '#4a4440', '#ff6a1a', '#3f7a3a'];

function splatTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data as unknown as ConstructorParameters<typeof THREE.DataTexture>[0], size, size, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function createTerrainMaterial(hf: Heightfield): THREE.MeshToonMaterial {
  const empty = new Uint8Array([255, 0, 0, 0]);
  const s0 = hf.splat[0] ? splatTexture(hf.splat[0], hf.splatSize) : splatTexture(empty, 1);
  const s1 = hf.splat[1] ? splatTexture(hf.splat[1], hf.splatSize) : splatTexture(new Uint8Array(4), 1);
  const s2 = hf.splat[2] ? splatTexture(hf.splat[2], hf.splatSize) : splatTexture(new Uint8Array(4), 1);
  const uniforms = {
    uSplat0: { value: s0 },
    uSplat1: { value: s1 },
    uSplat2: { value: s2 },
    uExt: { value: EXT_COLORS.map((c) => new THREE.Color(c)) },
    uTime: { value: 0 },
    uWorldSize: { value: new THREE.Vector2(hf.config.size[0], hf.config.size[1]) },
    uSurf: { value: SURFACE_COLORS.map((c) => new THREE.Color(c)) },
    uSeaLevel: { value: hf.config.seaLevel },
  };
  const m = createToonMaterial({
    kind: 'scene',
    color: 0xffffff,
    cacheKey: 'terrain',
    extend: (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTerrWorld;\nvarying vec3 vTerrNormal;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvTerrWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrNormal = normalize(mat3(modelMatrix) * objectNormal);',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          varying vec3 vTerrWorld;
          varying vec3 vTerrNormal;
          uniform sampler2D uSplat0;
          uniform sampler2D uSplat1;
          uniform sampler2D uSplat2;
          uniform vec3 uExt[4];
          uniform float uTime;
          float vLavaGlow = 0.0;
          uniform vec2 uWorldSize;
          uniform vec3 uSurf[8];
          uniform float uSeaLevel;
          float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float tNoise(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(tHash(i), tHash(i+vec2(1,0)), f.x), mix(tHash(i+vec2(0,1)), tHash(i+vec2(1,1)), f.x), f.y);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          {
            vec2 suv = vTerrWorld.xz / uWorldSize + 0.5;
            vec4 a = texture2D(uSplat0, suv);
            vec4 b = texture2D(uSplat1, suv);
            // 通道边界加噪声抖动，避免模糊的渐变，变成卡通“色块”
            float n1 = tNoise(vTerrWorld.xz * 0.35);
            float n2 = tNoise(vTerrWorld.xz * 0.045);
            a = pow(a, vec4(1.6)); b = pow(b, vec4(1.6));
            float sum = dot(a, vec4(1.0)) + dot(b, vec4(1.0)) + 1e-4;
            vec3 col = (a.r*uSurf[0] + a.g*uSurf[1] + a.b*uSurf[2] + a.a*uSurf[3] + b.r*uSurf[4] + b.g*uSurf[5] + b.b*uSurf[6] + b.a*uSurf[7]) / sum;
            // 坡度 → 岩石
            float slope = 1.0 - clamp(vTerrNormal.y, 0.0, 1.0);
            col = mix(col, uSurf[5], smoothstep(0.26, 0.34, slope + (n1 - 0.5) * 0.06));
            // 色斑：大尺度冷暖变化 + 小尺度笔触（量化成 3 档，保持平涂感）
            float blotch = floor((n2 * 0.7 + n1 * 0.3) * 3.0) / 3.0;
            col *= 0.93 + blotch * 0.12;
            col = mix(col, col * vec3(1.04, 1.0, 0.9), smoothstep(0.55, 0.8, n2));
            // 湿沙 / 水下
            float wet = smoothstep(uSeaLevel + 0.9, uSeaLevel - 0.2, vTerrWorld.y);
            col = mix(col, col * vec3(0.78, 0.8, 0.82), wet);
            // M2 覆盖层：赭石 / 火山灰 / 熔岩 / 苔藓（按权重直接覆盖底色）
            vec4 e = texture2D(uSplat2, suv);
            float es = dot(e, vec4(1.0));
            if (es > 0.003) {
              vec3 ec = (e.r*uExt[0] + e.g*uExt[1] + e.b*uExt[2] + e.a*uExt[3]) / es;
              ec *= 0.92 + blotch * 0.14;
              col = mix(col, ec, clamp(es, 0.0, 1.0));
              // 熔岩：流动的亮纹（自发光在 emissive 里叠加）
              float flow = tNoise(vTerrWorld.xz * 0.12 + vec2(uTime * 0.25, uTime * 0.1));
              vLavaGlow = e.b * (0.65 + 0.5 * flow);
            }
            diffuseColor.rgb *= col;
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n          totalEmissiveRadiance += uExt[2] * vLavaGlow * 0.9;',
        );
    },
  });
  m.name = 'terrain';
  m.userData.terrainUniforms = uniforms;
  m.userData.outline = false;
  m.userData.dispose = () => {
    s0.dispose();
    s1.dispose();
    s2.dispose();
  };
  return m;
}

