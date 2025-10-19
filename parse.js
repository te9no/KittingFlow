const fs = require('fs');
const code = fs.readFileSync('src/webapp.js','utf8');
new Function(code);
console.log('parse ok');
