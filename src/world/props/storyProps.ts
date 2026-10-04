/**
 * M1-13 / M1-14 · 剧情拾取物与剧情特效的模型（Toon 材质 + 描边）：
 * - herb：翠澜药草（叶背泛蓝的一丛草 + 发光孢子）；
 * - tackle-box：漂流的旧木钓具箱（铁箍、把手、「陈」字木牌、周围浮着的浮漂）；
 * - lamp：灯塔底部结满盐霜的控制箱（电闸、指示灯）；
 * - footprints：一串小狐狸脚印（贴地，淡紫雾光）；
 * - sparkle：通用闪光点；
 * - tm-disc：野外遗落的招式学习器（斜靠在小石头上的光盘 + 上方旋转闪光）；
 * - LighthouseBeam：灯塔顶部旋转光束（点亮后显示）；
 * - Puff：索罗亚现身的黑紫烟雾粒子。
 */
import * as THREE from 'three';
import { addHullOutlines, createToonMaterial } from '@/render';

export type StoryPropModel = 'herb' | 'tackle-box' | 'lamp' | 'footprints' | 'sparkle' | 'tm-disc';

export interface StoryPropView {
  root: THREE.Group;
  /** 每帧动画（t = 累计秒） */
  animate(t: number): void;
  /** 提示气泡高度（相对 root） */
  promptY: number;
  dispose(): void;
}

const mat = (color: THREE.ColorRepresentation, extra: Parameters<typeof createToonMaterial>[0] = {}) => createToonMaterial({ kind: 'scene', color, ...extra });

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mm = m.material;
    (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose());
  });
}

function herb(): StoryPropView {
  const root = new THREE.Group();
  const leafTop = mat('#4fae5a');
  const leafBack = mat('#4c8fe0', { emissive: 0x1d4f9a, emissiveIntensity: 0.35 });
  const stemM = mat('#3d7a3a');
  const leaves: THREE.Mesh[] = [];
  // 7 片叶子，正面绿、背面蓝（两层薄片错开），围成一丛
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2;
    const len = 0.42 + (i % 3) * 0.08;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.12, len * 0.45, 0, len);
    shape.quadraticCurveTo(-0.12, len * 0.45, 0, 0);
    const g = new THREE.ShapeGeometry(shape, 6);
    const front = new THREE.Mesh(g, leafTop);
    const back = new THREE.Mesh(g, leafBack);
    back.position.z = -0.008;
    back.rotation.y = Math.PI;
    const leaf = new THREE.Group();
    leaf.add(front, back);
    leaf.rotation.set(-0.55 - (i % 3) * 0.12, a, 0, 'YXZ');
    leaf.position.y = 0.04;
    root.add(leaf);
    leaves.push(front);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.55, 6), stemM);
  stem.position.y = 0.27;
  root.add(stem);
  // 顶部蓝色小花
  const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat('#8fd0ff', { emissive: 0x3a8fe0, emissiveIntensity: 0.8 }));
  flower.position.y = 0.58;
  root.add(flower);
  // 发光孢子
  const spores = new THREE.Group();
  const sporeM = new THREE.MeshBasicMaterial({ color: 0xaee6ff, transparent: true, opacity: 0.85, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), sporeM);
    s.userData.outline = false;
    s.userData.phase = i * 1.1;
    spores.add(s);
  }
  root.add(spores);
  addHullOutlines(root);
  // 药草本体放大（原 0.6 m 会被草丛淹没）
  const plant = new THREE.Group();
  plant.add(...root.children);
  plant.scale.setScalar(1.7);
  root.add(plant);
  // 远处也能看见：淡蓝色光柱 + 贴地光环（加色混合，不投影）
  const beamM = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beamG = new THREE.CylinderGeometry(0.22, 0.38, 3.2, 12, 1, true);
  beamG.translate(0, 1.6, 0);
  const beam = new THREE.Mesh(beamG, beamM);
  beam.userData.outline = false;
  beam.renderOrder = 5;
  root.add(beam);
  const ringM = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), ringM);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.userData.outline = false;
  root.add(ring);
  return {
    root,
    promptY: 1.4,
    animate(t) {
      plant.rotation.z = Math.sin(t * 1.6) * 0.04;
      beamM.opacity = 0.2 + Math.sin(t * 2.2) * 0.08;
      ring.scale.setScalar(1 + ((t * 0.5) % 1) * 0.6);
      ringM.opacity = 0.45 * (1 - ((t * 0.5) % 1));
      flower.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
      spores.children.forEach((s, i) => {
        const p = (s.userData.phase as number) + t * 0.6;
        s.position.set(Math.cos(p * 1.3 + i) * 0.28, 0.25 + ((p * 0.35) % 0.7), Math.sin(p * 1.1 + i) * 0.28); // 在 plant 内（随整体放大）
      });
    },
    dispose: () => disposeTree(root),
  };
}

function tackleBox(): StoryPropView {
  const root = new THREE.Group();
  const bob = new THREE.Group();
  root.add(bob);
  const wood = mat('#9b6a3c');
  const dark = mat('#6b4526');
  const iron = mat('#5b6168');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.55), wood);
  body.position.y = 0.12;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.59), dark);
  lid.position.y = 0.39;
  bob.add(body, lid);
  for (const x of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.61), iron);
    band.position.set(x, 0.2, 0);
    bob.add(band);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 12, Math.PI), iron);
  handle.position.y = 0.45;
  bob.add(handle);
  // 「陈」字木牌（贴在正面的浅色木片 + 深色笔画块）
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.02), mat('#e8cf9a'));
  plate.position.set(0, 0.16, 0.285);
  bob.add(plate);
  const strokes: Array<[number, number, number, number]> = [
    [-0.07, 0.0, 0.02, 0.14],
    [0.03, 0.04, 0.12, 0.02],
    [0.03, 0.0, 0.1, 0.02],
    [0.04, -0.03, 0.02, 0.08],
  ];
  const ink = mat('#3a2616');
  for (const [x, y, w, h] of strokes) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), ink);
    s.position.set(x, 0.16 + y, 0.3);
    s.userData.outline = false;
    bob.add(s);
  }
  // 周围漂着的红白浮漂
  const floats: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8484a'));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f4f4f0'));
    f.add(top, bot);
    const a = i * 2.1;
    f.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
    f.userData.phase = a;
    root.add(f);
    floats.push(f);
  }
  // 水面涟漪环
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.userData.outline = false;
  root.add(ring);
  addHullOutlines(root);
  return {
    root,
    promptY: 1.2,
    animate(t) {
      bob.position.y = Math.sin(t * 1.8) * 0.06;
      bob.rotation.z = Math.sin(t * 1.3) * 0.08;
      bob.rotation.x = Math.sin(t * 1.1 + 1) * 0.06;
      for (const f of floats) f.position.y = Math.sin(t * 2.2 + (f.userData.phase as number)) * 0.04;
      const k = (t * 0.6) % 1;
      ring.scale.setScalar(1 + k * 0.8);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k);
    },
    dispose: () => disposeTree(root),
  };
}

function lamp(): StoryPropView {
  const root = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.45), mat('#6f8796'));
  cab.position.y = 0.6;
  root.add(cab);
  // 盐霜斑块
  const salt = mat('#f2f5f4');
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + (i % 3) * 0.025, 0), salt);
    s.position.set(-0.32 + ((i * 0.29) % 0.64), 0.2 + ((i * 0.37) % 0.95), 0.23);
    s.scale.z = 0.35;
    s.userData.outline = false;
    root.add(s);
  }
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), mat('#d9453b'));
  lever.position.set(0.22, 0.75, 0.27);
  lever.rotation.x = 0.7;
  root.add(lever);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
  led.position.set(-0.2, 1.02, 0.24);
  led.userData.outline = false;
  root.add(led);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mat('#2b2f33'));
  cable.position.set(0, 1.9, -0.1);
  root.add(cable);
  addHullOutlines(root);
  return {
    root,
    promptY: 1.7,
    animate(t) {
      led.visible = Math.sin(t * 6) > 0;
    },
    dispose: () => disposeTree(root),
  };
}

function footprints(): StoryPropView {
  const root = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x4a3a6a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xc9a8ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const prints: THREE.Object3D[] = [];
  // 4 对前后交错的小爪印，沿 +z 方向排列
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), m);
    pad.rotation.x = -Math.PI / 2;
    p.add(pad);
    for (let k = 0; k < 4; k++) {
      const toe = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), m);
      toe.rotation.x = -Math.PI / 2;
      toe.position.set(-0.05 + k * 0.033, 0, 0.075 + (k === 0 || k === 3 ? -0.015 : 0));
      p.add(toe);
    }
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), glow);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.005;
    p.add(halo);
    p.position.set(i % 2 ? 0.1 : -0.1, 0.03, -0.9 + i * 0.36);
    root.add(p);
    prints.push(halo);
  }
  root.traverse((o) => (o.userData.outline = false));
  return {
    root,
    promptY: 0.8,
    animate(t) {
      prints.forEach((h, i) => (((h as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.2 * Math.max(0, Math.sin(t * 2 - i * 0.6))));
    },
    dispose: () => disposeTree(root),
  };
}

function sparkle(): StoryPropView {
  const root = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), m);
  star.position.y = 0.4;
  star.userData.outline = false;
  root.add(star);
  return {
    root,
    promptY: 1,
    animate(t) {
      star.rotation.y = t * 2;
      star.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3)) * 0.5);
    },
    dispose: () => disposeTree(root),
  };
}

function tmDisc(): StoryPropView {
  const root = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mat('#8d8a80'));
  rock.scale.set(1.3, 0.6, 1);
  rock.position.y = 0.08;
  root.add(rock);
  // 光盘：彩色盘面 + 银色内圈 + 中心孔，斜靠在石头上
  const disc = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28), mat('#5fa8e8', { emissive: 0x1d5fa8, emissiveIntensity: 0.25 }));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.024, 24), mat('#dfe4ee'));
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), mat('#2b2f3a'));
  disc.add(face, ring, hole);
  disc.rotation.set(Math.PI / 2 - 0.5, 0, 0);
  disc.position.set(0, 0.24, 0.16);
  root.add(disc);
  const m = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), m);
  star.position.set(0, 0.75, 0.1);
  star.userData.outline = false;
  root.add(star);
  return {
    root,
    promptY: 1.1,
    animate(t) {
      star.rotation.y = t * 2.4;
      star.position.y = 0.75 + Math.sin(t * 2) * 0.06;
      star.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3)) * 0.6);
      (face.material as THREE.MeshToonMaterial).emissiveIntensity = 0.2 + Math.abs(Math.sin(t * 1.5)) * 0.35;
    },
    dispose: () => disposeTree(root),
  };
}

export function buildStoryProp(model: StoryPropModel): StoryPropView {
  switch (model) {
    case 'tm-disc':
      return tmDisc();
    case 'herb':
      return herb();
    case 'tackle-box':
      return tackleBox();
    case 'lamp':
      return lamp();
    case 'footprints':
      return footprints();
    default:
      return sparkle();
  }
}

/** 灯塔顶部旋转光束（两道相对的锥形光 + 灯室光晕） */
export class LighthouseBeam {
  readonly root = new THREE.Group();
  private spin = new THREE.Group();
  private halo: THREE.Mesh;
  private light: THREE.PointLight;

  constructor(height: number) {
    this.root.position.y = height;
    const beamM = new THREE.MeshBasicMaterial({ color: 0xfff4c2, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const dir of [1, -1]) {
      const g = new THREE.ConeGeometry(4.5, 60, 20, 1, true);
      g.translate(0, -30, 0);
      g.rotateZ((dir * Math.PI) / 2);
      const beam = new THREE.Mesh(g, beamM);
      beam.userData.outline = false;
      this.spin.add(beam);
    }
    this.root.add(this.spin);
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.halo.userData.outline = false;
    this.root.add(this.halo);
    this.light = new THREE.PointLight(0xfff0c0, 0, 60, 1.6);
    this.root.add(this.light);
    this.root.visible = false;
  }

  set on(v: boolean) {
    this.root.visible = v;
    this.light.intensity = v ? 40 : 0;
  }

  get on(): boolean {
    return this.root.visible;
  }

  animate(t: number, night: boolean): void {
    if (!this.root.visible) return;
    this.spin.rotation.y = t * 0.8;
    (this.halo.material as THREE.MeshBasicMaterial).opacity = (night ? 0.85 : 0.45) + Math.sin(t * 4) * 0.08;
    this.spin.children.forEach((b) => (((b as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = night ? 0.26 : 0.1));
  }

  dispose(): void {
    disposeTree(this.root);
  }
}

/** 索罗亚现身的烟雾（一次性粒子团） */
export class Puff {
  readonly root = new THREE.Group();
  private parts: Array<{ m: THREE.Mesh; v: THREE.Vector3 }> = [];
  private t = 0;

  constructor(x: number, y: number, z: number) {
    this.root.position.set(x, y, z);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.25 + (i % 4) * 0.08, 0),
        new THREE.MeshBasicMaterial({ color: i % 3 ? 0x3a2a55 : 0x8a4bd1, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      m.userData.outline = false;
      const a = (i / 22) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * (1 + (i % 3) * 0.5), 0.8 + (i % 5) * 0.35, Math.sin(a) * (1 + (i % 3) * 0.5));
      m.position.set(0, 0.8, 0);
      this.root.add(m);
      this.parts.push({ m, v });
    }
  }

  /** 返回 true = 结束 */
  update(dt: number): boolean {
    this.t += dt;
    const k = this.t / 1.2;
    for (const p of this.parts) {
      p.m.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(0.94);
      p.m.scale.setScalar(1 + k * 1.5);
      (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - k));
    }
    return k >= 1;
  }

  dispose(): void {
    disposeTree(this.root);
  }
}
