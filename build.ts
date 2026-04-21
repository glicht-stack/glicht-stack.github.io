import fs from 'fs';

let finalHtml = '';
for (let i = 1; i <= 8; i++) {
  const code = fs.readFileSync(`part${i}.js`, 'utf-8');
  const match = code.match(/const part\d = `([\s\S]*)`;\nfs/);
  if (match) {
    finalHtml += match[1];
  } else {
    // If there's an issue with the regex, just strip the js part manually
    let content = code.split(/const part\d = `/)[1];
    content = content.substring(0, content.lastIndexOf(`\`;\nfs`));
    finalHtml += content;
  }
}

fs.writeFileSync('index.html', finalHtml);
console.log('Successfully combined index.html');
