/**
 * WLD-003 · 植被材质：Toon 场景色带 + 顶点风摆 + 被推开 + 距离淡出（缩放到 0，避免透明排序开销）。
 * 位移在世界空间做（实例变换之后），所以任意旋转/缩放的实例都一致。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';

export const MAX_PUSHERS = 6;

export const foliageShared = {
  uTime: { value: 0 },
  /** xy = 风向，z = 强度，w = 阵风频率 */
  uWind: { value: new THREE.Vector4(0.8, 0.6, 1, 1) },
  /** xyz = 位置，w = 半径（0 = 未使用） */
  uPushers: { value: Array.from({ length: MAX_PUSHERS }, () => new THREE.Vector4(0, -9999, 0, 0)) },
};

export interface FoliageMaterialOptions {
  kind: 'grass' | 'flower' | 'tree' | 'bush';
  /** 淡出起止距离（米）；不淡出传 null */
  fade: [number, number] | null;
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  swayScale?: number;
}

export function createFoliageMaterial(o: FoliageMaterialOptions): THREE.MeshToonMaterial {
  const fade = { value: new THREE.Vector2(...(o.fade ?? [1e5, 1e5 + 1])) };
  const sway = { value: o.swayScale ?? (o.kind === 'tree' ? 0.12 : o.kind === 'bush' ? 0.05 : 0.18) };
  const useUv = o.kind === 'grass';
  const pushable = o.kind === 'grass' || o.kind === 'flower';
  const m = createToonMaterial({
    kind: 'scene',
    color: o.color ?? 0xffffff,
    vertexColors: o.vertexColors ?? !useUv,
    side: o.kind === 'grass' ? THREE.DoubleSide : THREE.FrontSide,
    cacheKey: `foliage-${o.kind}`,
    rim: false,
    specular: false,
    extend: (shader) => {
      Object.assign(shader.uniforms, foliageShared, { uFade: fade, uSway: sway });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uTime; uniform vec4 uWind; uniform vec4 uPushers[${MAX_PUSHERS}]; uniform vec2 uFade; uniform float uSway;
          ${useUv ? '' : 'attribute float aSway;'}
          varying float vFolH;`,
        )
        .replace(
          '#include <project_vertex>',
          /* glsl */ `
          float h = ${useUv ? 'uv.y' : 'aSway'};
          vFolH = h;
          vec4 localPos = vec4(transformed, 1.0);
          vec4 rootW = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            localPos = instanceMatrix * localPos;
            rootW = instanceMatrix * rootW;
          #endif
          vec4 wpos = modelMatrix * localPos;
          rootW = modelMatrix * rootW;
          // 风：始终顺风向倾倒（不来回摆）。阵风带沿风向推进（wave² 让波峰窄、波谷长），
          // 叠一点低频噪声与垂直风向的细小抖动；速度固定，风力 uWind.z 只影响幅度。
          vec2 windDir = normalize(uWind.xy);
          vec2 windPerp = vec2(-windDir.y, windDir.x);
          float along = dot(rootW.xz, windDir);
          float phase = dot(rootW.xz, vec2(0.21, 0.17));
          float wave = 0.5 + 0.5 * sin(along * 0.32 - uTime * 2.1);
          float noise = 0.5 + 0.5 * sin(uTime * 0.7 + phase * 1.9) * sin(uTime * 0.43 + phase * 0.6);
          float push = 0.45 + 0.4 * wave * wave + 0.15 * noise;
          float flutter = sin(uTime * 5.3 + phase * 7.0) * 0.06 * (0.5 + wave);
          float amp = uSway * uWind.z * h * h;
          float rise = max(wpos.y - rootW.y, 0.05);
          vec2 bend = (windDir * push + windPerp * flutter) * amp * (1.0 + rise * 0.15);
          wpos.xz += bend;
          // 保持叶长：弯得越多顶端越低
          wpos.y -= min(dot(bend, bend) * 0.5 / rise, rise * 0.45);
          ${
            pushable
              ? /* glsl */ `
          for (int i = 0; i < ${MAX_PUSHERS}; i++) {
            vec4 p = uPushers[i];
            if (p.w <= 0.0) continue;
            vec2 d = wpos.xz - p.xz;
            float dist = length(d);
            float k = (1.0 - smoothstep(p.w * 0.35, p.w, dist)) * h * step(abs(wpos.y - p.y), 2.5);
            wpos.xz += (d / max(dist, 1e-3)) * k * 0.45;
            wpos.y -= k * 0.35 * (wpos.y - rootW.y);
          }`
              : ''
          }
          // 距离淡出：以根为中心缩放
          float camD = distance(rootW.xz, cameraPosition.xz);
          float s = 1.0 - smoothstep(uFade.x, uFade.y, camD);
          wpos.xyz = rootW.xyz + (wpos.xyz - rootW.xyz) * s;
          vec4 mvPosition = viewMatrix * wpos;
          gl_Position = projectionMatrix * mvPosition;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFolH;')
        .replace(
          '#include <color_fragment>',
          useUv
            ? '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.12, vFolH);'
            : o.kind === 'tree' || o.kind === 'bush'
              ? '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.85, 1.08, vFolH);'
              : '#include <color_fragment>',
        );
      if (pushable)
        // 「不描边」标记：草 / 花在颜色缓冲 alpha 写 0.5，EdgeDetectPass 据此跳过（小草描边让画面发脏）
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\ngl_FragColor.a = NO_OUTLINE_ALPHA;',
        ).replace('#include <common>', '#include <common>\n#define NO_OUTLINE_ALPHA 0.5');
    },
  });
  m.userData.outline = false;
  m.userData.fade = fade;
  return m;
}

/** 由画质改变淡出距离 */
export function setFoliageFade(m: THREE.Material, start: number, end: number): void {
  (m.userData.fade as { value: THREE.Vector2 } | undefined)?.value.set(start, end);
}
