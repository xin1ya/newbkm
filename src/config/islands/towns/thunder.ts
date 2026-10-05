/**
 * M3-07 ~ M3-10 雷鸣群岛四座城镇（手工布局）。
 *
 * 当前（M3-02 地形批）：先放压平地块与码头，保证地形生成、登岸与城镇区域可用；
 * 建筑 / 小品在 B 批逐镇补齐（门口坐标与 thunder.ts 的 POI 一一对应）。
 */
import type { TownLayout } from '../types';
import { deck } from './helpers';

export const THUNDER_TOWN: TownLayout = {
  id: 'thunder-town',
  zone: 'thunder-town',
  paths: [],
  pads: [{ position: [-480, 410], size: [190, 150], blend: 14 }],
  props: [
    // 西岸码头（台地下方，11 m，坡道上镇）
    deck([-622, 420], 32, 7, 2.2, 'nsw', [['e', 0, 7]]),
    { type: 'boat', ref: 'thunder-ferry', position: [-640, 436], yaw: Math.PI / 2, size: [6, 4.5, 16], y: 0, color: '#f5f5f0', roof: '#4b4a78', collide: true },
  ],
};

export const DAWN_TOWN: TownLayout = {
  id: 'dawn-town',
  zone: 'dawn-town',
  paths: [],
  pads: [{ position: [400, 440], size: [200, 150], blend: 14 }],
  props: [],
};

export const SNOW_TOWN: TownLayout = {
  id: 'snow-town',
  zone: 'snow-town',
  paths: [],
  pads: [{ position: [125, -170], size: [200, 140], blend: 16 }],
  props: [],
};

export const LARK_TOWN: TownLayout = {
  id: 'lark-town',
  zone: 'lark-town',
  paths: [],
  pads: [{ position: [320, -650], size: [220, 120], blend: 24 }],
  props: [
    // 北岸码头（崖路下到海湾）
    deck([-150, -712], 7, 30, 1.8, 'ew', [['s', 0, 7]]),
  ],
};

export const THUNDER_TOWNS: TownLayout[] = [THUNDER_TOWN, DAWN_TOWN, SNOW_TOWN, LARK_TOWN];
