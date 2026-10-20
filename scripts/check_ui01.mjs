import fs from 'fs';
import path from 'path';

const componentsDir = 'apps/web/src/components';
const appJsPath = 'apps/web/src/app.js';
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.js'));

const allCodeContent = [
  appJsContent,
  ...componentFiles.map(f => fs.readFileSync(path.join(componentsDir, f), 'utf8'))
].join('\n');

const onclickRegex = /onclick=["'](?:window\.)?centrlyApp\.([a-zA-Z0-9_]+)\(/g;
const missingMethods = new Set();

for (const file of componentFiles) {
  const filePath = path.join(componentsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  let match;
  while ((match = onclickRegex.exec(content)) !== null) {
    const methodName = match[1];
    const inAppClass = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(`).test(appJsContent);
    const inModules = new RegExp(`app\\.${methodName}\\s*=`).test(allCodeContent);
    if (!inAppClass && !inModules) {
      missingMethods.add(`${file}: ${methodName}`);
    }
  }
}

console.log('Missing methods count:', missingMethods.size);
if (missingMethods.size > 0) {
  console.log(Array.from(missingMethods));
}
