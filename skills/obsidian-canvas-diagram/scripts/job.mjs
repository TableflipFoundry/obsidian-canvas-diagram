// Usage:
//   node job.mjs start    <path/to/diagram.canvas>   begin a diagram job (turns on the stop check)
//   node job.mjs reviewed <canvas> "<what you checked in the screenshot and what you found>"
//   node job.mjs no-issues <canvas>                  record that the review found no problems
//   node job.mjs skip     <canvas> <check-id> "<why it can't be fixed>"
//   node job.mjs status   <canvas>                   show the job and run the checks now
//   node job.mjs cancel   <canvas>                   end the job without checks (user asked to stop)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJob, writeJob, updateJob, locateVault, markerPath } from './lib/job.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const [cmd, canvasArg, ...rest] = process.argv.slice(2);
const usage = () => { console.error('usage: node job.mjs start|reviewed|no-issues|skip|status|cancel <diagram.canvas> [...]'); process.exit(2); };
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
  writeJob(vault, {
    canvas: path.relative(vault, canvas).split(path.sep).join('/'),
    startedAt: new Date().toISOString(),
    notesIndexAt: null, layout: null, review: null, noIssues: false, skips: {}, history: [],
  });
  console.log(`Diagram job started for ${path.relative(vault, canvas)}. The stop check is on until every check passes.`);
  console.log(`Next, the reuse check: node "${path.join(here, 'notes-index.mjs')}" "${vault}"`);
  process.exit(0);
}

const job = readJob(vault);
if (!job) { console.error(`No diagram job is running in ${vault}. Start one with: node job.mjs start <canvas>`); process.exit(1); }

if (cmd === 'reviewed') {
  const text = rest.join(' ').trim();
  if (text.length < 40) { console.error('Describe the review in a sentence or two (flow, arrows, labels, level): what you saw and what you changed.'); process.exit(1); }
  updateJob(vault, { review: { at: new Date().toISOString(), text } });
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
  if (Object.keys(job.skips).length) console.log('Couldn\'t fix (recorded):\n' + Object.entries(job.skips).map(([k, v]) => `- ${k}: ${v}`).join('\n'));
} else if (cmd === 'cancel') {
  fs.rmSync(markerPath(vault), { force: true });
  console.log('Diagram job cancelled; the stop check is off.');
} else usage();
