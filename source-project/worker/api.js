import '../dist/domain-schema.js';
import '../dist/record-protocol.js';
import {recordsApi,recordSnapshot} from './records.js';
const ALLOWED=new Set(DomainSchema.KEYS);
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function api(request,env){
 if(!env.DB)return json({error:'Хранилище ещё не подключено'},503);
 const url=new URL(request.url);
 try{
 if(url.pathname==='/api/records')return await recordsApi(request,env,json);
 if(url.pathname==='/api/health')return json({storage:true,revision:(await env.DB.prepare('SELECT rev FROM app_state WHERE id = 1').first())?.rev||0});
 if(request.method==='GET'&&url.pathname==='/api/state'){if(await env.DB.prepare('SELECT migrated FROM record_meta WHERE id=1').first())return json(await recordSnapshot(env));const row=await env.DB.prepare('SELECT payload,rev,updated_at FROM app_state WHERE id = 1').first();return json({revision:row?.rev||0,updatedAt:row?.updated_at||null,data:row?JSON.parse(row.payload):{}})}
 if(request.method==='GET'&&url.pathname==='/api/backups'){const rows=await env.DB.prepare('SELECT backup_day,rev,updated_at FROM app_backups ORDER BY rev DESC LIMIT 100').all();return json({backups:rows.results})}
 if(request.method==='GET'&&/^\/api\/backups\/\d+$/.test(url.pathname)){const row=await env.DB.prepare('SELECT payload,rev,updated_at FROM app_backups WHERE rev = ?').bind(+url.pathname.split('/').at(-1)).first();return row?json({revision:row.rev,updatedAt:row.updated_at,data:JSON.parse(row.payload)}):json({error:'Копия не найдена'},404)}
 if(request.method!=='PUT'||url.pathname!=='/api/state')return json({error:'Маршрут не найден'},404);
 // Hosted access remains owner-private and is enforced by Sites dispatch. No CORS permission is granted.
 if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Запрос должен поступить из приложения'},403);
 if(+(request.headers.get('content-length')||0)>1500000)return json({error:'Превышен размер базы 1,5 МБ; сохраните архив и уменьшите объём'},413);
 const text=await request.text();if(new TextEncoder().encode(text).length>1500000)return json({error:'Превышен размер базы 1,5 МБ'},413);
 const body=JSON.parse(text);if(!Number.isInteger(body.revision)||body.revision<0||!body.data||typeof body.data!=='object'||Array.isArray(body.data)||Object.keys(body.data).some(k=>!ALLOWED.has(k)||typeof body.data[k]!=='string'))return json({error:'Некорректный формат базы'},400);
 try{DomainSchema.dataset(body.data)}catch(e){return json({error:e.message},400)}
 if(await env.DB.prepare('SELECT migrated FROM record_meta WHERE id=1').first())return json({error:'База переведена на сохранение отдельных записей. Обновите приложение.'},409);
 const payload=JSON.stringify(body.data),now=new Date().toISOString();
 const result=await env.DB.batch([
 env.DB.prepare("INSERT OR IGNORE INTO app_backups (backup_day,rev,payload,updated_at) SELECT date('now','+10 hours'),rev,payload,updated_at FROM app_state WHERE id = 1 AND rev = ?").bind(body.revision),
 env.DB.prepare('INSERT INTO app_state (id,payload,rev,updated_at) SELECT 1,?,1,? WHERE ? = 0 OR EXISTS (SELECT 1 FROM app_state WHERE id = 1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,rev=app_state.rev+1,updated_at=excluded.updated_at WHERE app_state.rev = ? RETURNING rev').bind(payload,now,body.revision,body.revision)
 ]);
 const rev=result[1]?.results?.[0]?.rev;if(!rev)return json({error:'База изменилась на другом устройстве. Загрузите изменения перед сохранением.'},409);
 return json({revision:rev,updatedAt:now});
 }catch{return json({error:'Не удалось обработать базу. Локальные данные сохранены.'},500)}
}
