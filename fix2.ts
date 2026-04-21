import fs from 'fs';
let content = fs.readFileSync('index.html', 'utf-8');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\`/g, '\`');
fs.writeFileSync('index.html', content);
