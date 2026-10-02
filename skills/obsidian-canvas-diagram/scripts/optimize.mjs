// Usage: node optimize.mjs <in.canvas> <out.canvas> [iterations] [seed]
// Improves a canvas layout by simulated annealing against a local replica of
// Obsidian's edge rendering. The input's top-to-bottom rows (from layout.mjs /
// ELK) are locked: boxes slide within their row, rows change spacing, edges
// pick sides. Boxes may change row only in the final improvement-only phase.
// Scores the same problems as score.mjs, plus flow and compactness terms.
// Group nodes are not supported yet (they are ignored and keep their position).
import fs from 'node:fs';

const [inPath, outPath, itersArg = '60000', seedArg = '1'] = process.argv.slice(2);
const canvas = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^\uFEFF/, ''));
const ITERS = +itersArg;
let seed = +seedArg;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const nodes = canvas.nodes.filter(n => n.type !== 'group');
const edges = canvas.edges;
const idx = new Map(nodes.map((n, i) => [n.id, i]));
const SIDES = ['top', 'right', 'bottom', 'left'];
const NORMAL = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const SNAP = 20;
const snap = v => Math.round(v / SNAP) * SNAP;

// Label size in canvas units. Obsidian scales label text by 1/sqrt(zoom scale);
// at 100% a label is ~10.1px per char + 8px wide, 38px tall. We design for the
// size at a 60% overview zoom (x1.29), matching score.mjs.
const LABEL_K = 1 / Math.sqrt(0.6);
const labelW = t => Math.ceil((t.length * 10.1 + 8) * LABEL_K);
const LABEL_H = Math.ceil(38 * LABEL_K);

// ---------- state ----------
const X = nodes.map(n => snap(n.x)), Y = nodes.map(n => snap(n.y));
const Wd = nodes.map(n => n.width), Ht = nodes.map(n => n.height);
const FS = edges.map(e => e.fromSide ?? 'right'), TS = edges.map(e => e.toSide ?? 'left');
const EF = edges.map(e => idx.get(e.fromNode)), ET = edges.map(e => idx.get(e.toNode));
// Flow: edges that point down in the input (ELK's layering) should keep pointing down.
// ELK already chose which few edges run backwards to break cycles; those are exempt.
const cy0 = i => nodes[i].y + nodes[i].height / 2;
const FLOWS_DOWN = edges.map((_, k) => cy0(ET[k]) - cy0(EF[k]) > 20);

// Rows: the input's top-to-bottom layering (from ELK) is locked. Every box keeps
// its row; rows keep their order. Only row spacing and positions within a row change.
const MIN_ROW_GAP = 140;
const order = nodes.map((_, i) => i).sort((a, b) => nodes[a].y - nodes[b].y);
const RANK = new Array(nodes.length);
let rows = 0, rowStart = -Infinity;
for (const i of order) {
  if (nodes[i].y - rowStart > 40) { rows++; rowStart = nodes[i].y; }
  RANK[i] = rows - 1;
}
const GAP = Array.from({ length: rows }, () => 180); // gap above each row (GAP[0] unused)
function applyRows() {
  // empty rows collapse, so moving a box out of a row never leaves a hole
  let y = 0, prevH = null;
  const rowY = [];
  for (let r = 0; r < rows; r++) {
    const hs = nodes.filter((_, i) => RANK[i] === r).map(n => n.height);
    if (!hs.length) { rowY.push(y); continue; }
    if (prevH !== null) y += prevH + GAP[r];
    rowY.push(y); prevH = Math.max(...hs);
  }
  for (let i = 0; i < nodes.length; i++) Y[i] = rowY[RANK[i]];
}
applyRows();
const rowMembers = r => nodes.map((_, i) => i).filter(i => RANK[i] === r);

// ---------- Obsidian edge replica ----------
function anchor(i, side, off) {
  const cx = X[i] + Wd[i] / 2, cy = Y[i] + Ht[i] / 2;
  const [nx, ny] = NORMAL[side];
  return [cx + nx * (Wd[i] / 2 + off), cy + ny * (Ht[i] / 2 + off)];
}
function edgePoints(k) {
  const p0 = anchor(EF[k], FS[k], 7), p3 = anchor(ET[k], TS[k], 7);
  const dist = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
  const d = Math.min(150, Math.max(70, dist / 2));
  const [ax, ay] = NORMAL[FS[k]], [bx, by] = NORMAL[TS[k]];
  const p1 = [p0[0] + ax * d, p0[1] + ay * d], p2 = [p3[0] + bx * d, p3[1] + by * d];
  const approx = dist + d;
  const n = Math.max(8, Math.ceil(approx / 8));
  const pts = new Array(n + 1);
  for (let s = 0; s <= n; s++) {
    const t = s / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
    pts[s] = [a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]];
  }
  const m = pts[n >> 1];
  const w = labelW(edges[k].label || '');
  const label = edges[k].label ? { x: m[0] - w / 2, y: m[1] - LABEL_H / 2, w, h: LABEL_H } : null;
  return { pts, label, len: approx };
}

// ---------- scoring ----------
const inBox = (x, y, b, pad) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
const ov = (a, b, d = 3) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > d && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > d;
const segX = (p1, p2, p3, p4) => {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (!d) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
};
const W = { throughNode: 10, overlap: 10, labelOnNode: 6, labelOnLabel: 6, labelOnEdge: 4, crossing: 1 };
const CELL = 24;

function evaluate(detail = false) {
  const B = nodes.map((_, i) => ({ x: X[i], y: Y[i], w: Wd[i], h: Ht[i] }));
  // hard constraint: boxes need a 40px gap
  let penalty = 0;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    if (ov({ x: a.x - 40, y: a.y - 40, w: a.w + 80, h: a.h + 80 }, b, 0)) penalty += 1000;
  }
  const E = edges.map((_, k) => edgePoints(k));
  const counts = { throughNode: 0, overlap: 0, labelOnNode: 0, labelOnLabel: 0, labelOnEdge: 0, crossing: 0 };
  let soft = 0;
  // spatial hash of edge points
  const grid = new Map();
  E.forEach((e, k) => e.pts.forEach((p, s) => {
    const key = ((p[0] / CELL) | 0) * 100003 + ((p[1] / CELL) | 0);
    let arr = grid.get(key); if (!arr) grid.set(key, arr = []); arr.push(k, s);
  }));
  const near = (x, y, fn) => {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get((cx + dx) * 100003 + cy + dy); if (!arr) continue;
      for (let q = 0; q < arr.length; q += 2) fn(arr[q], arr[q + 1]);
    }
  };
  // Arrows sharing a box may touch right next to it (same 45px zone as score.mjs).
  // Tried a stricter 30px/10px rule (2026-09-30): it spread hub diagrams very
  // wide and flat and broke row order, so it was reverted. Some gap between the
  // predicted and real score on hub diagrams is expected; re-running helps.
  const sharedNear = (x, y, a, b) => {
    for (const id of [EF[a], ET[a]]) if ((id === EF[b] || id === ET[b]) && inBox(x, y, B[id], 45)) return true;
    return false;
  };
  // through node (incl. own endpoints, away from the attach points)
  E.forEach((e, k) => {
    for (let i = 0; i < B.length; i++) {
      let hits = 0;
      const own = i === EF[k] || i === ET[k];
      for (const p of e.pts) if (inBox(p[0], p[1], B[i], own ? -12 : -2)) hits++;
      if (hits) { counts.throughNode++; soft += hits * 2; }
    }
  });
  // overlap + crossings via hash
  const overlapRun = new Map(), crossed = new Set();
  E.forEach((e, a) => e.pts.forEach((p, s) => {
    near(p[0], p[1], (b, t) => {
      if (b <= a) return;
      const q = E[b].pts[t];
      if ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < 49 && !sharedNear(p[0], p[1], a, b)) {
        const key = a * 1000 + b; overlapRun.set(key, (overlapRun.get(key) || 0) + 1);
      }
      if (s > 0 && t > 0 && !crossed.has(a * 1000 + b) && !sharedNear(p[0], p[1], a, b) &&
        segX(e.pts[s - 1], p, E[b].pts[t - 1], q)) crossed.add(a * 1000 + b);
    });
  }));
  for (const [, run] of overlapRun) { soft += run; if (run * 6 >= 24) counts.overlap++; }
  counts.crossing = crossed.size;
  // labels
  const L = E.map((e, k) => [e.label, k]).filter(([l]) => l);
  for (const [l, k] of L) {
    for (const b of B) if (ov(l, b)) counts.labelOnNode++;
    const hitEdges = new Set();
    for (let x = l.x; x <= l.x + l.w + CELL; x += CELL) for (let y = l.y; y <= l.y + l.h + CELL; y += CELL)
      near(x, y, (b, t) => { if (b !== k) { const q = E[b].pts[t]; if (inBox(q[0], q[1], l, -1)) hitEdges.add(b); } });
    counts.labelOnEdge += hitEdges.size;
  }
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (ov(L[i][0], L[j][0])) counts.labelOnLabel++;

  // flow direction: downward edges must end at least 60px lower than they start
  counts.backFlow = 0; counts.sideAway = 0;
  for (let k = 0; k < edges.length; k++) {
    const a = B[EF[k]], b = B[ET[k]];
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    if (FLOWS_DOWN[k] && by - ay < 60) { counts.backFlow++; soft += (60 - (by - ay)) * 0.05; }
    // spine: downward edges prefer to run straight down (per row they span)
    if (FLOWS_DOWN[k]) soft += Math.abs(bx - ax) * 0.03 / Math.max(1, RANK[ET[k]] - RANK[EF[k]]);
    // sides should face the other box
    const [fx, fy] = NORMAL[FS[k]], [tx, ty] = NORMAL[TS[k]];
    if (fx * (bx - ax) + fy * (by - ay) < 0) counts.sideAway++;
    if (tx * (ax - bx) + ty * (ay - by) < 0) counts.sideAway++;
  }
  const score = Object.keys(W).reduce((s, k) => s + W[k] * counts[k], 0) + 8 * counts.backFlow + 4 * counts.sideAway;
  // compactness: total edge length and bounding box
  const len = E.reduce((s, e) => s + e.len, 0);
  const minX = Math.min(...B.map(b => b.x)), maxX = Math.max(...B.map(b => b.x + b.w));
  const minY = Math.min(...B.map(b => b.y)), maxY = Math.max(...B.map(b => b.y + b.h));
  const area = (maxX - minX) * (maxY - minY);
  const total = score * 10 + soft * 0.5 + len * 0.01 + area / 20000 + penalty;
  return detail ? { total, score, counts, len: Math.round(len), size: `${maxX - minX}x${maxY - minY}` } : total;
}

// ---------- simulated annealing ----------
let cur = evaluate();
let best = cur, bestState = null;
const save = () => ({ X: [...X], GAP: [...GAP], RANK: [...RANK], FS: [...FS], TS: [...TS] });
const load = s => { s.X.forEach((v, i) => X[i] = v); s.GAP.forEach((v, i) => GAP[i] = v); s.RANK.forEach((v, i) => RANK[i] = v); applyRows(); s.FS.forEach((v, i) => FS[i] = v); s.TS.forEach((v, i) => TS[i] = v); };
bestState = save();
console.log('start', evaluate(true));
const T0 = 400, T1 = 1;
for (let it = 0; it < ITERS; it++) {
  const frac = it / ITERS, T = T0 * Math.pow(T1 / T0, frac);
  const r = rand();
  let undo;
  if (r < 0.45) { // slide one box sideways within its row
    const i = (rand() * nodes.length) | 0, step = 40 + 600 * (1 - frac);
    const ox = X[i];
    X[i] = snap(ox + (rand() - 0.5) * 2 * step);
    undo = () => { X[i] = ox; };
  } else if (r < 0.55) { // swap two boxes in the same row
    const i = (rand() * nodes.length) | 0, mates = rowMembers(RANK[i]).filter(j => j !== i);
    if (!mates.length) continue;
    const j = mates[(rand() * mates.length) | 0], ox = [X[i], X[j]];
    [X[i], X[j]] = [X[j], X[i]];
    undo = () => { [X[i], X[j]] = ox; };
  } else if (r < 0.62) { // slide a whole row sideways
    const rr = (rand() * rows) | 0, ms = rowMembers(rr), d = snap((rand() - 0.5) * 400), ox = ms.map(i => X[i]);
    ms.forEach(i => X[i] += d);
    undo = () => ms.forEach((i, q) => X[i] = ox[q]);
  } else if (r < 0.66) { // move a box to another row (upward-pointing arrows are penalised)
    if (frac < 0.75) continue; // only in the final, improvement-only phase
    const i = (rand() * nodes.length) | 0, old = RANK[i];
    const to = Math.min(rows - 1, Math.max(0, old + Math.round((rand() - 0.5) * 8)));
    if (to === old) continue;
    RANK[i] = to; applyRows();
    undo = () => { RANK[i] = old; applyRows(); };
  } else if (r < 0.72) { // change the gap above a row
    const rr = 1 + ((rand() * (rows - 1)) | 0), old = GAP[rr];
    GAP[rr] = Math.max(MIN_ROW_GAP, snap(old + (rand() - 0.5) * 160));
    applyRows();
    undo = () => { GAP[rr] = old; applyRows(); };
  } else { // change one edge side
    const k = (rand() * edges.length) | 0, which = rand() < 0.5 ? FS : TS, old = which[k];
    which[k] = SIDES[(rand() * 4) | 0];
    undo = () => { which[k] = old; };
  }
  const next = evaluate();
  const greedy = frac >= 0.75; // last quarter: accept only improvements
  if (next <= cur || (!greedy && rand() < Math.exp((cur - next) / T))) {
    cur = next;
    if (cur < best) { best = cur; bestState = save(); }
  } else undo();
  if (it % 10000 === 0) console.log(it, Math.round(cur), Math.round(best));
}
load(bestState);
const result = evaluate(true);
console.log('best', result);

// write back
nodes.forEach((n, i) => { n.x = X[i]; n.y = Y[i]; });
edges.forEach((e, k) => { e.fromSide = FS[k]; e.toSide = TS[k]; });
fs.writeFileSync(outPath, JSON.stringify(canvas, null, '\t'));
// machine-readable summary for pipeline.mjs
console.log('RESULT ' + JSON.stringify({ total: result.total, score: result.score, counts: result.counts, size: result.size }));
