import { describe, expect, it } from 'vitest';
import { clampCamera, facingToMapDeg, fitZoom, fogExplored, mapToWorld, markerVisible, stepZoom, worldToMap, zoomAt, type FogMask, type MapFrame } from '@/systems/map';
import { createNewGame, exploredMask, markExplored, EXPLORE_CELL } from '@/systems/state';

const F: MapFrame = { worldSize: [1024, 1024], imageSize: [512, 512] };
const grid = { size: [1024, 1024] as [number, number] };

describe('大地图坐标', () => {
  it('世界 ↔ 地图互逆，岛屿中心 = 图中心，北朝上', () => {
    expect(worldToMap(F, 0, 0)).toEqual({ u: 256, v: 256 });
    expect(worldToMap(F, -512, -512)).toEqual({ u: 0, v: 0 });
    const w = mapToWorld(F, ...(Object.values(worldToMap(F, 123, -345)) as [number, number]));
    expect(w.x).toBeCloseTo(123);
    expect(w.z).toBeCloseTo(-345);
  });

  it('玩家箭头：朝 -Z 为北（0°），朝 +X 为东（90°）', () => {
    expect(facingToMapDeg(Math.PI)).toBeCloseTo(0);
    expect(facingToMapDeg(0)).toBeCloseTo(180);
    expect(facingToMapDeg(Math.PI / 2)).toBeCloseTo(90);
  });
});

describe('缩放与平移', () => {
  it('fitZoom 能完整装下整张图', () => {
    expect(fitZoom(F, 800, 600)).toBeCloseTo(600 / 512);
  });

  it('clampCamera 不让视口拖出地图；图比视口小时居中', () => {
    const c = clampCamera(F, { cu: -100, cv: 9999, zoom: 2 }, 400, 300);
    expect(c.cu).toBe(100); // 半宽 400/2/2
    expect(c.cv).toBe(512 - 75);
    const small = clampCamera(F, { cu: 10, cv: 10, zoom: 0.5 }, 800, 600);
    expect(small).toMatchObject({ cu: 256, cv: 256 });
  });

  it('zoomAt 以光标为锚点', () => {
    const c = { cu: 200, cv: 200, zoom: 1 };
    const n = zoomAt(c, 2, 100, -50);
    // 锚点下的地图坐标不变
    expect(n.cu + 100 / n.zoom).toBeCloseTo(c.cu + 100 / c.zoom);
    expect(n.cv - 50 / n.zoom).toBeCloseTo(c.cv - 50 / c.zoom);
  });

  it('stepZoom 在档位间步进并受最小值约束', () => {
    expect(stepZoom(1.2, 1, 0.5)).toBe(1.7);
    expect(stepZoom(1.2, -1, 0.5)).toBe(0.85);
    expect(stepZoom(0.5, -1, 0.5)).toBe(0.5);
    expect(stepZoom(3.4, 1, 0.5)).toBe(3.4);
    expect(stepZoom(1.0, 1, 0.5)).toBe(1.2); // 非档位值 → 下一档
  });
});

describe('探索迷雾与标记', () => {
  it('exploredMask 与 markExplored 一致', () => {
    const s = createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-09-29T00:00:00Z') });
    markExplored(s, 'sprout', grid, -118, 378, 24);
    const m = exploredMask(s, 'sprout', grid);
    expect(m.w).toBe(1024 / EXPLORE_CELL);
    expect(m.cell).toBe(EXPLORE_CELL);
    expect(fogExplored(m, grid.size, -118, 378)).toBe(true);
    expect(fogExplored(m, grid.size, 300, -300)).toBe(false);
    expect(m.cells.reduce((a, b) => a + b, 0)).toBeGreaterThan(4);
  });

  it('标志性建筑远一点也显示；普通地点要到过；解除的封锁点不显示', () => {
    const fog: FogMask = { w: 64, h: 64, cell: 16, cells: new Uint8Array(64 * 64) };
    fog.cells[32 * 64 + 32] = 1; // 世界 (0..16, 0..16)
    const ws: [number, number] = [1024, 1024];
    expect(markerVisible('pokecenter', fog, ws, 40, 8)).toBe(true);
    expect(markerVisible('mart', fog, ws, 40, 8)).toBe(false);
    expect(markerVisible('mart', fog, ws, 20, 8)).toBe(true);
    expect(markerVisible('blocker', fog, ws, 8, 8)).toBe(true);
    expect(markerVisible('blocker', fog, ws, 8, 8, { cleared: true })).toBe(false);
    expect(markerVisible('gym', fog, ws, 300, 300)).toBe(false);
  });
});

describe('城镇整片揭开', () => {
  it('markExploredPolygon 揭开多边形内部，重复调用不再新增', async () => {
    const { markExploredPolygon } = await import('@/systems/state');
    const s = createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-09-29T00:00:00Z') });
    const poly: [number, number][] = [[-100, -100], [100, -100], [100, 100], [-100, 100]];
    const n = markExploredPolygon(s, 'sprout', grid, poly);
    expect(n).toBeGreaterThanOrEqual(144); // 200 m / 16 m ≈ 12.5 格见方
    expect(markExploredPolygon(s, 'sprout', grid, poly)).toBe(0);
    const m = exploredMask(s, 'sprout', grid);
    expect(fogExplored(m, grid.size, 90, -90)).toBe(true);
    expect(fogExplored(m, grid.size, 200, 0)).toBe(false);
  });
});
