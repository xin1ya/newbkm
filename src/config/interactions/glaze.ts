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
  // ——— 琉璃镇 · 玻璃工坊 ———
  { id: 'glassworks-furnace', kind: 'examine', pages: ['熔炉里的玻璃液像蜂蜜一样发着橙光。', '热浪扑面而来。'] },
  { id: 'glassworks-bench', kind: 'examine', pages: ['吹管、夹钳、木模……', '桌上放着一只刚成形的蓝色玻璃浮球。'] },
  { id: 'glassworks-shelf', kind: 'examine', pages: ['一排排玻璃风铃和瓶中海。', '瓶子里的琉璃沙随着倾斜慢慢流动，像潮水。'] },
  { id: 'glassworks-aquarium', kind: 'examine', pages: ['用整块玻璃吹成的圆形鱼缸。', '几只小宝可梦在里面游来游去。'] },
  { id: 'glassworks-counter', kind: 'examine', pages: ['柜台上的价目牌：「风铃 · 瓶中海 · 玻璃浮球 —— 本店手作」。'] },
  { id: 'glassworks-sand', kind: 'examine', pages: ['一箱洁白的细沙。', '标签：「东岸白沙 —— 吹玻璃专用」。'] },
  // ——— 琉璃镇 · 老潜水员之家 ———
  { id: 'diver-helmet', kind: 'examine', pages: ['一顶黄铜潜水头盔，面窗上还留着海盐的痕迹。'] },
  { id: 'diver-shells', kind: 'examine', pages: ['贝壳、珊瑚枝、一块刻着浪纹的碎石片。', '石片上的纹样，和石堤尽头那座门楼一模一样。'] },
  { id: 'diver-chart', kind: 'examine', pages: ['手绘的东海岸海图。', '深水暗区的中央画了一个圈，旁边写着：「门 · 约 30 米」。'] },
  { id: 'diver-aquarium', kind: 'examine', pages: ['小水缸里养着几株海草和一只寄居蟹。'] },
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
  { id: 'glaze-noticeboard', kind: 'examine', range: 3, pages: ['琉璃镇告示板。', '「琉璃道馆：馆主琉璃 —— 水属性。」', '「东岸深水区水深莫测，冲浪请勿越过浮标。」', '「玻璃工坊：手作风铃、瓶中海，欢迎选购。」'] },
  {
    id: 'glaze-fountain',
    kind: 'examine',
    range: 4,
    pages: ['水晶喷泉。', '喷泉四周立着几簇天然玻璃晶柱，水花打在上面，折出细碎的彩光。'],
    night: ['水晶喷泉。', '夜里，晶柱里透出淡淡的蓝光，水声比白天更清楚。'],
  },
  {
    id: 'glaze-lighthouse',
    kind: 'examine',
    range: 4,
    pages: ['琉璃灯塔。', '白色塔身，蓝色塔顶。', '「本灯塔照射东岸深水区。夜间请勿在暗区冲浪。」'],
    night: ['琉璃灯塔。', '灯光一圈圈扫过东边的深海。', '……有一瞬间，海面下好像也亮了一下。'],
  },
  {
    id: 'glaze-temple-gate',
    kind: 'examine',
    range: 5,
    pages: ['海底神殿之门。', '两根爬满珊瑚的石柱撑着弧形门楣，中央嵌着一颗深蓝色的宝珠。', '门洞被一层蓝光封着，伸手碰上去——冰凉，推不动。', '门后的石阶一级级没入海里。要下去，需要会「潜水」的宝可梦。'],
  },
  {
    id: 'glaze-temple-stele',
    kind: 'examine',
    range: 3,
    pages: ['神殿石碑。', '碑上的古文字已经磨得很浅了。', '能读懂的只有一句：「潮落之门，唯与海同息者可入」。'],
  },
];
