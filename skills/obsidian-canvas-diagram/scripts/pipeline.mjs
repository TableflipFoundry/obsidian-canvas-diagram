// Usage: node pipeline.mjs <diagram.canvas> [--relayout] [--seeds 3] [--iters N] [--no-check]
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
import { enableIO } from './lib/canvas-io.mjs';
import { refineIO } from './lib/io-layout.mjs';
import { readRelationships, prepareRelationships, selectRelationships, refineRelationships } from './lib/relationships.mjs';

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
let canvas = JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''));
// A saved arrangement is authoritative. Updating this plugin, opening a
// diagram, or re-running verification must not silently rearrange it.
const hasSavedLayout = (canvas.nodes ?? []).some(n => n.id === 'legend-group' ||
  n.type === 'file' && ((n.x ?? 0) !== 0 || (n.y ?? 0) !== 0));
// New diagrams use I/O; saved diagrams require explicit conversion.
if (!hasSavedLayout || args.includes('--io')) {
  enableIO(canvas);
  if (hasSavedLayout && args.includes('--io')) fs.writeFileSync(abs, JSON.stringify(canvas, null, '\t'));
}
if (hasSavedLayout && args.includes('--refine-io')) {
  const result = refineIO(canvas, readRelationships(abs).plan);
  canvas = result.canvas;
  fs.writeFileSync(abs, JSON.stringify(canvas, null, '\t'));
  console.log(`Refined I/O attachments/labels with fixed cards. Prediction: ${JSON.stringify(result.report)}`);
}
if (hasSavedLayout && !args.includes('--relayout')) {
  console.log('Preserving the saved layout. Use --relayout only when a new arrangement is explicitly requested.');
  if (!args.includes('--no-check')) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(here, 'verify.mjs'), abs], { stdio: 'inherit' });
      child.on('error', reject); child.on('close', resolve);
    });
    process.exit(code ?? 1);
  }
  console.log(args.includes('--refine-io') ? 'Refined I/O attachments/labels; saved card positions preserved. Verification skipped (--no-check).' : args.includes('--io') ? 'Converted I/O metadata; saved card positions and attachment sides preserved. Verification skipped (--no-check).' : 'No positions, attachments or connections changed; verification was skipped (--no-check).');
  process.exit(0);
}
// The legend panel is generated: drop any old one, a fresh one is added after layout.
const { legendProblems, buildLegend, isLegendItem, noteType } = await import('./lib/legend.mjs');
canvas.nodes = (canvas.nodes ?? []).filter(n => !isLegendItem(n));
canvas.edges = (canvas.edges ?? []).filter(e => !isLegendItem(e));
const { findVaultRoot } = await import('./lib/obsidian.mjs');
const vaultRoot = findVaultRoot(abs);
const layoutInput = readRelationships(abs);
const prepared = prepareRelationships(canvas, layoutInput.plan, n => noteType(vaultRoot, n.file ?? ''));
canvas = prepared.canvas;
const relationshipPlan = prepared.plan;
if (prepared.added) console.log(`Added ${prepared.added} local file-card references to existing data notes (no new notes).`);
const ids = new Set((canvas.nodes ?? []).map(n => n.id));
const bad = (canvas.edges ?? []).filter(e => !ids.has(e.fromNode) || !ids.has(e.toNode));
if (bad.length) { console.error('INVALID: edges point at missing nodes: ' + bad.map(e => e.id).join(', ')); process.exit(4); }
// Drop Advanced Canvas arrow routing (it changes edge shapes the layout relies on).
for (const e of canvas.edges ?? []) if (e.styleAttributes?.pathfindingMethod) {
  delete e.styleAttributes.pathfindingMethod;
  console.warn(`WARNING: removed pathfindingMethod from arrow ${e.id} (not allowed; the layout uses normal curves).`);
}
// Strict legend: every color, border, line and arrowhead must be on the legend.
const offLegend = legendProblems(canvas, vaultRoot);
if (offLegend.length) {
  console.error('INVALID (not on the legend, see SKILL.md "The legend"):\n' + offLegend.map(p => '  ' + p.msg).join('\n'));
  process.exit(4);
}
// Every box's note must exist inside the vault, or Obsidian shows "file not found" boxes.
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
// Data boxes (note type "data") are placed beside the step that uses them, not
// as a step of their own. The flag is for layout.mjs/optimize.mjs only.
for (const n of flowCanvas.nodes) if (n.type === 'file' && noteType(vaultRoot, n.file ?? '') === 'data') n._data = true;
const nodeCount = flowCanvas.nodes.filter(n => n.type !== 'group').length;

const run = (script, argv) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(here, script), ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${script} failed (${code}): ${err || out}`)));
});

// --- layout + optimize -------------------------------------------------------
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-layout-'));
const cleanupWork = () => {
  if (path.dirname(path.resolve(work)) !== path.resolve(os.tmpdir()) || !path.basename(work).startsWith('canvas-layout-'))
    throw new Error('Refusing to remove an unexpected layout scratch directory');
  fs.rmSync(work, { recursive: true, force: true });
};
process.once('exit', cleanupWork);
const seeds = +opt('--seeds', 3);
const itersFor = n => +opt('--iters', Math.min(200000, Math.max(20000, 3000 * n)));
// Fresh random starting points on every run, so re-running gives new layouts to
// choose from (pass --seed N to repeat a run exactly).
const base = +opt('--seed', 1 + Math.floor(Math.random() * 1e6));
const t0 = Date.now();
// At most one optimizer per CPU at a time (groups are laid out in parallel).
const slots = Math.max(2, os.cpus().length - 1);
let running = 0; const waiting = [];
const withSlot = fn => new Promise((resolve, reject) => {
  const start = () => { running++; fn().then(resolve, reject).finally(() => { running--; if (waiting.length) waiting.shift()(); }); };
  running < slots ? start() : waiting.push(start);
});
let runNo = 0;

// Lays out one flat canvas (no group nodes): ELK sets the rows, then `seeds`
// optimizer runs; the best is returned as a parsed canvas.
async function layoutFlat(flat, tag, effort = 1) {
  const n = flat.nodes.length, iters = itersFor(n) * effort;
  const inFile = path.join(work, `${tag}.flow.canvas`), elkFile = path.join(work, `${tag}.elk.canvas`);
  fs.writeFileSync(inFile, JSON.stringify(flat));
  await run('layout.mjs', [inFile, elkFile, 'DOWN']);
  const results = await Promise.all(Array.from({ length: seeds }, (_, s) => withSlot(async () => {
    const out = path.join(work, `${tag}.seed${s + 1}.canvas`);
    const log = await run('optimize.mjs', [elkFile, out, String(iters), String(base + runNo++)]);
    const line = log.split('\n').find(l => l.startsWith('RESULT '));
    return { out, ...JSON.parse(line.slice(7)) };
  })));
  results.sort((a, b) => a.total - b.total);
  const optimized = JSON.parse(fs.readFileSync(results[0].out, 'utf8').replace(/^\uFEFF/, ''));
  const local = selectRelationships(relationshipPlan, new Set(optimized.nodes.map(n => n.id)));
  const refined = refineRelationships(optimized, local);
  // Choose attachment sides against the final drawing, without moving the
  // newly aligned chains/helpers or rerunning random placement.
  const refinedFile = path.join(work, `${tag}.refined.canvas`), routedFile = path.join(work, `${tag}.routed.canvas`);
  fs.writeFileSync(refinedFile, JSON.stringify(refined));
  const routeLog = await run('optimize.mjs', [refinedFile, routedFile, '0', String(base), '--sides-only']);
  const routedScore = JSON.parse(routeLog.split('\n').find(l => l.startsWith('RESULT ')).slice(7));
  results[0] = { ...results[0], ...routedScore };
  return { canvas: JSON.parse(fs.readFileSync(routedFile, 'utf8')), results, iters, n };
}
// Arranges the blocks (groups and loose boxes) in aligned rows. ELK sets the
// order (rank, and left to right within a rank); blocks that don't wait on
// anything above are pulled up into earlier rows while the row fits a target
// width; a loose data box goes in the row of the block it's joined to; then
// every row is packed with even gaps and centred. Deterministic: at this
// level a tidy page beats a few fewer crossings, which is what the random
// optimizer produced here (staggered blocks, uneven gaps).
async function arrangeBlocks(blocks, between, tag) {
  const inFile = path.join(work, `${tag}.flow.canvas`), elkFile = path.join(work, `${tag}.elk.canvas`);
  fs.writeFileSync(inFile, JSON.stringify({ nodes: blocks, edges: between }));
  await run('layout.mjs', [inFile, elkFile, 'DOWN']);
  const elk = JSON.parse(fs.readFileSync(elkFile, 'utf8')).nodes;
  const B = new Map(elk.map(n => [n.id, { id: n.id, w: n.width, h: n.height, ex: n.x, ey: n.y, data: n._data === true }]));
  const all = [...B.values()];
  // Steps (groups and loose non-data boxes) get rows. A shared data box (a
  // "hub") gets no row: data isn't a step, so it is placed afterwards at the
  // centre of the blocks that use it, in the free space between them, and
  // those blocks slide within their rows to gather around it.
  const steps = all.filter(b => !b.data), hubs = all.filter(b => b.data);
  const order = [...steps].sort((a, b) => a.ey - b.ey); // top to bottom, so predecessors settle first
  let rank = -1, lastY = -Infinity;
  for (const b of order) { if (b.ey - lastY > 40) { rank++; lastY = b.ey; } b.row = rank; }
  // what must stay above what: the arrows between steps that ELK drew downward,
  // including a step that feeds a hub which feeds another step (A -> hub -> B
  // keeps B below A, as in layout.mjs)
  const above = new Map(steps.map(b => [b.id, []]));
  const keepOrder = (a, b) => { if (a.row < b.row) above.get(b.id).push(a.id); else if (b.row < a.row) above.get(a.id).push(b.id); };
  for (const e of between) {
    const a = B.get(e.fromNode), b = B.get(e.toNode);
    if (!a.data && !b.data) keepOrder(a, b);
  }
  for (const h of hubs) {
    const ins = between.filter(e => e.toNode === h.id && !B.get(e.fromNode).data).map(e => B.get(e.fromNode));
    const outs = between.filter(e => e.fromNode === h.id && !B.get(e.toNode).data).map(e => B.get(e.toNode));
    for (const a of ins) for (const b of outs) if (a !== b) keepOrder(a, b);
  }
  const GAPX = 160, GAPY = hubs.length ? 380 : 260; // room for a hub between rows
  const rowWidth = r => { const ms = steps.filter(b => b.row === r); return ms.reduce((s, b) => s + b.w, 0) + GAPX * Math.max(0, ms.length - 1); };
  const target = Math.max(...steps.map(b => b.w), 1.6 * Math.sqrt(steps.reduce((s, b) => s + b.w * b.h, 0)));
  for (const b of order) {
    const lo = above.get(b.id).reduce((m, id) => Math.max(m, B.get(id).row + 1), 0);
    for (let r = lo; r < b.row; r++) if (rowWidth(r) + GAPX + b.w <= target) { b.row = r; break; }
  }
  const usersOf = h => [...new Set(between.filter(e => e.fromNode === h.id || e.toNode === h.id)
    .map(e => B.get(e.fromNode === h.id ? e.toNode : e.fromNode)).filter(x => !x.data))];
  const rows = [...new Set(steps.map(b => b.row))].sort((a, b) => a - b);
  const widest = Math.max(...rows.map(rowWidth));
  const at = new Map();
  const centre = b => ({ x: at.get(b.id).x + b.w / 2, y: at.get(b.id).y + b.h / 2 });
  // rows packed with even gaps; blocks in a row ordered by their key. A row is
  // centred on the page, or (toHubs) slid sideways so its blocks sit over the
  // hubs they share, as far as the page allows.
  const pack = toHubs => {
    let y = 0;
    for (const r of rows) {
      const ms = steps.filter(b => b.row === r).sort((a, b) => a.key - b.key);
      let x = (widest - rowWidth(r)) / 2;
      if (toHubs) {
        const want = ms.reduce((s, b) => s + b.key, 0) / ms.length - rowWidth(r) / 2;
        x = Math.max(0, Math.min(widest - rowWidth(r), want));
      }
      for (const b of ms) { at.set(b.id, { x: Math.round(x), y }); x += b.w + GAPX; }
      y += Math.max(...ms.map(b => b.h)) + GAPY;
    }
  };
  // hubs: at the centre of their users, nudged to the nearest free spot
  const placeHubs = () => {
    const rects = steps.map(b => ({ ...at.get(b.id), w: b.w, h: b.h }));
    const free = (x, y, w, h) => !rects.some(r => x < r.x + r.w + 80 && x + w > r.x - 80 && y < r.y + r.h + 80 && y + h > r.y - 80);
    const spot = (cx, cy, w, h) => {
      for (let rad = 0; rad <= 5000; rad += 60) for (let a = 0; a < 360; a += 30) {
        const x = Math.round((cx - w / 2 + rad * Math.cos(a * Math.PI / 180)) / 20) * 20;
        const y = Math.round((cy - h / 2 + rad * Math.sin(a * Math.PI / 180)) / 20) * 20;
        if (free(x, y, w, h)) return { x, y };
      }
      return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
    };
    let spareY = 0;
    for (const h of hubs) {
      const us = usersOf(h);
      let p;
      if (us.length) {
        const cs = us.map(centre);
        let cx = cs.reduce((s, c) => s + c.x, 0) / cs.length;
        const cy = cs.reduce((s, c) => s + c.y, 0) / cs.length;
        // users in neighbouring rows: the gap between them is right. Users
        // rows apart: the gap would put the hub in the middle of the column
        // and its arrows through every group in between, so it goes beside
        // the column at that height, on the side its users lean to.
        const span = Math.max(...us.map(u => u.row)) - Math.min(...us.map(u => u.row));
        if (span >= 2) {
          const left = Math.min(...us.map(u => at.get(u.id).x)), right = Math.max(...us.map(u => at.get(u.id).x + u.w));
          cx = cx < widest / 2 ? left - GAPX - h.w / 2 : right + GAPX + h.w / 2;
        }
        p = spot(cx, cy, h.w, h.h);
      } else { p = { x: widest + GAPX, y: spareY }; spareY += h.h + 60; } // joined to nothing placed: off to the right
      at.set(h.id, p);
      rects.push({ ...p, w: h.w, h: h.h });
    }
  };
  // pass 1: ELK's left-to-right order; pass 2: gather each hub's users around it
  for (const b of steps) b.key = b.ex;
  pack(false); placeHubs();
  for (let pass = 0; pass < 2; pass++) {
    for (const b of steps) {
      const hs = hubs.filter(h => usersOf(h).includes(b));
      b.key = hs.length ? hs.reduce((s, h) => s + centre(h).x, 0) / hs.length : centre(b).x;
    }
    pack(true); placeHubs();
  }
  at.rows = rows.length;
  return at;
}
const facingSides = (a, b) => { // same rule as optimize.mjs naturalSides
  const dx = (b.x + b.width / 2) - (a.x + a.width / 2), dy = (b.y + b.height / 2) - (a.y + a.height / 2);
  if (Math.abs(dy) / (a.height + b.height) >= Math.abs(dx) / (a.width + b.width)) return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
};
const summary = r => `${r.results.map(x => Math.round(x.total)).join(' / ')}, problem score ${r.results[0].score}`;

const groups = flowCanvas.nodes.filter(n => n.type === 'group');
const boxes = flowCanvas.nodes.filter(n => n.type !== 'group');
let laid;
if (!groups.length) {
  console.log(`Optimizing ${nodeCount} boxes: ${seeds} attempts x ${itersFor(nodeCount)} steps (about ${Math.round(itersFor(nodeCount) / 450)}s)...`);
  const r = await layoutFlat(flowCanvas, 'all');
  laid = r.canvas;
  console.log(`Laid out in ${Math.round((Date.now() - t0) / 1000)}s. Kept the best of ${seeds} attempts (overall ${summary(r)}; --seed ${base} repeats this run).`);
} else {
  // Groups (SKILL.md "Groups"): every box stays inside its group. Each group is
  // laid out on its own as a small diagram, then the groups are arranged as
  // blocks (with the loose boxes) following the arrows between them, and each
  // group's insides are dropped in where its block landed.
  // Membership: the box's `group` field (as the agent wrote it), else sitting
  // inside the group's rectangle (as Obsidian stores it after a layout).
  const inside = (a, g) => a.x >= g.x && a.y >= g.y && a.x + a.width <= g.x + g.width && a.y + a.height <= g.y + g.height;
  const memberOf = new Map();
  for (const b of boxes) {
    if (b.group && !groups.some(g => g.id === b.group)) console.warn(`WARNING: box ${b.id} names group "${b.group}", which doesn't exist; left outside any group.`);
    const g = groups.find(x => x.id === b.group) ?? groups.filter(x => inside(b, x)).sort((p, q) => p.width * p.height - q.width * q.height)[0];
    if (g) memberOf.set(b.id, g.id);
  }
  const members = g => boxes.filter(b => memberOf.get(b.id) === g.id);
  for (const g of groups) if (!members(g).length) console.warn(`WARNING: group ${g.id} ("${g.label ?? ''}") has no boxes and was removed.`);
  const live = groups.filter(g => members(g).length);
  const loose = boxes.filter(b => !memberOf.has(b.id));
  console.log(`Laying out ${boxes.length} boxes: ${live.length} groups (${live.map(g => members(g).length).join(', ')} boxes) and ${loose.length} outside any group; ${seeds} attempts each, ${slots} at a time...`);

  // 1. each group on its own
  const PAD = { top: 60, side: 50, bottom: 50 };
  const inner = new Map();
  await Promise.all(live.map(async g => {
    const ms = members(g), ids = new Set(ms.map(b => b.id));
    // boxes joined to the outside go to the group's edge (see optimize.mjs ENTRY/EXIT)
    for (const b of ms) {
      b._entry = flowCanvas.edges.some(e => e.toNode === b.id && !ids.has(e.fromNode));
      b._exit = flowCanvas.edges.some(e => e.fromNode === b.id && !ids.has(e.toNode));
    }
    const r = await layoutFlat({ nodes: ms, edges: flowCanvas.edges.filter(e => ids.has(e.fromNode) && ids.has(e.toNode)) }, `group-${g.id.replace(/[^\w-]/g, '_')}`);
    const ns = r.canvas.nodes;
    const minX = Math.min(...ns.map(n => n.x)), minY = Math.min(...ns.map(n => n.y));
    const w = Math.max(...ns.map(n => n.x + n.width)) - minX, h = Math.max(...ns.map(n => n.y + n.height)) - minY;
    inner.set(g.id, {
      nodes: ns.map(n => ({ ...n, x: n.x - minX + PAD.side, y: n.y - minY + PAD.top })), edges: r.canvas.edges,
      width: w + 2 * PAD.side, height: h + PAD.top + PAD.bottom,
    });
    console.log(`  group "${g.label ?? g.id}": ${ms.length} boxes, ${r.iters} steps, ${summary(r)}`);
  }));

  // 2. the groups as blocks, plus the loose boxes, following the arrows between them
  const unit = id => memberOf.get(id) ?? id;
  const outerNodes = [
    ...live.map(g => ({ id: g.id, type: 'text', text: g.label ?? g.id, x: 0, y: 0, width: inner.get(g.id).width, height: inner.get(g.id).height })),
    ...loose,
  ];
  const seen = new Set(), outerEdges = [];
  for (const e of flowCanvas.edges) {
    const a = unit(e.fromNode), b = unit(e.toNode);
    if (a === b || seen.has(a + '\0' + b)) continue;
    seen.add(a + '\0' + b);
    outerEdges.push({ id: `between-${outerEdges.length}`, fromNode: a, toNode: b });
  }
  const at = await arrangeBlocks(outerNodes, outerEdges, 'groups');
  console.log(`  groups and loose boxes: ${outerNodes.length} blocks in ${at.rows} rows`);

  // 3. assemble: each group's insides go where its block landed
  const nodesOut = [];
  for (const g of live) {
    const inn = inner.get(g.id), p = at.get(g.id);
    nodesOut.push({ ...g, x: p.x, y: p.y, width: inn.width, height: inn.height });
    for (const n of inn.nodes) nodesOut.push({ ...n, x: n.x + p.x, y: n.y + p.y });
  }
  for (const b of loose) { const p = at.get(b.id); nodesOut.push({ ...b, x: p.x, y: p.y }); }
  // arrows inside a group keep the sides its layout chose; the rest face the other box
  const byId = new Map(nodesOut.map(n => [n.id, n]));
  const innerSides = new Map();
  for (const inn of inner.values()) for (const e of inn.edges) innerSides.set(e.id, [e.fromSide, e.toSide]);
  const edgesOut = flowCanvas.edges.map(e => {
    const s = innerSides.get(e.id) ?? facingSides(byId.get(e.fromNode), byId.get(e.toNode));
    return { ...e, fromSide: s[0], toSide: s[1] };
  });
  laid = { ...flowCanvas, nodes: nodesOut, edges: edgesOut };
  console.log(`Laid out in ${Math.round((Date.now() - t0) / 1000)}s (--seed ${base} repeats this run).`);
}

// Finish against the fully assembled drawing, including inter-group edges.
// Predictions help selection; native quality and visual review remain required.
{
  const final = refineIO(laid, relationshipPlan);
  laid = final.canvas;
  console.log(`Final I/O refinement (prediction): ${JSON.stringify(final.report)}`);
}
// Keep everything from the original file except geometry.
for (const n of laid.nodes) { delete n._data; delete n._entry; delete n._exit; delete n.group; }
{
  // Side column to the right of the diagram, from its top: the issues box(es),
  // then the generated legend panel.
  const boxes = laid.nodes.filter(n => n.type !== 'group');
  const x = Math.max(...boxes.map(n => n.x + n.width)) + 240;
  let y = Math.min(...boxes.map(n => n.y));
  for (const n of sideNodes) { n.x = x; n.y = y; y += n.height + 60; }
  laid.nodes.push(...sideNodes);
  // edges touching side boxes (none expected) are kept as written
  laid.edges.push(...(canvas.edges ?? []).filter(e => sideIds.has(e.fromNode) || sideIds.has(e.toNode)));
  const legend = buildLegend(laid, vaultRoot, x, y);
  for (const node of legend.nodes) node.canvasIO = { ports: false };
  laid.nodes.push(...legend.nodes);
  laid.edges.push(...legend.edges);
}
fs.writeFileSync(abs, JSON.stringify(laid, null, '\t'));
// Tell the running diagram job (if any) which version of the canvas was laid out.
const { updateJob, fileHash } = await import('./lib/job.mjs');
const stamp = { at: new Date().toISOString(), hash: fileHash(abs), checked: false };
updateJob(vaultRoot, { layout: stamp });

// --- check in Obsidian -------------------------------------------------------
cleanupWork();
if (args.includes('--no-check')) process.exit(0);
const shot = path.join(os.tmpdir(), `${path.basename(abs, '.canvas')}-${Date.now()}.png`);
try {
  const quality = JSON.parse(await run('score.mjs', [abs, '--json']));
  console.log(`Obsidian score ${quality.score}; ` + Object.entries(quality.issues).filter(([, a]) => a.length).map(([k, a]) => `${k}: ${a.length}`).join(', '));
  await run('shot.mjs', [abs, shot]);
  console.log(`SCREENSHOT ${shot}`);
  if (fileHash(abs) !== stamp.hash) throw new Error('Diagram changed during rendering; verify the final layout again');
  updateJob(vaultRoot, { layout: { ...stamp, checked: true, screenshot: shot, quality } });
  console.log('Next: open the screenshot with the Read tool and review it (SKILL.md, "Review").');
} catch (e) {
  const msg = e.message.split('\n').slice(0, 3).join(' ');
  updateJob(vaultRoot, { layout: { ...stamp, checked: false, checkError: msg.slice(0, 300) } });
  console.error('CHECK FAILED: ' + msg);
  console.error('The layout was still written. If Obsidian is open without the debug port, ask the user to close Obsidian, then run this pipeline again.');
  process.exit(5);
}
