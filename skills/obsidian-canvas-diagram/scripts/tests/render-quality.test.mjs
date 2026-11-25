import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProblems } from '../lib/render-quality.mjs';

test('quality gate blocks obstructed content without rejecting ordinary crossings', () => {
  assert.deepEqual(renderProblems({ issues: { crossing: [{ edge: 'a' }] } }), []);
  assert.deepEqual(renderProblems({ issues: { throughNode: [{ edge: 'a' }], labelOnEdge: [{ label: 'name' }] } }).map(p => p.id), ['render:throughNode', 'render:labelOnEdge']);
});

test('a legacy job without structured native quality remains readable', () => {
  assert.deepEqual(renderProblems(undefined), []);
});
