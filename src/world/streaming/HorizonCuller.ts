/**
 * 性能 P1 · 地平线遮挡剔除（分块级）。
 *
 * 地形是高度场，本身就是最大的遮挡物：山脊、海崖、高地背后的分块（地形 + 植被）和城镇建筑块
 * 从相机看不见时不提交绘制。做法：
 *   对物体包围盒顶面的 9 个采样点（4 角 + 4 边中点 + 中心）各做一次相机 → 采样点的射线步进，
 *   沿途地形高出射线 margin 以上即该点被挡；9 点全被挡才算不可见（保守，宁可多画）。
 * 高度场上，顶面被挡时其下方的部分一定也被挡（射线更低），所以只测顶面即可。
 * - 相机所在分块与相邻分块永不剔除；
 * - 每 0.2 s 更新一次，结果带 1 次滞回（连续 2 次判定不可见才隐藏，避免镜头快速转动时闪烁）。
 */
import type * as THREE from 'three';
import type { Heightfield } from '../terrain/Heightfield';

export interface CullTarget {
  /** 世界包围盒（顶面 y = max.y 应包含树 / 建筑高度） */
  box: THREE.Box3;
  /** 要显隐的对象 */
  objects: THREE.Object3D[];
  /** 永不剔除（例如相机所在分块） */
  pinned?: boolean;
  /** 内部：连续被判定遮挡的次数 */
  hiddenVotes?: number;
  culled?: boolean;
}

export const HORIZON_STEP = 8;
export const HORIZON_MARGIN = 1.5;

/** 从 eye 看 target 点是否被地形挡住 */
export function pointOccluded(hf: Heightfield, eye: THREE.Vector3, tx: number, ty: number, tz: number, step = HORIZON_STEP, margin = HORIZON_MARGIN): boolean {
  const dx = tx - eye.x;
  const dy = ty - eye.y;
  const dz = tz - eye.z;
  const len = Math.hypot(dx, dz);
  if (len < 24) return false;
  // 起点、终点各留一段：脚下与目标自身的地形不算遮挡
  const n = Math.floor((len - 12) / step);
  for (let i = 1; i <= n; i++) {
    const t = (6 + i * step) / len;
    if (t >= 1) break;
    const x = eye.x + dx * t;
    const z = eye.z + dz * t;
    if (!hf.inBounds(x, z)) continue;
    if (hf.heightAt(x, z) > eye.y + dy * t + margin) return true;
  }
  return false;
}

/** 包围盒顶面 9 点全被挡 → 不可见 */
export function boxOccluded(hf: Heightfield, eye: THREE.Vector3, box: THREE.Box3): boolean {
  if (eye.y > box.max.y + 400) return false;
  const y = box.max.y;
  const xs = [box.min.x, (box.min.x + box.max.x) / 2, box.max.x];
  const zs = [box.min.z, (box.min.z + box.max.z) / 2, box.max.z];
  // 先测离相机最近的点（最可能可见，尽早退出）
  const pts: Array<[number, number, number]> = [];
  for (const x of xs) for (const z of zs) pts.push([x, z, (x - eye.x) ** 2 + (z - eye.z) ** 2]);
  pts.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of pts) if (!pointOccluded(hf, eye, x, y, z)) return false;
  return true;
}

export class HorizonCuller {
  private timer = 0;
  enabled = true;
  /** 本轮被剔除的目标数（F3 面板） */
  culled = 0;

  constructor(private readonly hf: Heightfield) {}

  /** 每帧调用；返回本帧是否重新计算过 */
  update(dt: number, eye: THREE.Vector3, targets: Iterable<CullTarget>): boolean {
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.timer = 0.2;
    let culled = 0;
    for (const t of targets) {
      const occ = this.enabled && !t.pinned && boxOccluded(this.hf, eye, t.box);
      t.hiddenVotes = occ ? (t.hiddenVotes ?? 0) + 1 : 0;
      const hide = t.hiddenVotes >= 2;
      if (hide !== !!t.culled) {
        t.culled = hide;
        for (const o of t.objects) o.visible = !hide;
      }
      if (hide) culled++;
    }
    this.culled = culled;
    return true;
  }

  /** 恢复全部可见（关闭剔除 / 场景切换） */
  static reset(targets: Iterable<CullTarget>): void {
    for (const t of targets) {
      t.hiddenVotes = 0;
      if (t.culled) for (const o of t.objects) o.visible = true;
      t.culled = false;
    }
  }
}
