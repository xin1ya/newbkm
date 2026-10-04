/**
 * M1-17 · 大地图底图烘焙：按高度图 / 材质权重 / 水体逐像素着色，叠加山体阴影、等高线、海岸线、道路与城镇范围。
 * 风格与 Toon 画面一致：平涂色块 + 深色描边。每座岛只烘焙一次（缓存），约 2 m / 像素。
 */
import { SURFACE_CHANNELS, type IslandConfig } from '@/config/islands';
import type { Heightfield } from '@/world/terrain/Heightfield';

const SURFACE_RGB: Record<(typeof SURFACE_CHANNELS)[number], [number, number, number]> = {
  grass: [141, 198, 106],
  forest: [78, 142, 74],
  tallgrass: [104, 170, 76],
  dirt: [204, 168, 110],
  sand: [236, 220, 168],
  rock: [150, 146, 138],
  stone: [196, 189, 176],
  flowers: [176, 208, 118],
};
const SHALLOW: [number, number, number] = [146, 214, 228];
const DEEP: [number, number, number] = [46, 104, 164];
const LAKE_SHALLOW: [number, number, number] = [132, 206, 214];
const LAKE_DEEP: [number, number, number] = [52, 128, 170];
const ROAD_COLOR: Record<IslandConfig['roads'][number]['surface'], string> = { dirt: '#d9b77e', stone: '#e6ddcc', boardwalk: '#a77b4f' };
const CONTOUR_STEP = 8;

const cache = new Map<string, HTMLCanvasElement>();

export function bakeIslandMap(hf: Heightfield, config: IslandConfig, px = 512): HTMLCanvasElement {
  const key = `${config.id}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [W, H] = config.size;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  const mx = W / px;
  const mz = H / px;
  const heights = new Float32Array(px * px);
  const water = new Float32Array(px * px); // > 0：水深；0：陆地
  const lake = new Uint8Array(px * px);
  const w8 = new Float32Array(8);
  // 第一遍：高度与水深
  for (let j = 0; j < px; j++) {
    const z = (j + 0.5) * mz - H / 2;
    for (let i = 0; i < px; i++) {
      const x = (i + 0.5) * mx - W / 2;
      const k = j * px + i;
      heights[k] = hf.heightAt(x, z);
      const wt = hf.waterAt(x, z);
      if (wt) {
        water[k] = Math.max(0.01, wt.depth);
        lake[k] = wt.body === 'sea' ? 0 : 1;
      }
    }
  }
  const hAt = (i: number, j: number) => heights[Math.min(px - 1, Math.max(0, j)) * px + Math.min(px - 1, Math.max(0, i))]!;
  // 光照方向：西北上方（地图惯例）
  const L = norm([-1, 1.6, -1]);
  for (let j = 0; j < px; j++) {
    const z = (j + 0.5) * mz - H / 2;
    for (let i = 0; i < px; i++) {
      const x = (i + 0.5) * mx - W / 2;
      const k = j * px + i;
      let rgb: [number, number, number];
      const d = water[k]!;
      if (d > 0) {
        const t = Math.min(1, d / 9);
        const [a, b] = lake[k] ? [LAKE_SHALLOW, LAKE_DEEP] : [SHALLOW, DEEP];
        // 深度分 5 档（Toon 风格的色阶）
        const q = Math.floor(t * 4.999) / 4;
        rgb = mix(a, b, q);
      } else {
        hf.surfaceAt(x, z, w8);
        let r = 0;
        let g = 0;
        let bl = 0;
        let sum = 0;
        for (let c = 0; c < 8; c++) {
          const wt = w8[c]!;
          if (wt <= 0) continue;
          const col = SURFACE_RGB[SURFACE_CHANNELS[c]!];
          r += col[0] * wt;
          g += col[1] * wt;
          bl += col[2] * wt;
          sum += wt;
        }
        rgb = sum > 0 ? [r / sum, g / sum, bl / sum] : SURFACE_RGB.grass;
        // 山体阴影
        const dx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * mx);
        const dz = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * mz);
        const n = norm([-dx * 2.2, 1, -dz * 2.2]);
        const lit = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
        const shade = 0.78 + 0.34 * Math.max(0, lit);
        rgb = [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
        // 等高线：跨越 CONTOUR_STEP 米整数倍的像素加深
        const h0 = heights[k]!;
        const band = Math.floor(h0 / CONTOUR_STEP);
        if (band !== Math.floor(hAt(i + 1, j) / CONTOUR_STEP) || band !== Math.floor(hAt(i, j + 1) / CONTOUR_STEP)) {
          rgb = [rgb[0] * 0.86, rgb[1] * 0.86, rgb[2] * 0.86];
        }
      }
      // 海岸线：水陆交界描深色边
      const isW = d > 0;
      const edge =
        (i > 0 && water[k - 1]! > 0 !== isW) ||
        (i < px - 1 && water[k + 1]! > 0 !== isW) ||
        (j > 0 && water[k - px]! > 0 !== isW) ||
        (j < px - 1 && water[k + px]! > 0 !== isW);
      if (edge) rgb = isW ? mix(rgb, [255, 255, 255], 0.45) : [52, 62, 84];
      const o = k * 4;
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const toPx = (x: number, z: number): [number, number] => [(x + W / 2) / mx, (z + H / 2) / mz];
  // 城镇范围：淡色填充 + 虚线描边
  for (const zone of config.zones) {
    if (zone.kind !== 'town' || zone.polygon.length < 3) continue;
    ctx.beginPath();
    zone.polygon.forEach(([x, z], n) => {
      const [u, v] = toPx(x, z);
      if (n === 0) ctx.moveTo(u, v);
      else ctx.lineTo(u, v);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 238, 196, 0.32)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(122, 82, 40, 0.75)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 道路：深色描边 + 路面色
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1] as const) {
    for (const r of config.roads) {
      ctx.beginPath();
      r.points.forEach(([x, z], n) => {
        const [u, v] = toPx(x, z);
        if (n === 0) ctx.moveTo(u, v);
        else ctx.lineTo(u, v);
      });
      const w = Math.max(1.6, r.width / mx);
      ctx.lineWidth = pass === 0 ? w + 2 : w;
      ctx.strokeStyle = pass === 0 ? 'rgba(60, 44, 30, 0.55)' : ROAD_COLOR[r.surface];
      ctx.stroke();
    }
  }
  cache.set(key, canvas);
  return canvas;
}

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
}
