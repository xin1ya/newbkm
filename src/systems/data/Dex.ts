import type {
  AbilityData,
  ItemData,
  MoveData,
  NatureData,
  SpeciesData,
  TypeChartData,
  TypeId,
} from './types';

export interface DexSource {
  species: SpeciesData[];
  moves: MoveData[];
  types: TypeChartData;
  abilities: AbilityData[];
  items: ItemData[];
  natures: NatureData[];
}

/**
 * 只读数据索引。systems/ 的所有模块都通过 Dex 访问物种/招式等数据，
 * 数据本身在 config/data/index.ts 中加载（systems 不直接 import JSON，便于测试替换）。
 */
export class Dex {
  private readonly speciesMap = new Map<number, SpeciesData>();
  private readonly speciesByKey = new Map<string, SpeciesData>();
  private readonly moveMap = new Map<string, MoveData>();
  private readonly abilityMap = new Map<string, AbilityData>();
  private readonly itemMap = new Map<string, ItemData>();
  private readonly natureMap = new Map<string, NatureData>();
  readonly typeChart: TypeChartData;

  constructor(src: DexSource) {
    for (const s of src.species) {
      this.speciesMap.set(s.id, s);
      this.speciesByKey.set(s.key, s);
    }
    for (const m of src.moves) this.moveMap.set(m.id, m);
    for (const a of src.abilities) this.abilityMap.set(a.id, a);
    for (const i of src.items) this.itemMap.set(i.id, i);
    for (const n of src.natures) this.natureMap.set(n.id, n);
    this.typeChart = src.types;
  }

  species(id: number): SpeciesData {
    const s = this.speciesMap.get(id);
    if (!s) throw new Error(`Dex: 未知物种 #${id}（是否需要加入 scripts/data-manifest.ts 并重新 fetch-data？）`);
    return s;
  }
  hasSpecies(id: number): boolean {
    return this.speciesMap.has(id);
  }
  speciesKey(key: string): SpeciesData {
    const s = this.speciesByKey.get(key);
    if (!s) throw new Error(`Dex: 未知物种 ${key}`);
    return s;
  }
  allSpecies(): SpeciesData[] {
    return [...this.speciesMap.values()];
  }

  move(id: string): MoveData {
    const m = this.moveMap.get(id);
    if (!m) throw new Error(`Dex: 未知招式 ${id}`);
    return m;
  }
  hasMove(id: string): boolean {
    return this.moveMap.has(id);
  }
  allMoves(): MoveData[] {
    return [...this.moveMap.values()];
  }

  ability(id: string): AbilityData | undefined {
    return this.abilityMap.get(id);
  }
  item(id: string): ItemData | undefined {
    return this.itemMap.get(id);
  }
  nature(id: string): NatureData {
    const n = this.natureMap.get(id);
    if (!n) throw new Error(`Dex: 未知性格 ${id}`);
    return n;
  }
  natureIds(): string[] {
    return [...this.natureMap.keys()];
  }

  /** 单属性克制倍率 */
  typeMultiplier(attack: TypeId, defend: TypeId): number {
    return this.typeChart.chart[attack]?.[defend] ?? 1;
  }
  /** 对多属性目标的综合倍率 */
  effectiveness(attack: TypeId, defend: readonly TypeId[]): number {
    return defend.reduce((acc, t) => acc * this.typeMultiplier(attack, t), 1);
  }
  typeName(t: TypeId): string {
    return this.typeChart.names[t] ?? t;
  }
}
