/**
 * 计划文档 §9.3 · 田地位置（坐标经高度图 / 道路 / 摆放物检查：地面平整、不压路、离建筑 ≥ 3 m）。
 * 每块 2 m × 2 m，间距 2.6 m。id 固定（存档按 id 记录），新增请追加。
 */
import type { PlotDef } from '@/systems/farming';

export const FARM_PLOTS: ReadonlyArray<{ island: string; def: PlotDef }> = (
  [
    // 萌芽镇 · 自家后院（菜园北侧）
    { id: 'home-1', field: 'home', position: [-124.9, 333.5] },
    { id: 'home-2', field: 'home', position: [-122.3, 333.5] },
    { id: 'home-3', field: 'home', position: [-119.7, 333.5] },
    { id: 'home-4', field: 'home', position: [-117.1, 333.5] },
    // 翠澜镇 · 公共田（民居与菜园之间）
    { id: 'cuilan-1', field: 'cuilan', position: [-62.6, -118.3] },
    { id: 'cuilan-2', field: 'cuilan', position: [-60.0, -118.3] },
    { id: 'cuilan-3', field: 'cuilan', position: [-57.4, -118.3] },
    { id: 'cuilan-4', field: 'cuilan', position: [-62.6, -115.7] },
    { id: 'cuilan-5', field: 'cuilan', position: [-60.0, -115.7] },
    { id: 'cuilan-6', field: 'cuilan', position: [-57.4, -115.7] },
    // 港湾市 · 公共田（菜园西侧）
    { id: 'harbor-1', field: 'harbor', position: [315.7, 124.4] },
    { id: 'harbor-2', field: 'harbor', position: [318.3, 124.4] },
    { id: 'harbor-3', field: 'harbor', position: [315.7, 127.0] },
    { id: 'harbor-4', field: 'harbor', position: [318.3, 127.0] },
    { id: 'harbor-5', field: 'harbor', position: [315.7, 129.6] },
    { id: 'harbor-6', field: 'harbor', position: [318.3, 129.6] },
  ] as PlotDef[]
).map((def) => ({ island: 'sprout', def }));

export const FIELD_ZH: Record<PlotDef['field'], string> = { home: '自家田地', cuilan: '翠澜镇公共田', harbor: '港湾市公共田' };
