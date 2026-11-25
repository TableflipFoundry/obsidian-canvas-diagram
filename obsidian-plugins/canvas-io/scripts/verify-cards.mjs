import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connect} from './cdp.mjs';
const c=await connect();
const name=`canvas-io-card-test-${crypto.randomUUID()}`,file=`${name}.canvas`,note=`${name}.md`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const board=`app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===${JSON.stringify(file)}).view.canvas`;
let original;let checks=0;
const check=async(title,expression)=>{assert.ok(await c.evaluate(expression),title);console.log(`PASS ${title}`);checks++;};
const click=async(point,button='left')=>{
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button,clickCount:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button,clickCount:1});await wait(120);
};
const snapshot=async()=>{await wait(300);await c.send('Page.captureScreenshot');};
const menuClick=async title=>{
  const point=await c.evaluate(`(()=>{const el=[...document.querySelectorAll('.menu-item-title')].find(e=>e.textContent===${JSON.stringify(title)})?.closest('.menu-item');if(!el)throw new Error('Missing menu item: '+${JSON.stringify(title)});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await click(point);await snapshot();
};
const context=async id=>{
  await snapshot();
  const point=await c.evaluate(`(()=>{const r=${board}.nodes.get(${JSON.stringify(id)}).nodeEl.getBoundingClientRect();return{x:r.x+50,y:r.y+55}})()`);
  await click(point,'right');
};
const background=async()=>{
  await snapshot();
  const point=await c.evaluate(`(()=>{const el=${board}.wrapperEl;const r=el.getBoundingClientRect();for(const point of [{x:r.x+70,y:r.y+90},{x:r.right-150,y:r.bottom-140}]){if(document.elementFromPoint(point.x,point.y)?.closest('.canvas-node'))continue;return point;}throw new Error('No blank Canvas location')})()`);
  await click(point,'right');
};
try{
  original=await c.evaluate('app.workspace.activeLeaf?.view.file?.path');
  await c.send('Page.bringToFront');
  await c.evaluate(`(async()=>{
    await app.vault.create(${JSON.stringify(note)},'A temporary Markdown card used for testing.');
    const data={nodes:[
      {id:'standard',type:'text',text:'Ordinary card',x:0,y:0,width:320,height:200},
      {id:'io',type:'text',canvasIO:{ports:true},text:'I/O card',x:550,y:0,width:320,height:200},
      {id:'legend-type-component',type:'text',text:'Component',x:0,y:400,width:260,height:50},
      {id:'markdown',type:'file',file:${JSON.stringify(note)},x:550,y:400,width:320,height:200}
    ],edges:[]};
    const f=await app.vault.create(${JSON.stringify(file)},JSON.stringify(data));const leaf=app.workspace.getLeaf('tab');await leaf.openFile(f);app.workspace.setActiveLeaf(leaf,{focus:true});leaf.view.canvas.zoomToFit();
  })()`);await snapshot();
  await check('ordinary cards have no I/O overlay',`${board}.nodes.get('standard').nodeEl.querySelectorAll('.canvas-io-port').length===0`);
  await check('explicit I/O cards have eight ports',`${board}.nodes.get('io').nodeEl.querySelectorAll('.canvas-io-port').length===8`);
  await check('Markdown cards default to I/O',`${board}.nodes.get('markdown').nodeEl.querySelectorAll('.canvas-io-port').length===8`);
  await check('old legend cards are standard without editing their data',`${board}.nodes.get('legend-type-component').nodeEl.querySelectorAll('.canvas-io-port').length===0`);
  await c.evaluate(`${board}.nodeInteractionLayer.setTarget(${board}.nodes.get('standard'))`);
  await check('standard cards retain native connection points',`[...${board}.nodeInteractionLayer.interactionEl.querySelectorAll('.canvas-node-connection-point')].every(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).pointerEvents!=='none')`);
  await c.evaluate(`${board}.nodeInteractionLayer.setTarget(${board}.nodes.get('io'))`);
  await check('I/O cards hide native center points only on their own hover layer',`[...${board}.nodeInteractionLayer.interactionEl.querySelectorAll('.canvas-node-connection-point')].every(e=>getComputedStyle(e).display==='none')`);
  await background();
  await check('background menu offers standard and I/O creation',`['Add card','Add I/O card'].every(title=>[...document.querySelectorAll('.menu-item-title')].some(e=>e.textContent===title))`);
  if(process.argv.includes('--screenshot')){const shot=await c.send('Page.captureScreenshot');await writeFile('card-menu-review.png',Buffer.from(shot.data,'base64'));}
  await menuClick('Add I/O card');
  await check('new menu creates a saved explicit I/O card',`[...${board}.nodes.values()].some(n=>!['standard','io','markdown','legend-type-component'].includes(n.id)&&n.getData().canvasIO?.ports===true&&n.nodeEl.querySelectorAll('.canvas-io-port').length===8)`);
  await c.evaluate(`${board}.undo()`);await snapshot();
  await check('one undo removes the new I/O card',`${board}.nodes.size===4`);
  await background();await menuClick('Add card');
  await check('original Add card still creates an ordinary card',`[...${board}.nodes.values()].some(n=>!['standard','io','markdown','legend-type-component'].includes(n.id)&&!n.getData().canvasIO&&n.nodeEl.querySelectorAll('.canvas-io-port').length===0)`);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await context('standard');await menuClick('Use I/O card');
  await check('node menu converts an ordinary card to I/O',`${board}.nodes.get('standard').getData().canvasIO?.ports===true&&${board}.nodes.get('standard').nodeEl.querySelectorAll('.canvas-io-port').length===8`);
  await context('io');await menuClick('Use standard card');
  await check('node menu removes the I/O overlay immediately',`${board}.nodes.get('io').getData().canvasIO?.ports===false&&${board}.nodes.get('io').nodeEl.querySelectorAll('.canvas-io-port').length===0`);
  await c.evaluate(`${board}.undo()`);await snapshot();
  await check('undo restores I/O mode',`${board}.nodes.get('io').getData().canvasIO?.ports===true&&${board}.nodes.get('io').nodeEl.querySelectorAll('.canvas-io-port').length===8`);
  await c.evaluate(`${board}.redo()`);await snapshot();
  await check('redo restores standard mode',`${board}.nodes.get('io').getData().canvasIO?.ports===false&&${board}.nodes.get('io').nodeEl.querySelectorAll('.canvas-io-port').length===0`);
  await c.evaluate(`${board}.importData({nodes:[],edges:[{id:'mixed',fromNode:'standard',fromSide:'right',toNode:'io',toSide:'left',canvasIO:{version:1,fromPort:'output',toPort:'input'}}]},false)`);await snapshot();
  await check('mixed edges use the native center on the standard end',`(()=>{const e=${board}.edges.get('mixed');return e.bezier.to.x===550&&e.bezier.to.y===100&&e.bezier.from.y===76})()`);
  await c.evaluate(`${board}.view.requestSave()`);await wait(1500);
  await c.evaluate(`(async()=>{const leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===${JSON.stringify(file)});await leaf.view.save();await leaf.setViewState({type:'empty'});await leaf.openFile(app.vault.getAbstractFileByPath(${JSON.stringify(file)}));leaf.view.canvas.zoomToFit()})()`);await snapshot();
  await check('card modes persist on reopening',`${board}.nodes.get('standard').getData().canvasIO?.ports===true&&${board}.nodes.get('io').getData().canvasIO?.ports===false&&${board}.nodes.get('legend-type-component').nodeEl.querySelectorAll('.canvas-io-port').length===0`);
  if(process.argv.includes('--screenshot')){const shot=await c.send('Page.captureScreenshot');await writeFile('card-types-review.png',Buffer.from(shot.data,'base64'));}
  console.log(JSON.stringify({checks,title:await c.evaluate('document.title')}));
}finally{
  await c.evaluate(`(async()=>{for(const leaf of app.workspace.getLeavesOfType('canvas').filter(l=>l.view.file?.path===${JSON.stringify(file)})){await leaf.view.save();leaf.detach();}await new Promise(r=>setTimeout(r,1500));for(const path of [${JSON.stringify(file)},${JSON.stringify(note)}]){const f=app.vault.getAbstractFileByPath(path);if(f)await app.vault.delete(f);}const path=${JSON.stringify(original??'')},f=app.vault.getAbstractFileByPath(path);if(f){const leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===path)??app.workspace.getLeaf(false);await leaf.openFile(f);app.workspace.setActiveLeaf(leaf,{focus:true});}})()`);
  c.close();
}
