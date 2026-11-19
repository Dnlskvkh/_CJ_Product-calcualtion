const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const entry=path.join(__dirname,'react/graph.jsx');
const loaders={'.js':'js','.jsx':'jsx','.css':'css','.json':'json'};
const files={name:'node-file-resolver',setup(build){
 build.onResolve({filter:/.*/},args=>{
  if(args.kind==='entry-point')return {path:entry};
  if(args.path.startsWith('.'))return {path:path.resolve(args.resolveDir,args.path)};
  return {path:require.resolve(args.path,{paths:[args.resolveDir]})};
 });
 build.onLoad({filter:/.*/},args=>({contents:fs.readFileSync(args.path),loader:loaders[path.extname(args.path)]||'file',resolveDir:path.dirname(args.path)}));
}};
esbuild.build({entryPoints:[entry],bundle:true,format:'iife',platform:'browser',target:['es2020'],write:false,outfile:path.join(__dirname,'dist/graph-react.js'),minify:true,legalComments:'none',plugins:[files]}).then(result=>{
 for(const file of result.outputFiles)fs.writeFileSync(file.path,file.contents);
 console.log('Built React Flow graph module.');
}).catch(error=>{console.error(error);process.exitCode=1});
