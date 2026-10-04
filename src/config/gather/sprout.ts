/**
 * 计划文档 §9.2 · 萌芽群岛野外采集点（坐标由高度图 / 地表权重 / 道路 / 摆放物避让脚本挑选并人工复核）。
 * - 树果树：每个野区 6 棵（河口 4 棵），树种按生态分布：草原回复类、湖畔与河口状态类、高地降努力值类、
 *   幻影之森夜晚出稀有的异奇果、海崖半减类；
 * - 草药丛：草原、林缘、蒲婆婆家后山；贝壳滩：西岸沙滩、河口；蘑菇圈：幻影之森；
 * - 矿点：澜源高地、海崖（需要「碎岩」）；蜂蜜树：林缘。
 * id 固定（存档只记录上次采集的游戏日），新增点请追加，不要改已有 id。
 */
import type { GatherPointDef } from '@/systems/gathering';

export const SPROUT_GATHER: GatherPointDef[] = [
  // sprout-meadow
  { id: 'meadow-tree-1', kind: 'berryTree', position: [48, 154], zone: 'sprout-meadow', berry: 'oran-berry' },
  { id: 'meadow-tree-2', kind: 'berryTree', position: [33, 247], zone: 'sprout-meadow', berry: 'sitrus-berry' },
  { id: 'meadow-tree-3', kind: 'berryTree', position: [6, 73], zone: 'sprout-meadow', berry: 'leppa-berry' },
  { id: 'meadow-tree-4', kind: 'berryTree', position: [-42, 172], zone: 'sprout-meadow', berry: 'razz-berry' },
  { id: 'meadow-tree-5', kind: 'berryTree', position: [-54, 286], zone: 'sprout-meadow', berry: 'pecha-berry' },
  { id: 'meadow-tree-6', kind: 'berryTree', position: [-84, 85], zone: 'sprout-meadow', berry: 'figy-berry' },
  { id: 'meadow-herb-1', kind: 'herb', position: [-204, 73], zone: 'sprout-meadow' },
  { id: 'meadow-herb-2', kind: 'herb', position: [-210, 253], zone: 'sprout-meadow' },
  { id: 'meadow-herb-3', kind: 'herb', position: [-120, 223], zone: 'sprout-meadow' },
  { id: 'meadow-honey-1', kind: 'honey', position: [-234, 166], zone: 'sprout-meadow' },
  // sprout-woodland
  { id: 'wood-tree-1', kind: 'berryTree', position: [-94, -12], zone: 'sprout-woodland', berry: 'oran-berry' },
  { id: 'wood-tree-2', kind: 'berryTree', position: [-130, -96], zone: 'sprout-woodland', berry: 'cheri-berry' },
  { id: 'wood-tree-3', kind: 'berryTree', position: [-184, -15], zone: 'sprout-woodland', berry: 'chesto-berry' },
  { id: 'wood-tree-4', kind: 'berryTree', position: [-220, -117], zone: 'sprout-woodland', berry: 'razz-berry' },
  { id: 'wood-tree-5', kind: 'berryTree', position: [-274, -36], zone: 'sprout-woodland', berry: 'leppa-berry' },
  { id: 'wood-tree-6', kind: 'berryTree', position: [-328, -108], zone: 'sprout-woodland', berry: 'pecha-berry' },
  { id: 'wood-herb-1', kind: 'herb', position: [-418, -111], zone: 'sprout-woodland' },
  { id: 'wood-herb-2', kind: 'herb', position: [-139, 30], zone: 'sprout-woodland' },
  { id: 'wood-herb-3', kind: 'herb', position: [-184, -72], zone: 'sprout-woodland' },
  { id: 'wood-honey-1', kind: 'honey', position: [-277, -129], zone: 'sprout-woodland' },
  { id: 'wood-honey-2', kind: 'honey', position: [-172, -141], zone: 'sprout-woodland' },
  // cuilan-lakeside
  { id: 'lake-tree-1', kind: 'berryTree', position: [295, -119], zone: 'cuilan-lakeside', berry: 'cheri-berry' },
  { id: 'lake-tree-2', kind: 'berryTree', position: [286, -29], zone: 'cuilan-lakeside', berry: 'chesto-berry' },
  { id: 'lake-tree-3', kind: 'berryTree', position: [271, 100], zone: 'cuilan-lakeside', berry: 'pecha-berry' },
  { id: 'lake-tree-4', kind: 'berryTree', position: [238, -191], zone: 'cuilan-lakeside', berry: 'rawst-berry' },
  { id: 'lake-tree-5', kind: 'berryTree', position: [196, 49], zone: 'cuilan-lakeside', berry: 'aspear-berry' },
  { id: 'lake-tree-6', kind: 'berryTree', position: [151, -215], zone: 'cuilan-lakeside', berry: 'lum-berry' },
  { id: 'lake-herb-1', kind: 'herb', position: [61, -149], zone: 'cuilan-lakeside' },
  { id: 'lake-herb-2', kind: 'herb', position: [118, 94], zone: 'cuilan-lakeside' },
  // cuilan-river
  { id: 'river-tree-1', kind: 'berryTree', position: [321, 238], zone: 'cuilan-river', berry: 'rawst-berry' },
  { id: 'river-tree-2', kind: 'berryTree', position: [276, 322], zone: 'cuilan-river', berry: 'aspear-berry' },
  { id: 'river-tree-3', kind: 'berryTree', position: [234, 196], zone: 'cuilan-river', berry: 'pecha-berry' },
  { id: 'river-tree-4', kind: 'berryTree', position: [213, 388], zone: 'cuilan-river', berry: 'passho-berry' },
  { id: 'river-tree-5', kind: 'berryTree', position: [192, 277], zone: 'cuilan-river', berry: 'wacan-berry' },
  { id: 'river-tree-6', kind: 'berryTree', position: [123, 355], zone: 'cuilan-river', berry: 'oran-berry' },
  { id: 'river-herb-1', kind: 'herb', position: [153, 190], zone: 'cuilan-river' },
  // river-delta
  { id: 'delta-shell-1', kind: 'shell', position: [130, 456], zone: 'river-delta' },
  { id: 'delta-shell-2', kind: 'shell', position: [190, 453], zone: 'river-delta' },
  { id: 'delta-shell-3', kind: 'shell', position: [223, 426], zone: 'river-delta' },
  { id: 'delta-tree-1', kind: 'berryTree', position: [166, 405], zone: 'river-delta', berry: 'lum-berry' },
  { id: 'delta-tree-2', kind: 'berryTree', position: [145, 429], zone: 'river-delta', berry: 'aspear-berry' },
  { id: 'delta-tree-3', kind: 'berryTree', position: [196, 393], zone: 'river-delta', berry: 'passho-berry' },
  { id: 'delta-tree-4', kind: 'berryTree', position: [130, 438], zone: 'river-delta', berry: 'rawst-berry' },
  // lanyuan-highlands
  { id: 'high-ore-1', kind: 'ore', position: [-49, -428], zone: 'lanyuan-highlands' },
  { id: 'high-ore-2', kind: 'ore', position: [-58, -332], zone: 'lanyuan-highlands' },
  { id: 'high-ore-3', kind: 'ore', position: [23, -269], zone: 'lanyuan-highlands' },
  { id: 'high-ore-4', kind: 'ore', position: [92, -434], zone: 'lanyuan-highlands' },
  { id: 'high-ore-5', kind: 'ore', position: [-64, -242], zone: 'lanyuan-highlands' },
  { id: 'high-tree-1', kind: 'berryTree', position: [233, -419], zone: 'lanyuan-highlands', berry: 'pomeg-berry' },
  { id: 'high-tree-2', kind: 'berryTree', position: [200, -305], zone: 'lanyuan-highlands', berry: 'kelpsy-berry' },
  { id: 'high-tree-3', kind: 'berryTree', position: [122, -347], zone: 'lanyuan-highlands', berry: 'qualot-berry' },
  { id: 'high-tree-4', kind: 'berryTree', position: [23, -395], zone: 'lanyuan-highlands', berry: 'hondew-berry' },
  { id: 'high-tree-5', kind: 'berryTree', position: [-100, -164], zone: 'lanyuan-highlands', berry: 'grepa-berry' },
  { id: 'high-tree-6', kind: 'berryTree', position: [161, -413], zone: 'lanyuan-highlands', berry: 'tamato-berry' },
  { id: 'high-herb-1', kind: 'herb', position: [-109, -380], zone: 'lanyuan-highlands' },
  // phantom-forest
  { id: 'forest-mush-1', kind: 'mushroom', position: [-200, -353], zone: 'phantom-forest' },
  { id: 'forest-mush-2', kind: 'mushroom', position: [-329, -263], zone: 'phantom-forest' },
  { id: 'forest-mush-3', kind: 'mushroom', position: [-155, -260], zone: 'phantom-forest' },
  { id: 'forest-mush-4', kind: 'mushroom', position: [-242, -212], zone: 'phantom-forest' },
  { id: 'forest-mush-5', kind: 'mushroom', position: [-308, -362], zone: 'phantom-forest' },
  { id: 'forest-mush-6', kind: 'mushroom', position: [-410, -203], zone: 'phantom-forest' },
  { id: 'forest-tree-1', kind: 'berryTree', position: [-254, -293], zone: 'phantom-forest', berry: 'wiki-berry' },
  { id: 'forest-tree-2', kind: 'berryTree', position: [-236, -419], zone: 'phantom-forest', berry: 'chesto-berry' },
  { id: 'forest-tree-3', kind: 'berryTree', position: [-332, -188], zone: 'phantom-forest', berry: 'occa-berry' },
  { id: 'forest-tree-4', kind: 'berryTree', position: [-122, -317], zone: 'phantom-forest', berry: 'rindo-berry' },
  { id: 'forest-tree-5', kind: 'berryTree', position: [-356, -320], zone: 'phantom-forest', berry: 'lum-berry' },
  { id: 'forest-tree-6', kind: 'berryTree', position: [-179, -203], zone: 'phantom-forest', berry: 'wiki-berry' },
  { id: 'forest-honey-1', kind: 'honey', position: [-389, -269], zone: 'phantom-forest' },
  // harbor-cliffs
  { id: 'cliff-ore-1', kind: 'ore', position: [335, -340], zone: 'harbor-cliffs' },
  { id: 'cliff-ore-2', kind: 'ore', position: [395, -244], zone: 'harbor-cliffs' },
  { id: 'cliff-ore-3', kind: 'ore', position: [281, -271], zone: 'harbor-cliffs' },
  { id: 'cliff-ore-4', kind: 'ore', position: [371, -160], zone: 'harbor-cliffs' },
  { id: 'cliff-tree-1', kind: 'berryTree', position: [317, -208], zone: 'harbor-cliffs', berry: 'yache-berry' },
  { id: 'cliff-tree-2', kind: 'berryTree', position: [260, -349], zone: 'harbor-cliffs', berry: 'chople-berry' },
  { id: 'cliff-tree-3', kind: 'berryTree', position: [431, -187], zone: 'harbor-cliffs', berry: 'occa-berry' },
  { id: 'cliff-tree-4', kind: 'berryTree', position: [341, -280], zone: 'harbor-cliffs', berry: 'tamato-berry' },
  { id: 'cliff-tree-5', kind: 'berryTree', position: [299, -388], zone: 'harbor-cliffs', berry: 'sitrus-berry' },
  { id: 'cliff-tree-6', kind: 'berryTree', position: [389, -298], zone: 'harbor-cliffs', berry: 'wacan-berry' },
  // west-beach
  { id: 'beach-shell-1', kind: 'shell', position: [-215, 437], zone: 'west-beach' },
  { id: 'beach-shell-2', kind: 'shell', position: [-287, 383], zone: 'west-beach' },
  { id: 'beach-shell-3', kind: 'shell', position: [-308, 293], zone: 'west-beach' },
  { id: 'beach-shell-4', kind: 'shell', position: [-311, 209], zone: 'west-beach' },
  { id: 'beach-shell-5', kind: 'shell', position: [-299, 338], zone: 'west-beach' },
  { id: 'beach-tree-1', kind: 'berryTree', position: [-281, 98], zone: 'west-beach', berry: 'figy-berry' },
  { id: 'beach-tree-2', kind: 'berryTree', position: [-260, 269], zone: 'west-beach', berry: 'razz-berry' },
  { id: 'beach-tree-3', kind: 'berryTree', position: [-236, 392], zone: 'west-beach', berry: 'oran-berry' },
  { id: 'beach-tree-4', kind: 'berryTree', position: [-260, 350], zone: 'west-beach', berry: 'sitrus-berry' },
  { id: 'beach-tree-5', kind: 'berryTree', position: [-284, 152], zone: 'west-beach', berry: 'passho-berry' },
  { id: 'beach-tree-6', kind: 'berryTree', position: [-269, 308], zone: 'west-beach', berry: 'leppa-berry' },
  // 蒲婆婆家后山（药草支线的延伸）
  { id: 'pu-herb-1', kind: 'herb', position: [-172, 414], zone: 'sprout-town' },
  { id: 'pu-herb-2', kind: 'herb', position: [-158, 418], zone: 'sprout-town' },
];
