import { Notice, Plugin } from 'obsidian';
import type { Canvas, Edge, Node } from './canvas';
import { anchorPoint, connectionData, curve, isIO, KINDS, portPoint, SIDES } from './geometry';
import type { Kind, Point, Side } from './geometry';

type Port = { node: Node; side: Side; kind: Kind };
type Gesture = { canvas: Canvas; fixed: Port; edge?: Edge; moving: Kind; preview: SVGPathElement; doc: Document };
const SVG = 'http://www.w3.org/2000/svg';
// Native arrow polygons point up before rotation; the tip points into a card.
const ROTATION: Record<Side, number> = { top: 180, right: 270, bottom: 0, left: 90 };

export default class CanvasIO extends Plugin {
  private canvases = new Set<Canvas>();
  private nodes = new Map<Node, HTMLElement>();
  private edges = new Set<Edge>();
  private ports = new WeakMap<Element, Port>();
  private restorers = new Map<object, (() => void)[]>();
  private gesture?: Gesture;

  onload() {
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scan()));
    this.app.workspace.onLayoutReady(() => this.scan());
    this.registerInterval(window.setInterval(() => this.scan(), 250));
    this.addCommand({ id: 'cancel-connection', name: 'Cancel port connection', callback: () => this.cancel() });
  }

  onunload() {
    this.cancel();
    for (const object of [...this.restorers.keys()]) this.restore(object);
    for (const [node, layer] of this.nodes) { layer.remove(); node.nodeEl.classList.remove('canvas-io-node'); }
    for (const canvas of this.canvases) canvas.wrapperEl.classList.remove('canvas-io-active');
    // Restore native geometry immediately when disabling the plugin.
    for (const edge of this.edges) if (edge.canvas.edges.get(edge.id) === edge) edge.render();
  }

  private wrap<T extends object, K extends keyof T>(object: T, key: K, make: (original: T[K]) => T[K]) {
    const own = Object.getOwnPropertyDescriptor(object, key);
    const original = object[key];
    const wrapped = make(original);
    object[key] = wrapped;
    this.addRestorer(object, () => {
      if (object[key] !== wrapped) return;
      if (own) Object.defineProperty(object, key, own); else delete object[key];
    });
  }

  private addRestorer(object: object, restore: () => void) {
    const list = this.restorers.get(object) ?? [];
    list.push(restore); this.restorers.set(object, list);
  }

  private restore(object: object) {
    for (const restore of (this.restorers.get(object) ?? []).reverse()) restore();
    this.restorers.delete(object);
  }

  private scan() {
    const active = new Set(this.app.workspace.getLeavesOfType('canvas')
      .map(leaf => (leaf.view as unknown as { canvas?: Canvas }).canvas).filter((c): c is Canvas => !!c));
    for (const canvas of active) {
      if (!canvas.nodes || !canvas.edges || !canvas.edgeContainerEl || !canvas.posFromClient) continue;
      if (!this.canvases.has(canvas)) {
        this.canvases.add(canvas);
        canvas.wrapperEl.classList.add('canvas-io-active');
        const capture = (event: PointerEvent) => {
          if (event.button !== 0 || canvas.readonly) return;
          const port = this.portAt(event, canvas);
          if (!port) return;
          event.preventDefault(); event.stopPropagation();
          if (this.gesture) this.finish(port); else this.begin(port);
        };
        canvas.wrapperEl.addEventListener('pointerdown', capture, true);
        this.addRestorer(canvas, () => canvas.wrapperEl.removeEventListener('pointerdown', capture, true));
        this.wrap(canvas, 'addNode', original => (node) => { original.call(canvas, node); this.mountNode(node); });
        this.wrap(canvas, 'addEdge', original => (edge) => { original.call(canvas, edge); this.mountEdge(edge); });
      }
      for (const node of canvas.nodes.values()) this.mountNode(node);
      for (const edge of canvas.edges.values()) this.mountEdge(edge);
    }
    for (const [node, layer] of this.nodes) {
      if (!active.has(node.canvas) || node.canvas.nodes.get(node.id) !== node) {
        layer.remove(); node.nodeEl.classList.remove('canvas-io-node'); this.nodes.delete(node); this.restore(node);
      } else {
        layer.classList.toggle('is-readonly', node.canvas.readonly);
        this.positionPorts(node, layer);
      }
    }
    for (const edge of this.edges) if (!active.has(edge.canvas) || edge.canvas.edges.get(edge.id) !== edge) {
      this.restore(edge); this.edges.delete(edge);
    }
    for (const canvas of this.canvases) if (!active.has(canvas)) {
      this.restore(canvas); canvas.wrapperEl.classList.remove('canvas-io-active'); this.canvases.delete(canvas);
    }
    if (this.gesture && (!active.has(this.gesture.canvas) || this.gesture.canvas.readonly ||
      this.gesture.canvas.nodes.get(this.gesture.fixed.node.id) !== this.gesture.fixed.node)) this.cancel();
  }

  private mountNode(node: Node) {
    if (!node.nodeEl || node.getData().type === 'group' || node.getData().canvasIO?.ports === false) return;
    const existing = this.nodes.get(node);
    if (existing) {
      if (existing.parentElement !== node.nodeEl) node.nodeEl.append(existing);
      node.nodeEl.classList.add('canvas-io-node');
      this.positionPorts(node, existing);
      return;
    }
    const doc = node.nodeEl.ownerDocument;
    const layer = doc.createElement('div');
    layer.className = 'canvas-io-ports';
    for (const side of SIDES) for (const kind of KINDS) {
      const button = doc.createElement('button');
      button.className = `canvas-io-port canvas-io-${kind}`;
      button.type = 'button'; button.textContent = kind === 'input' ? 'I' : 'O';
      button.dataset.side = side; button.dataset.kind = kind;
      button.setAttribute('aria-label', `${side} ${kind} port`);
      button.title = `${side}: ${kind === 'input' ? 'Input — receive a connection' : 'Output — drag to an input'}`;
      const port = { node, side, kind };
      this.ports.set(button, port);
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0 || node.canvas.readonly) return;
        event.preventDefault(); event.stopPropagation();
        if (this.gesture) {
          this.finish(port);
        } else this.begin(port);
      });
      button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation();
          if (this.gesture) this.finish(port); else this.begin(port);
        }
      });
      layer.append(button);
    }
    node.nodeEl.classList.add('canvas-io-node'); node.nodeEl.append(layer);
    this.nodes.set(node, layer);
    // CSS hides the native hover handle; also block its drag entry point so
    // Canvas cannot create a competing side-center edge through that handle.
    this.wrap(node, 'onConnectionPointerdown', () => () => {});
    this.wrap(node, 'render', original => () => { original.call(node); this.mountNode(node); });
    this.positionPorts(node, layer);
  }

  private positionPorts(node: Node, layer: HTMLElement) {
    const box = node.getBBox();
    for (const element of layer.children) {
      const port = this.ports.get(element)!;
      const point = portPoint(box, port.side, port.kind);
      const button = element as HTMLButtonElement;
      button.style.left = `${point.x - box.minX}px`; button.style.top = `${point.y - box.minY}px`;
      button.disabled = node.canvas.readonly;
    }
  }

  private mountEdge(edge: Edge) {
    if (this.edges.has(edge)) return;
    this.edges.add(edge);
    this.wrap(edge, 'getCenter', original => () => {
      const center = original.call(edge);
      const io = edge.getData().canvasIO as { labelOffset?: Point } | undefined;
      const offset = isIO(edge.getData()) ? io?.labelOffset : undefined;
      return offset && Number.isFinite(offset.x) && Number.isFinite(offset.y) ?
        { x: center.x + offset.x, y: center.y + offset.y } : center;
    });
    const reconnect = (event: PointerEvent) => {
      if (!isIO(edge.getData()) || event.button !== 0) return;
      edge.onConnectionPointerdown(event);
    };
    edge.lineEndGroupEl.addEventListener('pointerdown', reconnect);
    this.addRestorer(edge, () => {
      edge.lineEndGroupEl.removeEventListener('pointerdown', reconnect);
      edge.lineEndGroupEl.classList.remove('canvas-io-edge-ends');
      edge.path?.display.classList.remove('canvas-io-edge');
    });
    this.wrap(edge, 'updatePath', original => () => { original.call(edge); this.drawEdge(edge); });
    // Advanced Canvas can restyle a path after updatePath. Run last on render too.
    this.wrap(edge, 'render', original => () => { original.call(edge); this.drawEdge(edge); });
    this.wrap(edge, 'getBBox', original => () => {
      if (!isIO(edge.getData())) return original.call(edge);
      const geometry = this.edgeGeometry(edge);
      const points = [geometry.from, geometry.to, geometry.cp1, geometry.cp2];
      return { minX: Math.min(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)),
        maxX: Math.max(...points.map(p => p.x)), maxY: Math.max(...points.map(p => p.y)) };
    });
    this.wrap(edge, 'onConnectionPointerdown', original => event => {
      if (!isIO(edge.getData())) return original.call(edge, event);
      event.preventDefault(); event.stopPropagation();
      if (edge.canvas.readonly) return;
      const point = edge.canvas.posFromClient({ x: event.clientX, y: event.clientY });
      const from = anchorPoint(edge.from.node.getBBox(), edge.from.side, 'output');
      const to = anchorPoint(edge.to.node.getBBox(), edge.to.side, 'input');
      const movingFrom = Math.hypot(point.x - from.x, point.y - from.y) < Math.hypot(point.x - to.x, point.y - to.y);
      this.begin(movingFrom ? { node: edge.to.node, side: edge.to.side, kind: 'input' } :
        { node: edge.from.node, side: edge.from.side, kind: 'output' }, edge);
    });
    if (edge.path) this.drawEdge(edge);
  }

  private drawEdge(edge: Edge) {
    if (!edge.path || !isIO(edge.getData())) return;
    const geometry = this.edgeGeometry(edge);
    const { from, to } = geometry;
    edge.bezier = geometry;
    edge.center = undefined;
    edge.path.display.setAttribute('d', geometry.path);
    edge.path.interaction.setAttribute('d', geometry.path);
    if (edge.fromLineEnd) edge.fromLineEnd.el.style.transform = `translate(${from.x}px, ${from.y}px) rotate(${ROTATION[edge.from.side]}deg)`;
    if (edge.toLineEnd) edge.toLineEnd.el.style.transform = `translate(${to.x}px, ${to.y}px) rotate(${ROTATION[edge.to.side]}deg)`;
    edge.path.display.classList.add('canvas-io-edge');
    edge.lineEndGroupEl.classList.add('canvas-io-edge-ends');
    // Native render initially positions labels using side-center geometry.
    // Reposition after applying our port geometry and any saved label offset.
    edge.labelElement?.render();
  }

  private edgeGeometry(edge: Edge) {
    return curve(anchorPoint(edge.from.node.getBBox(), edge.from.side, 'output'), edge.from.side,
      anchorPoint(edge.to.node.getBBox(), edge.to.side, 'input'), edge.to.side);
  }

  private begin(fixed: Port, edge?: Edge) {
    this.cancel();
    const canvas = fixed.node.canvas;
    if (canvas.readonly) return;
    const doc = fixed.node.nodeEl.ownerDocument;
    const preview = doc.createElementNS(SVG, 'path');
    preview.classList.add('canvas-io-preview');
    canvas.edgeContainerEl.append(preview);
    this.gesture = { canvas, fixed, edge, moving: fixed.kind === 'output' ? 'input' : 'output', preview, doc };
    canvas.wrapperEl.classList.add(`canvas-io-seeking-${this.gesture.moving}`);
    doc.addEventListener('pointermove', this.move, true);
    doc.addEventListener('pointerup', this.release, true);
    doc.addEventListener('pointercancel', this.cancel);
    doc.addEventListener('keydown', this.keydown, true);
    doc.defaultView?.addEventListener('blur', this.cancel);
  }

  private portAt(event: PointerEvent, canvas = this.gesture?.canvas): Port | undefined {
    if (!canvas) return;
    const doc = canvas.wrapperEl.ownerDocument;
    const element = doc.elementFromPoint(event.clientX, event.clientY)?.closest('.canvas-io-port');
    const direct = element && this.ports.get(element);
    if (direct) return direct;
    // Native selection/resize handles sit in a layer above cards. Resolve the
    // visible port geometrically there, before that layer starts resizing.
    for (const node of [...canvas.nodes.values()].reverse()) {
      const layer = this.nodes.get(node);
      if (!layer?.isConnected) continue;
      for (const button of layer.children) {
        const r = button.getBoundingClientRect();
        if (r.width && event.clientX >= r.left && event.clientX <= r.right &&
          event.clientY >= r.top && event.clientY <= r.bottom) return this.ports.get(button);
      }
    }
  }

  private move = (event: PointerEvent) => {
    const g = this.gesture;
    if (!g) return;
    const fixedPoint = anchorPoint(g.fixed.node.getBBox(), g.fixed.side, g.fixed.kind);
    const target = this.portAt(event);
    const point = target && target.kind === g.moving ? anchorPoint(target.node.getBBox(), target.side, target.kind) :
      g.canvas.posFromClient({ x: event.clientX, y: event.clientY });
    const opposite: Record<Side, Side> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };
    const side = target?.side ?? opposite[g.fixed.side];
    const path = g.fixed.kind === 'output' ? curve(fixedPoint, g.fixed.side, point, side) : curve(point, side, fixedPoint, g.fixed.side);
    g.preview.setAttribute('d', path.path);
  };

  private release = (event: PointerEvent) => {
    const target = this.portAt(event);
    if (target && target !== this.gesture?.fixed) { event.stopPropagation(); this.finish(target); }
    // A click on the starting port keeps the gesture active for click-to-connect.
    else if (!target) this.cancel();
  };

  private keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.cancel(); }
  };

  private finish(target: Port) {
    const g = this.gesture;
    if (!g) return;
    if (target.kind !== g.moving || target.node.canvas !== g.canvas || g.canvas.readonly) { this.cancel(); return; }
    if (g.canvas.nodes.get(target.node.id) !== target.node || g.canvas.nodes.get(g.fixed.node.id) !== g.fixed.node) { this.cancel(); return; }
    const from = g.fixed.kind === 'output' ? g.fixed : target;
    const to = g.fixed.kind === 'input' ? g.fixed : target;
    const canvas = g.canvas;
    const data = connectionData(g.edge?.id ?? crypto.randomUUID().replaceAll('-', '').slice(0, 16),
      from.node.id, from.side, to.node.id, to.side);
    if (g.edge) g.edge.setData({ ...g.edge.getData(), ...data });
    else canvas.importData({ nodes: [], edges: [data] }, false);
    this.scan();
    const saved = canvas.edges.get(data.id);
    saved?.render();
    canvas.pushHistory(canvas.getData());
    canvas.view.requestSave();
    this.cancel();
    if (!saved) new Notice('Canvas IO could not create the connection. This Obsidian version may be incompatible.');
  }

  private cancel = () => {
    const g = this.gesture;
    if (!g) return;
    g.preview.remove();
    g.canvas.wrapperEl.classList.remove('canvas-io-seeking-input', 'canvas-io-seeking-output');
    g.doc.removeEventListener('pointermove', this.move, true);
    g.doc.removeEventListener('pointerup', this.release, true);
    g.doc.removeEventListener('pointercancel', this.cancel);
    g.doc.removeEventListener('keydown', this.keydown, true);
    g.doc.defaultView?.removeEventListener('blur', this.cancel);
    this.gesture = undefined;
  };
}
