// M3-29 人物占位快照：node tests/tools/shot-looks.mjs <url> <out.png>（需 vite 已在运行）
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 520 } });
await p.goto(url, { timeout: 120000 });
await p.waitForTimeout(6000);
await p.screenshot({ path: out });
await b.close();
