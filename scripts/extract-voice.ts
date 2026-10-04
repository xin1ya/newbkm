/**
 * 剧情配音台词提取：剧情脚本（say / narrate / choice prompt）+ 全部 NPC 对话 → docs/audio/voice-lines.json
 * id = 文本 sha1 前 12 位（运行时按显示文本查表，与说话人无关）。
 * 用法：pnpm tsx scripts/extract-voice.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { STORY_SCRIPTS } from '../src/config/story';
import { ALL_NPCS } from '../src/config/npcs';
import { voiceId } from '../src/core/audio/voiceId';

interface Line {
  id: string;
  speaker: string;
  text: string;
  src: string;
}
const out = new Map<string, Line>();
const add = (speaker: string, text: string, src: string): void => {
  const id = voiceId(text);
  if (!id || out.has(id) || !/[\u4e00-\u9fff]/.test(text)) return;
  out.set(id, { id, speaker, text, src });
};

const walk = (steps: readonly unknown[], src: string): void => {
  for (const raw of steps) {
    const s = raw as Record<string, unknown>;
    if (s.kind === 'say') for (const l of s.lines as string[]) add((s.speaker as string) ?? '旁白', l, src);
    if (s.kind === 'narrate') for (const l of s.lines as string[]) add((s.voice as string) ?? '旁白', l, src);
    if (s.kind === 'choice') {
      if (typeof s.prompt === 'string') add('旁白', s.prompt, src);
      for (const o of s.options as Array<{ steps: unknown[] }>) walk(o.steps, src);
    }
    if (s.kind === 'battle') {
      walk((s.onWin as unknown[]) ?? [], src);
      walk((s.onLose as unknown[]) ?? [], src);
    }
  }
};
for (const sc of STORY_SCRIPTS.values()) walk(sc.steps, `story:${sc.id}`);

const collect = (v: unknown, speaker: string, src: string, key = ''): void => {
  if (typeof v === 'string') {
    if (/dialog|lines|say|text|intro|defeat|win|lose|after|before/i.test(key)) add(speaker, v, src);
    return;
  }
  if (Array.isArray(v)) return v.forEach((x) => collect(x, speaker, src, key));
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) collect(x, speaker, src, /dialog|lines/i.test(key) ? key : k);
};
for (const n of ALL_NPCS) collect(n, n.name, `npc:${n.id}`);

const list = [...out.values()];
mkdirSync('docs/audio', { recursive: true });
writeFileSync('docs/audio/voice-lines.json', JSON.stringify(list, null, 1));
const bySpeaker = new Map<string, { n: number; chars: number }>();
for (const l of list) {
  const b = bySpeaker.get(l.speaker) ?? { n: 0, chars: 0 };
  b.n++;
  b.chars += l.text.length;
  bySpeaker.set(l.speaker, b);
}
console.log('lines', list.length, 'chars', list.reduce((a, l) => a + l.text.length, 0));
for (const [k, b] of [...bySpeaker].sort((a, b) => b[1].chars - a[1].chars)) console.log(k, b.n, b.chars);
void createHash;
