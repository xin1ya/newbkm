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
  // ——— M3-15 · 道馆须知 / 配电柜 ———
  { id: 'gym-thunder-rules', kind: 'examine', pages: ['「雷鸣道馆 · 挑战须知」', '一、入口拉杆：东道 / 西道二选一通电。', '二、中道侧门：东、西两道拉杆同时接通方可开启。', '三、终点电栅：与西道拉杆联动。', '——馆主 雷霆'] },
  { id: 'gym-thunder-panel', kind: 'examine', pages: ['配电柜的仪表盘上，三根指针随着拉杆跳动。', '旁边贴着线路图：A → 东 / 西；B + C → 中；C → 终点。'] },
  { id: 'gym-dawn-rules', kind: 'examine', pages: ['「晨光道馆 · 挑战须知」', '日光墙：白昼凝聚，黑夜消散。', '影墙：黑夜凝聚，白昼消散。', '馆内日晷可拨动昼夜。进门时，昼夜与外界一致。', '——馆主 晨辉'] },
  { id: 'gym-snow-rules', kind: 'examine', pages: ['「雪原道馆 · 挑战须知」', '冰面上无法停步：会一直滑到撞上冰块为止。', '滑错了请回到入口重来。', '——馆主 霜凝'] },
  { id: 'gym-lark-rules', kind: 'examine', pages: ['「云雀道馆 · 挑战须知」', '入口大风扇：吹向西台或东台。', '中台风扇驱动西桥，东台风扇驱动东桥。', '终点长桥：西风停、东风起时方可通行。', '——馆主 云翎'] },
];

export const THUNDER_LANDMARKS: InteractionDef[] = [
  {
    id: 'glacier-ledge-cache',
    kind: 'examine',
    range: 2.6,
    pages: ['冰岩台顶上，几根冰晶里封着淡淡的蓝光。', '冰晶中间压着一只古代石匣，匣盖上刻着和冰川遗迹石碑一样的纹样。', '……匣子里有一块怎么也不会融化的冰。'],
    effects: [{ kind: 'give-item', item: 'never-melt-ice', qty: 1, flag: 'glacier-ledge-cache-taken', itemName: '不融冰' }],
    after: ['冰晶里的蓝光一闪一闪，像是在回应遗迹深处的什么东西。'],
    byFlag: [{ when: 'glacier-ledge-cache-taken', pages: ['石匣已经空了。', '冰晶里的蓝光还在一闪一闪……冰川遗迹深处，似乎藏着更多秘密。'] }],
  },
  { id: 'thunder-dock', kind: 'examine', range: 3.5, pages: ['雷鸣镇码头。', '「碧潮—雷鸣海域：渡轮停运中。」', '往西冲浪可以回到碧潮群岛的温泉乡。'] },
  { id: 'lark-dock', kind: 'examine', range: 3.5, pages: ['云雀镇码头。', '「北方航线：雷鸣—琉璃海域。终年海雾，礁石迷宫——请认准缺口两侧的红绿浮标。」', '一直往北就是琉璃群岛的幻影镇。'], byFlag: [{ when: '!glaze-route-open', pages: ['云雀镇码头。', '「北方航线：雷鸣—琉璃海域（海雾 + 礁石，暂未开放）」'] }] },
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
