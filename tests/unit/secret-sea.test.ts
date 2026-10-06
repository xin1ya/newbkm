/** M4-02 秘境航线：渡船脚本、船票门控、落点落在陆地、到达触发与栈桥构件 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import { SECRET_FERRY_ARRIVAL } from '@/config/story/secret';
import { STORY_SCRIPTS, STORY_TRIGGERS } from '@/config/story';
import type { StoryStep } from '@/systems/story';
import { SECRET } from '@/config/islands/secret';
import { GLAZE } from '@/config/islands/glaze';
import { INTERACTION_BY_ID } from '@/config/interactions';
import { resolvePages } from '@/systems/interaction';

function travelStep(steps: StoryStep[]): Extract<StoryStep, { kind: 'travel' }> {
  const s = steps.find((q) => q.kind === 'travel');
  if (!s || s.kind !== 'travel') throw new Error('缺 travel 步');
  return s;
}
function choiceBranch(steps: StoryStep[]): StoryStep[] {
  const s = steps[0]!;
  if (s.kind !== 'choice') throw new Error('首步应为 choice');
  return s.options[0]!.steps;
}
/** 读取岛屿 height.png，返回 (x, z) → 高度（米） */
function heightLoader(island: string): (x: number, z: number) => number {
  const buf = decode(readFileSync(join(process.cwd(), 'assets', 'islands', island, 'height.png')));
  const [range] = island === 'secret' ? [[-40, 160]] : [[-40, 240]];
  const data = buf.data as Uint16Array;
  const N = buf.width;
  return (x, z) => {
    const i = Math.round(((x + 1024) / 2048) * (N - 1));
    const j = Math.round(((z + 1024) / 2048) * (N - 1));
    return range[0]! + (data[j * N + i]! / 65535) * (range[1]! - range[0]!);
  };
}

describe('M4-02 秘境航线', () => {
  it('去程 / 回程都是「确认乘船」选择；travel 落到码头附近', () => {
    const go = STORY_SCRIPTS.get('ferry-to-secret')!;
    const back = STORY_SCRIPTS.get('ferry-to-glaze')!;
    expect(go.steps[0]!.kind).toBe('choice');
    expect(back.steps[0]!.kind).toBe('choice');
    const t1 = travelStep(choiceBranch(go.steps));
    expect([t1.island, t1.x, t1.z]).toEqual(['secret', SECRET_FERRY_ARRIVAL.secret.x, SECRET_FERRY_ARRIVAL.secret.z]);
    const t2 = travelStep(choiceBranch(back.steps));
    expect([t2.island, t2.x, t2.z]).toEqual(['glaze', SECRET_FERRY_ARRIVAL.glaze.x, SECRET_FERRY_ARRIVAL.glaze.z]);
  });

  it('落点落在陆地（不在水里 / 不悬空）', () => {
    const hs = heightLoader('secret');
    const hg = heightLoader('glaze');
    expect(hs(SECRET_FERRY_ARRIVAL.secret.x, SECRET_FERRY_ARRIVAL.secret.z)).toBeGreaterThan(0.3);
    expect(hg(SECRET_FERRY_ARRIVAL.glaze.x, SECRET_FERRY_ARRIVAL.glaze.z)).toBeGreaterThan(0.3);
  });

  it('琉璃镇码头：无「秘境船票」只显示门禁文字（不触发登船），持票后可登船', () => {
    const def = INTERACTION_BY_ID.get('glaze-dock')!;
    expect(def).toBeTruthy();
    const locked = resolvePages(def, {}, false);
    expect(locked.conditional).toBe(true);
    expect(locked.pages.join()).toContain('秘境船票');
    const open = resolvePages(def, { 'secret-ferry-ticket': true }, false);
    expect(open.conditional).toBe(false);
    expect(def.effects?.some((e) => e.kind === 'story' && e.script === 'ferry-to-secret')).toBe(true);
  });

  it('秘境岛码头可返回；两岛都注册了 dock POI', () => {
    expect(SECRET.pois.some((p) => p.id === 'secret-dock' && p.kind === 'dock')).toBe(true);
    expect(GLAZE.pois.some((p) => p.id === 'glaze-dock' && p.kind === 'dock')).toBe(true);
    const def = INTERACTION_BY_ID.get('secret-dock')!;
    expect(def.effects?.some((e) => e.kind === 'story' && e.script === 'ferry-to-glaze')).toBe(true);
  });

  it('抵达秘境岛触发第五章标题卡（一次性）', () => {
    const t = STORY_TRIGGERS.find((q) => q.id === 'secret-arrival')!;
    expect(t.island).toBe('secret');
    expect(t.doneFlag).toBe('secret-arrival-card');
    const [, , ddock] = SECRET.pois.find((p) => p.id === 'secret-dock')!.position as [number, number, number];
    const [dx, dz] = [60, ddock];
    expect(Math.hypot(t.position[0] - dx, t.position[1] - dz)).toBeLessThanOrEqual(t.radius);
    const s = STORY_SCRIPTS.get('secret-arrival')!;
    expect(s.steps.some((q) => q.kind === 'card')).toBe(true);
    expect(s.steps.some((q) => q.kind === 'flag' && q.set === 'secret-arrival-card')).toBe(true);
  });

  it('栈桥与渡轮构件已生成', () => {
    const props = JSON.parse(readFileSync(join(process.cwd(), 'assets', 'islands', 'secret', 'props.json'), 'utf8')).props as Array<{ type: string; position: [number, number] }>;
    const near = (p: (typeof props)[number]) => Math.hypot(p.position[0] - 60, p.position[1] - 545) < 26;
    expect(props.some((p) => p.type === 'deck' && near(p))).toBe(true);
    expect(props.some((p) => p.type === 'boat' && near(p))).toBe(true);
  });
});
