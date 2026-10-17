import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('src');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('onClick')) {
      if (
        line.includes('console.log') ||
        line.includes('void 0') ||
        line.includes('undefined') ||
        line.includes('TODO') ||
        line.includes('() => {}') ||
        line.includes('()=>{}') ||
        line.includes('() => null')
      ) {
        console.log(`${file}:${idx + 1}: ${line.trim()}`);
      }
    }
  });
});
