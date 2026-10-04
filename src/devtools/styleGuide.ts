/**
 * ART-001 · Toon 风格样张 / 调参页（style-guide.html）。
 * 场景：训练家（程序化灰模）+ 木木枭灰模 + 一小块草地（树、石头、草簇、小屋），真实天空与昼夜光照。
 * 面板里改的参数实时生效；「导出参数」输出 ToonStyle JSON，定稿后粘贴到 src/render/toon/presets.ts。
 * URL：?hour=17.5 指定时间，?lite 低画质，?shot 隐藏面板（截图用）。
 */
import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { dex } from '@/config/data';
import { createRng } from '@/systems/rng';
import { createPokemon } from '@/systems/pokemon';
import {
  DEFAULT_STYLE,
  PostChain,
  QUALITY_PRESETS,
  addHullOutlines,
  applyToonStyle,
  createToonMaterial,
  refreshHullColors,
  setHullOutlineWidth,
  toonGlobals,
  toonify,
  type ToonStyle,
} from '@/render';
import { Sky, WEATHER_VISUALS } from '@/world';
import { broadleafTreeGeometry, bushGeometry, grassClumpGeometry, pineTreeGeometry, rockGeometry } from '@/world/foliage/geometries';
import { TrainerModel } from '@/actors/player';
import { createMonModel } from '@/scenes/battle/BattleActor';

const params = new URLSearchParams(location.search);
const lite = params.has('lite');
const container = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(lite ? 0.75 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 800);
camera.position.set(5.2, 2.6, 6.4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.8, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2.5;
controls.maxDistance = 30;

const quality = structuredClone(QUALITY_PRESETS[lite ? 'low' : 'high']);
quality.shadowRadius = 12;
const sky = new Sky(quality);
scene.add(sky.group);
scene.fog = sky.fog;

// —— 地面：略有起伏的圆形草地 + 土路 ——
const groundGeo = new THREE.CircleGeometry(14, 72, 0, Math.PI * 2).rotateX(-Math.PI / 2);
{
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color('#7cc55a');
  const dirt = new THREE.Color('#d6b77e');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    pos.setY(i, r > 6 ? Math.sin(x * 0.5) * Math.cos(z * 0.4) * 0.35 * ((r - 6) / 8) : 0);
    const path = Math.abs(z - Math.sin(x * 0.3) * 1.2 + 2.5) < 0.9 ? 1 : 0;
    c.copy(grass).lerp(dirt, path);
    col.set([c.r, c.g, c.b], i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  groundGeo.computeVertexNormals();
}
const ground = new THREE.Mesh(groundGeo, createToonMaterial({ color: '#ffffff', kind: 'scene', vertexColors: true }));
ground.receiveShadow = true;
scene.add(ground);

// —— 场景小物件 ——
const scenery = new THREE.Group();
const addMesh = (geo: THREE.BufferGeometry, color: string, x: number, z: number, s = 1, yaw = 0) => {
  const m = new THREE.Mesh(geo, createToonMaterial({ color, kind: 'scene', vertexColors: !!geo.attributes.color }));
  m.position.set(x, 0, z);
  m.scale.setScalar(s);
  m.rotation.y = yaw;
  m.castShadow = true;
  m.receiveShadow = true;
  scenery.add(m);
  return m;
};
addMesh(broadleafTreeGeometry(0), '#ffffff', -4.2, -3.2, 1.2);
addMesh(pineTreeGeometry(0), '#ffffff', 4.8, -4.5, 1.1);
addMesh(broadleafTreeGeometry(0), '#ffffff', 6.5, 1.5, 0.9, 1.2);
addMesh(bushGeometry(), '#5aa845', -2.6, 1.8, 1.1);
addMesh(bushGeometry(), '#5aa845', 2.9, -1.6, 0.8);
addMesh(rockGeometry(3), '#a8a39a', 2.2, 2.4, 0.7);
addMesh(rockGeometry(7), '#a8a39a', -5.5, 2.5, 1.1);
// 小屋（翠澜民居配色：白墙 + 翠绿屋顶）
{
  const house = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), createToonMaterial({ color: '#f4efe4', kind: 'scene' }));
  wall.position.y = 1.1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4, 1), createToonMaterial({ color: '#3fb88a', kind: 'scene' }));
  roof.position.y = 2.9;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.85);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), createToonMaterial({ color: '#8a5a3a', kind: 'scene' }));
  door.position.set(0, 0.6, 1.31);
  for (const m of [wall, roof, door]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  house.add(wall, roof, door);
  house.position.set(-1.5, 0, -6.5);
  house.rotation.y = 0.25;
  scenery.add(house);
}
// 草簇（实例化）
{
  const geo = grassClumpGeometry();
  const mat = createToonMaterial({ color: '#ffffff', kind: 'scene', vertexColors: !!geo.attributes.color });
  const n = lite ? 150 : 500;
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4();
  const rnd = createRng(7);
  let k = 0;
  while (k < n) {
    const a = rnd.next() * Math.PI * 2;
    const r = 2 + Math.sqrt(rnd.next()) * 10;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(z - Math.sin(x * 0.3) * 1.2 + 2.5) < 1.1) continue;
    m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd.next() * 6, 0)), new THREE.Vector3().setScalar(0.7 + rnd.next() * 0.6));
    inst.setMatrixAt(k, m4);
    inst.setColorAt(k++, new THREE.Color().setHSL(0.27 + rnd.next() * 0.05, 0.5, 0.36 + rnd.next() * 0.1));
  }
  inst.receiveShadow = true;
  scenery.add(inst);
}
scene.add(scenery);

// —— 角色与宝可梦 ——
const trainer = new TrainerModel();
trainer.root.position.set(-0.9, 0, 0.4);
trainer.root.rotation.y = 0.5;
trainer.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
scene.add(trainer.root);
const rowlet = createMonModel(dex, createPokemon(dex, 722, 5, createRng(1)));
rowlet.position.set(0.9, 0, 0.6);
rowlet.rotation.y = -0.4;
rowlet.traverse((o) => ((o as THREE.Mesh).castShadow = true));
scene.add(rowlet);
// 参考色板球：三阶色带一目了然
const swatches = new THREE.Group();
['#e8484a', '#f6c945', '#3fb88a', '#3a7bd5', '#f4efe4'].forEach((c, i) => {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), createToonMaterial({ color: c, kind: 'character' }));
  s.position.set(-1.6 + i * 0.8, 0.28, 2.6);
  s.castShadow = true;
  swatches.add(s);
});
toonify(swatches, 'character');
addHullOutlines(swatches);
scene.add(swatches);

const post = new PostChain(renderer, scene, camera);
post.bloomAlways = true;
post.applyQuality(quality);
post.setSize(innerWidth, innerHeight);

// —— 面板 ——
const style: ToonStyle = structuredClone(toonGlobals.style);
const view = { hour: Number(params.get('hour') ?? 10), weather: 'clear' as keyof typeof WEATHER_VISUALS, turntable: false, hullOutline: true, edgeDetect: quality.edgeDetect, bloom: quality.bloom };
const apply = () => {
  applyToonStyle(style);
  setHullOutlineWidth(style.outline.hullWidth);
  refreshHullColors();
  renderer.toneMappingExposure = style.exposure;
  post.applyStyle();
};
const applyQuality = () => {
  quality.hullOutline = view.hullOutline;
  quality.edgeDetect = view.edgeDetect;
  quality.bloom = view.bloom;
  post.applyQuality(quality);
  post.setSize(innerWidth, innerHeight);
  apply();
};
const gui = new GUI({ title: 'Toon 参数' });
const fv = gui.addFolder('视图');
fv.add(view, 'hour', 0, 24, 0.25).name('时间');
fv.add(view, 'weather', Object.keys(WEATHER_VISUALS)).name('天气');
fv.add(view, 'turntable').name('转台');
fv.add(view, 'hullOutline').name('角色描边').onChange(applyQuality);
fv.add(view, 'edgeDetect').name('场景边缘检测').onChange(applyQuality);
fv.add(view, 'bloom').name('Bloom').onChange(applyQuality);
const rampFolder = (name: string, r: ToonStyle['characterRamp']) => {
  const f = gui.addFolder(name);
  f.add(r.thresholds, '0', 0, 1, 0.01).name('阈值 暗→中').onChange(apply);
  f.add(r.thresholds, '1', 0, 1, 0.01).name('阈值 中→亮').onChange(apply);
  f.add(r.levels, '0', 0, 1, 0.01).name('暗部亮度').onChange(apply);
  f.add(r.levels, '1', 0, 1, 0.01).name('中间亮度').onChange(apply);
  f.add(r.levels, '2', 0, 1.5, 0.01).name('亮部亮度').onChange(apply);
  f.addColor(r, 'shadowTint').name('阴影色').onChange(apply);
  f.add(r, 'softness', 0, 0.1, 0.001).name('过渡柔和').onChange(apply);
  f.close();
};
rampFolder('角色色带', style.characterRamp);
rampFolder('场景色带', style.sceneRamp);
const fr = gui.addFolder('边缘光 / 高光');
fr.addColor(style.rim, 'color').name('边缘光色').onChange(apply);
fr.add(style.rim, 'strength', 0, 1.5, 0.01).name('边缘光强度').onChange(apply);
fr.add(style.rim, 'threshold', 0, 1, 0.01).name('边缘光阈值').onChange(apply);
fr.add(style.rim, 'width', 0, 0.3, 0.005).name('边缘光宽度').onChange(apply);
fr.add(style.specular, 'strength', 0, 1.5, 0.01).name('高光强度').onChange(apply);
fr.add(style.specular, 'size', 0.8, 1, 0.001).name('高光大小').onChange(apply);
fr.close();
const fo = gui.addFolder('描边');
fo.add(style.outline, 'hullWidth', 0, 0.01, 0.0001).name('外壳宽度').onChange(apply);
fo.add(style.outline, 'hullDarken', 0, 1, 0.01).name('外壳压暗').onChange(apply);
fo.addColor(style.outline, 'hullTint').name('外壳色调').onChange(apply);
fo.add(style.outline, 'edgeStrength', 0, 1, 0.01).name('边缘强度').onChange(apply);
fo.add(style.outline, 'edgeDepthThreshold', 0.001, 0.05, 0.001).name('深度阈值').onChange(apply);
fo.add(style.outline, 'edgeNormalThreshold', 0.05, 1, 0.01).name('法线阈值').onChange(apply);
fo.addColor(style.outline, 'edgeColor').name('边缘色').onChange(apply);
fo.close();
const fp = gui.addFolder('后处理');
fp.add(style.bloom, 'strength', 0, 2, 0.01).name('Bloom 强度').onChange(apply);
fp.add(style.bloom, 'radius', 0, 1, 0.01).name('Bloom 半径').onChange(apply);
fp.add(style.bloom, 'threshold', 0, 1, 0.01).name('Bloom 阈值').onChange(apply);
fp.add(style, 'exposure', 0.4, 2, 0.01).name('曝光').onChange(apply);
fp.add(style, 'saturation', 0, 2, 0.01).name('饱和度').onChange(apply);
fp.close();
const out = document.getElementById('out') as HTMLTextAreaElement;
gui.add(
  {
    export: () => {
      out.style.display = 'block';
      out.value = JSON.stringify(style, null, 2);
      out.select();
      void navigator.clipboard?.writeText(out.value).catch(() => {});
    },
  },
  'export',
).name('导出参数（复制 JSON）');
gui.add({ reset: () => { Object.assign(style, structuredClone(DEFAULT_STYLE)); gui.controllersRecursive().forEach((c) => c.updateDisplay()); apply(); } }, 'reset').name('恢复默认');
if (params.has('shot')) gui.hide();
apply();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

const wind = new THREE.Vector2(0.8, 0.6).normalize();
const focus = new THREE.Vector3(0, 0, 0);
let last = performance.now();
let t = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  t += dt;
  if (view.turntable) controls.autoRotate = true;
  else controls.autoRotate = false;
  controls.update();
  sky.update(dt, view.hour, focus, camera.position, WEATHER_VISUALS[view.weather], wind);
  trainer.animate(dt, 0, t);
  rowlet.scale.y = 1 + Math.sin(t * 2.2) * 0.025;
  toonGlobals.uniforms.uTime.value = t;
  post.render(dt);
});
(window as unknown as { __styleGuideReady: boolean }).__styleGuideReady = true;
