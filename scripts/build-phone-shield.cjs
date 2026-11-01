const fs=require('node:fs'),path=require('node:path');
const {build}=require('../apps/tutoring/node_modules/esbuild');
const root=path.resolve(__dirname,'..'),output=path.join(root,'apps/web/src/utils/phoneShieldBundle.js');
(async()=>{
 const result=await build({absWorkingDir:root,stdin:{contents:"export {AkedlyShield,getTurnstileToken} from './apps/tutoring/node_modules/@akedly/shield/dist/akedly-shield.esm.js';",resolveDir:root},bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,write:false,outfile:output,banner:{js:'/*! @akedly/shield 1.1.0 — MIT — https://www.npmjs.com/package/@akedly/shield */'}});
 const bytes=result.outputFiles[0].contents;
 if(process.argv.includes('--check')){if(!fs.existsSync(output)||!Buffer.from(bytes).equals(fs.readFileSync(output)))throw Error('Phone shield is stale; run node scripts/build-phone-shield.cjs');}else fs.writeFileSync(output,bytes);
 console.log(JSON.stringify({phoneShieldBytes:bytes.length,checked:process.argv.includes('--check')}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
