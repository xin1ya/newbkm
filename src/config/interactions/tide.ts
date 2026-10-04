/**
 * M2 · 碧潮群岛的家具与地标互动（室内家具 id 来自 config/interiors/tide.ts 的 `interact`，地标 id 来自 islands/tide.ts 的 POI）。
 * 渡船（M2-04）与温泉回复（M2-08）在这里接入。
 */
import type { InteractionDef } from '@/systems/interaction';

export const TIDE_FURNITURE: InteractionDef[] = [
  // ——— 道馆告示 ———
  { id: 'gym-azure-rules', kind: 'examine', pages: ['「碧潮道馆 · 挑战须知」', '盘根小径两侧是古森的根桥，园艺家们在桥上等着你。', '树心战斗场之后，便是馆主的树洞。', '——馆主 叶岚'] },
  { id: 'gym-ore-rules', kind: 'examine', pages: ['「矿石道馆 · 挑战须知」', '采石场里碎石多，沿着矿车轨道两侧绕行。', '打赢矿工，再来见工头！', '——馆主 岩磊'] },
  { id: 'gym-flame-rules', kind: 'examine', pages: ['「碧焰道馆 · 挑战须知」', '熔岩沟不可靠近，请沿中央玄武岩栈道前进。', '……', '——馆主 炎棘'] },
  // ——— 碧潮镇 · 长老树屋 ———
  { id: 'elder-tide-books', kind: 'examine', pages: ['书架上全是手抄的古森植物志。', '有一本夹着压干的叶子：「异变之年，古森一夜长高。」'] },
  { id: 'elder-tide-map', kind: 'examine', pages: ['墙上挂着一张手绘的碧潮群岛地图。', '中央高原上画着一个紫色的圈，旁边写着：「勿近」。'] },
  { id: 'bed-tide-elder', kind: 'examine', pages: ['铺着厚厚青苔垫的木床。', '……这是长老的床，不能随便睡。'] },
  // ——— 矿石镇 · 工头之家 / 矿洞 ———
  { id: 'foreman-bench', kind: 'examine', pages: ['工作台上摆着几把磨得发亮的镐头。', '墙上钉着值班表：「石根 · 深层矿脉」。'] },
  { id: 'foreman-shelf', kind: 'examine', pages: ['架子上摆着各种矿石标本。', '最上层有一块紫色的晶石，贴着标签：「深层矿脉 · 异常」。'] },
  { id: 'foreman-mine-map', kind: 'examine', pages: ['矿洞的剖面图：入口坑道 → 深层矿脉。', '深层矿脉南端画着一块巨石，旁边写着：「后面有空洞？待查」。'] },
  {
    id: 'mine-supply-crate',
    kind: 'examine',
    pages: ['矿工的补给箱。里面还剩一些东西……'],
    effects: [{ kind: 'give-item', item: 'super-potion', qty: 2, flag: 'mine-supply-taken', itemName: '好伤药' }],
    byFlag: [{ when: 'mine-supply-taken', pages: ['补给箱已经空了。'] }],
  },
  { id: 'mine-warning', kind: 'examine', pages: ['「矿洞内野生宝可梦出没，注意安全！」', '「深层矿脉塌方，非工作人员勿入。」'] },
  { id: 'mine-anomaly-crystal', kind: 'examine', pages: ['紫色的晶簇微微发烫。', '靠近时耳边嗡嗡作响……'], byFlag: [{ when: 'mine-anomaly-found', pages: ['晶石的紫光已经暗了下去。'] }] },
  {
    id: 'ancient-tablet',
    kind: 'examine',
    label: '查看石板',
    pages: ['石台上平放着一块古老的石板，刻满了看不懂的文字。', '石板一角画着五座岛屿，和一个石头做的巨人。'],
    effects: [{ kind: 'give-item', item: 'ancient-tablet', qty: 1, flag: 'ancient-tablet-found', itemName: '古代石板' }],
    after: ['木兰博士一定很想看看这个。'],
    byFlag: [{ when: 'ancient-tablet-found', pages: ['石台上留着石板压出的浅浅印痕。'] }],
  },
  // ——— 火山镇 · 观测站 / 火山洞窟 ———
  { id: 'obs-seismograph', kind: 'examine', pages: ['地震仪的指针在纸上画出密密麻麻的波纹。'], byFlag: [{ when: 'volcano-heat-cleared', pages: ['地震仪的波纹平缓多了。'] }] },
  { id: 'obs-thermo', kind: 'examine', pages: ['地热计：412℃ ↑', '红色的警示灯一直在闪。'], byFlag: [{ when: 'volcano-heat-cleared', pages: ['地热计：286℃ —', '读数稳定。'] }] },
  { id: 'obs-pc', kind: 'use', label: '使用电脑', pages: ['打开了电脑。', '连接到了宝可梦寄放系统。'], effects: [{ kind: 'pc-storage', title: '宝可梦寄放系统 · 地热观测站' }] },
  { id: 'obs-books', kind: 'examine', pages: ['《碧潮火山三百年观测记录》', '「火山镇的火，从未熄灭。」'] },
  { id: 'obs-volcano-chart', kind: 'examine', pages: ['火山剖面图：火山口 → 熔岩隧道 → 地热核心。', '核心旁边用红笔圈了一个点：「热源？」'] },
  { id: 'volcano-warning', kind: 'examine', pages: ['「前方高温，内部黑暗。」', '「没有照明手段者请勿深入。——地热观测站」'] },
  {
    id: 'volcano-egg-nest',
    kind: 'examine',
    label: '查看',
    pages: ['岩缝里有个用干草和火山灰垒起来的窝……', '窝里有一枚温热的蛋！'],
    effects: [{ kind: 'give-item', item: 'volcano-egg', qty: 1, flag: 'volcano-egg-found', itemName: '火山口的蛋' }],
    after: ['蛋壳上有橙色的斑点。温泉乡的培育屋也许能孵化它。'],
    byFlag: [{ when: 'volcano-egg-found', pages: ['空空的窝，还残留着一点温度。'] }],
  },
  { id: 'volcano-core-crystal', kind: 'examine', pages: ['橙色的晶石烫得没法靠近。'], byFlag: [{ when: 'volcano-heat-source-found', pages: ['晶石的光暗了下来，热浪也退了。'] }] },
  // ——— 温泉乡 ———
  { id: 'breeder-egg-bed', kind: 'examine', pages: ['铺着软垫的孵蛋床，下面引了温泉的热水。'] },
  { id: 'breeder-shelf', kind: 'examine', pages: ['架子上摆着宝可梦的蛋壳标本。', '每一个都写着孵化日期和名字。'] },
  { id: 'inn-history-books', kind: 'examine', pages: ['《温泉乡志》', '「异变之年，高原紫光冲天，三日方散。」'] },
  { id: 'inn-mural', kind: 'examine', pages: ['一幅褪色的壁画：五座岛从海里升起，岛上的人和宝可梦手拉着手。'] },
  {
    id: 'inn-bed',
    kind: 'rest',
    pages: ['干净的被褥，带着淡淡的硫磺香。要休息一下吗？'],
    effects: [{ kind: 'heal-party', fade: true }],
    after: ['睡得很香！全身都暖洋洋的。'],
  },
  // ——— 异变遗迹 ———
  { id: 'ruins-inscription-1', kind: 'examine', pages: ['墙上刻着古代文字。', '……「持三证者，得入此门」……'] },
  { id: 'ruins-mural-1', kind: 'examine', pages: ['壁画（赤）：一座岛从海里升起，岛心燃着红色的火。'] },
  { id: 'ruins-mural-2', kind: 'examine', pages: ['壁画（橙）：火山喷发，橙色的光沉进了地底。'] },
  { id: 'ruins-mural-3', kind: 'examine', pages: ['壁画（紫）：石头巨人坐在圣所里，身边是一块紫色的碎片。'] },
  { id: 'ruins-mural-4', kind: 'examine', pages: ['壁画（蓝）：冰川下的城市……画面在这里断掉了。', '下一块壁画，也许在别的岛上。'] },
  { id: 'guardian-seat', kind: 'examine', pages: ['巨大的石像，表面布满了七个小小的凹点。'], byFlag: [{ when: 'ruins-guardian-defeated', pages: ['守护者静静地坐着，像是睡着了。'] }] },
  {
    id: 'ruins-hidden-item',
    kind: 'examine',
    showIf: 'cleared:ruins-rubble',
    pages: ['落石后面藏着一个古老的石匣……'],
    effects: [{ kind: 'give-item', item: 'hard-stone', qty: 1, flag: 'ruins-hidden-item-taken', itemName: '硬石头' }],
    byFlag: [{ when: 'ruins-hidden-item-taken', pages: ['石匣已经空了。'] }],
  },
];

export const TIDE_LANDMARKS: InteractionDef[] = [
  {
    id: 'tide-dock',
    kind: 'ferry',
    range: 3.5,
    pages: ['碧潮镇码头。', '「开往港湾市的渡船：每日往返。」'],
    effects: [{ kind: 'story', script: 'ferry-to-sprout' }],
    byFlag: [{ when: '!ferry-route-opened', pages: ['碧潮镇码头。', '「乘船请出示渡船船票。」'] }],
  },
  { id: 'spring-dock', kind: 'examine', range: 3.5, pages: ['温泉乡码头。', '「碧潮—雷鸣海域航线：洋流异常，暂停运营。」'] },
  {
    id: 'hot-spring',
    kind: 'rest',
    label: '泡温泉',
    range: 6,
    pages: ['冒着热气的露天温泉。要和宝可梦一起泡一泡吗？'],
    effects: [{ kind: 'heal-party', fade: true }],
    after: ['热乎乎的泉水让大家都恢复了精神！'],
    byFlag: [{ when: '!spring-source-done', pages: ['露天温泉……水是温吞的，泡着一点也不舒服。', '汤之庭的老板说，上游的泉眼被堵住了。'] }],
  },
  {
    id: 'forest-shrine',
    kind: 'examine',
    range: 4,
    pages: ['藤蔓深处的古树神龛。', '神龛里供着一片永不枯萎的叶子……旁边放着一块翠绿的石头。'],
    effects: [{ kind: 'give-item', item: 'leaf-stone', qty: 1, flag: 'forest-shrine-stone-taken', itemName: '叶之石' }],
    byFlag: [{ when: 'forest-shrine-stone-taken', pages: ['古树神龛。', '永不枯萎的叶子在风里轻轻摇晃。'] }],
  },
  { id: 'coral-wreck', kind: 'examine', range: 6, pages: ['半沉在珊瑚礁里的旧船。', '船身上爬满了太阳珊瑚……船尾隐约能看到「翠澜号」三个字。'] },
];
