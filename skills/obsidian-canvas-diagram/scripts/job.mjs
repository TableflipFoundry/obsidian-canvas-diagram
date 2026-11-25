// Usage:
//   node job.mjs start    <path/to/diagram.canvas> [--presentation|--design]
//   node job.mjs reviewed <canvas> "<what you checked in the screenshot and what you found>"
//   node job.mjs no-issues <canvas>                  record that the review found no problems
//   node job.mjs skip     <canvas> <check-id> "<why it can't be fixed>"
//   node job.mjs status   <canvas>                   show the job and run the checks now
//   node job.mjs cancel   <canvas>                   end the job without checks (user asked to stop)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJob, writeJob, updateJob, locateVault, markerPath } from './lib/job.mjs';
import { relationshipHash } from './lib/relationship-audit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const [cmd, canvasArg, ...rest] = process.argv.slice(2);
const usage = () => { console.error('usage: node job.mjs start|reviewed|no-issues|skip|status|cancel <diagram.canvas> [...]\nstart defaults to source-backed code review; --presentation preserves semantics without a code audit; --design records an explicit proposal.'); process.exit(2); };
if (!cmd || !canvasArg) usage();

const canvas = path.resolve(canvasArg);
let vault = locateVault(canvas);
if (!vault) {
  // brand-new project: the vault will be the folder holding nodes/, normally Diagrams/
  const guess = path.dirname(path.dirname(canvas));
  vault = guess;
  fs.mkdirSync(path.join(vault, 'nodes'), { recursive: true });
}

if (cmd === 'start') {
  const mode = rest.includes('--presentation') ? 'presentation' : rest.includes('--design') ? 'design' : 'code';
  if (rest.some(flag => !['--presentation','--design'].includes(flag)) || rest.length > 1) usage();
  let relationshipBaseline = null;
  if (mode === 'presentation') {
    try { relationshipBaseline = relationshipHash(JSON.parse(fs.readFileSync(canvas,'utf8').replace(/^\uFEFF/,''))); }
    catch { console.error('Presentation-only mode requires an existing valid canvas.');process.exit(1); }
  }
  writeJob(vault, {
    canvas: path.relative(vault, canvas).split(path.sep).join('/'),
    startedAt: new Date().toISOString(),
    notesIndexAt: null, layout: null, review: null, reviewVersion: 4, mode, relationshipBaseline,
    relationshipAudit: null, noIssues: false, skips: {}, history: [],
  });
  console.log(`Diagram job started for ${path.relative(vault, canvas)}. The stop check is on until every check passes.`);
  console.log(`Next, the reuse check: node "${path.join(here, 'notes-index.mjs')}" "${vault}"`);
  if (mode === 'presentation') console.log('Presentation-only: semantic relationships must remain unchanged. Code completeness is NOT audited; disclose this in the final report.');
  else console.log('A relationship inventory is required before completion: read references/relationship-audit.md, then run audit.mjs <canvas> <inventory>.');
  process.exit(0);
}

const job = readJob(vault);
if (!job) { console.error(`No diagram job is running in ${vault}. Start one with: node job.mjs start <canvas>`); process.exit(1); }
if (path.resolve(vault,job.canvas) !== canvas) { console.error('The active job is for a different canvas.');process.exit(1); }

if (cmd === 'reviewed') {
  const relationshipsChecked = rest.includes('--relationships');
  const text = rest.filter(s => s !== '--relationships').join(' ').trim();
  if (text.length < 40) { console.error('Describe the review in a sentence or two (flow, arrows, labels, level): what you saw and what you changed.'); process.exit(1); }
  if (job.reviewVersion >= 2 && !relationshipsChecked) {
    console.error('Review nearby helpers, straight paths, local shared data and preservation in readable screenshots, then add --relationships. A score alone is not a visual review.');
    process.exit(1);
  }
  updateJob(vault, { review: { at: new Date().toISOString(), text, relationshipsChecked } });
  console.log('Review recorded.');
} else if (cmd === 'no-issues') {
  updateJob(vault, { noIssues: true });
  console.log('Recorded: no issues found.');
} else if (cmd === 'skip') {
  const [id, ...why] = rest;
  const reason = why.join(' ').trim();
  if (!id || reason.length < 10) { console.error('usage: node job.mjs skip <canvas> <check-id> "<why it can\'t be fixed>"'); process.exit(1); }
  updateJob(vault, { skips: { ...job.skips, [id]: reason } });
  console.log(`Recorded: "${id}" can't be fixed (${reason}). It will be listed under "Couldn't fix" in your report.`);
} else if (cmd === 'status') {
  const { runChecks } = await import('./check.mjs');
  const r = runChecks(vault, job);
  console.log(r.failures.length ? 'Not done yet:\n' + r.failures.map(f => `- [${f.id}] ${f.msg}`).join('\n') : 'All checks pass.');
  if (job.mode === 'presentation') console.log('Relationship completeness: NOT CODE-AUDITED (presentation-only, semantic graph preserved). Do not describe this as a code/content validation.');
  if (Object.keys(job.skips).length) console.log('Couldn\'t fix (recorded):\n' + Object.entries(job.skips).map(([k, v]) => `- ${k}: ${v}`).join('\n'));
} else if (cmd === 'cancel') {
  fs.rmSync(markerPath(vault), { force: true });
  console.log('Diagram job cancelled; the stop check is off.');
} else usage();
