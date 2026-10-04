/**
 * REN-001 · 色带（gradient map）。
 * 3 阶：暗部 / 过渡 / 亮部。阈值与亮度来自 ART-001 样张定稿（见 presets.ts）。
 * 横坐标是 (N·L * 0.5 + 0.5) × 阴影系数，所以投影也会被量化到同样的色阶（“阴影量化”）。
 */
import * as THREE from 'three';

export interface RampSpec {
  /** 两个分界点（0–1，横坐标） */
  thresholds: [number, number];
  /** 三个色阶的亮度 */
  levels: [number, number, number];
  /** 暗部色调（乘到暗部上，冷色阴影更“卡通”） */
  shadowTint: THREE.ColorRepresentation;
  /** 分界处的柔化宽度（0 = 完全硬边） */
  softness: number;
}

const WIDTH = 256;

export function createRampTexture(spec: RampSpec): THREE.DataTexture {
  const data = new Uint8Array(WIDTH * 4);
  const tint = new THREE.Color(spec.shadowTint);
  const [t1, t2] = spec.thresholds;
  const [l0, l1, l2] = spec.levels;
  const s = Math.max(1e-4, spec.softness);
  const smooth = (e0: number, e1: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < WIDTH; i++) {
    const x = i / (WIDTH - 1);
    const a = smooth(t1 - s, t1 + s, x);
    const b = smooth(t2 - s, t2 + s, x);
    const lum = l0 + (l1 - l0) * a + (l2 - l1) * b;
    // 越暗越偏向阴影色调
    const k = 1 - a;
    const r = lum * (1 - k + k * tint.r);
    const g = lum * (1 - k + k * tint.g);
    const bl = lum * (1 - k + k * tint.b);
    data[i * 4] = Math.round(THREE.MathUtils.clamp(r, 0, 1) * 255);
    data[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(g, 0, 1) * 255);
    data[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(bl, 0, 1) * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, WIDTH, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** 以就地更新的方式修改色带（样张调参时实时生效） */
export function updateRampTexture(tex: THREE.DataTexture, spec: RampSpec): void {
  const fresh = createRampTexture(spec);
  (tex.image.data as Uint8Array).set(fresh.image.data as Uint8Array);
  tex.needsUpdate = true;
  fresh.dispose();
}
