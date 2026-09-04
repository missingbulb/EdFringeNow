// Turns a standalone HTML screen (all CSS in <style> tags in <head>, body markup) into a
// Design Component artboard: <head> styles + font links go into <helmet>, body inner HTML
// becomes the component. Usage: node to-artboard.mjs <in.html> <out.dc.html>
import { readFileSync, writeFileSync } from 'node:fs';
const [,, inPath, outPath] = process.argv;
const src = readFileSync(inPath, 'utf8');
const head = (src.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [,''])[1];
const links = [...head.matchAll(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi)].map(m => m[0].replace(/\s*\/>$/, '>'));
const styles = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [,''])[1];
if (/<script/i.test(body) || /<script/i.test(head)) console.error(`warning: ${inPath} carries a <script>; artboards are static — it was dropped`);
const cleanBody = body.replace(/<script[\s\S]*?<\/script>/gi, '');
const out = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${links.map(l => '  ' + l).join('\n')}
  <style>
${styles}
  </style>
</helmet>
${cleanBody.trim()}
</x-dc>
</body>
</html>
`;
writeFileSync(outPath, out);
console.log(`artboard ${outPath} (${(out.length/1024).toFixed(0)} KB)`);
