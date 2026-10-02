// Usage: node shot.mjs <path/to/diagram.canvas> <out.png>
// Opens the canvas in Obsidian (starting it with the debug port if needed),
// zooms to fit, and saves a screenshot of what Obsidian actually drew.
import { connect, findVaultRoot, openCanvas, relToVault } from './lib/obsidian.mjs';

const [canvasFile, outPng] = process.argv.slice(2);
if (!canvasFile || !outPng) { console.error('usage: node shot.mjs <diagram.canvas> <out.png>'); process.exit(2); }
const vault = findVaultRoot(canvasFile);
const { browser, page } = await connect(vault);
try {
  // A hidden or minimised window isn't drawn, and screenshots of it time out.
  await page.bringToFront().catch(() => {});
  await page.evaluate(() => { try { require('electron').remote?.getCurrentWindow?.().restore?.(); } catch {} }).catch(() => {});
  const info = await openCanvas(page, relToVault(vault, canvasFile));
  const el = await page.$('.workspace-leaf.mod-active .canvas-wrapper');
  try {
    await (el ?? page).screenshot({ path: outPng, timeout: 15000 });
  } catch {
    // fall back to a raw capture of the whole window through the debug protocol
    const cdp = await page.context().newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    (await import('node:fs')).writeFileSync(outPng, Buffer.from(data, 'base64'));
  }
  console.log(JSON.stringify({ ...info, screenshot: outPng }));
} finally {
  await browser.close(); // disconnects only; Obsidian stays open
}
