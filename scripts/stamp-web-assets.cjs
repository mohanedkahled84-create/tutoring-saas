// Give the complete module graph one release key. A fresh app shell alone
// does not invalidate cached imports (including unversioned grandchildren).
const fs=require('node:fs'),path=require('node:path');
const moduleImports=/((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"]))(\.{1,2}\/[^'"\s?]+\.js)(?:\?[^'"]*)?(\2)/g;
function stampModules(source,version){return source.replace(moduleImports,(_match,prefix,_quote,file,end)=>prefix+file+'?v='+version+end);}
function run(version){
 if(!/^\d+\.\d+\.\d+$/.test(version || ''))throw Error('Pass a release version, e.g. 9.40.0');
 const root=path.resolve(__dirname,'../apps/web'),generated=new Set(['parentPortalEntry.js','studentPortalEntry.js','phoneShieldBundle.js']);let changed=0;
 function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){if(dir===root && entry.name!=='src')continue;visit(file);continue;}
  if(!/\.(js|html)$/.test(entry.name)||generated.has(entry.name))continue;
  const original=fs.readFileSync(file,'utf8');let next=stampModules(original,version);
  if(entry.name.endsWith('.html'))next=next.replace(/((?:src|href)\s*=\s*['"])((?:\.?\.?\/)?src\/[^'"?]+\.(?:js|css))(?:\?[^'"]*)?(['"])/g,(_m,prefix,url,end)=>prefix+url+'?v='+version+end);
  if(next!==original){fs.writeFileSync(file,next);changed++;}
 }}visit(root);console.log(JSON.stringify({release:version,changedFiles:changed}));
}
module.exports={stampModules};
if(require.main===module)run(process.argv[2]);
