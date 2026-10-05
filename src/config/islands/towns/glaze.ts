/**
 * M3-11 ~ M3-14 · 琉璃群岛城镇（手工布局）。
 *
 * - 幻影镇（南岸·沙丘台地 6 m）：海市蜃楼之城。白灰泥穹顶屋、马蹄拱城门、宣礼塔式蜃楼塔；
 *   超能系道馆「幻月」坐在镇北的广场尽头。部分建筑随时间出现 / 消失（PropInstance.hours）：
 *     · 白日市集（7–18 时）：道馆前广场的布篷摊位，入夜收摊后整片消失；
 *     · 月夜集市（19–3 时）：码头路口的灯笼夜市，只在夜里出现；
 *     · 月影塔（20–4 时）：镇西口外一座发光的白塔，天亮就不见了（实体，可以绕着走）；
 *     · 蜃楼宫（10–16 时，幻象）：东面沙丘上浮现的宫殿与双塔，半透明闪烁，走过去会穿过去。
 *   码头在镇南，栈桥伸进雷鸣—琉璃海域的礁石迷宫北口。
 *
 * - 幽冥镇（西·沼泽边 3.8 m，常夜雾）：石墓屋与灵堂的小镇。暗石墙、陡板岩顶、冷光尖窗，街边是歪斜的幽灯；
 *   镇南是沼泽古墓园（铁栅围起的墓碑群 + 鬼火），零点到三点墓园里的鬼火会多出一倍（分时摆放物）；
 *   钟楼与灵堂在南街两侧；西边沼泽水塘上有两座高脚屋。幽灵系道馆「幽魄」在主街北侧。
 *
 * - 琉璃镇（东岸·台地 7 m）：玻璃海岸上的港镇。珊瑚白灰泥墙、海玻璃瓦四坡顶、圆形彩玻舷窗；
 *   主街 z = 152 东接下坡路到琉璃沙滩，码头栈桥伸进东海；水系道馆「琉璃」在主街北侧（环形水渠 + 玻璃穹顶）。
 *   镇南是水晶喷泉广场；玻璃工坊在主街南侧。沙滩北头立着灯塔；
 *   海底神殿之门：沙滩外一条长石堤通向海中石台上的古门楼（门洞封印，M3-18 潜水开放），门外即东岸深水暗区。
 *
 * - 彩幽市（北·联盟高原 96 m）：精灵联盟门前的花之都。白大理石宅邸（四柱门廊、屋顶花园），十字大道交汇处是彩幽喷泉广场；
 *   南口接冠军之路北洞口，北端「冠军大道」两侧立着历代冠军星像，尽头是精灵联盟大门（白金凯旋门，11 枚徽章浮雕）。
 *   宝可梦中心 / 商店夹着南段大道；训练家旅馆与花店夹着北段大道。
 *
 * 门口坐标与 glaze.ts 的 POI 一一对应（atDoor 反推建筑中心；道馆 = 门口沿朝向后退 w/2 + 1）。
 */
import type { PropInstance, TownLayout, Vec2, Vec3 } from '../types';
import { FACE, PI, atDoor, deck, fence, lamps, prop, trees } from './helpers';

function gymAt(ref: string, door: Vec2, yaw: number, w: number, h: number, variant: string): PropInstance {
  const back = w / 2 + 1;
  return { type: 'gym', ref, position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back], yaw, size: [w, h, w], variant };
}
const house = (door: Vec2, yaw: number, size: Vec3, color: string, dome: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant: 'mirage', color, roof: dome, seed, accent: '#3f7a8a', ...extra });
const palms = (list: Array<[number, number, number?]>, seed: number): PropInstance[] => trees(list.map(([x, z, h]) => [x, z, h ?? 7, 'palm']), seed);
/** 一组分时摆放物 */
const during = (hours: [number, number], list: PropInstance[], mirage = false): PropInstance[] => list.map((p) => ({ ...p, hours, ...(mirage ? { mirage: true } : {}) }));
const stall = (pos: Vec2, yaw: number, canopy: string, goods: string, seed: number): PropInstance => ({ type: 'market-stall', position: pos, yaw, size: [3.2, 2.6, 2.2], roof: canopy, variant: goods, seed });

/** 幻影镇时间窗（NPC 日程 / 互动文本与这里保持一致） */
export const MIRAGE_HOURS = {
  bazaar: [7, 18] as [number, number],
  nightMarket: [19, 3] as [number, number],
  moonTower: [20, 4] as [number, number],
  palace: [10, 16] as [number, number],
};

// ———————————————————————— 幻影镇 ————————————————————————
// 主街 z = 450（x −470 → −290）；北侧门口 z = 444 朝南，南侧门口 z = 456 朝北；
// 后巷 z = 484，第二排门口 z = 490 朝北；道馆前广场 x −405 ~ −355、z 404 ~ 440；码头路 x = −380 向南。
const W1 = '#f4ecdc';
const W2 = '#efe2c8';
const W3 = '#f6f0e4';
const DOME = '#5fb8c0';
const DOME2 = '#3f8aa8';
const DOME3 = '#7fd6d8';

const mirageTown: PropInstance[] = [
  atDoor('pokecenter', [-420, 444], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-mirage', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [-345, 444], FACE.south, [12, 6.5, 10], { ref: 'mart-mirage', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-mirage', [-380, 400], FACE.south, 26, 15, 'mirage'),
  // 北侧（门朝南）
  house([-460, 444], FACE.south, [9, 6.4, 8], W1, DOME, 4101),
  house([-443, 444], FACE.south, [9, 6.8, 8], W2, DOME2, 4102),
  house([-325, 444], FACE.south, [9, 6.6, 8], W3, DOME3, 4103),
  house([-308, 444], FACE.south, [9, 6.2, 8], W1, DOME, 4104),
  // 南侧（门朝北）
  house([-460, 456], FACE.north, [9, 6.6, 8], W2, DOME3, 4111),
  house([-443, 456], FACE.north, [9, 6.2, 8], W3, DOME, 4112),
  house([-426, 456], FACE.north, [9, 6.8, 8], W1, DOME2, 4113),
  house([-409, 456], FACE.north, [8, 6.2, 7], W2, DOME, 4114),
  house([-352, 456], FACE.north, [8, 6.4, 7], W3, DOME3, 4115),
  house([-335, 456], FACE.north, [9, 6.8, 8], W1, DOME2, 4116),
  house([-318, 456], FACE.north, [9, 6.2, 8], W2, DOME, 4117),
  house([-301, 456], FACE.north, [9, 6.6, 8], W3, DOME3, 4118),
  // 后巷第二排（门朝北）
  house([-455, 490], FACE.north, [10, 7.0, 9], W1, DOME2, 4121),
  house([-436, 490], FACE.north, [11, 7.6, 10], '#efe4d4', '#7a4a9a', 4122, { ref: 'mirage-seer-house', accent: '#7a4a9a' }),
  house([-417, 490], FACE.north, [9, 6.6, 8], W3, DOME, 4123),
  house([-343, 490], FACE.north, [9, 6.4, 8], W2, DOME3, 4124),
  house([-324, 490], FACE.north, [10, 7.0, 9], W1, DOME, 4125),
  house([-305, 490], FACE.north, [9, 6.6, 8], W3, DOME2, 4126),
  // 城门（马蹄拱，跨主街两端）
  { type: 'mirage-gate', position: [-478, 450], yaw: FACE.east, size: [8, 8.5, 2.2] },
  { type: 'mirage-gate', position: [-284, 450], yaw: FACE.west, size: [8, 8.5, 2.2] },
  // 镇内蜃楼塔（常驻）：广场两角
  { type: 'minaret', position: [-410, 404], yaw: 0, size: [2.6, 20, 2.6] },
  { type: 'minaret', position: [-350, 404], yaw: 0, size: [2.6, 20, 2.6] },
  // 道馆前广场：预言石柱一对 + 长椅 + 名牌
  { type: 'prophecy-obelisk', position: [-392, 436], yaw: 0, size: [2, 5.5, 2], seed: 4131 },
  { type: 'prophecy-obelisk', position: [-368, 436], yaw: 0, size: [2, 5.5, 2], seed: 4132 },
  { type: 'sign', ref: 'gym-mirage-sign', position: [-372, 404], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'bench', position: [-398, 420], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [-362, 420], yaw: FACE.west, size: [1.8, 0.9, 0.6] },
  prop('flowerbed', [-388, 408], [3, 0.4, 1.2], { seed: 4133 }),
  prop('flowerbed', [-372, 408], [3, 0.4, 1.2], { seed: 4134 }),
  // 主街小品
  { type: 'noticeboard', ref: 'mirage-noticeboard', position: [-402, 444], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'mailbox', position: [-452, 441], yaw: FACE.south, size: [0.5, 1.2, 0.4], color: '#3f7a8a' },
  { type: 'well', position: [-470, 470], yaw: 0, size: [2, 3, 2] },
  { type: 'fountain', position: [-380, 470], yaw: 0, size: [5, 2.4, 5], color: '#e4d8c0', variant: 'star' },
  { type: 'laundry', position: [-446, 476], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 4135 },
  { type: 'laundry', position: [-316, 476], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 4136 },
  prop('garden', [-300, 476], [5, 0.4, 4], { variant: 'herb', seed: 4137 }),
  fence([[-304, 472], [-296, 472], [-296, 480]]),
  { type: 'crate', position: [-356, 474], yaw: 0.3, size: [1.2, 1.2, 1.2] },
  { type: 'crate', position: [-355, 475.4], yaw: 0.9, size: [1.2, 1.2, 1.2] },
  { type: 'barrel', position: [-466, 482], yaw: 0, size: [0.8, 1, 0.8], color: '#8a5a32' },
  { type: 'barrel', position: [-465, 483.3], yaw: 0, size: [0.8, 1, 0.8], color: '#8a5a32' },
  { type: 'bunting', position: [-380, 450], yaw: 0, size: [0.1, 4, 0.1], points: [[-470, 447], [-430, 453], [-390, 447], [-350, 453], [-300, 447]], seed: 4138 },
  ...lamps([[-466, 454], [-436, 446], [-404, 454], [-356, 446], [-330, 454], [-296, 446], [-376, 480], [-384, 530]]),
  ...palms(
    [
      [-412, 426, 8], [-348, 426, 8], [-404, 412, 7], [-356, 412, 7], [-486, 436], [-486, 466], [-276, 436], [-276, 466],
      [-396, 474, 6.5], [-364, 474, 6.5], [-470, 500, 7.5], [-292, 500, 7.5], [-392, 540, 8], [-368, 540, 8],
    ],
    4140,
  ),
  ...trees([[-480, 420, 4.5, 'shrub'], [-284, 420, 4.5, 'shrub'], [-430, 510, 4, 'shrub'], [-330, 510, 4, 'shrub']], 4160),
  prop('rocks', [-494, 500], [3.6, 1.3, 3.6], { seed: 4171, color: '#d8c8a4' }),
  prop('rocks', [-268, 490], [3.2, 1.2, 3.2], { seed: 4172, color: '#d8c8a4' }),

  // ———— 白日市集（7–18 时）：广场两侧布篷摊位 ————
  ...during(MIRAGE_HOURS.bazaar, [
    stall([-399, 428], FACE.east, '#d86a4a', 'fruit', 4201),
    stall([-399, 414], FACE.east, '#e8b73a', 'cloth', 4202),
    stall([-361, 428], FACE.west, '#3f8aa8', 'pottery', 4203),
    stall([-361, 414], FACE.west, '#7a4a9a', 'spice', 4204),
    { type: 'crate', position: [-402, 421], yaw: 0.2, size: [1, 1, 1] },
    { type: 'barrel', position: [-358, 421], yaw: 0, size: [0.8, 1, 0.8], color: '#9b6b43' },
  ]),

  // ———— 月夜集市（19–3 时）：码头路口的灯笼夜市 ————
  ...during(MIRAGE_HOURS.nightMarket, [
    stall([-394, 500], FACE.east, '#4b4a78', 'lantern', 4211),
    stall([-394, 512], FACE.east, '#7a4a9a', 'charm', 4212),
    stall([-366, 500], FACE.west, '#3f6a9a', 'fish', 4213),
    stall([-366, 512], FACE.west, '#5b4a78', 'sweets', 4214),
    { type: 'lantern', position: [-397, 506], yaw: 0, size: [0.5, 2.6, 0.5], color: '#e8c870' },
    { type: 'lantern', position: [-363, 506], yaw: 0, size: [0.5, 2.6, 0.5], color: '#e8c870' },
    { type: 'lantern', position: [-386, 520], yaw: 0, size: [0.5, 2.4, 0.5], color: '#c86ad8' },
    { type: 'lantern', position: [-374, 520], yaw: 0, size: [0.5, 2.4, 0.5], color: '#c86ad8' },
    { type: 'bunting', position: [-380, 506], yaw: 0, size: [0.1, 3.6, 0.1], points: [[-396, 498], [-380, 504], [-364, 498]], seed: 4215 },
    { type: 'bunting', position: [-380, 514], yaw: 0, size: [0.1, 3.6, 0.1], points: [[-396, 514], [-380, 520], [-364, 514]], seed: 4216 },
  ]),

  // ———— 月影塔（20–4 时，实体）：镇西口外 ————
  ...during(MIRAGE_HOURS.moonTower, [
    { type: 'moon-tower', position: [-484, 492], yaw: 0, size: [5, 26, 5] },
    { type: 'prophecy-obelisk', position: [-476, 500], yaw: 0, size: [2, 4, 2], seed: 4221 },
  ]),

  // ———— 蜃楼宫（10–16 时，幻象）：东面沙丘上的宫殿与双塔 ————
  ...during(
    MIRAGE_HOURS.palace,
    [
      atDoor('house', [-214, 470], FACE.west, [24, 14, 18], { variant: 'mirage', color: '#f8eed8', roof: '#8fe0e4', seed: 4231, accent: '#c9a86a', collide: false }),
      { type: 'minaret', position: [-212, 448], yaw: 0, size: [3, 30, 3], color: '#f8eed8', accent: '#8fe0e4', collide: false },
      { type: 'minaret', position: [-212, 492], yaw: 0, size: [3, 30, 3], color: '#f8eed8', accent: '#8fe0e4', collide: false },
      { type: 'mirage-gate', position: [-236, 470], yaw: FACE.west, size: [7, 9, 2.2], color: '#f8eed8', accent: '#c9a86a', collide: false },
      ...palms([[-232, 452, 9], [-232, 488, 9], [-196, 446, 8], [-196, 494, 8]], 4240).map((p) => ({ ...p, collide: false })),
    ],
    true,
  ),

  // ———— 码头（镇南，栈桥伸进礁石迷宫北口）————
  deck([-380, 588], 7, 26, 1.6, 'ew'),
  { type: 'rowboat', position: [-388, 596], yaw: 0.2, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'rowboat', position: [-372, 600], yaw: -0.3, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'bollard', position: [-383, 598], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  { type: 'bollard', position: [-377, 598], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  { type: 'net-rack', position: [-396, 566], yaw: PI / 2, size: [3, 2, 0.3] },
  { type: 'crate', position: [-367, 566], yaw: 0.4, size: [1.2, 1.2, 1.2] },
  { type: 'sign', ref: 'mirage-dock-sign', position: [-374, 568], yaw: FACE.north, size: [1.6, 1.6, 0.2] },
];

export const MIRAGE_TOWN: TownLayout = {
  id: 'mirage-town',
  zone: 'mirage-town',
  paths: [
    { id: 'town-mirage-gym-walk', surface: 'stone', width: 6, points: [[-380, 446], [-380, 403]] },
    { id: 'town-mirage-lane', surface: 'dirt', width: 4, points: [[-466, 484], [-296, 484]] },
    { id: 'town-mirage-plaza', surface: 'stone', width: 24, points: [[-380, 412], [-380, 432]] },
    { id: 'town-mirage-night-plaza', surface: 'stone', width: 22, points: [[-380, 498], [-380, 516]] },
    { id: 'town-mirage-west-walk', surface: 'dirt', width: 3, points: [[-472, 456], [-480, 488]] },
  ],
  pads: [
    { position: [-380, 466], size: [200, 116], y: 6.2, blend: 20 },
    { position: [-380, 390], size: [40, 40], y: 6.5, blend: 12 },
    { position: [-484, 494], size: [18, 18], y: 6.6, blend: 8 },
    // 码头路：从镇南切开前沿沙丘下到海边
    { position: [-380, 540], size: [24, 40], y: 6.0, blend: 10 },
    { position: [-380, 566], size: [20, 14], y: 3.4, blend: 8 },
  ],
  props: mirageTown,
};

// ———————————————————————— 幽冥镇 ————————————————————————
// 主街 z = −165（x −530 → −400 压平，往东爬坡进暗影林）；北侧门口 z = −171 朝南，南侧门口 z = −159 朝北；
// 南街 x = −450（z −159 → −110）；古墓园 x −530 ~ −476、z −146 ~ −104。
const crypt = (door: Vec2, yaw: number, size: Vec3, color: string, roof: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant: 'crypt', color, roof, seed, accent: '#5b4a78', ...extra });
const S1 = '#6e6878';
const S2 = '#76707e';
const S3 = '#646070';
const R1 = '#2e2a3a';
const R2 = '#3a3446';
const ghostLamps = (list: Vec2[], color?: string): PropInstance[] => list.map((p, i) => ({ type: 'ghost-lamp', position: p, yaw: i * 1.3, size: [0.4, 3.8, 0.4], ...(color ? { color } : {}) }));
/** 墓碑方阵：起点、列数 × 行数、间距；墓碑造型轮换 */
function graves(x0: number, z0: number, cols: number, rows: number, dx: number, dz: number, seed: number, skip: (c: number, r: number) => boolean): PropInstance[] {
  const out: PropInstance[] = [];
  const kinds = ['slab', 'round', 'cross'];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (skip(c, r)) continue;
      const k = (c * 7 + r * 3 + seed) % 3;
      out.push({ type: 'tombstone', position: [x0 + c * dx + ((r * 13 + c * 5) % 5) * 0.12, z0 + r * dz], yaw: FACE.east + (((c + r) % 3) - 1) * 0.08, size: [0.9, 1.1 + ((c + r * 2) % 3) * 0.25, 0.3], variant: kinds[k]!, seed: seed + r * 17 + c });
    }
  return out;
}
const wisps = (list: Vec2[], seed: number, color?: string): PropInstance[] => list.map(([x, z], i) => ({ type: 'wisp', position: [x, z], yaw: 0, size: [0.5, 1.4 + (i % 3) * 0.5, 0.5], seed: seed + i, collide: false, ...(color ? { color } : {}) }));

export const GHOST_HOURS = { midnight: [0, 3] as [number, number] };

const ghostTown: PropInstance[] = [
  atDoor('pokecenter', [-480, -171], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-ghost', color: '#f2ece6', roof: '#c24a44' }),
  atDoor('mart', [-405, -171], FACE.south, [12, 6.5, 10], { ref: 'mart-ghost', color: '#e8eaee', roof: '#3a64b0' }),
  gymAt('gym-ghost', [-430, -198], FACE.south, 26, 16, 'ghost'),
  // 北侧石墓屋（门朝南）
  crypt([-518, -171], FACE.south, [9, 7.2, 8], S1, R1, 4301),
  crypt([-501, -171], FACE.south, [8, 6.8, 7], S2, R2, 4302),
  crypt([-460, -171], FACE.south, [9, 7.4, 8], S3, R1, 4303),
  // 南侧（门朝北）
  crypt([-520, -159], FACE.north, [9, 7.0, 8], S2, R1, 4311),
  crypt([-503, -159], FACE.north, [9, 7.4, 8], S1, R2, 4312),
  crypt([-486, -159], FACE.north, [8, 6.8, 7], S3, R1, 4313, { ref: 'ghost-gravekeeper-house' }),
  crypt([-469, -159], FACE.north, [9, 7.2, 8], S2, R2, 4314),
  crypt([-431, -159], FACE.north, [9, 7.0, 8], S1, R1, 4315),
  crypt([-414, -159], FACE.north, [9, 7.4, 8], S3, R2, 4316),
  // 灵堂（南街东侧，门朝西）+ 钟楼（南街西侧）
  atDoor('house', [-443, -125], FACE.west, [10, 12, 16], { variant: 'ossuary', ref: 'ghost-ossuary', color: '#6e6878', roof: '#2e2a3a' }),
  { type: 'bell-tower', position: [-462, -130], yaw: FACE.east, size: [4.2, 20, 4.2], color: '#6e6878', roof: '#2e2a3a' },
  // 古墓园：铁栅围墙（东侧留门）+ 墓碑方阵 + 枯树 + 鬼火
  fence([[-476, -128], [-476, -146], [-532, -146], [-532, -103], [-476, -103], [-476, -121]]),
  ...graves(-526, -142, 12, 10, 4.2, 4.1, 4320, (c, r) => r === 4 || (c >= 10 && r >= 3 && r <= 5)),
  { type: 'statue', position: [-504, -125], yaw: FACE.east, size: [1.6, 3.4, 1.6], variant: 'mourner', color: '#8a8690' },
  ...trees([[-529, -106, 6, 'round']], 4340).map((t) => ({ ...t, type: 'dead-tree' as const, size: [2.4, 6, 2.4] as Vec3, variant: 'marsh' })),
  { type: 'dead-tree', position: [-480, -144], yaw: 1.2, size: [2.4, 5, 2.4], variant: 'marsh', seed: 4341 },
  { type: 'dead-tree', position: [-528, -136], yaw: 2.6, size: [2.4, 5.5, 2.4], variant: 'marsh', seed: 4342 },
  ...wisps([[-512, -136], [-494, -112], [-520, -118], [-486, -134]], 4350),
  // 零点到三点：墓园里的鬼火多出一倍（只发光、没有碰撞）
  ...during(GHOST_HOURS.midnight, wisps([[-506, -140], [-498, -120], [-516, -108], [-490, -128], [-524, -128], [-500, -106]], 4360, '#b89af8')),
  // 主街 / 南街小品
  { type: 'sign', ref: 'gym-ghost-sign', position: [-422, -196], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', ref: 'ghost-noticeboard', position: [-445, -171], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'well', position: [-440, -150], yaw: 0, size: [2, 3, 2] },
  { type: 'barrel', position: [-525, -152], yaw: 0, size: [0.8, 1, 0.8], color: '#4a3e36' },
  { type: 'barrel', position: [-524, -150.7], yaw: 0, size: [0.8, 1, 0.8], color: '#4a3e36' },
  { type: 'crate', position: [-410, -152], yaw: 0.4, size: [1.1, 1.1, 1.1] },
  ...ghostLamps([[-526, -169], [-508, -161], [-490, -169], [-472, -161], [-454, -169], [-436, -161], [-418, -169], [-400, -161], [-453, -140], [-447, -118], [-426, -186], [-434, -186]]),
  ...trees([[-538, -180, 5, 'shrub'], [-404, -140, 4.5, 'shrub'], [-396, -190, 5, 'shrub']], 4370),
  { type: 'dead-tree', position: [-540, -200], yaw: 0.3, size: [2.4, 6.5, 2.4], variant: 'marsh', seed: 4381 },
  { type: 'dead-tree', position: [-470, -205], yaw: 1.9, size: [2.4, 5.5, 2.4], variant: 'marsh', seed: 4382 },
  { type: 'dead-tree', position: [-395, -215], yaw: 2.9, size: [2.4, 6, 2.4], variant: 'marsh', seed: 4383 },
  prop('rocks', [-536, -128], [3, 1.1, 3], { seed: 4391, color: '#5e5a62' }),
  prop('rocks', [-410, -112], [3.4, 1.2, 3.4], { seed: 4392, color: '#5e5a62' }),
  // 西边沼泽水塘上的高脚屋（门朝东）
  { type: 'stilt-house', position: [-584, -100], yaw: FACE.east, size: [7, 5, 9], y: 4.4, color: '#5a5048', roof: '#2e2a3a', seed: 4395, accent: '#5b4a78' },
  { type: 'stilt-house', position: [-586, -124], yaw: FACE.east, size: [7, 5, 9], y: 4.4, color: '#544a44', roof: '#3a3446', seed: 4396, accent: '#5b4a78' },
  ...ghostLamps([[-572, -112], [-560, -140]]),
];

export const GHOST_TOWN: TownLayout = {
  id: 'ghost-town',
  zone: 'ghost-town',
  paths: [
    { id: 'town-ghost-gym-walk', surface: 'stone', width: 6, points: [[-430, -169], [-430, -195]] },
    { id: 'town-ghost-cemetery', surface: 'dirt', width: 3, points: [[-447, -124], [-476, -124], [-528, -124]] },
    { id: 'town-ghost-stilt-walk', surface: 'dirt', width: 3, points: [[-530, -160], [-552, -140], [-574, -114]] },
  ],
  pads: [
    { position: [-470, -160], size: [150, 120], y: 3.8, blend: 16 },
    { position: [-430, -212], size: [38, 38], y: 3.9, blend: 10 },
  ],
  props: ghostTown,
};

// ———————————————————————— 琉璃镇 ————————————————————————
// 主街 z = 152（x 372 → 606）；北侧门口 z = 146 朝南、第二排 z = 124 朝南；南侧门口 z = 158 朝北、第二排 z = 184 朝北；
// 南路 x = 430（通蜃景沙丘）；广场路 x = 486 → 水晶喷泉广场（486, 196）；码头 z = 152、神殿石堤 z = 182。
const glass = (door: Vec2, yaw: number, size: Vec3, wall: string, roof: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant: 'glass', color: wall, roof, seed, accent: '#2a6aa8', ...extra });
const G1 = '#f6f2ea';
const G2 = '#f2ece2';
const G3 = '#eef4f2';
const T1 = '#5fb8c8';
const T2 = '#4a9ab8';
const T3 = '#7fcfc0';
const crystals = (list: Array<[number, number, number?]>, seed: number): PropInstance[] =>
  list.map(([x, z, hh], i) => ({ type: 'glass-crystal', position: [x, z], yaw: i * 1.7, size: [1.6, hh ?? 2, 1.6], seed: seed + i, color: ['#8fdcdc', '#9fe0c8', '#8fc8f8'][i % 3]! }));

const glazeTown: PropInstance[] = [
  atDoor('pokecenter', [426, 146], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-glaze', color: '#fbf7f0', roof: '#e25a4f' }),
  atDoor('mart', [512, 146], FACE.south, [12, 6.5, 10], { ref: 'mart-glaze', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-glaze', [486, 118], FACE.south, 28, 16, 'water'),
  // 北侧（门朝南）
  glass([406, 146], FACE.south, [9, 7, 8], G1, T1, 4501),
  glass([446, 146], FACE.south, [9, 7.2, 8], G2, T2, 4502),
  glass([530, 146], FACE.south, [9, 6.8, 8], G3, T3, 4503),
  glass([547, 146], FACE.south, [9, 7.2, 8], G1, T2, 4504),
  glass([410, 124], FACE.south, [9, 6.8, 8], G2, T3, 4505),
  glass([446, 124], FACE.south, [9, 7, 8], G3, T1, 4506),
  glass([526, 124], FACE.south, [9, 7.2, 8], G1, T3, 4507),
  glass([544, 124], FACE.south, [9, 6.8, 8], G2, T1, 4508),
  // 南侧（门朝北）
  glass([405, 158], FACE.north, [9, 7, 8], G3, T2, 4511),
  glass([418, 158], FACE.north, [8, 6.6, 7], G1, T1, 4512),
  glass([443, 158], FACE.north, [9, 7.2, 8], G2, T3, 4513),
  glass([460, 158], FACE.north, [9, 7, 8], G3, T2, 4514, { ref: 'glaze-diver-house' }),
  atDoor('house', [506, 158], FACE.north, [12, 7.5, 10], { variant: 'glassworks', ref: 'glaze-glassworks', color: '#e8dcc8', roof: '#3f7a9a' }),
  glass([526, 158], FACE.north, [9, 6.8, 8], G1, T3, 4515),
  glass([543, 158], FACE.north, [9, 7.2, 8], G2, T1, 4516),
  glass([412, 184], FACE.north, [9, 7, 8], G3, T1, 4517),
  glass([448, 184], FACE.north, [9, 6.8, 8], G1, T2, 4518),
  glass([530, 184], FACE.north, [9, 7, 8], G2, T3, 4519),
  glass([548, 184], FACE.north, [9, 7.2, 8], G3, T2, 4520),
  // 水晶喷泉广场
  { type: 'fountain', position: [486, 196], yaw: 0, size: [7, 2, 7], color: '#8fdcf0' },
  ...crystals([[478, 190, 1.6], [494, 190, 1.8], [478, 203, 1.7], [494, 203, 1.5]], 4530),
  { type: 'bench', position: [474, 196], yaw: FACE.east, size: [2.2, 0.9, 0.6] },
  { type: 'bench', position: [498, 196], yaw: FACE.west, size: [2.2, 0.9, 0.6] },
  { type: 'flowerbed', position: [486, 210], yaw: 0, size: [8, 0.5, 2.4], seed: 4535 },
  { type: 'flowerbed', position: [470, 172], yaw: 0, size: [6, 0.5, 2], seed: 4536 },
  { type: 'flowerbed', position: [502, 176], yaw: 0, size: [4, 0.5, 2], seed: 4537 },
  // 主街小品
  { type: 'sign', ref: 'gym-glaze-sign', position: [495, 119], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', ref: 'glaze-noticeboard', position: [466, 146.5], yaw: FACE.south, size: [2, 2.2, 0.3] },
  ...lamps([[396, 148], [416, 156], [436, 148], [456, 156], [476, 148], [496, 156], [520, 148], [538, 156], [556, 148], [574, 156], [592, 148], [482, 186], [490, 206]]),
  ...trees([[396, 128, 6, 'round'], [458, 118, 5.5, 'round'], [556, 120, 6, 'round'], [398, 196, 6, 'round'], [470, 214, 5, 'shrub'], [512, 214, 5, 'shrub'], [560, 196, 6, 'round'], [520, 104, 5.5, 'round']], 4540),
  { type: 'well', position: [468, 128], yaw: 0, size: [2, 3, 2] },
  { type: 'barrel', position: [516, 170], yaw: 0, size: [0.8, 1, 0.8] },
  { type: 'crate', position: [497, 170], yaw: 0.3, size: [1.1, 1.1, 1.1] },
  // 沙滩：灯塔、海玻璃晶簇
  { type: 'lighthouse', position: [603, 86], yaw: FACE.east, size: [5, 22, 5], color: '#fbfbf6', roof: '#2a6aa8', ref: 'glaze-lighthouse', variant: 'keeper' },
  ...crystals([[596, 112, 1.4], [608, 128, 1.2], [594, 176, 1.6], [606, 204, 1.3], [598, 220, 1.5], [612, 104, 1.1]], 4550),
  // 码头（主街正东）
  deck([634, 152], 52, 5, 1.6, 'ns'),
  { type: 'rowboat', position: [646, 146.5], yaw: PI / 2 + 0.15, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'rowboat', position: [652, 157.5], yaw: PI / 2 - 0.2, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'boat', position: [664, 145], yaw: PI / 2, size: [4, 3.5, 11], y: 0, color: '#f5f5f0', roof: '#2a6aa8', collide: true },
  { type: 'bollard', position: [640, 149.8], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  { type: 'bollard', position: [656, 154.2], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  { type: 'net-rack', position: [598, 142], yaw: 0, size: [3, 2, 0.3] },
  { type: 'crate', position: [600, 160], yaw: 0.5, size: [1.2, 1.2, 1.2] },
  { type: 'sign', ref: 'glaze-dock-sign', position: [604, 148], yaw: FACE.west, size: [1.6, 1.6, 0.2] },
  // 海底神殿之门：长石堤 + 海中门楼（朝东，门外即深水暗区）
  deck([642, 182], 88, 3.6, 1.4, 'ns'),
  { type: 'temple-gate', ref: 'glaze-temple-gate', position: [690, 182], yaw: FACE.east, size: [8, 9, 8], y: 0.7, seed: 4560 },
  { type: 'stele', ref: 'glaze-temple-stele', position: [596, 186], yaw: FACE.east, size: [1.6, 2.4, 0.8] },
  { type: 'lantern', position: [596, 178], yaw: 0, size: [0.4, 2.2, 0.4], color: '#8fe8ff' },
];

export const GLAZE_TOWN: TownLayout = {
  id: 'glaze-town',
  zone: 'glaze-town',
  paths: [
    { id: 'town-glaze-gym-walk', surface: 'stone', width: 6, points: [[486, 150], [486, 120]] },
    { id: 'town-glaze-plaza-walk', surface: 'stone', width: 5, points: [[486, 154], [486, 188]] },
    { id: 'town-glaze-plaza', surface: 'stone', width: 22, points: [[486, 190], [486, 204]] },
    { id: 'town-glaze-north-lane', surface: 'dirt', width: 4, points: [[400, 130], [460, 130]] },
    { id: 'town-glaze-north-lane-e', surface: 'dirt', width: 4, points: [[514, 130], [556, 130]] },
    { id: 'town-glaze-south-lane', surface: 'dirt', width: 4, points: [[400, 178], [560, 178]] },
    { id: 'town-glaze-temple-walk', surface: 'dirt', width: 3, points: [[592, 156], [596, 182]] },
    { id: 'town-glaze-lighthouse-walk', surface: 'dirt', width: 3, points: [[592, 148], [600, 96]] },
  ],
  pads: [
    { position: [480, 152], size: [176, 140], y: 7.0, blend: 16 },
    { position: [486, 103], size: [38, 38], y: 7.0, blend: 10 },
  ],
  props: glazeTown,
};

// ———————————————————————— 彩幽市 ————————————————————————
// 大道 x = 40（z −640 冠军之路北口 → −872 联盟大门）；十字大道 z = −765（x −70 → 170）；喷泉广场 (40, −765)。
// 十字大道北侧门口 z = −771 朝南、南侧门口 z = −759 朝北；南段大道西 / 东侧门口 x = 31 / 49。
const ever = (door: Vec2, yaw: number, size: Vec3, accent: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant: 'ever', accent, seed, ...extra });
const A1 = '#3a5ab8';
const A2 = '#5a7ad8';
const A3 = '#2a8a9a';
const A4 = '#8a5ab8';
const flowerRow = (x: number, z0: number, z1: number, seed: number): PropInstance[] => {
  const out: PropInstance[] = [];
  for (let z = z0, i = 0; z >= z1; z -= 8, i++) out.push({ type: 'flowerbed', position: [x, z], yaw: 0, size: [2.4, 0.5, 6], seed: seed + i });
  return out;
};

const everCity: PropInstance[] = [
  atDoor('pokecenter', [31, -735], FACE.east, [18, 8.5, 14], { ref: 'pokecenter-ever', color: '#fbf7f0', roof: '#e25a4f' }),
  atDoor('mart', [49, -735], FACE.west, [14, 7, 12], { ref: 'mart-ever', color: '#f4f6f8', roof: '#3f7fd6' }),
  atDoor('house', [31, -800], FACE.east, [18, 13, 14], { variant: 'ever-hotel', ref: 'ever-hotel', accent: A1, seed: 4601 }),
  ever([49, -800], FACE.west, [12, 8.5, 10], A4, 4602, { ref: 'ever-flower-house' }),
  // 十字大道北侧（门朝南）
  ever([-50, -771], FACE.south, [10, 9, 9], A1, 4611),
  ever([-30, -771], FACE.south, [10, 9.4, 9], A2, 4612),
  ever([-10, -771], FACE.south, [10, 9, 9], A3, 4613),
  ever([90, -771], FACE.south, [10, 9.2, 9], A2, 4614),
  ever([110, -771], FACE.south, [10, 9, 9], A4, 4615),
  ever([130, -771], FACE.south, [10, 9.4, 9], A1, 4616),
  // 十字大道南侧（门朝北）
  ever([-50, -759], FACE.north, [10, 9.2, 9], A3, 4621),
  ever([-30, -759], FACE.north, [10, 9, 9], A1, 4622),
  ever([-10, -759], FACE.north, [10, 9.4, 9], A4, 4623),
  ever([90, -759], FACE.north, [10, 9, 9], A1, 4624),
  ever([110, -759], FACE.north, [10, 9.2, 9], A3, 4625),
  ever([130, -759], FACE.north, [10, 9, 9], A2, 4626),
  // 喷泉广场
  { type: 'fountain', position: [40, -765], yaw: 0, size: [10, 2.4, 10], color: '#8fc8f0', variant: 'grand' },
  ...[0, 1, 2, 3].map((k): PropInstance => ({ type: 'flowerbed', position: [40 + Math.sin((k * PI) / 2 + PI / 4) * 11, -765 + Math.cos((k * PI) / 2 + PI / 4) * 11], yaw: (k * PI) / 2 + PI / 4, size: [3, 0.5, 3], variant: 'round', seed: 4630 + k })),
  { type: 'bench', position: [26, -752], yaw: PI / 4 + PI, size: [2.2, 0.9, 0.6] },
  { type: 'bench', position: [54, -752], yaw: -PI / 4 + PI, size: [2.2, 0.9, 0.6] },
  { type: 'bench', position: [26, -778], yaw: -PI / 4, size: [2.2, 0.9, 0.6] },
  { type: 'bench', position: [54, -778], yaw: PI / 4, size: [2.2, 0.9, 0.6] },
  // 南口花道（冠军之路出口 → 市区）
  ...flowerRow(32, -650, -718, 4640),
  ...flowerRow(48, -650, -718, 4650),
  { type: 'sign', ref: 'ever-city-sign', position: [33, -700], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', ref: 'ever-noticeboard', position: [53, -712], yaw: FACE.west, size: [2, 2.2, 0.3] },
  // 冠军大道：历代冠军星像 + 花坛
  ...[-818, -834, -850].flatMap((z, i): PropInstance[] => [
    { type: 'statue', position: [31, z], yaw: FACE.east, size: [2, 4.2, 2], variant: 'star', color: '#d8c27a', seed: 4660 + i },
    { type: 'statue', position: [49, z], yaw: FACE.west, size: [2, 4.2, 2], variant: 'star', color: '#d8c27a', seed: 4670 + i },
  ]),
  ...flowerRow(26, -814, -858, 4680),
  ...flowerRow(54, -814, -858, 4690),
  // 精灵联盟大门
  { type: 'league-gate', ref: 'league-entrance', position: [40, -880], yaw: 0, size: [30, 22, 10] },
  ...lamps([[35, -660], [45, -680], [35, -700], [45, -720], [35, -745], [45, -785], [35, -812], [45, -826], [35, -842], [45, -858], [-60, -768], [-20, -762], [80, -762], [120, -768], [160, -762], [-70, -762]], 4.8),
  ...trees(
    [[-60, -730, 7, 'round'], [-30, -735, 6.5, 'round'], [0, -728, 7, 'round'], [80, -730, 7, 'round'], [110, -735, 6.5, 'round'], [140, -728, 7, 'round'],
      [-60, -800, 7, 'round'], [-25, -805, 6.5, 'round'], [5, -798, 7, 'round'], [80, -800, 7, 'round'], [115, -805, 6.5, 'round'], [145, -798, 7, 'round'],
      [10, -860, 6, 'round'], [70, -860, 6, 'round'], [0, -700, 6, 'round'], [80, -705, 6, 'round']],
    4700,
  ),
  ...[-40, -20, 100, 120].map((x, i): PropInstance => ({ type: 'hedge', position: [x, -745], yaw: 0, size: [8, 1.2, 1.2], seed: 4720 + i })),
  ...[-40, -20, 100, 120].map((x, i): PropInstance => ({ type: 'hedge', position: [x, -785], yaw: 0, size: [8, 1.2, 1.2], seed: 4730 + i })),
];

export const EVER_CITY: TownLayout = {
  id: 'ever-city',
  zone: 'ever-city',
  paths: [
    { id: 'town-ever-plaza', surface: 'stone', width: 30, points: [[40, -758], [40, -772]] },
    { id: 'town-ever-champion-walk', surface: 'stone', width: 14, points: [[40, -812], [40, -866]] },
    { id: 'town-ever-gate-plaza', surface: 'stone', width: 40, points: [[40, -864], [40, -870]] },
    { id: 'town-ever-west-lane', surface: 'dirt', width: 4, points: [[-60, -790], [20, -790]] },
    { id: 'town-ever-east-lane', surface: 'dirt', width: 4, points: [[60, -790], [140, -790]] },
  ],
  pads: [{ position: [40, -780], size: [240, 230], y: 96, blend: 12 }],
  props: everCity,
};

export const GLAZE_TOWNS: TownLayout[] = [MIRAGE_TOWN, GHOST_TOWN, GLAZE_TOWN, EVER_CITY];
