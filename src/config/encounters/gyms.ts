/**
 * 道馆定义（设计 §5.4 动态等级）。
 * 萌芽群岛只有 1 座道馆，所以只有 1 档；岛 2/3 的道馆在 M2/M3 追加，每座 3 档。
 * 队伍来源：07-21 §2.5（道馆 1 水系：海星星 + 大钳蟹 + 暴鲤龙）。
 */
import type { GymDef } from '@/systems/encounters';

export const GYMS: GymDef[] = [
  {
    id: 'gym-cuilan',
    island: 'sprout',
    leader: '沧澜',
    type: 'water',
    badgeFlag: 'badge-verdant',
    tierLevels: [14],
    ivs: 18,
    prizeMoney: 1680,
    items: [{ id: 'super-potion', qty: 2 }],
    team: [
      { speciesId: 120, levelOffset: -1, moves: ['water-gun', 'rapid-spin', 'swift', 'harden'], ability: 'natural-cure' },
      { speciesId: 98, levelOffset: -1, moves: ['water-gun', 'metal-claw', 'harden', 'leer'], ability: 'hyper-cutter' },
      { speciesId: 130, levelOffset: 2, moves: ['water-pulse', 'bite', 'twister', 'scary-face'], ability: 'intimidate', heldItem: 'sitrus-berry' },
    ],
  },
];
