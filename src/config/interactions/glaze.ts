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
];
