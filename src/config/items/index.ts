/**
 * M1-18 · 重要物品与招式学习器（不在 PokeAPI 道具表中的物品）。
 * id 与任务奖励（config/quests）保持一致。
 */
import type { KeyItemDef } from '@/systems/items';
import moves from '@/config/data/moves.json';
import { TM_DEFS, tmItemId, tmLabel } from '@/config/tms';
import { BERRY_ITEMS } from '@/config/berries';
import { GATHER_ITEMS } from '@/config/gather/items';
import natures from '@/config/data/natures.json';
import { ALPHA_MATERIALS } from '@/config/alpha/materials';

interface NatureRow {
  id: string;
  name: { zh: string };
  plus: string | null;
  minus: string | null;
}
const STAT_SHORT: Record<string, string> = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };

/**
 * 计划文档 §9.5 · 性格薄荷（工坊 7 级配方，21 种）：有增减的 20 种性格 + 认真（无增减）。
 * 使用后宝可梦的性格变为对应性格（能力修正随之改变）。
 */
export const MINT_ITEMS: KeyItemDef[] = (natures as NatureRow[])
  .filter((n) => (n.plus && n.plus !== n.minus) || n.id === 'serious')
  .map((n) => ({
    id: `mint-${n.id}`,
    name: `${n.name.zh}薄荷`,
    desc: n.plus && n.plus !== n.minus ? `清香的薄荷叶。让宝可梦的性格变为「${n.name.zh}」（${STAT_SHORT[n.plus] ?? n.plus}↑ ${STAT_SHORT[n.minus ?? ''] ?? n.minus}↓）。` : `清香的薄荷叶。让宝可梦的性格变为「${n.name.zh}」（能力不增不减）。`,
    pocket: 'medicine' as const,
  }));

interface MoveRow {
  id: string;
  name: { zh: string };
  type: string;
  category: string;
  power: number | null;
}
const TYPE_ZH: Record<string, string> = { normal: '一般', fire: '火', water: '水', grass: '草', electric: '电', ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行', psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精' };
const MOVE_BY_ID = new Map((moves as MoveRow[]).map((m) => [m.id, m]));
const CATEGORY_ZH: Record<string, string> = { physical: '物理', special: '特殊', status: '变化' };

/** 招式学习器道具（由 config/tms 生成；可以反复使用） */
export const TM_ITEMS: KeyItemDef[] = TM_DEFS.map((t) => {
  const m = MOVE_BY_ID.get(t.move);
  const zh = m?.name.zh ?? t.move;
  const power = m?.power ? `威力 ${m.power}` : '';
  return {
    id: tmItemId(t.move),
    name: `招式学习器 ${tmLabel(t.no)} ${zh}`,
    desc: `让宝可梦学会「${zh}」（${CATEGORY_ZH[m?.category ?? ''] ?? ''}${power ? ` · ${power}` : ''}）。${t.universal ? '几乎所有宝可梦都能学会。' : ''}可以反复使用。`,
    pocket: 'tms',
    move: t.move,
  };
});

export const KEY_ITEMS: KeyItemDef[] = [
  { id: 'old-rod', name: '破旧钓竿', desc: '又旧又破的钓竿。面朝水面按钓鱼键就能垂钓。', pocket: 'key' },
  { id: 'good-rod', name: '好钓竿', desc: '渔夫老陈送的钓竿，能钓到更多种类的宝可梦。', pocket: 'key' },
  { id: 'super-rod', name: '厉害钓竿', desc: '钓鱼大赛冠军的奖品，最高级的钓竿。', pocket: 'key' },
  { id: 'bicycle', name: '自行车', desc: '萌芽镇友好商店出售的折叠自行车，翠澜蓝车架，带车篮和车铃。在户外按骑乘键（C）上车 / 下车，速度比奔跑快得多。', pocket: 'key' },
  { id: 'ferry-pass', name: '渡船船票', desc: '萌芽群岛与碧潮群岛之间的渡船船票，可以反复使用。', pocket: 'key' },
  { id: 'fisher-tackle', name: '钓具箱', desc: '渔民阿海被海浪卷走的钓具箱，是他爷爷传下来的。', pocket: 'key' },
  { id: 'diver-compass', name: '旧潜水罗盘', desc: '老潜水员深叔年轻时用的黄铜潜水罗盘，表盘背面刻着一道浪纹。据说在深海里也能指向神殿。', pocket: 'key' },
  { id: 'moon-herb', name: '翠澜药草', desc: '生长在翠澜湖畔的药草，蒲婆婆需要它。', pocket: 'key' },
  // 个体值洗练道具（濒死也能用；王冠只升不降，洗练石重新随机）
  { id: 'reroll-stone', name: '洗练石', desc: '蕴含奇妙能量的石头。让1只宝可梦的6项个体值全部重新随机，可能变好也可能变差。', pocket: 'medicine' },
  { id: 'focus-reroll-stone', name: '单属性洗练石', desc: '打磨过的洗练石。让1只宝可梦指定的1项个体值重新随机。', pocket: 'medicine' },
  { id: 'bottle-cap', name: '银王冠', desc: '闪闪发亮的银色王冠。让1只宝可梦指定的1项个体值变为最棒（31）。', pocket: 'medicine' },
  { id: 'gold-bottle-cap', name: '金王冠', desc: '极为稀有的金色王冠。让1只宝可梦的6项个体值全部变为最棒（31）。', pocket: 'medicine' },
  // 头目通用素材：击败或捕获巢穴头目获得，用于工坊合成薄荷
  { id: 'alpha-scale', name: '头目之鳞', desc: '头目宝可梦身上剥落的坚硬鳞片，散发着强大的气息。可在宝可梦中心的工坊里配合 2 颗稀有树果合成薄荷（工坊 7 级解锁）。', pocket: 'treasure' },
  // 想起招式的费用（计划文档 §6）：野外战斗稀有掉落、头目奖励
  { id: 'heart-scale', name: '心之鳞片', desc: '漂亮的心形鳞片，非常稀有。把它交给「想起招式的人」，就能让宝可梦想起一个遗忘的招式。', pocket: 'treasure' },
  ...TM_ITEMS,
  // 计划文档 §9：树果（24 种中不在道具表里的 21 种）与采集素材
  ...BERRY_ITEMS,
  ...GATHER_ITEMS,
  ...MINT_ITEMS,
  // 头目专属素材：各巢穴头目各自掉落，喂给宝可梦有几率领悟头目招式
  ...ALPHA_MATERIALS.map((m) => ({
    id: m.id,
    name: m.name,
    desc: `${m.desc}喂给具备${TYPE_ZH[MOVE_BY_ID.get(m.move)?.type ?? ''] ?? ''}属性、且能用招式学习器学会该招的宝可梦，有几率领悟头目招式「${MOVE_BY_ID.get(m.move)?.name.zh ?? m.move}」（失败越多几率越高）。`,
    pocket: 'treasure' as const,
  })),
  // M2 · 碧潮群岛剧情道具
  { id: 'anomaly-shard-red', name: '异变碎片·赤', desc: '矿石镇矿洞深处找到的赤红色碎片，摸上去微微发烫。和群岛的异变有关。', pocket: 'key' },
  { id: 'anomaly-shard-orange', name: '异变碎片·橙', desc: '火山镇地热异常的源头找到的橙色碎片，内部像有岩浆在流动。', pocket: 'key' },
  { id: 'anomaly-shard-purple', name: '异变碎片·紫', desc: '原初守护者守护的紫色碎片，和遗迹外的紫色屏障是同一种光。', pocket: 'key' },
  { id: 'anomaly-shard-blue', name: '异变碎片·蓝', desc: '冰川遗迹圣坛的寒冰里封存的蓝色碎片，握在手里却一点也不冷。', pocket: 'key' },
  { id: 'anomaly-shard-ghost', name: '异变碎片·幽', desc: '暗影洞窟祭坛里取出的幽紫色碎片。贴近耳边，能听见很多人在远处低语。', pocket: 'key' },
  { id: 'anomaly-shard-memory', name: '异变碎片·回忆', desc: '三位异变幸存者的讲述凝成的记忆。碎片里映出很久以前的群岛。', pocket: 'key' },
  { id: 'ancient-tablet', name: '古代石板', desc: '矿洞里挖出的石板，刻着群岛古代文明的文字。木兰博士一定很想看看。', pocket: 'key' },
  { id: 'volcano-egg', name: '火山口的蛋', desc: '在火山洞深处找到的温热的蛋。带去温泉乡的培育屋，让温泉的热气孵化它。', pocket: 'key' },
  { id: 'mine-pickaxe', name: '矿工的镐', desc: '被困矿工掉落的镐头，柄上刻着「石根」。', pocket: 'key' },
  // M3 · 雷鸣 / 琉璃群岛支线奖励（PokeAPI 没有的自定义道具）
  { id: 'flying-stone', name: '飞之石', desc: '云海邮差送来的奇妙石头，轻得像一团云，握在手里仿佛要飘起来。目前还没有发现会对它起反应的宝可梦。', pocket: 'evolution' },
  { id: 'spirit-veil', name: '灵界之纱', desc: '永夜之城的巫女织成的薄纱，能隐约看见另一边的世界。携带后幽灵属性的招式威力提高。', pocket: 'held' },
  { id: 'seer-eye', name: '先知之眼', desc: '幻影镇先知传下的水晶眼，凝视它能看见片刻之后的未来。携带后超能力属性的招式威力提高。', pocket: 'held' },
  { id: 'ancient-amulet', name: '古代护符', desc: '海底神殿里沉睡的护符，刻着古代文明的浪纹。携带后水属性的招式威力提高。', pocket: 'held' },
  { id: 'golden-watering-can', name: '金色喷壶', desc: '培育家 9 级时得到的金色喷壶。浇一次水，当前阶段和下一个阶段都算浇过。', pocket: 'key' },
];

export const KEY_ITEM_BY_ID: ReadonlyMap<string, KeyItemDef> = new Map(KEY_ITEMS.map((k) => [k.id, k]));
