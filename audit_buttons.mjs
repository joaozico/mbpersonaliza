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
const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Match all <button tags
  const btnRegex = /<button\b([^>]*?)>/gs;
  let match;
  while ((match = btnRegex.exec(content)) !== null) {
    const attrs = match[1];
    const hasOnClick = /onClick\s*=/.test(attrs);
    const isSubmit = /type\s*=\s*['"]submit['"]/.test(attrs);
    const lineNum = content.substring(0, match.index).split('\n').length;

    if (!hasOnClick && !isSubmit) {
      issues.push({
        file,
        line: lineNum,
        text: match[0].replace(/\s+/g, ' ').substring(0, 100),
        reason: 'no onClick and not type=submit'
      });
    }
  }

  // Match href="#" or empty href
  const hrefRegex = /href\s*=\s*['"](#|javascript:void\(0\);?)?['"]/g;
  while ((match = hrefRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    issues.push({
      file,
      line: lineNum,
      text: match[0],
      reason: 'href is empty or #'
    });
  }
});

console.log(`Found ${issues.length} potential button/link issues:`);
issues.forEach(i => console.log(`${i.file}:${i.line} - [${i.reason}] ${i.text}`));
