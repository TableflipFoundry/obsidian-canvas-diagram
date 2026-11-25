import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (name, args) => spawnSync(process.execPath, [path.join(scripts, name), ...args], { encoding: 'utf8', timeout: 60000 });

test('real pipeline applies helper constraints and reuses local data references on rerun', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-relationships-test-'));
  try {
    for (const dir of ['.obsidian', 'nodes', 'flow']) fs.mkdirSync(path.join(vault, dir));
    const note = (id, type) => fs.writeFileSync(path.join(vault, 'nodes', id + '.md'), `---\nid: ${id}\ntitle: ${id}\ntype: ${type}\nstatus: exists\nsource: example.js\nlevel: code\n---\n\nAn example note for layout integration verification.\n`);
    note('form', 'screen'); note('check', 'function'); note('save', 'function'); note('store', 'data');
    const n = (id, color) => ({ id, type: 'file', file: `nodes/${id}.md`, x: 0, y: 0, width: 320, height: 200, color });
    const file = path.join(vault, 'flow', 'flow.canvas');
    fs.writeFileSync(file, JSON.stringify({ nodes: [n('form', '#d4579b'), n('check', '4'), n('save', '4'), n('store', '3')], edges: [
      { id: 'check', fromNode: 'form', toNode: 'check' }, { id: 'save', fromNode: 'form', toNode: 'save' },
      { id: 'read', fromNode: 'store', toNode: 'check', color: '5' }, { id: 'write', fromNode: 'save', toNode: 'store', color: '5' },
    ] }));
    fs.writeFileSync(file.replace('.canvas', '.layout.json'), JSON.stringify({ version: 1, spines: [['form', 'save']], supports: [
      { node: 'check', anchor: 'form', side: 'right' }, { node: 'store', anchor: 'check', side: 'right' },
    ], references: [{ node: 'store', anchor: 'save', edges: ['write'], side: 'left' }] }));
    for (let i = 0; i < 2; i++) {
      const result = run('pipeline.mjs', [file, '--relayout', '--iters', '25', '--seeds', '1', '--seed', '5', '--no-check']);
      assert.equal(result.status, 0, result.stderr + result.stdout);
      const c = JSON.parse(fs.readFileSync(file)), get = id => c.nodes.find(n => n.id === id);
      assert.equal(get('form').x, get('save').x); assert.equal(get('check').y, get('form').y);
      assert.equal(get('store--ref-save').y, get('save').y);
      assert.equal(c.nodes.filter(n => n.type === 'file').length, 5);
      assert.equal(c.edges.find(e => e.id === 'write').toNode, 'store--ref-save');
      assert.ok(c.nodes.some(n => n.id === 'legend-group'));
      assert.ok(c.edges.filter(e => !e.id.startsWith('legend-')).every(e => e.canvasIO?.fromPort === 'output' && e.canvasIO?.toPort === 'input'));
      assert.ok(c.nodes.filter(n => n.id.startsWith('legend-')).every(n => n.canvasIO?.ports === false));
    }
    // Exercise the pre-existing grouped pipeline too: each local data view
    // must stay with its own reader/writer, rather than becoming a global hub.
    const grouped = JSON.parse(fs.readFileSync(file));
    grouped.nodes = grouped.nodes.filter(n => !n.id.startsWith('legend-'));
    grouped.edges = grouped.edges.filter(e => !e.id.startsWith('legend-'));
    for (const n of grouped.nodes) n.group = ['save', 'store--ref-save'].includes(n.id) ? 'write-group' : 'read-group';
    for (const id of ['read-group', 'write-group']) grouped.nodes.push({ id, type: 'group', label: id, x: 0, y: 0, width: 0, height: 0 });
    fs.writeFileSync(file, JSON.stringify(grouped));
    const planFile = file.replace('.canvas', '.layout.json');
    const plan = JSON.parse(fs.readFileSync(planFile)); plan.spines = [];
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const groupRun = run('pipeline.mjs', [file, '--relayout', '--iters', '25', '--seeds', '1', '--seed', '5', '--no-check']);
    assert.equal(groupRun.status, 0, groupRun.stderr + groupRun.stdout);
    const result = JSON.parse(fs.readFileSync(file));
    const g = result.nodes.find(n => n.id === 'write-group'), local = result.nodes.find(n => n.id === 'store--ref-save');
    assert.ok(local.x >= g.x && local.y >= g.y && local.x + local.width <= g.x + g.width && local.y + local.height <= g.y + g.height);
    const saved = fs.readFileSync(file, 'utf8');
    const preserveRun = run('pipeline.mjs', [file, '--no-check']);
    assert.equal(preserveRun.status, 0, preserveRun.stderr);
    assert.match(preserveRun.stdout, /Preserving the saved layout/);
    assert.equal(fs.readFileSync(file, 'utf8'), saved, 'default rerun must not change even a byte of a saved layout');
  } finally {
    assert.equal(path.dirname(path.resolve(vault)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(vault).startsWith('diagram-relationships-test-'));
    fs.rmSync(vault, { recursive: true, force: true });
  }
});

test('new jobs cannot mark visual review complete without the relationship attestation', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-review-test-'));
  try {
    fs.mkdirSync(path.join(vault, '.obsidian')); fs.mkdirSync(path.join(vault, 'flow'));
    const file = path.join(vault, 'flow', 'flow.canvas');
    fs.writeFileSync(file, '{"nodes":[],"edges":[]}');
    assert.equal(run('job.mjs', ['start', file]).status, 0);
    const description = 'Reviewed the main flow, helper proximity, local data references and preserved connections.';
    assert.notEqual(run('job.mjs', ['reviewed', file, description]).status, 0);
    assert.equal(run('job.mjs', ['reviewed', file, description, '--relationships']).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(vault, '.diagram-job.json'))).review.relationshipsChecked, true);
  } finally {
    assert.equal(path.dirname(path.resolve(vault)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(vault).startsWith('diagram-review-test-'));
    fs.rmSync(vault, { recursive: true, force: true });
  }
});
