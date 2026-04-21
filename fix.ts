import fs from 'fs';
let content = fs.readFileSync('index.html', 'utf-8');
content = content.replace(/\\\\B/g, '\\B');
content = content.replace(/\\\\d/g, '\\d');
content = content.replace(/\\\\s/g, '\\s');
fs.writeFileSync('index.html', content);
