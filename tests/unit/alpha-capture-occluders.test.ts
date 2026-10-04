/**
 * 头目捕捉后体型保留 + 战斗领域隐藏遮挡物
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SPROUT } from '@/config/islands/sprout';
import { ALPHA_SCALE, alphaScale, denAlpha, makeRoaming } from '@/systems/alpha';
import { evolve } from '@/systems/progression';
import { createNewGame, receivePokemon } from '@/systems/state';
import { deserializeSave, serializeSave } from '@/systems/state/save';
import { ArenaOccluders } from '@/scenes/battle/occluders';
import { dex, mon, rng } from './helpers';

const dens = SPROUT.alphaDens ?? [];

describe('头目捕捉后体型保留', () => {
  it('入队 → 存档 → 读档 → 进化，头目标记与体型倍率都在', () => {
    const s = createNewGame({ name: 'T', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });
    const den = dens.find((d) => d.id === 'den-meadow')!;
    const caught = denAlpha(dex, den, rng(4));
    const roam = makeRoaming(dex, mon(19, 5), 5, rng(2));
    receivePokemon(s, caught);
    receivePokemon(s, roam);
    const back = deserializeSave(serializeSave(s)).state;
    const a = back.party.find((p) => p.uid === caught.uid)!;
    const b = back.party.find((p) => p.uid === roam.uid)!;
    expect(alphaScale(a)).toBe(ALPHA_SCALE.den);
    expect(alphaScale(b)).toBe(ALPHA_SCALE.roaming);
    evolve(dex, b, 20);
    expect(b.speciesId).toBe(20);
    expect(alphaScale(b)).toBe(ALPHA_SCALE.roaming);
  });
});

describe('战斗领域隐藏遮挡物', () => {
  const box = (x: number, z: number, h = 2, w = 1): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w));
    m.position.set(x, h / 2, z);
    return m;
  };

  it('圈内的道具 / 植被实例隐藏，圈外、贴地、地形级、豁免对象保留，恢复后原样', () => {
    const world = new THREE.Scene();
    const inside = box(2, 1);
    const outside = box(20, 0);
    const decal = box(1, 1, 0.05, 2);
    const terrain = box(0, 0, 4, 60);
    const player = new THREE.Group();
    const playerMesh = box(0, 0);
    player.add(playerMesh);
    const tagged = box(-1, 1);
    tagged.userData.noOcclude = true;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 3);
    const at = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(30, 0, 0), new THREE.Vector3(0, 0, -3)];
    at.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    const dyn = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 1);
    dyn.userData.dynamicInstances = true;
    world.add(inside, outside, decal, terrain, player, tagged, im, dyn);

    const occ = new ArenaOccluders();
    occ.hide(world, new THREE.Vector3(0, 0, 0), 9.5, [player]);
    expect(inside.visible).toBe(false);
    expect(outside.visible).toBe(true);
    expect(decal.visible).toBe(true);
    expect(terrain.visible).toBe(true);
    expect(playerMesh.visible).toBe(true);
    expect(tagged.visible).toBe(true);
    const m = new THREE.Matrix4();
    im.getMatrixAt(0, m);
    expect(m.elements[0]).toBe(0);
    im.getMatrixAt(1, m);
    expect(m.elements[12]).toBe(30);
    im.getMatrixAt(2, m);
    expect(m.elements[0]).toBe(0);
    dyn.getMatrixAt(0, m);
    expect(m.elements[0]).toBe(1);
    expect(occ.hiddenCount).toBe(3);

    occ.restore();
    expect(inside.visible).toBe(true);
    im.getMatrixAt(2, m);
    expect(m.elements[0]).toBe(1);
    expect(m.elements[14]).toBe(-3);
    expect(occ.hiddenCount).toBe(0);
  });
});

describe('头目专属素材 · 领悟头目招式', () => {
  it('每个巢穴一种素材，招式存在，巢穴头目自身属性能学', async () => {
    const { ALPHA_MATERIALS } = await import('@/config/alpha/materials');
    const { machineCompatible } = await import('@/systems/items');
    const { KEY_ITEM_BY_ID } = await import('@/config/items');
    expect(ALPHA_MATERIALS.length).toBe(dens.length);
    for (const d of dens) {
      const m = ALPHA_MATERIALS.find((x) => x.den === d.id)!;
      expect(m, d.id).toBeTruthy();
      expect(dex.hasMove(m.move), m.move).toBe(true);
      expect(KEY_ITEM_BY_ID.get(m.id)?.pocket).toBe('treasure');
      expect(dex.species(d.speciesId).types).toContain(dex.move(m.move).type);
      expect(machineCompatible(dex, mon(d.speciesId, d.level), m.move), `${d.id} ${m.move}`).toBe(true);
    }
  });

  it('属性不符没效果；失败累计保底，第 4 次失败后必定领悟', async () => {
    const { applyToPokemon } = await import('@/systems/items');
    const { KEY_ITEM_BY_ID } = await import('@/config/items');
    const keys = KEY_ITEM_BY_ID as never;
    const pika = mon(25, 30);
    expect(applyToPokemon(dex, 'alpha-mat-delta', pika, keys, { timeOfDay: 'day' }).ok).toBe(false);
    const magikarp = mon(129, 30); // 鲤鱼王：水属性但学不了招式学习器
    expect(applyToPokemon(dex, 'alpha-mat-delta', magikarp, keys, { timeOfDay: 'day' }).ok).toBe(false);
    const gyara = mon(98, 30); // 大钳蟹：水属性，可学水流裂破
    const ctx = { timeOfDay: 'day' as const, chance: () => 0.99 };
    for (let i = 0; i < 4; i++) {
      const r = applyToPokemon(dex, 'alpha-mat-delta', gyara, keys, ctx);
      expect(r.ok && r.consumed && !('learnMove' in r && r.learnMove)).toBe(true);
    }
    expect(gyara.alphaInsight?.liquidation).toBe(4);
    const r = applyToPokemon(dex, 'alpha-mat-delta', gyara, keys, ctx);
    expect(r.ok && r.learnMove).toBe('liquidation');
    expect(gyara.alphaInsight).toBeUndefined();
  });

  it('巢穴奖励包含该巢穴的素材', async () => {
    const { denReward } = await import('@/systems/alpha');
    expect(denReward(15, undefined, rng(1), undefined, 'alpha-mat-forest').items['alpha-mat-forest']).toBe(2);
    expect(denReward(15, { firstClear: true }, rng(1), undefined, 'alpha-mat-forest').items['alpha-mat-forest']).toBe(1);
  });
});
