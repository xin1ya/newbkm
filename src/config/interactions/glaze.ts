/**
 * M3-11 · 琉璃群岛的家具与地标互动（家具 id 来自 config/interiors/glaze.ts 的 `interact`，地标 id 来自 islands/glaze.ts 的 POI）。
 */
import type { InteractionDef } from '@/systems/interaction';

export const GLAZE_FURNITURE: InteractionDef[] = [
  // ——— 幻影镇 · 先知之家 ———
  { id: 'seer-crystal-ball', kind: 'examine', pages: ['紫色的水晶球里，雾气缓缓旋转。', '……一瞬间，好像看见了沉在海底的门。'] },
  { id: 'seer-books', kind: 'examine', pages: ['《蜃景志》《月相与超能力》《翠澜古代海民考》……', '书脊都被翻得发白了。'] },
  { id: 'seer-jars', kind: 'examine', pages: ['一排玻璃罐，装着不同颜色的沙子。', '标签：「正午的沙」「午夜的沙」「海雾里的沙」。'] },
  { id: 'seer-star-chart', kind: 'examine', pages: ['一张手绘星图。', '月亮的轨迹旁写着：「月行至西口，塔现」。'] },
  // ——— 幽冥镇 · 守墓人之家 ———
  { id: 'gravekeeper-tools', kind: 'examine', pages: ['铁锹、刷子、一罐刻碑用的墨。', '工具都磨得发亮。'] },
  { id: 'gravekeeper-ledger', kind: 'examine', pages: ['厚厚的墓园名册。', '最后几页的名字栏是空的，只画着小小的灵火符号。'] },
  { id: 'gravekeeper-lantern', kind: 'examine', pages: ['一盏青色的提灯。', '里面没有灯芯，火苗却一直在轻轻摇晃。'] },
  { id: 'gravekeeper-map', kind: 'examine', pages: ['手绘的墓园地图，每个格子都标着编号。', '角落写着：「零时至三时，勿入。」'] },
  // ——— 幽冥镇 · 灵堂 ———
  { id: 'ossuary-altar', kind: 'examine', pages: ['祭坛上的徽记泛着淡紫色的光。', '刻文：「魂归琉璃，潮去潮来」。'] },
  { id: 'ossuary-niches', kind: 'examine', pages: ['一排排石龛，每格都放着小小的骨灰坛。', '有些坛子前摆着树果——是宝可梦的。'] },
  { id: 'ossuary-register', kind: 'examine', pages: ['访客登记簿。', '最新一行的字迹很工整：「幽魄 —— 本月祈祷完毕」。'] },
];

export const GLAZE_LANDMARKS: InteractionDef[] = [
  { id: 'mirage-dock', kind: 'examine', range: 3.5, pages: ['幻影镇码头。', '「南方航线：雷鸣—琉璃海域。终年海雾，礁石迷宫——请认准缺口两侧的红绿浮标。」', '一直往南冲浪就能回到雷鸣群岛的云雀镇。'] },
  {
    id: 'mirage-obelisk',
    kind: 'examine',
    range: 3,
    pages: ['预言石柱。', '方尖碑四面刻满了看不懂的符文。', '底座上有一行能读懂的字：「日中宫起，月出塔现，昼夜之间，真伪相换」。'],
    night: ['预言石柱。', '符文在夜色里发出淡紫色的光，好像在一明一暗地呼吸。', '「日中宫起，月出塔现，昼夜之间，真伪相换」。'],
  },
  {
    id: 'mirage-palace',
    kind: 'examine',
    range: 4,
    pages: ['「蜃楼宫观景处」', '「每天上午十点至下午四点，东面沙丘上会浮现宫殿与双塔。」', '「本建筑为海市蜃楼，无法进入。请勿在沙丘上追赶。」'],
    night: ['「蜃楼宫观景处」', '夜里的沙丘上什么也没有，只有风吹沙的声音。', '「蜃楼宫：每天上午十点至下午四点出现。」'],
  },
  {
    id: 'mirage-moon-tower',
    kind: 'examine',
    range: 4,
    pages: ['「月影塔遗址」', '这里只有一片平整的沙地和一根小石柱。', '「月影塔：每晚八点至凌晨四点出现。」'],
    night: ['「月影塔遗址」', '一座发光的白塔就立在眼前，塔顶悬着一轮满月。', '伸手摸了摸塔身——冰凉、坚硬，是真的。'],
  },
  {
    id: 'ghost-cemetery',
    kind: 'examine',
    range: 5,
    pages: ['幽冥墓园。', '一排排石墓碑在浓雾里若隐若现。', '入口的牌子：「午夜零时至三时，请勿入内。」'],
    night: ['幽冥墓园。', '雾里飘着几团青色的鬼火，绕着墓碑慢慢打转。', '午夜过后，鬼火会越聚越多……'],
  },
  {
    id: 'ghost-bell-tower',
    kind: 'examine',
    range: 4,
    pages: ['幽冥钟楼。', '钟楼的门锁着，拉钟的绳子垂在铁栅后面。', '「此钟每逢午夜自鸣，请勿惊慌。」'],
    night: ['幽冥钟楼。', '钟身微微发着青光，仿佛刚刚有谁敲过。', '「此钟每逢午夜自鸣，请勿惊慌。」'],
  },
  { id: 'ghost-noticeboard', kind: 'examine', range: 3, pages: ['幽冥镇告示板。', '「幽冥道馆：馆主幽魄 —— 幽灵属性。」', '「夜间请沿灵火灯笼行走，勿入沼泽。」', '「墓园午夜（0–3 时）谢绝访客。——守墓人」'] },
];
