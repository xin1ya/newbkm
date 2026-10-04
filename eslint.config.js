// @ts-check
/**
 * ESLint 9 扁平配置（ENG-002）。
 * 模块边界规则对应 docs/00-MASTER-CONTROL.md §4.3，违反即报错。
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/** 渲染 / 平台相关模块，纯逻辑层禁止依赖 */
const RENDER_LAYERS = ['core', 'platform', 'render', 'world', 'actors', 'scenes', 'ui'];

/**
 * @param {string[]} layers 禁止依赖的 src 子目录
 * @param {string} why 报错说明
 */
const forbidLayers = (layers, why) =>
  layers.flatMap((l) => [
    { group: [`@/${l}`, `@/${l}/*`, `**/${l}/*`], message: `${why}（§4.3）` },
  ]);

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'assets/', 'test-results/', 'playwright-report/', 'src/config/data/*.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
      // 除 platform/ 外禁止直接使用持久化 / 窗口 API（§2.3、§4.3）
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: '请通过 Platform.storage 读写（§2.3）' },
        { name: 'indexedDB', message: '请通过 Platform.storage 读写（§2.3）' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'close', message: '请调用 Platform.window.quit()' },
        { object: 'window', property: 'localStorage', message: '请通过 Platform.storage 读写' },
        { object: 'window', property: 'indexedDB', message: '请通过 Platform.storage 读写' },
      ],
    },
  },
  // ——— 模块边界 ———
  {
    files: ['src/systems/**/*.ts'],
    languageOptions: { globals: { ...globals.es2021 } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'three', message: 'systems/ 是纯逻辑层，禁止依赖 three（§4.3）' }],
          patterns: [
            { group: ['three/*', 'three-mesh-bvh'], message: 'systems/ 禁止依赖渲染库（§4.3）' },
            ...forbidLayers(RENDER_LAYERS, 'systems/ 禁止依赖渲染/平台层'),
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'indexedDB', 'fetch', 'requestAnimationFrame'].map((name) => ({
          name,
          message: 'systems/ 必须能在 Node 中运行，禁止访问浏览器全局（§4.3）',
        })),
      ],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'three', message: 'config/ 是纯数据' }],
          patterns: forbidLayers(RENDER_LAYERS, 'config/ 只能依赖 systems/ 的类型'),
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayers(['render', 'world', 'actors', 'scenes', 'ui'], 'core/ 不能依赖上层模块') }],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayers(['world', 'actors', 'scenes', 'ui'], 'render/ 不能依赖上层模块') }],
    },
  },
  {
    files: ['src/world/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayers(['actors', 'scenes', 'ui'], 'world/ 不能依赖上层模块；跨层通信用 core/events') }],
    },
  },
  {
    files: ['src/actors/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayers(['scenes', 'ui'], 'actors/ 不能依赖上层模块') }],
    },
  },
  {
    files: ['src/scenes/**/*.ts'],
    rules: {
      // scenes 可以使用 ui 组件（ui 位于最上层，但 scene 需要挂载 HUD）；ui 不得反向依赖 scenes
    },
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayers(['scenes', 'world', 'actors'], 'ui/ 通过事件总线与场景通信') }],
    },
  },
  {
    files: ['src/platform/**/*.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  // ——— Node 脚本与测试 ———
  {
    files: ['scripts/**/*.{ts,mjs}', 'tests/**/*.ts', '*.config.{ts,js}', 'tools/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  prettier,
);
