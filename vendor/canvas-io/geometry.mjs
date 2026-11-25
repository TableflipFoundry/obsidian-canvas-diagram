// src/geometry.ts
var SIDES = ["top", "right", "bottom", "left"];
var KINDS = ["input", "output"];
var NORMAL = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};
function portPoint(box, side, kind) {
  const horizontal = side === "top" || side === "bottom";
  const extent = horizontal ? box.maxX - box.minX : box.maxY - box.minY;
  const gap = Math.min(24, extent / 4);
  const inputFirst = side === "top" || side === "left";
  const offset = (kind === "input" === inputFirst ? -1 : 1) * gap;
  return {
    x: side === "left" ? box.minX : side === "right" ? box.maxX : (box.minX + box.maxX) / 2 + offset,
    y: side === "top" ? box.minY : side === "bottom" ? box.maxY : (box.minY + box.maxY) / 2 + offset
  };
}
function anchorPoint(box, side, kind) {
  const point = portPoint(box, side, kind), normal = NORMAL[side];
  return { x: point.x + normal.x * 10, y: point.y + normal.y * 10 };
}
function curve(from, fromSide, to, toSide) {
  const reach = Math.max(40, Math.min(240, Math.hypot(to.x - from.x, to.y - from.y) / 2));
  const a = NORMAL[fromSide], b = NORMAL[toSide];
  const cp1 = { x: from.x + a.x * reach, y: from.y + a.y * reach };
  const cp2 = { x: to.x + b.x * reach, y: to.y + b.y * reach };
  return {
    from,
    to,
    cp1,
    cp2,
    path: `M${from.x},${from.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${to.x},${to.y}`
  };
}
function isIO(data) {
  const io = data.canvasIO;
  return io?.version === 1 && io.fromPort === "output" && io.toPort === "input";
}
function connectionData(id, fromNode, fromSide, toNode, toSide) {
  return {
    id,
    fromNode,
    fromSide,
    fromEnd: "none",
    toNode,
    toSide,
    toEnd: "arrow",
    canvasIO: { version: 1, fromPort: "output", toPort: "input" }
  };
}
export {
  KINDS,
  NORMAL,
  SIDES,
  anchorPoint,
  connectionData,
  curve,
  isIO,
  portPoint
};
