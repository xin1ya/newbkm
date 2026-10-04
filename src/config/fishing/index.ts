/**
 * M1-15 · 钓鱼配置：按水体 × 钓竿的钓鱼表、世界中可见的钓点、物种挣扎力度。
 * 物种只使用图鉴里已有的水栖宝可梦（鲤鱼王、蚊香蝌蚪系、玛瑙水母系、大钳蟹系、海星星系、暴鲤龙）。
 */
import type { FishingSpot, FishingTable, StrengthTable } from '@/systems/fishing';

export const FISHING_TABLES: readonly FishingTable[] = [
  {
    id: 'cuilan-lake',
    water: 'cuilan-lake',
    rods: {
      'old-rod': [
        { speciesId: 129, weight: 85, levels: [5, 10] },
        { speciesId: 60, weight: 15, levels: [5, 8] },
      ],
      'good-rod': [
        { speciesId: 129, weight: 35, levels: [10, 15] },
        { speciesId: 60, weight: 40, levels: [10, 14] },
        { speciesId: 61, weight: 8, levels: [15, 18], formation: 'rare' },
        { speciesId: 98, weight: 17, levels: [10, 14], time: 'day' },
      ],
      'super-rod': [
        { speciesId: 61, weight: 35, levels: [20, 25] },
        { speciesId: 60, weight: 25, levels: [18, 22] },
        { speciesId: 129, weight: 30, levels: [20, 25] },
        { speciesId: 130, weight: 4, levels: [25, 30], formation: 'rare' },
        { speciesId: 186, weight: 2, levels: [25, 28], formation: 'rare', time: 'night' },
      ],
    },
  },
  {
    id: 'sea',
    water: 'sea',
    rods: {
      'old-rod': [
        { speciesId: 129, weight: 75, levels: [5, 10] },
        { speciesId: 72, weight: 25, levels: [6, 10] },
      ],
      'good-rod': [
        { speciesId: 72, weight: 40, levels: [12, 16] },
        { speciesId: 98, weight: 30, levels: [12, 16] },
        { speciesId: 129, weight: 20, levels: [12, 16] },
        { speciesId: 120, weight: 10, levels: [13, 17], time: 'night', formation: 'rare' },
      ],
      'super-rod': [
        { speciesId: 72, weight: 30, levels: [22, 28] },
        { speciesId: 73, weight: 15, levels: [28, 32], formation: 'rare' },
        { speciesId: 99, weight: 22, levels: [28, 32] },
        { speciesId: 120, weight: 18, levels: [24, 28], time: 'night' },
        { speciesId: 121, weight: 3, levels: [30, 34], time: 'night', formation: 'rare' },
        { speciesId: 130, weight: 5, levels: [28, 32], formation: 'rare' },
      ],
    },
  },
  {
    // M1-01 河流 / 溪流（所有淡水水体的兜底表）
    id: 'river',
    water: '*',
    rods: {
      'old-rod': [
        { speciesId: 129, weight: 60, levels: [4, 8] },
        { speciesId: 60, weight: 40, levels: [4, 8] },
      ],
      'good-rod': [
        { speciesId: 60, weight: 55, levels: [10, 14] },
        { speciesId: 129, weight: 30, levels: [10, 14] },
        { speciesId: 61, weight: 15, levels: [14, 17], formation: 'rare' },
      ],
      'super-rod': [
        { speciesId: 61, weight: 50, levels: [20, 24] },
        { speciesId: 60, weight: 25, levels: [18, 22] },
        { speciesId: 186, weight: 5, levels: [24, 28], formation: 'rare' },
        { speciesId: 129, weight: 20, levels: [20, 24] },
      ],
    },
  },
];

/** 世界中可见的钓点（冒泡水花）；位置会在运行时吸附到附近足够深的水面 */
export const FISHING_SPOTS: readonly FishingSpot[] = [
  { id: 'harbor-pier', name: '钓鱼码头', position: [450, 118], radius: 5, waitScale: 0.55, rareBoost: 2.5 },
  { id: 'sprout-dock', name: '萌芽镇码头', position: [-70, 460], radius: 4.5, waitScale: 0.7, rareBoost: 1.8 },
  { id: 'lake-reeds', name: '翠澜湖芦苇荡', position: [28, -20], radius: 4.5, waitScale: 0.7, rareBoost: 2 },
];

/** 挣扎力度基准（0–1）：鲤鱼王最弱，暴鲤龙最猛 */
export const FISH_STRENGTH: StrengthTable = {
  129: 0.12,
  60: 0.3,
  61: 0.5,
  186: 0.62,
  72: 0.38,
  73: 0.66,
  98: 0.42,
  99: 0.68,
  120: 0.4,
  121: 0.7,
  130: 0.9,
};
