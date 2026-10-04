/**
 * M1-17 · 大地图纯逻辑：世界 ↔ 地图坐标、缩放 / 平移约束、标记可见性规则、迷雾查询。
 * 世界坐标原点在岛屿中心，+X = 东，-Z = 北；地图坐标以左上角为原点（像素），北朝上。
 */

export interface MapFrame {
  /** 岛屿世界尺寸（米） */
  worldSize: [number, number];
  /** 底图像素尺寸 */
  imageSize: [number, number];
}

export function worldToMap(f: MapFrame, x: number, z: number): { u: number; v: number } {
  return {
    u: ((x + f.worldSize[0] / 2) / f.worldSize[0]) * f.imageSize[0],
    v: ((z + f.worldSize[1] / 2) / f.worldSize[1]) * f.imageSize[1],
  };
}

export function mapToWorld(f: MapFrame, u: number, v: number): { x: number; z: number } {
  return {
    x: (u / f.imageSize[0]) * f.worldSize[0] - f.worldSize[0] / 2,
    z: (v / f.imageSize[1]) * f.worldSize[1] - f.worldSize[1] / 2,
  };
}

export interface MapCamera {
  /** 视口中心对应的底图坐标 */
  cu: number;
  cv: number;
  /** 屏幕像素 / 底图像素 */
  zoom: number;
}

export const MAP_ZOOM_STEPS = [0.6, 0.85, 1.2, 1.7, 2.4, 3.4] as const;

/** 能完整看到整张地图的最小缩放（再小没有意义） */
export function fitZoom(f: MapFrame, viewW: number, viewH: number): number {
  return Math.min(viewW / f.imageSize[0], viewH / f.imageSize[1]);
}

/**
 * 限制平移：底图比视口大时不能拖出边界；比视口小时锁定在中心。
 */
export function clampCamera(f: MapFrame, c: MapCamera, viewW: number, viewH: number): MapCamera {
  const clampAxis = (center: number, img: number, view: number) => {
    const half = view / 2 / c.zoom;
    if (img <= half * 2) return img / 2;
    return Math.min(img - half, Math.max(half, center));
  };
  return { zoom: c.zoom, cu: clampAxis(c.cu, f.imageSize[0], viewW), cv: clampAxis(c.cv, f.imageSize[1], viewH) };
}

/** 以屏幕点 (sx, sy)（相对视口中心）为锚缩放：锚点下的地图位置保持不动 */
export function zoomAt(c: MapCamera, newZoom: number, sx: number, sy: number): MapCamera {
  const u = c.cu + sx / c.zoom;
  const v = c.cv + sy / c.zoom;
  return { zoom: newZoom, cu: u - sx / newZoom, cv: v - sy / newZoom };
}

/** 缩放档位步进（dir = ±1），在 [min, 最大档] 之间 */
export function stepZoom(zoom: number, dir: 1 | -1, min: number): number {
  const steps = [min, ...MAP_ZOOM_STEPS.filter((z) => z > min * 1.05)];
  let i = steps.findIndex((z) => z >= zoom - 1e-6);
  if (i < 0) i = steps.length - 1;
  if (dir > 0) return steps[Math.min(steps.length - 1, steps[i]! > zoom + 1e-6 ? i : i + 1)]!;
  return steps[Math.max(0, steps[i]! < zoom - 1e-6 ? i : i - 1)]!;
}

export interface FogMask {
  w: number;
  h: number;
  /** 格子尺寸（米） */
  cell: number;
  cells: Uint8Array;
}

export function fogExplored(fog: FogMask, worldSize: [number, number], x: number, z: number): boolean {
  const gx = Math.floor((x + worldSize[0] / 2) / fog.cell);
  const gz = Math.floor((z + worldSize[1] / 2) / fog.cell);
  if (gx < 0 || gz < 0 || gx >= fog.w || gz >= fog.h) return false;
  return fog.cells[gz * fog.w + gx] === 1;
}

/** 某点附近（radius 米）是否有已探索格：标记只要稍有接触就显示 */
export function fogNear(fog: FogMask, worldSize: [number, number], x: number, z: number, radius: number): boolean {
  for (let dz = -radius; dz <= radius; dz += fog.cell) for (let dx = -radius; dx <= radius; dx += fog.cell) if (fogExplored(fog, worldSize, x + dx, z + dz)) return true;
  return false;
}

export type MapMarkerKind = 'pokecenter' | 'mart' | 'gym' | 'door' | 'dock' | 'ferry' | 'fishing' | 'landmark' | 'cave' | 'quest' | 'blocker' | 'alpha';

/**
 * 标记可见性（设计 §7.3：已探索区域显示城镇、宝可梦中心、封锁点）：
 * - 宝可梦中心、道馆、渡船：标志性建筑，远处可见，只要附近 48 m 内探索过
 * - 其他地点：所在格已探索
 * - 封锁点：已探索且仍未解除（解除后不再显示）
 */
export function markerVisible(kind: MapMarkerKind, fog: FogMask, worldSize: [number, number], x: number, z: number, opts: { cleared?: boolean | undefined } = {}): boolean {
  if (kind === 'blocker') return !opts.cleared && fogNear(fog, worldSize, x, z, 16);
  // 头目巢穴：附近 48 m 探索过就显示（未发现时显示「？」）
  if (kind === 'pokecenter' || kind === 'gym' || kind === 'ferry' || kind === 'alpha') return fogNear(fog, worldSize, x, z, 48);
  return fogNear(fog, worldSize, x, z, 16);
}

/** 罗盘 / 地图上玩家箭头的旋转（度，0 = 北，顺时针）：facing 为世界朝向弧度（0 = +Z） */
export function facingToMapDeg(facing: number): number {
  // 朝向 0 = +Z = 南 → 180°
  const d = 180 - (facing * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}
export * from './pins';
