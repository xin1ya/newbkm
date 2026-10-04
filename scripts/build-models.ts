/**
 * M1-21 · 宝可梦模型构建：Blender 导出的原始 glb（art-source/pokemon/<id>/export/<id>.glb + .meta.json）
 * → 去重 / 清理 / 焊接 / meshopt 重排 + 量化 + EXT_meshopt_compression → assets/models/pokemon/<id>.glb
 * → 汇总清单 assets/models/pokemon/manifest.json（游戏启动时读取，决定哪些物种有手工模型）。
 * 用法：pnpm models:build [id ...]   （不带参数 = 全部）
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'art-source', 'pokemon');
const OUT = join(ROOT, 'assets', 'models', 'pokemon');

export interface ModelMeta {
  id: number;
  name: string;
  heightM: number;
  tris: number;
  clips: string[];
  hitTime: Record<string, number>;
  /** 身体结构（动画模板）：quadruped / biped / bird / fish / serpent / star / jelly / larva / cocoon / fox */
  plan?: string;
  shiny?: string;
  fit?: 'height' | 'length';
}

export interface ManifestEntry extends ModelMeta {
  file: string;
  bytes: number;
  rawBytes: number;
}

async function main(): Promise<void> {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const only = new Set(process.argv.slice(2));
  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'manifest.json');
  const prev: ManifestEntry[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { models: ManifestEntry[] }).models
    : [];
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const dir of readdirSync(SRC).sort()) {
    const key = dir; // 例 155_cyndaquil
    const exp = join(SRC, dir, 'export');
    const raw = join(exp, `${key}.glb`);
    const metaPath = join(exp, `${key}.meta.json`);
    if (!existsSync(raw) || !existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as ModelMeta;
    if (only.size && !only.has(String(meta.id)) && !only.has(key)) {
      if (!byId.has(meta.id)) console.warn(`[models] 跳过 ${key}（清单里也没有）`);
      continue;
    }
    const doc = await io.read(raw);
    await doc.transform(
      dedup(),
      prune({ keepAttributes: false }),
      weld(),
      reorder({ encoder: MeshoptEncoder }),
      // 骨骼动画：蒙皮权重 / 关节保持精度，位置 14 位、法线 10 位、UV 12 位
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
    );
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const file = `${key}.glb`;
    await io.write(join(OUT, file), doc);
    if (meta.shiny) copyFileSync(join(exp, meta.shiny), join(OUT, meta.shiny));
    writeFileSync(join(OUT, `${key}.meta.json`), JSON.stringify(meta, null, 2));
    const entry: ManifestEntry = { ...meta, file, bytes: statSync(join(OUT, file)).size, rawBytes: statSync(raw).size };
    byId.set(meta.id, entry);
    console.log(
      `[models] ${key}: ${(entry.rawBytes / 1024).toFixed(0)} KB → ${(entry.bytes / 1024).toFixed(0)} KB，${meta.tris} 面，${meta.clips.length} 段动画`,
    );
  }
  const models = [...byId.values()].sort((a, b) => a.id - b.id);
  writeFileSync(manifestPath, JSON.stringify({ version: 1, models }, null, 2));
  console.log(`[models] 清单：${models.length} 个模型 → ${manifestPath}`);
  await buildCharacters(io, only);
}

/** 人物模型（art-source/characters/<key>/export → assets/models/characters + manifest.json）。id 为字符串（如 hero_m）。 */
async function buildCharacters(io: NodeIO, only: Set<string>): Promise<void> {
  const SRC_C = join(ROOT, 'art-source', 'characters');
  const OUT_C = join(ROOT, 'assets', 'models', 'characters');
  if (!existsSync(SRC_C)) return;
  mkdirSync(OUT_C, { recursive: true });
  const manifestPath = join(OUT_C, 'manifest.json');
  type CharEntry = Omit<ManifestEntry, 'id'> & { id: string };
  const prev: CharEntry[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { models: CharEntry[] }).models
    : [];
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const key of readdirSync(SRC_C).sort()) {
    const exp = join(SRC_C, key, 'export');
    const raw = join(exp, `${key}.glb`);
    const metaPath = join(exp, `${key}.meta.json`);
    if (!existsSync(raw) || !existsSync(metaPath)) continue;
    if (only.size && !only.has(key)) continue;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Omit<ModelMeta, 'id'> & { id: string };
    const doc = await io.read(raw);
    await doc.transform(
      dedup(),
      prune({ keepAttributes: false }),
      weld(),
      reorder({ encoder: MeshoptEncoder }),
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
    );
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const file = `${key}.glb`;
    await io.write(join(OUT_C, file), doc);
    writeFileSync(join(OUT_C, `${key}.meta.json`), JSON.stringify(meta, null, 2));
    const entry: CharEntry = { ...meta, file, bytes: statSync(join(OUT_C, file)).size, rawBytes: statSync(raw).size };
    byId.set(meta.id, entry);
    console.log(`[models] 人物 ${key}: ${(entry.rawBytes / 1024).toFixed(0)} KB → ${(entry.bytes / 1024).toFixed(0)} KB，${meta.tris} 面`);
  }
  const models = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(manifestPath, JSON.stringify({ version: 1, models }, null, 2));
  console.log(`[models] 人物清单：${models.length} 个 → ${manifestPath}`);
}

void main();
