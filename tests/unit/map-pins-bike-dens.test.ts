/**
 * 小地图标点 / 自行车变速 / 头目巢穴主题建模。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { currentNav, toggleNavTarget, addPin, checkArrive, MAX_PINS, miniProject, navPinOf, pinsOn, removePin, repairPins, setPinKind, toggleNav, type PinStore } from '@/systems/map';
import { BIKE_GEARS, BIKE_SPEED, bikeGear, bikeTargetSpeed } from '@/systems/ride';
import { triggerMatches } from '@/systems/quests';
import { DEFAULT_BINDINGS } from '@/core/input/bindings';
import { SPROUT } from '@/config/islands/sprout';
import { dex } from '@/config/data';
import { buildAlphaDen, denThemeFor, type DenTheme } from '@/world/props/alphaDens';

describe('地图标点', () => {
  it('放置 / 改样式 / 导航 / 删除，按岛隔离、有上限', () => {
    const s: PinStore = {};
    const a = addPin(s, 'sprout', 10.04, -5, 'flag', { navigate: true })!;
    expect(a.x).toBe(10);
    expect(navPinOf(s, 'sprout')?.id).toBe(a.id);
    expect(navPinOf(s, 'other')).toBeNull();
    const b = addPin(s, 'sprout', 0, 0, 'star')!;
    setPinKind(s, b.id, 'heart');
    expect(pinsOn(s, 'sprout').map((p) => p.kind)).toEqual(['flag', 'heart']);
    expect(toggleNav(s, b.id)).toBe(b.id);
    expect(toggleNav(s, b.id)).toBeNull();
    toggleNav(s, a.id);
    removePin(s, a.id);
    expect(s.navPin).toBeNull();
    for (let i = 0; i < MAX_PINS + 3; i++) addPin(s, 'sprout', i, i, 'ball');
    expect(pinsOn(s, 'sprout')).toHaveLength(MAX_PINS);
    expect(addPin(s, 'second', 0, 0, 'flag')).not.toBeNull();
  });
  it('到达导航点自动结束；存档修复去掉坏数据', () => {
    const s: PinStore = {};
    const p = addPin(s, 'sprout', 100, 100, 'flag', { navigate: true })!;
    expect(checkArrive(s, 'sprout', 80, 100)).toBe(false);
    expect(checkArrive(s, 'sprout', 103, 102)).toBe(true);
    expect(s.navPin).toBeNull();
    const bad = { mapPins: [p, { id: 'x', island: 'sprout', x: NaN, z: 0, kind: 'flag', label: '' }, null], navPin: 'gone' } as unknown as PinStore;
    repairPins(bad);
    expect(bad.mapPins).toHaveLength(1);
    expect(bad.navPin).toBeNull();
  });
  it('小地图投影：北朝上 / 镜头前方朝上，超出半径钳到圆周', () => {
    expect(miniProject(0, -10, 1, 50, null)).toEqual({ x: 0, y: -10, edge: false });
    // 镜头朝东（yaw = π/2，forward = +X）：东边的点在正上方
    const p = miniProject(10, 0, 1, 50, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-10);
    const far = miniProject(0, 500, 1, 50, null);
    expect(far.edge).toBe(true);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(50);
  });
});

describe('导航到原有地点 / 任务点高度', () => {
  it('原有地点导航与标点导航互斥，到达后清除', () => {
    const s: PinStore = {};
    const p = addPin(s, 'sprout', 0, 0, 'flag', { navigate: true })!;
    expect(toggleNavTarget(s, { island: 'sprout', id: 'pokecenter-cuilan', name: '宝可梦中心', x: -40, z: -10 })).toBe(true);
    expect(s.navPin).toBeNull();
    expect(currentNav(s, 'sprout')?.name).toBe('宝可梦中心');
    toggleNav(s, p.id);
    expect(s.navTarget).toBeNull();
    toggleNavTarget(s, { island: 'sprout', id: 'elder-pu-house', name: '蒲婆婆家', x: -165, z: 395 });
    expect(checkArrive(s, 'sprout', -163, 396)).toBe(true);
    expect(currentNav(s, 'sprout')).toBeNull();
  });
  it('蒲婆婆家显示在地图上', () => {
    expect(SPROUT.pois.find((p) => p.id === 'elder-pu-house')?.showOnMap).toBe(true);
  });
  it('未指定高度（y = 0）的到达点只比较水平距离：幻影之森入口足迹在 26 m 高地也能完成', () => {
    const t = { type: 'reach-point' as const, position: [-150, 0, -110] as [number, number, number], radius: 8, night: true };
    expect(triggerMatches(t, { type: 'position', island: 'sprout', position: [-148, 26.7, -112], night: true })).toBe(true);
    expect(triggerMatches(t, { type: 'position', island: 'sprout', position: [-148, 26.7, -112], night: false })).toBe(false);
    expect(triggerMatches({ ...t, position: [0, 10, 0] }, { type: 'position', island: 'sprout', position: [0, 40, 0], night: true })).toBe(false);
  });
});

describe('自行车变速', () => {
  it('3 档：极速递增、加速递减，2 档等于原车速', () => {
    expect(BIKE_GEARS.map((g) => g.gear)).toEqual([1, 2, 3]);
    expect(bikeGear(2).top).toBe(BIKE_SPEED);
    for (let i = 1; i < 3; i++) {
      expect(BIKE_GEARS[i]!.top).toBeGreaterThan(BIKE_GEARS[i - 1]!.top);
      expect(BIKE_GEARS[i]!.accel).toBeLessThan(BIKE_GEARS[i - 1]!.accel);
    }
    expect(bikeGear(9).gear).toBe(3);
    expect(bikeGear(0).gear).toBe(1);
  });
  it('上坡：高档掉速更多，陡坡上 1 档反而更快；下坡加速有上限；浅水减速', () => {
    expect(bikeTargetSpeed(3, 0)).toBeCloseTo(15.5);
    expect(bikeTargetSpeed(1, 0.5)).toBeGreaterThan(bikeTargetSpeed(3, 0.5));
    expect(bikeTargetSpeed(3, -0.6)).toBeLessThanOrEqual(15.5 * 1.25 + 1e-9);
    expect(bikeTargetSpeed(2, 0, 0.2)).toBeCloseTo(BIKE_SPEED * 0.6);
  });
  it('换挡按键不与大世界常用键冲突', () => {
    const used = new Set(['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'interact', 'jump', 'ride', 'map', 'menu', 'throw', 'sendOut', 'run'].flatMap((a) => DEFAULT_BINDINGS[a as keyof typeof DEFAULT_BINDINGS].keys));
    for (const k of [...DEFAULT_BINDINGS.gearUp.keys, ...DEFAULT_BINDINGS.gearDown.keys]) expect(used.has(k), k).toBe(false);
  });
});

describe('头目巢穴主题建模', () => {
  const flat = { heightAt: () => 0, waterLevel: () => null };
  const wet = { heightAt: () => -1.5, waterLevel: () => 0 };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  it('萌芽群岛 6 个巢穴都指定了主题，并与头目属性相符', () => {
    const dens = SPROUT.alphaDens ?? [];
    expect(dens).toHaveLength(6);
    const themes = new Set(dens.map((d) => d.theme));
    expect(themes.size).toBe(6);
    for (const d of dens) {
      const types = dex.species(d.speciesId).types;
      if (d.theme === 'shadow') expect(types).toContain('dark');
      if (d.theme === 'rock') expect(types).toContain('rock');
      if (d.theme === 'nest') expect(types).toContain('flying');
      if (d.theme === 'whirlpool' || d.theme === 'mudflat' || d.theme === 'seacliff') expect(types).toContain('water');
    }
  });
  it('按属性推断主题', () => {
    expect(denThemeFor(['dark'], false)).toBe('shadow');
    expect(denThemeFor(['rock', 'ground'], false)).toBe('rock');
    expect(denThemeFor(['water', 'flying'], true)).toBe('whirlpool');
    expect(denThemeFor(['water', 'flying'], false)).toBe('seacliff');
    expect(denThemeFor(['water'], false)).toBe('mudflat');
    expect(denThemeFor(['normal', 'flying'], false)).toBe('nest');
  });
  it.each(['nest', 'whirlpool', 'seacliff', 'shadow', 'rock', 'mudflat'] as DenTheme[])('%s：合并后的网格数量少、面数适中、中心可走、动画可更新', (theme) => {
    const b = buildAlphaDen({ id: `t-${theme}`, position: [0, 0], radius: 6 }, theme, theme === 'whirlpool' ? wet : flat, mat);
    let meshes = 0;
    let tris = 0;
    b.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    });
    // 静态实体 + 发光合并；动画件（漩涡 / 光点 / 气泡）单独
    const solid = b.group.children.filter((o) => o.name.startsWith('den-solid'));
    expect(solid).toHaveLength(1);
    expect(meshes).toBeLessThanOrEqual(16);
    expect(tris).toBeGreaterThan(1500);
    expect(tris).toBeLessThan(40000);
    // 中心 3 m 内没有高出地面 1.2 m 的实体（头目踱步空间；漩涡主题的立柱在水外圈）
    const pos = (solid[0] as THREE.Mesh).geometry.getAttribute('position');
    const ground = theme === 'whirlpool' ? -1.5 : 0;
    let blocked = 0;
    for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) < 3 && pos.getY(i) > ground + 1.2) blocked++;
    expect(blocked).toBe(0);
    expect(() => b.update(3.2)).not.toThrow();
    b.dispose();
  });
});
