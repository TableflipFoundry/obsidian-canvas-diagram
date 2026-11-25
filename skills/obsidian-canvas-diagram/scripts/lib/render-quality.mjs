// Crossings can be legitimate. Obscured content and missing drawings require a fix or an explicit limitation.
export function renderProblems(quality) {
  const names = { throughNode: 'arrows through cards', overlap: 'overlapping arrows', labelOnNode: 'labels on cards',
    labelOnLabel: 'overlapping labels', labelOnEdge: 'labels obscured by another arrow', missingNote: 'missing notes', looseArrow: 'detached arrows' };
  return Object.entries(names).filter(([key]) => quality?.issues?.[key]?.length)
    .map(([key, name]) => ({ id: `render:${key}`, msg: `${quality.issues[key].length} ${name}. Fix and verify the layout, or record the actual limitation with job.mjs skip for this check ID after the permitted review rounds.` }));
}

export function reviewEvidenceProblems(job,hash,edgeCount) {
  if((job.reviewVersion??0)<3||edgeCount<=1)return[];
  if(!job.closeups?.count||job.closeups.hash!==hash)return[{id:'closeup-review',msg:'No readable section screenshots for the current diagram. Run closeups.mjs <canvas> <review-folder>, inspect every section, and record the relationship review.'}];
  if(!job.review||Date.parse(job.review.at)<Date.parse(job.closeups.at))return[{id:'closeup-review',msg:'Record the visual review after inspecting all current closeup screenshots.'}];
  return[];
}
