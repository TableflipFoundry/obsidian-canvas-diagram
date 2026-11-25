// Verify an intentionally refined layout without moving it. Never substitutes for visual review.
// Usage: node verify.mjs <diagram.canvas> [out.png]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locateVault, fileHash, updateJob } from './lib/job.mjs';
import { legendProblems } from './lib/legend.mjs';

const [file, output] = process.argv.slice(2);
if (!file) { console.error('usage: node verify.mjs <diagram.canvas> [out.png]'); process.exit(2); }
const canvasFile = path.resolve(file), vault = locateVault(canvasFile);
if (!vault) throw new Error('Cannot locate the diagram vault');
const canvas = JSON.parse(fs.readFileSync(canvasFile, 'utf8').replace(/^\uFEFF/, ''));
const ids = new Set(canvas.nodes.map(n => n.id));
if (ids.size !== canvas.nodes.length || new Set(canvas.edges.map(e => e.id)).size !== canvas.edges.length)
  throw new Error('Duplicate node or edge IDs');
for (const e of canvas.edges) if (!ids.has(e.fromNode) || !ids.has(e.toNode)) throw new Error(`Missing endpoint on ${e.id}`);
for (const n of canvas.nodes) if (n.type === 'file' && !fs.existsSync(path.join(vault, n.file))) throw new Error(`Missing note ${n.file}`);
const problems = legendProblems(canvas, vault);
if (problems.length) throw new Error(problems.map(p => p.msg).join('\n'));
const here = path.dirname(fileURLToPath(import.meta.url));
const screenshot = path.resolve(output ?? path.join(os.tmpdir(), `${path.basename(file, '.canvas')}-verified-${Date.now()}.png`));
const stamp = { at: new Date().toISOString(), hash: fileHash(canvasFile), checked: false, method: 'preserved layout; verify.mjs' };
updateJob(vault, { layout: stamp });
let quality;
for (const [script, args] of [['score.mjs', [canvasFile, '--json']], ['shot.mjs', [canvasFile, screenshot]]]) {
  const result = spawnSync(process.execPath, [path.join(here, script), ...args], { encoding: 'utf8' });
  if (result.stdout && script !== 'score.mjs') process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 || result.error) {
    updateJob(vault, { layout: { ...stamp, checkError: String(result.error ?? result.stderr).slice(0, 300) } });
    process.exit(1);
  }
  if (script === 'score.mjs') {
    quality = JSON.parse(result.stdout);
    console.log(`Obsidian score ${quality.score}; ` + Object.entries(quality.issues).filter(([, a]) => a.length).map(([k, a]) => `${k}: ${a.length}`).join(', '));
  }
}
// Canonical hashing tolerates Obsidian formatting and Advanced Canvas metadata,
// but not a changed node, port, connection, or position during verification.
if (fileHash(canvasFile) !== stamp.hash) throw new Error('Diagram geometry/content changed during verification; verify again');
updateJob(vault, { layout: { ...stamp, checked: true, screenshot, quality } });
console.log(`SCREENSHOT ${screenshot}\nReview the whole diagram and readable close-ups before recording job.mjs reviewed --relationships.`);
