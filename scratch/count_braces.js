import fs from 'fs';
const content = fs.readFileSync('/home/sankar/Desktop/auotinn-migrate-be/autoinn-migrate/src/controllers/sparesInventory.js', 'utf8');
let level = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
        if (char === '{') level++;
        if (char === '}') level--;
    }
    console.log(`${i + 1}: ${level} | ${line}`);
}
