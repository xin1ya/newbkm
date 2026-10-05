/**
 * M3-16 · 琉璃群岛三座道馆任务（07-22 §3.6 第四章）。其余第四章主线与支线在 M3-25 / M3-27 加入。
 * 三座道馆挑战顺序自由（动态等级按本岛徽章数取 3 档）；徽章名暂统一为「翠澜徽章」。
 */
import type { Quest } from '@/systems/quests';
import { THUNDER_BADGES } from '@/config/story/thunder';
import { DIVER_COMPASS_POS } from '@/config/story/glaze';
import { VICTORY_ROAD_BADGES, VICTORY_ROAD_CLEARED } from '@/config/interiors/victoryRoad';

const ISLAND = '琉璃群岛';
const PRE = ['badge-azure', 'badge-ore', 'badge-flame', ...THUNDER_BADGES];

function gymQuest(id: string, title: string, summary: string, zoneId: string, townName: string, leader: string, trainerId: string, badge: string, door: [number, number], tm: string): Quest {
  return {
    id,
    title,
    category: 'main',
    island: ISLAND,
    summary,
    prerequisites: PRE,
    completeFlag: badge,
    objectives: [
      { id: 'reach-town', text: `前往${townName}`, completeFlag: `arrived-${zoneId}`, marker: { island: 'glaze', zoneId }, trigger: { type: 'enter-zone', zoneId } },
      { id: 'beat-leader', text: `击败${leader}`, completeFlag: badge, marker: { island: 'glaze', position: [door[0], 0, door[1]] }, trigger: { type: 'defeat', trainerId } },
    ],
    reward: { items: [{ id: tm, qty: 1 }] },
  };
}

export const GLAZE_QUESTS: Quest[] = [
  // ——— M3-20 · 冠军之路 ———
  {
    id: 'main-victory-road',
    title: '冠军之路',
    category: 'main',
    island: ISLAND,
    summary: '集齐翠澜四岛全部 11 枚徽章后，穿过冠军山腹地的冠军之路，抵达联盟高原上的彩幽市。',
    prerequisites: [...VICTORY_ROAD_BADGES],
    completeFlag: VICTORY_ROAD_CLEARED,
    objectives: [
      { id: 'gate', text: '前往冠军山南麓的冠军之路南口', completeFlag: 'vr-entered', marker: { island: 'glaze', position: [80, 0, -232] } },
      { id: 'waterfall', text: '在地下暗河找到攀瀑老人，学会「攀瀑」', completeFlag: 'hm07-waterfall', marker: { island: 'glaze', position: [80, 0, -232] } },
      { id: 'summit', text: '逆瀑而上、攀上岩壁，走出冠军之路北口', completeFlag: VICTORY_ROAD_CLEARED, marker: { island: 'glaze', position: [80, 0, -232] } },
    ],
    reward: { money: 10000, items: [{ id: 'ultra-ball', qty: 5 }, { id: 'hyper-potion', qty: 3 }] },
  },
  // ——— M3-21 · 精灵联盟 ———
  {
    id: 'main-league',
    title: '精灵联盟',
    category: 'main',
    island: ISLAND,
    summary: '走进彩幽市北端的精灵联盟，依次击败四天王花月、芙蓉、波妮、源治，挑战冠军米可利。挑战途中不能回到大厅，厅间回廊只能补给道具。',
    prerequisites: [VICTORY_ROAD_CLEARED],
    completeFlag: 'league-champion-title',
    objectives: [
      { id: 'e1', text: '击败四天王 · 花月（恶）', completeFlag: 'trainer-defeated:league-e1', marker: { island: 'glaze', position: [40, 0, -876] } },
      { id: 'e2', text: '击败四天王 · 芙蓉（鬼）', completeFlag: 'trainer-defeated:league-e2', marker: { island: 'glaze', position: [40, 0, -876] } },
      { id: 'e3', text: '击败四天王 · 波妮（冰）', completeFlag: 'trainer-defeated:league-e3', marker: { island: 'glaze', position: [40, 0, -876] } },
      { id: 'e4', text: '击败四天王 · 源治（龙）', completeFlag: 'trainer-defeated:league-e4', marker: { island: 'glaze', position: [40, 0, -876] } },
      { id: 'champion', text: '战胜冠军米可利，载入名人堂', completeFlag: 'league-champion-title', marker: { island: 'glaze', position: [40, 0, -876] } },
    ],
    reward: { money: 30000, items: [{ id: 'master-ball', qty: 1 }] },
  },
  gymQuest('main-gym-mirage', '镜中幻影', '幻影镇的道馆里只有镜子没有门。转动念力水晶球，穿过镜厅挑战超能力属性馆主幻月。', 'mirage-town', '幻影镇', '幻影道馆馆主幻月', 'gym-mirage-leader', 'badge-mirage', [-380, 400], 'tm-calm-mind'),
  gymQuest('main-gym-ghost', '长明之灯', '彩幽市的道馆是一座常暗的墓厅。点亮长明灯驱散灵火，挑战幽灵属性馆主幽魄。', 'ghost-town', '彩幽市', '幽冥道馆馆主幽魄', 'gym-ghost-leader', 'badge-ghost', [-430, -198], 'tm-shadow-claw'),
  gymQuest('main-gym-lily', '琉璃水镜', '琉璃镇的道馆是玻璃穹顶下的一池清水。转动阀门升降水位，挑战水属性馆主琉璃。', 'glaze-town', '琉璃镇', '琉璃道馆馆主琉璃', 'gym-glaze-leader', 'badge-glaze', [486, 118], 'tm-scald'),
  // ——— M3-18 · 潜水 + 海底神殿 ———
  {
    id: 'side-old-diver',
    title: '深叔的旧罗盘',
    category: 'side',
    island: ISLAND,
    summary: '琉璃镇的老潜水员深叔年轻时把潜水罗盘掉在了琉璃沙滩东边的浅湾。找回罗盘，他就教你潜水。',
    prerequisites: ['badge-glaze'],
    startNpc: 'glaze-old-diver',
    startFlag: 'diver-quest-start',
    completeFlag: 'diver-compass-returned',
    objectives: [
      { id: 'find', text: '冲浪到琉璃沙滩东边的浅湾，找到漂浮的木匣', completeFlag: 'diver-compass-found', marker: { island: 'glaze', position: [DIVER_COMPASS_POS[0], 0, DIVER_COMPASS_POS[1]], radius: 18 } },
      { id: 'return', text: '把罗盘交还给琉璃镇的深叔', completeFlag: 'diver-compass-returned', marker: { island: 'glaze', position: [460, 0, 158] } },
    ],
    reward: { hm: 'hm08-dive', items: [{ id: 'net-ball', qty: 5 }] },
  },
  {
    id: 'side-sea-temple',
    title: '潮落之门',
    category: 'side',
    island: ISLAND,
    summary: '石堤尽头的门楼只是影门。从东边深海的漩涡潜下去，找到真正的海底神殿。',
    prerequisites: ['side-old-diver'],
    completeFlag: 'sea-temple-cleared',
    objectives: [
      { id: 'dive', text: '在东边深海的漩涡处下潜，进入海底神殿', completeFlag: 'sea-temple-entered', marker: { island: 'glaze', position: [800, 0, 200] } },
      { id: 'hall', text: '吹响潮汐螺，穿过前厅的水幕', completeFlag: 'sea-temple-hall-open', marker: { island: 'glaze', position: [800, 0, 200] } },
      { id: 'altar', text: '触碰圣所祭坛上的晶石', completeFlag: 'sea-temple-cleared', marker: { island: 'glaze', position: [800, 0, 200] } },
    ],
    reward: { money: 5000 },
  },
];
