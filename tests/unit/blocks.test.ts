import { describe, expect, it } from 'vitest';
import { BERRY_BY_ID, type BerryDef } from '@/config/berries';
import {
  BLOCK_BOX_CAPACITY,
  CALM_CAPTURE_BONUS,
  activeLure,
  blockMainFlavor,
  calmAlpha,
  cookBlock,
  feedBlock,
  gradeHit,
  hitWindows,
  lureWeight,
  minigameQuality,
  MINIGAME_ROUNDS,
  natureTaste,
  placeLure,
  SHEEN_MAX,
  storeBlock,
  type PokeBlock,
} from '@/systems/blocks';
import { createNewGame, deserializeSave, serializeSave } from '@/systems/state';
import { entryWeight } from '@/systems/encounters';
import { INTERIORS } from '@/config/interiors';
import { SPROUT_FURNITURE } from '@/config/interactions/sprout';
import type { PokemonInstance } from '@/systems/pokemon';
import type { Dex } from '@/systems/data/Dex';

const B = (id: string): BerryDef => BERRY_BY_ID.get(id)!;
const newGame = () => createNewGame({ name: '小翠', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });
const mon = (): PokemonInstance => ({ uid: 'm', speciesId: 25, level: 10, exp: 0, nature: 'adamant', ability: 'static', gender: 'male', shiny: false, ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, moves: [], hp: 30, status: null, heldItem: null, friendship: 70, ball: 'poke-ball' });

describe('计划文档 §9.5 能量方块', () => {
  it('小游戏判定：窗口逐轮缩小，正中完美、边缘不错、偏离失误；质量 = (完美 + 0.5 × 不错) / 8', () => {
    expect(hitWindows(7).good).toBeLessThan(hitWindows(0).good);
    expect(gradeHit(0, 0)).toBe('perfect');
    expect(gradeHit(0.3, 0)).toBe('good');
    expect(gradeHit(1, 0)).toBe('miss');
    expect(gradeHit(Math.PI * 2 + 0.05, 0)).toBe('perfect');
    expect(minigameQuality(Array(MINIGAME_ROUNDS).fill('perfect'))).toBe(1);
    expect(minigameQuality(['good', 'good', 'miss', 'miss', 'miss', 'miss', 'miss', 'miss'])).toBeCloseTo(1 / 8);
  });

  it('制作：风味随质量变化，顺滑度随质量变高；相同树果 → 黑色方块；3 种以上风味 → 彩虹', () => {
    const ber = [B('cheri-berry'), B('figy-berry')];
    const lo = cookBlock(ber, 0, 'a');
    const hi = cookBlock(ber, 1, 'b');
    expect(hi.level).toBeGreaterThan(lo.level);
    expect(hi.smooth).toBeGreaterThan(lo.smooth);
    expect(blockMainFlavor(hi)).toBe('spicy');
    expect(hi.kind === 'red' || hi.kind === 'gold').toBe(true);
    expect(cookBlock([B('cheri-berry'), B('cheri-berry')], 1, 'c').kind).toBe('black');
    const rainbow = cookBlock([B('cheri-berry'), B('chesto-berry'), B('pecha-berry'), B('rawst-berry')], 0.8, 'd');
    expect(rainbow.kind).toBe('rainbow');
  });

  it('喂食：性格喜欢的口味翻倍（固执喜欢辣、讨厌涩），光泽满了吃不下', () => {
    expect(natureTaste({ plus: 'atk', minus: 'spa' })).toEqual({ likes: 'spicy', dislikes: 'dry' });
    expect(natureTaste({ plus: null, minus: null })).toEqual({ likes: null, dislikes: null });
    const spicy: PokeBlock = { uid: 's', kind: 'red', flavor: { spicy: 30, dry: 0, sweet: 0, bitter: 0, sour: 0 }, level: 30, smooth: 60 };
    const dry: PokeBlock = { uid: 'd', kind: 'blue', flavor: { spicy: 0, dry: 30, sweet: 0, bitter: 0, sour: 0 }, level: 30, smooth: 60 };
    const a = mon();
    const ra = feedBlock(a, spicy, { plus: 'atk', minus: 'spa' }, '皮卡丘');
    const b = mon();
    const rb = feedBlock(b, dry, { plus: 'atk', minus: 'spa' }, '皮卡丘');
    expect(ra.taste).toBe('like');
    expect(rb.taste).toBe('dislike');
    expect(a.condition!.cool).toBeGreaterThan(b.condition!.beauty * 3);
    expect(ra.friendship).toBeGreaterThan(rb.friendship);
    a.condition!.sheen = SHEEN_MAX;
    expect(feedBlock(a, spicy, { plus: 'atk', minus: 'spa' }, '皮卡丘').ok).toBe(false);
  });

  it('方块盒容量 40；存档保存方块与诱饵，损坏的方块被移除', () => {
    const s = newGame();
    const blk = cookBlock([B('cheri-berry'), B('oran-berry')], 0.5, 'x');
    for (let i = 0; i < BLOCK_BOX_CAPACITY; i++) expect(storeBlock(s, { ...blk, uid: `b${i}` })).toBe(true);
    expect(storeBlock(s, { ...blk, uid: 'over' })).toBe(false);
    placeLure(s, blk, 'sprout', 10, 20, 100);
    const back = deserializeSave(serializeSave(s)).state;
    expect(back.blocks?.length).toBe(BLOCK_BOX_CAPACITY);
    expect(back.lure?.flavor).toBe(blockMainFlavor(blk));
    const broken = JSON.parse(serializeSave(s));
    broken.data.blocks[0] = { uid: 1 };
    expect(deserializeSave(JSON.stringify(broken)).state.blocks?.length).toBe(BLOCK_BOX_CAPACITY - 1);
  });

  it('诱饵：半径内、时限内生效，偏好物种权重 ×3；过期自动清除', () => {
    const s = newGame();
    const blk: PokeBlock = { uid: 'l', kind: 'red', flavor: { spicy: 20, dry: 0, sweet: 0, bitter: 0, sour: 0 }, level: 20, smooth: 50 };
    placeLure(s, blk, 'sprout', 0, 0, 1000);
    expect(activeLure(s, 'sprout', 10, 10, 1050)).toBe('spicy');
    expect(activeLure(s, 'sprout', 100, 0, 1050)).toBeNull();
    expect(activeLure(s, 'tide', 0, 0, 1050)).toBeNull();
    expect(lureWeight(['fire'], 'spicy')).toBe(3);
    expect(lureWeight(['water'], 'spicy')).toBe(1);
    const fakeDex = { hasSpecies: () => true, species: () => ({ types: ['fire'] }) } as unknown as Dex;
    const e = { speciesId: 4, weight: 10, levels: [3, 5] as [number, number] };
    expect(entryWeight(e, { time: 'day', weather: 'fog', method: 'visible', lure: 'spicy' }, fakeDex)).toBe(30);
    expect(activeLure(s, 'sprout', 0, 0, 1200)).toBeNull();
    expect(s.lure).toBeUndefined();
  });

  it('安抚头目：合口味 / 高等级安抚，不合口味不理睬，黑色方块激怒；捕获加成 ×1.3', () => {
    const sweet: PokeBlock = { uid: 'w', kind: 'pink', flavor: { spicy: 0, dry: 0, sweet: 20, bitter: 0, sour: 0 }, level: 20, smooth: 50 };
    const sour: PokeBlock = { ...sweet, kind: 'yellow', flavor: { spicy: 0, dry: 0, sweet: 0, bitter: 0, sour: 20 } };
    expect(calmAlpha(['normal'], sweet)).toBe('calmed');
    expect(calmAlpha(['water'], sour)).toBe('ignored');
    expect(calmAlpha(['water'], { ...sour, level: 45 })).toBe('calmed');
    expect(calmAlpha(['water'], { ...sour, kind: 'black' })).toBe('angered');
    expect(CALM_CAPTURE_BONUS).toBeCloseTo(1.3);
  });

  it('自家 1F 有能量方块机，互动打开方块机', () => {
    const house = INTERIORS['sprout-player-house']!;
    const f = house.rooms.find((r) => r.id === '1f')!.furniture.find((x) => x.type === 'blender');
    expect(f?.interact).toBe('block-machine-home');
    const def = SPROUT_FURNITURE.find((d) => d.id === 'block-machine-home')!;
    expect(def.effects?.some((e) => e.kind === 'block-machine')).toBe(true);
  });
});
