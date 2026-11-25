// Opt-in end-to-end checks in an already-open test vault. Leaves no fixture files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {connect,openCanvas} from './lib/obsidian.mjs';
import {refineIO} from './lib/io-layout.mjs';
const vault=process.env.OBSIDIAN_VAULT;
if(!vault)throw new Error('Set OBSIDIAN_VAULT to an existing open test vault (debugger port 9222).');
const here=path.dirname(fileURLToPath(import.meta.url));
const folder=`canvas-io-layout-test-${crypto.randomUUID()}`, rel=`${folder}/regression.canvas`;
const {browser,page}=await connect(path.resolve(vault));
const original=await page.evaluate(()=>app.workspace.activeLeaf?.view.file?.path);
const io={version:1,fromPort:'output',toPort:'input'};
const node=(id,x,y)=>({id,type:'file',file:`${folder}/${id}.md`,x,y,width:320,height:200,color:'5'});
const edge=(id,fromNode,toNode,fromSide,toSide,label)=>({id,fromNode,toNode,fromSide,toSide,label,canvasIO:{...io}});
const cases=[
  {name:'corner with an intervening helper',data:{nodes:[node('routes',0,430),node('aspects',550,430),node('inventory',1100,0)],edges:[edge('matches','inventory','routes','right','left','inventory matches')]},plan:{}},
  {name:'request and response labels',data:{nodes:[node('client',0,0),node('routes',0,500)],edges:[edge('request','client','routes','bottom','top','pawn HTTP'),edge('response','routes','client','top','bottom','HTTP response')]},plan:{spines:[['client','routes']]}},
  {name:'fresh pipeline with a spine and adjacent helper',generated:true,
    data:{nodes:[node('client',0,0),node('routes',0,0),node('aspects',0,0)],edges:[
      edge('request','client','routes','bottom','top','request'),edge('response','routes','client','top','bottom','response'),
      edge('category','routes','aspects','right','left','category'),edge('questions','aspects','routes','left','right','questions')]},
    plan:{version:1,spines:[['client','routes']],supports:[{node:'aspects',anchor:'routes',side:'right'}]}},
];
try{
  await page.evaluate(async folder=>{await app.vault.createFolder(folder);},folder);
  const ids=[...new Set(cases.flatMap(c=>c.data.nodes.map(n=>n.id)))];
  for(const id of ids)await page.evaluate(async({folder,id})=>{
    await app.vault.create(`${folder}/${id}.md`,`---\nid: ${id}\ntitle: ${id}\ntype: component\nstatus: planned\nlevel: component\n---\n\nA temporary diagram-tool regression card.\n`);
  },{folder,id});
  for(const fixture of cases){
    const {canvas,report}=fixture.generated ? {canvas:fixture.data} : refineIO(fixture.data,fixture.plan);
    if(report){assert.deepEqual(report.throughCards,[]);assert.deepEqual(report.labelConflicts,[]);}
    await page.evaluate(async({rel,canvas})=>{const file=app.vault.getAbstractFileByPath(rel);if(file)await app.vault.modify(file,JSON.stringify(canvas));else await app.vault.create(rel,JSON.stringify(canvas));},{rel,canvas});
    if(fixture.generated){
      fs.writeFileSync(path.join(vault,rel.replace('.canvas','.layout.json')),JSON.stringify(fixture.plan));
      const generated=spawnSync(process.execPath,[path.join(here,'pipeline.mjs'),path.join(vault,rel),'--iters','250','--seeds','1','--seed','11','--no-check'],{encoding:'utf8',timeout:60000});
      assert.equal(generated.status,0,generated.stderr+generated.stdout);
      const output=JSON.parse(fs.readFileSync(path.join(vault,rel),'utf8'));
      const get=id=>output.nodes.find(n=>n.id===id);
      assert.equal(get('client').x,get('routes').x);assert.equal(get('routes').y,get('aspects').y);
      assert.ok(output.nodes.some(n=>n.id==='legend-group'));
    }
    await openCanvas(page,rel);
    const result=spawnSync(process.execPath,[path.join(here,'score.mjs'),path.join(vault,rel),'--json'],{encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr);
    const quality=JSON.parse(result.stdout);
    for(const key of ['throughNode','overlap','labelOnNode','labelOnLabel','labelOnEdge','missingNote','looseArrow'])
      assert.deepEqual(quality.issues[key],[],`${fixture.name}: ${key}`);
    if(fixture.name.startsWith('corner')){
      const current=JSON.parse(fs.readFileSync(path.join(vault,rel),'utf8'));
      assert.notEqual(current.edges[0].fromSide,'right');
    }
    if(process.env.NATIVE_LAYOUT_SCREENSHOT){
      const target=path.resolve(`${process.env.NATIVE_LAYOUT_SCREENSHOT}-${cases.indexOf(fixture)+1}.png`);
      await page.screenshot({path:target});console.log(`SCREENSHOT ${target}`);
    }
    console.log(`PASS native layout: ${fixture.name}`);
  }
}finally{
  try {
    await page.evaluate(async({rel,folder})=>{
      for(const leaf of app.workspace.getLeavesOfType('canvas').filter(l=>l.view.file?.path===rel)){await leaf.view.save();leaf.detach();}
      await new Promise(resolve=>setTimeout(resolve,1500));
      const directory=app.vault.getAbstractFileByPath(folder);
      if(directory)for(const file of [...directory.children])await app.vault.delete(file);
    },{rel,folder});
    const target=path.resolve(vault,folder);
    assert.equal(path.dirname(target),path.resolve(vault));assert.ok(path.basename(target).startsWith('canvas-io-layout-test-'));
    if(fs.existsSync(target))fs.rmdirSync(target); // empty directory only
    await page.evaluate(async original=>{
      const file=original&&app.vault.getAbstractFileByPath(original);if(!file)return;
      const previous=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===original)??app.workspace.getLeaf(false);
      if(previous.view?.file?.path!==original)await previous.openFile(file);
      app.workspace.setActiveLeaf(previous,{focus:true});
    },original);
  } finally { await browser.close(); }
}
