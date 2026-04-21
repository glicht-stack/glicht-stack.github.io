import fs from 'fs';
let content = fs.readFileSync('index.html', 'utf-8');
content = content.replace(/\\\\n/g, '\\n');
fs.writeFileSync('index.html', content);
