const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');

async function startServer({root=__dirname,port=4189,dataDir=path.join(root,'data')}={}){
 fs.mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(path.join(dataDir,'calculator.sqlite'));
 db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS portable_migrations (name TEXT PRIMARY KEY)');
 try{
  for(const name of fs.readdirSync(path.join(root,'migrations')).filter(f=>f.endsWith('.sql')).sort()){
   if(db.prepare('SELECT name FROM portable_migrations WHERE name=?').get(name))continue;
   db.exec('BEGIN');
   try{db.exec(fs.readFileSync(path.join(root,'migrations',name),'utf8'));db.prepare('INSERT INTO portable_migrations(name) VALUES (?)').run(name);db.exec('COMMIT')}
   catch(e){db.exec('ROLLBACK');throw e}
  }
  const prepare=sql=>({args:[],bind(...args){this.args=args;return this},async first(){return db.prepare(sql).get(...this.args)||null},async all(){return {results:db.prepare(sql).all(...this.args)}},execute(){const statement=db.prepare(sql);return statement.columns().length?{results:statement.all(...this.args)}:{results:[],meta:statement.run(...this.args)}}});
  const env={DB:{prepare,async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}}};
  const worker=(await import(pathToFileURL(path.join(root,'app','worker.mjs')).href)).default;
  let origin;
  const server=http.createServer(async(req,res)=>{
   try{
    // The hosted Worker relies on Sites access control. This adapter is local only.
    if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end('Invalid host');return}
    if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Invalid origin');return}
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1500000){res.writeHead(413);res.end('Request too large');return}chunks.push(chunk)}
    const body=Buffer.concat(chunks);
    const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{}),duplex:'half'});
    const response=await worker.fetch(request,env,{});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch{if(!res.headersSent)res.writeHead(500);res.end('Local request failed')}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
  origin='http://127.0.0.1:'+server.address().port;
  server.on('close',()=>db.close());
  return {server,origin};
 }catch(e){db.close();throw e}
}

if(require.main===module)startServer().then(({server,origin})=>{
 console.log('Calculator: '+origin+'\nKeep this window open. Stop: Ctrl+C.\nSaved database: '+path.join(__dirname,'data','calculator.sqlite'));
 if(!process.argv.includes('--no-open')){
  const child=spawn('cmd.exe',['/d','/c','start','',origin],{stdio:'ignore',windowsHide:true});
  child.on('error',()=>console.log('Open the address above in Chrome or Edge.'));
 }
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeAllConnections()});
}).catch(e=>{console.error(e.code==='EADDRINUSE'?'Port 4189 is already in use. Close the previous calculator window and try again.':'Cannot start calculator: '+e.message);process.exitCode=1});
module.exports={startServer};
