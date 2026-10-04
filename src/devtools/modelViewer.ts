/**
 * 宝可梦模型展示台（model-viewer.html）：逐只核对手工模型。
 * - 读取 assets/models/pokemon/manifest.json，与游戏内同一套缩放（按图鉴身高 / 体长）、Toon 着色、异色贴图逻辑；
 * - 播放全部动画片段（可暂停、拖动时间轴、调速、显示命中帧），正 / 侧 / 背 / 3/4 / 俯视机位，1.6 m 参照人；
 * - 核对结论（通过 / 需修改 + 备注）保存在 localStorage，可复制或导出 Markdown 交给建模修改。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { toonify } from '@/render/toon/ToonMaterial';
import speciesData from '@/config/data/species.json';

interface Entry {
  id: number;
  name: string;
  heightM: number;
  tris: number;
  clips: string[];
  hitTime: Record<string, number>;
  plan?: string;
  shiny?: string;
  fit?: 'height' | 'length';
  file: string;
  bytes: number;
  rawBytes: number;
}
interface Verdict {
  state: 'ok' | 'bad' | '';
  note: string;
}

const MODEL_DIR = './models/pokemon/';
const NEW_IDS = new Set([12, 18, 20, 26, 44, 45, 61, 62, 73, 99, 157, 182, 186, 260, 279, 571, 724]);
const STORE = 'cuilan.modelReview.v1';
const zh = new Map<number, { zh: string; types: string[]; heightM: number }>(
  (speciesData as { id: number; name: { zh: string }; types: string[]; heightM: number }[]).map((s) => [
    s.id,
    { zh: s.name.zh, types: s.types, heightM: s.heightM },
  ]),
);
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ---------- 场景 ----------
const host = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKIES = [0x10151f, 0x8fc4e8, 0xd8d8d8, 0x3a6a3a];
let sky = 0;
scene.background = new THREE.Color(SKIES[0]);
const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a4030, 1.3));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.position.set(3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0x5a7a4a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(24, 48, 0x000000, 0x000000);
(grid.material as THREE.Material).opacity = 0.18;
(grid.material as THREE.Material).transparent = true;
grid.position.y = 0.002;
scene.add(grid);

// 1.6 m 参照人（简易剪影：腿、躯干、头）+ 刻度杆
const ref = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.9, transparent: true, opacity: 0.55 });
  const add = (g: THREE.BufferGeometry, y: number, x = 0): void => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, 0);
    ref.add(o);
  };
  add(new THREE.CapsuleGeometry(0.06, 0.62, 4, 8), 0.4, 0.08);
  add(new THREE.CapsuleGeometry(0.06, 0.62, 4, 8), 0.4, -0.08);
  add(new THREE.CapsuleGeometry(0.17, 0.4, 4, 12), 1.07);
  add(new THREE.SphereGeometry(0.115, 16, 12), 1.48);
  for (let i = 0; i <= 20; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(i % 5 === 0 ? 0.12 : 0.06, 0.006, 0.006), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    t.position.set(-0.35, i * 0.1, 0);
    ref.add(t);
  }
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.01, 2, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  pole.position.set(-0.35, 1, 0);
  ref.add(pole);
}
scene.add(ref);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();

// ---------- 状态 ----------
let entries: Entry[] = [];
let idx = 0;
let current: { root: THREE.Group; body: THREE.Object3D; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; skel: THREE.SkeletonHelper | null; height: number; width: number } | null = null;
let action: THREE.AnimationAction | null = null;
let clipName = '';
let paused = false;
let speed = 1;
let opts = { shiny: false, toon: true, wire: false, bones: false, ref: true, spin: false };
let view = 'q34';
let loadToken = 0;
// 开发工具页：核对记录只存本浏览器，不进存档系统
// eslint-disable-next-line no-restricted-globals
const reviews: Record<string, Verdict> = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Verdict>;
// eslint-disable-next-line no-restricted-globals
const saveReviews = (): void => localStorage.setItem(STORE, JSON.stringify(reviews));
const verdictOf = (id: number): Verdict => reviews[id] ?? { state: '', note: '' };

// ---------- 列表 ----------
function renderList(): void {
  const q = ($('q') as HTMLInputElement).value.trim().toLowerCase();
  const f = ($('filter') as HTMLSelectElement).value;
  const list = $('list');
  list.innerHTML = '';
  entries.forEach((e, i) => {
    const v = verdictOf(e.id);
    const cn = zh.get(e.id)?.zh ?? '';
    if (q && !(`${e.id}`.includes(q) || cn.includes(q) || e.name.toLowerCase().includes(q))) return;
    if (f === 'todo' && v.state) return;
    if (f === 'ok' && v.state !== 'ok') return;
    if (f === 'bad' && v.state !== 'bad') return;
    if (f === 'new' && !NEW_IDS.has(e.id)) return;
    const d = document.createElement('div');
    d.className = 'it' + (i === idx ? ' on' : '');
    d.innerHTML = `<span class="no">${String(e.id).padStart(3, '0')}</span><span class="nm">${cn}<small>${e.name}</small>${NEW_IDS.has(e.id) ? ' <small style="color:#ffd23a;opacity:1">新</small>' : ''}</span><span class="st">${v.state === 'ok' ? '✅' : v.state === 'bad' ? '❌' : ''}</span>`;
    d.onclick = () => void select(i);
    list.appendChild(d);
  });
  const ok = entries.filter((e) => verdictOf(e.id).state === 'ok').length;
  const bad = entries.filter((e) => verdictOf(e.id).state === 'bad').length;
  $('stats').textContent = `共 ${entries.length} 只 · ✅ ${ok} · ❌ ${bad} · 未核对 ${entries.length - ok - bad}`;
  list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}

// ---------- 加载模型 ----------
async function select(i: number): Promise<void> {
  idx = (i + entries.length) % entries.length;
  const e = entries[idx]!;
  const token = ++loadToken;
  renderList();
  const cn = zh.get(e.id);
  $('tname').textContent = `#${String(e.id).padStart(3, '0')} ${cn?.zh ?? ''} ${e.name}`;
  $('tsub').textContent = '加载中…';
  const gltf = await loader.loadAsync(MODEL_DIR + e.file);
  if (token !== loadToken) return;
  if (current) {
    scene.remove(current.root);
    if (current.skel) scene.remove(current.skel);
    current.mixer.stopAllAction();
  }
  const body = gltf.scene;
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const h = e.heightM;
  const s = e.fit === 'length' ? (h - 0.15) / Math.max(1e-4, size.z) : size.y > 1e-4 ? h / size.y : 1;
  body.scale.multiplyScalar(s);
  body.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  const root = new THREE.Group();
  root.add(body);
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    m.userData.srcMaterial = m.material;
  });
  scene.add(root);
  const mixer = new THREE.AnimationMixer(body);
  current = { root, body, mixer, clips: gltf.animations, skel: null, height: size.y * s, width: Math.max(size.x, size.z) * s };
  ref.position.set(-Math.max(0.6, current.width * 0.75 + 0.4), 0, 0);
  await applyLook();
  if (token !== loadToken) return;
  // 片段按钮
  const wrap = $('clips');
  wrap.innerHTML = '';
  const names = gltf.animations.map((c) => c.name);
  for (const n of names) {
    const b = document.createElement('button');
    b.textContent = n;
    b.dataset.clip = n;
    b.onclick = () => play(n);
    wrap.appendChild(b);
  }
  play(names.includes(clipName) ? clipName : names.includes('idle') ? 'idle' : (names[0] ?? ''));
  setView(view);
  // 信息
  const tri = e.tris;
  const info: [string, string][] = [
    ['图鉴身高', `${cn?.heightM ?? e.heightM} m`],
    ['展示高度', `${current.height.toFixed(2)} m`],
    ['属性', cn?.types.join(' / ') ?? '—'],
    ['动画模板', e.plan ?? '—'],
    ['缩放方式', e.fit === 'length' ? '按体长' : '按身高'],
    ['三角面', tri.toLocaleString()],
    ['文件', `${(e.bytes / 1024).toFixed(0)} KB（原始 ${(e.rawBytes / 1024).toFixed(0)} KB）`],
    ['动画数', `${names.length}`],
    ['异色', e.shiny ? '调色板贴图' : '色相偏移'],
  ];
  $('info').innerHTML = info.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('tsub').textContent = `${cn?.types.join(' / ') ?? ''} · ${tri.toLocaleString()} 面 · ${names.length} 段动画 · ${current.height.toFixed(2)} m`;
  // 结论
  const v = verdictOf(e.id);
  ($('note') as HTMLTextAreaElement).value = v.note;
  markVerdict(v.state);
}

let shinyTex: THREE.Texture | null = null;
async function applyLook(): Promise<void> {
  if (!current) return;
  const e = entries[idx]!;
  shinyTex = null;
  if (opts.shiny && e.shiny) {
    shinyTex = await texLoader.loadAsync(MODEL_DIR + e.shiny);
    shinyTex.flipY = false;
    shinyTex.colorSpace = THREE.SRGBColorSpace;
    shinyTex.magFilter = THREE.NearestFilter;
  }
  current.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.userData.srcMaterial as THREE.Material | THREE.Material[];
    const conv = (s0: THREE.Material): THREE.Material => {
      const c = (s0 as THREE.MeshStandardMaterial).clone();
      if (opts.shiny) {
        if (shinyTex && c.map) c.map = shinyTex;
        else c.color.offsetHSL(0.45, 0.1, 0.05);
      }
      c.wireframe = opts.wire;
      return c;
    };
    m.material = Array.isArray(src) ? src.map(conv) : conv(src);
  });
  if (opts.toon) toonify(current.root, 'character');
  if (current.skel) scene.remove(current.skel);
  current.skel = null;
  if (opts.bones) {
    current.skel = new THREE.SkeletonHelper(current.body);
    scene.add(current.skel);
  }
  if (opts.toon && opts.wire) current.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) for (const mm of Array.isArray(m.material) ? m.material : [m.material]) (mm as THREE.MeshBasicMaterial).wireframe = true;
  });
}

function play(name: string): void {
  if (!current) return;
  const clip = current.clips.find((c) => c.name === name);
  if (!clip) return;
  clipName = name;
  current.mixer.stopAllAction();
  action = current.mixer.clipAction(clip);
  action.reset().play();
  action.paused = paused;
  document.querySelectorAll<HTMLButtonElement>('#clips button').forEach((b) => b.classList.toggle('on', b.dataset.clip === name));
  const ht = entries[idx]!.hitTime[name];
  $('hit').textContent = ht !== undefined ? `${ht.toFixed(2)} s（共 ${clip.duration.toFixed(2)} s）` : `无（共 ${clip.duration.toFixed(2)} s）`;
}

function setView(v: string): void {
  if (!current) return;
  view = v;
  const h = Math.max(current.height, 0.3);
  const r = Math.max(h, current.width) * 2.6 + 0.6;
  const ty = h * 0.5;
  const dir: Record<string, [number, number, number]> = { front: [0, 0.15, -1], side: [1, 0.15, 0], back: [0, 0.15, 1], q34: [0.7, 0.35, -0.75], top: [0.01, 1, -0.2] };
  const d = new THREE.Vector3(...(dir[v] ?? dir.q34!)).normalize().multiplyScalar(r);
  controls.target.set(0, ty, 0);
  camera.position.set(d.x, ty + d.y, d.z);
  controls.update();
  sun.shadow.camera.left = sun.shadow.camera.bottom = -r;
  sun.shadow.camera.right = sun.shadow.camera.top = r;
  sun.shadow.camera.updateProjectionMatrix();
}

// ---------- 核对 ----------
function markVerdict(state: Verdict['state']): void {
  $('vOk').classList.toggle('on', state === 'ok');
  $('vBad').classList.toggle('on', state === 'bad');
}
function setVerdict(state: Verdict['state']): void {
  const e = entries[idx];
  if (!e) return;
  reviews[e.id] = { state, note: ($('note') as HTMLTextAreaElement).value };
  saveReviews();
  markVerdict(state);
  renderList();
}
function report(): string {
  const lines = ['# 宝可梦模型核对结果', '', `日期：${new Date().toLocaleString()}`, ''];
  const sec = (title: string, pick: (v: Verdict) => boolean): void => {
    const rows = entries.filter((e) => pick(verdictOf(e.id)));
    lines.push(`## ${title}（${rows.length}）`, '');
    for (const e of rows) {
      const v = verdictOf(e.id);
      lines.push(`- #${String(e.id).padStart(3, '0')} ${zh.get(e.id)?.zh ?? ''} ${e.name}${v.note ? `：${v.note.replace(/\n/g, '；')}` : ''}`);
    }
    lines.push('');
  };
  sec('❌ 需修改', (v) => v.state === 'bad');
  sec('✅ 通过', (v) => v.state === 'ok');
  sec('未核对', (v) => !v.state);
  return lines.join('\n');
}

// ---------- 事件 ----------
($('q') as HTMLInputElement).oninput = renderList;
($('filter') as HTMLSelectElement).onchange = renderList;
$('play').onclick = () => togglePause();
function togglePause(): void {
  paused = !paused;
  if (action) action.paused = paused;
  $('play').textContent = paused ? '▶ 播放' : '⏸ 暂停';
}
($('spd') as HTMLInputElement).oninput = (ev) => {
  speed = Number((ev.target as HTMLInputElement).value);
  $('spdv').textContent = `${speed.toFixed(1)}×`;
};
($('timeline') as HTMLInputElement).oninput = (ev) => {
  if (!action) return;
  if (!paused) togglePause();
  action.time = (Number((ev.target as HTMLInputElement).value) / 1000) * action.getClip().duration;
  current?.mixer.update(0);
};
const toggle = (id: string, key: keyof typeof opts, relook: boolean): void => {
  $(id).onclick = () => {
    opts = { ...opts, [key]: !opts[key] };
    $(id).classList.toggle('on', opts[key]);
    if (key === 'ref') ref.visible = opts.ref;
    if (relook) void applyLook();
  };
};
toggle('tShiny', 'shiny', true);
toggle('tToon', 'toon', true);
toggle('tWire', 'wire', true);
toggle('tBones', 'bones', true);
toggle('tRef', 'ref', false);
toggle('tSpin', 'spin', false);
$('tSky').onclick = () => {
  sky = (sky + 1) % SKIES.length;
  scene.background = new THREE.Color(SKIES[sky]);
};
document.querySelectorAll<HTMLButtonElement>('button[data-v]').forEach((b) => (b.onclick = () => setView(b.dataset.v!)));
$('vOk').onclick = () => setVerdict('ok');
$('vBad').onclick = () => setVerdict('bad');
$('vClear').onclick = () => {
  ($('note') as HTMLTextAreaElement).value = '';
  setVerdict('');
};
($('note') as HTMLTextAreaElement).oninput = () => {
  const e = entries[idx];
  if (!e) return;
  reviews[e.id] = { state: verdictOf(e.id).state, note: ($('note') as HTMLTextAreaElement).value };
  saveReviews();
};
$('copy').onclick = () => {
  void navigator.clipboard.writeText(report()).then(
    () => ($('copied').textContent = '已复制，可直接粘贴给我'),
    () => ($('copied').textContent = '复制失败，请用下载'),
  );
};
$('dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([report()], { type: 'text/markdown' }));
  a.download = 'model-review.md';
  a.click();
};
window.addEventListener('keydown', (ev) => {
  if ((ev.target as HTMLElement).tagName === 'TEXTAREA' || (ev.target as HTMLElement).tagName === 'INPUT') return;
  const vis = [...document.querySelectorAll('#list .it')];
  const pos = vis.findIndex((d) => d.classList.contains('on'));
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    const next = vis[pos + (ev.key === 'ArrowDown' ? 1 : -1)] as HTMLElement | undefined;
    if (next) next.click();
    else void select(idx + (ev.key === 'ArrowDown' ? 1 : -1));
  } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
    const names = current?.clips.map((c) => c.name) ?? [];
    const i = names.indexOf(clipName) + (ev.key === 'ArrowRight' ? 1 : -1);
    if (names.length) play(names[(i + names.length) % names.length]!);
  } else if (ev.key === ' ') {
    ev.preventDefault();
    togglePause();
  } else if (ev.key === '1') setVerdict('ok');
  else if (ev.key === '2') {
    setVerdict('bad');
    ($('note') as HTMLTextAreaElement).focus();
  } else if (ev.key === 'f' || ev.key === 'F') setView(view);
});

function resize(): void {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  if (current) {
    current.mixer.update(paused ? 0 : dt * speed);
    if (opts.spin) current.root.rotation.y += dt * 0.6;
    if (action && !paused) ($('timeline') as HTMLInputElement).value = String(Math.round(((action.time % action.getClip().duration) / action.getClip().duration) * 1000));
  }
  controls.update();
  renderer.render(scene, camera);
});

void (async () => {
  const res = await fetch(MODEL_DIR + 'manifest.json');
  entries = ((await res.json()) as { models: Entry[] }).models.sort((a, b) => a.id - b.id);
  const want = Number(new URLSearchParams(location.search).get('id'));
  const start = entries.findIndex((e) => e.id === want);
  await select(start >= 0 ? start : 0);
})();
