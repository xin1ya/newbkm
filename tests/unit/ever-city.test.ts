import { describe, expect, it } from 'vitest';
import { EVER_CITY, GLAZE_TOWNS } from '@/config/islands/towns/glaze';
import { ISLANDS } from '@/config/islands';
import { GLAZE_INTERIORS } from '@/config/interiors/glaze';
import { GLAZE_NPCS } from '@/config/npcs/glaze';
import { GLAZE_FURNITURE, GLAZE_LANDMARKS } from '@/config/interactions/glaze';

describe('M3-14 彩幽市', () => {
  const island = ISLANDS.glaze!;
  const poi = (id: string) => island.pois.find((p) => p.id === id);
  it('城镇已注册且含联盟大门', () => {
    expect(GLAZE_TOWNS).toContain(EVER_CITY);
    const gate = EVER_CITY.props.find((p) => p.type === 'league-gate');
    expect(gate?.position).toEqual([40, -880]);
  });
  it('门口 POI 与建筑 ref 对应', () => {
    for (const id of ['pokecenter-ever', 'mart-ever', 'ever-hotel', 'ever-flower-house']) {
      expect(poi(id), id).toBeTruthy();
      expect(EVER_CITY.props.some((p) => p.ref === id), id).toBe(true);
    }
  });
  it('室内与 NPC 齐全', () => {
    const ids = new Set(GLAZE_NPCS.map((n) => n.id));
    for (const iid of ['ever-hotel', 'ever-flower-house']) {
      const it = GLAZE_INTERIORS.find((i) => i.id === iid)!;
      expect(it).toBeTruthy();
      for (const r of it.rooms) for (const n of r.npcs ?? []) expect(ids.has(n.id), n.id).toBe(true);
    }
  });
  it('地标与家具都有互动', () => {
    const all = new Set([...GLAZE_FURNITURE, ...GLAZE_LANDMARKS].map((d) => d.id));
    for (const id of ['league-gate', 'ever-fountain', 'ever-noticeboard', 'ever-champion-statues', 'hotel-bed']) expect(all.has(id), id).toBe(true);
    const gate = GLAZE_LANDMARKS.find((d) => d.id === 'league-gate')!;
    expect(gate.byFlag?.[0]?.when).toBe('victory-road-cleared');
  });
});
