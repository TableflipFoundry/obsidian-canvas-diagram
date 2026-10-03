// Connects to the Obsidian desktop app through its Chrome DevTools port so
// scripts can open a canvas, read what Obsidian actually drew, and screenshot it.
//
// Obsidian must be running with --remote-debugging-port. If it isn't running,
// we start it that way. If it is running WITHOUT the port, we can't attach and
// the user has to close it first (we never kill it ourselves).
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PORT = +(process.env.OBSIDIAN_DEBUG_PORT || 9222);
const ENDPOINT = `http://127.0.0.1:${PORT}`;

/**
 * Find the vault a canvas belongs to: the nearest folder above it that holds
 * `.obsidian/`. If there is none (a brand-new project), the vault is the nearest
 * folder above the canvas that holds the shared `nodes/` folder (normally
 * `Diagrams/`), and we create `.obsidian/` there, which is all Obsidian needs.
 * Never make the canvas's own subfolder the vault: its `nodes/...` paths would
 * then point outside the vault and every box would show "file not found".
 */
export function findVaultRoot(filePath) {
  const start = path.dirname(path.resolve(filePath));
  const ancestors = [];
  for (let dir = start; ;) {
    ancestors.push(dir);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const existing = ancestors.find(d => fs.existsSync(path.join(d, '.obsidian')));
  if (existing) return existing;
  const withNodes = ancestors.find(d => fs.existsSync(path.join(d, 'nodes')));
  if (!withNodes) throw new Error(`No vault found for ${filePath}: expected a Diagrams/ folder with a nodes/ folder above the canvas.`);
  fs.mkdirSync(path.join(withNodes, '.obsidian'), { recursive: true });
  // New vaults hide the note header (id, type, source...) so notes open straight
  // into the title and plain-language description. It stays in the side panel.
  fs.writeFileSync(path.join(withNodes, '.obsidian', 'app.json'),
    JSON.stringify({ propertiesInDocument: 'hidden' }, null, 2));
  return withNodes;
}

function obsidianExe() {
  const candidates = process.platform === 'win32'
    ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'),
       path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Obsidian', 'Obsidian.exe')]
    : process.platform === 'darwin'
      ? ['/Applications/Obsidian.app/Contents/MacOS/Obsidian']
      : ['/usr/bin/obsidian', '/opt/Obsidian/obsidian'];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('Obsidian is not installed in a known location. Set OBSIDIAN_EXE.');
  return process.env.OBSIDIAN_EXE || found;
}

function obsidianRunning() {
  try {
    const out = process.platform === 'win32'
      ? execSync('tasklist /FI "IMAGENAME eq Obsidian.exe" /NH', { encoding: 'utf8' })
      : execSync('pgrep -i obsidian || true', { encoding: 'utf8' });
    return /obsidian/i.test(out);
  } catch { return false; }
}

async function portOpen() {
  try { const r = await fetch(`${ENDPOINT}/json/version`); return r.ok; } catch { return false; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Returns { browser, page } for the Obsidian window that has `vaultRoot` open. */
export async function connect(vaultRoot) {
  if (!(await portOpen())) {
    if (obsidianRunning()) {
      throw new Error(
        'Obsidian is open without the debug port. Ask the user to close Obsidian, then run this again ' +
        '(it will be reopened automatically with the debug port).');
    }
    // Start Obsidian on whatever vault it last had; we open ours below.
    spawn(obsidianExe(), [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 40 && !(await portOpen()); i++) await sleep(500);
    if (!(await portOpen())) throw new Error('Started Obsidian but its debug port never opened.');
  }
  const browser = await chromium.connectOverCDP(ENDPOINT);
  const want = path.resolve(vaultRoot).toLowerCase();
  const findPage = async () => {
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) {
      if (!p.url().startsWith('app://obsidian.md')) continue;
      const base = await p.evaluate(() => globalThis.app?.vault?.adapter?.basePath ?? null).catch(() => null);
      if (base && path.resolve(base).toLowerCase() === want) return p;
    }
    return null;
  };
  let page = await findPage();
  if (!page) {
    // Open the project's vault the way "Open folder as vault" does. Unlike an
    // obsidian://open link, this works for folders Obsidian has never seen
    // (it adds them to the vault list) and opens a new window for it.
    const any = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('app://obsidian.md'));
    if (!any) throw new Error('No Obsidian window to talk to.');
    const res = await any.evaluate((dir) => {
      // 3rd arg = "create a new vault"; false = open an existing folder as a vault
      try { return require('electron').ipcRenderer.sendSync('vault-open', dir, false); }
      catch (e) { return String(e); }
    }, path.resolve(vaultRoot));
    if (res !== true) throw new Error(`Obsidian could not open ${vaultRoot} as a vault: ${res}`);
    for (let i = 0; i < 40 && !page; i++) { await sleep(500); page = await findPage(); }
  }
  if (!page) throw new Error(`Could not find an Obsidian window for vault ${vaultRoot}`);
  await page.waitForFunction(() => globalThis.app?.workspace?.layoutReady === true, null, { timeout: 20000 });
  await ensureAdvancedCanvas(page, vaultRoot);
  return { browser, page };
}

// ---------- Advanced Canvas (required) ----------
// Diagrams use Advanced Canvas line styles and borders, so every vault needs it
// installed and turned on. If this vault doesn't have it, we install the
// unmodified copy bundled with this plugin (vendor/advanced-canvas, GPL-3.0,
// see its README). We only ever touch the project's own vault: no downloads,
// and no looking in other vaults or folders.
const AC_ID = 'advanced-canvas';
const AC_BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../vendor/advanced-canvas');
const AC_SHA256 = {
  'main.js': 'fa672aac80561875e01c12e593d661a976d2eb1ada93202efb57029d415482c8',
  'manifest.json': '0f5a79f0964004cccb261942f477f693ebd3b8f969d77940d699388d1bb7a82e',
  'styles.css': '3646804b9160e5542b7fc9fec19392e82917c118d110f9a8d88ddb938923922c',
};

function installAdvancedCanvasFiles(vaultRoot) {
  const dest = path.join(vaultRoot, '.obsidian', 'plugins', AC_ID);
  if (['main.js', 'manifest.json'].every(f => fs.existsSync(path.join(dest, f)))) return 'already in this vault';
  for (const [f, want] of Object.entries(AC_SHA256)) {
    const src = path.join(AC_BUNDLE, f);
    if (!fs.existsSync(src)) throw new Error(`the plugin's bundled Advanced Canvas is missing ${f} (${AC_BUNDLE}). Reinstall the plugin.`);
    const got = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    if (got !== want) throw new Error(`the plugin's bundled Advanced Canvas file ${f} doesn't match its checksum. Reinstall the plugin.`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const f of Object.keys(AC_SHA256)) fs.copyFileSync(path.join(AC_BUNDLE, f), path.join(dest, f));
  return 'installed from the copy bundled with this plugin';
}

export async function ensureAdvancedCanvas(page, vaultRoot) {
  const enabled = await page.evaluate((id) => app.plugins.enabledPlugins?.has(id) && !!app.plugins.plugins?.[id], AC_ID).catch(() => false);
  if (enabled) return;
  const how = installAdvancedCanvasFiles(vaultRoot);
  const result = await page.evaluate(async (id) => {
    try {
      await app.plugins.loadManifests();
      // community plugins are off ("restricted mode") in a new vault
      if (typeof app.plugins.isEnabled === 'function' && !app.plugins.isEnabled()) await app.plugins.setEnable(true);
      await app.plugins.enablePluginAndSave(id);
      return app.plugins.enabledPlugins.has(id) ? 'ok' : 'not enabled';
    } catch (e) { return String(e); }
  }, AC_ID);
  if (result !== 'ok') throw new Error(`Advanced Canvas is required but could not be turned on (${result}). Ask the user to enable it: Obsidian Settings → Community plugins → Advanced Canvas.`);
  console.error(`[obsidian] Installed and enabled Advanced Canvas in ${vaultRoot} (${how}).`);
}

/** Opens a canvas (path relative to the vault) in the active tab and zooms to fit. */
export async function openCanvas(page, relPath) {
  const res = await page.evaluate(async (p) => {
    // Obsidian may not have indexed a just-written file yet
    for (let i = 0; i < 20 && !app.vault.getAbstractFileByPath(p); i++) await new Promise(r => setTimeout(r, 250));
    const file = app.vault.getAbstractFileByPath(p);
    if (!file) return { error: `not found in vault: ${p}` };
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await new Promise(r => setTimeout(r, 700));
    const canvas = leaf.view?.canvas;
    if (!canvas) return { error: `${p} did not open as a canvas` };
    canvas.zoomToFit();
    await new Promise(r => setTimeout(r, 900));
    return { nodes: canvas.nodes.size, edges: canvas.edges.size };
  }, relPath.split(path.sep).join('/'));
  if (res.error) throw new Error(res.error);
  return res;
}

/** Vault-relative path for an absolute file path. */
export const relToVault = (vaultRoot, file) => path.relative(vaultRoot, path.resolve(file));
