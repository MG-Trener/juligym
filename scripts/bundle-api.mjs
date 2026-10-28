import {build} from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts/api-bundle',{recursive:true});
await build({entryPoints:['api/index.mjs'],outfile:'artifacts/api-bundle/index.mjs',platform:'node',target:'node24',format:'esm',bundle:true,banner:{js:"import{createRequire as ___cr}from'node:module';import{fileURLToPath as ___f}from'node:url';import{dirname as ___d}from'node:path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);"}});
console.log('Bundled Neon API');
