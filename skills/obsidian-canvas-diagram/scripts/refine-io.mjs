// Explicit attachment/label refinement for an existing I/O diagram. No card moves.
import fs from 'node:fs';
import path from 'node:path';
import {refineIO} from './lib/io-layout.mjs';
import {readRelationships,assertNoteMeaning} from './lib/relationships.mjs';
const file=process.argv[2];
if(!file)throw new Error('Usage: node refine-io.mjs <diagram.canvas>; then verify.mjs and visual review');
const before=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const {canvas,report}=refineIO(before,readRelationships(file).plan);
assertNoteMeaning(before,canvas);
fs.writeFileSync(file,JSON.stringify(canvas,null,2)+'\n');
console.log(JSON.stringify({file:path.resolve(file),method:'fixed-card I/O side and label refinement',predicted:report},null,2));
console.log('Prediction only. Run verify.mjs and inspect whole rendering and readable closeups before recording review.');
