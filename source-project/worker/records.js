async function initializeRecords(env){
 if(await env.DB.prepare('SELECT migrated FROM record_meta WHERE id = 1').first())return;
 const legacy=await env.DB.prepare('SELECT payload,rev,updated_at FROM app_state WHERE id = 1').first(),data=legacy?JSON.parse(legacy.payload):{};
 DomainSchema.dataset(data);const records=Object.values(RecordProtocol.flatten(data));
 const statements=records.map(r=>env.DB.prepare('INSERT OR IGNORE INTO entity_records (collection,entity_id,payload,rev,updated_at) VALUES (?,?,?,1,?)').bind(r.collection,r.id,JSON.stringify(r.value),legacy?.updated_at||new Date().toISOString()));
 statements.push(env.DB.prepare('INSERT OR IGNORE INTO record_meta (id,migrated) VALUES (1,1)'));await env.DB.batch(statements);
}
async function recordSnapshot(env){const rows=await env.DB.prepare('SELECT collection,entity_id,payload,rev,updated_at FROM entity_records ORDER BY collection,entity_id').all();const records=rows.results.map(r=>({collection:r.collection,id:r.entity_id,value:JSON.parse(r.payload),revision:r.rev})),state=await env.DB.prepare('SELECT rev,updated_at FROM app_state WHERE id = 1').first();return {data:RecordProtocol.expand(records),versions:Object.fromEntries(records.map(r=>[RecordProtocol.key(r.collection,r.id),r.revision])),revision:state?.rev||0,updatedAt:state?.updated_at||null}}
export async function recordsApi(request,env,json){
 await initializeRecords(env);
 if(request.method==='GET')return json(await recordSnapshot(env));
 if(request.method!=='PUT')return json({error:'Метод не поддерживается'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Запрос должен поступить из приложения'},403);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>1500000)return json({error:'Изменение превышает 1,5 МБ'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'Некорректный JSON'},400)}
 if(!Array.isArray(body.changes)||body.changes.length>25)return json({error:'Не более 25 записей за одну операцию'},400);
 const keys=new Set();for(const r of body.changes){if(!r||typeof r!=='object')return json({error:'Некорректная запись'},400);const k=RecordProtocol.key(r.collection,r.id);if(!DomainSchema.KEYS.includes(r.collection)||typeof r.id!=='string'||r.id.length>200||!Number.isInteger(r.expectedRevision)||r.expectedRevision<0||!Object.hasOwn(r,'value')||keys.has(k))return json({error:'Некорректное изменение записи'},400);keys.add(k)}
 if(!body.changes.length)return json(await recordSnapshot(env));
 // The guard and every mutation execute in a single D1 transaction. A failed
 // per-record revision check aborts the whole batch, including daily backups.
 for(let attempt=0;attempt<3;attempt++){
 const before=await recordSnapshot(env),flat=RecordProtocol.flatten(before.data);
 for(const r of body.changes){if((before.versions[RecordProtocol.key(r.collection,r.id)]||0)!==r.expectedRevision)return json({error:'Изменены те же записи на другом устройстве',conflicts:body.changes.filter(x=>(before.versions[RecordProtocol.key(x.collection,x.id)]||0)!==x.expectedRevision).map(x=>({collection:x.collection,id:x.id}))},409);flat[RecordProtocol.key(r.collection,r.id)]=r}
 const data=RecordProtocol.expand(Object.values(flat));try{DomainSchema.dataset(data)}catch(e){return json({error:e.message},400)}
 const now=new Date().toISOString(),condition=body.changes.map(()=>'(COALESCE((SELECT rev FROM entity_records WHERE collection=? AND entity_id=?),0)=?)').join(' AND '),params=body.changes.flatMap(r=>[r.collection,r.id,r.expectedRevision]);
 const statements=[env.DB.prepare('INSERT INTO record_write_guard (id,ok) SELECT 1,CASE WHEN COALESCE((SELECT rev FROM app_state WHERE id=1),0)=? AND '+condition+' THEN 1 ELSE 0 END').bind(before.revision,...params),env.DB.prepare("INSERT OR IGNORE INTO app_backups (backup_day,rev,payload,updated_at) SELECT date('now','+10 hours'),?,?,? WHERE ?>0").bind(before.revision,JSON.stringify(before.data),before.updatedAt||now,before.revision)];
 for(const r of body.changes)statements.push(env.DB.prepare('INSERT INTO entity_records (collection,entity_id,payload,rev,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(collection,entity_id) DO UPDATE SET payload=excluded.payload,rev=entity_records.rev+1,updated_at=excluded.updated_at').bind(r.collection,r.id,JSON.stringify(r.value),now));
 statements.push(env.DB.prepare("INSERT INTO app_state (id,payload,rev,updated_at) VALUES (1,'{}',1,?) ON CONFLICT(id) DO UPDATE SET rev=app_state.rev+1,updated_at=excluded.updated_at").bind(now),env.DB.prepare('DELETE FROM record_write_guard WHERE id=1'));
 try{await env.DB.batch(statements);return json({revision:before.revision+1,updatedAt:now,versions:Object.fromEntries(body.changes.map(r=>[RecordProtocol.key(r.collection,r.id),r.expectedRevision+1]))})}catch(e){if(attempt===2)throw e}
 }
}
export {recordSnapshot};
