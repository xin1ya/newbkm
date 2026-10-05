/**
 * M3-15 · 雷鸣群岛四座道馆任务（07-22 §3.6 第三章 #15/#16/#18/#19）。其余第三章主线与支线在 M3-24 / M3-26 加入。
 * 四座道馆挑战顺序自由（动态等级按本岛徽章数取 4 档）；徽章名暂统一为「翠澜徽章」。
 * 雪原道馆奖励「攀爬」许可（flag hm08-rock-climb，骑乘本体在 M3-17）。
 */
import type { Quest } from '@/systems/quests';

const ISLAND = '雷鸣群岛';
const PRE = ['badge-azure', 'badge-ore', 'badge-flame'];

function gymQuest(id: string, title: string, summary: string, zoneId: string, townName: string, leader: string, trainerId: string, badge: string, door: [number, number], tm: string, hm?: string): Quest {
  return {
    id,
    title,
    category: 'main',
    island: ISLAND,
    summary,
    prerequisites: PRE,
    completeFlag: badge,
    objectives: [
      { id: 'reach-town', text: `前往${townName}`, completeFlag: `arrived-${zoneId}`, marker: { island: 'thunder', zoneId }, trigger: { type: 'enter-zone', zoneId } },
      { id: 'beat-leader', text: `击败${leader}`, completeFlag: badge, marker: { island: 'thunder', position: [door[0], 0, door[1]] }, trigger: { type: 'defeat', trainerId } },
    ],
    reward: { items: [{ id: tm, qty: 1 }], ...(hm ? { hm } : {}) },
  };
}

export const THUNDER_QUESTS: Quest[] = [
  gymQuest('main-gym-thunder', '雷云异变', '雷鸣镇的雷暴一年比一年密。挑战电属性馆主雷霆，穿过导电开关把守的变电厅。', 'thunder-town', '雷鸣镇', '雷鸣道馆馆主雷霆', 'gym-thunder-leader', 'badge-thunder', [-500, 360], 'tm-shock-wave'),
  gymQuest('main-gym-dawn', '普之试炼', '晨光镇的道馆随昼夜变换道路。拨动日晷，找到通往馆主晨辉的路。', 'dawn-town', '晨光镇', '晨光道馆馆主晨辉', 'gym-dawn-leader', 'badge-dawn', [430, 480], 'tm-facade'),
  gymQuest('main-gym-snow', '冰之试炼', '雪原镇的道馆是一整片冰晶滑场。滑过冰面，挑战冰属性馆主霜凝。', 'snow-town', '雪原镇', '雪原道馆馆主霜凝', 'gym-snow-leader', 'badge-snow', [160, -132], 'tm-icy-wind', 'hm08-rock-climb'),
  gymQuest('main-gym-cloud', '天空异象', '云雀镇上空出现了奇异的光。乘着风桥越过深谷，挑战飞行属性馆主云翎。', 'lark-town', '云雀镇', '云雀道馆馆主云翎', 'gym-lark-leader', 'badge-lark', [370, -690], 'tm-aerial-ace'),
];
