/**
 * M3 · 雷鸣群岛的家具与地标互动（家具 id 来自 config/interiors/thunder.ts 的 `interact`，地标 id 来自 islands/thunder.ts 的 POI）。
 */
import type { InteractionDef } from '@/systems/interaction';

export const THUNDER_FURNITURE: InteractionDef[] = [
  // ——— 雷鸣镇 · 发电工程师之家 ———
  { id: 'engineer-bench', kind: 'examine', pages: ['工作台上摊着拆开的绝缘子和一卷铜线。', '便签：「北崖风力机 3 号 · 叶片异响，待查」。'] },
  { id: 'engineer-generator', kind: 'examine', pages: ['一台小型试验发电机，正嗡嗡地转着。', '铭牌：「雷鸣镇电网 · 雷击储能试验机」。'] },
  { id: 'engineer-shelf', kind: 'examine', pages: ['架子上整齐排着各种型号的保险丝。', '最下层有一本《避雷针的一百年》。'] },
  { id: 'engineer-grid-map', kind: 'examine', pages: ['雷鸣群岛电网图。', '雷鸣镇的避雷塔把雷击电能存进地下电池，再沿 5 号路送往晨光镇。', '冰川一带画着问号：「线路常莫名其妙地结冰」。'] },
  // ——— 晨光镇 · 磨坊主之家 ———
  { id: 'miller-oven', kind: 'examine', pages: ['石砌烤炉还温着。', '一股新烤面包的香味。'] },
  { id: 'miller-flour', kind: 'examine', pages: ['一袋袋刚磨好的面粉。', '袋子上印着风车标志：「晨光磨坊」。'] },
  { id: 'miller-shelf', kind: 'examine', pages: ['架子上摆着几罐蜂蜜和果酱。', '标签写着：「晨光丘陵 · 甜甜蜜」。'] },
  { id: 'miller-calendar', kind: 'examine', pages: ['墙上的日出日落表。', '「夏至：晨 4:58 · 昏 19:21」。晨光镇的人都按太阳作息。'] },
  // ——— 雪原镇 · 冰屋 ———
  { id: 'igloo-stove', kind: 'examine', pages: ['小铁炉烧得正旺，冰墙却一点也不化。', '……真是不可思议。'] },
  { id: 'igloo-carvings', kind: 'examine', pages: ['木架上摆着一排冰雕：鸟、狐狸，还有一只看不出是什么的大家伙。', '底座刻着：「冰川下的守护者」。'] },
  { id: 'igloo-ice-crystal', kind: 'examine', pages: ['一块冰晶，在灯下泛着淡淡的蓝光。', '据说是从冰川遗迹附近捡来的。'] },
  // ——— 云雀镇 · 滑翔俱乐部 ———
  { id: 'glider-trophies', kind: 'examine', pages: ['柜子里摆满了滑翔比赛的奖杯。', '最大的一座刻着：「翠澜杯 · 最远滑翔 · 2.4 km」。'] },
  { id: 'glider-wind-chart', kind: 'examine', pages: ['云雀镇风向图。', '「北崖午后起强劲上升气流，最适合滑翔。」', '「雷暴天禁止起飞！」'] },
  { id: 'glider-gear', kind: 'examine', pages: ['架子上挂着滑翔翼骨架、护目镜和风速计。', '标签：「会员专用」。'] },
];

export const THUNDER_LANDMARKS: InteractionDef[] = [
  { id: 'thunder-dock', kind: 'examine', range: 3.5, pages: ['雷鸣镇码头。', '「碧潮—雷鸣海域：渡轮停运中。」', '往西冲浪可以回到碧潮群岛的温泉乡。'] },
  { id: 'lark-dock', kind: 'examine', range: 3.5, pages: ['云雀镇码头。', '「北方航线：雷鸣—琉璃海域（海雾 + 礁石，暂未开放）」'] },
  {
    id: 'thunder-tower-sign',
    kind: 'examine',
    range: 3,
    pages: ['「雷鸣镇主避雷塔 · 高 30 米」', '「雷鸣台地一年有两百多天打雷。这座塔把雷电引入地下电池，点亮全镇的灯。」', '「雷暴时请勿靠近塔基！」'],
    night: ['「雷鸣镇主避雷塔 · 高 30 米」', '塔顶的放电球在夜色里一闪一闪。'],
  },
  { id: 'dawn-sundial-sign', kind: 'examine', range: 3, pages: ['「晨光日晷」', '「晨光镇是群岛上最早看见日出的地方。」', '晷针的影子正指向……'], night: ['「晨光日晷」', '夜里看不见影子。等明天太阳出来吧。'] },
  { id: 'lark-glide-deck', kind: 'examine', range: 4, pages: ['北崖滑翔台。', '脚下是七十多米高的悬崖，海风呼呼地往上吹。', '「滑翔需要俱乐部会员资格及飞行系宝可梦协助。」'] },
  { id: 'old-lighthouse', kind: 'examine', range: 5, pages: ['古灯塔。', '石砌的塔身被海风侵蚀得坑坑洼洼，灯室早就不亮了。', '门上挂着锁：「灯塔修复中」。'] },
  { id: 'frozen-lake', kind: 'examine', range: 6, pages: ['冰湖。', '湖面结着厚厚的冰，底下隐约有影子游过。', '冰面中央插着一根木桩，上面写着：「冰层下方有裂缝，勿近」。'] },
  { id: 'storm-observatory', kind: 'examine', range: 5, pages: ['雷云观测站。', '屋顶的风速计疯狂旋转着。', '门口贴着告示：「观测员外出采样中」。'] },
];
