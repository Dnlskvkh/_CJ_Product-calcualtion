// Sites enforces owner-private access before requests reach this Worker.
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return api(request,env);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const file=path==='/'?'/index.html':path,body=ASSETS[file];
  if(body===undefined)return new Response('Not found',{status:404});
  const type=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.ttf')?'font/ttf':file.endsWith('.woff2')?'font/woff2':file.endsWith('.txt')?'text/plain':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.json')?'application/json':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
  const bytes=/\.(png|woff2|ttf)$/.test(file)?Uint8Array.from(atob(body),c=>c.charCodeAt(0)):body;
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':type+((type==='image/png'||type==='font/woff2'||type==='font/ttf')?'':'; charset=utf-8'),'cache-control':file==='/sw.js'?'private, no-store':'private, no-cache','x-content-type-options':'nosniff','x-izdelie-build':PWA_VERSION,...(file==='/sw.js'?{'service-worker-allowed':'/'}:{})}});
 }
};
