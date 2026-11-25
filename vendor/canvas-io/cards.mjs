// src/geometry.ts
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

// src/cards.ts
function isIOCard(data, legacyIOConnection = false) {
  if (data.type === "group" || String(data.id ?? "").startsWith("legend-")) return false;
  if (typeof data.canvasIO?.ports === "boolean") return data.canvasIO.ports;
  return data.type === "file" && /\.md$/i.test(data.file ?? "") || legacyIOConnection;
}
function cardAnchor(box, side, kind, io) {
  if (io) return anchorPoint(box, side, kind);
  return {
    x: side === "left" ? box.minX : side === "right" ? box.maxX : (box.minX + box.maxX) / 2,
    y: side === "top" ? box.minY : side === "bottom" ? box.maxY : (box.minY + box.maxY) / 2
  };
}
export {
  cardAnchor,
  isIOCard
};
