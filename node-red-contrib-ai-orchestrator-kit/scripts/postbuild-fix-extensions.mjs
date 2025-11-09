import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');

function walkAndRename(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndRename(p);
    } else if (entry.isFile() && p.endsWith('.js')) {
      const newPath = p.replace(/\.js$/, '.cjs');
      fs.renameSync(p, newPath);
    }
  }
}

function fixRequires(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixRequires(p);
    } else if (entry.isFile() && p.endsWith('.cjs')) {
      const src = fs.readFileSync(p, 'utf8');
      const out = src.replace(
        /require\((['"])(\.{1,2}\/[^'"]*)\1\)/g,
        (m, q, spec) => {
          if (spec.endsWith('.js') || spec.endsWith('.cjs') || spec.endsWith('.json') || spec.endsWith('.node')) {
            return m;
          }
          return `require(${q}${spec}.cjs${q})`;
        },
      );
      if (out !== src) fs.writeFileSync(p, out, 'utf8');
    }
  }
}

if (fs.existsSync(dist)) {
  walkAndRename(dist);
  fixRequires(dist);
}
