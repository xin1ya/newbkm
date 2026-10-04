/**
 * M1-07 · 萌芽群岛的家具与地标互动文字。
 * 室内家具 id 来自 config/interiors/sprout.ts 的 `interact` 字段；地标 id 来自 islands/sprout.ts 的 POI。
 * 恢复（宝可梦中心）与商店的正式流程在 M1-19，钓鱼在 M1-15，渡船航线在 M2-E2；这里先给出场景内的文字。
 */
import type { InteractionDef } from '@/systems/interaction';

export const SPROUT_FURNITURE: InteractionDef[] = [
  // ——— 自己家 ———
  { id: 'gym-rules', kind: 'examine', pages: ['「翠澜道馆 · 挑战须知」', '池中的水位由阀门控制：高水位时木筏浮起，低水位时石栈道露出。', '站在阀门旁「转动阀门」即可切换水位。先想清楚，再动手！', '——馆主 沧澜'] },
  { id: 'house-tv', kind: 'examine', pages: ['电视里正在播放翠澜地方新闻：', '「本周萌芽群岛天气晴朗，适合出门冒险！」'], night: ['电视里正在播放深夜节目……', '「翠澜群岛的传说——守护者真的存在吗？」'] },
  { id: 'house-fridge', kind: 'examine', pages: ['冰箱里有新鲜的树果和一瓶哞哞鲜奶。', '妈妈大概又要做树果派了。'] },
  { id: 'house-books', kind: 'examine', pages: ['书架上摆着《宝可梦入门》《翠澜群岛旅游指南》……', '还有一本翻旧了的《如何成为宝可梦训练家》。'] },
  {
    id: 'bed',
    kind: 'rest',
    pages: ['软绵绵的床铺。要休息一下吗？'],
    effects: [{ kind: 'heal-party', fade: true }],
    after: ['好好休息了一下，全身充满了干劲！'],
    byFlag: [{ when: '!starter-chosen', pages: ['软绵绵的床铺。', '今天可是重要的日子，现在可不是睡觉的时候！'] }],
  },
  {
    id: 'pc-home',
    kind: 'use',
    label: '使用电脑',
    pages: ['打开了电脑。', '邮箱里有一封信：「欢迎来到翠澜群岛！——木兰」', '连接到了宝可梦寄放系统。'],
    effects: [{ kind: 'pc-storage', title: '宝可梦寄放系统 · 自家电脑' }],
    byFlag: [{ when: '!starter-chosen', pages: ['打开了电脑。', '邮箱里有一封信：「欢迎来到翠澜群岛！——木兰」'] }],
  },
  {
    id: 'block-machine-home',
    kind: 'use',
    label: '使用方块机',
    pages: ['爸爸留下的能量方块机。放进 2–4 种不同的树果，跟着转盘的节奏搅拌就能做出能量方块。'],
    effects: [{ kind: 'block-machine' }],
  },
  { id: 'game-console', kind: 'examine', pages: ['是最新款的游戏机。', '屏幕上还停在「宝可梦大冒险」的存档画面。'] },
  // ——— 研究所 ———
  {
    id: 'starter-table',
    kind: 'examine',
    label: '查看精灵球',
    pages: ['桌上整齐地摆着三颗精灵球。', '球里的宝可梦好像感觉到了你，轻轻晃了晃。'],
    effects: [{ kind: 'story', script: 'starter-choice' }],
    byFlag: [
      { when: 'starter-chosen', pages: ['桌上还剩下两颗精灵球。', '它们也在等待属于自己的训练家。'] },
      { when: '!dream-prelude-done', pages: ['桌上整齐地摆着三颗精灵球。', '先和木兰博士打个招呼吧。'] },
    ],
  },
  {
    id: 'lab-healer',
    kind: 'use',
    label: '使用恢复机',
    pages: ['研究所的宝可梦恢复机。', '把宝可梦放进去，就能让它们恢复精神。'],
    effects: [{ kind: 'heal-party', fade: true, machine: true }],
    after: ['叮咚——宝可梦们都恢复了精神！', '（木兰博士说过，研究所的恢复机随时可以用。）'],
    byFlag: [{ when: '!starter-chosen', pages: ['研究所的宝可梦恢复机。', '你还没有宝可梦，先去和木兰博士打个招呼吧。'] }],
  },
  { id: 'lab-scanner', kind: 'use', pages: ['这是宝可梦能量扫描仪。', '屏幕上跳动着翠澜群岛各地的能量读数……', '「异常波动：幻影之森」'] },
  {
    id: 'pc-lab',
    kind: 'use',
    label: '使用电脑',
    pages: ['研究所的电脑正在整理图鉴数据。', '「萌芽群岛已记录：40 种宝可梦」', '也可以从这里登录宝可梦寄放系统。'],
    effects: [{ kind: 'pc-storage', title: '宝可梦寄放系统 · 木兰研究所' }],
    byFlag: [{ when: '!starter-chosen', pages: ['研究所的电脑正在整理图鉴数据。', '「萌芽群岛已记录：40 种宝可梦」'] }],
  },
  { id: 'lab-books-1', kind: 'examine', pages: ['《宝可梦的属性与相克》', '水克火，火克草，草克水……基础中的基础。'] },
  { id: 'lab-books-2', kind: 'examine', pages: ['《翠澜群岛的起源》', '传说群岛是由沉睡的守护者从海中托起的。'] },
  { id: 'lab-books-3', kind: 'examine', pages: ['《骑乘宝可梦安全手册》', '「骑乘前请确认宝可梦的体力与意愿。」'] },
  { id: 'lab-aquarium', kind: 'examine', pages: ['水族箱里有几只鲤鱼王在悠闲地游动。', '偶尔会有一只拼命地跳起来。'] },
  // ——— 蒲婆婆家 ———
  {
    id: 'herb-shelf',
    kind: 'examine',
    pages: ['架子上晾着各种药草，散发着淡淡的清香。'],
    byFlag: [{ when: 'herbs-quest-start', pages: ['架子上晾着各种药草。', '蒲婆婆说还缺翠澜湖畔的翠澜药草——叶背是蓝色的。'] }],
  },
  // ——— 宝可梦中心 ———
  { id: 'nurse-counter', kind: 'examine', pages: ['柜台擦得一尘不染。', '想恢复宝可梦的话，和乔伊小姐说话吧。'] },
  { id: 'healer', kind: 'examine', pages: ['宝可梦恢复机正在待机，指示灯一闪一闪。'] },
  {
    id: 'pc-center',
    kind: 'use',
    label: '使用电脑',
    pages: ['打开了电脑。', '连接到了宝可梦寄放系统。'],
    effects: [{ kind: 'pc-storage', title: '宝可梦寄放系统 · 宝可梦中心' }],
    byFlag: [{ when: '!starter-chosen', pages: ['打开了电脑。', '你还没有宝可梦，寄放系统暂时用不上。'] }],
  },
  // ——— 商店 ———
  { id: 'mart-counter', kind: 'examine', pages: ['收银台上贴着：「今日特价：伤药」。', '想买东西的话，和店员说话吧。'] },
  { id: 'mart-shelf-1', kind: 'examine', pages: ['货架上整齐地排列着伤药和解毒药。'] },
  { id: 'mart-shelf-2', kind: 'examine', pages: ['货架上摆着精灵球和超级球。', '旁边的小牌子写着：「新手训练家必备！」'] },
  // ——— 海崖洞穴 ———
  { id: 'cave-crystal', kind: 'examine', pages: ['淡蓝色的结晶散发着微光。', '靠近时，能感觉到一股奇妙的能量……'] },
  {
    id: 'cave-hidden-item',
    kind: 'examine',
    pages: ['旧木箱的缝隙里好像有什么东西……'],
    effects: [{ kind: 'give-item', item: 'revive', qty: 1, flag: 'cave-hidden-item-taken', itemName: '活力碎片' }],
    byFlag: [{ when: 'cave-hidden-item-taken', pages: ['旧木箱里已经空了。'] }],
  },
  // ——— 港湾大市场 ———
  { id: 'stall-fish', kind: 'examine', pages: ['摊位上摆满了刚捕上来的海鲜。', '「新鲜的！早上刚到港！」'] },
  { id: 'stall-fruit', kind: 'examine', pages: ['五颜六色的水果堆成了小山。'] },
  { id: 'stall-tools', kind: 'examine', pages: ['挂满了钓竿、渔网和各式工具。', '「钓竿？先去钓鱼码头找渔夫们聊聊吧。」'] },
  { id: 'stall-berries', kind: 'examine', pages: ['各种树果按颜色排得整整齐齐。', '橙橙果、蔓莓果、零余果……'] },
  { id: 'stall-souvenir', kind: 'examine', pages: ['摆着翠澜群岛的明信片和宝可梦玩偶。', '木木枭玩偶好像卖得最好。'] },
  { id: 'market-tank', kind: 'examine', pages: ['大水槽里游着各种水系宝可梦。', '一只玛瑙水母正贴着玻璃看着你。'] },
];

export const SPROUT_LANDMARKS: InteractionDef[] = [
  { id: 'sprout-dock', kind: 'examine', range: 3, pages: ['萌芽镇码头。', '海风里带着咸咸的味道，远处能看到翠澜镇的屋顶。'] },
  { id: 'harbor-lighthouse', kind: 'examine', range: 4, pages: ['港湾灯塔。', '「本灯塔建于群岛开拓之年，守护往来船只平安。」'], night: ['灯塔的光束一圈一圈地扫过海面。'] },
  { id: 'phantom-forest-entrance', kind: 'examine', range: 3.5, pages: ['「幻影之森」', '「森林深处常有浓雾，请勿单独深入。」'] },
  { id: 'zorua-clearing', kind: 'examine', range: 4, pages: ['雾气在这片空地上打着旋……', '好像有谁在暗处看着你。'] },
  { id: 'harbor-pier', kind: 'examine', range: 3, pages: ['钓鱼码头。', '「钓鱼大赛每月举办，报名请找主持人。」'] },
  {
    id: 'harbor-ferry',
    kind: 'ferry',
    range: 3.5,
    // M2-04：首次跨海（冲浪横渡水路 1）之后，渡船可在港湾市 ↔ 碧潮镇之间往返
    pages: ['渡船码头。', '「前往碧潮群岛的渡船：每日往返。」'],
    effects: [{ kind: 'story', script: 'ferry-to-tide' }],
    byFlag: [
      { when: '!ferry-route-opened', pages: ['渡船码头。', '「前往碧潮群岛的渡船：暂停运营。」', '好像要等港口的事情处理完才能开船。'] },
      { when: '!cross-sea-1-done', pages: ['渡船码头。', '「前往碧潮群岛的渡船：首航排期中。」', '售票员说：会冲浪的话，从码头往东横渡水路 1 就能先过去看看。'] },
    ],
  },
];
