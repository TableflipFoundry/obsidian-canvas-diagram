import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export { anchorPoint, isIO } from '../../../../vendor/canvas-io/geometry.mjs';
export {cardAnchor,isIOCard} from '../../../../vendor/canvas-io/cards.mjs';
export const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../vendor/canvas-io');
const files = ['main.js','manifest.json','styles.css'];

export function enableIO(canvas) {
  for(const node of canvas.nodes ?? []) if(String(node.id).startsWith('legend-')) node.canvasIO={...node.canvasIO,ports:false};
  for(const edge of canvas.edges ?? []) {
    if(String(edge.id).startsWith('legend-')) continue;
    // Preserve future/foreign metadata rather than silently reinterpret it.
    if(edge.canvasIO && edge.canvasIO.version!==1) continue;
    edge.canvasIO={...edge.canvasIO,version:1,fromPort:'output',toPort:'input'};
  }
  return canvas;
}

export function installCanvasIOFiles(vaultRoot) {
  const checksums=JSON.parse(fs.readFileSync(path.join(bundle,'checksums.json'),'utf8'));
  for(const file of files) {
    const bytes=fs.readFileSync(path.join(bundle,file));
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==checksums[file]) throw new Error(`Bundled Canvas IO checksum mismatch: ${file}`);
  }
  const expected=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
  const target=path.join(vaultRoot,'.obsidian','plugins',expected.id);
  const installed=fs.existsSync(path.join(target,'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8')) : null;
  const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
  // Never downgrade a newer user-installed version or overwrite same-version customization.
  if(installed && compare(installed.version,expected.version)>0 && !files.every(f=>fs.existsSync(path.join(target,f))))
    throw new Error('The newer installed Canvas IO is incomplete. Repair that installation instead of downgrading it.');
  if(installed && compare(installed.version,expected.version)>=0 && files.every(f=>fs.existsSync(path.join(target,f)))) return {changed:false,id:expected.id};
  fs.mkdirSync(target,{recursive:true});
  for(const file of files) fs.copyFileSync(path.join(bundle,file),path.join(target,file));
  return {changed:true,id:expected.id};
}

export async function ensureCanvasIO(page,vaultRoot) {
  const {changed,id}=installCanvasIOFiles(vaultRoot);
  const result=await page.evaluate(async ({id,changed})=>{
    try {
      if(changed && app.plugins.plugins[id]) await app.plugins.disablePlugin(id);
      if(!app.plugins.plugins[id]) {
        await app.plugins.loadManifests();
        if(typeof app.plugins.isEnabled==='function'&&!app.plugins.isEnabled())await app.plugins.setEnable(true);
        await app.plugins.enablePluginAndSave(id);
      }
      return !!app.plugins.plugins[id] ? null : 'not enabled';
    }catch(error){return String(error);}
  },{id,changed});
  if(result)throw new Error(`Canvas IO could not be enabled (${result}). It requires Obsidian desktop 1.15.1+.`);
}
