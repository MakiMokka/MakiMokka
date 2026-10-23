/**
 * Rasterize brand SVGs with headless Chromium (true vector rendering at each
 * size, not downscaled bitmaps).
 *
 *   node brand/source/render.mjs            → brand/png/*
 *   node brand/source/render.mjs <svg> <png> <width> [height]
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const svg = (name) => path.join(ROOT, 'svg', name);
const png = (name) => path.join(ROOT, 'png', name);

const ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024];

function jobs() {
  const list = [];
  // App icon: detailed artwork ≥ 64 px, simplified artwork for 16 and 32 px.
  for (const size of ICON_SIZES) {
    const source = size <= 32 ? 'ovyra-app-icon-small.svg' : 'ovyra-app-icon-default.svg';
    list.push([svg(source), png(`ovyra-app-icon-${size}.png`), size, size]);
  }
  for (const variant of ['default', 'light', 'dark', 'mono', 'tinted']) {
    list.push([
      svg(`ovyra-app-icon-${variant}.svg`),
      png(`ovyra-app-icon-${variant}-1024.png`),
      1024,
      1024,
    ]);
  }
  list.push([
    svg('ovyra-app-icon-foreground-transparent.svg'),
    png('ovyra-app-icon-foreground-transparent-1024.png'),
    1024,
    1024,
  ]);
  // PWA / web.
  list.push([svg('ovyra-app-icon-default.svg'), png('pwa/apple-touch-icon.png'), 180, 180]);
  list.push([svg('ovyra-app-icon-default.svg'), png('pwa/icon-192.png'), 192, 192]);
  list.push([svg('ovyra-app-icon-default.svg'), png('pwa/icon-512.png'), 512, 512]);
  list.push([svg('ovyra-app-icon-maskable.svg'), png('pwa/icon-maskable-512.png'), 512, 512]);
  // Symbol and wordmark previews (transparent backgrounds).
  for (const variant of ['color', 'mono', 'light', 'simplified', 'solid-black', 'solid-white']) {
    list.push([
      svg(`ovyra-symbol-${variant}.svg`),
      png(`ovyra-symbol-${variant}-1024.png`),
      1024,
      null,
    ]);
  }
  for (const variant of [
    'color-on-light',
    'color-on-dark',
    'mono-black',
    'mono-white',
    'solid-black',
    'solid-white',
  ]) {
    list.push([
      svg(`ovyra-wordmark-${variant}.svg`),
      png(`ovyra-wordmark-${variant}-2000w.png`),
      2000,
      null,
    ]);
  }
  return list;
}

async function render(page, source, target, width, height) {
  const text = await readFile(source, 'utf8');
  const vb = /viewBox="([^"]+)"/.exec(text)[1].split(/\s+/).map(Number);
  const h = height ?? Math.round((width * vb[3]) / vb[2]);
  await page.setViewportSize({ width, height: h });
  const src = `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${src}" width="${width}" height="${h}" style="display:block"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({
    path: target,
    omitBackground: true,
    clip: { x: 0, y: 0, width, height: h },
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();
const args = process.argv.slice(2);
const list =
  args.length >= 3
    ? [[args[0], args[1], Number(args[2]), args[3] ? Number(args[3]) : null]]
    : jobs();
for (const [source, target, width, height] of list)
  await render(page, source, target, width, height);
await browser.close();
console.log(`Rendered ${list.length} file(s).`);
