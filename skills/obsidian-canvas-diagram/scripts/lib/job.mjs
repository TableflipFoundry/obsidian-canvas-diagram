// A diagram "job" marker: <vault>/.diagram-job.json exists while the agent is
// building a diagram. The Stop hook (check.mjs) only checks work while a marker
// exists, and removes it once everything passes. Shared by job.mjs,
// pipeline.mjs, notes-index.mjs and check.mjs. Plain fs only (no libraries), so
// the hook still runs before `npm install`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MARKER = '.diagram-job.json';

export const markerPath = vaultRoot => path.join(vaultRoot, MARKER);

export function readJob(vaultRoot) {
  try { return JSON.parse(fs.readFileSync(markerPath(vaultRoot), 'utf8')); } catch { return null; }
}

export function writeJob(vaultRoot, job) {
  fs.writeFileSync(markerPath(vaultRoot), JSON.stringify(job, null, 2));
}

/** Update the marker if a job is running; no-op otherwise. */
export function updateJob(vaultRoot, patch) {
  const job = readJob(vaultRoot);
  if (!job) return null;
  const next = { ...job, ...patch };
  writeJob(vaultRoot, next);
  return next;
}

/**
 * Hash of what a canvas says (its boxes and arrows), not of the bytes.
 * Obsidian re-saves an open canvas in its own formatting, and Advanced Canvas
 * adds a `metadata` block, so a byte hash of a freshly laid-out file never
 * matched. Falls back to a byte hash for anything that isn't a canvas.
 */
export function fileHash(file) {
  const raw = fs.readFileSync(file);
  try {
    const j = JSON.parse(raw.toString('utf8').replace(/^﻿/, ''));
    const canon = v => Array.isArray(v) ? v.map(canon)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
    const byId = a => [...(a ?? [])].sort((p, q) => String(p.id).localeCompare(String(q.id)));
    return crypto.createHash('sha1').update(JSON.stringify(canon({ nodes: byId(j.nodes), edges: byId(j.edges) }))).digest('hex');
  } catch {
    return crypto.createHash('sha1').update(raw).digest('hex');
  }
}

/** Same rule as lib/obsidian.mjs findVaultRoot, without creating anything. */
export function locateVault(fromFile) {
  let dir = path.dirname(path.resolve(fromFile));
  let withNodes = null;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.obsidian'))) return dir;
    if (!withNodes && fs.existsSync(path.join(dir, 'nodes'))) withNodes = dir;
    const up = path.dirname(dir);
    if (up === dir) return withNodes;
    dir = up;
  }
}
