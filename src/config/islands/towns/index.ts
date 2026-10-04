/**
 * M1-02 / M1-03 / M1-04 · 萌芽群岛三座城镇的手工布局。
 * gen-sprout 读取后：压平建筑地块、刷小路材质、写入 props.json；小路同时并入岛屿道路（小地图可见）。
 */
import type { TownLayout } from '../types';
import { SPROUT_TOWN } from './sprout-town';
import { CUILAN_TOWN, CUILAN_DECK_Y } from './cuilan-town';
import { HARBOR_CITY, HARBOR_QUAY_Y } from './harbor-city';

export const SPROUT_TOWNS: TownLayout[] = [SPROUT_TOWN, CUILAN_TOWN, HARBOR_CITY];
export { CUILAN_DECK_Y, HARBOR_QUAY_Y };
export { doorBack } from './helpers';
