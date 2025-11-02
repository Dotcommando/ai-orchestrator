import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.isFile() && p.endsWith('.js')) {
      fs.renameSync(p, p.replace(/\.js$/, '.cjs'));
    }
  }
}
walk(dist);
