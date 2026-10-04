/**
 * ART-001 定稿参数（assets/style-guide/ 样张页调出来的值）。
 * 修改这里 = 修改全局画风；请同步更新 assets/style-guide/README.md 里的截图与说明。
 */
import type { RampSpec } from './ramps';

export interface ToonStyle {
  /** 角色 / 宝可梦色带 */
  characterRamp: RampSpec;
  /** 场景（地形、建筑、植被）色带：过渡更宽，暗部更亮，避免大面积死黑 */
  sceneRamp: RampSpec;
  rim: { color: string; strength: number; threshold: number; width: number };
  specular: { strength: number; size: number };
  outline: {
    /** 反向外壳宽度（相对观察距离的比例，约等于屏幕像素宽度 × 0.001） */
    hullWidth: number;
    /** 描边颜色 = 基色 × darken，再与 tint 混合 */
    hullDarken: number;
    hullTint: string;
    /** 后处理边缘检测 */
    edgeStrength: number;
    edgeDepthThreshold: number;
    edgeNormalThreshold: number;
    edgeColor: string;
    /** 超过这个距离（米）边缘检测逐渐淡出 */
    edgeFadeStart: number;
    edgeFadeEnd: number;
  };
  bloom: { strength: number; radius: number; threshold: number };
  exposure: number;
  saturation: number;
}

export const DEFAULT_STYLE: ToonStyle = {
  characterRamp: { thresholds: [0.47, 0.62], levels: [0.52, 0.8, 1.0], shadowTint: '#8f9ed8', softness: 0.012 },
  sceneRamp: { thresholds: [0.42, 0.6], levels: [0.62, 0.84, 1.0], shadowTint: '#9aa9d6', softness: 0.03 },
  rim: { color: '#fff6e0', strength: 0.42, threshold: 0.62, width: 0.05 },
  specular: { strength: 0.35, size: 0.965 },
  outline: {
    hullWidth: 0.0028,
    hullDarken: 0.32,
    hullTint: '#1d2238',
    edgeStrength: 0.7,
    edgeDepthThreshold: 0.012,
    edgeNormalThreshold: 0.45,
    edgeColor: '#27304a',
    edgeFadeStart: 40,
    edgeFadeEnd: 140,
  },
  bloom: { strength: 0.35, radius: 0.5, threshold: 0.92 },
  exposure: 1.0,
  saturation: 1.08,
};
