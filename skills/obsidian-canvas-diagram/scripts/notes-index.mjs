// Usage: node notes-index.mjs <path/to/Diagrams> [search words...]
// Lists every existing note in the vault's nodes/ folder with its type, level,
// title and source file, so you can reuse notes instead of writing duplicates.
// With search words, only notes whose name, title or source contain any of them.
// Also lists which diagrams use each note. Records that the reuse check ran.
import fs from 'node:fs';
import path from 'node:path';
import { updateJob } from './lib/job.mjs';

const [vaultArg, ...words] = process.argv.slice(2);
if (!vaultArg) { console.error('usage: node notes-index.mjs <path/to/Diagrams> [search words...]'); process.exit(2); }
const vault = path.resolve(vaultArg);
const nodesDir = path.join(vault, 'nodes');
if (!fs.existsSync(nodesDir)) { console.log('No notes yet (nodes/ is empty or missing).'); updateJob(vault, { notesIndexAt: new Date().toISOString() }); process.exit(0); }

const front = text => {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^(\w+):\s*(.*)$/); if (kv) out[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim(); }
  return out;
};

// which canvases use which note
const usedBy = new Map();
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.canvas')) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
        for (const n of c.nodes ?? []) if (n.file) {
          const k = n.file.replace(/\\/g, '/');
          usedBy.set(k, [...(usedBy.get(k) ?? []), path.relative(vault, p).split(path.sep).join('/')]);
        }
      } catch {}
    }
  }
};
walk(vault);

const rows = fs.readdirSync(nodesDir).filter(f => f.endsWith('.md')).map(f => {
  const fm = front(fs.readFileSync(path.join(nodesDir, f), 'utf8'));
  return { name: f.replace(/\.md$/, ''), ...fm, usedBy: usedBy.get(`nodes/${f}`) ?? [] };
});
const needles = words.map(w => w.toLowerCase());
const shown = needles.length
  ? rows.filter(r => needles.some(w => [r.name, r.title, r.source].join(' ').toLowerCase().includes(w)))
  : rows;

console.log(`${shown.length} of ${rows.length} notes${needles.length ? ` matching: ${words.join(', ')}` : ''}\n`);
for (const r of shown.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`${r.name}  [${r.type ?? '?'}${r.level ? ', ' + r.level : ''}]  ${r.title ?? ''}`);
  if (r.source) console.log(`    source: ${r.source}`);
  if (r.usedBy.length) console.log(`    used in: ${r.usedBy.join(', ')}`);
}
console.log('\nReuse a note when its source file, or its title and type, match what you need (SKILL.md, "Reuse").');
console.log('If a new note is a PART of an existing bigger one (a table inside a database note), write a new note and link them both ways.');
updateJob(vault, { notesIndexAt: new Date().toISOString() });
