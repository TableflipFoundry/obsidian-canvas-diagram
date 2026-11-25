import type { Box, Point, Side } from './geometry';
// Native Canvas has no public port API. Keep its private surface isolated here.
export interface EdgeData {
  id: string; fromNode: string; toNode: string; fromSide: Side; toSide: Side;
  fromEnd?: string; toEnd?: string; canvasIO?: unknown; [key: string]: unknown;
}
export interface Node {
  id: string; canvas: Canvas; nodeEl: HTMLElement;
  getBBox(): Box; getData(): { type: string; canvasIO?: { ports?: boolean } };
  render(): void;
  onConnectionPointerdown(event: PointerEvent, side: Side): void;
}
export interface Edge {
  id: string; canvas: Canvas;
  from: { node: Node; side: Side; end: string };
  to: { node: Node; side: Side; end: string };
  path: { display: SVGElement; interaction: SVGElement };
  lineEndGroupEl: SVGGElement;
  fromLineEnd?: { el: SVGElement }; toLineEnd?: { el: SVGElement };
  bezier: ReturnType<typeof import('./geometry').curve>;
  center?: Point;
  labelElement?: { render(): void };
  getData(): EdgeData; setData(data: EdgeData): void;
  getBBox(): Box;
  render(): void; updatePath(): void; getCenter(): Point;
  onConnectionPointerdown(event: PointerEvent): void;
}
export interface Canvas {
  readonly: boolean; nodes: Map<string, Node>; edges: Map<string, Edge>;
  wrapperEl: HTMLElement; edgeContainerEl: SVGElement;
  view: { requestSave(): void };
  getData(): { nodes: unknown[]; edges: EdgeData[] };
  importData(data: { nodes: unknown[]; edges: EdgeData[] }, clear?: boolean): void;
  pushHistory(data: unknown): void;
  addNode(node: Node): void; addEdge(edge: Edge): void;
  posFromClient(pos: Point): Point;
}
