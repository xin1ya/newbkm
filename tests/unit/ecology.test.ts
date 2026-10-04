import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BIOMES, fbm, valueNoise } from '@/world/ecology/biome';
import * as SP from '@/world/foliage/species';
import { ambienceMix, waterProximity, type AmbienceSituation } from '@/systems/audio/select';

describe('生态分区', () => {
  it('值噪声在 0–1 内且连续', () => {
    let prev = valueNoise(0, 0, 40, 7);
    for (let x = 0; x < 400; x += 0.5) {
      const v = valueNoise(x, x * 0.3, 40, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.08);
      prev = v;
      const f = fbm(x, -x, 30, 3);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('每种生态都有树种与花色；海滩只长椰子树，湖畔以垂柳为主', () => {
    for (const p of Object.values(BIOMES)) {
      expect(Object.keys(p.trees).length).toBeGreaterThan(0);
      expect(p.flowers.length).toBeGreaterThan(0);
    }
    expect(Object.keys(BIOMES.beach.trees)).toEqual(['palm']);
    expect(BIOMES.wetland.trees.willow).toBeGreaterThan(0.5);
    expect(BIOMES.mistwood.undergrowth.fern).toBeGreaterThan(BIOMES.meadow.undergrowth.fern);
  });
});

describe('新树种 / 林下几何体', () => {
  const all: Array<[string, THREE.BufferGeometry]> = [
    ['palm', SP.palmTreeGeometry(1)],
    ['willow', SP.willowTreeGeometry(1)],
    ['birch', SP.birchTreeGeometry(1)],
    ['blossom', SP.blossomTreeGeometry(1)],
    ['windpine', SP.windPineGeometry(1)],
    ['palmLow', SP.palmTreeGeometry(0)],
    ['fern', SP.fernGeometry(1)],
    ['mushroom', SP.mushroomGeometry(0, 1)],
    ['litter', SP.leafLitterGeometry(1, true)],
    ['log', SP.fallenLogGeometry(1)],
    ['stump', SP.stumpGeometry(1)],
    ['pebbles', SP.pebblesGeometry(1)],
    ['reeds', SP.reedsGeometry(1)],
    ['lily', SP.lilyPadGeometry(1, true)],
    ['driftwood', SP.driftwoodGeometry(1)],
    ['shells', SP.shellsGeometry(1)],
  ];
  it.each(all)('%s 带 position / normal / color / aSway，且无 NaN', (_n, g) => {
    for (const a of ['position', 'normal', 'color', 'aSway']) expect(g.getAttribute(a)).toBeTruthy();
    const p = g.getAttribute('position').array as Float32Array;
    expect(p.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('低模比高模面数少；单个林下物件不超过 1500 顶点', () => {
    expect(SP.palmTreeGeometry(0).getAttribute('position').count).toBeLessThan(SP.palmTreeGeometry(1).getAttribute('position').count);
    expect(SP.willowTreeGeometry(0).getAttribute('position').count).toBeLessThan(SP.willowTreeGeometry(1).getAttribute('position').count);
    for (const [n, g] of all.slice(6)) expect(g.getAttribute('position').count, n).toBeLessThan(1500);
  });

  it('mergeTransformed 正确平移并乘色调', () => {
    const g = SP.pebblesGeometry(3);
    const m = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const out = SP.mergeTransformed([
      { geo: g, matrix: new THREE.Matrix4(), tint: new THREE.Color(1, 1, 1) },
      { geo: g, matrix: m, tint: new THREE.Color(0.5, 0.5, 0.5) },
    ])!;
    const n = g.getAttribute('position').count;
    expect(out.getAttribute('position').count).toBe(n * 2);
    expect(out.getAttribute('position').getX(n)).toBeCloseTo(g.getAttribute('position').getX(0) + 10, 4);
    expect(out.getAttribute('color').getX(n)).toBeCloseTo(g.getAttribute('color').getX(0) * 0.5, 4);
    expect(SP.mergeTransformed([])).toBeNull();
  });
});

describe('生态环境音', () => {
  const s = (o: Partial<AmbienceSituation>): AmbienceSituation => ({
    indoor: null, zoneKind: 'wild', zoneBgm: 'field-meadow', time: 'day', weather: 'clear', sea: 0, fresh: 0, altitude: 5, surfing: false, battle: false, ...o,
  });
  it('夜晚湖边蛙鸣，白天晴天没有；暴风雨停', () => {
    expect(ambienceMix(s({ time: 'night', fresh: 0.3 })).frogs).toBeGreaterThan(0.3);
    expect(ambienceMix(s({ fresh: 0.3 })).frogs).toBe(0);
    expect(ambienceMix(s({ time: 'night', fresh: 0.3, weather: 'storm' })).frogs).toBe(0);
  });
  it('河边有溪流声，昆虫只在晴朗白天', () => {
    expect(ambienceMix(s({ fresh: 0.3, river: 0.3 })).stream).toBeGreaterThan(0.4);
    expect(ambienceMix(s({ fresh: 0.3 })).stream).toBe(0);
    expect(ambienceMix(s({})).insects).toBeGreaterThan(0.2);
    expect(ambienceMix(s({ time: 'night' })).insects).toBe(0);
    expect(ambienceMix(s({ weather: 'rain' })).insects).toBe(0);
  });
  it('waterProximity 统计河流比例', () => {
    const w = waterProximity([
      { depth: 1, sea: false, river: true },
      { depth: 1, sea: false },
      { depth: 0, sea: false },
      { depth: 1, sea: true },
    ]);
    expect(w).toEqual({ sea: 0.25, fresh: 0.5, river: 0.25 });
  });
});
