/**
 * REN-005 · 画质档位：低 / 中 / 高（设计 §10 性能预算）。
 * 所有“随画质变化”的参数都集中在这里，其他模块只读 QualitySettings，不自己判断档位。
 */
export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  /** 渲染分辨率 = min(devicePixelRatio, maxPixelRatio) × pixelRatioScale */
  maxPixelRatio: number;
  pixelRatioScale: number;
  /** 0 = 关闭阴影 */
  shadowMapSize: number;
  /** 阴影覆盖半径（米，跟随玩家的正交阴影相机） */
  shadowRadius: number;
  /** 草簇密度（簇 / 平方米）与可见距离 */
  grassDensity: number;
  grassDistance: number;
  /** 花、小石头等细节物件的密度倍率 */
  detailDensity: number;
  /** 树木 / 大石头的可见距离（米）；超过后只在远景整岛网格里以低模体现 */
  treeDistance: number;
  /** 分块半径：LOD0 为 (2r+1)² 块，LOD1 为外圈 */
  lod0Radius: number;
  lod1Radius: number;
  /** 描边：反向外壳 / 后处理边缘检测（2026-10-01 用户要求取消描边：三档均关闭，开关保留） */
  hullOutline: boolean;
  edgeDetect: boolean;
  bloom: boolean;
  /** 多重采样数，0 时启用 FXAA（2026-10 性能 P0：high 改为 1.5 像素比 + FXAA，画质接近、开销显著降低） */
  msaa: number;
  /** 水面：simple 只有色带 + 泡沫；full 增加法线扰动、焦散、反射高光 */
  water: 'simple' | 'full';
  /** 同时存在的野生宝可梦上限 */
  maxWild: number;
  /** 天气粒子数量 */
  weatherParticles: number;
  /** 相机远裁剪面 */
  farPlane: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    pixelRatioScale: 0.8,
    shadowMapSize: 0,
    shadowRadius: 0,
    grassDensity: 0.35,
    grassDistance: 32,
    detailDensity: 0.4,
    treeDistance: 160,
    lod0Radius: 1,
    lod1Radius: 2,
    hullOutline: false,
    edgeDetect: false,
    bloom: false,
    msaa: 0,
    water: 'simple',
    maxWild: 8,
    weatherParticles: 1500,
    farPlane: 900,
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    pixelRatioScale: 1,
    shadowMapSize: 2048,
    shadowRadius: 45,
    grassDensity: 0.9,
    grassDistance: 55,
    detailDensity: 0.8,
    treeDistance: 260,
    lod0Radius: 1,
    lod1Radius: 2,
    hullOutline: false,
    edgeDetect: false,
    bloom: true,
    msaa: 0,
    water: 'full',
    maxWild: 14,
    weatherParticles: 4000,
    farPlane: 1400,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 1.5,
    pixelRatioScale: 1,
    shadowMapSize: 4096,
    shadowRadius: 65,
    grassDensity: 1.6,
    grassDistance: 80,
    detailDensity: 1,
    treeDistance: 380,
    lod0Radius: 1,
    lod1Radius: 3,
    hullOutline: false,
    edgeDetect: false,
    bloom: true,
    msaa: 0,
    water: 'full',
    maxWild: 20,
    weatherParticles: 8000,
    farPlane: 2000,
  },
};

/** 设置里的 'auto' → 根据平台 GPU 档位选择 */
export function resolveQuality(setting: 'auto' | QualityTier, gpuTier: 'low' | 'medium' | 'high'): QualitySettings {
  const tier = setting === 'auto' ? gpuTier : setting;
  return structuredClone(QUALITY_PRESETS[tier]);
}

export function pixelRatioFor(q: QualitySettings, devicePixelRatio: number): number {
  return Math.max(0.5, Math.min(devicePixelRatio, q.maxPixelRatio) * q.pixelRatioScale);
}

/** 从 URL 参数解析调试用画质覆盖：?quality=low|medium|high、?lite（= low + 更小分辨率） */
export function qualityFromUrl(search: string): { tier: QualityTier | null; lite: boolean } {
  const p = new URLSearchParams(search);
  const q = p.get('quality');
  const lite = p.has('lite');
  const tier = q === 'low' || q === 'medium' || q === 'high' ? q : lite ? 'low' : null;
  return { tier, lite };
}
