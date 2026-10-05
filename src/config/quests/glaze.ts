/**
 * M3-16 / M3-25 · 琉璃群岛第四章主线（07-22 §3.6 第四章 #20–#27）：三度跨海、三座道馆、亡魂低吟、冠军之路、联盟。支线在 M3-27 加入。
 * 三座道馆挑战顺序自由（动态等级按本岛徽章数取 3 档）；徽章名暂统一为「翠澜徽章」。
 */
import type { Quest } from '@/systems/quests';
import { THUNDER_BADGES } from '@/config/story/thunder';
import { BASE_MATERIAL_SPOTS, DIVER_COMPASS_POS, PROPHECY_SPOTS, SPIRIT_SPOTS, VEIN_SPRING_SPOT } from '@/config/story/glaze';
import { VICTORY_ROAD_BADGES, VICTORY_ROAD_CLEARED } from '@/config/interiors/victoryRoad';

const ISLAND = '琉璃群岛';
const PRE = ['main-cross-sea-3'];

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
  // ——— M3-25 · 主线 20 三度跨海 ———
  {
    id: 'main-cross-sea-3',
    title: '三度跨海',
    category: 'main',
    island: ISLAND,
    summary: '北方天空的裂光指向终年起雾的琉璃群岛。去云雀镇码头找钓竿爷，穿过礁石迷宫。',
    prerequisites: [...THUNDER_BADGES, 'snow-ruins-shard'],
    completeFlag: 'glaze-arrival-card',
    objectives: [
      { id: 'fisher', text: '去云雀镇码头找钓竿爷打听航路', completeFlag: 'glaze-route-open', marker: { island: 'thunder', position: [-146, 0, -690] } },
      { id: 'cross', text: '冲浪向北，循着红绿浮标穿过礁石迷宫，抵达琉璃群岛', completeFlag: 'glaze-arrival-card', marker: { island: 'glaze', position: [-380, 0, 470] } },
    ],
  },
  // ——— M3-25 · 主线 22 亡魂低吟 ———
  {
    id: 'main-ghost-event',
    title: '亡魂低吟',
    category: 'main',
    island: ISLAND,
    summary: '幽冥镇每晚都有亡魂哭泣，长明灯一盏盏熄灭。灵堂的巫女澄说，低吟声来自镇北的暗影洞窟。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'ghost-priestess',
    startFlag: 'ghost-event-start',
    completeFlag: 'ghost-event-solved',
    objectives: [
      { id: 'cave', text: '前往幽冥镇北边的暗影洞窟', completeFlag: 'shadow-cave-entered', marker: { island: 'glaze', position: [-268, 0, -318] } },
      { id: 'altar', text: '穿过漆黑的迷廊，平息深渊大厅祭坛的低吟', completeFlag: 'ghost-event-solved', marker: { island: 'glaze', position: [-268, 0, -318] } },
    ],
    reward: { items: [{ id: 'anomaly-shard-ghost', qty: 1 }, { id: 'spell-tag', qty: 1 }] },
  },
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
  gymQuest('main-gym-mirage', '精神异变', '幻影镇的道馆里只有镜子没有门。转动念力水晶球，穿过镜厅挑战超能力属性馆主幻月。', 'mirage-town', '幻影镇', '幻影道馆馆主幻月', 'gym-mirage-leader', 'badge-mirage', [-380, 400], 'tm-calm-mind'),
  gymQuest('main-gym-ghost', '幽之试炼', '幽冥镇的道馆是一座常暗的墓厅。点亮长明灯驱散灵火，挑战幽灵属性馆主幽魄。', 'ghost-town', '幽冥镇', '幽冥道馆馆主幽魄', 'gym-ghost-leader', 'badge-ghost', [-430, -198], 'tm-shadow-claw'),
  gymQuest('main-gym-lily', '水之试炼·终', '琉璃镇的道馆是玻璃穹顶下的一池清水。转动阀门升降水位，挑战水属性馆主琉璃。', 'glaze-town', '琉璃镇', '琉璃道馆馆主琉璃', 'gym-glaze-leader', 'badge-glaze', [486, 118], 'tm-scald'),
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
    reward: { money: 5000, items: [{ id: 'ancient-amulet', qty: 1 }] },
  },
  // —————————— M3-27 · 琉璃支线（07-22 §3.7；海底神殿 = side-sea-temple，M3-18） ——————————
  {
    id: 'side-shadow-cave',
    title: '暗影洞窟探险',
    category: 'side',
    island: ISLAND,
    summary: '守洞人墨婆说，暗影洞窟深渊大厅的暗河边住着一只谁也没抓到过的宝可梦。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'sc-guide',
    startFlag: 'shadow-explore-start',
    completeFlag: 'shadow-cave-done',
    objectives: [
      { id: 'meet', text: '穿过暗影迷廊，在深渊大厅的暗河边找到传说中的宝可梦', completeFlag: 'shadow-rare-met', marker: { island: 'glaze', position: [-268, 0, -318] } },
      { id: 'return', text: '回洞口告诉守洞人墨婆', completeFlag: 'shadow-cave-done', marker: { island: 'glaze', position: [-268, 0, -318] } },
    ],
    reward: { items: [{ id: 'black-glasses', qty: 1 }, { id: 'dusk-stone', qty: 1 }] },
  },
  {
    id: 'side-spirit-seance',
    title: '幽冥降灵会',
    category: 'side',
    island: ISLAND,
    summary: '守墓人老墨说，被异变惊醒的亡魂忘了自己是谁。陪它们打一场，帮 3 个亡魂安息。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'ghost-gravekeeper',
    startFlag: 'seance-start',
    completeFlag: 'seance-done',
    objectives: [
      ...SPIRIT_SPOTS.map(([x, z], i) => ({
        id: `spirit-${i + 1}`,
        text: ['平息墓园里的亡魂', '平息沼泽古墓的亡魂', '平息钟楼下的亡魂'][i]!,
        completeFlag: `spirit-${i + 1}-calmed`,
        marker: { island: 'glaze' as const, position: [x, 0, z] as [number, number, number], radius: 10 },
      })),
      { id: 'return', text: '回守墓人小屋告诉老墨', completeFlag: 'seance-done', marker: { island: 'glaze', position: [-486, 0, -159] } },
    ],
    reward: { items: [{ id: 'spirit-veil', qty: 1 }, { id: 'tm-spite', qty: 1 }] },
  },
  {
    id: 'side-secret-base',
    title: '秘密基地定制',
    category: 'side',
    island: ISLAND,
    summary: '暗影洞窟洞口的东壁是空心的。帮秘密基地迷阿穴收集三样材料，造一座属于自己的秘密基地。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'base-builder',
    startFlag: 'secret-base-start',
    completeFlag: 'secret-base-built',
    objectives: [
      ...BASE_MATERIAL_SPOTS.map((m) => ({
        id: m.id,
        text: `收集${m.name}`,
        completeFlag: `base-mat-${m.id}`,
        marker: { island: 'glaze' as const, position: [m.at[0], 0, m.at[1]] as [number, number, number], radius: 10 },
      })),
      { id: 'build', text: '把材料交给暗影洞窟洞口的阿穴', completeFlag: 'secret-base-built', marker: { island: 'glaze', position: [-268, 0, -318] } },
    ],
  },
  {
    id: 'side-mirage-prophecy',
    title: '幻影预言解读',
    category: 'side',
    island: ISLAND,
    summary: '幻影镇的先知娜芙从水晶球里看到三段预言，它们只对亲临其地的人开口。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'mirage-seer',
    startFlag: 'prophecy-start',
    completeFlag: 'prophecy-done',
    objectives: [
      ...PROPHECY_SPOTS.map(([x, z], i) => ({
        id: `p${i + 1}`,
        text: ['在蜃楼宫观景处感应「白昼之宫」', '在月影塔遗址感应「月下之塔」', '在神殿石碑旁感应「海底之门」'][i]!,
        completeFlag: `prophecy-${i + 1}`,
        marker: { island: 'glaze' as const, position: [x, 0, z] as [number, number, number], radius: 10 },
      })),
      { id: 'return', text: '回先知之家，把三段预言告诉娜芙', completeFlag: 'prophecy-done', marker: { island: 'glaze', position: [-436, 0, 490] } },
    ],
    reward: { items: [{ id: 'seer-eye', qty: 1 }, { id: 'tm-psychic', qty: 1 }] },
  },
  {
    id: 'side-lily-watervein',
    title: '琉璃水脉修复',
    category: 'side',
    island: ISLAND,
    summary: '琉璃镇玻璃工坊的冷却泉水断了。去冠军山南麓的琉璃水脉泉眼看看出了什么事。',
    prerequisites: ['main-cross-sea-3'],
    startNpc: 'glaze-glassblower',
    startFlag: 'watervein-start',
    completeFlag: 'watervein-done',
    objectives: [
      { id: 'spring', text: '调查琉璃水脉泉眼', completeFlag: 'vein-spring-fixed', marker: { island: 'glaze', position: [VEIN_SPRING_SPOT[0], 0, VEIN_SPRING_SPOT[1]], radius: 10 } },
      { id: 'return', text: '回玻璃工坊告诉岩师傅', completeFlag: 'watervein-done', marker: { island: 'glaze', position: [506, 0, 158] } },
    ],
    reward: { items: [{ id: 'water-stone', qty: 2 }, { id: 'soul-dew', qty: 1 }] },
  },
];
