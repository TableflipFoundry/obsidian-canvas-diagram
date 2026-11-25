import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {enableIO,installCanvasIOFiles,anchorPoint} from '../lib/canvas-io.mjs';

test('conversion preserves meaning and future metadata, and opts legends out',()=>{
  const canvas={nodes:[{id:'a',x:70,y:90},{id:'legend-title',text:'Legend'}],edges:[
    {id:'request',fromNode:'a',toNode:'b',fromSide:'right',toSide:'left',label:'request',color:'5',styleAttributes:{path:'dotted'}},
    {id:'future',canvasIO:{version:9}}, {id:'legend-edge'}]};
  const before=structuredClone(canvas);
  enableIO(canvas);
  assert.deepEqual(canvas.edges[0],{...before.edges[0],canvasIO:{version:1,fromPort:'output',toPort:'input'}});
  assert.deepEqual(canvas.nodes[0],before.nodes[0]);
  assert.deepEqual(canvas.edges[1],before.edges[1]);
  assert.deepEqual(canvas.edges[2],before.edges[2]);
  assert.equal(canvas.nodes[1].canvasIO.ports,false);
  const once=structuredClone(canvas);enableIO(canvas);assert.deepEqual(canvas,once);
});

test('bundle installs offline and preserves newer installations',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'canvas-io-bundle-'));
  try{
    assert.equal(installCanvasIOFiles(root).changed,true);
    const installed=path.join(root,'.obsidian/plugins/canvas-io');
    assert.equal(JSON.parse(fs.readFileSync(path.join(installed,'manifest.json'))).id,'canvas-io');
    assert.equal(installCanvasIOFiles(root).changed,false);
    fs.writeFileSync(path.join(installed,'manifest.json'),JSON.stringify({id:'canvas-io',version:'99.0.0'}));
    fs.writeFileSync(path.join(installed,'main.js'),'user build');
    assert.equal(installCanvasIOFiles(root).changed,false);
    assert.equal(fs.readFileSync(path.join(installed,'main.js'),'utf8'),'user build');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('saved diagrams need explicit --io; conversion keeps card positions and sides',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'canvas-io-convert-'));
  try{
    fs.mkdirSync(path.join(root,'.obsidian'));const file=path.join(root,'example.canvas');
    const original={nodes:[{id:'a',type:'file',file:'nodes/a.md',color:'5',x:70,y:90,width:320,height:200},{id:'b',type:'file',file:'nodes/b.md',color:'5',x:700,y:90,width:320,height:200}],edges:[{id:'ab',fromNode:'a',toNode:'b',fromSide:'right',toSide:'left'}]};
    fs.writeFileSync(file,JSON.stringify(original));
    const pipeline=fileURLToPath(new URL('../pipeline.mjs',import.meta.url));
    for(const args of [[],['--io']]){
      const result=spawnSync(process.execPath,[pipeline,file,'--no-check',...args],{encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      const current=JSON.parse(fs.readFileSync(file));assert.deepEqual(current.nodes,original.nodes);
      assert.equal(current.edges[0].fromSide,'right');assert.equal(current.edges[0].toSide,'left');
      assert.equal(!!current.edges[0].canvasIO,args.length>0);
    }
    assert.deepEqual(anchorPoint({minX:0,minY:0,maxX:320,maxY:200},'right','output'),{x:330,y:76});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
