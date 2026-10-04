/**
 * 战斗领域遮挡物隐藏：战斗场展开时，把圈内（含机位余量）会挡住镜头的世界物体暂时隐藏，战斗结束原样恢复。
 *
 * - 普通网格（道具 / 岩石 / NPC / 其他野生宝可梦）：中心落在圈内且不是贴地薄片、也不是地形级大物体 → visible = false
 * - 静态实例化网格（植被：树 / 草 / 花 / 灌木）：逐实例判断，圈内实例矩阵置零（frustumCulled = false 的动态实例
 *   和每帧重写矩阵的系统，如环境生物 / 农田 / 采集点，打 userData.noOcclude 或被跳过）
 * - exclude 子树（战斗场、特效、玩家、对方训练家、借用的宝可梦）永不隐藏
 * - 物体可写 userData.noOcclude = true 显式豁免
 */
import * as THREE from 'three';

/** 大于这个包围球半径的视为地形 / 水面 / 建筑群，不隐藏 */
export const OCCLUDER_MAX_RADIUS = 14;
/** 高度小于这个的视为贴地薄片（道路 / 贴花），不隐藏 */
export const OCCLUDER_MIN_HEIGHT = 0.3;

interface HiddenInstances {
  mesh: THREE.InstancedMesh;
  saved: Array<[number, THREE.Matrix4]>;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class ArenaOccluders {
  private readonly meshes: THREE.Object3D[] = [];
  private readonly instances: HiddenInstances[] = [];
  private active = false;

  get hiddenCount(): number {
    return this.meshes.length + this.instances.reduce((n, h) => n + h.saved.length, 0);
  }

  /**
   * @param center 战斗场中心
   * @param radius 隐藏半径（战斗场半径 + 机位余量）
   * @param exclude 不隐藏的子树根
   */
  hide(world: THREE.Object3D, center: THREE.Vector3, radius: number, exclude: Array<THREE.Object3D | null | undefined>): void {
    if (this.active) this.restore();
    this.active = true;
    const skip = new Set(exclude.filter((o): o is THREE.Object3D => !!o));
    const r2 = radius * radius;
    const box = new THREE.Box3();
    const sphere = new THREE.Sphere();
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    world.updateMatrixWorld(true);

    const visit = (o: THREE.Object3D): void => {
      if (skip.has(o) || !o.visible || o.userData.noOcclude) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) {
        this.hideInstances(o as THREE.InstancedMesh, center, r2, m, p);
        return; // 实例化网格不再下钻
      }
      const mesh = o as THREE.Mesh;
      if ((mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) && mesh.geometry && mesh.frustumCulled) {
        const g = mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        box.copy(g.boundingBox!).applyMatrix4(mesh.matrixWorld);
        box.getBoundingSphere(sphere);
        const h = box.max.y - box.min.y;
        const dx = sphere.center.x - center.x;
        const dz = sphere.center.z - center.z;
        if (sphere.radius <= OCCLUDER_MAX_RADIUS && h >= OCCLUDER_MIN_HEIGHT && dx * dx + dz * dz <= r2) {
          mesh.visible = false;
          this.meshes.push(mesh);
          return;
        }
      }
      for (const c of o.children) visit(c);
    };
    for (const c of world.children) visit(c);
  }

  private hideInstances(im: THREE.InstancedMesh, center: THREE.Vector3, r2: number, m: THREE.Matrix4, p: THREE.Vector3): void {
    // 动态实例（每帧重写矩阵）不碰，否则会被覆盖或恢复时把动画状态写坏
    if (!im.frustumCulled || im.userData.dynamicInstances) return;
    let saved: Array<[number, THREE.Matrix4]> | null = null;
    const n = im.instanceMatrix.count;
    for (let i = 0; i < n; i++) {
      im.getMatrixAt(i, m);
      p.setFromMatrixPosition(m).applyMatrix4(im.matrixWorld);
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      if (dx * dx + dz * dz > r2) continue;
      if (m.elements[0] === 0 && m.elements[5] === 0 && m.elements[10] === 0) continue; // 本来就隐藏
      (saved ??= []).push([i, m.clone()]);
      im.setMatrixAt(i, ZERO);
    }
    if (saved) {
      im.instanceMatrix.needsUpdate = true;
      this.instances.push({ mesh: im, saved });
    }
  }

  restore(): void {
    for (const o of this.meshes) o.visible = true;
    for (const h of this.instances) {
      for (const [i, mat] of h.saved) h.mesh.setMatrixAt(i, mat);
      h.mesh.instanceMatrix.needsUpdate = true;
    }
    this.meshes.length = 0;
    this.instances.length = 0;
    this.active = false;
  }
}
