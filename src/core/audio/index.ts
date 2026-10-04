/**
 * M1-20 · 音频模块入口。全局只有一个引擎实例（main.ts 创建并注册），
 * 各层通过 sfx() / jingle() 播放，未注册时静默（单元测试、工具页）。
 */
import type { SfxName } from './sfx';
import type { AudioEngine } from './AudioEngine';

export { AudioEngine } from './AudioEngine';
export type { Volumes, AudioDebugState } from './AudioEngine';
export { SFX_NAMES } from './sfx';
export type { SfxName } from './sfx';

let engine: AudioEngine | null = null;

export function registerAudio(e: AudioEngine | null): void {
  engine = e;
}

export function audio(): AudioEngine | null {
  return engine;
}

export function sfx(name: SfxName, vol = 1): void {
  engine?.sfx(name, vol);
}

export function jingle(id: string): Promise<void> {
  return engine ? engine.playJingle(id) : Promise.resolve();
}

export { initVoice, voiceLine, stopVoiceLine, preloadVoiceLine, hasVoice, setVoiceEnv, setVoiceEnabled, voiceStyle, voiceId } from './voice';
export type { VoiceSpace } from './voice';
export type { VoiceStyle } from './AudioEngine';
