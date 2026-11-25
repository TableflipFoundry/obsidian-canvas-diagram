// Evidence coverage is separate from visual quality. This validates an author's
// explicit inventory; it cannot discover every semantic relationship in code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const subject = item => !String(item.id).startsWith('legend-') && item.type !== 'group' && !/-issues\.md$/i.test(item.file ?? '');
export const auditNodes = canvas => (canvas.nodes ?? []).filter(subject);
export const auditEdges = canvas => (canvas.edges ?? []).filter(e => !String(e.id).startsWith('legend-'));
export const FACETS = ['callers', 'calls', 'reads', 'writes', 'returns', 'consumers'];
const kinds = new Set(['request', 'return', 'read', 'write', 'event', 'render', 'ownership']);
const text = value => typeof value === 'string' && value.trim().length > 0;
export const sourceHash = file => digest(fs.readFileSync(file));

// Geometry, attachment sides and IO mode do not alter relationship coverage.
// Note identity, edge direction, label and semantic style do.
export function relationshipHash(canvas) {
  const nodes = auditNodes(canvas).map(n => [n.id, n.type, n.file ?? n.text ?? n.url ?? '', n.color ?? '', n.styleAttributes ?? {}]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const edges = auditEdges(canvas).map(e => [e.id,e.fromNode,e.toNode,e.label ?? '',e.color ?? '',e.styleAttributes ?? {}]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return digest(JSON.stringify({nodes,edges}));
}

export function validateAudit(canvas, audit, sourceRoot) {
  const problems = [], snapshots = {};
  const fail = message => problems.push(message);
  if (!audit || audit.version !== 1 || !['code','design'].includes(audit.mode))
    return { problems: ['Use version: 1 and mode: code or design in the relationship inventory.'], snapshots };
  if (!text(audit.scope)) fail('Describe the inventory scope and selected diagram detail.');
  const nodes = auditNodes(canvas), edges = auditEdges(canvas);
  const nodeIds = new Set(nodes.map(n=>n.id));
  const edgesById = new Map(edges.map(e=>[e.id,e]));
  const relationships = Array.isArray(audit.relationships) ? audit.relationships : [];
  const byId = new Map();
  function evidence(refs, context) {
    if (!Array.isArray(refs) || !refs.length) { fail(`${context}: cite source evidence (file, line and exact text).`); return; }
    for (const ref of refs) {
      if (!text(ref?.file) || !Number.isInteger(ref.line) || ref.line < 1 || !text(ref.text)) {
        fail(`${context}: invalid source reference; use file, positive line and exact text.`); continue;
      }
      const file = path.resolve(sourceRoot, ref.file);
      try {
        const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g,'\n');
        const excerpt = ref.text.replace(/\r\n/g,'\n');
        const actual = raw.split('\n').slice(ref.line-1,ref.line-1+excerpt.split('\n').length).join('\n');
        if (actual !== excerpt) fail(`${context}: evidence does not match ${ref.file}:${ref.line}.`);
        snapshots[ref.file] = sourceHash(file);
      } catch { fail(`${context}: cannot read evidence ${ref.file}.`); }
    }
  }
  function support(item, context) {
    if (audit.mode === 'design' && item.basis !== 'code' && text(item.design)) return;
    evidence(item.evidence, context);
  }
  const mapped = new Set();
  for (const r of relationships) {
    if (!text(r?.id) || byId.has(r.id)) { fail('Each relationship needs a unique id.'); continue; }
    byId.set(r.id,r);
    if (!kinds.has(r.kind) || !text(r.from) || !text(r.to) || !text(r.description)) fail(`${r.id}: supply kind, from, to and a description of what travels.`);
    support(r, r.id);
    if (r.edge) {
      const e = edgesById.get(r.edge);
      if (!e || e.fromNode !== r.from || e.toNode !== r.to) fail(`${r.id}: edge ${r.edge} does not match the recorded direction/endpoints.`);
      mapped.add(r.edge);
      if (r.omitted) fail(`${r.id}: choose a drawn edge or an omission reason, not both.`);
    } else if (!text(r.omitted)) fail(`${r.id}: draw this relationship or explain its deliberate omission at this detail level.`);
    if (!nodeIds.has(r.from) && !nodeIds.has(r.to)) fail(`${r.id}: relationship has no subject in this diagram.`);
  }
  for (const e of edges) if (!mapped.has(e.id)) fail(`Edge ${e.id} has no evidence-backed relationship entry.`);
  const coverage = Array.isArray(audit.nodes) ? audit.nodes : [];
  const covered = new Set();
  const eligible = (facet,r,id) => {
    if (facet === 'callers') return r.to === id && ['request','render'].includes(r.kind);
    if (facet === 'calls') return r.from === id && ['request','render'].includes(r.kind);
    if (facet === 'reads') return r.to === id && r.kind === 'read';
    if (facet === 'writes') return r.from === id && r.kind === 'write';
    if (facet === 'returns') return r.from === id && r.kind === 'return';
    return r.from === id && ['return','read','write','event'].includes(r.kind);
  };
  for (const n of coverage) {
    if (!n || typeof n !== 'object') { fail('Invalid node coverage record.');continue; }
    if (!nodeIds.has(n.node) || covered.has(n.node)) { fail(`Unknown or repeated coverage node: ${n.node}.`); continue; }
    covered.add(n.node);
    support(n, `${n.node} implementation/call-site review`);
    // A source search for other consumers is required independently of the
    // already-drawn arrows. Search hits are clues, not proof of a direct call.
    if (!text(n.search?.query) || !text(n.search?.scope) || !text(n.search?.result)) fail(`${n.node}: record the caller/consumer search query, scope and result.`);
    support(n.search ?? {}, `${n.node} consumer search`);
    for (const facet of FACETS) {
      const f = n[facet];
      if (!f || !Array.isArray(f.relationships)) { fail(`${n.node}: review ${facet}; list relationship IDs or an evidence-backed absence.`); continue; }
      const expected = relationships.filter(r=>eligible(facet,r,n.node)).map(r=>r.id);
      for (const id of expected) if (!f.relationships.includes(id)) fail(`${n.node}.${facet}: missing recorded relationship ${id}.`);
      for (const id of f.relationships) if (!byId.has(id) || !eligible(facet,byId.get(id),n.node)) fail(`${n.node}.${facet}: ${id} is not a matching relationship.`);
      if (!f.relationships.length) {
        if (!text(f.none)) fail(`${n.node}.${facet}: explain why there is no applicable relationship; do not use silence as evidence.`);
        support(f, `${n.node}.${facet} absence`);
      }
    }
  }
  for (const n of nodes) if (!covered.has(n.id)) fail(`Node ${n.id} has no caller/read/write/return/consumer coverage.`);
  return { problems, snapshots };
}

export function relationshipAuditProblems(vault, job, canvas) {
  if (job.reviewVersion < 4) return [];
  const problem = msg => [{id:'relationship-audit',msg}];
  const hash = relationshipHash(canvas);
  if (job.mode === 'presentation') {
    if (hash !== job.relationshipBaseline) return problem('Relationships changed during a presentation-only job. Start a content job and audit them, or restore the semantic graph.');
    return [];
  }
  const saved = job.relationshipAudit;
  if (!saved) return problem('Code/data relationship completeness has not been audited. Read references/relationship-audit.md, write <diagram>.relationships.json, then run audit.mjs <canvas> <inventory>. Visual review alone does not establish completeness.');
  try {
    const file = path.resolve(vault,saved.file);
    if (sourceHash(file) !== saved.inventoryHash || hash !== saved.graphHash) return problem('The relationship inventory or semantic graph changed after the audit. Run audit.mjs again after tracing the changed interactions.');
    const audit = JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    if (audit.mode !== (job.mode ?? 'code')) return problem('Relationship audit mode does not match the active code/design job.');
    const root = path.resolve(vault,saved.sourceRoot);
    const result = validateAudit(canvas,audit,root);
    if (result.problems.length) return problem(result.problems.join('\n'));
    for (const [source,hash] of Object.entries(saved.sources)) if (sourceHash(path.resolve(root,source)) !== hash) return problem(`Source ${source} changed after the relationship audit. Recheck the affected callers, returns and consumers and rerun audit.mjs.`);
  } catch (error) { return problem(`Cannot verify relationship evidence: ${error.message}`); }
  return [];
}
