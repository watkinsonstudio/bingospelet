// Bygger en sida utan <html>/<head>/<body> för publicering som Claude-artifact
// (plattformen lägger själv på dokumentskalet). Övriga filer publiceras bredvid.
//   node tools/build-artifact.mjs <utfil>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] || root + 'dist/artifact.html';
const html = readFileSync(root + 'index.html', 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const keep = head
  .split('\n')
  .filter((l) => !/<meta charset|<meta name="viewport"/.test(l))
  .join('\n');
writeFileSync(out, keep.trim() + '\n' + body.trim() + '\n');
console.log('skrev', out);
