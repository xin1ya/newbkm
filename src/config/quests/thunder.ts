/**
 * M3-15 / M3-24 · 雷鸣群岛第三章主线（07-22 §3.6 第三章 #14–#19）：二度跨海、四座道馆、冰封秘密。支线在 M3-26 加入。
 * 四座道馆挑战顺序自由（动态等级按本岛徽章数取 4 档）；徽章名暂统一为「翠澜徽章」。
 * 雪原道馆奖励「攀爬」许可（flag hm08-rock-climb，骑乘本体在 M3-17）。
 */
import type { Quest } from '@/systems/quests';

const ISLAND = '雷鸣群岛';
const PRE = ['main-cross-sea-2'];

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
  {
    id: 'main-cross-sea-2',
    title: '二度跨海',
    category: 'main',
    island: ISLAND,
    summary: '汤婆婆说，第四块碎片可能封在雷鸣群岛的冰川下。渡轮停航，只能冲浪穿过碧潮—雷鸣海域。',
    prerequisites: ['main-hot-spring-info'],
    completeFlag: 'thunder-arrival-card',
    objectives: [
      { id: 'boatman', text: '去温泉乡码头找船老大打听航路', completeFlag: 'thunder-route-open', marker: { island: 'tide', position: [562, 0, 650] } },
      { id: 'cross', text: '冲浪向东穿过洋流与漩涡，抵达雷鸣群岛', completeFlag: 'thunder-arrival-card', marker: { island: 'thunder', position: [-470, 0, 412] } },
    ],
  },
  gymQuest('main-gym-thunder', '雷云异变', '雷鸣镇的雷暴一年比一年密。挑战电属性馆主雷霆，穿过导电开关把守的变电厅。', 'thunder-town', '雷鸣镇', '雷鸣道馆馆主雷霆', 'gym-thunder-leader', 'badge-thunder', [-500, 360], 'tm-shock-wave'),
  gymQuest('main-gym-dawn', '普之试炼', '晨光镇的道馆随昼夜变换道路。拨动日晷，找到通往馆主晨辉的路。', 'dawn-town', '晨光镇', '晨光道馆馆主晨辉', 'gym-dawn-leader', 'badge-dawn', [430, 480], 'tm-facade'),
  {
    id: 'main-snow-ruins',
    title: '冰封秘密',
    category: 'main',
    island: ISLAND,
    summary: '雪原镇北面的冰川下埋着古代文明的遗迹。圣坛的寒冰里，有一团蓝色的光。',
    prerequisites: ['main-cross-sea-2'],
    completeFlag: 'snow-ruins-shard',
    objectives: [
      { id: 'enter', text: '进入雪原镇北面的冰川遗迹', completeFlag: 'glacier-ruins-entered', marker: { island: 'thunder', position: [-74, 0, -372] } },
      { id: 'sanctum', text: '推石填平冰裂缝，前往冰封圣坛', completeFlag: 'glacier-sanctum-reached', marker: { island: 'thunder', position: [-74, 0, -372] } },
      { id: 'altar', text: '解开圣坛之冰', completeFlag: 'snow-ruins-shard', marker: { island: 'thunder', position: [-74, 0, -372] } },
    ],
    reward: { items: [{ id: 'anomaly-shard-blue', qty: 1 }] },
  },
  gymQuest('main-gym-snow', '冰之试炼', '雪原镇的道馆是一整片冰晶滑场。滑过冰面，挑战冰属性馆主霜凝。', 'snow-town', '雪原镇', '雪原道馆馆主霜凝', 'gym-snow-leader', 'badge-snow', [160, -132], 'tm-icy-wind', 'hm08-rock-climb'),
  gymQuest('main-gym-cloud', '天空异象', '云雀镇上空出现了奇异的光。乘着风桥越过深谷，挑战飞行属性馆主云翎。', 'lark-town', '云雀镇', '云雀道馆馆主云翎', 'gym-lark-leader', 'badge-lark', [370, -690], 'tm-aerial-ace'),
];
