/**
 * WLD-002 · Toon 水面。
 * - 深度来自高度场预烘焙的深度纹理（水面高度 - 地面），无需深度预渲染
 * - 颜色按深度量化为 3 档（浅滩青绿 / 中层湛蓝 / 深海靛蓝），交界处用噪声抖动
 * - 岸边泡沫：深度 < 阈值的一圈白色，带随时间推进的“浪线”
 * - 高光：太阳方向的量化闪光（full 画质用两层滚动噪声扰动法线）
 * - 顶点波浪：低频正弦叠加（full 画质）
 * - 随天空光照变化（uSunColor / uAmbient），并支持雾
 * - 性能 P1 · 水面分级：full 画质也只在相机 70 m 内做法线扰动、雨点涟漪，30 m 内浅水加焦散；
 *   更远处走 simple 路径（GPU 分支按区域一致，远处大片海面直接跳过噪声计算）
 */
import * as THREE from 'three';
import type { Heightfield } from '../terrain/Heightfield';

export interface WaterStyle {
  shallow: string;
  mid: string;
  deep: string;
  foam: string;
}

export const SEA_STYLE: WaterStyle = { shallow: '#8ae6dc', mid: '#3fb4d8', deep: '#2067b3', foam: '#ffffff' };
export const LAKE_STYLE: WaterStyle = { shallow: '#9aebd2', mid: '#4cc0c9', deep: '#2a7fa6', foam: '#f4fffb' };

/** 烘焙深度纹理：0–255 ↔ 0–16 m，覆盖 [-half, half]² */
export function bakeDepthTexture(hf: Heightfield, level: number | ((x: number, z: number) => number | null), res = 512): THREE.DataTexture {
  const data = new Uint8Array(res * res);
  const size = hf.config.size[0];
  for (let j = 0; j < res; j++)
    for (let i = 0; i < res; i++) {
      const x = -size / 2 + ((i + 0.5) / res) * size;
      const z = -size / 2 + ((j + 0.5) / res) * size;
      const lv = typeof level === 'number' ? level : level(x, z);
      const d = lv === null ? 0 : lv - hf.heightAt(x, z);
      data[j * res + i] = Math.round(THREE.MathUtils.clamp(d / 16, 0, 1) * 255);
    }
  const t = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export const waterShared = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uAmbient: { value: new THREE.Color(0.55, 0.6, 0.7) },
  uRain: { value: 0 },
};

export function createWaterMaterial(depthTex: THREE.DataTexture, worldSize: number, style: WaterStyle, full: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    name: 'toon-water',
    transparent: true,
    depthWrite: false,
    fog: true,
    defines: full ? { WATER_FULL: '' } : {},
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uDepth: { value: depthTex },
        uWorldSize: { value: worldSize },
        uShallow: { value: new THREE.Color(style.shallow) },
        uMid: { value: new THREE.Color(style.mid) },
        uDeep: { value: new THREE.Color(style.deep) },
        uFoam: { value: new THREE.Color(style.foam) },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        #ifdef WATER_FULL
          wp.y += sin(wp.x * 0.08 + uTime * 0.9) * 0.07 + sin(wp.z * 0.11 - uTime * 0.7) * 0.06;
        #endif
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uDepth;
      uniform float uWorldSize;
      uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uFoam;
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmbient; uniform float uRain;
      varying vec3 vWorld;
      float wHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float wNoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(wHash(i), wHash(i+vec2(1,0)), f.x), mix(wHash(i+vec2(0,1)), wHash(i+vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec2 uv = vWorld.xz / uWorldSize + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float depth = mix(16.0, texture2D(uDepth, clamp(uv, 0.0, 1.0)).r * 16.0, inside);
        float n = wNoise(vWorld.xz * 0.25 + vec2(uTime * 0.15, uTime * 0.1));
        float d = depth + (n - 0.5) * 0.6;
        vec3 col = d < 1.6 ? uShallow : (d < 6.0 ? uMid : uDeep);
        // 两档之间留一条细过渡，避免锯齿
        col = mix(col, mix(uShallow, uMid, 0.5), smoothstep(0.12, 0.0, abs(d - 1.6)) * 0.6);
        // 岸边泡沫：静态一圈 + 向岸推进的浪线
        float foamBase = smoothstep(0.55, 0.25, d);
        float wave = fract(depth * 0.9 - uTime * 0.35 + n * 0.3);
        float foamLine = step(0.86, wave) * smoothstep(2.2, 0.8, depth);
        float foam = clamp(max(foamBase, foamLine) * step(0.02, depth), 0.0, 1.0);
        // 光照：环境 + 太阳
        vec3 lit = col * (uAmbient + uSunColor * 0.55);
        // 高光闪烁
        vec3 N = vec3(0.0, 1.0, 0.0);
        float camD = distance(cameraPosition.xz, vWorld.xz);
        #ifdef WATER_FULL
          float nearF = 1.0 - smoothstep(50.0, 70.0, camD);
          if (nearF > 0.0) {
            float n1 = wNoise(vWorld.xz * 0.6 + uTime * vec2(0.4, 0.2));
            float n2 = wNoise(vWorld.xz * 0.9 - uTime * vec2(0.25, 0.35));
            N = normalize(vec3((n1 - 0.5) * 0.5 * nearF, 1.0, (n2 - 0.5) * 0.5 * nearF));
          }
          // 焦散：30 m 内、水深 < 2.5 m 的浅水，两层滚动噪声取“细亮线”，深处 / 远处不计算
          float causF = (1.0 - smoothstep(22.0, 30.0, camD)) * smoothstep(2.5, 0.6, depth) * step(0.05, depth);
          if (causF > 0.0) {
            vec2 cp = vWorld.xz * 0.7;
            float c1 = wNoise(cp + uTime * vec2(0.31, 0.17));
            float c2 = wNoise(cp * 1.37 - uTime * vec2(0.22, 0.29));
            float caus = smoothstep(0.08, 0.0, abs(c1 - c2));
            lit += caus * causF * 0.22 * (uAmbient * 0.4 + uSunColor * 0.6) * step(0.0, uSunDir.y);
          }
        #endif
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 H = normalize(uSunDir + V);
        float spec = step(0.985, dot(N, H)) * step(0.0, uSunDir.y);
        lit += uSunColor * spec * 0.9;
        // 菲涅尔：掠射角略亮（天空反射的简化）
        float fres = pow(1.0 - max(dot(V, vec3(0,1,0)), 0.0), 3.0);
        lit = mix(lit, lit + vec3(0.18, 0.22, 0.26) * (uAmbient + uSunColor * 0.5), fres * 0.6);
        // 雨：水面细碎涟漪变亮
        if (uRain > 0.0 && camD < 70.0) lit += step(0.93, wNoise(vWorld.xz * 2.5 + uTime * 3.0)) * uRain * 0.15;
        lit = mix(lit, uFoam * (uAmbient + uSunColor * 0.7), foam);
        float alpha = mix(0.72, 0.94, smoothstep(0.3, 4.0, depth));
        alpha = max(alpha, foam);
        gl_FragColor = vec4(lit, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  Object.assign(m.uniforms, waterShared);
  return m;
}
