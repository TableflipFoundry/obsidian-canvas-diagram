import assert from 'node:assert/strict';
import { connect } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';
const c = await connect();
const sandbox = `canvas-io-development-${Date.now()}.canvas`;
const results = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let original;
let advancedWasEnabled = false;
const withoutAdvanced = process.argv.includes('--without-advanced');
const board = () => `app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===${JSON.stringify(sandbox)}).view.canvas`;
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log(`PASS ${name}`); };
try {
  await c.send('Page.bringToFront');
  original = await c.evaluate(`app.workspace.activeLeaf?.view.file?.path`);
  advancedWasEnabled = await c.evaluate(`!!app.plugins.plugins['advanced-canvas']`);
  if (withoutAdvanced && advancedWasEnabled) await c.evaluate(`app.plugins.disablePlugin('advanced-canvas')`);
  await c.evaluate(`(async()=>{
    await app.plugins.loadManifests();
    if(app.plugins.plugins['canvas-io']) await app.plugins.disablePlugin('canvas-io');
    await app.plugins.enablePluginAndSave('canvas-io');
    const old=app.vault.getAbstractFileByPath(${JSON.stringify(sandbox)});
    if(old) throw new Error('Sandbox already exists; refusing to overwrite');
    const data={nodes:[
      {id:'a',type:'text',text:'Browser\\nSend requests; receive responses.',x:0,y:0,width:300,height:200},
      {id:'b',type:'text',text:'Routes\\nReceive requests; return results.',x:600,y:0,width:300,height:200},
      {id:'c',type:'text',text:'Aspects\\nReceive a category; return its questions.',x:600,y:500,width:300,height:200}
    ],edges:[]};
    const file=await app.vault.create(${JSON.stringify(sandbox)},JSON.stringify(data));
    const leaf=app.workspace.getLeaf('tab'); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf,{focus:true});
    leaf.view.canvas.zoomToFit();
  })()`);
  await wait(900);
  await c.send('Page.captureScreenshot');
  check('plugin mounted eight ports per card', await c.evaluate(`['a','b','c'].every(id=>${board()}.nodes.get(id).nodeEl.querySelectorAll('.canvas-io-port').length===8)`));
  check('native hover connection handles are hidden and inactive', await c.evaluate(`(()=>{
    const canvas=${board()},node=canvas.nodes.get('a');canvas.nodeInteractionLayer.setTarget(node);
    const handles=[...canvas.wrapperEl.querySelectorAll('.canvas-node-connection-point')];
    node.onConnectionPointerdown(new PointerEvent('pointerdown',{button:0}),'right');
    return handles.length===4 && handles.every(el=>getComputedStyle(el).display==='none' && getComputedStyle(el).pointerEvents==='none') && canvas.edges.size===0;
  })()`));
  const position = async (node, side, kind) => c.evaluate(`(()=>{
    const n=${board()}.nodes.get(${JSON.stringify(node)});
    const r=n.nodeEl.querySelector('[data-side="${side}"][data-kind="${kind}"]').getBoundingClientRect();
    if(!r.width) throw new Error('Port is not rendered');
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  const drag = async (node, side, kind, targetNode, targetSide, targetKind) => {
    await c.send('Page.captureScreenshot');
    const a = await position(node, side, kind), b = await position(targetNode, targetSide, targetKind);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...a });
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...a, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...b, buttons: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...b, button: 'left', clickCount: 1 });
    await wait(150);
  };
  await drag('a', 'right', 'output', 'b', 'left', 'input');
  check('real pointer drag creates Output → Input edge', await c.evaluate(`${board()}.edges.size===1`));
  await drag('b', 'left', 'output', 'a', 'right', 'input');
  check('reverse response uses a separate parallel lane', await c.evaluate(`(()=>{
    const edges=[...${board()}.edges.values()];
    return edges.length===2 && edges[0].bezier.from.y!==edges[1].bezier.to.y && edges[0].bezier.from.y===edges[0].bezier.to.y;
  })()`));
  await drag('b', 'bottom', 'output', 'c', 'top', 'input');
  await drag('c', 'top', 'output', 'b', 'bottom', 'input');
  check('top/bottom lanes are mirrored too', await c.evaluate(`${board()}.edges.size===4`));
  await drag('a', 'right', 'output', 'b', 'left', 'output');
  check('Output → Output is rejected', await c.evaluate(`${board()}.edges.size===4`));
  await c.evaluate(`${board()}.undo()`); await wait(200);
  check('undo removes exactly one connection', await c.evaluate(`${board()}.edges.size===3`));
  await c.evaluate(`${board()}.redo()`); await wait(200);
  check('redo restores port metadata', await c.evaluate(`[...${board()}.edges.values()].filter(e=>e.getData().canvasIO?.version===1).length===4`));
  await c.evaluate(`(()=>{const n=${board()}.nodes.get('b');n.setData({...n.getData(),x:650,y:30,width:340,height:240});})()`);
  await wait(400);
  check('moving/resizing keeps edges on exact ports', await c.evaluate(`(()=>{
    const e=[...${board()}.edges.values()].find(e=>e.to.node.id==='b');
    return e.bezier.to.x===640 && e.bezier.to.y===126;
  })()`));
  await c.evaluate(`${board()}.setReadonly(true)`); await wait(400);
  await drag('a', 'right', 'output', 'b', 'left', 'input');
  check('read-only board rejects new connections', await c.evaluate(`${board()}.edges.size===4`));
  await c.evaluate(`${board()}.setReadonly(false);${board()}.view.requestSave()`);
  await wait(1600);
  const saved = await c.evaluate(`app.vault.read(app.vault.getAbstractFileByPath(${JSON.stringify(sandbox)}))`);
  check('saved .canvas persists all four port choices', JSON.parse(saved).edges.every(e => e.canvasIO?.fromPort === 'output' && e.canvasIO?.toPort === 'input'));
  await c.evaluate(`(()=>{const canvas=${board()};const data=canvas.getData();canvas.importData(data,true)})()`);
  await wait(500);
  check('reimport recreates anchored edges and ports', await c.evaluate(`['a','b','c'].every(id=>${board()}.nodes.get(id).nodeEl.querySelectorAll('.canvas-io-port').length===8) && ${board()}.edges.size===4`));
  await c.evaluate(`app.plugins.disablePlugin('canvas-io')`);
  check('disable removes ports cleanly', await c.evaluate(`${board()}.wrapperEl.querySelectorAll('.canvas-io-port').length===0`));
  await c.evaluate(`app.plugins.enablePlugin('canvas-io')`); await wait(400);
  check('reenable restores ports and custom anchors', await c.evaluate(`['a','b','c'].every(id=>${board()}.nodes.get(id).nodeEl.querySelectorAll('.canvas-io-port').length===8) && [...${board()}.edges.values()].every(e=>e.bezier.path===e.path.display.getAttribute('d'))`));
  await c.evaluate(`(async()=>{
    const leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===${JSON.stringify(sandbox)});
    await leaf.view.save(); leaf.detach();
    const next=app.workspace.getLeaf('tab');await next.openFile(app.vault.getAbstractFileByPath(${JSON.stringify(sandbox)}));
    app.workspace.setActiveLeaf(next,{focus:true});next.view.canvas.zoomToFit();
  })()`);
  await wait(500); await c.send('Page.captureScreenshot');
  check('closing and reopening retains all I/O connections', await c.evaluate(`${board()}.edges.size===4 && [...${board()}.edges.values()].every(e=>e.getData().canvasIO?.version===1 && e.bezier.path===e.path.display.getAttribute('d'))`));
  // Keyboard activation uses the same validation and transaction as dragging.
  await c.evaluate(`(()=>{const canvas=${board()};for(const [id,side,kind] of [['a','bottom','output'],['c','left','input']]){
    canvas.nodes.get(id).nodeEl.querySelector('[data-side="'+side+'"][data-kind="'+kind+'"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  }})()`);
  check('keyboard port activation connects Output → Input', await c.evaluate(`${board()}.edges.size===5`));
  await c.evaluate(`${board()}.undo()`); await wait(200);
  await c.evaluate(`(()=>{const canvas=${board()};canvas.nodes.get('a').nodeEl.querySelector('[data-side="bottom"][data-kind="output"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    canvas.wrapperEl.ownerDocument.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));})()`);
  check('Escape cancels without creating an edge', await c.evaluate(`${board()}.edges.size===4 && !app.plugins.plugins['canvas-io'].gesture`));
  const reconnect = await c.evaluate(`(()=>{
    const canvas=${board()},edge=[...canvas.edges.values()].find(e=>e.from.node.id==='a');
    canvas.selectOnly(edge);return {id:edge.id};
  })()`);
  await c.send('Page.captureScreenshot');
  const endpoint = await c.evaluate(`(()=>{const r=${board()}.edges.get(${JSON.stringify(reconnect.id)}).toLineEnd.el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const destination = await position('c','left','input');
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...endpoint});
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...endpoint,button:'left',clickCount:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...destination,buttons:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...destination,button:'left',clickCount:1});
  await wait(200);
  check('dragging an existing arrowhead reconnects the same edge', await c.evaluate(`${board()}.edges.size===4 && ${board()}.edges.get(${JSON.stringify(reconnect.id)}).to.node.id==='c'`));
  await c.evaluate(`${board()}.undo()`); await wait(200);
  await c.evaluate(`(()=>{const canvas=${board()};canvas.importData({nodes:[],edges:[{id:'ordinary',fromNode:'a',fromSide:'bottom',toNode:'c',toSide:'left',label:'ordinary edge'}]},false)})()`);
  await wait(200);
  check('ordinary edges keep native center anchors', await c.evaluate(`(()=>{const e=${board()}.edges.get('ordinary');return !e.getData().canvasIO && e.bezier.from.x===150})()`));
  await c.evaluate(`${board()}.removeEdge(${board()}.edges.get('ordinary'))`);
  check('closed/reimported canvases release obsolete edge hooks', await c.evaluate(`app.plugins.plugins['canvas-io'].edges.size <= app.workspace.getLeavesOfType('canvas').reduce((n,l)=>n+l.view.canvas.edges.size,0)+1`));
  const shot = await c.send('Page.captureScreenshot');
  if(process.argv.includes('--screenshot')) await writeFile('native-debug.png', Buffer.from(shot.data,'base64'));
  console.log(JSON.stringify({ title: await c.evaluate(`document.title`), advancedCanvas: !withoutAdvanced && advancedWasEnabled, checks: results.length }));
} catch (error) {
  console.log(await c.evaluate(`JSON.stringify({active:app.workspace.activeLeaf?.view.file?.path,pluginEnabled:!!app.plugins.plugins['canvas-io'],ports:${board()}.wrapperEl.querySelectorAll('.canvas-io-port').length,edgeCount:${board()}.edges.size})`));
  if(process.argv.includes('--screenshot')) {
    const shot = await c.send('Page.captureScreenshot');
    await writeFile('native-debug.png', Buffer.from(shot.data,'base64'));
  }
  throw error;
} finally {
  // Always remove the temporary vault fixture and return to the user's diagram.
  await c.evaluate(`(async()=>{
    const leaves=app.workspace.getLeavesOfType('canvas').filter(l=>l.view.file?.path===${JSON.stringify(sandbox)});
    for(const leaf of leaves) {await leaf.view.save();leaf.detach();}
    await new Promise(r=>setTimeout(r,1500));
    const file=app.vault.getAbstractFileByPath(${JSON.stringify(sandbox)}); if(file) await app.vault.delete(file);
    const original=${JSON.stringify(original ?? '')};
    const leaf=app.workspace.getLeavesOfType('canvas').find(l=>l.view.file?.path===original);
    if(leaf) app.workspace.setActiveLeaf(leaf,{focus:true});
  })()`).catch(error => console.error('Cleanup failed:', error.message));
  if (withoutAdvanced && advancedWasEnabled) await c.evaluate(`app.plugins.enablePlugin('advanced-canvas')`);
  c.close();
}
