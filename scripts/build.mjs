#!/usr/bin/env node
/**
 * 构建脚本：压缩 JS / CSS，产出可直接部署的 dist/
 *
 *   npm run build
 *
 * 做的事：
 *   1. 清空 dist/
 *   2. app.js → dist/app.min.js（esbuild minify）
 *   3. styles.css → dist/styles.min.css（esbuild minify）
 *   4. index.html 复制并改写引用，加上构建时间戳
 *   5. 复制运行时要用的静态资源（外壳 PNG / 官方图标 SVG / 示例视频）
 *   6. 打印压缩前后体积与 gzip 估算
 */
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

async function sizeOf(p) {
  try { return (await stat(p)).size; } catch { return 0; }
}

async function copyDir(from, to, filter = () => true) {
  await mkdir(to, { recursive: true });
  let bytes = 0;
  for (const name of await readdir(from)) {
    const src = path.join(from, name);
    const info = await stat(src);
    if (!info.isFile() || !filter(name)) continue;
    await copyFile(src, path.join(to, name));
    bytes += info.size;
  }
  return bytes;
}

const rows = [];
const record = (label, before, after, afterBuf) => {
  rows.push({ label, before, after, gzip: afterBuf ? gz(afterBuf) : 0 });
};

async function main() {
  const t0 = Date.now();

  // 1) 清空输出目录
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);

  // 2) JS
  const jsSrc = await readFile(path.join(ROOT, 'app.js'), 'utf8');
  const jsOut = await transform(jsSrc, {
    loader: 'js',
    minify: true,
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
  });
  const jsBuf = Buffer.from(jsOut.code);
  const jsName = `app.${hashOf(jsBuf)}.min.js`;
  await writeFile(path.join(DIST, jsName), jsBuf);
  record('app.js', Buffer.byteLength(jsSrc), jsBuf.length, jsBuf);

  // 3) CSS
  const cssSrc = await readFile(path.join(ROOT, 'styles.css'), 'utf8');
  const cssOut = await transform(cssSrc, {
    loader: 'css',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
  });
  const cssBuf = Buffer.from(cssOut.code);
  const cssName = `styles.${hashOf(cssBuf)}.min.css`;
  await writeFile(path.join(DIST, cssName), cssBuf);
  record('styles.css', Buffer.byteLength(cssSrc), cssBuf.length, cssBuf);

  // 4) HTML：改写引用 + 构建标记
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';
  let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  html = html
    .replace(/(<link[^>]+href=")styles\.css(")/, `$1${cssName}$2`)
    .replace(/(<script[^>]+src=")app\.js(")/, `$1${jsName}$2`)
    .replace('</head>', `<!-- build ${stamp} -->\n</head>`);
  if (!html.includes(cssName) || !html.includes(jsName)) {
    throw new Error('index.html 里没找到 styles.css / app.js 引用，改写失败了');
  }
  // HTML 压缩：去掉注释、每行缩进合并成单换行（保留行内空格语义）
  const htmlMin = html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  await writeFile(path.join(DIST, 'index.html'), htmlMin);
  const headers = `# Cloudflare Pages 缓存策略
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/*.min.js
  Cache-Control: public, max-age=31536000, immutable
/*.min.css
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=2592000
`;
  await writeFile(path.join(DIST, '_headers'), headers);
  record('index.html', await sizeOf(path.join(ROOT, 'index.html')), Buffer.byteLength(htmlMin), Buffer.from(htmlMin));

  // 5) 静态资源
  let assets = 0;
  assets += await copyDir(path.join(ROOT, 'assets/shells'), path.join(DIST, 'assets/shells'), (n) => n.endsWith('.webp'));
  assets += await copyDir(path.join(ROOT, 'assets/apple'), path.join(DIST, 'assets/apple'));
  assets += await copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), (n) => /^(demo-loop\.(mp4|webm)|og-cover\.jpg)$/.test(n));
  await copyFile(path.join(ROOT, 'robots.txt'), path.join(DIST, 'robots.txt'));
  await copyFile(path.join(ROOT, 'sitemap.xml'), path.join(DIST, 'sitemap.xml'));

  // 6) 汇总
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n  Wallpaper Studio · build\n');
  console.log('  ' + pad('文件', 16) + pad('原始', 12) + pad('压缩后', 12) + pad('gzip', 12) + '省下');
  console.log('  ' + '─'.repeat(58));
  for (const r of rows) {
    const saved = r.before ? Math.round((1 - r.after / r.before) * 100) + '%' : '—';
    console.log('  ' + pad(r.label, 16) + pad(kb(r.before), 12) + pad(kb(r.after), 12) + pad(kb(r.gzip), 12) + saved);
  }
  console.log('  ' + '─'.repeat(58));
  console.log(`  assets/  ${kb(assets)}（未压缩，WebP/视频本身已压缩）`);
  console.log(`  产物：${jsName} · ${cssName}`);
  console.log(`  输出目录 dist/  ·  用时 ${Date.now() - t0} ms\n`);
}

main().catch((err) => {
  console.error('\n  构建失败：', err.message, '\n');
  process.exit(1);
});
