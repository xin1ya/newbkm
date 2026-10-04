/**
 * WLD-003 · 植被共享资源（几何体 + 材质），整岛一份，所有分块共用。
 */
import type * as THREE from 'three';
import { bakeTreeImpostors, type TreeImpostors } from './impostors';
import type { QualitySettings } from '@/render';
import { broadleafTreeGeometry, bushGeometry, flowerHeadGeometry, flowerStemGeometry, grassClumpGeometry, pineTreeGeometry, rockGeometry } from './geometries';
import type { EcologyMap, TreeSpecies } from '../ecology/biome';
import {
  birchTreeGeometry,
  blossomTreeGeometry,
  driftwoodGeometry,
  fallenLogGeometry,
  fernGeometry,
  leafLitterGeometry,
  lilyPadGeometry,
  mushroomGeometry,
  palmTreeGeometry,
  pebblesGeometry,
  petalLitterGeometry,
  needleLitterGeometry,
  coconutsGeometry,
  rootFlareGeometry,
  reedsGeometry,
  shellsGeometry,
  stumpGeometry,
  willowTreeGeometry,
  windPineGeometry,
} from './species';
import { createFoliageMaterial, foliageShared, setFoliageFade } from './materials';

export class FoliageLibrary {
  readonly grass = grassClumpGeometry();
  /** 性能 P1 · 远处草簇（3 片单段草叶） */
  readonly grassFar = grassClumpGeometry(3, 1);
  readonly flowerStem = flowerStemGeometry();
  readonly flowerHead = flowerHeadGeometry();
  readonly broadleaf = broadleafTreeGeometry(1);
  readonly broadleafLow = broadleafTreeGeometry(0);
  readonly pine = pineTreeGeometry(1);
  readonly pineLow = pineTreeGeometry(0);
  readonly bush = bushGeometry();
  readonly rock = rockGeometry(5);
  /** 生态自然化：新树种（高模 / 低模） */
  readonly species: Record<Exclude<TreeSpecies, 'broadleaf' | 'pine'>, [THREE.BufferGeometry, THREE.BufferGeometry]> = {
    palm: [palmTreeGeometry(1), palmTreeGeometry(0)],
    willow: [willowTreeGeometry(1), willowTreeGeometry(0)],
    birch: [birchTreeGeometry(1), birchTreeGeometry(0)],
    blossom: [blossomTreeGeometry(1), blossomTreeGeometry(0)],
    windpine: [windPineGeometry(1), windPineGeometry(0)],
  };
  /** 林下植物变体（每类几个随机变体，合并进每块一个静态网格） */
  readonly undergrowth = {
    fern: [1, 2, 3].map((k) => fernGeometry(200 + k)),
    mushroom: [mushroomGeometry(0, 210), mushroomGeometry(1, 211), mushroomGeometry(1, 212)],
    mushroomGlow: [mushroomGeometry(2, 213), mushroomGeometry(2, 214)],
    litter: [leafLitterGeometry(220, false), leafLitterGeometry(221, true), leafLitterGeometry(222, false)],
    log: [fallenLogGeometry(230), fallenLogGeometry(231)],
    stump: [stumpGeometry(240), stumpGeometry(241)],
    pebbles: [1, 2, 3].map((k) => pebblesGeometry(250 + k)),
    reeds: [1, 2, 3].map((k) => reedsGeometry(260 + k)),
    lily: [lilyPadGeometry(270, false), lilyPadGeometry(271, true), lilyPadGeometry(272, false)],
    driftwood: [driftwoodGeometry(280), driftwoodGeometry(281)],
    shells: [shellsGeometry(290), shellsGeometry(291)],
    // 树根部（按树种的树皮色，与实例色无关）
    roots: {
      broadleaf: rootFlareGeometry('#7c5236', 300),
      pine: rootFlareGeometry('#6e4a32', 301),
      birch: rootFlareGeometry('#d9d3c4', 302),
      blossom: rootFlareGeometry('#5e4034', 303),
      willow: rootFlareGeometry('#6e5338', 304),
      windpine: rootFlareGeometry('#6e4a32', 305),
    },
    petals: [petalLitterGeometry(310), petalLitterGeometry(311)],
    needles: [needleLitterGeometry(320), needleLitterGeometry(321)],
    coconuts: [coconutsGeometry(330), coconutsGeometry(331)],
  };
  /** 生态分区（由场景注入；为空时按旧规则散布） */
  ecology: EcologyMap | null = null;
  readonly undergrowthMaterial: THREE.MeshToonMaterial;
  readonly grassMaterial: THREE.MeshToonMaterial;
  readonly flowerMaterial: THREE.MeshToonMaterial;
  readonly treeMaterial: THREE.MeshToonMaterial;
  readonly bushMaterial: THREE.MeshToonMaterial;
  readonly rockMaterial: THREE.MeshToonMaterial;
  hullOutlines = true;
  /** 性能 P1 · 树木远景替身（场景创建后调用 bakeImpostors；未烘焙时远处仍用低模） */
  impostors: TreeImpostors | null = null;
  /** LOD1 分块中心离相机超过此距离时树木换成替身（米） */
  impostorDistance = 220;

  constructor(q: QualitySettings) {
    this.grassMaterial = createFoliageMaterial({ kind: 'grass', fade: [q.grassDistance * 0.7, q.grassDistance] });
    this.flowerMaterial = createFoliageMaterial({ kind: 'flower', fade: [q.grassDistance * 0.6, q.grassDistance * 0.9] });
    this.treeMaterial = createFoliageMaterial({ kind: 'tree', fade: null });
    this.bushMaterial = createFoliageMaterial({ kind: 'bush', fade: [q.grassDistance * 1.5, q.grassDistance * 2] });
    this.rockMaterial = createFoliageMaterial({ kind: 'bush', fade: null, swayScale: 0 });
    // 林下合并网格：没有实例原点，风摆按块中心计算，摆幅取小
    this.undergrowthMaterial = createFoliageMaterial({ kind: 'bush', fade: null, swayScale: 0.035 });
    this.applyQuality(q);
  }

  /** 用渲染器烘焙树木替身图集（每个场景一次，约 7 次小视口渲染） */
  bakeImpostors(renderer: THREE.WebGLRenderer): void {
    this.impostors?.dispose();
    this.impostors = bakeTreeImpostors(renderer, {
      broadleaf: this.broadleaf,
      pine: this.pine,
      birch: this.species.birch[0],
      blossom: this.species.blossom[0],
      willow: this.species.willow[0],
      palm: this.species.palm[0],
      windpine: this.species.windpine[0],
    });
  }

  applyQuality(q: QualitySettings): void {
    // 中档可视距离更短，替身更早接管
    this.impostorDistance = q.tier === 'high' ? 220 : 170;
    setFoliageFade(this.grassMaterial, q.grassDistance * 0.7, q.grassDistance);
    setFoliageFade(this.flowerMaterial, q.grassDistance * 0.6, q.grassDistance * 0.9);
    setFoliageFade(this.bushMaterial, q.grassDistance * 1.5, q.grassDistance * 2);
    this.hullOutlines = q.hullOutline;
  }

  /** 每帧：时间、推动者（玩家、跟随宝可梦、野生宝可梦） */
  update(time: number, pushers: ReadonlyArray<{ x: number; y: number; z: number; r: number }>): void {
    foliageShared.uTime.value = time;
    const arr = foliageShared.uPushers.value;
    for (let i = 0; i < arr.length; i++) {
      const p = pushers[i];
      if (p) arr[i]!.set(p.x, p.y, p.z, p.r);
      else arr[i]!.set(0, -9999, 0, 0);
    }
  }

  setWind(dirX: number, dirZ: number, strength: number): void {
    foliageShared.uWind.value.set(dirX, dirZ, strength, 1 + strength * 0.5);
  }

  dispose(): void {
    this.impostors?.dispose();
    for (const g of [this.grass, this.grassFar, this.flowerStem, this.flowerHead, this.broadleaf, this.broadleafLow, this.pine, this.pineLow, this.bush, this.rock]) g.dispose();
    for (const pair of Object.values(this.species)) for (const g of pair) g.dispose();
    const { roots, ...lists } = this.undergrowth;
    for (const g of Object.values(roots)) g.dispose();
    for (const list of Object.values(lists)) for (const g of list) g.dispose();
    for (const m of [this.grassMaterial, this.flowerMaterial, this.treeMaterial, this.bushMaterial, this.rockMaterial, this.undergrowthMaterial]) m.dispose();
  }
}

