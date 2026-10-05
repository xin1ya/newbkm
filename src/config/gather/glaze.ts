/**
 * M3-28 · 琉璃群岛野外采集点（坐标由远端探针按高度图 / 水域 / 碰撞体 / 道路 / POI 避让挑选，见 tests 探针脚本思路同萌芽）。
 * 树果按生态：雷鸣多半减电 / 冰与冰冻解除类，琉璃多超能 / 幽灵对策与高级回复；矿点在高处陡坡，贝壳在岸边。
 * id 固定（存档只记录上次采集的游戏日），新增点请追加，不要改已有 id。
 */
import type { GatherPointDef } from '@/systems/gathering';

export const GLAZE_GATHER: GatherPointDef[] = [
  // stone-forest
  { id: 'stonef-tree-1', kind: 'berryTree', position: [-303, 208], zone: 'stone-forest', berry: 'chople-berry' },
  { id: 'stonef-tree-2', kind: 'berryTree', position: [-527, 12], zone: 'stone-forest', berry: 'qualot-berry' },
  { id: 'stonef-tree-3', kind: 'berryTree', position: [-520, 236], zone: 'stone-forest', berry: 'sitrus-berry' },
  { id: 'stonef-tree-4', kind: 'berryTree', position: [-520, 299], zone: 'stone-forest', berry: 'rawst-berry' },
  { id: 'stonef-tree-5', kind: 'berryTree', position: [-492, 271], zone: 'stone-forest', berry: 'leppa-berry' },
  { id: 'stonef-ore-1', kind: 'ore', position: [-408, -58], zone: 'stone-forest' },
  { id: 'stonef-ore-2', kind: 'ore', position: [-331, 306], zone: 'stone-forest' },
  { id: 'stonef-ore-3', kind: 'ore', position: [-604, 159], zone: 'stone-forest' },
  { id: 'stonef-ore-4', kind: 'ore', position: [-429, 82], zone: 'stone-forest' },
  // ghost-marsh
  { id: 'gmarsh-tree-1', kind: 'berryTree', position: [-313, -300], zone: 'ghost-marsh', berry: 'pecha-berry' },
  { id: 'gmarsh-tree-2', kind: 'berryTree', position: [-579, -468], zone: 'ghost-marsh', berry: 'passho-berry' },
  { id: 'gmarsh-tree-3', kind: 'berryTree', position: [-544, -356], zone: 'ghost-marsh', berry: 'chesto-berry' },
  { id: 'gmarsh-tree-4', kind: 'berryTree', position: [-586, -419], zone: 'ghost-marsh', berry: 'grepa-berry' },
  { id: 'gmarsh-tree-5', kind: 'berryTree', position: [-600, -27], zone: 'ghost-marsh', berry: 'lum-berry' },
  { id: 'gmarsh-mush-1', kind: 'mushroom', position: [-614, -188], zone: 'ghost-marsh' },
  { id: 'gmarsh-mush-2', kind: 'mushroom', position: [-502, -363], zone: 'ghost-marsh' },
  { id: 'gmarsh-mush-3', kind: 'mushroom', position: [-642, -251], zone: 'ghost-marsh' },
  { id: 'gmarsh-mush-4', kind: 'mushroom', position: [-635, -167], zone: 'ghost-marsh' },
  { id: 'gmarsh-herb-1', kind: 'herb', position: [-481, -510], zone: 'ghost-marsh' },
  { id: 'gmarsh-herb-2', kind: 'herb', position: [-586, -349], zone: 'ghost-marsh' },
  // shadow-wood
  { id: 'swood-tree-1', kind: 'berryTree', position: [295, 289], zone: 'shadow-wood', berry: 'chesto-berry' },
  { id: 'swood-tree-2', kind: 'berryTree', position: [-41, 9], zone: 'shadow-wood', berry: 'rindo-berry' },
  { id: 'swood-tree-3', kind: 'berryTree', position: [-20, 198], zone: 'shadow-wood', berry: 'hondew-berry' },
  { id: 'swood-tree-4', kind: 'berryTree', position: [-153, -208], zone: 'shadow-wood', berry: 'lum-berry' },
  { id: 'swood-tree-5', kind: 'berryTree', position: [-153, -54], zone: 'shadow-wood', berry: 'wiki-berry' },
  { id: 'swood-tree-6', kind: 'berryTree', position: [-111, -40], zone: 'shadow-wood', berry: 'sitrus-berry' },
  { id: 'swood-mush-1', kind: 'mushroom', position: [281, 191], zone: 'shadow-wood' },
  { id: 'swood-mush-2', kind: 'mushroom', position: [-279, 205], zone: 'shadow-wood' },
  { id: 'swood-mush-3', kind: 'mushroom', position: [-146, -12], zone: 'shadow-wood' },
  { id: 'swood-honey-1', kind: 'honey', position: [99, -12], zone: 'shadow-wood' },
  { id: 'swood-honey-2', kind: 'honey', position: [-111, 128], zone: 'shadow-wood' },
  // mirage-dunes
  { id: 'dunes-tree-1', kind: 'berryTree', position: [267, 384], zone: 'mirage-dunes', berry: 'rawst-berry' },
  { id: 'dunes-tree-2', kind: 'berryTree', position: [435, 244], zone: 'mirage-dunes', berry: 'occa-berry' },
  { id: 'dunes-tree-3', kind: 'berryTree', position: [253, 461], zone: 'mirage-dunes', berry: 'tamato-berry' },
  { id: 'dunes-tree-4', kind: 'berryTree', position: [260, 356], zone: 'mirage-dunes', berry: 'figy-berry' },
  { id: 'dunes-shell-1', kind: 'shell', position: [414, 461], zone: 'mirage-dunes' },
  { id: 'dunes-shell-2', kind: 'shell', position: [127, 524], zone: 'mirage-dunes' },
  { id: 'dunes-ore-1', kind: 'ore', position: [-146, 468], zone: 'mirage-dunes' },
  { id: 'dunes-ore-2', kind: 'ore', position: [-90, 321], zone: 'mirage-dunes' },
  // glass-coast
  { id: 'gcoast-tree-1', kind: 'berryTree', position: [437, 34], zone: 'glass-coast', berry: 'passho-berry' },
  { id: 'gcoast-tree-2', kind: 'berryTree', position: [584, -141], zone: 'glass-coast', berry: 'oran-berry' },
  { id: 'gcoast-tree-3', kind: 'berryTree', position: [465, -197], zone: 'glass-coast', berry: 'sitrus-berry' },
  { id: 'gcoast-tree-4', kind: 'berryTree', position: [479, -85], zone: 'glass-coast', berry: 'pomeg-berry' },
  { id: 'gcoast-tree-5', kind: 'berryTree', position: [535, 55], zone: 'glass-coast', berry: 'leppa-berry' },
  { id: 'gcoast-shell-1', kind: 'shell', position: [626, 41], zone: 'glass-coast' },
  { id: 'gcoast-shell-2', kind: 'shell', position: [381, -92], zone: 'glass-coast' },
  { id: 'gcoast-shell-3', kind: 'shell', position: [514, 20], zone: 'glass-coast' },
  { id: 'gcoast-shell-4', kind: 'shell', position: [402, -106], zone: 'glass-coast' },
  // victory-mountain
  { id: 'vmount-tree-1', kind: 'berryTree', position: [321, -506], zone: 'victory-mountain', berry: 'lum-berry' },
  { id: 'vmount-tree-2', kind: 'berryTree', position: [-204, -261], zone: 'victory-mountain', berry: 'chople-berry' },
  { id: 'vmount-tree-3', kind: 'berryTree', position: [251, -513], zone: 'victory-mountain', berry: 'kelpsy-berry' },
  { id: 'vmount-tree-4', kind: 'berryTree', position: [6, -618], zone: 'victory-mountain', berry: 'sitrus-berry' },
  { id: 'vmount-ore-1', kind: 'ore', position: [202, -548], zone: 'victory-mountain' },
  { id: 'vmount-ore-2', kind: 'ore', position: [-176, -513], zone: 'victory-mountain' },
  { id: 'vmount-ore-3', kind: 'ore', position: [-246, -436], zone: 'victory-mountain' },
  { id: 'vmount-ore-4', kind: 'ore', position: [-155, -464], zone: 'victory-mountain' },
  // league-plateau
  { id: 'lplat-tree-1', kind: 'berryTree', position: [176, -720], zone: 'league-plateau', berry: 'lum-berry' },
  { id: 'lplat-tree-2', kind: 'berryTree', position: [470, -622], zone: 'league-plateau', berry: 'sitrus-berry' },
  { id: 'lplat-tree-3', kind: 'berryTree', position: [155, -825], zone: 'league-plateau', berry: 'yache-berry' },
  { id: 'lplat-tree-4', kind: 'berryTree', position: [302, -615], zone: 'league-plateau', berry: 'leppa-berry' },
  { id: 'lplat-tree-5', kind: 'berryTree', position: [323, -867], zone: 'league-plateau', berry: 'qualot-berry' },
  { id: 'lplat-herb-1', kind: 'herb', position: [-104, -867], zone: 'league-plateau' },
  { id: 'lplat-herb-2', kind: 'herb', position: [-62, -839], zone: 'league-plateau' },
  { id: 'lplat-herb-3', kind: 'herb', position: [-335, -755], zone: 'league-plateau' },
];
