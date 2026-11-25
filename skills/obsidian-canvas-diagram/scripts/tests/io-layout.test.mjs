import test from 'node:test';
import assert from 'node:assert/strict';
import {refineIO} from '../lib/io-layout.mjs';
import {parseNote} from '../lib/notes.mjs';
import {reviewEvidenceProblems} from '../lib/render-quality.mjs';
const node=(id,x,y,width=320,height=200)=>({id,type:'file',file:`nodes/${id}.md`,x,y,width,height,color:'5'});
const edge=(id,fromNode,toNode,fromSide,toSide,label)=>({id,fromNode,toNode,fromSide,toSide,label,canvasIO:{version:1,fromPort:'output',toPort:'input'}});

test('routing corrects outward curls without putting the edge through a supporting helper',()=>{
  const original={nodes:[node('routes',0,430),node('aspects',550,430),node('inventory',1100,0)],edges:[edge('read','inventory','routes','right','left','inventory matches')]};
  const {canvas,report}=refineIO(original);
  assert.deepEqual(canvas.nodes,original.nodes);
  assert.deepEqual(report.throughCards,[]);
  assert.deepEqual(report.labelConflicts,[]);
  assert.notEqual(canvas.edges[0].fromSide,'right');
  assert.notEqual(canvas.edges[0].toSide,'left');
  const {canvas:again}=refineIO(original);assert.deepEqual(canvas,again,'same input gives deterministic output');
  for(const key of ['id','fromNode','toNode','color','label'])assert.deepEqual(canvas.edges[0][key],original.edges[0][key]);
});

test('vertical request/response lanes have separate readable labels without moving cards',()=>{
  const original={nodes:[node('client',0,0),node('routes',0,500)],edges:[edge('request','client','routes','bottom','top','pawn HTTP'),edge('response','routes','client','top','bottom','HTTP response')]};
  const {canvas,report}=refineIO(original,{spines:[['client','routes']]});
  assert.deepEqual(report.labelConflicts,[]);assert.deepEqual(report.overlaps,[]);
  assert.deepEqual(report.throughCards,[]);assert.deepEqual(canvas.nodes,original.nodes);
  assert.ok(canvas.edges.some(e=>e.canvasIO.labelOffset));
  assert.equal(canvas.edges[0].fromSide,'bottom');assert.equal(canvas.edges[1].fromSide,'top');
});

test('explicit attachments and label offsets survive refinement; invalid pins fail before writes',()=>{
  const original={nodes:[node('a',0,0),node('b',600,0)],edges:[edge('ab','a','b','right','left','questions')]};
  const pin={fromSide:'right',toSide:'left',labelOffset:{x:0,y:65}};
  const {canvas}=refineIO(original,{attachments:{ab:pin}});
  assert.equal(canvas.edges[0].fromSide,pin.fromSide);assert.equal(canvas.edges[0].toSide,pin.toSide);
  assert.deepEqual(canvas.edges[0].canvasIO.labelOffset,pin.labelOffset);
  assert.throws(()=>refineIO(original,{attachments:{missing:pin}}),/unknown edge/);
  assert.throws(()=>refineIO(original,{attachments:{ab:{fromSide:'unknown',toSide:'left'}}}),/invalid sides/);
  assert.throws(()=>refineIO(original,{attachments:[]}),/must be an object/);
});

test('shared stores, unwired helpers and ordinary edges preserve identity and styles',()=>{
  const original={nodes:[node('service',0,0),node('database',550,0),node('transfer',550,600)],edges:[
    {...edge('timer','service','database','right','left','hold / forfeit'),styleAttributes:{path:'dotted'}},
    {...edge('write','transfer','database','top','bottom','record move'),color:'5'},
    {id:'ordinary',fromNode:'service',toNode:'transfer',fromSide:'bottom',toSide:'left'}]};
  const {canvas}=refineIO(original,{supports:[{node:'database',anchor:'service',side:'right'}]});
  assert.deepEqual(canvas.nodes,original.nodes);assert.equal(canvas.edges.length,3);
  assert.deepEqual(canvas.edges[2],original.edges[2]);assert.deepEqual(canvas.edges[0].styleAttributes,{path:'dotted'});
  assert.equal(canvas.edges.filter(e=>e.toNode==='transfer').length,1,'no live caller is invented');
  assert.equal(canvas.nodes.filter(n=>n.file==='nodes/database.md').length,1);
});

test('frontmatter uses YAML semantics and preserves the opening explanation',()=>{
  const text='---\nid: sample\ntitle: "Routes: pawn operations"\ntype: "component"\nstatus: exists\nsource: "Server/routes.js"\n---\n\nThis receives requests.\n\n## Responsibilities\nRoutes requests.';
  const result=parseNote(text);assert.deepEqual(result.errors,[]);
  assert.equal(result.fm.title,'Routes: pawn operations');assert.equal(result.fm.type,'component');
  assert.ok(result.body.startsWith('This receives requests.'));
  assert.ok(parseNote(text.replace('"Routes: pawn operations"','Routes: pawn operations')).errors.length);
});

test('whole-diagram review cannot stand in for current readable closeups',()=>{
  const job={reviewVersion:3,review:{at:'2026-11-25T12:05:00Z'}};
  assert.equal(reviewEvidenceProblems(job,'current',5)[0].id,'closeup-review');
  job.closeups={count:7,hash:'stale',at:'2026-11-25T12:04:00Z'};
  assert.equal(reviewEvidenceProblems(job,'current',5).length,1);
  job.closeups.hash='current';assert.deepEqual(reviewEvidenceProblems(job,'current',5),[]);
  job.review.at='2026-11-25T12:03:00Z';assert.equal(reviewEvidenceProblems(job,'current',5).length,1);
  assert.deepEqual(reviewEvidenceProblems({reviewVersion:2},'current',5),[],'legacy jobs remain readable');
  assert.deepEqual(reviewEvidenceProblems({},'current',5),[],'pre-versioned jobs remain readable');
});
