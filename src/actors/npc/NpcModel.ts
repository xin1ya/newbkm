/**
 * M1-06 · NPC 造型：把 NpcLook 模板翻译成 TrainerModel 的配色与部件（设计 §8.5：按身份区分服装与配色）。
 * 手工人物 glb 到位后（ART-003 人物清单），同一 look 改为加载对应 glb，调用方不变。
 */
import { DEFAULT_TRAINER, TrainerModel } from '@/actors/player/TrainerModel';
import type { NpcAppearance, NpcLook, TrainerPalette, TrainerStyle } from '@/systems/npcs';

interface LookPreset {
  palette: Partial<TrainerPalette>;
  style: Partial<TrainerStyle>;
  accent?: string;
}

const NO_BAG = { bag: false } as const;

export const LOOK_PRESETS: Record<NpcLook, LookPreset> = {
  mom: {
    palette: { hair: '#6b3f2a', jacket: '#f29a8e', shirt: '#fff5ec', pants: '#f7d7b5', shoes: '#b0685a' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'dress', apron: true },
    accent: '#ffffff',
  },
  professor: {
    palette: { hair: '#ece8e2', jacket: '#f6f6f2', shirt: '#6f8fc0', pants: '#4a4a5c', shoes: '#5a4a44' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'long', glasses: true, stoop: 0.08 },
  },
  aide: {
    palette: { hair: '#2b2b35', jacket: '#f6f6f2', shirt: '#9fc4a8', pants: '#3d4a6a', shoes: '#3a3a44' },
    style: { ...NO_BAG, hat: 'none', hair: 'short', coat: 'long', glasses: true },
  },
  elder: {
    palette: { hair: '#e6e2dc', skin: '#f1ccb0', jacket: '#8a6aa0', shirt: '#f4ecd8', pants: '#6a4a7a', shoes: '#4a3a3a' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'dress', cane: true, stoop: 0.28, scale: 0.92 },
  },
  nurse: {
    palette: { hair: '#f08aa8', cap: '#ffffff', jacket: '#ffc2d1', shirt: '#ffffff', pants: '#ffc2d1', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'nurse', hair: 'long', coat: 'dress' },
    accent: '#e8486a',
  },
  clerk: {
    palette: { hair: '#3b2b2a', cap: '#3a7bd5', capBrim: '#ffffff', jacket: '#7fb3e8', shirt: '#ffffff', pants: '#2f3a5a' },
    style: { ...NO_BAG, hat: 'cap', apron: true },
    accent: '#3a7bd5',
  },
  'villager-m': {
    palette: { hair: '#3b2b2a', jacket: '#6aa05a', shirt: '#f4efe6', pants: '#5a4a3a', shoes: '#4a3a2a' },
    style: { ...NO_BAG, hat: 'none', hair: 'short' },
  },
  'villager-f': {
    palette: { hair: '#5a3a2a', jacket: '#e8a0b4', shirt: '#ffffff', pants: '#f4d4c4', shoes: '#c06a7a' },
    style: { ...NO_BAG, hat: 'none', hair: 'long', coat: 'dress' },
  },
  'child-m': {
    palette: { hair: '#2b2020', cap: '#f2b541', capBrim: '#ffffff', jacket: '#e8484a', pants: '#3d5a8a', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'cap', scale: 0.72 },
  },
  'child-f': {
    palette: { hair: '#8a4b2a', jacket: '#ffd35a', pants: '#e87a9a', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'none', hair: 'pony', coat: 'dress', scale: 0.7 },
  },
  fisher: {
    palette: { hair: '#3a3030', cap: '#e0b040', capBrim: '#c89a30', jacket: '#f2c230', shirt: '#3a5a7a', pants: '#34495e', shoes: '#2a2a2a' },
    style: { ...NO_BAG, hat: 'bucket', beard: true },
  },
  sailor: {
    palette: { hair: '#3b2b2a', cap: '#ffffff', jacket: '#f4f4f4', shirt: '#2f4f7f', pants: '#23395d', shoes: '#1f1f2a' },
    style: { ...NO_BAG, hat: 'sailor' },
    accent: '#23395d',
  },
  vendor: {
    palette: { hair: '#2b2020', cap: '#d9534f', jacket: '#d96a4a', shirt: '#fff5ec', pants: '#4a3a2a' },
    style: { ...NO_BAG, hat: 'bandana', apron: true },
    accent: '#f4efe6',
  },
  hiker: {
    palette: { hair: '#3a2a20', cap: '#8a6a42', capBrim: '#7a5a36', jacket: '#a0663a', shirt: '#e8dcc4', pants: '#5a5040', shoes: '#4a3a2a', bag: '#6a8a4a' },
    style: { hat: 'bucket', beard: true, scale: 1.06, bag: true },
  },
  'bug-catcher': {
    palette: { hair: '#2b2020', cap: '#8fbf5a', capBrim: '#7aa84a', jacket: '#b8d88a', shirt: '#ffffff', pants: '#e0c070', bag: '#6a8a4a' },
    style: { hat: 'bucket', scale: 0.76, bag: true },
  },
  guide: {
    palette: { hair: '#3b2b2a', cap: '#3a8f8f', capBrim: '#ffffff', jacket: '#3a8f8f', shirt: '#ffffff', pants: '#2f3a4a' },
    style: { ...NO_BAG, hat: 'cap' },
  },
  swimmer: {
    palette: { hair: '#2b2020', jacket: '#2f7fd9', shirt: '#2f7fd9', pants: '#1f5fa8', shoes: '#f4f4f4' },
    style: { ...NO_BAG, hat: 'none', hair: 'spiky' },
  },
  'leader-water': {
    palette: { hair: '#3fa0d9', jacket: '#2b6cb0', shirt: '#e0f4ff', pants: '#1d3557', shoes: '#f4f4f4' },
    style: { ...NO_BAG, hat: 'none', hair: 'long', coat: 'long' },
  },
  youngster: {
    palette: { hair: '#2b2020', cap: '#3a7bd5', capBrim: '#ffffff', jacket: '#f2f2f2', shirt: '#3a7bd5', pants: '#e0b040', shoes: '#e8484a' },
    style: { ...NO_BAG, hat: 'cap', hair: 'short', scale: 0.8 },
    accent: '#3a7bd5',
  },
  lass: {
    palette: { hair: '#c0703a', jacket: '#e86a8a', shirt: '#ffffff', pants: '#3a4a7a', shoes: '#2a2a3a' },
    style: { ...NO_BAG, hat: 'none', hair: 'pony', coat: 'dress', scale: 0.84 },
    accent: '#e86a8a',
  },
  camper: {
    palette: { hair: '#5a3a2a', cap: '#6a8a4a', capBrim: '#5a7a3a', jacket: '#7a9a5a', shirt: '#f4efe6', pants: '#8a6a42', shoes: '#4a3a2a', bag: '#c0703a' },
    style: { hat: 'bucket', hair: 'long', scale: 0.86, bag: true },
  },
  guard: {
    palette: { hair: '#2b2020', cap: '#23395d', capBrim: '#23395d', jacket: '#34568b', shirt: '#ffffff', pants: '#23395d', shoes: '#1f1f2a' },
    style: { ...NO_BAG, hat: 'cap' },
  },
};

export function createNpcModel(a: NpcAppearance): TrainerModel {
  const preset = LOOK_PRESETS[a.look];
  const palette: TrainerPalette = { ...DEFAULT_TRAINER, ...preset.palette, ...a.palette };
  const style = { ...preset.style, ...a.style };
  return new TrainerModel(palette, style, { accent: a.accent ?? preset.accent });
}
