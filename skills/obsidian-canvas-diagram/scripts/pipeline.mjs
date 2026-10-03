// Usage: node pipeline.mjs <path/to/diagram.canvas> [--seeds 3] [--iters N] [--no-check]
//
// The one command the skill runs after writing a .canvas. It rewrites the
// canvas in place with a readable layout, then checks it in Obsidian:
//   1. validate the canvas (every edge points at a real node)
//   2. ELK layered layout, top to bottom (sets the row order)
//   3. optimize.mjs with several seeds in parallel; keep the best
//   4. score.mjs in Obsidian (the real drawing) and a screenshot for review
// Only positions and edge sides change. Notes, text, colors and labels don't.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const canvasFile = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
if (!canvasFile) { console.error('usage: node pipeline.mjs <diagram.canvas> [--seeds 3] [--iters N] [--no-check]'); process.exit(2); }

// --- setup check -------------------------------------------------------------
if (!fs.existsSync(path.join(here, 'node_modules', 'elkjs')) || !fs.existsSync(path.join(here, 'node_modules', 'playwright-core'))) {
  console.error(`SETUP NEEDED: run  npm install --prefix "${here}"  once, then run this again.`);
  process.exit(3);
}

// --- validate ----------------------------------------------------------------
const abs = path.resolve(canvasFile);
const canvas = JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''));
const ids = new Set((canvas.nodes ?? []).map(n => n.id));
const bad = (canvas.edges ?? []).filter(e => !ids.has(e.fromNode) || !ids.has(e.toNode));
if (bad.length) { console.error('INVALID: edges point at missing nodes: ' + bad.map(e => e.id).join(', ')); process.exit(4); }
if ((canvas.nodes ?? []).some(n => n.type === 'group')) console.warn('WARNING: group nodes are not laid out yet; they keep their old position.');
// Advanced Canvas styles: stop on typos; drop arrow routing (it changes edge shapes).
const { styleProblems } = await import('./lib/styles.mjs');
for (const e of canvas.edges ?? []) if (e.styleAttributes?.pathfindingMethod) {
  delete e.styleAttributes.pathfindingMethod;
  console.warn(`WARNING: removed pathfindingMethod from arrow ${e.id} (not allowed; the layout uses normal curves).`);
}
const badStyles = styleProblems(canvas);
if (badStyles.length) { console.error('INVALID styles:\n' + badStyles.map(p => '  ' + p.msg).join('\n')); process.exit(4); }
// Every box's note must exist inside the vault, or Obsidian shows "file not found" boxes.
const { findVaultRoot } = await import('./lib/obsidian.mjs'); // after the setup check (it needs playwright)
const vaultRoot = findVaultRoot(abs);
const missing = (canvas.nodes ?? []).filter(n => n.type === 'file' && !fs.existsSync(path.join(vaultRoot, n.file ?? '')));
if (missing.length) {
  console.error(`INVALID: vault is ${vaultRoot}, and these boxes point at notes that don't exist there:\n` +
    missing.map(n => `  ${n.id}: ${n.file}`).join('\n') +
    `\nBox "file" paths are relative to the vault root (e.g. nodes/x.md).`);
  process.exit(4);
}
// Side boxes: notes named *-issues.md are not part of the flow. They are laid
// out separately (to the right of the diagram, top-aligned) so the flow layout
// never moves them into the middle.
const isSide = n => n.type === 'file' && /-issues\.md$/i.test(n.file ?? '');
const sideNodes = (canvas.nodes ?? []).filter(isSide);
const sideIds = new Set(sideNodes.map(n => n.id));
const flowCanvas = {
  ...canvas,
  nodes: (canvas.nodes ?? []).filter(n => !sideIds.has(n.id)),
  edges: (canvas.edges ?? []).filter(e => !sideIds.has(e.fromNode) && !sideIds.has(e.toNode)),
};
const nodeCount = flowCanvas.nodes.filter(n => n.type !== 'group').length;

const run = (script, argv) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(here, script), ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${script} failed (${code}): ${err || out}`)));
});

// --- layout + optimize -------------------------------------------------------
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-layout-'));
const elkFile = path.join(work, 'elk.canvas');
const flowFile = path.join(work, 'flow.canvas');
fs.writeFileSync(flowFile, JSON.stringify(flowCanvas));
await run('layout.mjs', [flowFile, elkFile, 'DOWN']);

const seeds = +opt('--seeds', 3);
const iters = +opt('--iters', Math.min(200000, Math.max(40000, 3000 * nodeCount)));
const t0 = Date.now();
console.log(`Optimizing ${nodeCount} boxes: ${seeds} attempts x ${iters} steps (about ${Math.round(iters / 450)}s)...`);
// Fresh random starting points on every run, so re-running gives new layouts to
// choose from (pass --seed N to repeat a run exactly).
const base = +opt('--seed', 1 + Math.floor(Math.random() * 1e6));
const results = await Promise.all(Array.from({ length: seeds }, async (_, s) => {
  const out = path.join(work, `seed${s + 1}.canvas`);
  const log = await run('optimize.mjs', [elkFile, out, String(iters), String(base + s)]);
  const line = log.split('\n').find(l => l.startsWith('RESULT '));
  return { out, ...JSON.parse(line.slice(7)) };
}));
results.sort((a, b) => a.total - b.total);
const best = results[0];

// Keep everything from the original file except geometry.
const laid = JSON.parse(fs.readFileSync(best.out, 'utf8').replace(/^\uFEFF/, ''));
if (sideNodes.length) {
  // Put side boxes in a column to the right of the diagram, starting at its top.
  const boxes = laid.nodes.filter(n => n.type !== 'group');
  let x = Math.max(...boxes.map(n => n.x + n.width)) + 240;
  let y = Math.min(...boxes.map(n => n.y));
  for (const n of sideNodes) { n.x = x; n.y = y; y += n.height + 60; }
  laid.nodes.push(...sideNodes);
  // edges touching side boxes (none expected) are kept as written
  laid.edges.push(...(canvas.edges ?? []).filter(e => sideIds.has(e.fromNode) || sideIds.has(e.toNode)));
}
fs.writeFileSync(abs, JSON.stringify(laid, null, '\t'));
// Tell the running diagram job (if any) which version of the canvas was laid out.
const { updateJob, fileHash } = await import('./lib/job.mjs');
const stamp = { at: new Date().toISOString(), hash: fileHash(abs), checked: false };
updateJob(vaultRoot, { layout: stamp });
// Attempts are ranked by overall quality (problems + compactness + straight arrows),
// so the kept one isn't always the one with the lowest problem score.
console.log(`Laid out in ${Math.round((Date.now() - t0) / 1000)}s. Kept the best of ${seeds} attempts ` +
  `(overall ${results.map(r => Math.round(r.total)).join(' / ')}, lower is better; --seed ${base} repeats this run). ` +
  `Predicted problem score ${best.score}.`);

// --- check in Obsidian -------------------------------------------------------
if (args.includes('--no-check')) process.exit(0);
const shot = path.join(os.tmpdir(), `${path.basename(abs, '.canvas')}-${Date.now()}.png`);
try {
  const scoreOut = await run('score.mjs', [abs]);
  console.log(scoreOut.trim());
  await run('shot.mjs', [abs, shot]);
  console.log(`SCREENSHOT ${shot}`);
  updateJob(vaultRoot, { layout: { ...stamp, checked: true, screenshot: shot } });
  console.log('Next: open the screenshot with the Read tool and review it (SKILL.md, "Review").');
} catch (e) {
  const msg = e.message.split('\n').slice(0, 3).join(' ');
  updateJob(vaultRoot, { layout: { ...stamp, checked: false, checkError: msg.slice(0, 300) } });
  console.error('CHECK FAILED: ' + msg);
  console.error('The layout was still written. If Obsidian is open without the debug port, ask the user to close Obsidian, then run this pipeline again.');
  process.exit(5);
}
