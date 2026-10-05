/**
 * M1-05 · 室内房间生成（灰盒程序化版）。
 *
 * 由 RoomConfig 生成：地板（木板 / 瓷砖 / 棋盘格）、三面墙（+Z 墙剖切为踢脚线）、护墙板与腰线、
 * 家具（25 种程序化模型，全部 Toon 材质 + 反向外壳描边）、碰撞体、灯光预设、窗户日夜变化、水池动画。
 * 美术模型到位后，家具按同一坐标换成 glb，房间外壳保持程序化或整体换模都可以。
 */
import * as THREE from 'three';
import type { FurnitureConfig, FurnitureType, LightingPreset, RoomConfig } from '@/config/interiors';
import { addHullOutlines, createToonMaterial, mergeStaticByMaterial } from '@/render';
import type { CollisionWorld } from '../collision/CollisionWorld';

export const INTERIOR_COLLISION_GROUP = 'interior';
const WALL_T = 0.25;

interface LightPreset {
  ambient: string;
  ambientIntensity: number;
  sky: string;
  ground: string;
  key: string;
  keyIntensity: number;
  lamp: string;
  lampIntensity: number;
  fog: string;
}

export const LIGHT_PRESETS: Record<LightingPreset, LightPreset> = {
  home: { ambient: '#fff1dc', ambientIntensity: 0.55, sky: '#fff4e2', ground: '#a07a58', key: '#ffe6c2', keyIntensity: 1.6, lamp: '#ffc98a', lampIntensity: 5, fog: '#2a2018' },
  lab: { ambient: '#eef6ff', ambientIntensity: 0.4, sky: '#f4fbff', ground: '#8a9aa6', key: '#ffffff', keyIntensity: 1.15, lamp: '#dff4ff', lampIntensity: 2.2, fog: '#1b2228' },
  center: { ambient: '#fff0ee', ambientIntensity: 0.5, sky: '#fff6f4', ground: '#b8958f', key: '#fff4ee', keyIntensity: 1.4, lamp: '#ffd9cf', lampIntensity: 3, fog: '#2a1c1c' },
  mart: { ambient: '#f2f7ff', ambientIntensity: 0.4, sky: '#f6fbff', ground: '#8f9cab', key: '#ffffff', keyIntensity: 1.15, lamp: '#e6f2ff', lampIntensity: 2.2, fog: '#1b2128' },
  gym: { ambient: '#e4f6fb', ambientIntensity: 0.3, sky: '#dff4fb', ground: '#4a8398', key: '#e9fbff', keyIntensity: 1.1, lamp: '#bfe8f5', lampIntensity: 2.6, fog: '#0f2229' },
  // M3-18 海底：青蓝环境光 + 从水面斜射的冷白主光；abyss 更暗（神殿海沟）
  undersea: { ambient: '#7fd0e8', ambientIntensity: 0.42, sky: '#a8ecff', ground: '#1e4a5a', key: '#e8fbff', keyIntensity: 1.0, lamp: '#7fe8ff', lampIntensity: 1.6, fog: '#0f4a62' },
  abyss: { ambient: '#5a90c8', ambientIntensity: 0.26, sky: '#6ab0e0', ground: '#0a1a2a', key: '#bfe8ff', keyIntensity: 0.55, lamp: '#5fd8ff', lampIntensity: 2.2, fog: '#06182a' },
  cave: { ambient: '#8fa3c4', ambientIntensity: 0.22, sky: '#6f84a8', ground: '#2c2a30', key: '#9fb4d8', keyIntensity: 0.5, lamp: '#7fe0ff', lampIntensity: 2.4, fog: '#07090d' },
  market: { ambient: '#fff0d8', ambientIntensity: 0.55, sky: '#fff2dc', ground: '#8f7456', key: '#ffe2b8', keyIntensity: 1.6, lamp: '#ffcf80', lampIntensity: 6, fog: '#2a2015' },
};

/** 各家具类型的默认尺寸（宽、高、深） */
const DEFAULT_SIZE: Record<FurnitureType, [number, number, number]> = {
  table: [1.4, 0.75, 0.9],
  chair: [0.5, 0.9, 0.5],
  sofa: [2.0, 0.85, 0.9],
  bed: [1.2, 0.6, 2.1],
  shelf: [1.6, 1.5, 0.5],
  bookshelf: [1.4, 2.0, 0.45],
  counter: [2.4, 0.95, 0.7],
  tv: [1.3, 1.1, 0.5],
  plant: [0.6, 1.2, 0.6],
  rug: [2.4, 0.02, 1.6],
  stairs: [1.2, 2.8, 2.6],
  machine: [1.6, 1.9, 0.9],
  blender: [0.9, 1.35, 0.7],
  workbench: [1.7, 0.9, 0.75],
  healer: [1.8, 1.2, 0.8],
  pc: [0.6, 0.5, 0.3],
  crate: [0.8, 0.8, 0.8],
  poster: [0.9, 1.1, 0.02],
  window: [1.4, 1.1, 0.1],
  lamp: [0.4, 1.6, 0.4],
  fridge: [0.9, 1.9, 0.75],
  stove: [0.9, 0.95, 0.7],
  pool: [4, 0.3, 4],
  stall: [3.2, 2.4, 1.5],
  barrel: [0.7, 0.95, 0.7],
  aquarium: [2.0, 1.3, 0.8],
  desk: [1.4, 0.76, 0.7],
  boulder: [1.4, 1.1, 1.3],
  crystal: [0.6, 1.2, 0.6],
  column: [0.9, 7, 0.9],
  banner: [1.2, 3.2, 0.02],
  bleacher: [6, 1.4, 2.7],
  emblem: [2.6, 2.6, 0.02],
  beam: [30, 0.4, 0.5],
  dais: [5, 0.36, 3],
  fountain: [1.6, 3, 1.0],
  reception: [3.2, 1.08, 1.0],
  trophy: [2.0, 2.2, 0.5],
  skylight: [4, 0.3, 3],
  poolLight: [0.5, 0.5, 0.2],
  kelp: [1.2, 3.2, 1.2],
  coral: [1.4, 1.2, 1.2],
  clam: [1.3, 0.8, 1.1],
  ruin: [1.0, 3.0, 1.0],
  anemone: [0.9, 0.6, 0.9],
  waterfall: [4, 8, 1.6],
  river: [4, 0.3, 10],
  stalagmite: [1.1, 2.4, 1.1],
  cliffwall: [6, 9, 1.2],
  torch: [0.45, 2.0, 0.45],
  bridge: [2.6, 0.3, 5],
  pennant: [0.3, 3.4, 0.3],
};

/** 默认不生成碰撞的类型 */
const NO_COLLIDE = new Set<FurnitureType>(['rug', 'poster', 'window', 'pc', 'pool', 'banner', 'emblem', 'beam', 'dais', 'skylight', 'poolLight', 'kelp', 'anemone', 'bridge']);

/** 水幕升降速度（每秒水幕高度比例变化） */
const FOUNTAIN_RATE = 0.8;

export interface BuiltRoom {
  group: THREE.Group;
  lights: THREE.Group;
  /** 可调查物件：id → 世界坐标（M1-07 使用） */
  interactables: Map<string, THREE.Vector3>;
  /** 可互动家具的占地矩形（M1-07：按离玩家最近的边缘点检测，大家具也能从侧面互动） */
  interactFootprints: Map<string, { x: number; z: number; hx: number; hz: number; yaw: number; h: number }>;
  /** 每帧更新（窗户亮度、水面、灯光闪烁） */
  update(time: number, dayLight: number): void;
  /**
   * 剖切（cutaway）：自由环绕镜头下，镜头所在一侧的墙（连同贴墙的高家具 / 挂饰）隐藏，
   * 人物永远不被墙挡住。返回当前隐藏的墙数。
   */
  updateCutaway(camera: THREE.Vector3): number;
  /** 道馆：对战开始 / 结束（水幕喷泉随之升起 / 回落） */
  setBattle(active: boolean): void;
  dispose(): void;
}

export class InteriorBuilder {
  private mats = new Map<string, THREE.Material>();
  private geos: THREE.BufferGeometry[] = [];
  private windowMats: THREE.MeshBasicMaterial[] = [];
  private waterMats: THREE.MeshToonMaterial[] = [];
  private lampLights: THREE.PointLight[] = [];
  /** 夜间点亮的发光件（池壁水下灯）：白天暗色 → 夜晚亮色 */
  private nightMats: Array<{ mat: THREE.MeshBasicMaterial; dayCol: THREE.Color; nightCol: THREE.Color }> = [];
  /** 夜间点亮的点光源（水下灯照亮池底） */
  private nightLights: THREE.PointLight[] = [];
  /** 天窗光柱：白天可见、夜里消失（opacity 基值存在 userData.base） */
  private shaftMats: THREE.MeshBasicMaterial[] = [];
  /** 水幕喷泉：对战时升起 */
  private fountains: Array<{ curtain: THREE.Mesh; tex: THREE.Texture; splash: THREE.Mesh; h: number; level: number }> = [];
  private textures: THREE.Texture[] = [];
  /** M3-20 流水纹理（瀑布 / 暗河）：每帧按 speed 滚动 offset */
  private flows: Array<{ tex: THREE.Texture; sx: number; sy: number }> = [];
  /** M3-20 水雾 / 水花：每帧轻微起伏缩放 */
  private bobs: Array<{ mesh: THREE.Object3D; base: THREE.Vector3; phase: number; amp: number; pulse: number }> = [];
  private battle = false;
  private lastTime = 0;
  /** 当前房间的四面墙：内侧面上一点 + 指向室内的法线 + 归属物体 */
  private cutWalls: Array<{ px: number; pz: number; nx: number; nz: number; objects: THREE.Object3D[]; hidden: boolean }> = [];

  constructor(private readonly collision: CollisionWorld) {}

  build(room: RoomConfig): BuiltRoom {
    const group = new THREE.Group();
    group.name = `interior:${room.id}`;
    const interactables = new Map<string, THREE.Vector3>();
    const interactFootprints: BuiltRoom['interactFootprints'] = new Map();
    this.collision.removeGroup(INTERIOR_COLLISION_GROUP);

    this.cutWalls = [];
    group.add(this.buildShell(room));
    for (const f of room.furniture) {
      const obj = this.buildFurniture(f);
      const [x, z] = f.position;
      obj.position.set(x, 0, z);
      obj.rotation.y = f.yaw ?? 0;
      // 性能 P1：家具内部同材质的零件合并（每件家具通常 6–20 个零件 → 2–5 个 draw call）；
      // 家具整体仍是独立对象，墙面剖切显隐不受影响；水池 / 灯具等带动画句柄的零件自动跳过
      mergeStaticByMaterial(obj);
      // 家具描边：实心 Toon 网格才加外壳（地毯、海报、屏幕、玻璃不加）
      if (obj.userData.outline !== false)
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          const mat = m.material as THREE.Material | undefined;
          if (m.isMesh && mat && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !mat.transparent) m.userData.outline = true;
        });
      group.add(obj);
      const size = f.size ?? DEFAULT_SIZE[f.type];
      if (!f.noCollide && !NO_COLLIDE.has(f.type)) this.collide(x, z, size[0] / 2, size[2] / 2, f.yaw ?? 0, size[1], `furniture:${f.type}`);
      if (f.interact) {
        interactables.set(f.interact, new THREE.Vector3(x, size[1] * 0.6, z));
        interactFootprints.set(f.interact, { x, z, hx: size[0] / 2, hz: size[2] / 2, yaw: f.yaw ?? 0, h: size[1] });
      }
    }
    // 出口地垫 / 楼梯
    // 海底房间的出口由 UnderwaterFx 画成上浮光柱 / 礁石拱门
    for (const e of room.underwater ? [] : room.exits) {
      // M3-20 瀑布 / 岩壁出口由对应家具表现
      if (e.action) continue;
      const isStairs = 'room' in e.to;
      if (isStairs) group.add(this.stairsMarker(room, e.position));
      else group.add(this.doorMat(e.position));
    }
    this.assignWallDecor(group);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = !m.userData.noShadow;
        m.receiveShadow = true;
      }
    });
    addHullOutlines(group);

    const lights = this.buildLights(room);
    return {
      group,
      lights,
      interactables,
      interactFootprints,
      update: (time, day) => {
        for (const m of this.windowMats) m.color.setRGB(THREE.MathUtils.lerp(0.12, 0.85, day), THREE.MathUtils.lerp(0.16, 0.95, day), THREE.MathUtils.lerp(0.32, 1.1, day));
        for (const m of this.waterMats) {
          const u = m.userData.uTime as { value: number } | undefined;
          if (u) u.value = time;
        }
        // 夜晚灯更亮，白天窗户透进来的光更强（主光强度）
        for (const l of this.lampLights) l.intensity = (l.userData.base as number) * THREE.MathUtils.lerp(1.35, 0.8, day) * (1 + Math.sin(time * 9 + l.id) * 0.012);
        const key = lights.getObjectByName('key') as THREE.DirectionalLight | undefined;
        if (key) key.intensity = (key.userData.base as number) * THREE.MathUtils.lerp(0.55, 1, day);
        // 道馆第二轮：夜间水下灯、白天天窗光柱、对战水幕
        const night = 1 - day;
        for (const n of this.nightMats) n.mat.color.copy(n.dayCol).lerp(n.nightCol, night);
        for (const l of this.nightLights) l.intensity = (l.userData.base as number) * night * (1 + Math.sin(time * 1.7 + l.id) * 0.06);
        for (const m of this.shaftMats) {
          m.opacity = (m.userData.base as number) * day * (0.9 + Math.sin(time * 0.4) * 0.1);
          m.visible = day > 0.02;
        }
        for (const fl of this.flows) {
          fl.tex.offset.x = (time * fl.sx) % 1;
          fl.tex.offset.y = (time * fl.sy) % 1;
        }
        for (const b of this.bobs) {
          const t = time + b.phase;
          b.mesh.position.set(b.base.x + Math.sin(t * 0.7) * b.amp, b.base.y + Math.sin(t * 1.3) * b.amp * 0.5, b.base.z + Math.cos(t * 0.9) * b.amp);
          const k = 1 + Math.sin(t * 2.2) * b.pulse;
          b.mesh.scale.set(b.mesh.userData.sx * k, b.mesh.userData.sy * k, b.mesh.userData.sz * k);
        }
        const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
        this.lastTime = time;
        for (const fo of this.fountains) {
          const target = this.battle ? 1 : 0;
          fo.level += THREE.MathUtils.clamp(target - fo.level, -FOUNTAIN_RATE * dt, FOUNTAIN_RATE * dt);
          const lv = THREE.MathUtils.smoothstep(fo.level, 0, 1);
          fo.curtain.visible = lv > 0.01;
          fo.curtain.scale.y = Math.max(0.001, lv);
          // 水从顶部喷嘴落下：顶端固定，下沿随 lv 下降，落到水槽后才出现水花
          fo.curtain.position.y = 0.32 + fo.h - (fo.h * lv) / 2;
          fo.tex.offset.y = (time * 1.6) % 1;
          const sp = THREE.MathUtils.clamp((lv - 0.85) / 0.15, 0, 1);
          fo.splash.visible = sp > 0.01;
          const pulse = 1 + Math.sin(time * 7) * 0.06;
          fo.splash.scale.set(Math.max(0.001, pulse * sp), 1, Math.max(0.001, pulse * sp));
        }
      },
      updateCutaway: (cam) => {
        let n = 0;
        for (const wl of this.cutWalls) {
          // 镜头到墙内侧面的有符号距离（>0 在室内）；滞回 0.25 m 防止在临界处闪烁
          const side = (cam.x - wl.px) * wl.nx + (cam.z - wl.pz) * wl.nz;
          const hide = wl.hidden ? side < 0.75 : side < 0.5;
          if (hide !== wl.hidden) {
            wl.hidden = hide;
            for (const o of wl.objects) o.visible = !hide;
          }
          if (hide) n++;
        }
        return n;
      },
      setBattle: (active) => {
        this.battle = active;
      },
      dispose: () => this.dispose(group),
    };
  }

  /** 贴墙的高家具（书架、柜子）与挂在墙上的物件（窗、海报、钟）归到对应墙，剖切时一起隐藏 */
  private assignWallDecor(group: THREE.Group): void {
    const box = new THREE.Box3();
    for (const obj of group.children) {
      if (obj.name === 'shell') continue;
      box.setFromObject(obj);
      if (box.isEmpty()) continue;
      const mounted = box.min.y > 0.7;
      const tall = box.max.y > 1.6;
      if (!mounted && !tall) continue;
      for (const wl of this.cutWalls) {
        // 盒子离墙内侧面的最近距离（取盒子在法线方向上的最小投影）
        const minX = wl.nx > 0 ? box.min.x : box.max.x;
        const minZ = wl.nz > 0 ? box.min.z : box.max.z;
        const dist = (minX - wl.px) * wl.nx + (minZ - wl.pz) * wl.nz;
        if (dist < 0.45) {
          wl.objects.push(obj);
          break;
        }
      }
    }
  }

  // ———————————————————— 房间外壳 ————————————————————

  private buildShell(room: RoomConfig): THREE.Group {
    const [w, d, h] = room.size;
    const g = new THREE.Group();
    g.name = 'shell';
    // 地板
    // 地板（有开洞时拆成围绕洞口的 4 块）
    for (const [x0, z0, x1, z1] of floorPieces(room)) {
      const floor = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2)), this.mat(room.floor.color, 'scene'));
      floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      floor.userData.noShadow = true;
      g.add(floor);
    }
    g.add(this.floorPattern(room));
    // 墙：四面完整墙（自由环绕镜头需要封闭房间），前墙（+Z）在出口处开门洞；
    // 镜头一侧的墙由 updateCutaway 剖切隐藏
    const wallMat = this.mat(room.wall.color, 'scene');
    const wains = room.wall.wainscot ? this.mat(room.wall.wainscot, 'scene') : null;
    const trim = this.mat(room.wall.trim ?? '#7a6048', 'scene');
    const DOOR_W = 1.7;
    const DOOR_H = Math.min(2.4, h - 0.3);
    const doors = room.exits.filter((e) => !('room' in e.to) && e.position[1] > d / 2 - 1.4).map((e) => e.position[0]);
    type Seg = { x: number; z: number; len: number; yaw: number; y0: number; y1: number };
    const sides: Array<{ px: number; pz: number; nx: number; nz: number; segs: Seg[] }> = [
      { px: 0, pz: -d / 2, nx: 0, nz: 1, segs: [{ x: 0, z: -d / 2 - WALL_T / 2, len: w + WALL_T * 2, yaw: 0, y0: 0, y1: h }] },
      { px: -w / 2, pz: 0, nx: 1, nz: 0, segs: [{ x: -w / 2 - WALL_T / 2, z: 0, len: d, yaw: Math.PI / 2, y0: 0, y1: h }] },
      { px: w / 2, pz: 0, nx: -1, nz: 0, segs: [{ x: w / 2 + WALL_T / 2, z: 0, len: d, yaw: Math.PI / 2, y0: 0, y1: h }] },
    ];
    // 前墙：按门洞切段（门洞上方加门楣）
    {
      const z = d / 2 + WALL_T / 2;
      const segs: Seg[] = [];
      const xs = [...doors].sort((a, b) => a - b);
      let cur = -w / 2 - WALL_T;
      for (const dx of xs) {
        const a = dx - DOOR_W / 2;
        const b = dx + DOOR_W / 2;
        if (a > cur + 0.01) segs.push({ x: (cur + a) / 2, z, len: a - cur, yaw: 0, y0: 0, y1: h });
        segs.push({ x: dx, z, len: DOOR_W, yaw: 0, y0: DOOR_H, y1: h });
        cur = b;
      }
      const end = w / 2 + WALL_T;
      if (end > cur + 0.01) segs.push({ x: (cur + end) / 2, z, len: end - cur, yaw: 0, y0: 0, y1: h });
      sides.push({ px: 0, pz: d / 2, nx: 0, nz: -1, segs });
    }
    for (const side of sides) {
      const objects: THREE.Object3D[] = [];
      const front = side.nz < 0;
      for (const s of side.segs) {
        const wh = s.y1 - s.y0;
        const wall = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.len, wh, WALL_T)), wallMat);
        wall.position.set(s.x, s.y0 + wh / 2, s.z);
        wall.rotation.y = s.yaw;
        // 前墙不投影（主光多从镜头方向来，会把整屋压暗）
        if (front) wall.userData.noShadow = true;
        g.add(wall);
        objects.push(wall);
        const inward = new THREE.Vector3(side.nx, 0, side.nz);
        if (wains && s.y0 === 0) {
          // 护墙板（下 1 m）+ 腰线 + 踢脚
          const wp = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.len - 0.02, 1.0, 0.04)), wains);
          wp.position.set(s.x + inward.x * (WALL_T / 2 + 0.02), 0.5, s.z + inward.z * (WALL_T / 2 + 0.02));
          wp.rotation.y = s.yaw;
          const rail = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.len - 0.02, 0.07, 0.08)), trim);
          rail.position.set(wp.position.x + inward.x * 0.02, 1.02, wp.position.z + inward.z * 0.02);
          rail.rotation.y = s.yaw;
          const base = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.len - 0.02, 0.12, 0.06)), trim);
          base.position.set(wp.position.x + inward.x * 0.02, 0.06, wp.position.z + inward.z * 0.02);
          base.rotation.y = s.yaw;
          g.add(wp, rail, base);
          objects.push(wp, rail, base);
          if (room.wall.relief === 'wave' && s.len > 0.8) {
            // 水波浮雕：两道错开半个波长的浮雕带，贴在护墙板表面（各自再外凸 1 cm，避免共面）
            for (const [k, col, y0] of [[0, room.wall.reliefColor ?? '#ffffff', 0.5], [1, room.wall.trim ?? '#2f7fa8', 0.3]] as const) {
              const L = s.len - 0.1;
              const sh = new THREE.Shape();
              const n = Math.max(8, Math.round(L / 0.1));
              const wl = 1.2;
              const ph = k * Math.PI;
              sh.moveTo(-L / 2, y0 - 0.07 + Math.sin(ph) * 0.05);
              for (let i = 1; i <= n; i++) {
                const x = -L / 2 + (L * i) / n;
                sh.lineTo(x, y0 - 0.07 + Math.sin(((x + L / 2) / wl) * Math.PI * 2 + ph) * 0.05);
              }
              for (let i = n; i >= 0; i--) {
                const x = -L / 2 + (L * i) / n;
                sh.lineTo(x, y0 + 0.07 + Math.sin(((x + L / 2) / wl) * Math.PI * 2 + ph + 0.6) * 0.07);
              }
              sh.closePath();
              const rg = this.geo(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false, curveSegments: 1 }));
              const relief = new THREE.Mesh(rg, this.mat(col, 'scene'));
              const off = WALL_T / 2 + 0.04 + 0.01 * (k + 1);
              relief.position.set(s.x + inward.x * off, 0, s.z + inward.z * off);
              // 形状在 XY 平面、沿 +Z 挤出：转到与墙面平行、挤出方向朝室内
              relief.rotation.y = Math.atan2(inward.x, inward.z);
              relief.userData.noShadow = true;
              g.add(relief);
              objects.push(relief);
            }
          }
        }
        if (s.y0 > 0) {
          // 门框：两侧立柱 + 门楣
          for (const sx of [-1, 1]) {
            const post = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.12, DOOR_H, WALL_T + 0.08)), trim);
            post.position.set(s.x + sx * (s.len / 2 - 0.06), DOOR_H / 2, s.z);
            g.add(post);
            objects.push(post);
          }
          const lintel = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.len, 0.14, WALL_T + 0.08)), trim);
          lintel.position.set(s.x, DOOR_H - 0.07, s.z);
          g.add(lintel);
          objects.push(lintel);
          // 门外的天光（随昼夜变化，与窗户共用材质刷新）：门洞不再是一片黑
          const glow = new THREE.MeshBasicMaterial({ color: '#dfeeff' });
          this.windowMats.push(glow);
          const out = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(s.len - 0.2, DOOR_H).rotateY(Math.PI)), glow);
          out.position.set(s.x, DOOR_H / 2, s.z + WALL_T / 2 + 0.25);
          out.userData.noShadow = true;
          g.add(out);
          objects.push(out);
        }
        if (s.y0 === 0) this.collide(s.x, s.z, s.yaw === 0 ? s.len / 2 : WALL_T / 2 + 0.05, s.yaw === 0 ? WALL_T / 2 + 0.05 : s.len / 2, 0, h, 'wall');
      }
      this.cutWalls.push({ px: side.px, pz: side.pz, nx: side.nx, nz: side.nz, objects, hidden: false });
    }
    // 天花板：朝下的单面平面——室内低机位抬头能看到顶，镜头在墙顶以上时背面剔除自动“看穿”
    const ceil = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w + WALL_T * 2, d + WALL_T * 2).rotateX(Math.PI / 2)), this.mat(new THREE.Color(room.wall.color).multiplyScalar(0.92).getStyle(), 'scene'));
    ceil.position.set(0, h, 0);
    ceil.userData.noShadow = true;
    g.add(ceil);
    // 天花板压边（从镜头方向看到的顶部轮廓）
    const crown = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w + WALL_T * 2, 0.18, WALL_T + 0.1)), trim);
    crown.position.set(0, h + 0.09, -d / 2 - WALL_T / 2);
    g.add(crown);
    this.cutWalls[0]?.objects.push(crown);
    return g;
  }

  private floorPattern(room: RoomConfig): THREE.Object3D {
    const [w, d] = room.size;
    const accent = room.floor.accent ?? new THREE.Color(room.floor.color).multiplyScalar(0.9).getStyle();
    const g = new THREE.Group();
    const mat = this.mat(accent, 'scene');
    const pattern = room.floor.pattern ?? 'plain';
    if (pattern === 'plank') {
      // 木地板缝：每 0.6 m 一条
      for (let x = -w / 2 + 0.6; x < w / 2; x += 0.6)
        for (const [, z0, , z1] of floorPieces(room).filter((r) => x > r[0] && x < r[2])) {
          const line = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.03, 0.004, z1 - z0)), mat);
          line.position.set(x, 0.002, (z0 + z1) / 2);
          line.userData.noShadow = true;
          g.add(line);
        }
    } else if (pattern === 'rock') {
      const geo = this.geo(new THREE.DodecahedronGeometry(0.18, 0));
      const n = Math.round(w * d * 0.6);
      const im = new THREE.InstancedMesh(geo, mat, n);
      let k = 7;
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        k = (k * 1103515245 + 12345) & 0x7fffffff;
        const x = ((k % 1000) / 1000 - 0.5) * (w - 0.6);
        k = (k * 1103515245 + 12345) & 0x7fffffff;
        const z = ((k % 1000) / 1000 - 0.5) * (d - 0.6);
        const sc = 0.4 + ((k >> 4) % 10) / 10;
        if (inHole(room, x, z)) {
          im.setMatrixAt(i, m4.makeScale(0, 0, 0));
          continue;
        }
        m4.compose(new THREE.Vector3(x, 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k % 6, 0)), new THREE.Vector3(sc, sc * 0.4, sc));
        im.setMatrixAt(i, m4);
      }
      im.userData.noShadow = true;
      g.add(im);
    } else if (pattern === 'wave') {
      // 水纹马赛克：0.5 m 小方砖，按两组正弦叠加的「波带」取三档颜色（地色 / accent / deep），
      // 地色档不画（露出底板），一个 InstancedMesh + instanceColor 完成整屋
      const s = 0.34;
      const geo = this.geo(new THREE.PlaneGeometry(s * 0.9, s * 0.9).rotateX(-Math.PI / 2));
      const base = this.mat('#ffffff', 'scene');
      const cA = new THREE.Color(accent);
      const cD = new THREE.Color(room.floor.deep ?? new THREE.Color(accent).multiplyScalar(0.78).getStyle());
      const cols: THREE.Color[] = [];
      const pts: THREE.Matrix4[] = [];
      for (let ix = 0; ix < Math.floor(w / s); ix++)
        for (let iz = 0; iz < Math.floor(d / s); iz++) {
          const x = -w / 2 + (ix + 0.5) * s;
          const z = -d / 2 + (iz + 0.5) * s;
          if (inHole(room, x, z)) continue;
          // 两组平行的波浪线（相位错开），每条线约 2 块砖宽：深色主线 + 浅色副线，线间留白
          const ph = z * 0.62 + Math.sin(x * 0.42) * 1.5 + Math.sin(x * 0.13) * 0.8;
          const l1 = Math.abs(Math.sin(ph));
          const l2 = Math.abs(Math.sin(ph + 0.75));
          const band = l1 < 0.2 ? 2 : l2 < 0.2 ? 1 : 0;
          if (band === 0) continue;
          pts.push(new THREE.Matrix4().makeTranslation(x, 0.003, z));
          cols.push(band === 2 ? cD : cA);
        }
      const im = new THREE.InstancedMesh(geo, base, Math.max(1, pts.length));
      pts.forEach((m, i) => {
        im.setMatrixAt(i, m);
        im.setColorAt(i, cols[i]!);
      });
      im.count = pts.length;
      im.userData.noShadow = true;
      g.add(im);
    } else if (pattern === 'tile' || pattern === 'checker') {
      const s = pattern === 'tile' ? 1 : 1.2;
      const geo = this.geo(new THREE.PlaneGeometry(s * 0.96, s * 0.96).rotateX(-Math.PI / 2));
      const pts: THREE.Matrix4[] = [];
      for (let ix = 0; ix < Math.floor(w / s); ix++)
        for (let iz = 0; iz < Math.floor(d / s); iz++) {
          if (pattern === 'checker' && (ix + iz) % 2) continue;
          if (pattern === 'tile' && (ix * 7 + iz * 3) % 5 !== 0) continue;
          if (inHole(room, -w / 2 + (ix + 0.5) * s, -d / 2 + (iz + 0.5) * s)) continue;
          pts.push(new THREE.Matrix4().makeTranslation(-w / 2 + (ix + 0.5) * s, 0.003, -d / 2 + (iz + 0.5) * s));
        }
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length));
      pts.forEach((m, i) => im.setMatrixAt(i, m));
      im.count = pts.length;
      im.userData.noShadow = true;
      g.add(im);
    }
    return g;
  }

  private doorMat([x, z]: [number, number]): THREE.Object3D {
    const g = new THREE.Group();
    const mat = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.6, 0.03, 0.9)), this.mat('#8c3b36', 'scene'));
    mat.position.set(x, 0.015, z);
    const inner = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.3, 0.035, 0.65)), this.mat('#c65a4e', 'scene'));
    inner.position.set(x, 0.018, z);
    g.add(mat, inner);
    g.userData.outline = false;
    return g;
  }

  /** 楼梯：沿最近的墙向上（上楼）或在地板开口（下楼），纯视觉，由出口触发区切换房间 */
  private stairsMarker(room: RoomConfig, [x, z]: [number, number]): THREE.Object3D {
    const [w, d, h] = room.size;
    const g = new THREE.Group();
    const wood = this.mat('#9a7048', 'scene');
    const alongX = Math.abs(Math.abs(x) - w / 2) < Math.abs(Math.abs(z) - d / 2);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const sh = ((i + 1) / steps) * Math.min(h * 0.55, 1.6);
      const step = new THREE.Mesh(this.geo(new THREE.BoxGeometry(alongX ? 0.28 : 1.1, sh, alongX ? 1.1 : 0.28)), wood);
      const t = i * 0.28;
      if (alongX) step.position.set(x + Math.sign(x) * 0.2, sh / 2, z - 1.1 + t);
      else step.position.set(x - 1.1 + t, sh / 2, z + Math.sign(z) * 0.2);
      g.add(step);
    }
    const rail = new THREE.Mesh(this.geo(new THREE.BoxGeometry(alongX ? 0.06 : 2.4, 0.06, alongX ? 2.4 : 0.06)), this.mat('#6b4a2c', 'scene'));
    rail.position.set(x + (alongX ? -Math.sign(x) * 0.45 : 0), 1.3, z + (alongX ? 0 : -Math.sign(z) * 0.45));
    rail.rotation[alongX ? 'x' : 'z'] = alongX ? -0.45 : 0.45;
    g.add(rail);
    return g;
  }

  // ———————————————————— 家具 ————————————————————

  private buildFurniture(f: FurnitureConfig): THREE.Group {
    const [w, h, d] = f.size ?? DEFAULT_SIZE[f.type];
    const c = f.color;
    const a = f.accent;
    const g = new THREE.Group();
    g.name = `furniture:${f.type}`;
    const box = (bw: number, bh: number, bd: number, x: number, y: number, z: number, color: string, kind: 'scene' | 'character' = 'scene') => {
      const m = new THREE.Mesh(this.geo(new THREE.BoxGeometry(bw, bh, bd)), this.mat(color, kind));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const cyl = (rt: number, rb: number, ch: number, x: number, y: number, z: number, color: string, seg = 12) => {
      const m = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(rt, rb, ch, seg)), this.mat(color, 'scene'));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    switch (f.type) {
      case 'table': {
        const top = c ?? '#a0703f';
        box(w, 0.07, d, 0, h - 0.035, 0, top);
        if (a) box(w * 0.92, 0.01, d * 0.8, 0, h + 0.005, 0, a);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, h - 0.07, 0.07, sx * (w / 2 - 0.08), (h - 0.07) / 2, sz * (d / 2 - 0.08), shade(top, 0.8));
        break;
      }
      case 'desk': {
        const top = c ?? '#9d7650';
        box(w, 0.06, d, 0, h - 0.03, 0, top);
        box(0.45, h - 0.06, d - 0.05, -w / 2 + 0.25, (h - 0.06) / 2, 0, shade(top, 0.85));
        for (let i = 0; i < 3; i++) box(0.38, 0.02, 0.01, -w / 2 + 0.25, 0.18 + i * 0.22, d / 2 - 0.02, shade(top, 0.6));
        for (const sz of [-1, 1]) box(0.06, h - 0.06, 0.06, w / 2 - 0.06, (h - 0.06) / 2, sz * (d / 2 - 0.06), shade(top, 0.8));
        break;
      }
      case 'chair': {
        const col = c ?? '#a0703f';
        box(w, 0.06, d, 0, 0.46, 0, col);
        box(w, 0.44, 0.06, 0, 0.46 + 0.25, -d / 2 + 0.03, col);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.44, 0.05, sx * (w / 2 - 0.05), 0.22, sz * (d / 2 - 0.05), shade(col, 0.8));
        break;
      }
      case 'sofa': {
        const col = c ?? '#5b8fc9';
        box(w, 0.4, d, 0, 0.2, 0, shade(col, 0.85));
        box(w - 0.3, 0.14, d - 0.25, 0, 0.47, 0.08, col);
        box(w, 0.5, 0.22, 0, 0.6, -d / 2 + 0.11, col);
        for (const sx of [-1, 1]) box(0.2, 0.28, d, sx * (w / 2 - 0.1), 0.54, 0, shade(col, 0.9));
        if (a) for (const sx of [-0.5, 0.5]) box(0.42, 0.34, 0.12, sx * w * 0.5, 0.7, -d / 2 + 0.3, a).rotation.x = -0.25;
        break;
      }
      case 'bed': {
        const frame = c ?? '#8a5a3a';
        const cover = a ?? '#e85d5d';
        box(w, 0.3, d, 0, 0.15, 0, frame);
        box(w - 0.06, 0.16, d - 0.1, 0, 0.38, 0.02, '#f7f4ee');
        box(w - 0.02, 0.1, d * 0.62, 0, 0.5, d * 0.17, cover);
        box(w * 0.7, 0.12, 0.34, 0, 0.52, -d / 2 + 0.3, '#ffffff');
        box(w, 0.85, 0.08, 0, 0.42, -d / 2 + 0.04, frame);
        break;
      }
      case 'shelf':
      case 'bookshelf': {
        const col = c ?? '#8a6040';
        box(w, h, 0.04, 0, h / 2, -d / 2 + 0.02, shade(col, 0.8));
        for (const sx of [-1, 1]) box(0.05, h, d, sx * (w / 2 - 0.025), h / 2, 0, col);
        const rows = Math.max(2, Math.round(h / 0.45));
        const palette = f.type === 'bookshelf' ? ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400'] : [a ?? '#f2a23a', shade(a ?? '#f2a23a', 0.8), '#f4efe4', '#9fd4f0'];
        for (let r = 0; r <= rows; r++) {
          const y = (r / rows) * (h - 0.05) + 0.025;
          box(w - 0.1, 0.04, d - 0.04, 0, y, 0, col);
          if (r === rows) continue;
          // 物品：书脊 / 商品盒，用确定性伪随机排布
          let x = -w / 2 + 0.1;
          let k = r * 13 + Math.round(w * 10);
          while (x < w / 2 - 0.15) {
            k = (k * 1103515245 + 12345) & 0x7fffffff;
            const bw = f.type === 'bookshelf' ? 0.05 + (k % 5) * 0.012 : 0.16 + (k % 3) * 0.05;
            const bh = (h / rows) * (0.55 + ((k >> 3) % 4) * 0.1);
            box(bw, bh, d * 0.7, x + bw / 2, y + 0.02 + bh / 2, 0.02, palette[k % palette.length]!);
            x += bw + 0.012;
          }
        }
        break;
      }
      case 'counter': {
        const col = c ?? '#f0f0ea';
        box(w, h - 0.05, d, 0, (h - 0.05) / 2, 0, col);
        box(w + 0.06, 0.05, d + 0.06, 0, h - 0.025, 0, a ?? shade(col, 0.8));
        box(w - 0.1, 0.1, 0.02, 0, 0.05, d / 2 + 0.005, shade(col, 0.7));
        break;
      }
      case 'tv': {
        box(w * 0.9, 0.45, 0.45, 0, 0.225, 0, '#5a4636');
        box(w, h - 0.5, 0.08, 0, 0.5 + (h - 0.5) / 2, -0.05, '#22252c');
        const screen = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.9, (h - 0.5) * 0.85)), this.basic('#3a6fa0'));
        screen.position.set(0, 0.5 + (h - 0.5) / 2, -0.005);
        g.add(screen);
        break;
      }
      case 'plant': {
        cyl(w * 0.35, w * 0.28, 0.4, 0, 0.2, 0, c ?? '#c6703f');
        const leaf = this.mat(a ?? '#4f9d4a', 'scene');
        for (let i = 0; i < 5; i++) {
          const s = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(w * 0.32, 0)), leaf);
          const ang = i * 1.26;
          s.position.set(Math.cos(ang) * w * 0.14, 0.4 + (h - 0.4) * (0.45 + (i % 3) * 0.2), Math.sin(ang) * w * 0.14);
          s.scale.set(1, 1.2, 1);
          g.add(s);
        }
        break;
      }
      case 'rug': {
        const r = box(w, 0.012, d, 0, 0.006, 0, c ?? '#d9674e');
        r.userData.noShadow = true;
        if (a) {
          const border = box(w * 0.86, 0.014, d * 0.8, 0, 0.008, 0, a);
          border.userData.noShadow = true;
          const center = box(w * 0.74, 0.016, d * 0.64, 0, 0.01, 0, c ?? '#d9674e');
          center.userData.noShadow = true;
        }
        g.userData.outline = false;
        break;
      }
      case 'stairs':
        break; // 楼梯由出口生成（stairsMarker）
      case 'machine': {
        const col = c ?? '#9aa7b4';
        box(w, h * 0.75, d, 0, h * 0.375, 0, col);
        box(w * 0.9, h * 0.25, d * 0.6, 0, h * 0.875, -d * 0.15, shade(col, 0.85));
        const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.6, h * 0.22)), this.basic(a ?? '#43d6b5'));
        scr.position.set(0, h * 0.55, d / 2 + 0.005);
        g.add(scr);
        for (let i = 0; i < 4; i++) {
          const led = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.035, 8, 6)), this.basic(i % 2 ? '#ff6b6b' : '#8dff8a'));
          led.position.set(-w * 0.35 + i * 0.12, h * 0.3, d / 2 + 0.01);
          g.add(led);
        }
        break;
      }
      case 'blender': {
        // 能量方块机：圆角柜身 + 操作面板 + 4 个树果投入口 + 透明搅拌罩 + 碗里的彩色树果泥 + 侧面摇柄（正面朝 +Z）
        const body = c ?? '#f4f0e6';
        const acc = a ?? '#e8504a';
        const cab = 0.82;
        box(w, cab, d, 0, cab / 2, 0, body);
        box(w + 0.04, 0.05, d + 0.04, 0, 0.03, 0, shade(body, 0.6));
        box(w + 0.03, 0.06, d + 0.03, 0, cab, 0, acc);
        // 前面板：屏幕 + 旋钮 + 指示灯
        box(w * 0.82, 0.36, 0.03, 0, cab * 0.62, d / 2 + 0.015, '#3a4256');
        const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.5, 0.18)), this.basic('#9ff0d0'));
        scr.position.set(-w * 0.12, cab * 0.66, d / 2 + 0.032);
        g.add(scr);
        const knob = cyl(0.06, 0.07, 0.05, w * 0.28, cab * 0.62, d / 2 + 0.05, '#f2c84a', 14);
        knob.rotation.x = Math.PI / 2;
        const dot = box(0.015, 0.05, 0.01, w * 0.28, cab * 0.62 + 0.03, d / 2 + 0.078, '#27304a');
        dot.rotation.z = 0.5;
        const lampCols = ['#e8504a', '#4a8fe0', '#f39ac0', '#5cb85c', '#f2d24a'];
        lampCols.forEach((lc, i) => {
          const led = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.022, 8, 6)), this.basic(lc));
          led.position.set(-w * 0.34 + i * w * 0.12, cab * 0.42, d / 2 + 0.035);
          g.add(led);
        });
        // 柜门缝与把手
        box(w * 0.86, 0.01, 0.01, 0, cab * 0.3, d / 2 + 0.005, shade(body, 0.7));
        box(0.18, 0.03, 0.03, 0, cab * 0.22, d / 2 + 0.02, '#9aa0ac');
        // 顶部：底座圆台 + 碗 + 树果泥 + 透明罩 + 顶钮
        const top = cab + 0.03;
        cyl(w * 0.36, w * 0.4, 0.08, 0, top + 0.04, 0, '#c9ccd4', 20);
        const bowl = new THREE.Mesh(this.geo(new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.2, 0), new THREE.Vector2(0.27, 0.06), new THREE.Vector2(0.3, 0.16), new THREE.Vector2(0.31, 0.2)], 20)), this.mat('#eef2f8', 'scene'));
        bowl.position.set(0, top + 0.08, 0);
        g.add(bowl);
        const paste = cyl(0.27, 0.22, 0.04, 0, top + 0.2, 0, '#e58aa8', 20);
        paste.name = 'blender-paste';
        // 果泥上的彩色旋纹
        for (let i = 0; i < 3; i++) {
          const sw = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.08 + i * 0.06, 0.012, 4, 18, Math.PI * 1.2)), this.mat(['#f2d24a', '#4a8fe0', '#5cb85c'][i]!, 'scene'));
          sw.rotation.set(-Math.PI / 2, 0, i * 2.1);
          sw.position.set(0, top + 0.225, 0);
          g.add(sw);
        }
        const glass = createToonMaterial({ color: '#d8f2ff', kind: 'scene', transparent: true, opacity: 0.32 });
        this.mats.set(`glass-${this.mats.size}`, glass);
        const dome = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), glass);
        dome.position.set(0, top + 0.2, 0);
        dome.userData.noShadow = true;
        g.add(dome);
        cyl(0.33, 0.33, 0.03, 0, top + 0.2, 0, '#9aa0ac', 24);
        cyl(0.05, 0.06, 0.06, 0, top + 0.54, 0, acc, 12);
        const ball = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.045, 10, 8)), this.mat('#fafafa', 'scene'));
        ball.position.set(0, top + 0.59, 0);
        g.add(ball);
        // 4 个树果投入口（背面一排小漏斗，颜色不同）
        ['#e8504a', '#4a8fe0', '#5cb85c', '#f2d24a'].forEach((fc, i) => {
          const x = -w * 0.33 + i * w * 0.22;
          cyl(0.06, 0.035, 0.09, x, top + 0.06, -d * 0.36, '#c9ccd4', 10);
          const berry = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.035, 8, 6)), this.mat(fc, 'scene'));
          berry.position.set(x, top + 0.12, -d * 0.36);
          g.add(berry);
        });
        // 侧面摇柄
        const axle = cyl(0.025, 0.025, 0.1, w / 2 + 0.05, cab * 0.75, 0, '#9aa0ac', 8);
        axle.rotation.z = Math.PI / 2;
        box(0.03, 0.22, 0.04, w / 2 + 0.1, cab * 0.75 - 0.08, 0, '#9aa0ac');
        const grip = cyl(0.03, 0.03, 0.1, w / 2 + 0.15, cab * 0.75 - 0.18, 0, acc, 10);
        grip.rotation.z = Math.PI / 2;
        break;
      }
      case 'workbench': {
        // 工坊工作台：厚木台面 + 铁框腿 + 下层素材箱 + 台钳 / 锤子 / 研钵 / 小砧 + 背板工具挂墙（正面朝 +Z）
        const wood = c ?? '#9a6a3e';
        const iron = a ?? '#7a7f8c';
        box(w, 0.09, d, 0, h - 0.045, 0, wood);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, h - 0.09, 0.07, sx * (w / 2 - 0.06), (h - 0.09) / 2, sz * (d / 2 - 0.06), iron);
        box(w - 0.1, 0.04, d - 0.1, 0, 0.18, 0, shade(wood, 0.8));
        // 下层：两个素材箱（药草绿 / 矿石灰）
        box(0.5, 0.26, 0.42, -w * 0.25, 0.33, 0, '#b88a55');
        for (let i = 0; i < 5; i++) {
          const leaf = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.06, 6, 4)), this.mat(i % 2 ? '#6aa84f' : '#8fbf5a', 'scene'));
          leaf.position.set(-w * 0.25 - 0.15 + i * 0.075, 0.48, (i % 3 - 1) * 0.08);
          g.add(leaf);
        }
        box(0.5, 0.26, 0.42, w * 0.22, 0.33, 0, '#8a6a48');
        for (let i = 0; i < 4; i++) {
          const ore = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.06, 0)), this.mat(i % 2 ? '#9aa3ad' : '#c9b48a', 'scene'));
          ore.position.set(w * 0.22 - 0.12 + i * 0.08, 0.49, (i % 2 ? 0.07 : -0.06));
          g.add(ore);
        }
        // 台面：台钳
        box(0.18, 0.08, 0.14, -w * 0.38, h + 0.04, d * 0.25, iron);
        box(0.05, 0.14, 0.12, -w * 0.38 - 0.06, h + 0.12, d * 0.25, shade(iron, 0.8));
        box(0.05, 0.14, 0.12, -w * 0.38 + 0.06, h + 0.12, d * 0.25, shade(iron, 0.8));
        const screw = cyl(0.012, 0.012, 0.2, -w * 0.38, h + 0.06, d * 0.25 + 0.12, '#c9ccd4', 6);
        screw.rotation.x = Math.PI / 2;
        // 研钵 + 研杵
        const mortar = new THREE.Mesh(this.geo(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.08, 0), new THREE.Vector2(0.1, 0.05), new THREE.Vector2(0.1, 0.09), new THREE.Vector2(0.085, 0.09), new THREE.Vector2(0.07, 0.03)], 12)), this.mat('#d9d4c7', 'scene'));
        mortar.position.set(-w * 0.05, h, 0);
        g.add(mortar);
        const pestle = cyl(0.015, 0.025, 0.18, -w * 0.05 + 0.04, h + 0.12, 0, '#bfb6a3', 8);
        pestle.rotation.z = -0.5;
        // 小砧 + 锤子
        box(0.2, 0.08, 0.1, w * 0.18, h + 0.04, -d * 0.1, '#5a5f6a');
        box(0.12, 0.06, 0.12, w * 0.18, h + 0.11, -d * 0.1, '#6e7480');
        const handle = box(0.03, 0.03, 0.26, w * 0.33, h + 0.02, d * 0.12, '#a07040');
        handle.rotation.y = 0.5;
        box(0.09, 0.05, 0.05, w * 0.33 - 0.06, h + 0.03, d * 0.12 - 0.11, iron).rotation.y = 0.5;
        // 精灵球半成品
        for (let i = 0; i < 3; i++) {
          const half = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), this.mat(i === 1 ? '#fafafa' : '#e0525a', 'scene'));
          half.position.set(w * 0.05 + i * 0.1, h, d * 0.3);
          g.add(half);
        }
        // 背板 + 挂墙工具
        box(w, 0.7, 0.04, 0, h + 0.45, -d / 2 + 0.02, shade(wood, 0.75));
        for (let i = 0; i < 5; i++) {
          const x = -w * 0.4 + i * w * 0.2;
          box(0.02, 0.02, 0.06, x, h + 0.68, -d / 2 + 0.06, iron);
          box(0.03, 0.26 - (i % 2) * 0.06, 0.02, x, h + 0.52, -d / 2 + 0.08, i % 2 ? '#a07040' : '#9aa0ac');
        }
        break;
      }
      case 'healer': {
        box(w, 0.9, d, 0, 0.45, 0, '#f1f1f1');
        box(w + 0.05, 0.06, d + 0.05, 0, 0.93, 0, '#e0525a');
        // 6 个球位
        for (let i = 0; i < 6; i++) {
          const slot = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.1, 12, 8)), this.mat(i < 3 ? '#e0525a' : '#fafafa', 'character'));
          slot.position.set(-w * 0.3 + (i % 3) * w * 0.3, 1.0, (i < 3 ? -1 : 1) * d * 0.2);
          g.add(slot);
        }
        const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.5, 0.25)), this.basic('#8ff0c8'));
        scr.position.set(0, 0.6, d / 2 + 0.005);
        g.add(scr);
        break;
      }
      case 'pc': {
        box(w, h * 0.8, 0.06, 0, 0.78 + h * 0.4 + 0.08, -0.05, '#e6e8ea');
        const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.88, h * 0.66)), this.basic('#5aa9e6'));
        scr.position.set(0, 0.78 + h * 0.4 + 0.08, -0.015);
        g.add(scr);
        box(0.08, 0.1, 0.08, 0, 0.83, -0.05, '#c9ccd0');
        box(w * 0.8, 0.02, 0.2, 0, 0.79, 0.15, '#d5d8dc');
        break;
      }
      case 'crate': {
        const col = c ?? '#b88a55';
        box(w, h, d, 0, h / 2, 0, col);
        for (const y of [0.08, h - 0.08]) box(w + 0.02, 0.08, d + 0.02, 0, y, 0, shade(col, 0.75));
        box(w * 0.1, h, d + 0.02, 0, h / 2, 0, shade(col, 0.75));
        break;
      }
      case 'poster': {
        // 贴墙：位置在墙面，向房间内偏 0.14
        const p = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, h)), this.mat(c ?? '#ffffff', 'scene'));
        p.position.set(0, 1.7, 0.14);
        g.add(p);
        if (a) {
          const inner = new THREE.Mesh(this.geo(new THREE.CircleGeometry(Math.min(w, h) * 0.28, 20)), this.mat(a, 'scene'));
          inner.position.set(0, 1.7, 0.145);
          g.add(inner);
        }
        g.userData.outline = false;
        break;
      }
      case 'window': {
        const glass = this.basic('#cfe8ff');
        this.windowMats.push(glass as THREE.MeshBasicMaterial);
        const pane = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, h)), glass);
        pane.position.set(0, 1.55, 0.135);
        g.add(pane);
        const frame = c ?? '#f7f3ea';
        box(w + 0.12, 0.08, 0.08, 0, 1.55 + h / 2, 0.14, frame);
        box(w + 0.2, 0.08, 0.16, 0, 1.55 - h / 2, 0.17, frame);
        box(0.06, h, 0.06, 0, 1.55, 0.14, frame);
        for (const sx of [-1, 1]) box(0.08, h, 0.08, sx * (w / 2 + 0.02), 1.55, 0.14, frame);
        // 窗帘
        for (const sx of [-1, 1]) box(0.22, h + 0.3, 0.05, sx * (w / 2 + 0.2), 1.6, 0.2, a ?? '#e9c9a0');
        break;
      }
      case 'lamp': {
        cyl(0.18, 0.2, 0.05, 0, 0.025, 0, '#4a4a4a');
        cyl(0.025, 0.025, h - 0.35, 0, (h - 0.35) / 2, 0, '#4a4a4a', 6);
        const shadeMesh = cyl(0.13, 0.22, 0.32, 0, h - 0.16, 0, c ?? '#f6e7b5');
        (shadeMesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color(c ?? '#f6e7b5');
        (shadeMesh.material as THREE.MeshToonMaterial).emissiveIntensity = 0.6;
        g.userData.lampHeight = h - 0.2;
        break;
      }
      case 'fridge': {
        const col = c ?? '#eef2f4';
        box(w, h, d, 0, h / 2, 0, col);
        box(w - 0.04, 0.02, 0.01, 0, h * 0.62, d / 2 + 0.005, shade(col, 0.7));
        for (const y of [h * 0.8, h * 0.4]) box(0.04, 0.3, 0.05, w / 2 - 0.12, y, d / 2 + 0.03, '#9aa3aa');
        if (a) box(w * 0.5, 0.25, 0.01, -w * 0.1, h * 0.75, d / 2 + 0.006, a);
        break;
      }
      case 'stove': {
        const col = c ?? '#e8e8e4';
        box(w, h - 0.03, d, 0, (h - 0.03) / 2, 0, col);
        box(w, 0.03, d, 0, h - 0.015, 0, '#2b2b2f');
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.12, 0.12, 0.02, sx * w * 0.22, h + 0.01, sz * d * 0.22, '#55555c', 16);
        box(w * 0.7, h * 0.45, 0.02, 0, h * 0.35, d / 2 + 0.01, '#3b3b40');
        break;
      }
      case 'pool': {
        // M2：熔岩池（accent = 'lava'）：不透明、自发光的橙红岩浆，石质黑边
        const lava = a === 'lava';
        const water = lava
          ? createToonMaterial({ color: c ?? '#f0742a', kind: 'scene', emissive: c ?? '#f0742a', emissiveIntensity: 0.9 })
          : createToonMaterial({ color: c ?? '#3aa6d8', kind: 'scene', transparent: true, opacity: 0.85 });
        water.userData.uTime = { value: 0 };
        water.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = water.userData.uTime as { value: number };
          sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.x * 3.0 + uTime * 1.6) * 0.02 + cos(position.z * 2.5 + uTime * 1.3) * 0.02;');
        };
        this.waterMats.push(water);
        const surf = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d, Math.ceil(w * 2), Math.ceil(d * 2)).rotateX(-Math.PI / 2)), water);
        surf.position.y = 0.02;
        surf.userData.noShadow = true;
        g.add(surf);
        const rim = this.mat(lava ? '#2c2428' : '#e9f6f9', 'scene');
        for (const sx of [-1, 1]) {
          const r1 = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.2, 0.14, d + 0.4)), rim);
          r1.position.set(sx * (w / 2 + 0.1), 0.07, 0);
          const r2 = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w + 0.4, 0.14, 0.2)), rim);
          r2.position.set(0, 0.07, sx * (d / 2 + 0.1));
          g.add(r1, r2);
        }
        // 水池也挡路（不能走进去）；冲浪进池在 M1-11 谜题里处理
        g.userData.poolCollider = true;
        this.collide(f.position[0], f.position[1], w / 2, d / 2, f.yaw ?? 0, 1.2, 'pool');
        break;
      }
      case 'stall': {
        const wood = c ?? '#9a6a3c';
        box(w, 0.9, d * 0.6, 0, 0.45, d * 0.2, wood);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, h, 0.08, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05), shade(wood, 0.8));
        // 条纹遮阳棚
        const stripes = 6;
        for (let i = 0; i < stripes; i++) {
          const s = box(w / stripes, 0.05, d + 0.3, -w / 2 + (i + 0.5) * (w / stripes), h, 0.1, i % 2 ? '#fafafa' : (a ?? '#e05a4a'));
          s.rotation.x = 0.18;
        }
        // 货物
        for (let i = 0; i < 5; i++) {
          const item = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.12, 10, 8)), this.mat(i % 2 ? (a ?? '#e05a4a') : shade(a ?? '#e05a4a', 1.25), 'character'));
          item.position.set(-w * 0.35 + i * w * 0.17, 0.98, d * 0.25);
          g.add(item);
        }
        break;
      }
      case 'barrel': {
        const col = c ?? '#8a5a34';
        cyl(w * 0.45, w * 0.45, h, 0, h / 2, 0, col, 14);
        const mid = cyl(w * 0.5, w * 0.5, h * 0.5, 0, h / 2, 0, shade(col, 1.05), 14);
        mid.scale.set(1, 1, 1);
        for (const y of [0.12, h - 0.12]) cyl(w * 0.47, w * 0.47, 0.05, 0, y, 0, '#4b4b4f', 14);
        break;
      }
      case 'boulder': {
        const rock = this.mat(c ?? '#6d6a72', 'scene');
        const m = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.5, 0)), rock);
        m.scale.set(w, h * 0.9, d);
        m.position.y = h * 0.42;
        m.rotation.set(0.3, (w * 7) % 3, 0.15);
        g.add(m);
        const m2 = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.28, 0)), this.mat(shade(c ?? '#6d6a72', 0.85), 'scene'));
        m2.position.set(w * 0.42, 0.2, d * 0.3);
        g.add(m2);
        break;
      }
      case 'crystal': {
        const col = c ?? '#7fe0ff';
        for (let i = 0; i < 4; i++) {
          const k = createToonMaterial({ color: col, kind: 'character', emissive: col, emissiveIntensity: 0.9 });
          this.mats.set(`crystal-${this.mats.size}`, k);
          const s2 = 0.5 + (i % 3) * 0.25;
          const cr = new THREE.Mesh(this.geo(new THREE.ConeGeometry(w * 0.18 * s2, h * s2, 5)), k);
          const ang = i * 1.7;
          cr.position.set(Math.cos(ang) * w * 0.22, (h * s2) / 2, Math.sin(ang) * d * 0.22);
          cr.rotation.set(Math.sin(ang) * 0.35, 0, Math.cos(ang) * 0.35);
          g.add(cr);
        }
        g.userData.glow = col;
        break;
      }
      case 'column': {
        // 水系道馆立柱：方形柱础 → 12 棱柱身（交替深浅色，形成凹槽感）→ 波纹腰带 → 柱头；顶部贴到天花板
        const col = c ?? '#e4f4f7';
        const acc = a ?? '#2f7fa8';
        box(w + 0.2, 0.22, d + 0.2, 0, 0.11, 0, shade(col, 0.82));
        box(w + 0.06, 0.16, d + 0.06, 0, 0.3, 0, acc);
        const shaftH = h - 0.9;
        cyl(w * 0.4, w * 0.44, shaftH, 0, 0.38 + shaftH / 2, 0, col, 12);
        for (let i = 0; i < 12; i += 2) {
          const ang = (i / 12) * Math.PI * 2;
          const fl = box(0.05, shaftH - 0.2, 0.05, Math.cos(ang) * w * 0.4, 0.38 + shaftH / 2, Math.sin(ang) * w * 0.4, shade(col, 0.88));
          fl.rotation.y = -ang;
        }
        for (const y of [1.6, 1.78]) {
          const ring = new THREE.Mesh(this.geo(new THREE.TorusGeometry(w * 0.45, 0.04, 6, 20).rotateX(Math.PI / 2)), this.mat(acc, 'scene'));
          ring.position.y = y;
          g.add(ring);
        }
        cyl(w * 0.6, w * 0.44, 0.3, 0, h - 0.37, 0, shade(col, 0.95), 12);
        box(w + 0.3, 0.22, d + 0.3, 0, h - 0.11, 0, acc);
        break;
      }
      case 'banner': {
        // 挂旗：顶杆 + 旗面（底部燕尾）+ 中央水滴纹章；贴墙，向房间内偏 0.16
        const col = c ?? '#2f7fa8';
        const top = f.y ?? 6.6;
        const rod = cyl(0.04, 0.04, w + 0.3, 0, top + 0.05, 0.16, '#c9a25c', 8);
        rod.rotation.z = Math.PI / 2;
        for (const sx of [-1, 1]) {
          const cap = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.07, 8, 6)), this.mat('#c9a25c', 'scene'));
          cap.position.set(sx * (w / 2 + 0.15), top + 0.05, 0.16);
          g.add(cap);
        }
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, 0);
        shape.lineTo(w / 2, 0);
        shape.lineTo(w / 2, -h);
        shape.lineTo(0, -h + 0.45);
        shape.lineTo(-w / 2, -h);
        shape.closePath();
        const cloth = new THREE.Mesh(this.geo(new THREE.ShapeGeometry(shape)), this.mat(col, 'scene'));
        cloth.position.set(0, top, 0.17);
        g.add(cloth);
        const trimShape = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, 0.12)), this.mat(a ?? '#e4f4f7', 'scene'));
        trimShape.position.set(0, top - 0.25, 0.18);
        g.add(trimShape);
        // 水滴纹章：圆 + 三角尖
        const drop = new THREE.Shape();
        const r = w * 0.26;
        drop.absarc(0, 0, r, Math.PI * 1.2, Math.PI * -0.2, true);
        drop.lineTo(0, r * 2.1);
        drop.closePath();
        const em = new THREE.Mesh(this.geo(new THREE.ShapeGeometry(drop, 12)), this.mat(a ?? '#e4f4f7', 'scene'));
        em.position.set(0, top - h * 0.5, 0.19);
        g.add(em);
        g.userData.outline = false;
        break;
      }
      case 'bleacher': {
        // 观众看台：三级台阶 + 座椅色带 + 后排扶手栏杆（正面朝 +Z）
        const col = c ?? '#9fd0dd';
        const seat = a ?? '#2f7fa8';
        const steps = 3;
        const sd = d / steps;
        for (let i = 0; i < steps; i++) {
          const sh = ((i + 1) / steps) * (h - 0.4);
          box(w, sh, sd, 0, sh / 2, d / 2 - sd * (i + 0.5), shade(col, 1 - i * 0.06));
          box(w - 0.1, 0.08, sd * 0.45, 0, sh + 0.04, d / 2 - sd * (i + 0.35), seat);
          box(w - 0.02, 0.04, 0.04, 0, sh - 0.02, d / 2 - sd * i + 0.01, shade(col, 0.75));
        }
        const railY = h - 0.4 + 0.9;
        box(w, 0.06, 0.06, 0, railY, -d / 2 + 0.06, '#c9a25c');
        for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += w / 6) box(0.05, 0.9, 0.05, x, h - 0.4 + 0.45, -d / 2 + 0.06, '#c9a25c');
        for (const sx of [-1, 1]) box(0.08, h - 0.4, d, sx * (w / 2 + 0.04), (h - 0.4) / 2, 0, shade(col, 0.7));
        break;
      }
      case 'emblem': {
        // 墙面徽纹浮雕：外环 + 内圆 + 三道波浪（翠澜道馆水系纹章），向房间内偏 0.2
        const col = c ?? '#2f7fa8';
        const acc = a ?? '#e4f4f7';
        const cy = f.y ?? 4.8;
        const R = w / 2;
        const ring = new THREE.Mesh(this.geo(new THREE.TorusGeometry(R, 0.12, 8, 40)), this.mat('#c9a25c', 'scene'));
        ring.position.set(0, cy, 0.24);
        g.add(ring);
        const disc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(R - 0.06, R - 0.06, 0.08, 40).rotateX(Math.PI / 2)), this.mat(col, 'scene'));
        disc.position.set(0, cy, 0.2);
        g.add(disc);
        for (let k = 0; k < 3; k++) {
          const pts: THREE.Vector3[] = [];
          const yy = cy - R * 0.45 + k * R * 0.42;
          const span = R * (k === 1 ? 1.5 : 1.3);
          for (let i = 0; i <= 24; i++) {
            const t = i / 24;
            pts.push(new THREE.Vector3(-span / 2 + span * t, yy + Math.sin(t * Math.PI * 3) * 0.13, 0.27));
          }
          const wave = new THREE.Mesh(this.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 6, false)), this.mat(acc, 'scene'));
          g.add(wave);
        }
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const stud = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.08, 8, 6)), this.mat('#f2d58a', 'scene'));
          stud.position.set(Math.cos(ang) * R, cy + Math.sin(ang) * R, 0.36);
          g.add(stud);
        }
        g.userData.outline = false;
        break;
      }
      case 'beam': {
        // 顶梁：主梁 + 下沿压条 + 两端托架（沿局部 X 方向横跨房间）
        const col = c ?? '#2f7fa8';
        const y = f.y ?? 6.75;
        box(w, h, d, 0, y, 0, col);
        box(w, 0.06, d + 0.08, 0, y - h / 2 - 0.03, 0, shade(col, 0.75));
        for (const sx of [-1, 1]) {
          box(0.3, 0.7, d * 0.8, sx * (w / 2 - 0.18), y - h / 2 - 0.3, 0, shade(col, 0.85));
        }
        for (let x = -w / 2 + 2.5; x < w / 2 - 1; x += 5) {
          const lamp = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.22, 0.32, 0.22, 12)), this.mat('#e4f4f7', 'scene'));
          lamp.position.set(x, y - h / 2 - 0.12, 0);
          g.add(lamp);
          const bulb = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.13, 10, 8)), this.basic('#fff6dc'));
          bulb.position.set(x, y - h / 2 - 0.25, 0);
          g.add(bulb);
        }
        break;
      }
      case 'dais': {
        // 馆主台：两级圆角台阶 + 金色压边 + 前沿水纹镶嵌（顶面高于地面，压边各自错开 1 cm 避免共面）
        const col = c ?? '#2f7fa8';
        const acc = a ?? '#9fd0dd';
        const s1 = h * 0.5;
        box(w, s1, d, 0, s1 / 2, 0, shade(col, 0.9));
        box(w + 0.04, 0.05, d + 0.04, 0, s1 - 0.015, 0, '#c9a25c');
        box(w * 0.78, h - s1, d * 0.72, 0, s1 + (h - s1) / 2, -d * 0.1, col);
        box(w * 0.78 + 0.04, 0.05, d * 0.72 + 0.04, 0, h - 0.015, -d * 0.1, '#c9a25c');
        box(w * 0.7, 0.012, d * 0.5, 0, h + 0.016, -d * 0.1, acc);
        for (let i = 0; i < 5; i++) box(w * 0.1, 0.02, 0.05, -w * 0.3 + i * w * 0.15, s1 * 0.5, d / 2 + 0.012, acc);
        break;
      }
      case 'fountain': {
        // 水幕喷泉：石砌水槽 + 槽内水面 + 背后喷嘴横梁；水幕平时收起，对战时（setBattle）2 s 内升起，
        // 水幕是向下滚动的竖条纹半透明面，底部有一圈脉动的水花环
        const col = c ?? '#e4f4f7';
        const acc = a ?? '#2f7fa8';
        box(w, 0.32, d, 0, 0.16, 0, shade(col, 0.85));
        box(w + 0.08, 0.06, d + 0.08, 0, 0.33, 0, acc);
        const water = createToonMaterial({ color: '#5cc4e8', kind: 'scene', transparent: true, opacity: 0.8 });
        water.userData.uTime = { value: 0 };
        water.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = water.userData.uTime as { value: number };
          sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.x * 9.0 + uTime * 3.0) * 0.008;');
        };
        this.waterMats.push(water);
        const surf = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w - 0.16, d - 0.16, 8, 4).rotateX(-Math.PI / 2)), water);
        surf.position.y = 0.3;
        surf.userData.noShadow = true;
        surf.userData.dynamic = true;
        g.add(surf);
        // 喷嘴横梁（水幕顶端）+ 一排喷嘴
        box(w, 0.14, 0.2, 0, 0.32 + h + 0.07, -d * 0.2, acc);
        for (let i = 0; i < 5; i++) cyl(0.035, 0.05, 0.08, -w * 0.4 + (i * w * 0.8) / 4, 0.32 + h - 0.02, -d * 0.2, '#c9a25c', 8);
        for (const sx of [-1, 1]) box(0.12, h + 0.1, 0.18, sx * (w / 2 - 0.06), 0.32 + (h + 0.1) / 2, -d * 0.2, shade(col, 0.9));
        // 水幕：竖条纹纹理向下滚动
        const tex = this.stripeTexture();
        tex.repeat.set(3, 2);
        const curtainMat = new THREE.MeshBasicMaterial({ map: tex, color: '#bfeaff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        this.mats.set(`curtain-${this.mats.size}`, curtainMat);
        const curtain = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w - 0.3, h)), curtainMat);
        curtain.position.set(0, 0.32, -d * 0.2 + 0.02);
        curtain.scale.y = 0.001;
        curtain.visible = false;
        curtain.userData.noShadow = true;
        curtain.userData.dynamic = true;
        g.add(curtain);
        const splashMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
        this.mats.set(`splash-${this.mats.size}`, splashMat);
        const splash = new THREE.Mesh(this.geo(new THREE.RingGeometry(0.15, 0.42, 20).rotateX(-Math.PI / 2)), splashMat);
        splash.position.set(0, 0.315, -d * 0.2 + 0.15);
        splash.scale.set(0.001, 1, 0.001);
        splash.visible = false;
        splash.userData.noShadow = true;
        splash.userData.dynamic = true;
        g.add(splash);
        this.fountains.push({ curtain, tex, splash, h, level: 0 });
        g.userData.outline = false;
        break;
      }
      case 'reception': {
        // 接待台：弧形台身（7 段拼成的弧）+ 台面压边 + 正面水滴徽章 + 服务铃 + 显示屏（正面朝 +Z）
        const col = c ?? '#2f7fa8';
        const acc = a ?? '#e4f4f7';
        const R = w * 0.9;
        const n = 7;
        const span = w / R;
        for (let i = 0; i < n; i++) {
          const t = -span / 2 + (span * (i + 0.5)) / n;
          const x = Math.sin(t) * R;
          const z = R - Math.cos(t) * R - d * 0.15;
          const seg = box((w / n) * 1.04, h - 0.08, d * 0.55, x, (h - 0.08) / 2, z, i % 2 ? shade(col, 0.92) : col);
          seg.rotation.y = -t;
          const top = box((w / n) * 1.06, 0.08, d * 0.75, x, h - 0.04, z - d * 0.05, acc);
          top.rotation.y = -t;
          const band = box((w / n) * 1.05, 0.06, 0.02, x + Math.sin(t) * d * 0.28, h * 0.35, z + Math.cos(t) * d * 0.28, '#c9a25c');
          band.rotation.y = -t;
        }
        // 水滴徽章（正面中央）
        const drop = new THREE.Shape();
        const r = 0.16;
        drop.absarc(0, 0, r, Math.PI * 1.2, Math.PI * -0.2, true);
        drop.lineTo(0, r * 2.1);
        drop.closePath();
        const em = new THREE.Mesh(this.geo(new THREE.ShapeGeometry(drop, 12)), this.mat(acc, 'scene'));
        em.position.set(0, h * 0.6, d * 0.14 + 0.012);
        g.add(em);
        cyl(0.07, 0.09, 0.03, w * 0.25, h + 0.015, -d * 0.05, '#c9a25c', 12);
        const bell = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), this.mat('#f2d58a', 'scene'));
        bell.position.set(w * 0.25, h + 0.03, -d * 0.05);
        g.add(bell);
        box(0.5, 0.32, 0.04, -w * 0.2, h + 0.22, -d * 0.2, '#2b3440');
        const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.44, 0.26)), this.basic('#8fe0ff'));
        scr.position.set(-w * 0.2, h + 0.22, -d * 0.2 - 0.021);
        scr.rotation.y = Math.PI;
        g.add(scr);
        box(0.06, 0.12, 0.06, -w * 0.2, h + 0.06, -d * 0.2, '#2b3440');
        break;
      }
      case 'trophy': {
        // 奖杯柜：木柜身 + 3 层隔板 + 玻璃门 + 金杯 / 徽章牌（正面朝 +Z，贴墙）
        const col = c ?? '#7a5a3c';
        const acc = a ?? '#2f7fa8';
        box(w, 0.12, d, 0, 0.06, 0, shade(col, 0.8));
        box(w, h - 0.12, 0.06, 0, h / 2 + 0.06, -d / 2 + 0.03, acc);
        for (const sx of [-1, 1]) box(0.08, h, d, sx * (w / 2 - 0.04), h / 2, 0, col);
        box(w, 0.1, d, 0, h - 0.05, 0, col);
        const shelves = [0.5, 1.1, 1.65];
        for (const y of shelves) box(w - 0.16, 0.04, d - 0.08, 0, y, 0, shade(col, 1.1));
        const cupGeo = this.geo(new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.07, 0.02), new THREE.Vector2(0.02, 0.04), new THREE.Vector2(0.02, 0.12), new THREE.Vector2(0.09, 0.16), new THREE.Vector2(0.1, 0.28), new THREE.Vector2(0.085, 0.29)], 14));
        const gold = this.mat('#f2c84a', 'scene');
        for (const [i, y] of shelves.entries()) {
          for (let k = 0; k < 3; k++) {
            const x = -w * 0.3 + k * w * 0.3;
            if ((i + k) % 2 === 0) {
              const cup = new THREE.Mesh(cupGeo, gold);
              cup.userData.sharedGeometry = true;
              const sc = i === 2 ? 1.25 : 1;
              cup.scale.setScalar(sc);
              cup.position.set(x, y + 0.02, 0);
              g.add(cup);
              for (const sx of [-1, 1]) {
                const handle = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.045 * sc, 0.01, 4, 10, Math.PI)), gold);
                handle.position.set(x + sx * 0.1 * sc, y + 0.2 * sc, 0);
                handle.rotation.z = sx * -Math.PI / 2;
                g.add(handle);
              }
            } else {
              // 徽章牌：底座 + 圆形徽章
              box(0.22, 0.26, 0.03, x, y + 0.15, -d * 0.2, shade(col, 0.7));
              const badge = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12).rotateX(Math.PI / 2)), this.mat(['#6ad0f0', '#f2c84a', '#e86a6a'][i]!, 'scene'));
              badge.position.set(x, y + 0.16, -d * 0.2 + 0.03);
              g.add(badge);
            }
          }
        }
        const glass = createToonMaterial({ color: '#cfefff', kind: 'scene', transparent: true, opacity: 0.25 });
        this.mats.set(`glass-${this.mats.size}`, glass);
        const pane = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w - 0.16, h - 0.24)), glass);
        pane.position.set(0, h / 2 + 0.03, d / 2 - 0.01);
        pane.userData.noShadow = true;
        g.add(pane);
        box(0.02, h - 0.24, 0.03, 0, h / 2 + 0.03, d / 2, '#c9a25c');
        break;
      }
      case 'skylight': {
        // 天窗：天花板上的框 + 发光玻璃（随昼夜） + 向下的光柱（白天可见；加色混合、上浓下淡）
        const ceilY = f.y ?? 7;
        const frame = c ?? '#2f7fa8';
        const glass = this.basic('#dff4ff');
        this.windowMats.push(glass as THREE.MeshBasicMaterial);
        const pane = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2)), glass);
        pane.position.y = ceilY - 0.01;
        pane.userData.noShadow = true;
        g.add(pane);
        for (const sz of [-1, 1]) box(w + 0.24, 0.24, 0.12, 0, ceilY - 0.12, sz * (d / 2 + 0.06), frame);
        for (const sx of [-1, 1]) box(0.12, 0.24, d, sx * (w / 2 + 0.06), ceilY - 0.12, 0, frame);
        box(0.08, 0.16, d, 0, ceilY - 0.08, 0, frame);
        box(w, 0.16, 0.08, 0, ceilY - 0.08, 0, frame);
        const shaftTex = this.gradientTexture();
        const shaftMat = new THREE.MeshBasicMaterial({ color: a ?? '#fff6d8', alphaMap: shaftTex, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
        shaftMat.userData.base = 0.22;
        this.mats.set(`shaft-${this.mats.size}`, shaftMat);
        this.shaftMats.push(shaftMat);
        const len = ceilY - 0.05;
        // 四棱台：顶 = 天窗大小，底略放大并向 +X 偏（斜射）
        const sg = new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1, true).rotateY(Math.PI / 4);
        const shaft = new THREE.Mesh(this.geo(sg), shaftMat);
        const pos = sg.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const top = pos.getY(i) > 0;
          const k = top ? 1 : 1.25;
          pos.setXYZ(i, pos.getX(i) * Math.SQRT2 * w * k + (top ? 0 : len * 0.18), pos.getY(i) * len, pos.getZ(i) * Math.SQRT2 * d * k);
        }
        pos.needsUpdate = true;
        sg.computeVertexNormals();
        shaft.position.y = len / 2;
        shaft.renderOrder = 5;
        shaft.userData.noShadow = true;
        shaft.userData.dynamic = true;
        g.add(shaft);
        g.userData.outline = false;
        break;
      }
      case 'poolLight': {
        // 池壁水下灯：金属灯座 + 发光灯面（白天暗、夜晚亮），贴在池壁上（正面朝 +Z），y 为灯中心高度（负值 = 池内）
        const cy = f.y ?? -1.2;
        box(w, h, 0.08, 0, cy, -d / 2 + 0.04, '#9fb8c0');
        const glow = new THREE.MeshBasicMaterial({ color: '#2a4a58', toneMapped: false });
        this.mats.set(`poollight-${this.mats.size}`, glow);
        this.nightMats.push({ mat: glow, dayCol: new THREE.Color('#2a4a58'), nightCol: new THREE.Color(c ?? '#8ff0ff') });
        const lens = new THREE.Mesh(this.geo(new THREE.CircleGeometry(Math.min(w, h) * 0.38, 16)), glow);
        lens.position.set(0, cy, -d / 2 + 0.085);
        lens.userData.noShadow = true;
        lens.userData.dynamic = true;
        g.add(lens);
        g.userData.outline = false;
        break;
      }
      // ———————— M3-18 海底 ————————
      case 'kelp':
      case 'anemone': {
        // 海带 / 海葵会随水流摆动：由 UnderwaterFx 生成（合批会冻结动画），这里只放根部的小礁石
        const rock = this.mat(shade(c ?? '#4a5a5a', 0.9), 'scene');
        const m = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.28, 0)), rock);
        m.scale.set(w * 0.8, 0.5, d * 0.8);
        m.position.y = 0.08;
        g.add(m);
        break;
      }
      case 'coral': {
        // 枝状珊瑚：主干 + 两级分叉（锥体），顶端圆球；配色 c / a
        const col = c ?? '#f27a8a';
        const tip = a ?? '#ffd0d8';
        const base = this.mat(shade(col, 0.75), 'scene');
        const mb = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.35, 0)), this.mat('#6a6a72', 'scene'));
        mb.scale.set(w * 0.9, 0.45, d * 0.9);
        mb.position.y = 0.1;
        g.add(mb);
        const seed = Math.abs(Math.sin(f.position[0] * 12.9 + f.position[1] * 78.2));
        const branches = 5 + Math.round(seed * 3);
        for (let i = 0; i < branches; i++) {
          const ang = (i / branches) * Math.PI * 2 + seed * 3;
          const lean = 0.2 + ((i * 0.37 + seed) % 1) * 0.5;
          const len = h * (0.55 + ((i * 0.61 + seed) % 1) * 0.45);
          const pivot = new THREE.Group();
          pivot.position.set(Math.cos(ang) * 0.12 * w, 0.12, Math.sin(ang) * 0.12 * d);
          pivot.rotation.set(Math.sin(ang) * lean, 0, -Math.cos(ang) * lean);
          const br = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.035, 0.09, len, 6)), this.mat(col, 'scene'));
          br.position.y = len / 2;
          const knob = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.075, 8, 6)), this.mat(tip, 'scene'));
          knob.position.y = len;
          pivot.add(br, knob);
          // 二级分叉
          if (i % 2 === 0) {
            const sp = new THREE.Group();
            sp.position.y = len * 0.5;
            sp.rotation.set(0.7, 0, 0.3);
            const sub = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.025, 0.05, len * 0.45, 5)), this.mat(col, 'scene'));
            sub.position.y = len * 0.225;
            const k2 = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.055, 8, 6)), this.mat(tip, 'scene'));
            k2.position.y = len * 0.45;
            sp.add(sub, k2);
            pivot.add(sp);
          }
          g.add(pivot);
        }
        void base;
        break;
      }
      case 'clam': {
        // 巨蚌：下壳 + 半开上壳 + 珍珠（可调查时珍珠发光）
        const shell = c ?? '#d8c8e8';
        const inner = a ?? '#f8e8f0';
        const lower = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), this.mat(shell, 'scene'));
        lower.scale.set(w, h * 0.55, d);
        lower.position.y = h * 0.28;
        g.add(lower);
        const upper = new THREE.Group();
        const top = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.mat(shade(shell, 0.92), 'scene'));
        top.scale.set(w, h * 0.5, d);
        top.position.z = d * 0.5;
        upper.add(top);
        upper.position.set(0, h * 0.28, -d * 0.5);
        upper.rotation.x = -0.75;
        g.add(upper);
        // 壳上的放射肋
        for (let i = -3; i <= 3; i++) {
          const rib = box(0.04, 0.03, d * 0.9, (i / 3) * w * 0.38, h * 0.08, 0, shade(shell, 0.78));
          rib.rotation.y = i * 0.12;
        }
        const lip = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.46, 18).rotateX(-Math.PI / 2)), this.mat(inner, 'scene'));
        lip.scale.set(w, 1, d);
        lip.position.y = h * 0.29;
        g.add(lip);
        if (f.interact) {
          const pearl = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.11, 14, 10)), createToonMaterial({ color: '#fff8f0', kind: 'character', emissive: '#fff0e0', emissiveIntensity: 0.6 }));
          this.mats.set(`pearl-${this.mats.size}`, pearl.material as THREE.Material);
          pearl.position.set(0, h * 0.29 + 0.1, 0.05);
          g.add(pearl);
          g.userData.glow = '#fff0e0';
        }
        break;
      }
      case 'ruin': {
        // 沉没神殿的残柱：方础 + 断成两截、微微倾斜的浪纹柱身 + 落在一旁的柱头；藤壶 / 海藻斑点
        const col = c ?? '#b8c8c8';
        const acc = a ?? '#3a8aa8';
        box(w + 0.25, 0.3, d + 0.25, 0, 0.15, 0, shade(col, 0.8));
        const lower = h * 0.55;
        cyl(w * 0.38, w * 0.42, lower, 0, 0.3 + lower / 2, 0, col, 10);
        const upperH = h * 0.32;
        const up = cyl(w * 0.36, w * 0.38, upperH, w * 0.08, 0.3 + lower + upperH / 2 - 0.04, 0.04, shade(col, 0.95), 10);
        up.rotation.set(0.12, 0, -0.16);
        for (const y of [0.9, 1.15]) {
          const ring = new THREE.Mesh(this.geo(new THREE.TorusGeometry(w * 0.41, 0.035, 5, 16).rotateX(Math.PI / 2)), this.mat(acc, 'scene'));
          ring.position.y = y;
          g.add(ring);
        }
        const capital = box(w * 1.1, 0.28, d * 1.1, w * 0.9, 0.14, -d * 0.6, shade(col, 0.88));
        capital.rotation.set(0.1, 0.5, 0.3);
        for (let i = 0; i < 6; i++) {
          const ang = i * 2.3;
          const sp = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.06, 6, 5)), this.mat(i % 2 ? '#5a8a5a' : '#d8d0c0', 'scene'));
          sp.position.set(Math.cos(ang) * w * 0.4, 0.5 + ((i * 0.37) % 1) * lower, Math.sin(ang) * w * 0.4);
          g.add(sp);
        }
        break;
      }
      // ———————— M3-20 冠军之路 ————————
      case 'waterfall': {
        // 瀑布：背后的岩壁（分层岩带）+ 顶部崖口碎石 + 向下滚动的水幕（两层错速）+ 底部水潭（波纹）+ 水花环 + 水雾
        const rock = c ?? '#5a5048';
        const water = a ?? '#9fdcf5';
        const back = box(w + 2.4, h, 0.8, 0, h / 2, -d / 2 + 0.4, rock);
        back.userData.outline = false;
        for (let i = 0; i < 5; i++) box(w + 2.5, 0.12, 0.84, 0, h * (0.15 + i * 0.18), -d / 2 + 0.4, shade(rock, i % 2 ? 1.15 : 0.82));
        for (let i = 0; i < 7; i++) {
          const r = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.15, 0)), this.mat(shade(rock, 0.9 + (i % 2) * 0.2), 'scene'));
          r.position.set(-w / 2 - 0.6 + (i / 6) * (w + 1.2), h + 0.05, -d / 2 + 0.6);
          r.rotation.set(i, i * 2, 0);
          g.add(r);
        }
        const mkSheet = (speed: number, op: number, z: number, rep: number) => {
          const tex = this.stripeTexture();
          tex.repeat.set(Math.max(1, w / 1.2) * rep, 2.5);
          this.flows.push({ tex, sx: 0, sy: speed });
          const m = new THREE.MeshBasicMaterial({ map: tex, color: water, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
          this.mats.set(`fall-${this.mats.size}`, m);
          const sheet = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, h + 0.2, 1, 8)), m);
          // 水幕略向前鼓出（上窄下宽的弧）
          const pos = sheet.geometry.getAttribute('position');
          for (let k = 0; k < pos.count; k++) {
            const t = (h / 2 - pos.getY(k)) / h;
            pos.setZ(k, Math.sin(t * Math.PI * 0.5) * 0.5);
          }
          sheet.position.set(0, h / 2, -d / 2 + 0.85 + z);
          sheet.userData.noShadow = true;
          sheet.userData.dynamic = true;
          g.add(sheet);
        };
        mkSheet(1.4, 0.82, 0, 1);
        mkSheet(2.1, 0.45, 0.06, 1.6);
        // 水潭
        const poolMat = createToonMaterial({ color: '#3a8ab8', kind: 'scene', transparent: true, opacity: 0.85 });
        poolMat.userData.uTime = { value: 0 };
        poolMat.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = poolMat.userData.uTime as { value: number };
          sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(length(position.xz) * 6.0 - uTime * 4.0) * 0.025;');
        };
        this.waterMats.push(poolMat);
        const pool = new THREE.Mesh(this.geo(new THREE.CircleGeometry(1, 28, 0, Math.PI).rotateX(-Math.PI / 2)), poolMat);
        pool.rotation.y = Math.PI;
        pool.scale.set(w * 0.62, 1, d * 0.9);
        pool.position.set(0, 0.04, -d / 2 + 0.85);
        pool.userData.noShadow = true;
        pool.userData.dynamic = true;
        g.add(pool);
        // 水花环 + 水雾
        const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
        this.mats.set(`foam-${this.mats.size}`, foamMat);
        for (let i = 0; i < 6; i++) {
          const fm = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.35, 8, 6)), foamMat);
          const x = -w / 2 + 0.4 + (i / 5) * (w - 0.8);
          fm.userData.sx = 1.2;
          fm.userData.sy = 0.45;
          fm.userData.sz = 0.9;
          fm.scale.set(1.2, 0.45, 0.9);
          const base = new THREE.Vector3(x, 0.15, -d / 2 + 1.2);
          fm.position.copy(base);
          fm.userData.noShadow = true;
          fm.userData.dynamic = true;
          g.add(fm);
          this.bobs.push({ mesh: fm, base, phase: i * 1.7, amp: 0.06, pulse: 0.18 });
        }
        const mistMat = new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
        this.mats.set(`mist-${this.mats.size}`, mistMat);
        for (let i = 0; i < 5; i++) {
          const ms = new THREE.Mesh(this.geo(new THREE.SphereGeometry(1, 10, 8)), mistMat);
          ms.userData.sx = w * 0.3;
          ms.userData.sy = 0.9;
          ms.userData.sz = 0.9;
          ms.scale.set(w * 0.3, 0.9, 0.9);
          const base = new THREE.Vector3(-w / 2 + (i + 0.5) * (w / 5), 0.8 + (i % 2) * 0.5, -d / 2 + 1.6);
          ms.position.copy(base);
          ms.userData.noShadow = true;
          ms.userData.dynamic = true;
          g.add(ms);
          this.bobs.push({ mesh: ms, base, phase: i * 2.3, amp: 0.25, pulse: 0.08 });
        }
        g.userData.outline = false;
        break;
      }
      case 'river': {
        // 暗河水道：沿局部 Z 流动的水面（条纹纹理滚动）+ 两岸卵石 + 漂浮的白沫
        const water = c ?? '#2f7fae';
        const tex = this.stripeTexture();
        tex.rotation = Math.PI / 2;
        tex.center.set(0.5, 0.5);
        tex.repeat.set(Math.max(1, d / 3), Math.max(1, w / 1.5));
        this.flows.push({ tex, sx: a === 'still' ? 0 : -0.35, sy: 0 });
        const base = createToonMaterial({ color: water, kind: 'scene', transparent: true, opacity: 0.9 });
        base.userData.uTime = { value: 0 };
        base.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = base.userData.uTime as { value: number };
          sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.z * 2.0 + uTime * 2.4) * 0.02;');
        };
        this.waterMats.push(base);
        const surf = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d, Math.ceil(w), Math.ceil(d)).rotateX(-Math.PI / 2)), base);
        surf.position.y = 0.03;
        surf.userData.noShadow = true;
        surf.userData.dynamic = true;
        g.add(surf);
        const streakMat = new THREE.MeshBasicMaterial({ map: tex, color: '#d8f4ff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
        this.mats.set(`river-${this.mats.size}`, streakMat);
        const streak = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w * 0.9, d).rotateX(-Math.PI / 2)), streakMat);
        streak.position.y = 0.05;
        streak.userData.noShadow = true;
        streak.userData.dynamic = true;
        g.add(streak);
        // 水底深色
        const bed = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)), this.mat('#10283a', 'scene'));
        bed.position.y = -0.2;
        g.add(bed);
        if (!f.noCollide) {
          const n = Math.max(2, Math.round(d / 0.9));
          for (const sx of [-1, 1])
            for (let i = 0; i < n; i++) {
              const st = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.22 + ((i * 0.37) % 1) * 0.16, 0)), this.mat(i % 3 ? '#6a6460' : '#8a8278', 'scene'));
              st.position.set(sx * (w / 2 + 0.05), 0.08, -d / 2 + (i + 0.5) * (d / n));
              st.scale.y = 0.55;
              st.rotation.y = i;
              g.add(st);
            }
        }
        g.userData.outline = false;
        break;
      }
      case 'stalagmite': {
        // 石笋：主锥 + 2 个小锥，尖端偏亮；底部一圈碎石
        const col = c ?? '#7a6e62';
        const cone = (r: number, ch: number, x: number, z: number, tilt: number) => {
          const m = new THREE.Mesh(this.geo(new THREE.ConeGeometry(r, ch, 7)), this.mat(col, 'scene'));
          m.position.set(x, ch / 2, z);
          m.rotation.set(tilt, 0, -tilt * 0.6);
          g.add(m);
          const tip = new THREE.Mesh(this.geo(new THREE.ConeGeometry(r * 0.3, ch * 0.28, 6)), this.mat(shade(col, 1.35), 'scene'));
          tip.position.set(x, ch * 0.86, z);
          tip.rotation.copy(m.rotation);
          g.add(tip);
        };
        cone(w * 0.42, h, 0, 0, 0.04);
        cone(w * 0.26, h * 0.55, w * 0.32, d * 0.18, 0.12);
        cone(w * 0.2, h * 0.4, -w * 0.28, -d * 0.2, -0.1);
        for (let i = 0; i < 4; i++) {
          const r = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.13, 0)), this.mat(shade(col, 0.8), 'scene'));
          r.position.set(Math.cos(i * 1.6) * w * 0.5, 0.06, Math.sin(i * 1.6) * d * 0.5);
          g.add(r);
        }
        break;
      }
      case 'cliffwall': {
        // 可攀岩壁：分层岩带 + 外凸岩块 + 藤蔓（accent 'crack' 时为发白的裂缝与岩钉）
        const col = c ?? '#6a5e52';
        box(w, h, d, 0, h / 2, 0, col);
        for (let i = 0; i < 6; i++) box(w + 0.06, 0.18, d + 0.06, 0, h * (0.1 + i * 0.16), 0, shade(col, i % 2 ? 1.18 : 0.8));
        for (let i = 0; i < 10; i++) {
          const r = new THREE.Mesh(this.geo(new THREE.DodecahedronGeometry(0.35 + ((i * 0.41) % 1) * 0.3, 0)), this.mat(shade(col, 0.85 + ((i * 0.3) % 0.4)), 'scene'));
          r.position.set(-w / 2 + ((i * 0.618) % 1) * w, 0.6 + ((i * 0.37) % 1) * (h - 1.2), d / 2);
          r.scale.z = 0.5;
          g.add(r);
        }
        if (a === 'crack') {
          const crackMat = createToonMaterial({ color: '#f2e2c0', kind: 'scene', emissive: '#806040', emissiveIntensity: 0.35 });
          this.mats.set(`crack-${this.mats.size}`, crackMat);
          for (let i = 0; i < 6; i++) {
            const cr = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.07, h / 6 + 0.3, 0.05)), crackMat);
            cr.position.set(Math.sin(i * 1.3) * 0.35, (i + 0.5) * (h / 6), d / 2 + 0.03);
            cr.rotation.z = (i % 2 ? 1 : -1) * 0.35;
            g.add(cr);
            const peg = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateX(Math.PI / 2)), this.mat('#b8bcc4', 'scene'));
            peg.position.set(Math.sin(i * 1.3) * 0.35 + 0.3, (i + 0.5) * (h / 6), d / 2 + 0.12);
            g.add(peg);
          }
        } else {
          const vine = this.mat('#3f7a3a', 'scene');
          const leaf = this.mat('#5a9a48', 'scene');
          for (let k = 0; k < 4; k++) {
            const x0 = -1.2 + k * 0.8;
            const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(x0 + Math.sin(k * 1.9 + t * 6) * 0.3, t * h, d / 2 + 0.08 + Math.cos(t * 5 + k) * 0.05));
            g.add(new THREE.Mesh(this.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07, 5)), vine));
            for (let i = 0; i < 8; i++) {
              const lf = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.17, 5, 4)), leaf);
              const p = pts[Math.min(4, Math.floor(i / 2))]!;
              lf.position.set(p.x + ((i % 2) - 0.5) * 0.3, p.y + (i % 2) * 0.5 + 0.2, p.z + 0.04);
              lf.scale.set(1, 0.55, 0.35);
              g.add(lf);
            }
          }
        }
        break;
      }
      case 'torch': {
        // 火把：木柱 + 铁碗 + 火焰（两层锥，发光）
        cyl(0.07, 0.09, h, 0, h / 2, 0, '#6a4a2c', 8);
        box(0.3, 0.06, 0.06, 0, h * 0.7, 0, '#4a3420');
        cyl(0.2, 0.12, 0.18, 0, h + 0.05, 0, '#3a3a40', 10);
        const fl = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.15, 0.48, 8)), this.basic('#ffb040'));
        fl.position.y = h + 0.36;
        const core = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.08, 0.3, 8)), this.basic('#fff0b0'));
        core.position.y = h + 0.3;
        fl.userData.noShadow = core.userData.noShadow = true;
        g.add(fl, core);
        g.userData.glow = '#ffb040';
        break;
      }
      case 'bridge': {
        // 木桥（沿局部 Z）：横铺木板 + 两根纵梁 + 绳索扶手与立柱
        const wood = c ?? '#8a6440';
        const n = Math.max(4, Math.round(d / 0.32));
        for (let i = 0; i < n; i++) box(w, 0.08, d / n - 0.04, 0, h, -d / 2 + (i + 0.5) * (d / n), shade(wood, i % 2 ? 1 : 0.88));
        for (const sx of [-1, 1]) {
          box(0.14, 0.16, d + 0.4, sx * (w / 2 - 0.12), h - 0.1, 0, shade(wood, 0.7));
          for (const sz of [-1, 0, 1]) cyl(0.06, 0.07, 1.1, sx * (w / 2 - 0.05), h + 0.55, (sz * d) / 2.2, shade(wood, 0.75), 6);
          const rope = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.03, 0.03, d, 5).rotateX(Math.PI / 2)), this.mat(a ?? '#c8b080', 'scene'));
          rope.position.set(sx * (w / 2 - 0.05), h + 1.0, 0);
          g.add(rope);
        }
        break;
      }
      case 'pennant': {
        // 联盟旗：旗杆 + 三角旗（蓝底金边）+ 杆头金球
        cyl(0.05, 0.06, h, 0, h / 2, 0, '#c8ccd4', 8);
        const ball = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.1, 10, 8)), this.mat('#e8c050', 'scene'));
        ball.position.y = h + 0.08;
        g.add(ball);
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1.2, -0.42);
        shape.lineTo(0, -0.84);
        shape.lineTo(0, 0);
        const flag = new THREE.Mesh(this.geo(new THREE.ShapeGeometry(shape)), createToonMaterial({ color: c ?? '#2f4fa8', kind: 'scene', side: THREE.DoubleSide }));
        this.mats.set(`pennant-${this.mats.size}`, flag.material as THREE.Material);
        flag.position.set(0.05, h - 0.05, 0);
        g.add(flag);
        const trim = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.14, 12)), this.mat(a ?? '#e8c050', 'scene'));
        trim.position.set(0.42, h - 0.47, 0.01);
        g.add(trim);
        break;
      }
      case 'aquarium': {
        box(w, 0.6, d, 0, 0.3, 0, '#3d4b58');
        const glass = createToonMaterial({ color: '#7fd0f0', kind: 'scene', transparent: true, opacity: 0.45 });
        this.mats.set(`glass-${this.mats.size}`, glass);
        const tank = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w - 0.08, h - 0.6, d - 0.08)), glass);
        tank.position.y = 0.6 + (h - 0.6) / 2;
        tank.userData.noShadow = true;
        g.add(tank);
        for (let i = 0; i < 4; i++) {
          const fish = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.06, 0.18, 6).rotateZ(Math.PI / 2)), this.mat(['#ff8c42', '#ffd166', '#ef476f', '#ffffff'][i]!, 'character'));
          fish.position.set(-w * 0.3 + i * w * 0.2, 0.8 + (i % 2) * 0.3, (i % 2 ? 0.1 : -0.1) * d);
          g.add(fish);
        }
        box(w, 0.06, d, 0, h + 0.03, 0, '#3d4b58');
        break;
      }
    }
    return g;
  }

  // ———————————————————— 灯光 ————————————————————

  private buildLights(room: RoomConfig): THREE.Group {
    const [w, d, h] = room.size;
    const p = LIGHT_PRESETS[room.lighting];
    const g = new THREE.Group();
    g.add(new THREE.AmbientLight(p.ambient, p.ambientIntensity));
    g.add(new THREE.HemisphereLight(p.sky, p.ground, 0.5));
    // 主光：从镜头左上方斜照（模拟窗户 / 顶灯），带阴影
    const key = new THREE.DirectionalLight(p.key, p.keyIntensity);
    key.name = 'key';
    key.userData.base = p.keyIntensity;
    key.position.set(-w * 0.3, h * 3, d * 0.6);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    const r = Math.max(w, d) * 0.65;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: h * 6 + d });
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    g.add(key, key.target);
    // 顶灯：按房间面积分布
    // 洞穴没有顶灯，只靠水晶与微弱环境光
    const nx = room.lighting === 'cave' ? 0 : Math.max(1, Math.round(w / 6));
    const nz = Math.max(1, Math.round(d / 6));
    for (let ix = 0; ix < nx; ix++)
      for (let iz = 0; iz < nz; iz++) {
        const l = new THREE.PointLight(p.lamp, p.lampIntensity, Math.max(w, d) * 0.9, 1.6);
        l.userData.base = p.lampIntensity;
        l.position.set(-w / 2 + ((ix + 0.5) * w) / nx, h - 0.3, -d / 2 + ((iz + 0.5) * d) / nz);
        g.add(l);
        this.lampLights.push(l);
      }
    // 落地灯
    for (const f of room.furniture)
      if (f.type === 'lamp') {
        const l = new THREE.PointLight(f.color ?? p.lamp, p.lampIntensity * 0.5, 5, 2);
        l.userData.base = p.lampIntensity * 0.5;
        l.position.set(f.position[0], (f.size ?? DEFAULT_SIZE.lamp)[1] - 0.2, f.position[1]);
        g.add(l);
        this.lampLights.push(l);
      }
    // M3-20 火把：暖色火光（沿用灯具的轻微闪烁）
    for (const f of room.furniture)
      if (f.type === 'torch') {
        const th = (f.size ?? DEFAULT_SIZE.torch)[1];
        const l = new THREE.PointLight(f.color ?? '#ffb060', p.lampIntensity * 1.1, 9, 1.8);
        l.userData.base = p.lampIntensity * 1.1;
        l.position.set(f.position[0], th + 0.35, f.position[1]);
        g.add(l);
        this.lampLights.push(l);
      }
    // M3-20 瀑布：水潭上方一盏冷白光，让水幕在暗洞里发亮
    for (const f of room.furniture)
      if (f.type === 'waterfall') {
        const [, fh, fd] = f.size ?? DEFAULT_SIZE.waterfall;
        const yaw = f.yaw ?? 0;
        const l = new THREE.PointLight('#bfe8ff', p.lampIntensity * 1.2, 12, 1.6);
        l.userData.base = p.lampIntensity * 1.2;
        l.position.set(f.position[0] + Math.sin(yaw) * fd, fh * 0.45, f.position[1] + Math.cos(yaw) * fd);
        g.add(l);
        this.lampLights.push(l);
      }
    for (const f of room.furniture)
      if (f.type === 'crystal') {
        const l = new THREE.PointLight(f.color ?? '#7fe0ff', p.lampIntensity * 0.8, 6, 2);
        l.userData.base = p.lampIntensity * 0.8;
        l.position.set(f.position[0], 0.9, f.position[1]);
        g.add(l);
        this.lampLights.push(l);
      }
    // 池壁水下灯：每 3 盏共用一个点光源（放在池内前方），夜间照亮池底；白天熄灭
    const pl = room.furniture.filter((f) => f.type === 'poolLight');
    for (let i = 0; i < pl.length; i += 3) {
      const grp = pl.slice(i, i + 3);
      const x = grp.reduce((s2, f) => s2 + f.position[0], 0) / grp.length;
      const z = grp.reduce((s2, f) => s2 + f.position[1], 0) / grp.length;
      const yaw = grp[0]!.yaw ?? 0;
      const l = new THREE.PointLight(grp[0]!.color ?? '#8ff0ff', 4, 14, 1.6);
      l.userData.base = 4;
      l.intensity = 0;
      l.position.set(x + Math.sin(yaw) * 2.5, -0.9, z + Math.cos(yaw) * 2.5);
      g.add(l);
      this.nightLights.push(l);
    }
    return g;
  }

  /** 水幕纹理：竖向亮条 + 横向断续（向下滚动形成流水感）；DataTexture，无需 DOM */
  private stripeTexture(): THREE.DataTexture {
    const W = 32;
    const H = 64;
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = 0.45 + 0.35 * Math.sin((x / W) * Math.PI * 6 + Math.sin((y / H) * Math.PI * 2) * 0.8) + 0.2 * Math.sin((y / H) * Math.PI * 8 + x);
        const a = Math.max(0, Math.min(1, v));
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.textures.push(t);
    return t;
  }

  /** 光柱竖向渐变（上 1 → 下 0，alphaMap 取绿通道） */
  private gradientTexture(): THREE.DataTexture {
    const H = 32;
    const data = new Uint8Array(H * 4);
    for (let y = 0; y < H; y++) {
      const v = Math.round(Math.pow(y / (H - 1), 1.4) * 255);
      data.set([v, v, v, 255], y * 4);
    }
    const t = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.textures.push(t);
    return t;
  }

  // ———————————————————— 工具 ————————————————————

  private collide(x: number, z: number, hx: number, hz: number, yaw: number, height: number, tag: string): void {
    this.collision.add(INTERIOR_COLLISION_GROUP, { kind: 'box', x, z, hx, hz, yaw, y0: -1, y1: height, tag });
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private mat(color: string, kind: 'scene' | 'character'): THREE.Material {
    const key = `${kind}:${color}`;
    let m = this.mats.get(key);
    if (!m) {
      m = createToonMaterial({ color, kind });
      this.mats.set(key, m);
    }
    return m;
  }

  private basic(color: string): THREE.Material {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    this.mats.set(`basic:${this.mats.size}:${color}`, m);
    return m;
  }

  private dispose(group: THREE.Group): void {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.userData.outlineHull && m.material) (m.material as THREE.Material).dispose();
      // 合批生成的几何体不在 this.geos 里
      if (m.userData.batched && m.geometry) m.geometry.dispose();
    });
    for (const g of this.geos) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.geos = [];
    this.mats.clear();
    this.windowMats = [];
    this.waterMats = [];
    this.lampLights = [];
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.nightMats = [];
    this.nightLights = [];
    this.shaftMats = [];
    this.fountains = [];
    this.flows = [];
    this.bobs = [];
    this.battle = false;
    this.collision.removeGroup(INTERIOR_COLLISION_GROUP);
  }
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}

/** 地板开洞：返回围绕洞口的矩形块（无洞时为整块地板） */
function floorPieces(room: RoomConfig): Array<[number, number, number, number]> {
  const [w, d] = room.size;
  const h = room.floorHole;
  if (!h) return [[-w / 2, -d / 2, w / 2, d / 2]];
  const x0 = Math.max(-w / 2, h[0]);
  const x1 = Math.min(w / 2, h[2]);
  const z0 = Math.max(-d / 2, h[1]);
  const z1 = Math.min(d / 2, h[3]);
  const out: Array<[number, number, number, number]> = [
    [-w / 2, -d / 2, w / 2, z0],
    [-w / 2, z1, w / 2, d / 2],
    [-w / 2, z0, x0, z1],
    [x1, z0, w / 2, z1],
  ];
  return out.filter(([a, b, c, e]) => c - a > 0.01 && e - b > 0.01);
}

function inHole(room: RoomConfig, x: number, z: number, pad = 0.3): boolean {
  const h = room.floorHole;
  return !!h && x > h[0] - pad && x < h[2] + pad && z > h[1] - pad && z < h[3] + pad;
}
