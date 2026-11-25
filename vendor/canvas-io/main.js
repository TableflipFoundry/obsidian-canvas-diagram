"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CanvasIO
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

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

// src/main.ts
var SVG = "http://www.w3.org/2000/svg";
var ROTATION = { top: 180, right: 270, bottom: 0, left: 90 };
var CanvasIO = class extends import_obsidian.Plugin {
  canvases = /* @__PURE__ */ new Set();
  nodes = /* @__PURE__ */ new Map();
  edges = /* @__PURE__ */ new Set();
  ports = /* @__PURE__ */ new WeakMap();
  restorers = /* @__PURE__ */ new Map();
  gesture;
  onload() {
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scan()));
    this.app.workspace.onLayoutReady(() => this.scan());
    this.registerInterval(window.setInterval(() => this.scan(), 250));
    this.addCommand({ id: "cancel-connection", name: "Cancel port connection", callback: () => this.cancel() });
  }
  onunload() {
    this.cancel();
    for (const object of [...this.restorers.keys()]) this.restore(object);
    for (const [node, layer] of this.nodes) {
      layer.remove();
      node.nodeEl.classList.remove("canvas-io-node");
    }
    for (const canvas of this.canvases) canvas.wrapperEl.classList.remove("canvas-io-active");
    for (const edge of this.edges) if (edge.canvas.edges.get(edge.id) === edge) edge.render();
  }
  wrap(object, key, make) {
    const own = Object.getOwnPropertyDescriptor(object, key);
    const original = object[key];
    const wrapped = make(original);
    object[key] = wrapped;
    this.addRestorer(object, () => {
      if (object[key] !== wrapped) return;
      if (own) Object.defineProperty(object, key, own);
      else delete object[key];
    });
  }
  addRestorer(object, restore) {
    const list = this.restorers.get(object) ?? [];
    list.push(restore);
    this.restorers.set(object, list);
  }
  restore(object) {
    for (const restore of (this.restorers.get(object) ?? []).reverse()) restore();
    this.restorers.delete(object);
  }
  scan() {
    const active = new Set(this.app.workspace.getLeavesOfType("canvas").map((leaf) => leaf.view.canvas).filter((c) => !!c));
    for (const canvas of active) {
      if (!canvas.nodes || !canvas.edges || !canvas.edgeContainerEl || !canvas.posFromClient) continue;
      if (!this.canvases.has(canvas)) {
        this.canvases.add(canvas);
        canvas.wrapperEl.classList.add("canvas-io-active");
        const capture = (event) => {
          if (event.button !== 0 || canvas.readonly) return;
          const port = this.portAt(event, canvas);
          if (!port) return;
          event.preventDefault();
          event.stopPropagation();
          if (this.gesture) this.finish(port);
          else this.begin(port);
        };
        canvas.wrapperEl.addEventListener("pointerdown", capture, true);
        this.addRestorer(canvas, () => canvas.wrapperEl.removeEventListener("pointerdown", capture, true));
        this.wrap(canvas, "addNode", (original) => (node) => {
          original.call(canvas, node);
          this.mountNode(node);
        });
        this.wrap(canvas, "addEdge", (original) => (edge) => {
          original.call(canvas, edge);
          this.mountEdge(edge);
        });
      }
      for (const node of canvas.nodes.values()) this.mountNode(node);
      for (const edge of canvas.edges.values()) this.mountEdge(edge);
    }
    for (const [node, layer] of this.nodes) {
      if (!active.has(node.canvas) || node.canvas.nodes.get(node.id) !== node) {
        layer.remove();
        node.nodeEl.classList.remove("canvas-io-node");
        this.nodes.delete(node);
        this.restore(node);
      } else {
        layer.classList.toggle("is-readonly", node.canvas.readonly);
        this.positionPorts(node, layer);
      }
    }
    for (const edge of this.edges) if (!active.has(edge.canvas) || edge.canvas.edges.get(edge.id) !== edge) {
      this.restore(edge);
      this.edges.delete(edge);
    }
    for (const canvas of this.canvases) if (!active.has(canvas)) {
      this.restore(canvas);
      canvas.wrapperEl.classList.remove("canvas-io-active");
      this.canvases.delete(canvas);
    }
    if (this.gesture && (!active.has(this.gesture.canvas) || this.gesture.canvas.readonly || this.gesture.canvas.nodes.get(this.gesture.fixed.node.id) !== this.gesture.fixed.node)) this.cancel();
  }
  mountNode(node) {
    if (!node.nodeEl || node.getData().type === "group" || node.getData().canvasIO?.ports === false) return;
    const existing = this.nodes.get(node);
    if (existing) {
      if (existing.parentElement !== node.nodeEl) node.nodeEl.append(existing);
      node.nodeEl.classList.add("canvas-io-node");
      this.positionPorts(node, existing);
      return;
    }
    const doc = node.nodeEl.ownerDocument;
    const layer = doc.createElement("div");
    layer.className = "canvas-io-ports";
    for (const side of SIDES) for (const kind of KINDS) {
      const button = doc.createElement("button");
      button.className = `canvas-io-port canvas-io-${kind}`;
      button.type = "button";
      button.textContent = kind === "input" ? "I" : "O";
      button.dataset.side = side;
      button.dataset.kind = kind;
      button.setAttribute("aria-label", `${side} ${kind} port`);
      button.title = `${side}: ${kind === "input" ? "Input \u2014 receive a connection" : "Output \u2014 drag to an input"}`;
      const port = { node, side, kind };
      this.ports.set(button, port);
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || node.canvas.readonly) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.gesture) {
          this.finish(port);
        } else this.begin(port);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (this.gesture) this.finish(port);
          else this.begin(port);
        }
      });
      layer.append(button);
    }
    node.nodeEl.classList.add("canvas-io-node");
    node.nodeEl.append(layer);
    this.nodes.set(node, layer);
    this.wrap(node, "onConnectionPointerdown", () => () => {
    });
    this.wrap(node, "render", (original) => () => {
      original.call(node);
      this.mountNode(node);
    });
    this.positionPorts(node, layer);
  }
  positionPorts(node, layer) {
    const box = node.getBBox();
    for (const element of layer.children) {
      const port = this.ports.get(element);
      const point = portPoint(box, port.side, port.kind);
      const button = element;
      button.style.left = `${point.x - box.minX}px`;
      button.style.top = `${point.y - box.minY}px`;
      button.disabled = node.canvas.readonly;
    }
  }
  mountEdge(edge) {
    if (this.edges.has(edge)) return;
    this.edges.add(edge);
    this.wrap(edge, "getCenter", (original) => () => {
      const center = original.call(edge);
      const io = edge.getData().canvasIO;
      const offset = isIO(edge.getData()) ? io?.labelOffset : void 0;
      return offset && Number.isFinite(offset.x) && Number.isFinite(offset.y) ? { x: center.x + offset.x, y: center.y + offset.y } : center;
    });
    const reconnect = (event) => {
      if (!isIO(edge.getData()) || event.button !== 0) return;
      edge.onConnectionPointerdown(event);
    };
    edge.lineEndGroupEl.addEventListener("pointerdown", reconnect);
    this.addRestorer(edge, () => {
      edge.lineEndGroupEl.removeEventListener("pointerdown", reconnect);
      edge.lineEndGroupEl.classList.remove("canvas-io-edge-ends");
      edge.path?.display.classList.remove("canvas-io-edge");
    });
    this.wrap(edge, "updatePath", (original) => () => {
      original.call(edge);
      this.drawEdge(edge);
    });
    this.wrap(edge, "render", (original) => () => {
      original.call(edge);
      this.drawEdge(edge);
    });
    this.wrap(edge, "getBBox", (original) => () => {
      if (!isIO(edge.getData())) return original.call(edge);
      const geometry = this.edgeGeometry(edge);
      const points = [geometry.from, geometry.to, geometry.cp1, geometry.cp2];
      return {
        minX: Math.min(...points.map((p) => p.x)),
        minY: Math.min(...points.map((p) => p.y)),
        maxX: Math.max(...points.map((p) => p.x)),
        maxY: Math.max(...points.map((p) => p.y))
      };
    });
    this.wrap(edge, "onConnectionPointerdown", (original) => (event) => {
      if (!isIO(edge.getData())) return original.call(edge, event);
      event.preventDefault();
      event.stopPropagation();
      if (edge.canvas.readonly) return;
      const point = edge.canvas.posFromClient({ x: event.clientX, y: event.clientY });
      const from = anchorPoint(edge.from.node.getBBox(), edge.from.side, "output");
      const to = anchorPoint(edge.to.node.getBBox(), edge.to.side, "input");
      const movingFrom = Math.hypot(point.x - from.x, point.y - from.y) < Math.hypot(point.x - to.x, point.y - to.y);
      this.begin(movingFrom ? { node: edge.to.node, side: edge.to.side, kind: "input" } : { node: edge.from.node, side: edge.from.side, kind: "output" }, edge);
    });
    if (edge.path) this.drawEdge(edge);
  }
  drawEdge(edge) {
    if (!edge.path || !isIO(edge.getData())) return;
    const geometry = this.edgeGeometry(edge);
    const { from, to } = geometry;
    edge.bezier = geometry;
    edge.center = void 0;
    edge.path.display.setAttribute("d", geometry.path);
    edge.path.interaction.setAttribute("d", geometry.path);
    if (edge.fromLineEnd) edge.fromLineEnd.el.style.transform = `translate(${from.x}px, ${from.y}px) rotate(${ROTATION[edge.from.side]}deg)`;
    if (edge.toLineEnd) edge.toLineEnd.el.style.transform = `translate(${to.x}px, ${to.y}px) rotate(${ROTATION[edge.to.side]}deg)`;
    edge.path.display.classList.add("canvas-io-edge");
    edge.lineEndGroupEl.classList.add("canvas-io-edge-ends");
    edge.labelElement?.render();
  }
  edgeGeometry(edge) {
    return curve(
      anchorPoint(edge.from.node.getBBox(), edge.from.side, "output"),
      edge.from.side,
      anchorPoint(edge.to.node.getBBox(), edge.to.side, "input"),
      edge.to.side
    );
  }
  begin(fixed, edge) {
    this.cancel();
    const canvas = fixed.node.canvas;
    if (canvas.readonly) return;
    const doc = fixed.node.nodeEl.ownerDocument;
    const preview = doc.createElementNS(SVG, "path");
    preview.classList.add("canvas-io-preview");
    canvas.edgeContainerEl.append(preview);
    this.gesture = { canvas, fixed, edge, moving: fixed.kind === "output" ? "input" : "output", preview, doc };
    canvas.wrapperEl.classList.add(`canvas-io-seeking-${this.gesture.moving}`);
    doc.addEventListener("pointermove", this.move, true);
    doc.addEventListener("pointerup", this.release, true);
    doc.addEventListener("pointercancel", this.cancel);
    doc.addEventListener("keydown", this.keydown, true);
    doc.defaultView?.addEventListener("blur", this.cancel);
  }
  portAt(event, canvas = this.gesture?.canvas) {
    if (!canvas) return;
    const doc = canvas.wrapperEl.ownerDocument;
    const element = doc.elementFromPoint(event.clientX, event.clientY)?.closest(".canvas-io-port");
    const direct = element && this.ports.get(element);
    if (direct) return direct;
    for (const node of [...canvas.nodes.values()].reverse()) {
      const layer = this.nodes.get(node);
      if (!layer?.isConnected) continue;
      for (const button of layer.children) {
        const r = button.getBoundingClientRect();
        if (r.width && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return this.ports.get(button);
      }
    }
  }
  move = (event) => {
    const g = this.gesture;
    if (!g) return;
    const fixedPoint = anchorPoint(g.fixed.node.getBBox(), g.fixed.side, g.fixed.kind);
    const target = this.portAt(event);
    const point = target && target.kind === g.moving ? anchorPoint(target.node.getBBox(), target.side, target.kind) : g.canvas.posFromClient({ x: event.clientX, y: event.clientY });
    const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" };
    const side = target?.side ?? opposite[g.fixed.side];
    const path = g.fixed.kind === "output" ? curve(fixedPoint, g.fixed.side, point, side) : curve(point, side, fixedPoint, g.fixed.side);
    g.preview.setAttribute("d", path.path);
  };
  release = (event) => {
    const target = this.portAt(event);
    if (target && target !== this.gesture?.fixed) {
      event.stopPropagation();
      this.finish(target);
    } else if (!target) this.cancel();
  };
  keydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }
  };
  finish(target) {
    const g = this.gesture;
    if (!g) return;
    if (target.kind !== g.moving || target.node.canvas !== g.canvas || g.canvas.readonly) {
      this.cancel();
      return;
    }
    if (g.canvas.nodes.get(target.node.id) !== target.node || g.canvas.nodes.get(g.fixed.node.id) !== g.fixed.node) {
      this.cancel();
      return;
    }
    const from = g.fixed.kind === "output" ? g.fixed : target;
    const to = g.fixed.kind === "input" ? g.fixed : target;
    const canvas = g.canvas;
    const data = connectionData(
      g.edge?.id ?? crypto.randomUUID().replaceAll("-", "").slice(0, 16),
      from.node.id,
      from.side,
      to.node.id,
      to.side
    );
    if (g.edge) g.edge.setData({ ...g.edge.getData(), ...data });
    else canvas.importData({ nodes: [], edges: [data] }, false);
    this.scan();
    const saved = canvas.edges.get(data.id);
    saved?.render();
    canvas.pushHistory(canvas.getData());
    canvas.view.requestSave();
    this.cancel();
    if (!saved) new import_obsidian.Notice("Canvas IO could not create the connection. This Obsidian version may be incompatible.");
  }
  cancel = () => {
    const g = this.gesture;
    if (!g) return;
    g.preview.remove();
    g.canvas.wrapperEl.classList.remove("canvas-io-seeking-input", "canvas-io-seeking-output");
    g.doc.removeEventListener("pointermove", this.move, true);
    g.doc.removeEventListener("pointerup", this.release, true);
    g.doc.removeEventListener("pointercancel", this.cancel);
    g.doc.removeEventListener("keydown", this.keydown, true);
    g.doc.defaultView?.removeEventListener("blur", this.cancel);
    this.gesture = void 0;
  };
};
