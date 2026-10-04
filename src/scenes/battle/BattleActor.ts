/**
 * SCN-001 · 战斗中的宝可梦表现体：包装模型根节点，提供待机呼吸、出场/收回、受击闪烁、倒下、冲撞等动画。
 * 野外可见遭遇直接借用 WildMon 的模型（战斗结束后归还），暗雷 / 我方宝可梦则新建灰模。
 * M1-21：手工模型（带骨骼动画）时改播 MonAnimator 剪辑，程序化位移（冲刺 / 击退 / 下沉）叠加在根节点上。
 */
import * as THREE from 'three';
import { setHullsVisible } from '@/render';
import type { BattleFx } from './BattleFx';
import { ease } from './BattleFx';
import { findMonRoot, monAnimator, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';
import type { MonAnimator } from '@/actors/pokemon/MonAnimator';

export { createMonModel } from '@/actors/pokemon/monModel';

/** 战斗中的最低展示高度（米，含灰模 0.25 m 余量）与最大放大倍数 */
export const BATTLE_MIN_HEIGHT = 0.85;
export const BATTLE_MAX_BOOST = 1.7;
export function battleBoost(height: number): number {
  if (!(height > 0)) return 1;
  return Math.min(BATTLE_MAX_BOOST, Math.max(1, BATTLE_MIN_HEIGHT / height));
}

export class BattleActor {
  readonly root: THREE.Object3D;
  readonly height: number;
  private t = Math.random() * 10;
  private baseY = 0;
  private baseScale: number;
  /** 借用的模型（战斗后需归还原父节点与变换） */
  private borrowed: {
    parent: THREE.Object3D | null;
    pos: THREE.Vector3;
    rot: THREE.Euler;
    scale: THREE.Vector3;
  } | null = null;
  idle = true;
  fainted = false;
  /** 挂着模型句柄的节点（借用时在包装节点内部） */
  private readonly mon: THREE.Object3D | null;

  constructor(root: THREE.Object3D, height: number, borrowed: boolean) {
    this.root = root;
    if (borrowed)
      this.borrowed = {
        parent: root.parent,
        pos: root.position.clone(),
        rot: root.rotation.clone(),
        scale: root.scale.clone(),
      };
    // 战斗展示放大（M1-22）：小型宝可梦（木木枭 0.3 m 等）在战斗镜头里太小，统一放大到最低展示高度；
    // 借用的模型在 release() 时恢复原缩放
    const boost = battleBoost(height);
    root.scale.multiplyScalar(boost);
    this.height = height * boost;
    this.baseScale = root.scale.x;
    this.mon = findMonRoot(root);
    if (this.mon) setMonLoop(this.mon, 'idle');
  }

  /** 手工模型的动画机（灰模 / 尚未加载完时为 null，走程序化动画） */
  get anim(): MonAnimator | null {
    return this.mon ? monAnimator(this.mon) : null;
  }

  place(p: THREE.Vector3, faceTo: THREE.Vector3): void {
    this.root.position.copy(p);
    this.baseY = p.y;
    this.root.rotation.set(0, Math.atan2(faceTo.x - p.x, faceTo.z - p.z), 0);
  }

  get chest(): THREE.Vector3 {
    return this.root.position.clone().setY(this.baseY + this.height * 0.55);
  }
  get feet(): THREE.Vector3 {
    return this.root.position.clone().setY(this.baseY);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.mon) updateMonModel(this.mon, dt);
    if (this.anim) {
      if (this.idle && !this.fainted) this.root.position.y = this.baseY;
      return;
    }
    if (this.idle && !this.fainted) {
      const s = 1 + Math.sin(this.t * 2.2) * 0.025;
      this.root.scale.set(this.baseScale * (2 - s), this.baseScale * s, this.baseScale * (2 - s));
      this.root.position.y = this.baseY;
    }
  }

  /** 从精灵球里出现：白光 → 放大弹出 */
  async appear(fx: BattleFx): Promise<void> {
    this.root.visible = true;
    this.idle = false;
    this.fainted = false;
    this.anim?.revive();
    void fx.burst(this.chest, 0xffffff, { count: 30, radius: 1.1, seconds: 0.4 });
    await fx.tween(0.35, (k) => this.root.scale.setScalar(Math.max(0.001, this.baseScale * ease.outBack(k))));
    this.idle = true;
  }

  /** 收回：缩小成红光 */
  async recall(fx: BattleFx): Promise<void> {
    this.idle = false;
    void fx.burst(this.chest, 0xff5a5a, { count: 20, radius: 0.6, seconds: 0.35 });
    await fx.tween(0.3, (k) => this.root.scale.setScalar(Math.max(0.001, this.baseScale * (1 - k))));
    this.root.visible = false;
  }

  /** 受击：闪烁 + 后仰 */
  async hit(fx: BattleFx, strong: boolean): Promise<void> {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.root.rotation);
    const p0 = this.root.position.clone();
    void this.anim?.play('hit');
    await fx.tween(strong ? 0.5 : 0.36, (k) => {
      this.root.visible = Math.floor(k * 10) % 2 === 0 || k > 0.9;
      const push = Math.sin(k * Math.PI) * (strong ? 0.45 : 0.25);
      this.root.position.copy(p0).addScaledVector(dir, push);
    });
    this.root.visible = true;
    this.root.position.copy(p0);
  }

  /** 物理招式冲撞：冲向目标再退回 */
  async lunge(fx: BattleFx, target: THREE.Vector3, onImpact?: () => void): Promise<void> {
    this.idle = false;
    const p0 = this.root.position.clone();
    const to = target.clone().setY(p0.y);
    const dist = Math.max(0, p0.distanceTo(to) - 1.2);
    const dir = to.sub(p0).normalize();
    const anim = this.anim;
    if (anim) {
      // 手工模型：冲到目标跟前 → 播物理攻击，命中帧触发冲击 → 退回
      await fx.tween(0.2, (k) => this.root.position.copy(p0).addScaledVector(dir, dist * ease.inOut(k)));
      await anim.play('attack_physical', { onHit: () => onImpact?.() });
      await fx.tween(0.28, (k) => this.root.position.copy(p0).addScaledVector(dir, dist * (1 - ease.outCubic(k))));
      this.root.position.copy(p0);
      this.idle = true;
      return;
    }
    await fx.tween(0.22, (k) => {
      this.root.position.copy(p0).addScaledVector(dir, dist * ease.inOut(k));
      this.root.position.y = p0.y + Math.sin(k * Math.PI) * 0.4;
    });
    onImpact?.();
    await fx.tween(0.3, (k) => this.root.position.copy(p0).addScaledVector(dir, dist * (1 - ease.outCubic(k))));
    this.root.position.copy(p0);
    this.idle = true;
  }

  /** 特殊招式：播特殊攻击到命中帧（之后的发射特效与剩余动作并行）；灰模不动（保持原表现） */
  async cast(fx: BattleFx): Promise<void> {
    const anim = this.anim;
    if (!anim) return;
    void fx;
    this.idle = false;
    await new Promise<void>((resolve) => {
      void anim.play('attack_special', { onHit: resolve }).then(() => {
        this.idle = true;
        resolve();
      });
    });
  }

  /** 变化招式：原地跳一下 */
  async hop(fx: BattleFx): Promise<void> {
    this.idle = false;
    const anim = this.anim;
    if (anim) {
      await new Promise<void>((resolve) => void anim.play('attack_special', { onHit: resolve }).then(resolve));
      this.idle = true;
      return;
    }
    await fx.tween(0.35, (k) => (this.root.position.y = this.baseY + Math.sin(k * Math.PI) * 0.5));
    this.idle = true;
  }

  /** 倒下：侧倒 + 下沉 + 描边淡出 */
  async faint(fx: BattleFx): Promise<void> {
    this.idle = false;
    this.fainted = true;
    const y0 = this.baseY;
    const anim = this.anim;
    if (anim) {
      await anim.play('faint', { hold: true });
      await fx.tween(0.35, (k) => (this.root.position.y = y0 - k * k * this.height * 0.3));
      this.root.visible = false;
      return;
    }
    const rz = this.root.rotation.z;
    await fx.tween(0.7, (k) => {
      this.root.rotation.z = rz + ease.inOut(k) * 1.3;
      this.root.position.y = y0 - k * k * this.height * 0.6;
    });
    this.root.visible = false;
  }

  /** 被精灵球吸入 */
  async absorb(fx: BattleFx, into: THREE.Vector3): Promise<void> {
    this.idle = false;
    const p0 = this.root.position.clone();
    setHullsVisible(this.root, false);
    await fx.tween(0.4, (k) => {
      this.root.scale.setScalar(Math.max(0.001, this.baseScale * (1 - k)));
      this.root.position.lerpVectors(p0, into, k);
    });
    this.root.visible = false;
    this.root.position.copy(p0);
  }

  /** 从球里挣脱 */
  async breakFree(fx: BattleFx): Promise<void> {
    this.root.visible = true;
    setHullsVisible(this.root, true);
    this.anim?.revive();
    void fx.burst(this.chest, 0xffffff, { count: 36, radius: 1.3, seconds: 0.4 });
    await fx.tween(0.3, (k) => this.root.scale.setScalar(Math.max(0.001, this.baseScale * ease.outBack(k))));
    this.idle = true;
  }

  /** 归还借用的模型；自建的模型直接销毁 */
  release(): void {
    if (this.borrowed) {
      const b = this.borrowed;
      if (b.parent && this.root.parent !== b.parent) b.parent.add(this.root);
      this.root.position.copy(b.pos);
      this.root.rotation.copy(b.rot);
      this.root.scale.copy(b.scale);
      this.root.visible = true;
      setHullsVisible(this.root, true);
      this.anim?.revive();
      if (this.mon) setMonLoop(this.mon, 'idle');
      return;
    }
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.userData.sharedGeometry) m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
