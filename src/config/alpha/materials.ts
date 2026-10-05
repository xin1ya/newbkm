/**
 * 头目专属素材（领悟头目招式）：每个巢穴头目掉落各自的素材。
 * 在背包「素材」口袋对宝可梦使用（喂食）：宝可梦需具备招式的属性，且能用招式学习器学会该招式（同招式学习器兼容规则）；有几率领悟该头目招式，
 * 失败次数累积会提高下一次的几率（保底），素材无论成败都会消耗。
 */
export interface AlphaMaterialDef {
  /** 道具 id */
  id: string;
  /** 掉落该素材的巢穴 */
  den: string;
  name: string;
  desc: string;
  /** 领悟的头目招式 */
  move: string;
  /** 图标主色 */
  color: string;
}

/** 首次喂食的领悟几率；每失败一次 +INSIGHT_STEP，4 次失败后必定领悟 */
export const INSIGHT_BASE = 0.3;
export const INSIGHT_STEP = 0.2;

export const ALPHA_MATERIALS: AlphaMaterialDef[] = [
  { id: 'alpha-mat-meadow', den: 'den-meadow', name: '烈风翎羽', desc: '草原大巢头目比比鸟脱落的翎羽，仍带着劲风。', move: 'fly', color: '#d9a35a' },
  { id: 'alpha-mat-lakeside', den: 'den-lakeside', name: '怒涛逆鳞', desc: '湖东浅滩头目暴鲤龙的逆鳞，摸上去冰冷而沉重。', move: 'waterfall', color: '#3a7fd0' },
  { id: 'alpha-mat-cliffs', den: 'den-cliffs', name: '海崖风羽', desc: '海崖之巅头目大嘴鸥的飞羽，闻得到海风的咸味。', move: 'hurricane', color: '#8fd0e8' },
  { id: 'alpha-mat-forest', den: 'den-forest', name: '幻影黑鬃', desc: '森林石圈头目索罗亚克的鬃毛，看久了会觉得它在晃动。', move: 'foul-play', color: '#6a2a4a' },
  { id: 'alpha-mat-highlands', den: 'den-highlands', name: '石冢核晶', desc: '高地石冢头目体内凝结的晶核，坚硬得敲不出痕迹。', move: 'stone-edge', color: '#9a8a6a' },
  { id: 'alpha-mat-delta', den: 'den-delta', name: '巨钳甲片', desc: '河口泥滩头目巨钳蟹蜕下的钳甲碎片。', move: 'liquidation', color: '#d0503a' },
  // M3-28 雷鸣 / 琉璃头目
  { id: 'alpha-mat-thunder-plain', den: 'den-thunder-plain', name: '雷鸣金鬃', desc: '平原头目伦琴猫的金色鬃毛，梳一下就噼啪作响。', move: 'wild-charge', color: '#f2c230' },
  { id: 'alpha-mat-storm-highland', den: 'den-storm-highland', name: '避雷绒球', desc: '风暴高地头目电龙尾巴上脱落的发光绒球。', move: 'thunder', color: '#f6d84a' },
  { id: 'alpha-mat-dawn-hills', den: 'den-dawn-hills', name: '强磁核心', desc: '头目自爆磁怪身上掉落的磁核，会把铁钉都吸过来。', move: 'thunderbolt', color: '#8a9ab5' },
  { id: 'alpha-mat-lighthouse-cape', den: 'den-lighthouse-cape', name: '冰礁獠牙', desc: '冰礁头目帝牙海狮换下的獠牙碎片，透着寒气。', move: 'ice-beam', color: '#9ad0f0' },
  { id: 'alpha-mat-glacier', den: 'den-glacier', name: '猛犸冰鬃', desc: '冰川头目象牙猪长鬃里结出的冰柱。', move: 'icicle-spear', color: '#7a5a3a' },
  { id: 'alpha-mat-frost-road', den: 'den-frost-road', name: '雪松冰晶', desc: '霜冻之路头目暴雪王身上抖落的冰晶，永不融化。', move: 'blizzard', color: '#d8eef8' },
  { id: 'alpha-mat-cloud-cliffs', den: 'den-cloud-cliffs', name: '冰刃尖爪', desc: '云崖头目玛狃拉在冰壁上留下的断爪。', move: 'triple-axel', color: '#c83a5a' },
  { id: 'alpha-mat-stone-forest', den: 'den-stone-forest', name: '磁极鼻石', desc: '石林头目大朝北鼻的小鼻子碎片，始终指向北方。', move: 'power-gem', color: '#5a6a8a' },
  { id: 'alpha-mat-ghost-marsh', den: 'den-ghost-marsh', name: '冥界触线', desc: '沼泽头目黑夜魔灵头顶天线上剥落的触线，能收到奇怪的信号。', move: 'poltergeist', color: '#4a4a5a' },
  { id: 'alpha-mat-shadow-wood', den: 'den-shadow-wood', name: '魔女紫帽', desc: '暗影林头目梦妖魔掉下的帽檐碎片，传来低声咒语。', move: 'shadow-ball', color: '#7a4ab0' },
  { id: 'alpha-mat-mirage-dunes', den: 'den-mirage-dunes', name: '念力汤匙', desc: '沙丘头目胡地遗落的汤匙，自己就会弯起来。', move: 'psyshock', color: '#e0b040' },
  { id: 'alpha-mat-glass-coast', den: 'den-glass-coast', name: '龙王海鳞', desc: '潮洞头目刺龙王的海蓝色鳞片。', move: 'dragon-pulse', color: '#3a8ad0' },
  { id: 'alpha-mat-victory-mountain', den: 'den-victory-mountain', name: '铠甲岩片', desc: '岩冢头目班基拉斯铠甲上剥落的岩片，坚硬无比。', move: 'stone-edge', color: '#6a8a5a' },
  { id: 'alpha-mat-league-plateau', den: 'den-league-plateau', name: '音速鳍刃', desc: '高原头目烈咬陆鲨背鳍上的刀刃状碎片。', move: 'outrage', color: '#3a5a9a' },
];

export const ALPHA_MATERIAL_BY_ID = new Map(ALPHA_MATERIALS.map((m) => [m.id, m]));
export const ALPHA_MATERIAL_BY_DEN = new Map(ALPHA_MATERIALS.map((m) => [m.den, m]));

/** 第 fails+1 次喂食的领悟几率 */
export function insightChance(fails: number): number {
  return Math.min(1, INSIGHT_BASE + INSIGHT_STEP * Math.max(0, fails));
}
