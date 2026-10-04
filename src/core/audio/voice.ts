/**
 * 剧情配音：按显示文本查 manifest（public assets/audio/voice/manifest.json），播放预生成的普通话配音。
 * 音量 / 音色随场景与台词语气调整：
 * - 场景（setVoiceEnv）：室外（干声 + 轻微空气感）、室内（小房间混响）、道馆（大厅混响）、梦境（长混响 + 略降调 + 柔化）；
 *   夜晚整体压低音量（说话更轻）。
 * - 语气（按文本）：感叹句更响、省略号开头 / 结尾更轻、括号里的心声更轻更闷。
 * 播放时自动压低 BGM / 环境音；没有对应配音的台词保持静音（对话框照常打字音）。
 */
import { audio } from './index';
import type { VoiceStyle } from './AudioEngine';
import { voiceId } from './voiceId';

export { voiceId } from './voiceId';

export type VoiceSpace = 'outdoor' | 'interior' | 'hall' | 'dream';

interface ManifestEntry {
  f: string;
  v: string;
}

let manifest: Record<string, ManifestEntry> | null = null;
let loading: Promise<void> | null = null;
let base = 'audio/voice/';
let env: { space: VoiceSpace; night: number } = { space: 'outdoor', night: 0 };
let enabled = true;

/** 启动时调用（main.ts）；baseUrl 为 assets 根 URL */
export function initVoice(baseUrl: string): Promise<void> {
  base = `${baseUrl.replace(/\/?$/, '/')}audio/voice/`;
  loading ??= fetch(`${base}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ lines: Record<string, ManifestEntry> }>) : null))
    .then((m) => {
      manifest = m?.lines ?? {};
    })
    .catch(() => {
      manifest = {};
    });
  return loading;
}

export function setVoiceEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopVoiceLine();
}

/** 场景切换时设置（室外 / 室内 / 道馆 / 梦境）与夜晚程度 0–1 */
export function setVoiceEnv(space: VoiceSpace, night = env.night): void {
  env = { space, night };
}

export function voiceEnv(): Readonly<typeof env> {
  return env;
}

export function hasVoice(text: string): boolean {
  return enabled && !!manifest?.[voiceId(stripMarkup(text))];
}

/** 显示文本里可能带的 {名字} 等标记不参与匹配 */
function stripMarkup(t: string): string {
  return t.trim();
}

/** 按场景与语气计算播放效果（导出供单元测试） */
export function voiceStyle(text: string, space: VoiceSpace, night: number, opts: { dream?: boolean | undefined } = {}): VoiceStyle {
  const s: VoiceStyle = { gain: 1, rate: 1, lowpass: 16000, highpass: 80, reverb: 0.04, space: 'open' };
  const sp: VoiceSpace = opts.dream ? 'dream' : space;
  if (sp === 'interior') Object.assign(s, { reverb: 0.16, space: 'room', gain: 0.95 });
  else if (sp === 'hall') Object.assign(s, { reverb: 0.26, space: 'hall', gain: 1.02 });
  else if (sp === 'dream') Object.assign(s, { reverb: 0.55, space: 'dream', gain: 0.88, rate: 0.96, lowpass: 7000, highpass: 160 });
  // 夜晚：说话更轻
  if (sp === 'outdoor') s.gain *= 1 - 0.15 * Math.max(0, Math.min(1, night));
  const t = text.trim();
  const bangs = (t.match(/！|!/g) ?? []).length;
  if (bangs) s.gain *= Math.min(1.22, 1 + 0.1 * bangs);
  if (/^……|……$/.test(t)) s.gain *= 0.84;
  if (/^（.*）$/.test(t)) Object.assign(s, { gain: s.gain * 0.72, lowpass: Math.min(s.lowpass, 5200), reverb: Math.max(s.reverb, 0.12) });
  return s;
}

/** 播放一句台词（无配音时立即返回 false） */
export function voiceLine(text: string, opts: { dream?: boolean | undefined } = {}): boolean {
  const e = audio();
  const t = stripMarkup(text);
  const m = manifest?.[voiceId(t)];
  if (!enabled || !e || !m) return false;
  void e.playVoice(`${base}${m.f}`, voiceStyle(t, env.space, env.night, opts));
  return true;
}

/** 预取下一句，减少翻页时的延迟 */
export function preloadVoiceLine(text: string): void {
  const e = audio();
  const m = manifest?.[voiceId(stripMarkup(text))];
  if (e && m) void e.preloadVoice(`${base}${m.f}`);
}

export function stopVoiceLine(): void {
  audio()?.stopVoice();
}
