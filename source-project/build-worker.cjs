const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
try {
  execFileSync(process.execPath,[path.join(__dirname,'build-react.cjs')],{stdio:'inherit'});
} catch (error) {
  // shortcut: offline build reuses the existing graph bundle; rebuild it when React sources change.
  if (!fs.existsSync(path.join(__dirname,'dist/graph-react.js'))) throw error;
  console.warn('Skipping React Flow rebuild: esbuild is unavailable; using existing dist/graph-react.js.');
}
require('./build-rates.cjs');
require('./build-brand.cjs');
fs.writeFileSync(path.join(__dirname,'dist/model-spec-prompt.json'),JSON.stringify({text:fs.readFileSync(path.join(__dirname,'SKETCHUP_SPEC_PROMPT.txt'),'utf8')}));
const pwa=require('./build-pwa.cjs');
const project=__dirname,dist=path.join(project,'dist');
const assets=Object.fromEntries(fs.readdirSync(dist).filter(f=>/\.(js|css|html|json|webmanifest|png|woff2|ttf|txt|svg)$/.test(f)).map(f=>['/'+f,fs.readFileSync(path.join(dist,f),/\.(png|woff2|ttf)$/.test(f)?'base64':'utf8')]));
const shared=['material-core.js','material-grouping-core.js','production-model-core.js','model-spec-core.js','process-graph-core.js','domain-schema.js','record-protocol.js'].map(f=>fs.readFileSync(path.join(dist,f),'utf8')).join('\n');
const records=fs.readFileSync(path.join(project,'worker/records.js'),'utf8').replace('export async function recordsApi','async function recordsApi').replace('export {recordSnapshot};','');
const api=fs.readFileSync(path.join(project,'worker/api.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function api','async function api');
const worker=fs.readFileSync(path.join(project,'worker/index.js'),'utf8');
fs.mkdirSync(path.join(dist,'server'),{recursive:true});fs.mkdirSync(path.join(dist,'.openai'),{recursive:true});
fs.writeFileSync(path.join(dist,'server/index.js'),'const PWA_VERSION='+JSON.stringify(pwa.version)+';\nconst ASSETS='+JSON.stringify(assets)+';\n'+shared+'\n'+records+'\n'+api+'\n'+worker);
fs.copyFileSync(path.join(project,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));
fs.cpSync(path.join(project,'drizzle'),path.join(dist,'.openai/drizzle'),{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets and D1 migrations.');
