// Usage: node shot.mjs <path/to/diagram.canvas> <out.png> [WIDTHxHEIGHT]
// Opens the canvas in Obsidian (starting it with the debug port if needed),
// zooms to fit, and saves a screenshot of what Obsidian actually drew.
// The picture takes the diagram's shape: 1600 wide, and as tall as the
// diagram's proportions need (900 to 4000), so a tall diagram gets a tall
// picture instead of a tiny one. Pass WIDTHxHEIGHT to choose yourself.
import fs from 'node:fs';
import { connect, findVaultRoot, openCanvas, relToVault, withViewport } from './lib/obsidian.mjs';

const [canvasFile, outPng, size] = process.argv.slice(2);
if (!canvasFile || !outPng) { console.error('usage: node shot.mjs <diagram.canvas> <out.png> [WIDTHxHEIGHT]'); process.exit(2); }
let [w, h] = (size ?? '').split('x').map(Number);
if (!(w > 0 && h > 0)) {
  const nodes = JSON.parse(fs.readFileSync(canvasFile, 'utf8').replace(/^﻿/, '')).nodes ?? [];
  const minX = Math.min(...nodes.map(n => n.x)), maxX = Math.max(...nodes.map(n => n.x + n.width));
  const minY = Math.min(...nodes.map(n => n.y)), maxY = Math.max(...nodes.map(n => n.y + n.height));
  w = 1600;
  h = Math.round(Math.min(4000, Math.max(900, w * ((maxY - minY) / Math.max(1, maxX - minX)))));
}
const vault = findVaultRoot(canvasFile);
const { browser, page } = await connect(vault);
try {
  // A hidden or minimised window isn't drawn, and screenshots of it time out.
  await page.bringToFront().catch(() => {});
  await page.evaluate(() => { try { require('electron').remote?.getCurrentWindow?.().restore?.(); } catch {} }).catch(() => {});
  const info = await withViewport(page, w, h, async cdp => {
    const info = await openCanvas(page, relToVault(vault, canvasFile)); // zooms to fit the pretend size
    const el = await page.$('.workspace-leaf.mod-active .canvas-wrapper');
    try {
      await (el ?? page).screenshot({ path: outPng, timeout: 20000 });
    } catch {
      // fall back to a raw capture through the debug protocol
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(outPng, Buffer.from(data, 'base64'));
    }
    return info;
  });
  console.log(JSON.stringify({ ...info, size: `${w}x${h}`, screenshot: outPng }));
} finally {
  await browser.close(); // disconnects only; Obsidian stays open
}
