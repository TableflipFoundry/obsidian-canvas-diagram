import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorPoint, connectionData, curve, isIO, portPoint, SIDES, KINDS } from '../src/geometry.ts';
const box = { minX: 0, minY: 0, maxX: 320, maxY: 200 };

test('eight distinct ports, with the agreed mirrored I/O order', () => {
  const expected = {
    top: [{ x: 136, y: 0 }, { x: 184, y: 0 }],
    right: [{ x: 320, y: 124 }, { x: 320, y: 76 }],
    bottom: [{ x: 184, y: 200 }, { x: 136, y: 200 }],
    left: [{ x: 0, y: 76 }, { x: 0, y: 124 }]
  };
  const points = SIDES.flatMap(side => KINDS.map(kind => portPoint(box, side, kind)));
  assert.equal(new Set(points.map(p => JSON.stringify(p))).size, 8);
  for (const side of SIDES) assert.deepEqual(KINDS.map(kind => portPoint(box, side, kind)), expected[side]);
});

test('request and response align on different parallel lanes, horizontally and vertically', () => {
  const right = { minX: 600, minY: 0, maxX: 920, maxY: 200 };
  const below = { minX: 0, minY: 500, maxX: 320, maxY: 700 };
  assert.equal(portPoint(box, 'right', 'output').y, portPoint(right, 'left', 'input').y);
  assert.equal(portPoint(box, 'right', 'input').y, portPoint(right, 'left', 'output').y);
  assert.equal(portPoint(box, 'bottom', 'output').x, portPoint(below, 'top', 'input').x);
  assert.equal(portPoint(box, 'bottom', 'input').x, portPoint(below, 'top', 'output').x);
});

test('ports follow node movement and stay within small resized cards', () => {
  const shifted = { minX: 50, minY: -30, maxX: 370, maxY: 170 };
  for (const side of SIDES) for (const kind of KINDS) {
    const before = portPoint(box, side, kind), after = portPoint(shifted, side, kind);
    assert.deepEqual(after, { x: before.x + 50, y: before.y - 30 });
    const small = portPoint({ minX: 0, minY: 0, maxX: 20, maxY: 20 }, side, kind);
    assert.ok(small.x >= 0 && small.x <= 20 && small.y >= 0 && small.y <= 20);
  }
});

test('saved edges retain native fallback sides and I/O metadata through JSON roundtrip', () => {
  const edge = connectionData('edge1', 'routes', 'right', 'aspects', 'left');
  assert.deepEqual(JSON.parse(JSON.stringify(edge)), edge);
  assert.equal(isIO(edge), true);
  assert.equal(isIO({}), false);
  assert.equal(isIO({ canvasIO: { version: 2, fromPort: 'output', toPort: 'input' } }), false);
  assert.equal(isIO({ canvasIO: { version: 1, fromPort: 'input', toPort: 'input' } }), false);
});

test('curves leave the selected sides outward and return accurate endpoints', () => {
  const geometry = curve({ x: 320, y: 76 }, 'right', { x: 600, y: 76 }, 'left');
  assert.ok(geometry.cp1.x > geometry.from.x);
  assert.ok(geometry.cp2.x < geometry.to.x);
  assert.equal(geometry.from.y, geometry.to.y);
  assert.ok(!geometry.path.includes('NaN'));
});

test('arrow tips end at the port rim, leaving direction visible', () => {
  assert.deepEqual(anchorPoint(box, 'right', 'output'), { x: 330, y: 76 });
  assert.deepEqual(anchorPoint(box, 'left', 'input'), { x: -10, y: 76 });
  assert.deepEqual(anchorPoint(box, 'top', 'input'), { x: 136, y: -10 });
  assert.deepEqual(anchorPoint(box, 'bottom', 'output'), { x: 136, y: 210 });
});
