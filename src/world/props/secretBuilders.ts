/**
 * M4 · 秘境岛专用构件（与 builders / townBuilders / thunderBuilders / glazeBuilders 同约定：
 * 局部坐标，y = 0 为地面，正面朝 +Z；solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 寐龙镇（M4-03）：dragonSkeleton 巨兽龙骨化石、roostHouse 岩窟民居、gymDragon 龙渊道馆
 * - 月魇镇（M4-04）构件届时追加
 */
import * as THREE from 'three';
import { box, cyl, paint } from './builders';
import { boxAt, chimney, doorAt, evenly, gable, rng, shade, V, windowAt, windowCount } from './townBuilders';
import type { PropParts } from './builders';

const newParts = (): PropParts => ({ solid: [], glow: [] });
const BONE = '#e8e0c8';
const BONE2 = '#d4c9a8';
const ROCK = '#7a6f66';
const EMBER = '#ffd59a';

/**
 * 龙骨化石：半埋的巨兽骨架，尾 → 脊椎拱起 → 肋骨拱廊 → 头骨（朝 +Z）。
 * 中央三段肋骨刻意收拢，形成可以从腹腔下穿过的骨拱。
 * 参数：len 身长（沿局部 +Z 展开）、h 拱顶高度、seed。
 */
export function dragonSkeleton(len: number, h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const bones = (g: THREE.BufferGeometry, x: number, y: number, z: number, c = BONE): void => {
    p.solid.push(paint(g, c, new THREE.Matrix4().makeTranslation(x, y, z)));
  };
  // 半埋的浅土丘
  p.solid.push(paint(new THREE.CircleGeometry(len * 0.6, 26).rotateX(-Math.PI / 2).scale(1, 1, 1.2), '#6e6552'));
  const z0 = -len * 0.5;
  // —— 尾椎：贴地拖行，逐节变粗 ——
  const tailN = 9;
  for (let i = 0; i < tailN; i++) {
    const t = i / (tailN - 1);
    const rad = 0.16 + 0.46 * t;
    const y = 0.22 + (h * 0.3 - 0.22) * Math.pow(t, 1.8);
    const z = z0 + t * len * 0.24;
    bones(new THREE.SphereGeometry(rad, 9, 7).scale(1, 0.9, 1.35), (r() - 0.5) * 0.5, y, z, t > 0.6 ? BONE : BONE2);
    if (i % 2 === 0) bones(new THREE.ConeGeometry(rad * 0.55, rad * 2.6, 5).rotateZ(Math.PI * 0.42), 0, y + rad * 1.15, z, BONE2);
  }
  // —— 脊椎：骨盆之后抬到拱顶再俯向颈部 ——
  const spineTop = (t: number) => h * (0.34 + 0.66 * Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.1) / 0.86, 0, 1)) ** 1.3);
  const spineN = 13;
  for (let i = 0; i < spineN; i++) {
    const t = i / (spineN - 1);
    const rad = 0.5 + 0.3 * Math.sin(Math.PI * t);
    const z = z0 + len * 0.24 + t * len * 0.54;
    const y = spineTop(t);
    bones(new THREE.SphereGeometry(rad, 10, 8).scale(0.9, 1, 1.25), 0, y, z);
    bones(new THREE.ConeGeometry(rad * 0.4, rad * (2.6 - t), 4).rotateX(-0.7), 0, y + rad * 1.3, z - rad, BONE2);
  }
  // —— 肋骨拱 ——
  const ribN = 7;
  for (let i = 0; i < ribN; i++) {
    const t = i / (ribN - 1);
    const z = z0 + len * 0.3 + t * len * 0.44;
    const top = spineTop(0.24 + t * 0.6) + 0.1;
    // 中央三段张开成大拱门，两端收拢
    const open = i >= 2 && i <= 4 ? 1 : 0.52;
    for (const s of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      const seg = 10;
      for (let k = 0; k <= seg; k++) {
        const u = k / seg;
        const outX = s * (0.8 + Math.sin(Math.PI * u) * 2.6) * (0.55 + 0.75 * open) * (i === 0 || i === ribN - 1 ? 0.75 : 1);
        pts.push(V(outX, top * (1 - u) + 0.1, z + Math.sin(Math.PI * u) * 0.35));
      }
      bones(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.24 + 0.08 * Math.sin(Math.PI * t), 6, false), 0, 0, 0, i % 2 ? BONE2 : BONE);
    }
  }
  // —— 骨盆 ——
  for (const s of [-1, 1]) {
    bones(new THREE.BoxGeometry(0.5, 1.9, 2.6).rotateZ(s * 0.42).rotateX(0.12), s * 1.1, spineTop(0.06) + 0.55, z0 + len * 0.27);
  }
  // —— 头骨：长吻俯地、张口露齿、冠角后掠（可当作门） ——
  {
    const zf = z0 + len * 0.5;
    const y = h * 0.3 + 0.7;
    bones(new THREE.SphereGeometry(1.15, 12, 9).scale(1, 0.95, 1.6).rotateX(-0.22), 0, y, zf + 0.1);
    bones(new THREE.ConeGeometry(0.72, 2.6, 8).rotateX(Math.PI / 2 - 0.28), 0, y - 0.22, zf + 2.1, BONE2);
    bones(new THREE.BoxGeometry(0.9, 0.28, 2.1).rotateX(0.22), 0, y - 0.95, zf + 1.5, BONE2);
    for (let k = 0; k < 6; k++) {
      for (const s of [-1, 1]) bones(new THREE.ConeGeometry(0.07, 0.32, 4).rotateX(Math.PI), s * 0.4, y - 0.6 - (k % 2) * 0.04, zf + 1.2 + k * 0.3, '#f4efdd');
    }
    for (const s of [-1, 1]) {
      bones(new THREE.CircleGeometry(0.24, 10).rotateY(s * 0.62).translate(s * 0.8, y + 0.32, zf + 0.72), 0, 0, 0, '#2a2530');
      p.glow.push(paint(new THREE.SphereGeometry(0.1, 8, 6), '#b99aff', new THREE.Matrix4().makeTranslation(s * 0.78, y + 0.32, zf + 0.78)));
      const horn = [V(s * 0.5, y + 0.95, zf - 0.2), V(s * 0.95, y + 1.8, zf - 1.4), V(s * 0.72, y + 1.6, zf - 2.7)];
      bones(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(horn), 10, 0.16, 5, false), 0, 0, 0, BONE2);
    }
  }
  // —— 散落碎骨 ——
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2;
    const rr = len * (0.3 + r() * 0.16);
    bones(new THREE.CylinderGeometry(0.1, 0.15, 0.9 + r() * 0.8, 6).rotateZ(1.4 + r() * 0.5), Math.cos(a) * rr * 0.7, 0.12, Math.sin(a) * rr * 0.4 + 1, BONE2);
  }
  return p;
}

/**
 * 岩窟屋：崖壁前的粗石民居——下砌毛石、上木构、陡草顶，
 * 门楣架两截小兽肋，屋顶一排陶罐，檐下一盏灯笼。
 */
export function roostHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = '#8a5a3a'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const baseH = 0.45;
  const wallH = h * 0.6;
  // 石基 + 毛石主体
  p.solid.push(box(w + 0.6, baseH, d + 0.6, shade(ROCK, -0.08), 0, baseH / 2, 0));
  p.solid.push(box(w, wallH, d, ROCK, 0, baseH + wallH / 2, 0));
  for (const y of [baseH + wallH * 0.3, baseH + wallH * 0.74]) p.solid.push(box(w + 0.06, 0.15, d + 0.06, shade(ROCK, -0.1), 0, y, 0));
  for (let k = 0; k < 14; k++) {
    const face = k % 2 ? 1 : -1;
    const z = -d / 2 + 0.6 + r() * (d - 1.2);
    const y = baseH + 0.5 + r() * (wallH - 1);
    p.solid.push(boxAt(0.5 + r() * 0.5, 0.34, 0.7 + r() * 0.4, shade(wall, 0.12 + r() * 0.14), face * (w / 2 + 0.05), y, z, face * 0.05));
  }
  // 上部木构 + 陡悬山草顶
  const timY = baseH + wallH;
  p.solid.push(box(w * 0.88, h * 0.18, d * 0.88, '#6a5140', 0, timY + h * 0.09, 0));
  gable(p, w * 1.24, h * 0.34, d * 1.2, timY + h * 0.16, roof, '#5a4433', 0.25, BONE2);
  // 门：深色木门 + 雨棚，门楣上横架两截兽肋
  doorAt(p, w, d, 0, { color: '#3f3126', frame: accent, width: 1.5, height: 2.3, canopy: roof, step: shade(ROCK, 0.18) });
  p.solid.push(boxAt(2.0, 0.15, 0.15, BONE2, 0, 3.3, d / 2 + 0.2, 0.07));
  p.solid.push(boxAt(1.5, 0.12, 0.12, BONE2, 0.1, 3.5, d / 2 + 0.18, -0.06));
  // 暖光格窗
  const n = Math.max(1, windowCount(w));
  for (const u of evenly(w * 0.72, n, true)) windowAt(p, 'front', w, d, u, baseH + wallH * 0.55, { warm: true, size: [1, 0.9], frame: accent });
  // 屋顶陶罐 + 烟囱
  for (let k = 0; k < 3; k++) p.solid.push(cyl(0.2, 0.15, 0.45, 8, k === 1 ? '#8a5a3a' : '#7a4a36', -w * 0.2 + k * w * 0.2, timY + h * 0.42, -d * 0.28));
  chimney(p, w * 0.3, timY + h * 0.28, -d * 0.18, 1.5, '#6a6158');
  // 墙脚柴垛、骨桩、檐下灯笼
  p.solid.push(boxAt(0.9, 0.7, 0.5, '#54402f', -w / 2 - 0.6, 0.35, -d * 0.25, 0.1));
  p.solid.push(cyl(0.09, 0.12, 1.15, 6, BONE2, w / 2 + 0.7, 0.57, d * 0.32));
  p.glow.push(paint(new THREE.SphereGeometry(0.15, 8, 6), EMBER, new THREE.Matrix4().makeTranslation(w * 0.42, 2.65, d / 2 + 0.5)));
  return p;
}

/**
 * 龙渊道馆：嵌在崖壁前的石厅。正门罩着一具低头的巨龙头骨，张开的口腔就是大门；
 * 脊顶立一排骨刺，檐下两盏骨框灯笼，两侧盘鳞纹龙柱、柱顶蹲石龙。
 */
export function gymDragon(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  const baseH = 0.6;
  const wallH = h * 0.5;
  const wallC = '#655d6e';
  // 台基 + 石厅主体（正面竖凿痕）
  p.solid.push(box(w + 1.6, baseH, w + 1.6, shade(ROCK, -0.06), 0, baseH / 2, 0));
  p.solid.push(box(w, wallH, w, wallC, 0, baseH + wallH / 2, 0));
  for (let k = -half + 0.8; k < half; k += 1.5) p.solid.push(boxAt(0.12, wallH * 0.88, 0.1, shade(wallC, 0.08), k, baseH + wallH / 2, half + 0.03));
  p.solid.push(box(w + 0.5, 0.3, w + 0.5, shade(wallC, -0.1), 0, baseH + wallH + 0.15, 0));
  // 骨脊顶
  const roofY = baseH + wallH + 0.3;
  p.solid.push(box(w * 0.64, h * 0.15, w * 0.92, '#4f4960', 0, roofY + h * 0.075, 0));
  for (let i = 0; i < 6; i++) {
    const z = -w * 0.34 + i * w * 0.14;
    const s0 = 0.85 - Math.abs(i - 2.5) * 0.1;
    for (const s of [-1, 1]) p.solid.push(paint(new THREE.ConeGeometry(0.2 * s0, 1.1 * s0, 5).rotateX(s * 0.35), BONE, new THREE.Matrix4().makeTranslation(s * w * 0.32, roofY + 0.5 * s0, z)));
  }
  // 龙颅门罩
  const skullZ = half + 0.5;
  const skullY = baseH + wallH * 0.72;
  p.solid.push(paint(new THREE.SphereGeometry(w * 0.3, 14, 10).scale(1.05, 0.92, 1.15).rotateX(-0.28), BONE, new THREE.Matrix4().makeTranslation(0, skullY + w * 0.05, skullZ - w * 0.14)));
  for (const s of [-1, 1]) {
    // 上颌 + 张开的下颌 + 两排牙齿
    p.solid.push(paint(new THREE.BoxGeometry(w * 0.1, h * 0.07, w * 0.42).rotateX(0.3), BONE2, new THREE.Matrix4().makeTranslation(s * w * 0.13, skullY - h * 0.02, skullZ + w * 0.22)));
    p.solid.push(paint(new THREE.BoxGeometry(w * 0.09, h * 0.045, w * 0.36).rotateX(-0.4), BONE2, new THREE.Matrix4().makeTranslation(s * w * 0.12, skullY - h * 0.15, skullZ + w * 0.19)));
    for (let k = 0; k < 5; k++) {
      const tz = skullZ + w * (0.08 + k * 0.075);
      p.solid.push(paint(new THREE.ConeGeometry(0.09, 0.3, 4).rotateX(Math.PI), '#f4efdd', new THREE.Matrix4().makeTranslation(s * w * 0.08, skullY - h * 0.07, tz)));
    }
    // 发光眼孔
    p.solid.push(paint(new THREE.CircleGeometry(w * 0.05, 10).rotateY(s * 0.55), '#241f2c', new THREE.Matrix4().makeTranslation(s * w * 0.21, skullY + w * 0.08, skullZ + w * 0.01)));
    p.glow.push(paint(new THREE.SphereGeometry(w * 0.026, 8, 6), '#ffb347', new THREE.Matrix4().makeTranslation(s * w * 0.21, skullY + w * 0.08, skullZ + 0.05)));
  }
  // 冠角
  for (const s of [-1, 1]) {
    const a = V(s * w * 0.2, skullY + w * 0.22, skullZ - w * 0.12);
    const b = V(s * w * 0.33, skullY + w * 0.58, skullZ - w * 0.72);
    p.solid.push(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(V(0, w * 0.08, 0)), b]), 12, 0.2, 6, false), BONE2));
  }
  // 口腔大门：暗门洞 + 内透暖光 + 石阶
  p.solid.push(box(2.6, 2.9, 0.14, '#2a2330', 0, baseH + 1.45, half - 0.05));
  p.glow.push(box(2.2, 2.5, 0.05, '#ffcf8a', 0, baseH + 1.35, half - 0.13));
  p.solid.push(box(4.4, 0.2, 1.1, shade(ROCK, 0.16), 0, baseH - 0.12, half + 1.05));
  p.solid.push(box(3.6, 0.2, 0.9, shade(ROCK, 0.24), 0, baseH - 0.32, half + 1.9));
  // 盘鳞龙柱 + 柱顶石龙
  for (const s of [-1, 1]) {
    const cx = s * (half + 1.9);
    p.solid.push(cyl(0.4, 0.5, h * 0.4, 12, '#57506a', cx, baseH + h * 0.2, half - 0.3));
    for (let k = 0; k < 7; k++) p.solid.push(paint(new THREE.TorusGeometry(0.43, 0.07, 5, 14).rotateX(Math.PI / 2 + 0.4).translate(cx, baseH + 0.5 + k * h * 0.052, half - 0.3), BONE2));
    p.solid.push(paint(new THREE.SphereGeometry(0.28, 8, 6).scale(1.3, 0.8, 1), '#57506a', new THREE.Matrix4().makeTranslation(cx, baseH + h * 0.4 + 0.18, half - 0.3)));
    p.solid.push(paint(new THREE.ConeGeometry(0.15, 0.32, 5).rotateX(-0.5), '#57506a', new THREE.Matrix4().makeTranslation(cx, baseH + h * 0.4 + 0.3, half - 0.1)));
  }
  // 檐下骨框灯笼
  for (const s of [-1, 1]) {
    p.solid.push(boxAt(0.08, 0.7, 0.08, '#3a3244', s * 2.1, baseH + wallH - 0.35, half + 0.6));
    p.glow.push(boxAt(0.32, 0.4, 0.32, '#ffc36a', s * 2.1, baseH + wallH - 0.85, half + 0.6));
  }
  // 两侧小窗
  for (const s of [-1, 1]) p.solid.push(paint(new THREE.PlaneGeometry(1.1, 1.3).rotateY(s * Math.PI / 2), '#33405a', new THREE.Matrix4().makeTranslation(s * (half + 0.03), baseH + wallH * 0.5, 0)));
  return p;
}

// ———————————————————————— M4-04 · 月魇镇 ————————————————————————

const MOON = '#cfd6f2';
const NIGHT = '#3c3654';

/**
 * 魇屋：夜里随镇子一起浮现的旧式镇屋——歪斜的深色粉墙、瘦高的月光窗、
 * 山墙上开一弯月窗，屋檐挂一串小灯，门缝透出淡紫的光。
 */
export function wraithHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = '#7a5bd6'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const lean = (r() - 0.5) * 0.035; // 每栋屋子的独属歪斜
  const wallH = h * 0.62;
  const g = (geo: THREE.BufferGeometry, x: number, y: number, z: number, c: string, rz = lean): void => {
    const m = new THREE.Matrix4().makeRotationZ(rz).setPosition(x, y + Math.abs(x) * rz * 0.6, z);
    p.solid.push(paint(geo, c, m));
  };
  // 石基 + 粉墙（下宽上收）
  g(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), 0, 0.2, 0, shade(wall, -0.16));
  g(new THREE.BoxGeometry(w, wallH, d), 0, 0.4 + wallH / 2, 0, wall);
  // 墙皮剥落斑
  for (let k = 0; k < 7; k++) {
    const side = k % 2 ? 1 : -1;
    g(new THREE.BoxGeometry(0.06, 0.5 + r() * 0.7, 0.7 + r() * 0.9, ), side * (w / 2 + 0.02), 0.8 + r() * (wallH - 1.4), -d / 2 + 0.8 + r() * (d - 1.6), shade(wall, -0.2 - r() * 0.1));
  }
  // 瘦高的月光窗（正面两个 + 山墙一个）
  for (const s of [-1, 1]) {
    const wx = s * w * 0.26;
    g(new THREE.BoxGeometry(0.7, 1.7, 0.1), wx, 0.4 + wallH * 0.52, d / 2 + 0.05, '#1d1a2e');
    p.glow.push(paint(new THREE.BoxGeometry(0.52, 1.5, 0.05), MOON, new THREE.Matrix4().makeTranslation(wx, 0.4 + wallH * 0.52, d / 2 + 0.07)));
    g(new THREE.BoxGeometry(0.9, 0.12, 0.16), wx, 0.4 + wallH * 0.52 + 0.92, d / 2 + 0.06, accent === '#7a5bd6' ? '#54497e' : accent);
  }
  // 门：窄而高，门缝透光
  g(new THREE.BoxGeometry(1.25, 2.35, 0.14), 0, 1.17, d / 2 + 0.04, '#241f38');
  p.glow.push(paint(new THREE.BoxGeometry(0.14, 2.1, 0.05), '#b99aff', new THREE.Matrix4().makeTranslation(0.3, 1.1, d / 2 + 0.13)));
  g(new THREE.BoxGeometry(1.65, 0.14, 0.2), 0, 2.4, d / 2 + 0.08, shade(wall, -0.2));
  // 陡屋顶 + 山墙月窗
  const roofY = 0.4 + wallH;
  gable(p, w * 1.2, h * 0.42, d * 1.2, roofY, roof, shade(wall, -0.1), 0.2);
  {
    const m = new THREE.Matrix4().makeRotationZ(lean).setPosition(0, roofY + h * 0.16, d * 0.615);
    p.solid.push(paint(new THREE.RingGeometry(0.26, 0.46, 16, 1, 0.55, Math.PI * 1.6).rotateZ(0.9), MOON, m));
  }
  // 檐下小灯串（三盏）+ 门前石阶
  for (let k = -1; k <= 1; k++) {
    const lx = k * (w * 0.3);
    const ly = roofY - 0.25 - Math.abs(k) * -0.06;
    g(new THREE.BoxGeometry(0.05, 0.3, 0.05), lx, ly + 0.25, d / 2 + 0.3, '#2c2740');
    p.glow.push(paint(new THREE.SphereGeometry(0.12, 8, 6), k === 0 ? '#c9e07a' : '#9ac2ff', new THREE.Matrix4().makeTranslation(lx, ly, d / 2 + 0.3)));
  }
  g(new THREE.BoxGeometry(2.0, 0.14, 0.7), 0, 0.07, d / 2 + 0.75, shade(wall, -0.24));
  // 屋顶歪烟囱 + 山墙小月晷
  g(new THREE.BoxGeometry(0.5, 1.15, 0.5), -w * 0.28, roofY + h * 0.42, -d * 0.2, '#4a445e', lean * 1.6);
  return p;
}

/**
 * 魇月道馆：夜之镇北端的黑石圆塔。塔身微微倾斜，顶上一弯巨大的月环
 * （glow，夜里整镇浮现时它就是灯塔）；入口是瘦长的紫缝拱门，
 * 环绕塔基浮着一圈大小不一的失眠石碑，石阶两侧一排地灯。
 */
export function gymMoon(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  // 环形石台 + 三层塔身（逐层收分、整体微倾）
  const tilt = 0.03;
  p.solid.push(paint(new THREE.CylinderGeometry(half + 2.2, half + 2.8, 0.7, 26), '#37324a', new THREE.Matrix4().makeTranslation(0, 0.35, 0)));
  const tiers: Array<[number, number, number, string]> = [
    [half, half * 0.94, h * 0.4, NIGHT],
    [half * 0.94, half * 0.78, h * 0.3, '#453e60'],
    [half * 0.78, half * 0.6, h * 0.24, NIGHT],
  ];
  let y = 0.7;
  let xo = 0;
  for (const [rb, rt, th, c] of tiers) {
    p.solid.push(paint(new THREE.CylinderGeometry(rt, rb, th, 22).translate(xo + (xo - 0) * 0.0, 0, 0), c, new THREE.Matrix4().makeRotationZ(tilt).setPosition(xo + Math.tan(tilt) * (y + th / 2) * 0.0, y + th / 2, 0)));
    // 每层的暗色腰线 + 竖窄缝窗（透光）
    p.solid.push(paint(new THREE.CylinderGeometry(rt + 0.06, rt + 0.06, 0.16, 22), '#2b2740', new THREE.Matrix4().makeTranslation(xo, y + th - 0.1, 0)));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      const sl = paint(new THREE.BoxGeometry(0.14, th * 0.6, 0.1), '#b99aff', new THREE.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * (rb - 0.05), y + th * 0.5, Math.sin(a) * (rb - 0.05)));
      p.glow.push(sl);
    }
    y += th;
    xo += Math.sin(tilt) * th;
  }
  // 顶冠：平台 + 巨大月环（发光，整组随镇子夜晚浮现）
  p.solid.push(paint(new THREE.CylinderGeometry(half * 0.72, half * 0.66, 0.35, 20), '#2b2740', new THREE.Matrix4().makeTranslation(xo, y + 0.15, 0)));
  {
    // XY 平面圆环默认朝 +Z：正对南向街道，夜里从街口就能看到那弯月
    p.glow.push(paint(new THREE.RingGeometry(h * 0.16, h * 0.2, 30, 1, 0.5, Math.PI * 1.9).scale(1, 1.25, 1), MOON, new THREE.Matrix4().makeTranslation(xo, y + h * 0.26, 0)));
    // 月环内侧再叠一圈暖白芯，夜里远景不糊
    p.glow.push(paint(new THREE.RingGeometry(h * 0.185, h * 0.198, 30, 1, 0.35, Math.PI * 1.55).scale(1, 1.25, 1), '#ffffff', new THREE.Matrix4().makeTranslation(xo, y + h * 0.26, 0)));
  }
  // 塔身攀带：一道绕塔的深紫饰带 + 三面上挑檐
  for (const a of [0, 2.1, 4.2]) {
    const eave = paint(new THREE.ConeGeometry(half * 0.5, h * 0.1, 4, 1, true).rotateX(0.15), '#2b2740', new THREE.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * half * 0.8, y - h * 0.06, Math.sin(a) * half * 0.8));
    p.solid.push(eave);
  }
  // 正门（+Z）：瘦长的紫缝拱门 + 门框双碑
  {
    const z = half + 0.1;
    p.solid.push(paint(new THREE.BoxGeometry(2.3, 3.4, 0.5), '#241f38', new THREE.Matrix4().makeTranslation(0, 1.7, z)));
    p.glow.push(paint(new THREE.BoxGeometry(0.55, 3.2, 0.08), '#b99aff', new THREE.Matrix4().makeTranslation(0, 1.7, z + 0.28)));
    p.solid.push(paint(new THREE.TorusGeometry(1.15, 0.16, 6, 16, Math.PI).rotateY(Math.PI / 2), '#4a445e', new THREE.Matrix4().makeTranslation(0, 3.45, z)));
    for (const s of [-1, 1]) p.solid.push(paint(new THREE.BoxGeometry(0.5, 4.4, 0.5), '#453e60', new THREE.Matrix4().makeTranslation(s * 1.9, 2.2, z - 0.15)));
    // 石阶 + 地灯
    for (let k = 0; k < 3; k++) p.solid.push(paint(new THREE.BoxGeometry(4.6 - k * 0.5, 0.24, 0.9), '#37324a', new THREE.Matrix4().makeTranslation(0, 0.72 - k * 0.24, z + 0.8 + k * 0.85)));
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        p.glow.push(paint(new THREE.SphereGeometry(0.13, 8, 6), '#9ac2ff', new THREE.Matrix4().makeTranslation(s * (2.9 + k * 0.1), 0.9, z + 1.0 + k * 0.85)));
      }
  }
  // 失眠石碑环：大小高矮不一、各自微倾，浮在塔基外圈半米（底座与碑间留缝 = 「悬浮」感）
  const nS = 9;
  for (let k = 0; k < nS; k++) {
    const a = (k / nS) * Math.PI * 2 + 0.35;
    const rr = half + 3.4;
    const hh = 1.1 + ((k * 37) % 10) / 6;
    const m = new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(((k % 3) - 1) * 0.09));
    m.setPosition(Math.cos(a) * rr, 1.35 + hh / 2 + ((k % 2) - 0.5) * 0.18, Math.sin(a) * rr);
    p.solid.push(paint(new THREE.BoxGeometry(0.6, hh, 0.28), '#453e60', m));
    p.solid.push(paint(new THREE.BoxGeometry(0.8, 0.3, 0.4), '#37324a', new THREE.Matrix4().makeTranslation(Math.cos(a) * rr, 0.85, Math.sin(a) * rr)));
  }
  return p;
}
