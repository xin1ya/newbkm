/**
 * M3-15 / M3-24 · 雷鸣群岛第三章主线（07-22 §3.6 第三章 #14–#19）：二度跨海、四座道馆、冰封秘密。支线在 M3-26 加入。
 * 四座道馆挑战顺序自由（动态等级按本岛徽章数取 4 档）；徽章名暂统一为「翠澜徽章」。
 * 雪原道馆奖励「攀爬」许可（flag hm08-rock-climb，骑乘本体在 M3-17）。
 */
import type { Quest } from '@/systems/quests';
import { CLEAR_ICE_SPOT, STORM_SAMPLE_SPOTS } from '@/config/story/thunder';

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
  // —————————— M3-26 · 支线（07-22 §3.7 雷鸣群岛 6 条） ——————————
  {
    id: 'side-crystal-treasure',
    title: '晶石洞窟寻宝',
    category: 'side',
    island: ISLAND,
    summary: '雷鸣镇的电工阿伏想要一块晶石洞窟深处的「雷晶」，用来修冻坏的输电线路。洞里要用怪力推石压住压力板。',
    prerequisites: ['main-cross-sea-2'],
    startNpc: 'thunder-engineer',
    startFlag: 'crystal-treasure-start',
    completeFlag: 'crystal-treasure-done',
    objectives: [
      { id: 'core', text: '推石打开晶石栅栏，在晶洞深处的晶核上取下雷晶', completeFlag: 'crystal-core-taken', marker: { island: 'thunder', position: [-210, 0, -56] } },
      { id: 'return', text: '把雷晶交给雷鸣镇的电工阿伏', completeFlag: 'crystal-treasure-done', marker: { island: 'thunder', position: [-395, 0, 412] } },
    ],
    reward: { items: [{ id: 'thunder-stone', qty: 1 }, { id: 'fire-stone', qty: 1 }, { id: 'water-stone', qty: 1 }] },
  },
  {
    id: 'side-lighthouse-ghost',
    title: '古灯塔幽灵灯',
    category: 'side',
    island: ISLAND,
    summary: '古灯塔的灯熄了三年，海港终夜起雾。修塔工阿钟说，灯室里住着「不让点灯」的东西。',
    prerequisites: ['main-cross-sea-2'],
    startNpc: 'lh-repairman',
    startFlag: 'lighthouse-ghost-start',
    completeFlag: 'lighthouse-ghost-done',
    objectives: [
      { id: 'lamp', text: '登上古灯塔灯室，重新点亮灯火', completeFlag: 'lh-lamp-lit', marker: { island: 'thunder', position: [850, 0, 556] } },
      { id: 'return', text: '回灯塔一楼告诉修塔工阿钟', completeFlag: 'lighthouse-ghost-done', marker: { island: 'thunder', position: [850, 0, 556] } },
    ],
    reward: { money: 5000, items: [{ id: 'shiny-stone', qty: 2 }] },
  },
  {
    id: 'side-thunder-observation',
    title: '雷云观测站',
    category: 'side',
    island: ISLAND,
    summary: '雷暴高原的雷云这几个月越来越反常。帮观测站的研究员在 3 个采样点记录雷云数据。',
    prerequisites: ['main-cross-sea-2'],
    startNpc: 'storm-researcher',
    startFlag: 'thunder-observation-start',
    completeFlag: 'thunder-observation-done',
    objectives: [
      ...STORM_SAMPLE_SPOTS.map(([x, z], i) => ({
        id: `sample-${i + 1}`,
        text: `在雷暴高原第 ${i + 1} 个采样点记录数据`,
        completeFlag: `storm-sample-${i + 1}`,
        marker: { island: 'thunder' as const, position: [x, 0, z] as [number, number, number], radius: 12 },
      })),
      { id: 'return', text: '回雷云观测站交给研究员', completeFlag: 'thunder-observation-done', marker: { island: 'thunder', position: [-330, 0, -150] } },
    ],
    reward: { items: [{ id: 'thunder-stone', qty: 2 }] },
  },
  {
    id: 'side-ice-sculpture',
    title: '雪原冰雕节',
    category: 'side',
    island: ISLAND,
    summary: '雪原镇一年一度的冰雕节开始了！先去冰湖撬一块透明冰，再用宝可梦的冰系招式雕出作品。',
    prerequisites: ['main-cross-sea-2'],
    startNpc: 'snow-sculptor',
    startFlag: 'ice-sculpture-start',
    completeFlag: 'ice-sculpture-done',
    objectives: [
      { id: 'ice', text: '去冰湖边撬一块透明冰', completeFlag: 'ice-block-got', marker: { island: 'thunder', position: [CLEAR_ICE_SPOT[0], 0, CLEAR_ICE_SPOT[1]], radius: 12 } },
      { id: 'carve', text: '把透明冰交给雪原镇的冰雕师傅，参加比赛', completeFlag: 'ice-sculpture-done', marker: { island: 'thunder', position: [146, 0, -196] } },
    ],
    reward: { items: [{ id: 'never-melt-ice', qty: 1 }, { id: 'ice-stone', qty: 1 }] },
  },
  {
    id: 'side-frozen-seed',
    title: '冻土下的种子',
    category: 'side',
    island: ISLAND,
    summary: '冰川遗迹圣坛的冰化开后，冰缝里露出一颗远古种子。温泉乡培育屋的暖婆婆也许能让它发芽。',
    prerequisites: ['main-snow-ruins'],
    startFlag: 'frozen-seed-found',
    completeFlag: 'frozen-seed-sprouted',
    objectives: [{ id: 'plant', text: '把远古种子带到碧潮群岛温泉乡的培育屋', completeFlag: 'frozen-seed-sprouted', marker: { island: 'tide', position: [340, 0, 548] } }],
    reward: { pokemon: 1, pokemonLevel: 20 },
  },
  {
    id: 'side-cloud-mail',
    title: '云雀信使',
    category: 'side',
    island: ISLAND,
    summary: '云雀镇的信鸽站人手不够。骑着飞行宝可梦，把三封信送到三座不同的岛上。',
    prerequisites: ['badge-lark'],
    startNpc: 'lark-courier',
    startFlag: 'cloud-mail-start',
    completeFlag: 'cloud-mail-done',
    objectives: [
      { id: 'sprout', text: '把信送给萌芽群岛研究所的木兰博士', completeFlag: 'mail-magnolia', marker: { island: 'sprout', position: [-20, 0, 345] } },
      { id: 'tide', text: '把信送给碧潮群岛温泉旅馆的汤老板', completeFlag: 'mail-inn-owner', marker: { island: 'tide', position: [410, 0, 600] } },
      { id: 'dawn', text: '把信送给晨光镇磨坊的磨坊主', completeFlag: 'mail-dawn-miller', marker: { island: 'thunder', zoneId: 'dawn-town' } },
      { id: 'return', text: '回云雀镇信鸽站复命', completeFlag: 'cloud-mail-done', marker: { island: 'thunder', position: [282, 0, -640] } },
    ],
    reward: { money: 3000, items: [{ id: 'exp-candy-l', qty: 1 }, { id: 'flying-stone', qty: 1 }] },
  },
];
