// Usage: node audit.mjs <diagram.canvas> <diagram.relationships.json> [--source-root <project>]
import fs from 'node:fs';
import path from 'node:path';
import {locateVault,readJob,updateJob} from './lib/job.mjs';
import {validateAudit,relationshipHash,sourceHash} from './lib/relationship-audit.mjs';
const [canvasArg,inventoryArg,...args]=process.argv.slice(2);
if (!canvasArg || !inventoryArg || (args.length && (args.length !== 2 || args[0] !== '--source-root'))) {
  console.error('usage: node audit.mjs <diagram.canvas> <diagram.relationships.json> [--source-root <project>]');process.exit(2);
}
try {
  const canvasFile=path.resolve(canvasArg),file=path.resolve(inventoryArg),vault=locateVault(canvasFile),job=vault&&readJob(vault);
  if (!job || path.resolve(vault,job.canvas)!==canvasFile) throw new Error('Start a job for this canvas before recording its relationship audit.');
  if(job.mode==='presentation') throw new Error('This is a presentation-only job. Start a content job to audit or change relationships.');
  const root=path.resolve(args[1]??path.dirname(vault));
  const canvas=JSON.parse(fs.readFileSync(canvasFile,'utf8').replace(/^\uFEFF/,''));
  const audit=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  if(audit.mode !== (job.mode ?? 'code')) throw new Error('Inventory mode must match the job: code requires source evidence; use start --design only for an explicitly proposed design.');
  const {problems,snapshots}=validateAudit(canvas,audit,root);
  if(problems.length) throw new Error(problems.map(p=>`- ${p}`).join('\n'));
  updateJob(vault,{relationshipAudit:{at:new Date().toISOString(),file:path.relative(vault,file),sourceRoot:path.relative(vault,root),inventoryHash:sourceHash(file),graphHash:relationshipHash(canvas),sources:snapshots,mode:audit.mode}});
  console.log(`Recorded ${audit.mode === 'code' ? 'source-backed' : 'proposed-design'} relationship inventory. Source references and coverage validated; semantic completeness still requires honest code review.`);
} catch(error) {console.error(error.message);process.exitCode=1;}
