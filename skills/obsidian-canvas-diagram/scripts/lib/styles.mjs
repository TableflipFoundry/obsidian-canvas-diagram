// Advanced Canvas style attributes this plugin uses (stored in the .canvas file
// as "styleAttributes" on a node or edge). Values come from Advanced Canvas
// 7.x (BUILTIN_EDGE_STYLE_ATTRIBUTES / BUILTIN_NODE_STYLE_ATTRIBUTES). A missing
// key means the default (solid line, triangle arrowhead, solid border).
export const EDGE_STYLES = {
  path: ['dotted', 'short-dashed', 'long-dashed'],
  arrow: ['triangle-outline', 'thin-triangle', 'halved-triangle', 'diamond', 'diamond-outline', 'circle', 'circle-outline', 'blunt'],
};
export const NODE_STYLES = {
  border: ['dashed', 'dotted', 'invisible'],
};
// Not allowed: pathfindingMethod changes the edge shape the layout is tuned for;
// shape and textAlign only apply to text nodes (our boxes are note files).
export const FORBIDDEN = { edge: ['pathfindingMethod'], node: ['shape', 'textAlign'] };

/** Returns a list of plain-language problems with a canvas's style attributes. */
export function styleProblems(canvas) {
  const out = [];
  const check = (owner, attrs, allowed, forbidden) => {
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v === null || v === undefined) continue;
      if (forbidden.includes(k)) out.push({ owner, key: k, msg: `${owner} uses "${k}", which isn't allowed (remove it)` });
      else if (!allowed[k]) out.push({ owner, key: k, msg: `${owner} has an unknown style "${k}" (allowed: ${Object.keys(allowed).join(', ')})` });
      else if (!allowed[k].includes(v)) out.push({ owner, key: k, msg: `${owner} has ${k}: "${v}" (allowed: ${allowed[k].join(', ')}, or leave it out for the default)` });
    }
  };
  for (const n of canvas.nodes ?? []) check(`box ${n.id}`, n.styleAttributes, NODE_STYLES, FORBIDDEN.node);
  for (const e of canvas.edges ?? []) check(`arrow ${e.id}`, e.styleAttributes, EDGE_STYLES, FORBIDDEN.edge);
  return out;
}
