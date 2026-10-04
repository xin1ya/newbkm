/**
 * 人物模型（Blender / 生成式草模复刻 → scripts/build-models.ts → assets/models/characters/manifest.json）。
 * - 与 TrainerModel 接口一致（root / bones / style / animate / throwPose），调用方不用改；
 * - 构造时同步返回：先挂程序化 TrainerModel 作占位，glb 就绪后原地替换；清单里没有或加载失败则一直用占位；
 * - 动画：AnimationMixer，按移动速度在 idle / walk / jog / run 间交叉淡入，timeScale 按 meta.gaitSpeed 匹配步幅（脚不打滑）；
 *   pose（ride / sit）优先；throwPose(t) 按进度驱动 throw 片段。
 * - 游泳（swimming）：程序化姿势叠加在 idle 之上——低速时竖直踩水（双手胸前划水、双腿打蛋式踩水），
 *   移动时身体前倾成俯卧自由泳（双臂椭圆轨迹交替划水：水下拉臂 → 水上高肘移臂，双腿上下打水，抬头看前方），
 *   两种姿态按速度平滑混合；占位模型只做整体前倾。
 */
import * as THREE from 'three';
import type { AssetLoader } from '@/core/assets';
import { addHullOutlines, toonify } from '@/render';
import { limb } from './Bicycle';
import { DEFAULT_TRAINER, TrainerModel } from './TrainerModel';
import type { TrainerExtraPalette, TrainerPalette, TrainerStyle } from './TrainerModel';

export interface HumanManifestEntry {
  id: string;
  name: string;
  file: string;
  heightM: number;
  tris: number;
  clips: string[];
  hitTime: Record<string, number>;
  gaitSpeed?: { walk: number; jog: number; run: number };
  eyeHeight?: number;
}

type BoneKey = 'hip' | 'spine' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
/** TrainerModel 的骨骼名 → 人物骨架（全体人物同名同层级，见 art-source/tools/hkit.py） */
const BONE_MAP: Record<BoneKey, string> = {
  hip: 'hips',
  spine: 'chest',
  head: 'head',
  armL: 'upperarm_l',
  armR: 'upperarm_r',
  legL: 'thigh_l',
  legR: 'thigh_r',
};
export type HumanPose = 'ride' | 'sit' | null;

const DIR = 'models/characters/';
let registry: { loader: AssetLoader; byId: Map<string, HumanManifestEntry> } | null = null;
/** 清单就绪：人物可能在 initHumanModels 之前就被创建（玩家），加载时统一等这里 */
let markReady: () => void = () => {};
const pending: Promise<void> = new Promise<void>((res) => {
  markReady = res;
});

/** 启动时调用一次：读取人物清单（失败时全部用程序化占位） */
export function initHumanModels(loader: AssetLoader): Promise<void> {
  return loader
    .json<{ version: number; models: HumanManifestEntry[] }>(`${DIR}manifest.json`)
    .then((m) => {
      registry = { loader, byId: new Map(m.models.map((e) => [e.id, e])) };
    })
    .catch((err: unknown) => {
      console.warn('[human] 人物清单加载失败，使用程序化模型', err);
      registry = { loader, byId: new Map() };
    })
    .finally(() => markReady());
}

export function humanManifest(id: string): HumanManifestEntry | null {
  return registry?.byId.get(id) ?? null;
}

const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

export class HumanModel {
  readonly root = new THREE.Group();
  readonly fallback: TrainerModel;
  readonly style: TrainerStyle;
  /** 姿势覆盖（骑乘 / 坐），优先于移动动画 */
  pose: HumanPose = null;
  /** 跳跃 / 下落中：慢放奔跑跨步作为腾空姿态 */
  airborne = false;
  /** 游泳中（PlayerController 每帧设置） */
  swimming = false;
  /** 采集动作（计划文档 §9.2，约 1 秒）：reach = 抬手摘树果，crouch = 蹲下采草药 / 捡贝壳 / 敲矿 */
  private gestureKind: 'reach' | 'crouch' | null = null;
  private gestureT = 0;
  private gestureDur = 1;

  gesture(kind: 'reach' | 'crouch', dur = 1): void {
    this.gestureKind = kind;
    this.gestureT = dur;
    this.gestureDur = dur;
  }

  get gesturing(): boolean {
    return this.gestureT > 0;
  }

  /** 动画求值之后叠加采集姿态（整体下蹲 + 前倾，正弦进出） */
  private applyGesture(dt: number): void {
    if (this.gestureT <= 0) return;
    this.gestureT = Math.max(0, this.gestureT - dt);
    const p = 1 - this.gestureT / this.gestureDur;
    const w = Math.sin(Math.min(1, p) * Math.PI);
    if (this.gestureKind === 'crouch') {
      this.root.position.y = -0.32 * w;
      this.root.rotation.x = 0.38 * w;
    } else {
      this.root.position.y = 0.04 * w;
      this.root.rotation.x = -0.08 * w;
    }
    if (this.gestureT <= 0) {
      this.root.position.y = 0;
      this.root.rotation.x = 0;
      this.gestureKind = null;
    }
  }
  /** 每次手臂入水（自由泳划水）时回调：播放水花声 */
  onStroke: (() => void) | null = null;
  private swimK = 0;
  private swimMove = 0;
  private swimPhase = 0;
  /** glb 就绪（成功为 true；无模型 / 失败为 false） */
  readonly ready: Promise<boolean>;
  private glbBones: Record<BoneKey, THREE.Object3D> | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private throwing = false;
  private entry: HumanManifestEntry | null = null;
  private body: THREE.Object3D | null = null;
  /** 动画求值之后的姿势修正（自行车：腿踩踏板、手握车把的 IK）；仅 glb 模型调用 */
  postPose: ((m: HumanModel) => void) | null = null;

  constructor(
    readonly id: string,
    pal: TrainerPalette = DEFAULT_TRAINER,
    style: Partial<TrainerStyle> = {},
    extra: TrainerExtraPalette = {},
  ) {
    this.root.name = `human:${id}`;
    this.fallback = new TrainerModel(pal, style, extra);
    this.style = this.fallback.style;
    this.root.add(this.fallback.root);
    this.ready = this.load().catch((err: unknown) => {
      console.warn(`[human] ${id} 加载失败，保留程序化模型`, err);
      return false;
    });
  }

  /** 与 TrainerModel 相同的骨骼句柄（glb 就绪前指向占位模型） */
  get bones(): Record<BoneKey, THREE.Object3D> {
    return this.glbBones ?? this.fallback.bones;
  }

  get loaded(): boolean {
    return this.mixer !== null;
  }

  private async load(): Promise<boolean> {
    await pending;
    const r = registry;
    const e = r?.byId.get(this.id);
    if (!r || !e) return false;
    const asset = await r.loader.model(DIR + e.file, { label: e.name, showLabel: false });
    if (asset.placeholder) return false;
    const body = asset.scene;
    body.name = `model:${e.id}`;
    body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const size = box.getSize(new THREE.Vector3());
    const s = size.y > 1e-4 ? (e.heightM * this.style.scale) / size.y : 1;
    body.scale.multiplyScalar(s);
    body.position.set(0, -box.min.y * s, 0); // 脚底对齐原点（水平不居中：背包等会让包围盒偏后）
    const holder = new THREE.Group();
    holder.name = 'human-body';
    holder.add(body);
    body.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.sharedGeometry = true; // 与缓存共享，不能 dispose
    });
    toonify(holder, 'character');
    addHullOutlines(holder);
    holder.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.frustumCulled = false; // 只有一个主角，动作会超出绑定包围盒
    });
    const map: Partial<Record<BoneKey, THREE.Object3D>> = {};
    for (const k of Object.keys(BONE_MAP) as BoneKey[]) {
      const b = body.getObjectByName(BONE_MAP[k]);
      if (!b) {
        console.warn(`[human] ${e.id} 缺少骨骼 ${BONE_MAP[k]}，保留程序化模型`);
        return false;
      }
      map[k] = b;
    }
    const mixer = new THREE.AnimationMixer(body);
    for (const clip of asset.animations) this.actions.set(clip.name, mixer.clipAction(clip));
    const th = this.actions.get('throw');
    if (th) {
      th.setLoop(THREE.LoopOnce, 1);
      th.clampWhenFinished = true;
    }
    this.fallback.root.removeFromParent();
    this.root.add(holder);
    this.glbBones = map as Record<BoneKey, THREE.Object3D>;
    this.entry = e;
    this.body = body;
    this.mixer = mixer;
    this.play('idle', 1, 0);
    mixer.update(0);
    return true;
  }

  private play(name: string, timeScale: number, fade = 0.18): void {
    const a = this.actions.get(name);
    if (!a) return;
    a.timeScale = timeScale;
    if (a === this.current) return;
    a.reset().setEffectiveWeight(this.throwing ? 0 : 1).play();
    if (this.current && fade > 0) this.current.crossFadeTo(a, fade, false);
    else this.current?.stop();
    this.current = a;
  }

  /** speed：米/秒（与 TrainerModel 相同签名） */
  animate(dt: number, speed: number, time: number): void {
    if (!this.mixer) {
      this.gestureT = Math.max(0, this.gestureT - dt); // 占位模型不做采集姿态，只走计时
      this.fallback.animate(dt, this.swimming ? 0 : speed, time);
      // 占位模型：只做整体前倾 / 下沉
      const k = this.swimming ? clamp(speed / 1.6, 0, 1) : 0;
      this.root.rotation.x = this.swimming ? 0.2 + k * 1.1 : this.postPose ? this.root.rotation.x : 0;
      if (!this.postPose) this.root.position.set(0, this.swimming ? -0.3 + k * 1.1 : 0, this.swimming ? -k * 0.7 : 0);
      return;
    }
    const g = this.entry?.gaitSpeed ?? { walk: 1, jog: 3.3, run: 6.5 };
    const wasSwim = this.swimK > 0;
    this.swimK = this.swimming && !this.pose ? Math.min(1, this.swimK + dt * 3) : Math.max(0, this.swimK - dt * 4);
    if (this.swimK > 0) {
      this.play('idle', 0.6, 0.3);
      this.mixer.update(dt);
      this.swimPose(dt, speed);
      return;
    }
    if (wasSwim && !this.postPose) {
      this.root.position.set(0, 0, 0);
      this.root.rotation.set(0, 0, 0);
    }
    if (this.pose) this.play(this.pose, 1);
    else if (this.gestureT > 0) this.play(this.gestureKind === 'reach' ? 'wave' : 'nod', 1.2);
    else if (this.airborne) this.play('run', 0.12);
    else if (speed < 0.15) this.play('idle', 1);
    else if (speed < 2.4) this.play('walk', clamp(speed / g.walk, 0.6, 2));
    else if (speed < 6) this.play('jog', clamp(speed / g.jog, 0.7, 1.6));
    else this.play('run', clamp(speed / g.run, 0.7, 1.5));
    this.mixer.update(dt);
    this.applyGesture(dt);
    this.postPose?.(this);
  }

  /**
   * 游泳姿势（动画求值之后）：
   * 模型根绕左右轴前倾（踩水 0.22 rad → 自由泳 1.32 rad），并上移 / 后移使肩背露出水面；
   * 然后在模型局部坐标系（+Y 头顶、+Z 胸前、+X 左手侧）里给手脚算目标点，用两段 IK 摆臂、摆腿。
   */
  private swimPose(dt: number, speed: number): void {
    const H = (this.entry?.heightM ?? 1.6) * this.style.scale;
    const k = this.swimK;
    this.swimMove += (clamp(speed / 1.6, 0, 1) - this.swimMove) * Math.min(1, dt * 4);
    const mv = this.swimMove;
    // 划水频率：踩水约 0.5 Hz，自由泳随速度 0.7–0.95 Hz
    const prev = this.swimPhase;
    this.swimPhase += dt * THREE.MathUtils.lerp(3.0, 3.6 + speed * 0.75, mv);
    if (mv > 0.4 && Math.floor(prev / Math.PI) !== Math.floor(this.swimPhase / Math.PI)) this.onStroke?.();
    const ph = this.swimPhase;
    const lerp = THREE.MathUtils.lerp;
    // 1) 身体姿态：踩水时肩膀刚好在水面；俯卧时背部贴着水面
    const pitch = lerp(0.22, 1.32, mv) * k;
    const roll = Math.sin(ph) * 0.28 * mv * k; // 自由泳的身体左右滚转
    this.root.rotation.set(pitch, 0, roll, 'YXZ');
    this.root.position.set(0, k * lerp(1.0 - 0.8 * H, 1.05 - 0.125 * H, mv), -k * lerp(0.05, 0.75, mv));
    this.root.updateWorldMatrix(true, true);
    const b = (n: string): THREE.Object3D | null => this.bone(n);
    const toLocal = (o: THREE.Object3D): THREE.Vector3 => this.root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    const W = (x: number, y: number, z: number): THREE.Vector3 => this.root.localToWorld(new THREE.Vector3(x, y, z));
    const D = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).transformDirection(this.root.matrixWorld);
    const blend = (a: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 => a.lerp(c, mv);
    // 2) 手臂
    for (const [suf, s] of [['_l', 1], ['_r', -1]] as const) {
      const ua = b('upperarm' + suf);
      const fa = b('forearm' + suf);
      const hd = b('hand' + suf);
      if (!ua || !fa || !hd) continue;
      const sh = toLocal(ua);
      const A = sh.distanceTo(toLocal(fa)) + toLocal(fa).distanceTo(toLocal(hd));
      const p = ph + (s > 0 ? 0 : Math.PI);
      const c = Math.cos(p);
      const sn = Math.sin(p);
      // 自由泳：0 = 前伸入水，0→π 水下拉臂（经过胸腹下方），π→2π 水上移臂（高肘、手臂外展）
      const crawl = sn >= 0
        ? new THREE.Vector3(sh.x + s * 0.05, sh.y + A * 0.9 * c, sh.z + A * 0.55 * sn)
        : new THREE.Vector3(sh.x + s * A * 0.4 * -sn, sh.y + A * 0.9 * c, sh.z - A * 0.3 * -sn);
      // 踩水：双手在胸前左右画 8 字
      const tread = new THREE.Vector3(sh.x + s * (0.22 + 0.1 * Math.sin(ph * 1.5)), sh.y - 0.3, sh.z + 0.26 + 0.08 * Math.cos(ph * 1.5 + s));
      const tgt = blend(tread, crawl);
      const target = tgt;
      const pole = blend(new THREE.Vector3(s, -0.6, -0.3), new THREE.Vector3(s, 0, sn >= 0 ? 0.2 : -0.8)).normalize();
      limb(ua, fa, hd, W(target.x, target.y, target.z), D(pole.x, pole.y, pole.z));
    }
    // 3) 腿：自由泳上下打水（两倍频），踩水为交替画圈
    for (const [suf, s] of [['_l', 1], ['_r', -1]] as const) {
      const th = b('thigh' + suf);
      const sn = b('shin' + suf);
      const ft = b('foot' + suf);
      if (!th || !sn || !ft) continue;
      const hip = toLocal(th);
      const L = hip.distanceTo(toLocal(sn)) + toLocal(sn).distanceTo(toLocal(ft));
      const q = ph * 2 + (s > 0 ? 0 : Math.PI);
      const kick = new THREE.Vector3(hip.x + s * 0.06, hip.y - 0.94 * L, hip.z + 0.13 * Math.sin(q));
      const egg = ph * 1.6 + (s > 0 ? 0 : Math.PI);
      const treadL = new THREE.Vector3(hip.x + s * (0.14 + 0.06 * Math.cos(egg)), hip.y - 0.8 * L, hip.z + 0.12 + 0.12 * Math.sin(egg));
      const t = blend(treadL, kick);
      limb(th, sn, ft, W(t.x, t.y, t.z), D(0, 0, 1));
    }
    // 4) 头：俯卧时后仰看前方（不用 rotateOnWorldAxis——父骨骼带旋转）
    const head = this.glbBones?.head;
    if (head?.parent) {
      const ang = -0.95 * mv * k;
      const qw = head.getWorldQuaternion(new THREE.Quaternion());
      qw.premultiply(new THREE.Quaternion().setFromAxisAngle(D(1, 0, 0), ang));
      head.quaternion.copy(qw.premultiply(head.parent.getWorldQuaternion(new THREE.Quaternion()).invert()));
      head.updateMatrixWorld(true);
    }
  }

  /** glb 骨架里按名字取骨骼（占位模型时为 null） */
  bone(name: string): THREE.Object3D | null {
    return this.body?.getObjectByName(name) ?? null;
  }

  /** 投掷动作（0–1 进度）：暂停在 throw 片段对应时刻；t ≥ 1 时淡回当前循环 */
  throwPose(t: number): void {
    if (!this.mixer) {
      this.fallback.throwPose(t);
      return;
    }
    const a = this.actions.get('throw');
    if (!a) return;
    if (t >= 1) {
      if (this.throwing) {
        this.throwing = false;
        a.fadeOut(0.2);
        this.current?.setEffectiveWeight(1).fadeIn(0.2);
      }
      return;
    }
    if (!this.throwing) {
      this.throwing = true;
      a.reset().setEffectiveWeight(1).play();
      this.current?.setEffectiveWeight(0);
    }
    a.paused = true;
    a.time = clamp(t, 0, 1) * a.getClip().duration;
  }
}
