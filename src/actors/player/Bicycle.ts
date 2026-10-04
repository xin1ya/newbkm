/**
 * 自行车（萌芽镇友好商店出售的重要物品）：程序化低多边形 Toon 模型 + 骑手姿势 IK。
 *
 * 模型（+Z 朝前，原点在两轮触地点中间）：翠澜蓝车架（上管 / 下管 / 立管 / 后上叉 / 后下叉）、前叉、头管、竖把、弯把与握把、
 * 鞍座与座杆、牙盘与曲柄 / 脚踏、链条罩、前后挡泥板、前车篮、车铃、后货架、车灯、脚撑；
 * 车轮为轮胎 + 轮圈 + 8 根辐条 + 花鼓，按行驶距离滚动；曲柄按传动比转动。
 *
 * 尺寸按骑手身材生成：先量出骑手腿长 / 臂长 / 肩高，再决定鞍座高度与车把位置 —— 每个角色骑上去都合身。
 *
 * 骑手（HumanModel glb）：以 sit 片段为底，动画求值后做两段 IK（与骨骼本地轴无关，只用世界坐标“指向”）：
 * - 髋部对齐鞍座；双脚踩在旋转的脚踏上，膝盖朝前；
 * - 双手握住车把，肘部略向外后方；
 * - 转弯时人车一起向内侧倾斜。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { HumanModel } from './HumanModel';

const FRAME = '#2fa59a';
const FRAME_DARK = '#227a72';
const METAL = '#c9d0dc';
const DARK = '#2a2f3a';
const TIRE = '#262a33';
const SEAT = '#5a3b2a';
const GRIP = '#3b2a22';
const BASKET = '#d9b47a';

const WHEEL_R = 0.33;
const CRANK = 0.15;
/** 传动比：曲柄转一圈，车轮转 GEAR 圈 */
const GEAR = 2.1;

export interface RiderDims {
  thigh: number;
  shin: number;
  upperArm: number;
  foreArm: number;
  /** 骨盆到肩膀的高度 */
  torso: number;
  /** 半肩宽 */
  shoulderHalf: number;
  /** 脚踝到脚底 */
  ankle: number;
}

const DEFAULT_DIMS: RiderDims = { thigh: 0.4, shin: 0.38, upperArm: 0.27, foreArm: 0.25, torso: 0.46, shoulderHalf: 0.16, ankle: 0.07 };

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);

/** 从骑手骨架量尺寸（glb 未就绪时用默认值按 style.scale 缩放） */
export function measureRider(m: HumanModel): RiderDims {
  const get = (n: string) => m.bone(n);
  const thigh = get('thigh_l');
  const shin = get('shin_l');
  const foot = get('foot_l');
  const ua = get('upperarm_l');
  const fa = get('forearm_l');
  const hand = get('hand_l');
  const hips = get('hips');
  const uaR = get('upperarm_r');
  if (!thigh || !shin || !foot || !ua || !fa || !hand || !hips || !uaR) {
    const s = m.style.scale;
    const d = { ...DEFAULT_DIMS };
    for (const k of Object.keys(d) as (keyof RiderDims)[]) d[k] *= s;
    return d;
  }
  m.root.updateMatrixWorld(true);
  const w = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const root = m.root.getWorldPosition(new THREE.Vector3());
  const footW = w(foot);
  return {
    thigh: w(thigh).distanceTo(w(shin)),
    shin: w(shin).distanceTo(footW),
    upperArm: w(ua).distanceTo(w(fa)),
    foreArm: w(fa).distanceTo(w(hand)),
    torso: Math.max(0.2, w(ua).y - w(hips).y),
    shoulderHalf: w(ua).distanceTo(w(uaR)) / 2,
    ankle: THREE.MathUtils.clamp(footW.y - root.y, 0.03, 0.12),
  };
}

/** 车身关键点（自行车本地坐标） */
interface Layout {
  rearAxle: THREE.Vector3;
  frontAxle: THREE.Vector3;
  bb: THREE.Vector3;
  seatCluster: THREE.Vector3;
  seatTop: THREE.Vector3;
  hip: THREE.Vector3;
  headBottom: THREE.Vector3;
  headTop: THREE.Vector3;
  barCenter: THREE.Vector3;
  grip: THREE.Vector3; // 左握把（x>0），右握把镜像
}

function layout(d: RiderDims): Layout {
  const leg = d.thigh + d.shin + d.ankle;
  const rearAxle = v(0, WHEEL_R, -0.54);
  const frontAxle = v(0, WHEEL_R, 0.56);
  const bb = v(0, 0.29, -0.03);
  const seatDir = v(0, Math.sin(THREE.MathUtils.degToRad(72)), -Math.cos(THREE.MathUtils.degToRad(72)));
  // 脚踏最低点时腿伸直 93%
  const hipDist = THREE.MathUtils.clamp(leg * 0.93 - CRANK, 0.38, 0.9);
  const hip = bb.clone().addScaledVector(seatDir, hipDist);
  const seatTop = hip.clone().add(v(0, -0.05, 0));
  const seatCluster = bb.clone().addScaledVector(seatDir, Math.min(0.42, hipDist - 0.12));
  const forkDir = v(0, Math.sin(THREE.MathUtils.degToRad(70)), -Math.cos(THREE.MathUtils.degToRad(70)));
  const headBottom = frontAxle.clone().addScaledVector(forkDir, 0.42);
  const headTop = headBottom.clone().addScaledVector(forkDir, 0.15);
  // 握把：肩膀前下方，手臂伸到 88%、与水平成 38°（城市车，上身较直）
  const shoulder = hip.clone().add(v(0, d.torso, 0.04));
  const reach = (d.upperArm + d.foreArm) * 0.88;
  const a = THREE.MathUtils.degToRad(38);
  const grip = v(d.shoulderHalf * 1.25, shoulder.y - Math.sin(a) * reach, shoulder.z + Math.cos(a) * reach);
  grip.y = Math.max(grip.y, headTop.y + 0.04);
  const barCenter = v(0, grip.y + 0.02, Math.max(headTop.z + 0.06, grip.z + 0.08));
  return { rearAxle, frontAxle, bb, seatCluster, seatTop, hip, headBottom, headTop, barCenter, grip };
}

export class Bicycle {
  readonly root = new THREE.Group();
  /** 前叉 + 车把（转向） */
  private steer = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private crank = new THREE.Group();
  private pedals: THREE.Object3D[] = [];
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private readonly L: Layout;
  private roll = 0;
  private crankAngle = 0;
  private lean = 0;
  private steerAngle = 0;
  private lastYaw: number | null = null;
  /** 跳跃：车身俯仰（负 = 车头抬起）、落地压缩（1 → 0）、骑手离座站立程度（0–1） */
  private pitch = 0;
  private compress = 0;
  private stand = 0;
  private airborne = false;
  private vy = 0;
  private tickAcc = 0;
  /** 每转过一定角度回调（棘轮咔哒声） */
  onTick: (() => void) | null = null;

  constructor(readonly dims: RiderDims) {
    this.root.name = 'bicycle';
    this.L = layout(dims);
    this.build();
  }

  get hipPoint(): THREE.Vector3 {
    return this.L.hip;
  }

  private mat(color: string, specular = false): THREE.Material {
    const m = createToonMaterial({ color, kind: 'character', specular });
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private tube(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 7): THREE.Mesh {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mesh = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r, r, len, seg, 1)), m);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private ball(parent: THREE.Object3D, p: THREE.Vector3, r: number, m: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(r, 0)), m);
    mesh.position.copy(p);
    parent.add(mesh);
    return mesh;
  }

  private box(parent: THREE.Object3D, p: THREE.Vector3, s: THREE.Vector3, m: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.x, s.y, s.z)), m);
    mesh.position.copy(p);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private wheel(at: THREE.Vector3, metal: THREE.Material, tire: THREE.Material, dark: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    g.position.copy(at);
    const tireMesh = new THREE.Mesh(this.geo(new THREE.TorusGeometry(WHEEL_R - 0.025, 0.028, 5, 22)), tire);
    tireMesh.rotation.y = Math.PI / 2;
    tireMesh.castShadow = true;
    const rim = new THREE.Mesh(this.geo(new THREE.TorusGeometry(WHEEL_R - 0.058, 0.011, 4, 22)), metal);
    rim.rotation.y = Math.PI / 2;
    g.add(tireMesh, rim);
    const hub = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8)), dark);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    const spokeGeo = this.geo(new THREE.CylinderGeometry(0.0045, 0.0045, WHEEL_R - 0.07, 3));
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(spokeGeo, metal);
      const a = (i / 8) * Math.PI * 2;
      const r = (WHEEL_R - 0.07) / 2 + 0.02;
      s.position.set((i % 2 ? 1 : -1) * 0.012, Math.cos(a) * r, Math.sin(a) * r);
      s.rotation.x = a;
      g.add(s);
    }
    this.root.add(g);
    this.wheels.push(g);
    return g;
  }

  private build(): void {
    const L = this.L;
    const frame = this.mat(FRAME, true);
    const frameDark = this.mat(FRAME_DARK);
    const metal = this.mat(METAL, true);
    const dark = this.mat(DARK);
    const tire = this.mat(TIRE);
    const seatM = this.mat(SEAT);
    const gripM = this.mat(GRIP);
    const basketM = this.mat(BASKET);
    const lens = new THREE.MeshBasicMaterial({ color: '#fff4c8' });
    this.mats.push(lens);

    this.wheel(L.rearAxle, metal, tire, dark);
    // 车架
    const r = 0.022;
    this.tube(this.root, L.bb, L.seatCluster, r, frame);
    this.tube(this.root, L.seatCluster, L.headTop.clone().add(v(0, -0.02, 0)), r * 0.95, frame);
    this.tube(this.root, L.bb, L.headBottom.clone().add(v(0, 0.02, 0)), r * 1.1, frame);
    for (const s of [-1, 1]) {
      const axle = L.rearAxle.clone().add(v(s * 0.055, 0, 0));
      this.tube(this.root, L.bb.clone().add(v(s * 0.03, 0, 0)), axle, 0.012, frame);
      this.tube(this.root, L.seatCluster.clone().add(v(s * 0.018, -0.02, 0)), axle, 0.011, frame);
    }
    this.tube(this.root, L.headBottom, L.headTop, 0.03, frameDark, 8);
    this.ball(this.root, L.bb, 0.04, dark);
    // 座杆 + 鞍座
    this.tube(this.root, L.seatCluster, L.seatTop.clone().add(v(0, -0.03, 0)), 0.013, metal);
    const seat = new THREE.Group();
    seat.position.copy(L.seatTop).add(v(0, -0.015, 0));
    const saddle = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.085, 0.04, 0.05, 6)), seatM);
    saddle.scale.set(1, 1, 1.9);
    saddle.position.z = 0.02;
    saddle.castShadow = true;
    seat.add(saddle);
    this.box(seat, v(0, -0.035, -0.02), v(0.05, 0.02, 0.1), dark);
    this.root.add(seat);
    // 后货架 + 后挡泥板
    const rackY = L.rearAxle.y + WHEEL_R + 0.07;
    this.box(this.root, v(0, rackY, L.rearAxle.z + 0.02), v(0.13, 0.012, 0.3), metal);
    for (const s of [-1, 1]) this.tube(this.root, v(s * 0.06, rackY, L.rearAxle.z + 0.12), L.rearAxle.clone().add(v(s * 0.06, 0, 0)), 0.006, metal, 4);
    this.tube(this.root, v(0, rackY, L.rearAxle.z - 0.08), L.seatCluster.clone().add(v(0, -0.03, -0.02)), 0.006, metal, 4);
    const fender = (at: THREE.Vector3, start: number, len: number, parent: THREE.Object3D) => {
      // 圆弧在本地 XY 平面从 +X 起逆时针；绕 Y 转 -90° 后 +X → 车头方向（φ=0 前、π/2 顶、π 后）
      const g = this.geo(new THREE.TorusGeometry(WHEEL_R + 0.03, 0.024, 3, 12, len));
      g.rotateZ(start);
      g.scale(1, 1, 2.2);
      const f = new THREE.Mesh(g, frameDark);
      f.rotation.y = -Math.PI / 2;
      f.position.copy(at);
      parent.add(f);
    };
    fender(L.rearAxle, Math.PI * 0.42, Math.PI * 0.55, this.root);
    // 红色尾灯
    const tail = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.05, 0.025, 0.015)), new THREE.MeshBasicMaterial({ color: '#ff4a3a' }));
    this.mats.push(tail.material);
    tail.position.set(0, rackY - 0.02, L.rearAxle.z - 0.17);
    this.root.add(tail);
    // 牙盘 / 曲柄 / 脚踏
    this.crank.position.copy(L.bb);
    const ring = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.085, 0.011, 4, 16)), metal);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = 0.045;
    this.crank.add(ring);
    for (const s of [-1, 1]) {
      const arm = this.tube(this.crank, v(s * 0.06, 0, 0), v(s * 0.06, s * -CRANK, 0), 0.011, dark, 5);
      void arm;
      const pedal = new THREE.Group();
      pedal.position.set(s * 0.1, s * -CRANK, 0);
      this.box(pedal, v(0, 0, 0), v(0.08, 0.018, 0.06), dark);
      this.crank.add(pedal);
      this.pedals.push(pedal);
    }
    this.root.add(this.crank);
    // 链条 + 链罩
    this.tube(this.root, L.bb.clone().add(v(0.05, 0.075, 0)), L.rearAxle.clone().add(v(0.05, 0.04, 0)), 0.006, dark, 4);
    this.tube(this.root, L.bb.clone().add(v(0.05, -0.075, 0)), L.rearAxle.clone().add(v(0.05, -0.04, 0)), 0.006, dark, 4);
    const guard = this.box(this.root, L.bb.clone().lerp(L.rearAxle, 0.45).add(v(0.07, 0.035, 0)), v(0.012, 0.09, L.bb.distanceTo(L.rearAxle) * 0.8), frameDark);
    guard.rotation.x = Math.atan2(L.bb.y - L.rearAxle.y, L.bb.z - L.rearAxle.z) * -1;
    // 脚撑（收起）
    this.tube(this.root, L.bb.clone().lerp(L.rearAxle, 0.25).add(v(-0.05, -0.02, 0)), L.rearAxle.clone().add(v(-0.07, -0.12, 0.08)), 0.008, dark, 4);

    // ——— 转向组：前叉、前轮、车把、车篮、车铃、车灯 ———
    this.steer.position.copy(L.headBottom);
    const axis = L.headTop.clone().sub(L.headBottom).normalize();
    this.steer.userData.axis = axis;
    this.root.add(this.steer);
    const local = (p: THREE.Vector3) => p.clone().sub(L.headBottom);
    for (const s of [-1, 1]) this.tube(this.steer, local(L.headBottom).add(v(s * 0.03, 0, 0)), local(L.frontAxle).add(v(s * 0.05, 0, 0)), 0.014, frame);
    this.tube(this.steer, local(L.headBottom).add(v(-0.04, 0, 0)), local(L.headBottom).add(v(0.04, 0, 0)), 0.018, frame, 6);
    const fw = this.wheel(L.frontAxle, metal, tire, dark);
    this.root.remove(fw);
    fw.position.copy(local(L.frontAxle));
    this.steer.add(fw);
    fender(local(L.frontAxle), Math.PI * 0.12, Math.PI * 0.5, this.steer);
    // 竖把
    const stemTop = local(L.barCenter).add(v(0, -0.01, 0));
    this.tube(this.steer, local(L.headTop), stemTop, 0.016, metal);
    // 弯把：中间横段 → 向后弯到握把
    const g = local(L.grip);
    for (const s of [-1, 1]) {
      const mid = v(s * 0.16, stemTop.y + 0.01, stemTop.z);
      const end = v(s * g.x, g.y, g.z);
      const bend = v(s * (g.x * 0.85), (mid.y + end.y) / 2 + 0.01, (mid.z + end.z) / 2 + 0.02);
      this.tube(this.steer, v(0, stemTop.y + 0.01, stemTop.z), mid, 0.012, metal, 6);
      this.tube(this.steer, mid, bend, 0.012, metal, 6);
      this.tube(this.steer, bend, end, 0.012, metal, 6);
      const gripEnd = end.clone().add(end.clone().sub(bend).setY(0).normalize().multiplyScalar(0.1));
      this.tube(this.steer, end.clone().lerp(bend, 0.1), gripEnd, 0.019, gripM, 6);
      // 刹车把
      this.tube(this.steer, mid.clone().lerp(bend, 0.6).add(v(0, 0, 0.02)), end.clone().add(v(0, -0.01, 0.07)), 0.005, dark, 4);
    }
    // 车铃（左把）
    const bell = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.03, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), metal);
    bell.position.set(0.12, stemTop.y + 0.035, stemTop.z);
    this.steer.add(bell);
    // 车灯
    const lampAt = local(L.headTop).add(v(0, -0.03, 0.06));
    const lamp = this.box(this.steer, lampAt, v(0.06, 0.05, 0.05), dark);
    void lamp;
    const lensMesh = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.022, 8)), lens);
    lensMesh.position.copy(lampAt).add(v(0, 0, 0.026));
    this.steer.add(lensMesh);
    // 前车篮（藤编色，开口朝上）
    const bc = local(L.headTop).add(v(0, 0.02, 0.2));
    const bw = 0.3;
    const bd = 0.22;
    const bh = 0.18;
    this.box(this.steer, bc.clone().add(v(0, -bh / 2, 0)), v(bw, 0.015, bd), basketM);
    for (const [x, z, sx, sz] of [
      [0, bd / 2, bw, 0.012],
      [0, -bd / 2, bw, 0.012],
      [bw / 2, 0, 0.012, bd],
      [-bw / 2, 0, 0.012, bd],
    ] as const) {
      this.box(this.steer, bc.clone().add(v(x, 0, z)), v(sx, bh, sz), basketM);
      this.box(this.steer, bc.clone().add(v(x, bh / 2, z)), v(sx + 0.012, 0.02, sz + 0.012), frameDark);
    }
    this.tube(this.steer, bc.clone().add(v(0, -bh / 2, -bd / 2)), local(L.headTop).add(v(0, -0.02, 0.02)), 0.008, metal, 4);
    this.tube(this.steer, bc.clone().add(v(0, -bh / 2, 0)), local(L.frontAxle).add(v(0, 0.02, 0.02)), 0.006, metal, 4);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  /**
   * 跳跃状态（每帧在 update 之前由 SceneBike 调用）：
   * 起跳时车头抬起（兔跳），下落时车身放平、略低头；落地时前后避震压缩一下，骑手屈膝缓冲。
   */
  setAir(airborne: boolean, vy: number): void {
    if (this.airborne && !airborne) this.compress = 1;
    this.airborne = airborne;
    this.vy = vy;
  }

  /** 传动比（变速档位设置；高档踏得慢、车轮转得多） */
  gearRatio = GEAR;

  /** 每帧：speed 米/秒，yaw 当前朝向 */
  update(dt: number, speed: number, yaw: number): void {
    const dist = speed * dt;
    this.roll += dist / WHEEL_R;
    for (const w of this.wheels) w.rotation.x = this.roll;
    // 有速度才蹬（滑行时曲柄停住）
    const pedaling = speed > 0.6 && !this.airborne; // 腾空时停蹬，曲柄保持水平站姿
    const dc = pedaling ? dist / WHEEL_R / this.gearRatio : 0;
    this.crankAngle += dc;
    this.crank.rotation.x = this.crankAngle;
    for (const p of this.pedals) p.rotation.x = -this.crankAngle; // 脚踏保持水平
    if (!pedaling && speed > 0.3) {
      this.tickAcc += dist;
      if (this.tickAcc > 0.35) {
        this.tickAcc = 0;
        this.onTick?.();
      }
    }
    // 转向 / 侧倾
    let turn = 0;
    if (this.lastYaw !== null && dt > 0) {
      let d = yaw - this.lastYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turn = d / dt;
    }
    this.lastYaw = yaw;
    const wantLean = THREE.MathUtils.clamp(-turn * speed * 0.045, -0.38, 0.38);
    this.lean += (wantLean - this.lean) * Math.min(1, dt * 6);
    const wantSteer = THREE.MathUtils.clamp(turn * 0.12, -0.45, 0.45) * (speed > 0.5 ? 1 : 0.4);
    this.steerAngle += (wantSteer - this.steerAngle) * Math.min(1, dt * 8);
    this.steer.quaternion.setFromAxisAngle(this.steer.userData.axis as THREE.Vector3, this.steerAngle);
    this.root.rotation.z = this.lean;
    // 跳跃俯仰：上升时抬头（最多 17°），下落时缓缓压回、略低头（最多 12°），落地瞬间回正
    const wantPitch = this.airborne ? THREE.MathUtils.clamp(-this.vy * 0.045, -0.3, 0.21) : 0;
    this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * (this.airborne ? 9 : 16));
    this.stand += ((this.airborne ? 1 : 0) - this.stand) * Math.min(1, dt * (this.airborne ? 12 : 7));
    this.compress = Math.max(0, this.compress - dt * 3.4);
    this.root.rotation.x = this.pitch;
    // 绕车身中心俯仰时后轮会陷进地面：按半轴距抬高；落地压缩时整车下沉 7 cm 再弹回
    this.root.position.y = Math.abs(Math.sin(this.pitch)) * 0.55 - this.landDip;
  }

  /** 落地压缩量（米）：0.3 s 内先沉后起 */
  private get landDip(): number {
    return this.compress > 0 ? Math.sin((1 - this.compress) * Math.PI) * 0.07 : 0;
  }

  get pitchAngle(): number {
    return this.pitch;
  }

  get leanAngle(): number {
    return this.lean;
  }

  /** 世界坐标：左 / 右脚踏、左 / 右握把、髋部目标 */
  targets(): { pedalL: THREE.Vector3; pedalR: THREE.Vector3; gripL: THREE.Vector3; gripR: THREE.Vector3; hip: THREE.Vector3; forward: THREE.Vector3 } {
    this.root.updateWorldMatrix(true, true);
    const up = this.dims.ankle + 0.012;
    const pw = (p: THREE.Object3D) => p.localToWorld(v(0, up, 0.005));
    const g = this.L.grip;
    const gl = this.steer.localToWorld(g.clone().sub(this.L.headBottom).add(v(0.03, 0, 0.03)));
    const gr = this.steer.localToWorld(v(-g.x, g.y, g.z).sub(this.L.headBottom).add(v(-0.03, 0, 0.03)));
    const forward = this.root.localToWorld(v(0, 0, 1)).sub(this.root.localToWorld(v(0, 0, 0))).normalize();
    // pedals[0] = 右侧（x<0），pedals[1] = 左侧
    return { pedalL: pw(this.pedals[1]!), pedalR: pw(this.pedals[0]!), gripL: gl, gripR: gr, hip: this.root.localToWorld(this.L.hip.clone().add(v(0, this.stand * 0.1 - this.landDip * 0.8, this.stand * 0.05))), forward };
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}

// ———————————————————— 骑手 IK ————————————————————

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qp = new THREE.Quaternion();

/** 旋转 bone，使 bone→child 的方向指向 target（世界坐标） */
export function aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3): void {
  bone.updateWorldMatrix(true, true);
  const p = bone.getWorldPosition(_a);
  const cur = child.getWorldPosition(_b).sub(p).normalize();
  const want = _c.copy(target).sub(p).normalize();
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(cur, want);
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qp);
    _qw.premultiply(_qp.invert());
  }
  bone.quaternion.copy(_qw);
  bone.updateMatrixWorld(true);
}

/** 两段 IK：返回关节（膝 / 肘）的世界位置 */
function solveJoint(root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3): THREE.Vector3 {
  const dir = target.clone().sub(root);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  dir.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
  side.normalize();
  return root.clone().addScaledVector(dir, a).addScaledVector(side, h);
}

export function limb(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3): void {
  upper.updateWorldMatrix(true, true);
  const r = upper.getWorldPosition(new THREE.Vector3());
  const l1 = r.distanceTo(lower.getWorldPosition(new THREE.Vector3()));
  const l2 = lower.getWorldPosition(new THREE.Vector3()).distanceTo(end.getWorldPosition(new THREE.Vector3()));
  const joint = solveJoint(r, target, l1, l2, pole);
  aim(upper, lower, joint);
  aim(lower, end, target);
}

/** 把骑手绑到自行车上：返回 HumanModel.postPose 回调 */
export function bikeRiderPose(bike: Bicycle): (m: HumanModel) => void {
  return (m) => {
    const hips = m.bone('hips');
    const bones = ['thigh_l', 'shin_l', 'foot_l', 'thigh_r', 'shin_r', 'foot_r', 'upperarm_l', 'forearm_l', 'hand_l', 'upperarm_r', 'forearm_r', 'hand_r'].map((n) => m.bone(n));
    if (!hips || bones.some((b) => !b)) return;
    const [thL, shL, ftL, thR, shR, ftR, uaL, faL, hdL, uaR, faR, hdR] = bones as THREE.Object3D[];
    m.root.parent?.updateWorldMatrix(true, false);
    m.root.updateMatrixWorld(true);
    const t = bike.targets();
    // 1) 髋部对齐鞍座：平移模型根节点（在父节点空间）
    const hp = hips.getWorldPosition(new THREE.Vector3());
    const delta = t.hip.clone().sub(hp);
    const parent = m.root.parent;
    if (parent) {
      const inv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const s = parent.getWorldScale(new THREE.Vector3());
      delta.applyQuaternion(inv).divide(s);
    }
    m.root.position.add(delta);
    m.root.rotation.z = bike.leanAngle;
    m.root.rotation.x = bike.pitchAngle * 0.7; // 上身随车身俯仰（离座时手臂拉车把）
    m.root.updateMatrixWorld(true);
    // 2) 腿：膝盖朝前略向外
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, t.forward).normalize(); // 左侧
    limb(thL!, shL!, ftL!, t.pedalL, t.forward.clone().addScaledVector(side, 0.15).addScaledVector(up, 0.2));
    limb(thR!, shR!, ftR!, t.pedalR, t.forward.clone().addScaledVector(side, -0.15).addScaledVector(up, 0.2));
    // 3) 手：肘部朝外后下
    limb(uaL!, faL!, hdL!, t.gripL, side.clone().multiplyScalar(0.8).addScaledVector(t.forward, -0.6).addScaledVector(up, -0.5));
    limb(uaR!, faR!, hdR!, t.gripR, side.clone().multiplyScalar(-0.8).addScaledVector(t.forward, -0.6).addScaledVector(up, -0.5));
  };
}
