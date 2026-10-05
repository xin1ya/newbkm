/**
 * M1-12 · 骑乘能力登记（设计 §3.4：骑乘取代秘传技）。
 * 只有水上骑乘在 M1 实装；其余能力保留条目，供提示文字、菜单与后续里程碑使用。
 */
import type { RideDef } from '@/systems/ride';

export const RIDES: readonly RideDef[] = [
  {
    id: 'water',
    name: '水上骑乘',
    medium: 'water',
    flag: 'hm03-surf',
    implemented: true,
    verb: '骑上水面',
    speed: 6.2,
    sprint: 9.0,
    mountTypes: ['water'],
    minHeight: 0.35,
    excluded: [129],
    fallbackSpecies: 130,
    unlockText: '可以骑着水属性宝可梦在水面上移动了！面朝水面按 C（或互动键）上水。',
  },
  {
    id: 'rock-smash',
    name: '碎岩冲撞',
    medium: 'land',
    flag: 'hm05-rock-smash',
    implemented: false,
    verb: '撞碎岩石',
    speed: 7.5,
    sprint: 10.5,
    mountTypes: ['fighting', 'rock', 'ground'],
    minHeight: 0.8,
    excluded: [],
    fallbackSpecies: 20,
    unlockText: '可以骑着宝可梦撞碎挡路的岩石了！',
  },
  {
    id: 'climb',
    name: '攀岩骑乘',
    medium: 'rock',
    flag: 'hm08-rock-climb',
    implemented: true,
    verb: '攀上岩壁',
    speed: 4,
    sprint: 5,
    mountTypes: ['rock', 'ground'],
    minHeight: 0.8,
    excluded: [],
    fallbackSpecies: 75,
    unlockText: '可以骑着岩石 / 地面属性的宝可梦攀爬藤蔓与裂缝崖壁了！走到崖脚的岩壁纹路前按互动键攀上，W / S 上下。',
  },
  {
    id: 'fly',
    name: '飞行骑乘',
    medium: 'air',
    flag: 'badge-verdant',
    implemented: true,
    verb: '飞上天空',
    speed: 14,
    sprint: 20,
    mountTypes: ['flying'],
    minHeight: 1.0,
    excluded: [],
    fallbackSpecies: 18,
    unlockText: '可以骑着飞行宝可梦自由飞行了！在地面按 G 起飞：空格上升、Shift / Ctrl 下降、X 加速，贴近地面再按 G 降落。',
  },
];

export const RIDE_BY_ID: ReadonlyMap<string, RideDef> = new Map(RIDES.map((r) => [r.id, r]));
