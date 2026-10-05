/**
 * M3-23 · 洞窟 / 塔的家具互动（id 来自 config/interiors/dungeons.ts 的 `interact`）。
 * 晶核 / 灯室透镜 / 冰封圣坛 / 暗影祭坛是后续主线与支线（M3-24~27）的剧情锚点，目前只有调查文本。
 */
import type { InteractionDef } from '@/systems/interaction';

export const DUNGEON_FURNITURE: InteractionDef[] = [
  // ——— 晶石洞窟 ———
  { id: 'cc-sign-entrance', kind: 'examine', pages: ['「晶石洞窟」', '「洞内晶石带电，请勿用手触摸。」', '「北：晶石回廊 → 晶洞深处」'] },
  {
    id: 'cc-crate-entrance',
    kind: 'examine',
    pages: ['矿工留下的工具箱，里面压着一块会噼啪作响的石头。'],
    effects: [{ kind: 'give-item', item: 'thunder-stone', qty: 1, flag: 'cc-crate-entrance-taken', itemName: '雷之石' }],
    byFlag: [{ when: 'cc-crate-entrance-taken', pages: ['工具箱已经空了。'] }],
  },
  {
    id: 'cc-plate-sign',
    kind: 'examine',
    pages: ['「晶石回廊」', '「两块晶石压力板同时压上重物，栅栏便会沉入地下。」', '「巨石推错了也不要紧——离开回廊再回来，石头会回到原位。」'],
  },
  {
    id: 'cc-crystal-core',
    kind: 'examine',
    label: '调查晶核',
    pages: ['一人多高的巨型晶簇，内部有电光在缓缓流动。', '把手靠近，汗毛一根根竖了起来……', '电光的节奏忽快忽慢，像是在回应高原上空的雷声。'],
  },
  { id: 'cc-survey-machine', kind: 'examine', pages: ['研究员架设的观测仪，屏幕上的波形乱成一团。', '「放电频率异常：与雷云异变同步。」'] },
  {
    id: 'cc-crate-geode',
    kind: 'examine',
    pages: ['研究员的补给箱，侧面贴着「备用」的标签。'],
    effects: [{ kind: 'give-item', item: 'magnet', qty: 1, flag: 'cc-crate-geode-taken', itemName: '磁铁' }],
    byFlag: [{ when: 'cc-crate-geode-taken', pages: ['补给箱已经空了。'] }],
  },
  // ——— 古灯塔 ———
  {
    id: 'lh-keeper-log',
    kind: 'examine',
    label: '翻阅日志',
    pages: ['守塔人的值班日志，最后一页写着：', '「灯油还够，可透镜一到半夜就发出不属于灯火的绿光。」', '「楼上有脚步声。我决定暂时离开。灯会再亮的，等对的人来。」'],
  },
  {
    id: 'lh-crate-1f',
    kind: 'examine',
    pages: ['修复队的物资箱。'],
    effects: [{ kind: 'give-item', item: 'hyper-potion', qty: 2, flag: 'lh-crate-1f-taken', itemName: '厉害伤药' }],
    byFlag: [{ when: 'lh-crate-1f-taken', pages: ['物资箱已经空了。'] }],
  },
  { id: 'lh-window', kind: 'examine', pages: ['窗外是灰蓝色的海，浪头一个接一个拍在礁石上。', '远处的航道上，一艘船也没有。'] },
  { id: 'lh-mural-2f', kind: 'examine', pages: ['墙上褪色的壁画：一座灯塔照亮海面，海里有巨大的影子在游动。', '画角写着：「灯光为航船引路，也为海中的守护者引路」。'] },
  { id: 'lh-gearbox', kind: 'examine', pages: ['驱动透镜旋转的齿轮箱，锈得转不动了。', '齿轮上缠着几缕淡绿色的、像雾一样的东西……一碰就散了。'] },
  {
    id: 'lh-crate-3f',
    kind: 'examine',
    pages: ['角落里的旧木箱，里面躺着一张写满字的符纸。'],
    effects: [{ kind: 'give-item', item: 'spell-tag', qty: 1, flag: 'lh-crate-3f-taken', itemName: '诅咒之符' }],
    byFlag: [{ when: 'lh-crate-3f-taken', pages: ['木箱已经空了。'] }],
  },
  {
    id: 'lh-lamp',
    kind: 'examine',
    label: '调查透镜',
    pages: ['灯室中央巨大的菲涅耳透镜，蒙着厚厚的灰。', '灯芯早就熄了，透镜深处却残留着一点幽幽的绿光。', '……仿佛有什么东西，住在光里。'],
  },
  // ——— 冰川遗迹 ———
  { id: 'gr-sign-hall', kind: 'examine', pages: ['「冰川遗迹 · 雷鸣大学考古队」', '「遗迹内部严禁明火。」', '「北：石碑之间 → 冰封圣坛」'] },
  {
    id: 'gr-crate-ice',
    kind: 'examine',
    pages: ['冰封的侧室里，一只古代祭具箱。箱子里的冰怎么也不会融化。'],
    effects: [{ kind: 'give-item', item: 'never-melt-ice', qty: 1, flag: 'gr-crate-ice-taken', itemName: '不融冰' }],
    byFlag: [{ when: 'gr-crate-ice-taken', pages: ['祭具箱已经空了。'] }],
  },
  { id: 'gr-boulder-sign', kind: 'examine', pages: ['「石碑之间」', '「冰裂缝的缺口下有两个冰洞。把巨石推进去填平，便可过谷。」', '「推错了，离开再回来，石头会回到原位。」'] },
  { id: 'gr-tablet-1', kind: 'examine', label: '阅读石碑', pages: ['石碑一：', '「天降异光，碎为数晶。其一落于冰原，封于此地。」'] },
  { id: 'gr-tablet-2', kind: 'examine', label: '阅读石碑', pages: ['石碑二：', '「冰之试炼：心如止水者，冰为之开。」'] },
  { id: 'gr-tablet-3', kind: 'examine', label: '阅读石碑', pages: ['石碑三：', '「携异变之晶者至此，圣坛之冰自会消融。」', '碑文的最后一行被冰覆盖着，看不清楚。'] },
  {
    id: 'gr-altar',
    kind: 'examine',
    label: '调查圣坛',
    pages: ['圣坛被一整块透明的寒冰封住。', '冰里隐约能看到一团蓝色的光，在缓慢地脉动。', '用手敲了敲……冰坚硬得纹丝不动。'],
  },
  {
    id: 'gr-crate-sanctum',
    kind: 'examine',
    pages: ['考古队留下的保温箱。'],
    effects: [{ kind: 'give-item', item: 'full-heal', qty: 2, flag: 'gr-crate-sanctum-taken', itemName: '万灵药' }],
    byFlag: [{ when: 'gr-crate-sanctum-taken', pages: ['保温箱已经空了。'] }],
  },
  // ——— 暗影洞窟 ———
  { id: 'sc-sign-mouth', kind: 'examine', pages: ['「暗影洞窟」', '「洞内野生宝可梦凶猛，非熟练训练家请勿深入。」', '——幽冥镇 守洞人'] },
  {
    id: 'sc-crate-mouth',
    kind: 'examine',
    pages: ['探险者丢下的背包。'],
    effects: [{ kind: 'give-item', item: 'revive', qty: 2, flag: 'sc-crate-mouth-taken', itemName: '活力碎片' }],
    byFlag: [{ when: 'sc-crate-mouth-taken', pages: ['背包已经空了。'] }],
  },
  {
    id: 'sc-crate-maze',
    kind: 'examine',
    pages: ['黑暗角落里的木箱，摸上去冰凉。'],
    effects: [{ kind: 'give-item', item: 'dusk-ball', qty: 5, flag: 'sc-crate-maze-taken', itemName: '黑暗球' }],
    byFlag: [{ when: 'sc-crate-maze-taken', pages: ['木箱已经空了。'] }],
  },
  {
    id: 'sc-shrine',
    kind: 'examine',
    label: '调查祭坛',
    pages: ['断裂的石环中央，嵌着一块紫色的晶石。', '耳边响起若有若无的低吟……像很多人在远处说话。', '晶石的光，和异变碎片的光一模一样。'],
  },
  {
    id: 'sc-crate-abyss',
    kind: 'examine',
    pages: ['祭坛旁的供品箱，里面有一副漆黑的眼镜。'],
    effects: [{ kind: 'give-item', item: 'black-glasses', qty: 1, flag: 'sc-crate-abyss-taken', itemName: '黑色眼镜' }],
    byFlag: [{ when: 'sc-crate-abyss-taken', pages: ['供品箱已经空了。'] }],
  },
];
