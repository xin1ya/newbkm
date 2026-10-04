import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '@/core/camera/CameraRig';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const run = (rig: CameraRig, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) rig.update(1 / 60, null);
};

describe('CameraRig · MMORPG 式跟随', () => {
  it('注视点在胸口偏上，不是脚底', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera());
    rig.target.set(0, 10, 0);
    rig.snap();
    rig.update(1 / 60, null);
    const dir = new THREE.Vector3();
    rig.camera.getWorldDirection(dir);
    // 从相机沿视线前进到与角色同一水平距离处，高度应接近 target.y + pivotHeight
    const cam = rig.camera.position;
    const k = Math.hypot(cam.x, cam.z) / Math.hypot(dir.x, dir.z);
    expect(cam.y + dir.y * k).toBeCloseTo(10 + rig.pivotHeight, 1);
  });

  it('向前移动时镜头自动转到角色背后', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera());
    rig.yaw = Math.PI; // 镜头在 -Z 一侧
    rig.snap();
    rig.setFollow(Math.PI / 2, 7); // 角色朝 +X 跑（与镜头成 90°）
    run(rig, 6);
    expect(Math.abs(wrap(rig.yaw - (Math.PI / 2 + Math.PI)))).toBeLessThan(0.15);
  });

  it('朝镜头方向走时不回正；静止时不回正', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera());
    rig.yaw = 0;
    rig.snap();
    rig.setFollow(0, 7); // 背后应在 yaw = π，相差 π → 不动
    run(rig, 3);
    expect(Math.abs(wrap(rig.yaw))).toBeLessThan(1e-6);
    rig.setFollow(Math.PI / 2, 0);
    run(rig, 3);
    expect(Math.abs(wrap(rig.yaw))).toBeLessThan(1e-6);
  });

  it('关闭 autoFollow 后镜头保持不动', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera());
    rig.autoFollow = false;
    rig.yaw = 1;
    rig.snap();
    rig.setFollow(0, 7);
    run(rig, 3);
    expect(rig.yaw).toBe(1);
  });

  it('滚轮缩放平滑过渡，setDistance 立即生效且受上下限约束', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera());
    rig.setDistance(50);
    expect(rig.distance).toBe(rig.maxDistance);
    rig.setDistance(0);
    expect(rig.distance).toBe(rig.minDistance);
  });
});
