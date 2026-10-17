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

  // Look for buttons that might have empty or no-op handlers
  const btnRegex = /<button\b([^>]*?)>(.*?)<\/button>/gs;
  let match;
  while ((match = btnRegex.exec(content)) !== null) {
    const attrs = match[1];
    const inner = match[2].trim().replace(/\s+/g, ' ');
    const lineNum = content.substring(0, match.index).split('\n').length;

    // Check if button text mentions action but no onClick and not submit
    if (!attrs.includes('onClick') && !attrs.includes('type="submit"') && !attrs.includes('type=\'submit\'')) {
      console.log(`[NO_ACTION] ${file}:${lineNum} - Button "${inner.substring(0, 40)}" has no onClick or submit`);
    }

    // Check if onClick has empty body
    const onClickMatch = attrs.match(/onClick=\{([^}]+)\}/);
    if (onClickMatch) {
      const handler = onClickMatch[1].trim();
      if (
        handler === '() => {}' ||
        handler === '()=>{}' ||
        handler === '() => null' ||
        handler === '() => undefined'
      ) {
        console.log(`[EMPTY_HANDLER] ${file}:${lineNum} - Button "${inner.substring(0, 40)}" has empty onClick`);
      }
    }
  }
});
