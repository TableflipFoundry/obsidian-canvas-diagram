import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FACETS,validateAudit,relationshipHash,relationshipAuditProblems} from '../lib/relationship-audit.mjs';
import {runChecks} from '../check.mjs';

const scripts=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(script,...args)=>spawnSync(process.execPath,[path.join(scripts,script),...args],{encoding:'utf8'});
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'diagram-audit-test-'));
  t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('diagram-audit-test-'));fs.rmSync(root,{recursive:true,force:true});});
  const vault=path.join(root,'Diagrams');
  for(const dir of ['.obsidian','nodes','titles'])fs.mkdirSync(path.join(vault,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'titles.js'),'export async function load() {\n  return await api.list();\n}\n');
  const evidence=[{file:'titles.js',line:2,text:'  return await api.list();'}];
  const canvas={nodes:['page','hook','client'].map(id=>({id,type:'file',file:`nodes/${id}.md`,x:0,y:0,width:320,height:200})),edges:[
    {id:'page-hook',fromNode:'page',toNode:'hook'},
    {id:'hook-client',fromNode:'hook',toNode:'client'},
    {id:'client-hook',fromNode:'client',toNode:'hook',color:'5'},
    {id:'hook-page',fromNode:'hook',toNode:'page',color:'5'},
  ]};
  const relationships=canvas.edges.map(e=>({id:e.id,from:e.fromNode,to:e.toNode,edge:e.id,kind:e.color?'return':'request',description:e.color?'Returns job-title records':'Loads job titles',evidence}));
  const nodes=canvas.nodes.map(n=>{
    const record={node:n.id,evidence,search:{query:'load|useTitles',scope:'src and importing staff forms',result:'Read list and form consumers; no other scoped caller found',evidence}};
    for(const facet of FACETS) {
      const ids=relationships.filter(r=> facet==='callers'?r.to===n.id&&r.kind==='request':facet==='calls'?r.from===n.id&&r.kind==='request':['returns','consumers'].includes(facet)?r.from===n.id&&r.kind==='return':false).map(r=>r.id);
      record[facet]=ids.length?{relationships:ids}:{relationships:[],none:`No direct ${facet} in this scoped implementation; checked its body and call sites`,evidence};
    }return record;
  });
  const audit={version:1,mode:'code',scope:'Detailed title loading and data delivery to page',relationships,nodes};
  const file=path.join(vault,'titles','titles.canvas'),inventory=path.join(vault,'titles','titles.relationships.json');
  fs.writeFileSync(file,JSON.stringify(canvas));fs.writeFileSync(inventory,JSON.stringify(audit));
  return {root,vault,canvas,audit,evidence,file,inventory};
}

test('source-backed inventory covers requests and separate returns; missing return cannot silently disappear',t=>{
  const f=fixture(t);
  assert.deepEqual(validateAudit(f.canvas,f.audit,f.root).problems,[]);
  f.canvas.edges=f.canvas.edges.filter(e=>e.id!=='client-hook');
  assert.ok(validateAudit(f.canvas,f.audit,f.root).problems.some(p=>p.includes('direction/endpoints')));
  const response=f.audit.relationships.find(r=>r.id==='client-hook');delete response.edge;
  assert.ok(validateAudit(f.canvas,f.audit,f.root).problems.some(p=>p.includes('deliberate omission')));
  response.omitted='Overview aggregates the HTTP response in the hook note; the page delivery remains drawn.';
  assert.deepEqual(validateAudit(f.canvas,f.audit,f.root).problems,[]);
});

test('audit rejects uncovered nodes/edges, unreviewed returns and unexplained absences',t=>{
  const f=fixture(t);f.audit.nodes[0].writes={relationships:[]};delete f.audit.nodes[1].returns;
  f.canvas.nodes.push({id:'staff-form',type:'file',file:'nodes/form.md'});
  f.canvas.edges.push({id:'form-hook',fromNode:'staff-form',toNode:'hook'});
  const errors=validateAudit(f.canvas,f.audit,f.root).problems.join('\n');
  assert.match(errors,/staff-form has no/);assert.match(errors,/form-hook has no/);assert.match(errors,/hook: review returns/);assert.match(errors,/page.writes: explain/);
});

test('consumer search and exact source citations are required, and returned data must name its real recipient',t=>{
  const f=fixture(t);f.audit.nodes[1].search={};f.audit.relationships[2].to='page';f.evidence[0].text='invented source';
  const errors=validateAudit(f.canvas,f.audit,f.root).problems.join('\n');
  assert.match(errors,/consumer search/);assert.match(errors,/does not match/);assert.match(errors,/direction\/endpoints/);
});

test('new code jobs stay blocked after visual attestation until an inventory passes; changes invalidate evidence',t=>{
  const f=fixture(t);assert.equal(run('job.mjs','start',f.file).status,0);
  assert.equal(run('job.mjs','reviewed',f.file,'Reviewed every readable section and confirmed that all arrows are legible.','--relationships').status,0);
  const read=()=>JSON.parse(fs.readFileSync(path.join(f.vault,'.diagram-job.json')));
  assert.ok(runChecks(f.vault,read()).failures.some(p=>p.id==='relationship-audit'));
  const result=run('audit.mjs',f.file,f.inventory);assert.equal(result.status,0,result.stderr);
  assert.deepEqual(relationshipAuditProblems(f.vault,read(),f.canvas),[]);
  const moved=structuredClone(f.canvas);moved.nodes[0].x=100;moved.edges[0].fromSide='right';
  assert.equal(relationshipHash(moved),relationshipHash(f.canvas));
  fs.appendFileSync(path.join(f.root,'titles.js'),'// changed implementation\n');
  assert.match(relationshipAuditProblems(f.vault,read(),f.canvas)[0].msg,/Source titles.js changed/);
  assert.equal(run('audit.mjs',f.file,f.inventory).status,0);
  fs.appendFileSync(f.inventory,'\n');
  assert.match(relationshipAuditProblems(f.vault,read(),f.canvas)[0].msg,/inventory or semantic graph changed/);
  assert.equal(run('audit.mjs',f.file,f.inventory).status,0);
  f.canvas.edges[0].toNode='client';
  assert.match(relationshipAuditProblems(f.vault,read(),f.canvas)[0].msg,/semantic graph changed/);
});

test('presentation-only jobs preserve semantics and explicitly avoid asserting a code audit',t=>{
  const f=fixture(t);const result=run('job.mjs','start',f.file,'--presentation');assert.equal(result.status,0);assert.match(result.stdout,/NOT audited/);
  const job=JSON.parse(fs.readFileSync(path.join(f.vault,'.diagram-job.json')));
  assert.deepEqual(relationshipAuditProblems(f.vault,job,f.canvas),[]);
  assert.notEqual(run('audit.mjs',f.file,f.inventory).status,0);
  f.canvas.edges.pop();assert.match(relationshipAuditProblems(f.vault,job,f.canvas)[0].msg,/Relationships changed/);
});

test('code jobs cannot substitute design rationale for source evidence; design jobs are explicitly separate',t=>{
  const f=fixture(t);f.audit.mode='design';
  const propose=item=>{item.design='Explicitly proposed interaction in the requested feature design.';delete item.evidence;};
  for(const r of f.audit.relationships)propose(r);
  for(const n of f.audit.nodes){propose(n);propose(n.search);for(const facet of FACETS)if(!n[facet].relationships.length)propose(n[facet]);}
  fs.writeFileSync(f.inventory,JSON.stringify(f.audit));
  assert.equal(run('job.mjs','start',f.file).status,0);assert.notEqual(run('audit.mjs',f.file,f.inventory).status,0);
  assert.equal(run('job.mjs','start',f.file,'--design').status,0);assert.equal(run('audit.mjs',f.file,f.inventory).status,0);
  f.audit.nodes[0].basis='code';f.audit.nodes[0].design='A planned rationale cannot validate an existing implementation.';delete f.audit.nodes[0].evidence;
  assert.ok(validateAudit(f.canvas,f.audit,f.root).problems.some(p=>p.includes('implementation/call-site review: cite')));
});
