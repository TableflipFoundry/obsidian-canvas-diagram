// THE LEGEND: the one fixed visual vocabulary for every diagram.
// Everything that checks or draws colors and styles reads from here:
// pipeline.mjs (rejects anything off-legend, then adds a legend panel),
// check.mjs (stop check), and SKILL.md documents the same table.
// Change the vocabulary here and in SKILL.md "The legend", nowhere else.
import fs from 'node:fs';
import path from 'node:path';

// Box color by note `type`. Preset strings "1"-"6" are Obsidian's built-in
// colors; hex values are custom colors for types that needed their own.
export const NODE_TYPES = {
  person:    { color: '#3d6fd9', label: 'Person' },
  system:    { color: '6',       label: 'Outside system' },
  screen:    { color: '#d4579b', label: 'Screen' },
  component: { color: '5',       label: 'Component' },
  function:  { color: '4',       label: 'Function' },
  data:      { color: '3',       label: 'Data' },
  decision:  { color: '2',       label: 'Decision' },
  event:     { color: '1',       label: 'Event' },
  actor:     { color: '6',       label: 'Person / outside system (old type)', legacy: true }, // old notes; new notes use person/system
};

// Box borders (Advanced Canvas styleAttributes.border)
export const BORDERS = {
  dashed: 'Planned (not built yet)',
  dotted: 'Broken / unused',
};

// Arrow line (styleAttributes.path); null = solid
export const PATHS = {
  null:           'right away',
  'long-dashed':  'later (queued, background)',
  'dotted':       'on a timer',
  'short-dashed': 'planned',
};

// Arrowhead (styleAttributes.arrow); null = normal triangle
export const ARROWS = { diamond: 'is part of' };

// Arrow color; null = plain call / connects to
export const EDGE_COLORS = {
  '5': 'data',
  '6': 'outside service',
  '1': 'error',
};

// Forbidden Advanced Canvas attributes (see SKILL.md)
const FORBIDDEN = { edge: ['pathfindingMethod'], node: ['shape', 'textAlign'] };

export const isLegendItem = x => typeof x?.id === 'string' && x.id.startsWith('legend-');

function noteType(vault, file) {
  try {
    const t = fs.readFileSync(path.join(vault, file), 'utf8').replace(/^﻿/, '');
    const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tm = m && m[1].match(/^type:\s*(\S+)/m);
    return tm ? tm[1].trim() : null;
  } catch { return null; }
}

/** Everything in the canvas that isn't on the legend. Returns [{ id, msg }]. */
export function legendProblems(canvas, vault) {
  const out = [];
  const bad = (id, msg) => out.push({ id, msg });
  for (const n of canvas.nodes ?? []) {
    if (isLegendItem(n) || n.type === 'group') continue;
    const sa = n.styleAttributes ?? {};
    for (const k of Object.keys(sa)) {
      if (sa[k] == null) continue;
      if (FORBIDDEN.node.includes(k)) bad(`style:${n.id}`, `box ${n.id} uses "${k}", which isn't allowed (remove it)`);
      else if (k !== 'border') bad(`style:${n.id}`, `box ${n.id} has an unknown style "${k}" (only "border" is allowed on boxes)`);
      else if (!BORDERS[sa[k]]) bad(`style:${n.id}`, `box ${n.id} has border "${sa[k]}" (allowed: ${Object.keys(BORDERS).join(', ')}, or none)`);
    }
    if (n.type !== 'file') { bad(`box:${n.id}`, `box ${n.id} is a "${n.type}" box; diagram boxes must be note files (type "file")`); continue; }
    if (/-issues\.md$/i.test(n.file ?? '')) {
      if (n.color !== '1') bad(`color:${n.id}`, `the issues box ${n.id} must be red ("color": "1")`);
      continue;
    }
    const type = noteType(vault, n.file ?? '');
    const def = NODE_TYPES[type];
    if (!def) { bad(`type:${n.id}`, `${n.file} has type "${type ?? 'missing'}" (allowed: ${Object.keys(NODE_TYPES).filter(t => !NODE_TYPES[t].legacy).join(', ')})`); continue; }
    if ((n.color ?? null) !== def.color) bad(`color:${n.id}`, `box ${n.id} (${n.file}, type ${type}) must have "color": "${def.color}" (${def.label}), not ${n.color ? `"${n.color}"` : 'no color'}`);
  }
  for (const e of canvas.edges ?? []) {
    if (isLegendItem(e)) continue;
    const sa = e.styleAttributes ?? {};
    for (const k of Object.keys(sa)) {
      const v = sa[k];
      if (v == null) continue;
      if (FORBIDDEN.edge.includes(k)) bad(`style:${e.id}`, `arrow ${e.id} uses "${k}", which isn't allowed (remove it)`);
      else if (k === 'path') { if (!(v in PATHS)) bad(`style:${e.id}`, `arrow ${e.id} has path "${v}" (allowed: long-dashed, dotted, short-dashed, or none for solid)`); }
      else if (k === 'arrow') { if (!ARROWS[v]) bad(`style:${e.id}`, `arrow ${e.id} has arrowhead "${v}" (allowed: diamond, or none)`); }
      else bad(`style:${e.id}`, `arrow ${e.id} has an unknown style "${k}" (allowed: path, arrow)`);
    }
    if (e.color != null && !EDGE_COLORS[e.color])
      bad(`color:${e.id}`, `arrow ${e.id} has color "${e.color}" (allowed: "5" data, "6" outside service, "1" error, or no color for a plain call)`);
  }
  return out;
}

/**
 * Build the legend panel for what the canvas actually uses.
 * Returns { nodes, edges } with ids prefixed "legend-", positioned with its
 * top-left corner at (x, y).
 */
export function buildLegend(canvas, vault, x, y) {
  const flowNodes = (canvas.nodes ?? []).filter(n => !isLegendItem(n) && n.type === 'file' && !/-issues\.md$/i.test(n.file ?? ''));
  const flowEdges = (canvas.edges ?? []).filter(e => !isLegendItem(e));
  const usedTypes = new Set(flowNodes.map(n => noteType(vault, n.file ?? '')).filter(t => NODE_TYPES[t]));
  const boxRows = Object.entries(NODE_TYPES).filter(([t]) => usedTypes.has(t));
  const borders = Object.keys(BORDERS).filter(b => flowNodes.some(n => n.styleAttributes?.border === b));
  const paths = Object.keys(PATHS).filter(p => flowEdges.some(e => String(e.styleAttributes?.path ?? null) === p));
  const arrows = Object.keys(ARROWS).filter(a => flowEdges.some(e => e.styleAttributes?.arrow === a));
  const colors = Object.keys(EDGE_COLORS).filter(c => flowEdges.some(e => e.color === c));

  const nodes = [], edges = [];
  const W = 260, H = 50, G = 20, PAD = 30;
  let cy = y + 60;
  const heading = t => { nodes.push({ id: `legend-h-${t.toLowerCase()}`, type: 'text', text: `**${t}**`, x: x + PAD, y: cy, width: 2 * W + G, height: 40, styleAttributes: { border: 'invisible' } }); cy += 50; };
  const swatches = items => {
    items.forEach((it, i) => nodes.push({ id: `legend-${it.id}`, type: 'text', text: it.text, x: x + PAD + (i % 2) * (W + G), y: cy + Math.floor(i / 2) * (H + G), width: W, height: H, ...(it.color ? { color: it.color } : {}), ...(it.sa ? { styleAttributes: it.sa } : {}) }));
    cy += Math.ceil(items.length / 2) * (H + G) + 20;
  };
  const sampleArrow = (key, label, opts) => {
    const a = `legend-${key}-from`, b = `legend-${key}-to`;
    nodes.push({ id: a, type: 'text', text: ' ', x: x + PAD, y: cy, width: 30, height: 30, styleAttributes: { border: 'invisible' } });
    nodes.push({ id: b, type: 'text', text: label, x: x + PAD + 190, y: cy - 5, width: 300, height: 40, styleAttributes: { border: 'invisible' } });
    edges.push({ id: `legend-${key}`, fromNode: a, fromSide: 'right', toNode: b, toSide: 'left', ...opts });
    cy += 55;
  };

  const boxItems = [
    ...boxRows.map(([t, d]) => ({ id: `type-${t}`, text: d.label, color: d.color })),
    ...borders.map(b => ({ id: `border-${b}`, text: BORDERS[b], sa: { border: b } })),
  ];
  if (boxItems.length) { heading('Boxes'); swatches(boxItems); }
  const arrowCount = paths.length + arrows.length + colors.length;
  if (arrowCount) {
    heading('Arrows');
    nodes.push({ id: 'legend-arrow-rule', type: 'text', text: 'An arrow starts where the thing comes from and points where it goes.',
      x: x + PAD, y: cy - 10, width: 2 * W + G, height: 50, styleAttributes: { border: 'invisible' } });
    cy += 50;
    for (const p of paths) sampleArrow(`path-${p}`, PATHS[p], p === 'null' ? {} : { styleAttributes: { path: p } });
    for (const a of arrows) sampleArrow(`arrow-${a}`, ARROWS[a], { styleAttributes: { arrow: a } });
    for (const c of colors) sampleArrow(`color-${c}`, EDGE_COLORS[c], { color: c });
  }
  const group = { id: 'legend-group', type: 'group', label: 'Legend', x, y, width: 2 * W + G + 2 * PAD, height: cy - y + 10 };
  return { nodes: [group, ...nodes], edges };
}
