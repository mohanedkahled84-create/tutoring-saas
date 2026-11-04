const fs=require('node:fs'),path=require('node:path');
const {build}=require('../apps/tutoring/node_modules/esbuild');
const root=path.resolve(__dirname,'..'),output=path.join(root,'apps/web/src/studentPortalEntry.js');
(async()=>{
 const result=await build({absWorkingDir:root,entryPoints:['apps/web/src/studentPortal.js'],bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,charset:'utf8',legalComments:'none',write:false,outfile:output,metafile:true});
 const bytes=result.outputFiles[0].contents;
 if(Object.keys(result.metafile.inputs).some(p=>/\/(?:app|workspace|auth|AuthScreens|LandingView|logoBase64)\.js$/.test(p.split('?')[0])))throw Error('Student entry must not initialize teacher authentication or landing');
 if(bytes.length>220000)throw Error('Student entry exceeded its download budget');
 if(process.argv.includes('--check')){
  if(!fs.existsSync(output)||!Buffer.from(bytes).equals(fs.readFileSync(output)))throw Error('Student entry is stale; run node scripts/build-student-entry.cjs');
 }else fs.writeFileSync(output,bytes);
 console.log(JSON.stringify({studentEntryBytes:bytes.length,moduleInputs:Object.keys(result.metafile.inputs).length,checked:process.argv.includes('--check')}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
