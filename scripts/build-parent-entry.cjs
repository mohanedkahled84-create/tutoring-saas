const fs=require('node:fs'),path=require('node:path');
const {build}=require('../apps/tutoring/node_modules/esbuild');
const root=path.resolve(__dirname,'..'),output=path.join(root,'apps/web/src/parentPortalEntry.js');
(async()=>{
 const result=await build({absWorkingDir:root,entryPoints:['apps/web/src/portalBootstrap.js'],bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,charset:'utf8',legalComments:'none',external:['./app.js*'],write:false,outfile:output,metafile:true});
 const bytes=result.outputFiles[0].contents;
 if(Object.keys(result.metafile.inputs).some(p=>/\/(?:app|workspace)\.js$|UnifiedPortalLoginView/.test(p)))throw Error('Parent entry must not include staff/student SPA');
 if(process.argv.includes('--check')){
  if(!fs.existsSync(output)||!Buffer.from(bytes).equals(fs.readFileSync(output)))throw Error('Parent entry is stale; run npm run build:parent-entry in apps/tutoring');
 }else fs.writeFileSync(output,bytes);
 console.log(JSON.stringify({parentEntryBytes:bytes.length,moduleInputs:Object.keys(result.metafile.inputs).length,checked:process.argv.includes('--check')}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
