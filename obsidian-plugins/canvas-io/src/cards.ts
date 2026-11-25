import type {Box,Kind,Point,Side} from './geometry';
import {anchorPoint} from './geometry.ts';

export interface CardData {
  id?: string; type: string; file?: string;
  canvasIO?: { ports?: boolean; [key:string]: unknown };
  [key:string]: unknown;
}

export function isIOCard(data:CardData,legacyIOConnection=false):boolean {
  if(data.type==='group'||String(data.id??'').startsWith('legend-'))return false;
  if(typeof data.canvasIO?.ports==='boolean')return data.canvasIO.ports;
  return data.type==='file'&&/\.md$/i.test(data.file??'')||legacyIOConnection;
}

export function cardAnchor(box:Box,side:Side,kind:Kind,io:boolean):Point {
  if(io)return anchorPoint(box,side,kind);
  return {x:side==='left'?box.minX:side==='right'?box.maxX:(box.minX+box.maxX)/2,
    y:side==='top'?box.minY:side==='bottom'?box.maxY:(box.minY+box.maxY)/2};
}
