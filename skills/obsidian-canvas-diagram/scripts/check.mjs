// The plugin's stop check (registered in hooks/hooks.json for the Stop event).
// While a diagram job is running (<vault>/.diagram-job.json exists), it won't let
// the agent finish until the work passes mechanical checks. Every failure says
// exactly how to fix it. Judgment calls (does it read well) are NOT blocked here;
// the agent's recorded review covers those.
//
// Safety: if the same failures come back unchanged 3 times, or after 6 blocks,
// it stops pushing: the job ends and the agent is told to list what's left
// under "Couldn't fix" in its report. With no job running it does nothing.
//
// Can also be imported: runChecks(vault, job) (used by `job.mjs status`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJob, writeJob, markerPath, fileHash } from './lib/job.mjs';
import { legendProblems, isLegendItem } from './lib/legend.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SECTIONS = {
  component: ['Responsibilities', 'Interfaces', 'Dependencies', 'Notes'],
  function: ['Inputs', 'Outputs', 'Side effects', 'Called by', 'Calls'],
  actor: ['Goals', 'Permissions / capabilities', 'Touchpoints'],
  person: ['Goals', 'Permissions / capabilities', 'Touchpoints'],
  system: ['Goals', 'Permissions / capabilities', 'Touchpoints'],
  screen: ['Responsibilities', 'Interfaces', 'Dependencies', 'Notes'],
  data: ['Schema / shape', 'Where stored', 'Readers', 'Writers', 'Lifecycle'],
  decision: ['Condition', 'Inputs to the decision', 'Branches'],
  event: ['Trigger', 'Payload', 'Subscribers'],
};

function parseNote(text) {
  text = text.replace(/^﻿/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^(\w+):\s*(.*)$/); if (kv) fm[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim(); }
  return { fm, hasFront: !!m, body: m ? text.slice(m[0].length) : text };
}

function vaultFiles(vault) {
  const names = new Set(), paths = new Set();
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const rel = path.relative(vault, p).split(path.sep).join('/');
        paths.add(rel.toLowerCase()); paths.add(rel.replace(/\.md$/, '').toLowerCase());
        names.add(e.name.toLowerCase()); names.add(e.name.replace(/\.md$/, '').toLowerCase());
      }
    }
  };
  walk(vault);
  return { names, paths };
}

export function runChecks(vault, job) {
  const failures = [];
  const fail = (id, msg) => { if (!Object.keys(job.skips ?? {}).some(s => id === s || id.startsWith(s + ':'))) failures.push({ id, msg }); };
  const canvasFile = path.join(vault, job.canvas);
  const pipelineCmd = `node "${path.join(here, 'pipeline.mjs')}" "${canvasFile}"`;

  let canvas = null;
  try { canvas = JSON.parse(fs.readFileSync(canvasFile, 'utf8').replace(/^﻿/, '')); }
  catch { fail('canvas', `The diagram ${job.canvas} doesn't exist or isn't valid JSON yet. Write it (SKILL.md, "The .canvas file").`); return { failures, canvas: null }; }

  for (const p of legendProblems(canvas, vault)) fail(`legend:${p.id}`, `${p.msg}. Everything must be on the legend (SKILL.md, "The legend").`);
  if (!(canvas.nodes ?? []).some(n => n.id === 'legend-group'))
    fail('legend-panel', `The diagram has no legend panel. The pipeline adds it; run: node "${path.join(here, 'pipeline.mjs')}" "${path.join(vault, job.canvas)}"`);
  // planned parts must look planned
  for (const n of (canvas.nodes ?? []).filter(n => n.type === 'file')) {
    const p = path.join(vault, n.file ?? '');
    if (!fs.existsSync(p) || !p.endsWith('.md')) continue;
    const { fm } = parseNote(fs.readFileSync(p, 'utf8'));
    if (fm.status === 'planned' && n.styleAttributes?.border !== 'dashed')
      fail(`style:planned:${n.file}`, `${n.file} is planned (not built yet), so its box needs a dashed border: add "styleAttributes": { "border": "dashed" } to box ${n.id}.`);
  }

  if (!job.notesIndexAt) fail('reuse-check', `The reuse check hasn't run. Run: node "${path.join(here, 'notes-index.mjs')}" "${vault}" and reuse matching notes before writing new ones.`);

  const fileNodes = (canvas.nodes ?? []).filter(n => n.type === 'file');
  for (const n of fileNodes) if (!fs.existsSync(path.join(vault, n.file ?? ''))) fail(`missing-note:${n.file}`, `Box ${n.id} points at ${n.file}, which doesn't exist. Write that note, or fix the path (relative to ${vault}).`);

  // layout must have run on the current version of the canvas, and been checked in Obsidian
  if (!job.layout) fail('layout', `The layout hasn't been run. Run: ${pipelineCmd}`);
  else {
    if (job.layout.hash !== fileHash(canvasFile)) fail('layout', `The diagram changed after the last layout. Run again: ${pipelineCmd}`);
    else if (!job.layout.checked) fail('obsidian-check', `The layout ran but the Obsidian check didn't finish (${job.layout.checkError ?? 'unknown error'}). If Obsidian is open without the debug port, ask the user to close it, then run: ${pipelineCmd}`);
  }

  // notes written or changed during this job must follow the standard; links must resolve
  const started = Date.parse(job.startedAt);
  const files = vaultFiles(vault);
  for (const n of fileNodes) {
    const p = path.join(vault, n.file ?? '');
    if (!fs.existsSync(p) || !p.endsWith('.md')) continue;
    if (fs.statSync(p).mtimeMs < started - 2000) continue; // reused, untouched: not this job's work
    const rel = n.file;
    const { fm, hasFront, body } = parseNote(fs.readFileSync(p, 'utf8'));
    const isIssues = /-issues\.md$/i.test(rel);
    const problems = [];
    if (!hasFront) problems.push('it has no frontmatter block at the top');
    for (const k of ['id', 'title', 'type', 'status', 'level']) if (!fm[k]) problems.push(`frontmatter is missing "${k}"`);
    // people and outside services have no code of their own, so no source is required
    if (fm.status === 'exists' && !fm.source && !isIssues && !['actor', 'person', 'system'].includes(fm.type)) problems.push('status is "exists" but there is no "source" path');
    const firstLine = body.split(/\r?\n/).find(l => l.trim());
    if (firstLine && /^#\s/.test(firstLine)) problems.push('it starts with an H1 heading (remove it; Obsidian shows the filename as the title)');
    else if (!firstLine || /^#{1,6}\s/.test(firstLine)) problems.push('it must open with the plain-language paragraph (what it is, why it exists, how it works) before any heading');
    else {
      const opening = body.split(/\r?\n#{1,6}\s/)[0].trim();
      if (opening.length < 120 && !isIssues) problems.push('the opening paragraph is too short to explain what it is, why it exists and how it works');
    }
    const want = SECTIONS[fm.type];
    if (want && !isIssues) {
      const heads = [...body.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map(m => m[1].toLowerCase());
      const missing = want.filter(s => !heads.some(h => h.startsWith(s.toLowerCase())));
      if (missing.length) problems.push(`missing section(s) for type "${fm.type}": ${missing.map(s => `"## ${s}"`).join(', ')} (write "None" if one doesn't apply)`);
    }
    if (problems.length) fail(`note:${rel}`, `${rel}: ${problems.join('; ')}.`);

    const broken = [...new Set([...body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map(m => m[1].trim()))]
      .filter(t => !files.names.has(t.toLowerCase()) && !files.paths.has(t.toLowerCase()) && !files.names.has(path.basename(t).toLowerCase()));
    if (broken.length) fail(`links:${rel}`, `${rel} links to notes that don't exist: ${broken.map(b => `[[${b}]]`).join(', ')}. Write them, or fix the link names.`);
  }

  // issues: a red box + note next to the canvas, or an explicit "no issues"
  const base = path.basename(job.canvas, '.canvas');
  const issuesRel = path.posix.join(path.posix.dirname(job.canvas), `${base}-issues.md`);
  const hasIssuesFile = fs.existsSync(path.join(vault, issuesRel));
  const hasIssuesBox = fileNodes.some(n => (n.file ?? '').replace(/\\/g, '/').toLowerCase() === issuesRel.toLowerCase());
  if (!job.noIssues) {
    if (!hasIssuesFile) fail('issues', `No issues note. Write ${issuesRel} listing what you found broken, unused, duplicated or risky (SKILL.md, "Issues found while reviewing"). If you truly found nothing, run: node "${path.join(here, 'job.mjs')}" no-issues "${canvasFile}"`);
    else if (!hasIssuesBox) fail('issues', `${issuesRel} exists but isn't on the diagram. Add a red file box for it ("color": "1", no arrows), then re-run the layout.`);
  }

  // the agent must have looked at the latest screenshot and recorded what it checked
  const reviewedAfterLayout = job.review && job.layout && Date.parse(job.review.at) >= Date.parse(job.layout.at);
  if (!reviewedAfterLayout) fail('review', `Open the latest screenshot with the Read tool, check it against SKILL.md "Review", then record what you checked: node "${path.join(here, 'job.mjs')}" reviewed "${canvasFile}" "<flow, arrows, labels, level: what you saw and changed>"`);

  return { failures, canvas };
}

// ---------- run as the Stop hook ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
  const cwd = input.cwd || process.cwd();
  const vault = [path.join(cwd, 'Diagrams'), cwd].find(d => fs.existsSync(markerPath(d)));
  if (!vault) process.exit(0); // no diagram job running: never interfere

  const job = readJob(vault);
  const { failures } = runChecks(vault, job);
  const skips = Object.entries(job.skips ?? {});
  const tail = skips.length ? `\nRecorded as can't fix (list these under "Couldn't fix" in your report):\n${skips.map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : '';

  if (!failures.length) {
    fs.rmSync(markerPath(vault), { force: true });
    if (skips.length) { process.stderr.write(`All checks pass. Before finishing, make sure your report lists:${tail}`); process.exit(2); }
    process.exit(0);
  }

  const key = failures.map(f => f.id).sort().join('|');
  const history = [...(job.history ?? []), key];
  const sameInARow = history.slice(-3).length === 3 && history.slice(-3).every(k => k === key);
  if (sameInARow || history.length >= 6) {
    fs.rmSync(markerPath(vault), { force: true });
    process.stderr.write(
      `These checks still fail after several tries, so the stop check is ending the job. Finish now, and list each one under "Couldn't fix" in your report to the user:\n` +
      failures.map(f => `- ${f.msg}`).join('\n') + tail);
    process.exit(2);
  }
  writeJob(vault, { ...job, history });
  process.stderr.write(
    `The diagram job isn't finished. Fix these, then finish:\n${failures.map(f => `- [${f.id}] ${f.msg}`).join('\n')}\n` +
    `If one truly can't be fixed, record why and it will be reported instead: node "${path.join(here, 'job.mjs')}" skip "${path.join(vault, job.canvas)}" <id> "<reason>". ` +
    `If the user asked you to stop, run: node "${path.join(here, 'job.mjs')}" cancel "${path.join(vault, job.canvas)}".${tail}`);
  process.exit(2);
}
