// Final, deterministic I/O pass. Changes attachments/label offsets, never cards or meaning.
import {anchorPoint,curve,isIO,SIDES,NORMAL} from '../../../../vendor/canvas-io/geometry.mjs';
import {cardAnchor,isIOCard} from '../../../../vendor/canvas-io/cards.mjs';

const inside=(p,b,pad=0)=>p.x>b.x-pad&&p.x<b.x+b.width+pad&&p.y>b.y-pad&&p.y<b.y+b.height+pad;
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const cross=(a,b,c,d)=>{
  const v=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return v(a,b,c)*v(a,b,d)<0&&v(c,d,a)*v(c,d,b)<0;
};
const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
const bbox=n=>({minX:n.x,minY:n.y,maxX:n.x+n.width,maxY:n.y+n.height});
const rect=p=>({x:Math.min(...p.map(q=>q.x)),y:Math.min(...p.map(q=>q.y)),width:Math.max(...p.map(q=>q.x))-Math.min(...p.map(q=>q.x))+1,height:Math.max(...p.map(q=>q.y))-Math.min(...p.map(q=>q.y))+1});
const at=(g,t)=>{const u=1-t;return{x:u*u*u*g.from.x+3*u*u*t*g.cp1.x+3*u*t*t*g.cp2.x+t*t*t*g.to.x,y:u*u*u*g.from.y+3*u*u*t*g.cp1.y+3*u*t*t*g.cp2.y+t*t*t*g.to.y};};
const facing=(a,b)=>{const p=center(a),q=center(b);return Math.abs(q.x-p.x)>Math.abs(q.y-p.y)?(q.x>p.x?['right','left']:['left','right']):(q.y>p.y?['bottom','top']:['top','bottom']);};

export function refineIO(input,plan={}) {
  const canvas=structuredClone(input), nodes=new Map(canvas.nodes.map(n=>[n.id,n]));
  const edges=canvas.edges.filter(e=>isIO(e)&&!String(e.id).startsWith('legend-'));
  const cards=canvas.nodes.filter(n=>n.type!=='group'&&!String(n.id).startsWith('legend-'));
  const pins=new Map();
  if(plan.attachments&&(typeof plan.attachments!=='object'||Array.isArray(plan.attachments)))throw new Error('layout.attachments must be an object keyed by edge ID');
  for(const [id,pin] of Object.entries(plan.attachments??{})) {
    const edge=canvas.edges.find(e=>e.id===id);
    if(!edge)throw new Error(`layout.attachments: unknown edge ${id}`);
    if(!SIDES.includes(pin.fromSide)||!SIDES.includes(pin.toSide))throw new Error(`layout.attachments: invalid sides for ${id}`);
    if(pin.labelOffset&&(!Number.isFinite(pin.labelOffset.x)||!Number.isFinite(pin.labelOffset.y)))throw new Error(`layout.attachments: invalid label offset for ${id}`);
    if(!isIO(edge))throw new Error(`layout.attachments: ${id} is not an I/O edge`);
    pins.set(id,pin);
  }
  // Spines and immediate supports take precedence over cosmetic side search.
  const localPairs=[...(plan.spines??[]).flatMap(s=>s.slice(1).map((b,i)=>[s[i],b])),...(plan.supports??[]).map(s=>[s.anchor,s.node])];
  for(const [a,b] of localPairs)for(const edge of edges)if(!pins.has(edge.id)&&
    ((edge.fromNode===a&&edge.toNode===b)||(edge.fromNode===b&&edge.toNode===a))) {
    const from=nodes.get(edge.fromNode),to=nodes.get(edge.toNode);
    if(from&&to){const [fromSide,toSide]=facing(from,to);pins.set(edge.id,{fromSide,toSide});}
  }
  for(const edge of edges){
    if(!nodes.has(edge.fromNode)||!nodes.has(edge.toNode))throw new Error(`I/O edge ${edge.id} has a missing endpoint`);
    if(pins.has(edge.id)){const pin=pins.get(edge.id);edge.fromSide=pin.fromSide;edge.toSide=pin.toSide;if(pin.labelOffset)edge.canvasIO.labelOffset={...pin.labelOffset};}
    edge.fromSide??='right';edge.toSide??='left';
  }
  function geometry(edge) {
    const source=nodes.get(edge.fromNode),target=nodes.get(edge.toNode);
    const g=curve(cardAnchor(bbox(source),edge.fromSide,'output',isIOCard(source,true)),edge.fromSide,
      cardAnchor(bbox(target),edge.toSide,'input',isIOCard(target,true)),edge.toSide);
    const points=Array.from({length:49},(_,i)=>at(g,i/48));
    return{g,points,bounds:rect(points),length:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0)};
  }
  const paths=new Map(edges.map(e=>[e.id,geometry(e)]));
  function label(edge,path) {
    if(!edge.label)return null;
    const saved=edge.canvasIO.labelOffset;
    const off=Number.isFinite(saved?.x)&&Number.isFinite(saved?.y)?saved:{x:0,y:0};
    const p=at(path.g,.5);
    const width=(String(edge.label).length*10.1+8)/Math.sqrt(.6),height=38;
    return{x:p.x+off.x-width/2,y:p.y+off.y-height/2,width,height};
  }
  const shared=(a,b)=>[a.fromNode,a.toNode].filter(id=>id===b.fromNode||id===b.toNode);
  const pair=(a,b)=>a.fromNode===b.toNode&&a.toNode===b.fromNode;
  function intersections(edge,path,other,otherPath) {
    if(!overlaps(path.bounds,otherPath.bounds))return{overlap:false,crossing:false};
    const common=shared(edge,other).map(id=>nodes.get(id));
    const near=p=>common.some(n=>inside(p,n,45));
    let crossing=false,close=0;
    for(let i=1;i<path.points.length;i++){
      const p=path.points[i],previous=path.points[i-1];
      for(let j=1;j<otherPath.points.length;j++){
        const q=otherPath.points[j],prior=otherPath.points[j-1];
        if(!near(p)&&cross(previous,p,prior,q))crossing=true;
        if(!near(p)&&Math.hypot(p.x-q.x,p.y-q.y)<7){
          const a={x:p.x-previous.x,y:p.y-previous.y},b={x:q.x-prior.x,y:q.y-prior.y};
          if(Math.abs(a.x*b.x+a.y*b.y)>.94*Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)){
            close+=Math.hypot(a.x,a.y);break;
          }
        }
      }
    }
    return{crossing,overlap:close>=24};
  }
  function labelCost(edge,path,area) {
    if(!area)return 0;
    let score=0;
    for(const node of cards)if(overlaps(area,node))score+=100000;
    for(const other of edges)if(other!==edge){
      const otherPath=paths.get(other.id),otherLabel=label(other,otherPath);
      if(otherLabel&&overlaps(area,otherLabel))score+=100000;
      if(otherPath.points.some(p=>inside(p,area)))score+=100000;
    }
    return score;
  }
  function cost(edge,path) {
    let score=path.length*.02;
    for(const node of cards)if(path.points.some(p=>inside(p,node,-2)))score+=10000000;
    for(const other of edges)if(other!==edge){
      const otherPath=paths.get(other.id),hit=intersections(edge,path,other,otherPath);
      if(hit.overlap)score+=1000000;
      if(hit.crossing)score+=pair(edge,other)?100:shared(edge,other).length?300:1500;
      const area=label(other,otherPath);
      if(area&&path.points.some(p=>inside(p,area)))score+=100000;
    }
    score+=labelCost(edge,path,label(edge,path));
    const a=center(nodes.get(edge.fromNode)),b=center(nodes.get(edge.toNode));
    if(NORMAL[edge.fromSide].x*(b.x-a.x)+NORMAL[edge.fromSide].y*(b.y-a.y)<0)score+=10000;
    if(NORMAL[edge.toSide].x*(a.x-b.x)+NORMAL[edge.toSide].y*(a.y-b.y)<0)score+=10000;
    const natural=facing(nodes.get(edge.fromNode),nodes.get(edge.toNode));
    if(edge.fromSide!==natural[0])score+=150;if(edge.toSide!==natural[1])score+=150;
    return score;
  }
  // Bounded coordinate descent: fixed cards, all sixteen side pairs, two passes.
  for(let pass=0;pass<2;pass++)for(const edge of edges){
    if(pins.has(edge.id))continue;
    let best={score:cost(edge,paths.get(edge.id)),from:edge.fromSide,to:edge.toSide,path:paths.get(edge.id)};
    for(const from of SIDES)for(const to of SIDES){edge.fromSide=from;edge.toSide=to;const path=geometry(edge),score=cost(edge,path);
      if(score<best.score-1e-6)best={score,from,to,path};}
    edge.fromSide=best.from;edge.toSide=best.to;paths.set(edge.id,best.path);
  }
  for(let pass=0;pass<2;pass++)for(const edge of edges){
    if(!edge.label||pins.get(edge.id)?.labelOffset)continue;
    const path=paths.get(edge.id),base=at(path.g,.5),original=edge.canvasIO.labelOffset;
    const candidates=[original??{x:0,y:0},{x:0,y:0}];
    const width=label(edge,path).width;
    for(const d of [30,55,85,120])candidates.push({x:0,y:d},{x:0,y:-d},{x:width/2+18,y:d/2},{x:-width/2-18,y:-d/2});
    for(const t of [.3,.7]){const p=at(path.g,t);candidates.push({x:p.x-base.x,y:p.y-base.y+35},{x:p.x-base.x,y:p.y-base.y-35});}
    let best={score:Infinity,offset:original};
    for(const offset of candidates){edge.canvasIO.labelOffset=offset;const score=labelCost(edge,path,label(edge,path))+Math.hypot(offset.x,offset.y)*.1;
      if(score<best.score-1e-6)best={score,offset};}
    if(best.offset.x===0&&best.offset.y===0)delete edge.canvasIO.labelOffset;
    else edge.canvasIO.labelOffset={x:Math.round(best.offset.x*100)/100,y:Math.round(best.offset.y*100)/100};
  }
  const report={edges:edges.length,throughCards:[],overlaps:[],crossings:[],labelConflicts:[]};
  for(const edge of edges){const path=paths.get(edge.id);
    for(const node of cards)if(path.points.some(p=>inside(p,node,-2)))report.throughCards.push({edge:edge.id,node:node.id});
    if(labelCost(edge,path,label(edge,path)))report.labelConflicts.push(edge.id);
  }
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const a=edges[i],b=edges[j],hit=intersections(a,paths.get(a.id),b,paths.get(b.id));
    if(hit.overlap)report.overlaps.push([a.id,b.id]);
    if(hit.crossing)report.crossings.push({edges:[a.id,b.id],kind:pair(a,b)?'return-pair':shared(a,b).length?'shared-node':'unrelated'});
  }
  return{canvas,report};
}
