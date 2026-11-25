import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRelationships, refineRelationships, assertNoteMeaning } from '../lib/relationships.mjs';

const node = (id, x = 0, y = 0, extra = {}) => ({ id, type: 'file', file: `nodes/${id}.md`, x, y, width: 320, height: 200, ...extra });
const edge = (id, fromNode, toNode, extra = {}) => ({ id, fromNode, toNode, ...extra });
const typeOf = n => n.file === 'nodes/store.md' ? 'data' : 'function';

test('simple single-in/single-out chain becomes a straight column by default', () => {
  const input = { nodes: [node('a', 0, 0), node('b', 300, 340), node('c', 600, 680)], edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')] };
  const out = refineRelationships(input);
  assert.equal(out.nodes[0].x, out.nodes[1].x); assert.equal(out.nodes[1].x, out.nodes[2].x);
  assertNoteMeaning(input, out); assert.equal(input.nodes[1].x, 300);
});

test('helper is beside its caller, including a caller with only one outgoing edge', () => {
  const input = { nodes: [node('form', 300, 0), node('check', 2000, 680)], edges: [edge('check', 'form', 'check')] };
  const prepared = prepareRelationships(input, { version: 1, supports: [{ node: 'check', anchor: 'form', side: 'right' }] }, typeOf);
  const out = refineRelationships(prepared.canvas, prepared.plan);
  const [a, b] = out.nodes;
  assert.equal(a.y, b.y); assert.equal(b.x - (a.x + a.width), 100);
  assert.equal(out.edges[0].fromSide, 'right'); assert.equal(out.edges[0].toSide, 'left');
});

test('shared-data references preserve note identity, direction, label and style; rerun is idempotent', () => {
  const input = { nodes: [node('read'), node('write', 0, 680), node('store', 1000, 0, { color: '3' })], edges: [edge('read', 'store', 'read', { color: '5', label: 'rows' }), edge('write', 'write', 'store', { styleAttributes: { path: 'long-dashed' } })] };
  const plan = { version: 1, references: [{ node: 'store', anchor: 'write', edges: ['write'], side: 'left' }] };
  const first = prepareRelationships(input, plan, typeOf);
  assert.equal(first.added, 1); assert.equal(first.canvas.nodes.length, 4);
  assertNoteMeaning(input, first.canvas);
  const second = prepareRelationships(first.canvas, plan, typeOf);
  assert.equal(second.added, 0); assert.equal(second.canvas.nodes.length, 4);
  const ref = second.canvas.nodes.find(n => n.id === 'store--ref-write');
  assert.equal(ref.file, 'nodes/store.md'); assert.equal(ref.color, '3');
  assert.equal(second.canvas.edges[1].fromNode, 'write');
  const out = refineRelationships(second.canvas, second.plan);
  assert.equal(out.nodes.find(n => n.id === ref.id).y, out.nodes.find(n => n.id === 'write').y);
});

test('sibling alignment and collision packing keep a protected spine intact', () => {
  const input = { nodes: [node('a'), node('b', 300, 340), node('helper', 0, 680), node('other', 0, 0)], edges: [edge('ab', 'a', 'b'), edge('ah', 'a', 'helper')] };
  const plan = { version: 1, spines: [['a', 'b']], supports: [{ node: 'helper', anchor: 'a', side: 'right' }] };
  const ready = prepareRelationships(input, plan, typeOf), out = refineRelationships(ready.canvas, ready.plan);
  const get = id => out.nodes.find(n => n.id === id);
  assert.equal(get('a').x, get('b').x); assert.equal(get('a').y, get('helper').y);
  assert.ok(Math.abs(get('a').x - get('other').x) >= 420);
});

test('reference joins its user group, and cross-group geometry constraints are rejected', () => {
  const input = { nodes: [{ id: 'g', type: 'group', x: 0, y: 0, width: 900, height: 900 }, node('read', 100, 100), node('store', 1500, 0)], edges: [edge('r', 'store', 'read')] };
  const ready = prepareRelationships(input, { version: 1, references: [{ node: 'store', anchor: 'read', edges: ['r'] }] }, typeOf);
  assert.equal(ready.canvas.nodes.find(n => n.id === 'store--ref-read').group, 'g');
  assert.throws(() => prepareRelationships(input, { version: 1, supports: [{ node: 'store', anchor: 'read', side: 'right' }] }, typeOf), /feature groups/);
});

test('invalid plans fail before mutating input or redirecting unrelated edges', () => {
  const input = { nodes: [node('a'), node('b'), node('store')], edges: [edge('ab', 'a', 'b')] };
  const before = structuredClone(input);
  assert.throws(() => prepareRelationships(input, { version: 1, references: [{ node: 'store', anchor: 'a', edges: ['ab'] }] }, typeOf), /exactly one endpoint/);
  assert.throws(() => prepareRelationships(input, { version: 1, spines: [['b', 'a']] }, typeOf), /no directed connection/);
  assert.deepEqual(input, before);
});

test('empty diagrams and disconnected nodes are handled without invalid geometry', () => {
  assert.deepEqual(refineRelationships({ nodes: [], edges: [] }), { nodes: [], edges: [] });
  const out = refineRelationships({ nodes: [node('a'), node('b')], edges: [] });
  assert.ok(Math.abs(out.nodes[0].x - out.nodes[1].x) >= 420);
});

test('branch chains pack close to their caller instead of retaining remote ELK columns', () => {
  const input = { nodes: [node('a'), node('b', 0, 340), node('branch', 50000, 680), node('end', 50000, 1020)], edges: [edge('ab', 'a', 'b'), edge('branch', 'b', 'branch'), edge('end', 'branch', 'end')] };
  const out = refineRelationships(input, { spines: [['a', 'b'], ['branch', 'end']] });
  assert.equal(out.nodes.find(n => n.id === 'branch').x, out.nodes.find(n => n.id === 'b').x);
  assert.equal(out.nodes.find(n => n.id === 'branch').x, out.nodes.find(n => n.id === 'end').x);
});

test('nearby helpers leave enough horizontal room for existing arrow labels', () => {
  const input = { nodes: [node('a'), node('b', 5000, 340)], edges: [edge('ab', 'a', 'b', { label: 'profile writes' })] };
  const plan = { supports: [{ node: 'b', anchor: 'a', side: 'right' }] };
  const out = refineRelationships(input, plan);
  assert.ok(out.nodes[1].x - out.nodes[0].x - 320 > 200);
});
