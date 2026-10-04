/**
 * M1-21 · 宝可梦模型：动画状态机（MonAnimator）与模型清单。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { MonAnimator } from '@/actors/pokemon/MonAnimator';
import { dex } from '@/config/data';

function clip(name: string, duration: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, [new THREE.NumberKeyframeTrack('.position[x]', [0, duration], [0, 1])]);
}

function rig(names: [string, number][], hit: Record<string, number> = {}): MonAnimator {
  const o = new THREE.Object3D();
  return new MonAnimator(
    o,
    names.map(([n, d]) => clip(n, d)),
    hit,
  );
}

function step(a: MonAnimator, seconds: number, dt = 1 / 30): void {
  for (let t = 0; t < seconds - 1e-9; t += dt) a.update(dt);
}

describe('MonAnimator', () => {
  it('缺少的剪辑按回退链解析', () => {
    const a = rig([
      ['idle', 1],
      ['walk', 1],
      ['attack_physical', 1],
    ]);
    expect(a.resolve('run')).toBe('walk');
    expect(a.resolve('fly')).toBe('idle');
    expect(a.resolve('attack_special')).toBe('attack_physical');
    expect(a.resolve('idle_alt')).toBeNull();
  });

  it('一次性动作在命中帧回调，结束后回到基础循环', async () => {
    const a = rig(
      [
        ['idle', 2],
        ['walk', 1],
        ['attack_physical', 1],
      ],
      { attack_physical: 0.5 },
    );
    a.loop('walk');
    let hitAt = -1;
    let clock = 0;
    const done = a.play('attack_physical', { onHit: () => (hitAt = clock) });
    expect(a.busy).toBe(true);
    let finished = false;
    void done.then(() => (finished = true));
    for (let i = 0; i < 45; i++) {
      clock += 1 / 30;
      a.update(1 / 30);
    }
    await Promise.resolve();
    expect(hitAt).toBeGreaterThan(0.45);
    expect(hitAt).toBeLessThan(0.6);
    expect(finished).toBe(true);
    expect(a.busy).toBe(false);
    expect(a.state).toBe('walk');
  });

  it('倒下定格，revive 后恢复待机', async () => {
    const a = rig([
      ['idle', 1],
      ['faint', 0.5],
    ]);
    a.loop('idle');
    const p = a.play('faint', { hold: true });
    step(a, 0.7);
    await p;
    a.loop('walk'); // 定格期间忽略
    expect(a.state).toBe('idle');
    a.revive();
    step(a, 0.1);
    expect(a.busy).toBe(false);
  });

  it('被打断的动作仍会触发命中回调（伤害结算不丢）', async () => {
    const a = rig([
      ['idle', 1],
      ['attack_special', 1],
      ['hit', 0.3],
    ]);
    let hits = 0;
    const p = a.play('attack_special', { onHit: () => hits++ });
    step(a, 0.1);
    void a.play('hit');
    await p;
    expect(hits).toBe(1);
  });

  it('没有剪辑时立即完成并回调', async () => {
    const a = rig([['idle', 1]]);
    let hit = false;
    await a.play('faint', { onHit: () => (hit = true) });
    expect(hit).toBe(true);
  });
});

describe('模型清单', () => {
  const path = join(__dirname, '..', '..', 'assets', 'models', 'pokemon', 'manifest.json');
  it.skipIf(!existsSync(path))('清单条目都指向存在的 glb，且物种存在、动画齐全', () => {
    const m = JSON.parse(readFileSync(path, 'utf8')) as { models: { id: number; file: string; clips: string[]; heightM: number; tris: number }[] };
    expect(m.models.length).toBeGreaterThanOrEqual(3);
    for (const e of m.models) {
      expect(existsSync(join(path, '..', e.file)), e.file).toBe(true);
      expect(dex.species(e.id).id).toBe(e.id);
      for (const c of ['idle', 'walk', 'attack_physical', 'hit', 'faint']) expect(e.clips, `${e.file} 缺 ${c}`).toContain(c);
      expect(e.tris).toBeLessThanOrEqual(15000);
      expect(Math.abs(e.heightM - dex.species(e.id).heightM)).toBeLessThan(0.05);
    }
  });
});

describe('M1-22 · 野生宝可梦远近细节', () => {
  it('远处关闭描边外壳与投影，回到近处恢复', async () => {
    const { WildMon } = await import('@/world/spawns/WildMon');
    const body = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry());
    mesh.castShadow = true;
    const hull = new THREE.Mesh(mesh.geometry);
    hull.userData.outlineHull = true;
    mesh.add(hull);
    body.add(mesh);
    const fake = { detailNear: true, body } as unknown as InstanceType<typeof WildMon>;
    const setDetail = WildMon.prototype.setDetail;
    setDetail.call(fake, false);
    expect([hull.visible, mesh.castShadow, hull.castShadow]).toEqual([false, false, false]);
    setDetail.call(fake, true);
    expect([hull.visible, mesh.castShadow]).toEqual([true, true]);
  });
});

describe('M1-22 · 战斗展示放大', () => {
  it('小型宝可梦放大到最低展示高度，大型不变，有上限', async () => {
    const { battleBoost, BATTLE_MIN_HEIGHT, BATTLE_MAX_BOOST } = await import('@/scenes/battle/BattleActor');
    expect(0.55 * battleBoost(0.55)).toBeCloseTo(BATTLE_MIN_HEIGHT); // 木木枭
    expect(battleBoost(1.5)).toBe(1);
    expect(battleBoost(0.2)).toBe(BATTLE_MAX_BOOST);
    expect(battleBoost(0)).toBe(1);
  });
});
