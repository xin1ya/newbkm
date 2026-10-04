/**
 * 研究所御三家精灵球桌：桌面摆三颗 3D 精灵球；选择界面打开时，
 * 当前选中的球亮起并上浮，球上方投出一道光锥，以全息投影展示该宝可梦的 3D 模型。
 * - InteriorScene 在房间含 `starter-table` 互动家具时创建并注册为 active；
 * - StoryDirector 的 starter 步骤通过 activeStarterTable() 驱动预览（没有桌子时静默跳过）。
 */
import * as THREE from 'three';
import { monModelReady, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';
import type { CameraRig } from '@/core/camera/CameraRig';

export interface TableFootprint {
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
  h: number;
}

const BALL_R = 0.13;
const HOLO_H = 0.75;
const HOLO_COLOR = new THREE.Color(0x7fe8ff);

let active: StarterTable | null = null;
export function activeStarterTable(): StarterTable | null {
  return active;
}

interface BallSlot {
  species: number;
  group: THREE.Group;
  button: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
  baseY: number;
  glow: number;
}

/** 全息共享参数：时间 / 显现高度（世界 y，自下而上扫描显形）/ 整体淡入 */
interface HoloUniforms {
  uTime: { value: number };
  uReveal: { value: number };
  uFade: { value: number };
}

/**
 * 实体化全息材质：保留模型原贴图与颜色（看得清五官和花纹），整体轻微偏青；
 * 菲涅尔青色描边 + 细扫描线 + 极轻闪烁；不透明度 0.94、写深度（不再是半透明叠加的“幽灵”）；
 * 切换时自下而上扫描显形，显形边缘一道亮线。onBeforeCompile 注入，兼容骨骼蒙皮。
 */
function makeHoloMaterial(src: THREE.Material | null, u: HoloUniforms): THREE.MeshBasicMaterial {
  const o = src as (THREE.Material & { map?: THREE.Texture | null; color?: THREE.Color }) | null;
  const m = new THREE.MeshBasicMaterial({
    color: o?.color ? o.color.clone() : new THREE.Color(0xdde8f0),
    map: o?.map ?? null,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.uniforms.uReveal = u.uReveal;
    sh.uniforms.uFade = u.uFade;
    sh.uniforms.uHolo = { value: HOLO_COLOR };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoloN;\nvarying vec3 vHoloV;\nvarying float vHoloY;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvHoloN = normalize(normalMatrix * objectNormal);\nvHoloV = normalize(-mvPosition.xyz);\nvHoloY = (modelMatrix * vec4(transformed, 1.0)).y;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uReveal; uniform float uFade; uniform vec3 uHolo;\nvarying vec3 vHoloN;\nvarying vec3 vHoloV;\nvarying float vHoloY;')
      .replace(
        '#include <opaque_fragment>',
        [
          'if (vHoloY > uReveal) discard;',
          'float fres = pow(clamp(1.0 - abs(dot(normalize(vHoloN), normalize(vHoloV))), 0.0, 1.0), 2.2);',
          'float scan = 0.93 + 0.07 * step(0.5, fract(vHoloY * 60.0 - uTime * 1.2));',
          'float flick = 0.97 + 0.03 * sin(uTime * 31.0) * sin(uTime * 9.0);',
          'float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));',
          // 原色为主，轻微偏青，暗部抬一点（投影光自带亮度）
          'vec3 col = mix(outgoingLight, vec3(lum) * 0.55 + uHolo * 0.55, 0.28) * 1.08 + uHolo * 0.06;',
          'col = col * scan * flick + uHolo * fres * 0.95;',
          'float edge = 1.0 - smoothstep(0.0, 0.035, uReveal - vHoloY);',
          'col += uHolo * edge * 2.2;',
          'outgoingLight = col;',
          'diffuseColor.a = clamp(diffuseColor.a * uFade + fres * 0.06, 0.0, 1.0);',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  m.customProgramCacheKey = () => `cl-holo2-${o?.map ? 'map' : 'flat'}`;
  return m;
}

function makeBall(): { g: THREE.Group; button: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshToonMaterial({ color: 0xe8484a }),
  );
  const lower = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshToonMaterial({ color: 0xf4f4f4 }),
  );
  const band = new THREE.Mesh(new THREE.TorusGeometry(BALL_R, 0.014, 6, 28), new THREE.MeshBasicMaterial({ color: 0x1d2340 }));
  band.rotation.x = Math.PI / 2;
  const button = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 16), button);
  btn.rotation.x = Math.PI / 2;
  btn.position.z = BALL_R;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 18), new THREE.MeshBasicMaterial({ color: 0x1d2340 }));
  rim.position.z = BALL_R + 0.004;
  g.add(upper, lower, band, btn, rim);
  for (const o of [upper, lower]) o.castShadow = true;
  return { g, button };
}

export class StarterTable {
  readonly group = new THREE.Group();
  private slots: BallSlot[] = [];
  private sel = -1;
  private time = { value: 0 };
  private readonly holoU: HoloUniforms;
  private holoMats: THREE.Material[] = [];
  /** 全息底座：两圈反向旋转的投影环 + 上升光点 */
  private readonly base = new THREE.Group();
  private readonly baseRings: THREE.Mesh[] = [];
  private readonly motes: THREE.Points;
  private readonly moteSeeds: Float32Array;
  private holoBaseY = 0;
  private holoTopY = 0;
  private rig: CameraRig | null = null;
  private camera: THREE.Camera | null = null;
  private beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  private holo: THREE.Object3D | null = null;
  private holoToken = 0;
  private holoFade = 0;

  /**
   * @param species 三只御三家（与选择卡片同序）
   * @param taken 已被领走的物种（不再摆球）
   */
  constructor(fp: TableFootprint, species: readonly number[], taken: (id: number) => boolean) {
    this.group.name = 'starter-table';
    this.group.position.set(fp.x, 0, fp.z);
    this.group.rotation.y = fp.yaw;
    this.holoU = { uTime: this.time, uReveal: { value: 0 }, uFade: { value: 0 } };
    const span = Math.min(fp.hx * 2 - 0.5, 1.6);
    species.forEach((id, i) => {
      if (taken(id)) return;
      const { g, button } = makeBall();
      const baseY = fp.h + BALL_R + 0.005;
      g.position.set(species.length > 1 ? -span / 2 + (span * i) / (species.length - 1) : 0, baseY, 0.05);
      g.rotation.y = 0;
      // 底座光环（选中时亮起）
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(BALL_R * 1.05, BALL_R * 1.5, 32),
        new THREE.MeshBasicMaterial({ color: HOLO_COLOR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(g.position.x, fp.h + 0.004, g.position.z);
      this.group.add(g, ring);
      this.slots.push({ species: id, group: g, button, ring, baseY, glow: 0 });
    });

    // 投影光锥：球顶 → 全息模型脚下，向上扩散渐隐
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time, uColor: { value: HOLO_COLOR }, uOpacity: { value: 0 } },
      vertexShader: 'varying float vH; void main(){ vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying float vH;' +
        'void main(){ float a = clamp(1.0 - vH, 0.0, 1.0); a = a * a * (0.8 + 0.2 * sin(uTime * 6.0 + vH * 20.0));' +
        ' gl_FragColor = vec4(uColor, clamp(a * uOpacity, 0.0, 1.0)); }',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamGeo = new THREE.CylinderGeometry(0.34, 0.03, 0.42, 24, 1, true);
    beamGeo.translate(0, 0.21, 0);
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.renderOrder = 6;
    this.beam.visible = false;
    this.group.add(this.beam);

    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.2 + i * 0.07, 0.225 + i * 0.07, 48, 1, 0, Math.PI * (i ? 1.5 : 1.7)),
        new THREE.MeshBasicMaterial({ color: HOLO_COLOR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      r.rotation.x = -Math.PI / 2;
      this.base.add(r);
      this.baseRings.push(r);
    }
    const N = 40;
    this.moteSeeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.moteSeeds.set([Math.random() * Math.PI * 2, Math.random(), 0.08 + Math.random() * 0.2], i * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: HOLO_COLOR, size: 0.022, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.base.add(this.motes);
    this.base.visible = false;
    this.group.add(this.base);
  }

  /**
   * 选择开始：镜头切到桌子正前方偏右的机位（桌子与全息在画面左侧，右侧留给信息面板）。
   * rig / camera 由场景在创建时传入；没有时不切镜头。
   */
  attachCamera(rig: CameraRig, camera: THREE.Camera): this {
    this.rig = rig;
    this.camera = camera;
    return this;
  }

  beginSelection(): void {
    if (!this.rig) return;
    const h = this.slots[0]?.baseY ?? 0.9;
    this.group.updateMatrixWorld(true);
    const pos = this.group.localToWorld(new THREE.Vector3(0.72, h + 1.05, 2.05));
    const look = this.group.localToWorld(new THREE.Vector3(0.58, h + 0.62, 0));
    this.rig.setOverride(pos, look, 0.12, null, 'starter');
  }

  endSelection(): void {
    this.rig?.clearOverride('starter', true);
  }

  /** 屏幕坐标拾取精灵球（鼠标悬停 / 点击）；返回物种或 null */
  pick(clientX: number, clientY: number): number | null {
    if (!this.camera) return null;
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    let best: { d: number; species: number } | null = null;
    const c = new THREE.Vector3();
    for (const s of this.slots) {
      s.group.getWorldPosition(c);
      const d = ray.ray.distanceSqToPoint(c);
      if (d < (BALL_R * 1.8) ** 2 && (!best || d < best.d)) best = { d, species: s.species };
    }
    return best?.species ?? null;
  }

  /** 设为当前活动桌（场景销毁时 dispose 会自动注销） */
  activate(): this {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- 模块级单例注册
    active = this;
    return this;
  }

  /** 选择界面打开：选中第 i 只（-1 = 关闭预览）；make 负责创建该物种的模型 */
  select(species: number | null, make?: (id: number) => THREE.Object3D): void {
    const i = species === null ? -1 : this.slots.findIndex((s) => s.species === species);
    if (i === this.sel) return;
    this.sel = i;
    this.clearHolo();
    const slot = this.slots[i];
    if (!slot || !make) {
      this.beam.visible = false;
      return;
    }
    const token = ++this.holoToken;
    const root = make(slot.species);
    root.name = `holo:${slot.species}`;
    this.applyHolo(root);
    setMonLoop(root, 'idle');
    root.position.set(slot.group.position.x, slot.baseY + BALL_R + 0.42, slot.group.position.z);
    // 底座与显形高度（世界坐标）
    this.base.position.set(root.position.x, root.position.y - 0.005, root.position.z);
    this.base.visible = true;
    this.group.updateMatrixWorld(true);
    this.holoBaseY = this.group.localToWorld(root.position.clone()).y;
    this.holoTopY = this.holoBaseY + HOLO_H * 1.15;
    this.holoU.uReveal.value = this.holoBaseY - 0.02;
    root.rotation.y = 0;
    this.holo = root;
    this.holoFade = 0;
    this.group.add(root);
    // glb 就绪后会替换灰模网格：重新套全息材质
    void monModelReady(root).then(() => {
      if (token === this.holoToken) this.applyHolo(root);
    });
    this.beam.position.set(slot.group.position.x, slot.baseY + BALL_R, slot.group.position.z);
    this.beam.visible = true;
  }

  /** 领走某只：移除对应的球并关闭预览 */
  take(species: number): void {
    this.select(null);
    const k = this.slots.findIndex((s) => s.species === species);
    const slot = this.slots[k];
    if (!slot) return;
    slot.group.removeFromParent();
    slot.ring.removeFromParent();
    disposeTree(slot.group);
    disposeTree(slot.ring);
    this.slots.splice(k, 1);
  }

  update(dt: number): void {
    this.time.value += dt;
    const t = this.time.value;
    this.slots.forEach((s, k) => {
      const on = k === this.sel;
      s.glow = THREE.MathUtils.damp(s.glow, on ? 1 : 0, 8, dt);
      s.group.position.y = s.baseY + s.glow * (0.05 + Math.sin(t * 3) * 0.015);
      s.group.rotation.y = on ? Math.sin(t * 1.6) * 0.35 : THREE.MathUtils.damp(s.group.rotation.y, 0, 6, dt);
      s.button.color.setRGB(1, 1, 1).lerp(HOLO_COLOR, s.glow * (0.6 + 0.4 * Math.sin(t * 5)));
      (s.ring.material as THREE.MeshBasicMaterial).opacity = s.glow * (0.55 + 0.25 * Math.sin(t * 4));
    });
    if (this.holo) {
      this.holoFade = Math.min(1, this.holoFade + dt * 1.7);
      const k = this.holoFade;
      // 自下而上扫描显形（约 0.6 s），不再缩放弹出
      const reveal = Math.min(1, this.holoFade / 1);
      this.holoU.uReveal.value = this.holoBaseY - 0.02 + (this.holoTopY - this.holoBaseY + 0.04) * (1 - (1 - reveal) ** 2);
      this.holoU.uFade.value = Math.min(1, k * 1.5);
      // 慢速转台（正面多停留一会儿）
      this.holo.rotation.y = Math.sin(t * 0.45) * 0.9;
      this.beamMat.uniforms.uOpacity!.value = 0.32 * k;
      updateMonModel(this.holo, dt);
      this.baseRings.forEach((r, i) => {
        r.rotation.z += dt * (i ? -1.1 : 0.8);
        (r.material as THREE.MeshBasicMaterial).opacity = (0.55 + 0.2 * Math.sin(t * 3 + i)) * k;
      });
      const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const a = this.moteSeeds[i * 3]!;
        const ph = (this.moteSeeds[i * 3 + 1]! + t * 0.35) % 1;
        const r = this.moteSeeds[i * 3 + 2]! * (1 - ph * 0.4);
        pos.setXYZ(i, Math.cos(a + t * 0.6) * r, ph * HOLO_H * 1.2, Math.sin(a + t * 0.6) * r);
      }
      pos.needsUpdate = true;
      (this.motes.material as THREE.PointsMaterial).opacity = 0.8 * k;
    } else {
      this.beamMat.uniforms.uOpacity!.value = 0;
      this.base.visible = false;
    }
  }

  private applyHolo(root: THREE.Object3D): void {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Sprite).isSprite) return;
      if ((o as THREE.Sprite).isSprite) {
        o.visible = false;
        return;
      }
      // 保留原材质（贴图 / 颜色）做实体化全息；glb 替换网格后会再次调用
      const orig = (m.userData.holoOrig as THREE.Material | undefined) ?? (Array.isArray(m.material) ? m.material[0]! : m.material);
      m.userData.holoOrig = orig;
      const hm = makeHoloMaterial(orig, this.holoU);
      this.holoMats.push(hm);
      m.material = hm;
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 7;
    });
    // 高度统一缩放到 HOLO_H（不同宝可梦体型差别大）
    root.updateMatrixWorld(true);
    const inner = root.children[0];
    if (!inner) return;
    const box = new THREE.Box3().setFromObject(inner);
    const h = (box.max.y - box.min.y) / Math.max(root.scale.y, 1e-3);
    if (h > 0.01 && Number.isFinite(h)) {
      const s = HOLO_H / h;
      for (const c of root.children) c.scale.multiplyScalar(s / (c.userData.holoScale ?? 1));
      for (const c of root.children) c.userData.holoScale = s;
    }
  }

  private clearHolo(): void {
    this.holoToken++;
    for (const m of this.holoMats) m.dispose();
    this.holoMats = [];
    if (!this.holo) return;
    this.holo.removeFromParent();
    // 模型几何为缓存共享，不在这里 dispose；全息材质是本表创建的，已释放
    this.holo = null;
  }

  dispose(): void {
    this.clearHolo();
    if (active === this) active = null;
    this.group.removeFromParent();
    for (const s of this.slots) {
      disposeTree(s.group);
      disposeTree(s.ring);
    }
    this.slots = [];
    this.endSelection();
    this.beam.geometry.dispose();
    this.beamMat.dispose();
    for (const r of this.baseRings) {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    }
    this.motes.geometry.dispose();
    (this.motes.material as THREE.Material).dispose();
  }
}

function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat.dispose();
  });
}
