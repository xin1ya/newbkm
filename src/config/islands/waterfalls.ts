/**
 * M3-19 · 瀑布（登瀑）配置工厂：给出石台中心 / 半径 / 台面高度、瀑潭方向与水位，
 * 推导出瀑口、泉池、冲浪站位，并生成配套的水体（泉池 + 瀑潭）与 blocker（石台不可步行 / 飞行进入，直到学会攀瀑）。
 *
 * 几何（俯视，dir = 石台中心 → 瀑潭）：
 *   center ──(radius − 1.3·poolR − 0.3)── pool.center ── top ── lip（石台边缘 = radius） ── 崖面 ── base（radius + plungeR）
 */
import type { BlockerConfig, Vec2, WaterBody, WaterfallConfig } from './types';

export const WATERFALL_FLAG = 'hm07-waterfall';
/** 冲浪时离瀑潭 / 泉池站位多近可以互动（米） */
export const WATERFALL_REACH = 5.5;

export interface WaterfallSpec {
  id: string;
  name: string;
  center: Vec2;
  radius: number;
  /** 台面高度（绝对） */
  height: number;
  /** 瀑潭方向（弧度，0 = +X，π/2 = +Z） */
  dirAngle: number;
  /** 瀑潭水位（与相连的河源 / 水体一致） */
  baseLevel: number;
  poolRadius?: number;
  plungeRadius?: number;
  width?: number;
  hint: string;
}

export interface WaterfallBundle {
  fall: WaterfallConfig;
  bodies: WaterBody[];
  blocker: BlockerConfig;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function makeWaterfall(s: WaterfallSpec): WaterfallBundle {
  const dx = Math.cos(s.dirAngle);
  const dz = Math.sin(s.dirAngle);
  const at = (d: number): Vec2 => [r1(s.center[0] + dx * d), r1(s.center[1] + dz * d)];
  const poolR = s.poolRadius ?? 6;
  const plungeR = s.plungeRadius ?? 5;
  const topLevel = r1(s.height - 0.35);
  const fall: WaterfallConfig = {
    id: s.id,
    name: s.name,
    mesa: { center: s.center, radius: s.radius, height: s.height },
    base: at(s.radius + plungeR - 0.4),
    baseLevel: s.baseLevel,
    top: at(s.radius - 1.3 * poolR - 0.3 + poolR * 0.75),
    topLevel,
    lip: at(s.radius),
    // 泉池的水面判定范围（椭圆 1.3 倍）收在石台以内，不会在崖面上「浮」出一层水
    pool: { center: at(s.radius - 1.3 * poolR - 0.3), radius: poolR },
    plungeRadius: plungeR,
    width: s.width ?? 5,
  };
  const bodies: WaterBody[] = [
    { id: `${s.id}-plunge`, level: s.baseLevel, center: fall.base, radius: [plungeR, plungeR] },
    { id: `${s.id}-pool`, level: topLevel, center: fall.pool.center, radius: [poolR, poolR] },
  ];
  const blocker: BlockerConfig = {
    id: `${s.id}-mesa`,
    type: 'waterfall',
    requiresFlag: WATERFALL_FLAG,
    position: [s.center[0], 0, s.center[1]],
    radius: s.radius + 1,
    hint: s.hint,
  };
  return { fall, bodies, blocker };
}
