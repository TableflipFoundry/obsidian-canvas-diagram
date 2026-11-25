import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node scripts/install.mjs <vault-root>');
const vault = path.resolve(process.argv[2]);
if (!(await stat(path.join(vault, '.obsidian'))).isDirectory()) throw new Error('Destination must be an existing Obsidian vault');
const target = path.join(vault, '.obsidian/plugins/canvas-io');
await mkdir(target, { recursive: true });
for (const [source, destination] of [['dist/main.js', 'main.js'], ['manifest.json', 'manifest.json'], ['styles.css', 'styles.css']]) {
  await copyFile(source, path.join(target, destination));
}
console.log(`Installed Canvas IO files in ${target}. Enable Canvas IO in Obsidian's community plugins.`);
