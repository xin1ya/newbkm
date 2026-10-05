/**
 * M3-04 · 琉璃群岛野外构件（与 builders / townBuilders / tideBuilders / thunderBuilders 同约定：局部坐标，y = 0 为地面，
 * 正面朝 +Z；solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 海蚀石林：喀斯特石笋（层层收分的灰白石灰岩尖塔，竖向溶沟 + 顶部苔草）
 * - 幽灵沼泽：枯树（扭曲枝干，无叶；bleached = 沙丘里被晒白的枯木）、墓碑（平板 / 圆顶 / 十字）、鬼火（悬浮的冷色火团）
 * - 玻璃海岸：玻璃晶簇（一簇倾斜的六棱晶柱，晶尖微光）
 */
import * as THREE from 'three';
import { paint, type PropParts } from './builders';
import { beam, boxAt, rng, shade, sphere, V } from './townBuilders';

const newParts = (): PropParts => ({ solid: [], glow: [] });

/** 喀斯特石笋：3–5 段逐级收分的扭曲棱柱，段间错位；竖向溶沟（深色细条）；顶部一撮苔草 */
export function karstPinnacle(w: number, h: number, seed = 1, color = '#b9b4ab'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const segs = 3 + Math.floor(r() * 3);
  let y = 0;
  let rad = w / 2;
  let ox = 0;
  let oz = 0;
  for (let s = 0; s < segs; s++) {
    const sh = (h / segs) * (0.8 + r() * 0.4);
    const top = rad * (0.62 + r() * 0.16);
    const sides = 5 + Math.floor(r() * 3);
    const g = new THREE.CylinderGeometry(top, rad, sh, sides, 2);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = 0.85 + r() * 0.3;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
    }
    p.solid.push(paint(g.rotateY(r() * 6.28).translate(ox, y + sh / 2, oz), s % 2 ? color : shade(color, -0.06)));
    // 溶沟：沿柱身的深色细条
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      const rr = (rad + top) / 2;
      p.solid.push(boxAt(0.12, sh * 0.85, 0.12, shade(color, -0.25), ox + Math.cos(a) * rr * 0.98, y + sh / 2, oz + Math.sin(a) * rr * 0.98, -a));
    }
    y += sh * 0.96;
    rad = top;
    ox += (r() - 0.5) * rad * 0.35;
    oz += (r() - 0.5) * rad * 0.35;
  }
  // 顶部苔草
  for (let k = 0; k < 3; k++) p.solid.push(sphere(rad * (0.5 + r() * 0.3), k % 2 ? '#6f8f4f' : '#5f7d45', ox + (r() - 0.5) * rad, y + rad * 0.2, oz + (r() - 0.5) * rad, 1, 0.45, 1, 0));
  // 柱脚碎石
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    p.solid.push(sphere(w * (0.1 + r() * 0.08), shade(color, -0.1), Math.cos(a) * w * 0.6, 0.1, Math.sin(a) * w * 0.6, 1, 0.6, 1, 0));
  }
  return p;
}

/** 枯树：弯曲主干 + 2–4 根分叉枝（每根再分一次），根部外露；bleached = 晒白的沙丘枯木 */
export function deadTree(h: number, seed = 1, variant = 'marsh'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const bark = variant === 'bleached' ? '#cfc4ae' : r() > 0.5 ? '#4a4038' : '#3d3631';
  const lean = r() * Math.PI * 2;
  let prev = V(0, 0, 0);
  const trunk: THREE.Vector3[] = [prev];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    const cur = V(Math.sin(lean) * t * h * 0.12 + (r() - 0.5) * 0.3, t * h * 0.7, Math.cos(lean) * t * h * 0.12 + (r() - 0.5) * 0.3);
    p.solid.push(beam(prev, cur, 0.28 * (1 - t * 0.55), bark, 6));
    trunk.push(cur);
    prev = cur;
  }
  const nb = 2 + Math.floor(r() * 3);
  for (let b = 0; b < nb; b++) {
    const from = trunk[2 + Math.floor(r() * 3)]!;
    const a = r() * Math.PI * 2;
    const len = h * (0.25 + r() * 0.2);
    const tip = V(from.x + Math.cos(a) * len, from.y + len * (0.4 + r() * 0.5), from.z + Math.sin(a) * len);
    p.solid.push(beam(from, tip, 0.1, bark, 5));
    for (let s = 0; s < 2; s++) {
      const a2 = a + (s ? 0.7 : -0.7);
      const l2 = len * 0.45;
      p.solid.push(beam(tip, V(tip.x + Math.cos(a2) * l2, tip.y + l2 * 0.5, tip.z + Math.sin(a2) * l2), 0.05, bark, 4));
    }
  }
  // 外露树根
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    p.solid.push(beam(V(0, 0.4, 0), V(Math.cos(a) * 1.1, -0.1, Math.sin(a) * 1.1), 0.12, bark, 4));
  }
  // 沼泽枯树挂着灰绿色的松萝
  if (variant !== 'bleached')
    for (let k = 0; k < 3; k++) {
      const at = trunk[2 + (k % 3)]!;
      p.solid.push(boxAt(0.5, 1.1 + r() * 0.6, 0.06, '#7d8b6a', at.x + (r() - 0.5) * 0.6, at.y - 0.6, at.z + (r() - 0.5) * 0.6, r() * 3));
    }
  return p;
}

/** 墓碑：slab 平板 / round 圆顶 / cross 十字；底座 + 苔斑，略微倾斜 */
export function tombstone(w: number, h: number, variant = 'slab', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const stone = r() > 0.5 ? '#8e8a90' : '#7c7882';
  const tilt = (r() - 0.5) * 0.18;
  p.solid.push(boxAt(w * 1.25, 0.25, 0.7, shade(stone, -0.15), 0, 0.12, 0));
  if (variant === 'cross') {
    p.solid.push(boxAt(0.28, h, 0.24, stone, 0, h / 2 + 0.25, 0, 0, tilt));
    p.solid.push(boxAt(w * 0.8, 0.24, 0.24, stone, 0, h * 0.72 + 0.25, 0, 0, tilt));
  } else {
    const bodyH = variant === 'round' ? h - w / 2 : h;
    p.solid.push(boxAt(w, bodyH, 0.26, stone, 0, bodyH / 2 + 0.25, 0, 0, tilt));
    if (variant === 'round') {
      const g = new THREE.CylinderGeometry(w / 2, w / 2, 0.26, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
      p.solid.push(paint(g.translate(0, bodyH + 0.25, 0), stone));
    }
    // 碑文刻痕
    for (let k = 0; k < 3; k++) p.solid.push(boxAt(w * 0.55, 0.05, 0.02, shade(stone, -0.35), 0, bodyH * (0.45 + k * 0.14) + 0.25, 0.14));
  }
  for (let k = 0; k < 2; k++) p.solid.push(sphere(0.14 + r() * 0.08, '#5f7348', (r() - 0.5) * w, 0.3 + r() * 0.3, 0.15, 1, 0.5, 0.4, 0));
  return p;
}

/** 玻璃晶簇：5–9 根六棱晶柱从一点向外倾斜，晶尖为锥；中心一根最高，晶尖发出微光 */
export function glassCrystal(w: number, h: number, seed = 1, color = '#8fdcdc'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = 5 + Math.floor(r() * 5);
  for (let k = 0; k < n; k++) {
    const main = k === 0;
    const len = main ? h : h * (0.35 + r() * 0.45);
    const rad = main ? w * 0.18 : w * (0.08 + r() * 0.07);
    const tiltA = r() * Math.PI * 2;
    const tilt = main ? r() * 0.12 : 0.3 + r() * 0.5;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sin(tiltA) * tilt, 0, Math.cos(tiltA) * tilt, 'XYZ'));
    const c = k % 3 === 0 ? color : shade(color, k % 3 === 1 ? 0.12 : -0.1);
    const body = new THREE.CylinderGeometry(rad, rad * 1.05, len * 0.8, 6).translate(0, len * 0.4, 0).applyMatrix4(m);
    const tip = new THREE.ConeGeometry(rad, len * 0.2, 6).translate(0, len * 0.9, 0).applyMatrix4(m);
    p.solid.push(paint(body, c));
    p.solid.push(paint(tip, shade(c, 0.18)));
    if (main || r() > 0.6) {
      const tipPos = new THREE.Vector3(0, len, 0).applyMatrix4(m);
      p.glow.push(sphere(rad * 0.45, '#dffcff', tipPos.x, tipPos.y - rad * 0.3, tipPos.z, 1, 1, 1, 0));
    }
  }
  // 底座：玻璃沙堆
  p.solid.push(sphere(w * 0.45, '#cfeee8', 0, 0, 0, 1, 0.3, 1, 1));
  return p;
}

/** 鬼火：悬浮的冷色火团（内核 + 外焰 + 两颗小火星），只有发光部件，没有碰撞 */
export function wisp(h: number, color = '#8fe8ff', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.glow.push(sphere(0.22, '#ffffff', 0, h, 0, 1, 1.2, 1, 1));
  p.glow.push(sphere(0.38, color, 0, h + 0.08, 0, 1, 1.5, 1, 1));
  p.glow.push(paint(new THREE.ConeGeometry(0.26, 0.6, 6).translate(0, h + 0.55, 0), color));
  for (let k = 0; k < 2; k++) p.glow.push(sphere(0.07, color, (r() - 0.5) * 1.2, h + (r() - 0.5) * 0.8, (r() - 0.5) * 1.2, 1, 1, 1, 0));
  return p;
}
