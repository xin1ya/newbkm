/**
 * 渲染层约定（Object3D.layers）。相机默认看 0–3；小地图/反射等特殊相机可以选择性关闭。
 */
export const LAYER = {
  DEFAULT: 0,
  TERRAIN: 1,
  CHARACTERS: 2,
  FX: 3,
  /** 仅供调试（碰撞体、区域多边形、刷新点） */
  DEBUG: 7,
} as const;
