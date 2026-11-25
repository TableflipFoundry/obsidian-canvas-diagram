// Usage: node closeups.mjs <path/to/diagram.canvas> <out-folder> [WIDTHxHEIGHT]
// One readable screenshot per group (and one of everything outside the groups),
// zoomed to that part of the diagram. For checking the insides of groups;
// use shot.mjs to judge how the groups sit on the page. Prints the saved files.
import fs from 'node:fs';
import path from 'node:path';
import { connect, findVaultRoot, openCanvas, relToVault, withViewport } from './lib/obsidian.mjs';
import { fileHash, updateJob } from './lib/job.mjs';

const [canvasFile, outDir, size = '1900x1300'] = process.argv.slice(2);
if (!canvasFile || !outDir) { console.error('usage: node closeups.mjs <diagram.canvas> <out-folder> [WIDTHxHEIGHT]'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const [w, h] = size.split('x').map(Number);
const vault = findVaultRoot(canvasFile);
const { browser, page } = await connect(vault);
try {
  await page.bringToFront().catch(() => {});
  await withViewport(page, w, h, async () => {
    await openCanvas(page, relToVault(vault, canvasFile));
    // regions: each group's rectangle, plus the boxes outside any group
    const regions = await page.evaluate(() => {
      const canvas = app.workspace.getLeaf(false).view.canvas;
      const all = [...canvas.nodes.values()].filter(n => !String(n.id).startsWith('legend-'));
      const groups = all.filter(n => n.getData().type === 'group');
      const inside = (b, g) => b.x >= g.x && b.y >= g.y && b.x + b.width <= g.x + g.width && b.y + b.height <= g.y + g.height;
      const loose = all.filter(n => n.getData().type !== 'group' && !groups.some(g => inside(n, g)));
      const box = ns => ({ minX: Math.min(...ns.map(n => n.x)), minY: Math.min(...ns.map(n => n.y)), maxX: Math.max(...ns.map(n => n.x + n.width)), maxY: Math.max(...ns.map(n => n.y + n.height)) });
      const rectangles = ns => ns.map(n => ({ minX: n.x, minY: n.y, maxX: n.x + n.width, maxY: n.y + n.height }));
      const out = groups.map(g => ({ name: g.label || g.id, bbox: { minX: g.x, minY: g.y, maxX: g.x + g.width, maxY: g.y + g.height }, boxes: rectangles(all.filter(n => n.getData().type !== 'group' && inside(n, g))) }));
      if (!groups.length && all.length) out.push({ name: 'all', bbox: box(all), boxes: rectangles(all) });
      else if (loose.length) out.push({ name: 'outside-the-groups', bbox: box(loose), boxes: rectangles(loose) });
      return out;
    });
    const el = await page.$('.workspace-leaf.mod-active .canvas-wrapper');
    // A single enormous ungrouped region used to produce another unreadable
    // overview. Tile oversized regions at a reading zoom, with enough overlap
    // that a card on a boundary is fully visible in a neighboring picture.
    const bounds = await el?.boundingBox();
    const maxW = Math.max(700, ((bounds?.width ?? w - 350) - 120) / 0.65);
    const maxH = Math.max(600, ((bounds?.height ?? h - 100) - 120) / 0.65);
    const tiles = [];
    for (const r of regions) {
      if (r.bbox.maxX - r.bbox.minX <= maxW && r.bbox.maxY - r.bbox.minY <= maxH) { tiles.push(r); continue; }
      let count = 0;
      for (let y = r.bbox.minY; y < r.bbox.maxY; y += Math.max(300, maxH - 280))
        for (let x = r.bbox.minX; x < r.bbox.maxX; x += Math.max(400, maxW - 400)) {
          const b = { minX: x, minY: y, maxX: Math.min(x + maxW, r.bbox.maxX), maxY: Math.min(y + maxH, r.bbox.maxY) };
          if (r.boxes.some(n => n.minX < b.maxX && n.maxX > b.minX && n.minY < b.maxY && n.maxY > b.minY))
            tiles.push({ name: `${r.name}-${++count}`, bbox: b });
        }
    }
    const files = [];
    for (const r of tiles) {
      await page.evaluate(b => app.workspace.getLeaf(false).view.canvas.zoomToBbox({ minX: b.minX - b.m, minY: b.minY - b.m, maxX: b.maxX + b.m, maxY: b.maxY + b.m }), { ...r.bbox, m: 60 });
      await page.waitForTimeout(700);
      const file = path.join(outDir, r.name.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') + '.png');
      await (el ?? page).screenshot({ path: file, timeout: 20000 });
      console.log(file);
      files.push(path.resolve(file));
    }
    updateJob(vault, { closeups: { at: new Date().toISOString(), hash: fileHash(canvasFile), count: files.length, files } });
  });
} finally {
  await browser.close();
}
