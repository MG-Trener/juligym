import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {randomUUID} from 'node:crypto';
import {InputError,dateValue,planValue,scheduleValue,dayEdit,editDayItems,daySettings,editDaySettings,progress} from './model.mjs';
import {passwordMatches,issueAccess,validAccess} from './access.mjs';
import {separateSides,advanceStretch,sessionResult} from '../src/session-progress.js';
import {stretchById} from '../src/stretch-catalog.js';
import {doseValue} from '../src/day-settings.js';
import {dayMove,dayRestore,checkDayVersion,removedExercise,editDayLayout} from './day-layout.mjs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:10000,idleTimeoutMillis:20000});
attachDatabasePool(pool);pool.on('error',()=>console.error('Database pool error'));
const allowed=new Set(['https://juligym.mg-trener.com','https://mg-trener.github.io','http://127.0.0.1:4173','http://localhost:4173']);
const rates=new Map();
let failedLogins=0,loginWindow=Date.now();
async function readJson(request,max=24000){
 if(Number(request.headers.get('content-length')||0)>max)throw new InputError('Запрос слишком большой.',413);
 const reader=request.body?.getReader(),chunks=[];let size=0;
 if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new InputError('Запрос слишком большой.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new InputError('Некорректный JSON.');}
}
function serialize(row){return {...row,workout_date:typeof row.workout_date==='string'?row.workout_date:row.workout_date?.toISOString().slice(0,10)};}
async function transaction(run){const c=await pool.connect();try{await c.query('BEGIN');const result=await run(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function ensureSession(c,date,planId){
 const existing=(await c.query('SELECT * FROM juli_sessions WHERE workout_date=$1 AND plan_id=$2 FOR UPDATE',[date,planId])).rows[0];
 if(existing)return existing;
 const plan=(await c.query('SELECT * FROM juli_plans WHERE id=$1',[planId])).rows[0];if(!plan)throw new InputError('Комплекс не найден.',404);
 if(!plan.items.length&&!plan.stretch_ids.length)throw new InputError('Сначала добавьте упражнения.');
 await c.query('INSERT INTO juli_sessions(id,workout_date,plan_id,title,items,stretch_ids,stretch_settings) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workout_date,plan_id) DO NOTHING',[randomUUID(),date,planId,plan.title,JSON.stringify(plan.items.map(item=>({...item,sideMode:separateSides(item)?'separate':'together'}))),JSON.stringify(plan.stretch_ids),JSON.stringify(plan.stretch_settings)]);
 return (await c.query('SELECT * FROM juli_sessions WHERE workout_date=$1 AND plan_id=$2 FOR UPDATE',[date,planId])).rows[0];
}
async function changeDay(c,edit){
 const schedule=(await c.query('SELECT * FROM juli_schedule WHERE id=1 FOR UPDATE')).rows[0];
 const assigned=schedule.weekdays[edit.weekday];
 const baseId=assigned||(edit.kind==='restore'?edit.id:null);
 const base=baseId?(await c.query('SELECT * FROM juli_plans WHERE id=$1 FOR UPDATE',[baseId])).rows[0]:null;
 if(edit.kind)checkDayVersion(base,assigned,edit);
 const next=edit.kind?editDayLayout(base,edit):edit.field?editDaySettings(base,edit):editDayItems(base,edit);
 if(!next)return {plan:base,schedule};
 const plan=(await c.query(`INSERT INTO juli_plans(id,title,subtitle,items,stretch_ids,stretch_settings) VALUES($1,$2,'Мой план недели',$3,$4,$5)
  ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,items=EXCLUDED.items,stretch_ids=EXCLUDED.stretch_ids,stretch_settings=EXCLUDED.stretch_settings,revision=juli_plans.revision+1,updated_at=now() RETURNING *`,
 [edit.id,base?.title||edit.title,JSON.stringify(next.items),JSON.stringify(next.stretchIds),JSON.stringify(next.stretchSettings)])).rows[0];
 const weekdays={...schedule.weekdays};
 if(next.items.length||next.stretchIds.length)weekdays[edit.weekday]=edit.id;
 else delete weekdays[edit.weekday];
 const undo=!edit.kind&&!edit.field&&!edit.added?removedExercise(base,edit,plan):undefined;
 if(weekdays[edit.weekday]===assigned)return {plan,schedule,undo};
 const changed=(await c.query('UPDATE juli_schedule SET weekdays=$1,revision=revision+1 WHERE id=1 RETURNING *',[JSON.stringify(weekdays)])).rows[0];
 return {plan,schedule:changed,undo};
}
export default {async fetch(request){
 const url=new URL(request.url),origin=request.headers.get('origin');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin && allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin && !allowed.has(origin))return reply({error:'Источник запроса не разрешён.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'3600'}});
 try{
  const route=url.pathname.replace(/\/$/,'');
  if(route==='/health')return reply({ok:true,database:!!(await pool.query('SELECT 1 AS ok')).rows[0].ok});
  if(route==='/auth'&&request.method==='POST'){
   const now=Date.now();if(now-loginWindow>600000){failedLogins=0;loginWindow=now;}
   // Per-isolate failed-attempt budget; this is not an edge or account-wide quota.
   if(failedLogins>=60){headers['Retry-After']=String(Math.ceil((600000-(now-loginWindow))/1000));throw new InputError('Слишком много неверных попыток. Попробуйте позже.',429);}
   const body=await readJson(request,1024);
   if(!await passwordMatches(body?.password)){failedLogins++;throw new InputError('Неверный пароль. Попробуйте ещё раз.',401);}
   return reply(issueAccess(process.env.DATABASE_URL));
  }
  if(!validAccess(request.headers.get('authorization'),process.env.DATABASE_URL))throw new InputError('Введите пароль, чтобы открыть дневник.',401);
  if(request.method==='GET' && route==='/state'){
   const from=dateValue(url.searchParams.get('from')),to=dateValue(url.searchParams.get('to'));if(Date.parse(to)-Date.parse(from)>42*86400000 || from>to)throw new InputError('Период — не более 42 дней.');
   const [plans,schedule,sessions,history,active]=await Promise.all([pool.query("SELECT * FROM juli_plans ORDER BY CASE id WHEN 'legs' THEN 0 WHEN 'upper' THEN 1 WHEN 'core' THEN 2 ELSE 3 END,created_at,id"),pool.query('SELECT * FROM juli_schedule WHERE id=1'),pool.query('SELECT * FROM juli_sessions WHERE workout_date BETWEEN $1 AND $2 ORDER BY workout_date',[from,to]),pool.query('SELECT id,workout_date,plan_id,title,started_at,finished_at,duration_seconds,result_status,result_summary FROM juli_sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 200'),pool.query('SELECT id FROM juli_sessions WHERE finished_at IS NULL')]);
   return reply({plans:plans.rows,schedule:schedule.rows[0],sessions:sessions.rows.map(serialize),history:history.rows.map(serialize),activeSessionIds:active.rows.map(row=>row.id),serverTime:new Date().toISOString()});
  }
  if(request.method!=='POST')throw new InputError('Неизвестный адрес.',404);
  const body=await readJson(request);
  // Lightweight per-isolate mutation cap after the shared password check.
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'public',now=Date.now();let rate=rates.get(ip);if(!rate || now-rate.at>60000){rate={at:now,count:0};rates.set(ip,rate);}if(++rate.count>120)throw new InputError('Слишком много запросов. Попробуйте через минуту.',429);if(rates.size>2000)for(const [key,r] of rates)if(now-r.at>60000)rates.delete(key);
  if(route==='/plans'){
   const value=planValue(body),id=body.id || randomUUID();if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,50}$/.test(id))throw new InputError('Некорректный комплекс.');
   if(body.id){const r=await pool.query('UPDATE juli_plans SET title=$1,subtitle=$2,items=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND revision=$5 RETURNING *',[value.title,value.subtitle,JSON.stringify(value.items),id,body.revision]);if(!r.rowCount)throw new InputError('Комплекс уже изменён в другом окне. Обновите данные.',409);return reply({plan:r.rows[0]});}
   const count=Number((await pool.query("SELECT count(*) FROM juli_plans WHERE id !~ '^weekday-[0-6]$'")).rows[0].count);if(count>=30)throw new InputError('В дневнике уже 30 подборок. Отредактируйте существующую.');
   const r=await pool.query('INSERT INTO juli_plans(id,title,subtitle,items) VALUES($1,$2,$3,$4) RETURNING *',[id,value.title,value.subtitle,JSON.stringify(value.items)]);return reply({plan:r.rows[0]},201);
  }
  if(route==='/schedule'){
   const plans=(await pool.query('SELECT id FROM juli_plans')).rows.map(r=>r.id),weekdays=scheduleValue(body.weekdays,plans);const r=await pool.query('UPDATE juli_schedule SET weekdays=$1,revision=revision+1 WHERE id=1 AND revision=$2 RETURNING *',[JSON.stringify(weekdays),body.revision]);if(!r.rowCount)throw new InputError('Расписание изменено в другом окне. Обновите данные.',409);return reply({schedule:r.rows[0]});
  }
  if(['/day-exercise','/day-settings','/day-move','/day-restore'].includes(route)){
   const edit=route==='/day-move'?dayMove(body):route==='/day-restore'?dayRestore(body):route==='/day-settings'?daySettings(body):dayEdit(body);
   return reply(await transaction(c=>changeDay(c,edit)));
  }
  const date=dateValue(body.date);const currentDate=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qyzylorda'});if(date>currentDate)throw new InputError('Будущие дни доступны только для планирования.');if(!/^[a-zA-Z0-9-]{1,50}$/.test(body.planId||''))throw new InputError('Выберите комплекс.');
  if(['/restart','/discard'].includes(route))return reply(await transaction(async c=>{
   if(!/^[0-9a-f-]{36}$/i.test(body.sessionId||''))throw new InputError('Откройте занятие ещё раз.');
   if(route==='/restart'&&!/^[0-9a-f-]{36}$/i.test(body.opId||''))throw new InputError('Некорректная операция.');
   const current=(await c.query('SELECT * FROM juli_sessions WHERE workout_date=$1 AND plan_id=$2 FOR UPDATE',[date,body.planId])).rows[0];
   if(route==='/restart'){
    const replay=(await c.query('SELECT s.* FROM juli_operations o JOIN juli_sessions s ON s.id=o.session_id WHERE o.id=$1',[body.opId])).rows[0];
    if(replay){if(serialize(replay).workout_date!==date||replay.plan_id!==body.planId)throw new InputError('Некорректная операция.');return {session:serialize(replay),replacedSessionId:body.sessionId};}
   }
   if(!current&&route==='/discard')return {discardedSessionId:body.sessionId};
   if(!current||current.id!==body.sessionId||current.finished_at)throw new InputError('Занятие уже изменено. Обновите дневник.',409);
   if(route==='/discard'&&sessionResult(current).worked)throw new InputError('Есть выполненные упражнения. Сохраните частичный результат.');
   await c.query('DELETE FROM juli_operations WHERE session_id=$1',[current.id]);
   if(route==='/discard'){await c.query('DELETE FROM juli_sessions WHERE id=$1',[current.id]);return {discardedSessionId:current.id};}
   const next=(await c.query("UPDATE juli_sessions SET id=$2,marks='{}',stretch_state='{\"position\":0,\"marks\":{}}',stretch_revision=0,started_at=now(),duration_seconds=0,result_status=NULL,result_summary=NULL WHERE id=$1 RETURNING *",[current.id,randomUUID()])).rows[0];
   await c.query('INSERT INTO juli_operations(id,session_id) VALUES($1,$2)',[body.opId,next.id]);
   return {session:serialize(next),replacedSessionId:current.id};
  }));
  const result=await transaction(async c=>{
   if(route==='/stretch-start'){
    if(!/^stretch-[0-9a-f-]{36}$/i.test(body.planId)||typeof body.title!=='string'||body.title.trim().length<2||body.title.length>70||!Array.isArray(body.ids)||!body.ids.length||body.ids.length>20||new Set(body.ids).size!==body.ids.length||body.ids.some(id=>!Object.hasOwn(stretchById,id)))throw new InputError('Проверьте подборку растяжки.');
    const settings={};
    for(const id of body.ids)if(body.settings?.[id]){
     const field=stretchById[id].seconds?'seconds':'repetitions';
     try{settings[id]={[field]:doseValue(id,field,body.settings[id][field])};}catch(e){throw new InputError(e.message);}
    }
    await c.query('INSERT INTO juli_sessions(id,workout_date,plan_id,title,items,stretch_ids,stretch_settings) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workout_date,plan_id) DO NOTHING',[body.planId.slice(8),date,body.planId,body.title.trim(),'[]',JSON.stringify(body.ids),JSON.stringify(settings)]);
    return (await c.query('SELECT * FROM juli_sessions WHERE workout_date=$1 AND plan_id=$2',[date,body.planId])).rows[0];
   }
   if(route==='/start')return ensureSession(c,date,body.planId);
   const session=(await c.query('SELECT * FROM juli_sessions WHERE workout_date=$1 AND plan_id=$2 FOR UPDATE',[date,body.planId])).rows[0];
   if(!session||(body.sessionId&&body.sessionId!==session.id))throw new InputError('Занятие удалено или начато заново. Обновите дневник.',409);
   if(route==='/stretch-progress'){
    if(session.finished_at)throw new InputError('Занятие уже сохранено.',409);
    if(!['next','previous','skip'].includes(body.action)||!session.stretch_ids.length)throw new InputError('Некорректный шаг растяжки.');
    if(!/^[0-9a-f-]{36}$/i.test(body.opId||''))throw new InputError('Некорректная операция.');
    const inserted=await c.query('INSERT INTO juli_operations(id,session_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[body.opId,session.id]);
    if(!inserted.rowCount)return session;
    if(body.revision!==session.stretch_revision)throw new InputError('Растяжка изменена в другом окне. Откройте занятие заново, чтобы продолжить с сохранённого шага.',409);
    const next=advanceStretch(session.stretch_ids,session.stretch_state,body.action);
    return (await c.query('UPDATE juli_sessions SET stretch_state=$1,stretch_revision=stretch_revision+1 WHERE id=$2 RETURNING *',[JSON.stringify(next),session.id])).rows[0];
   }
   if(route==='/sets'){
    if(session.finished_at)throw new InputError('Завершённое занятие сохранено в истории.',409);
    const item=session.items.find(e=>e.id===body.exerciseId);if(!item||!Number.isInteger(body.setIndex)||body.setIndex<0||body.setIndex>=item.sets||typeof body.done!=='boolean'||!/^\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b$/i.test(body.opId||''))throw new InputError('Некорректная отметка подхода.');
    const inserted=await c.query('INSERT INTO juli_operations(id,session_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[body.opId,session.id]);
    if(body.side!==undefined&&(!separateSides(item)||![1,2].includes(body.side)))throw new InputError('Проверьте сторону упражнения.');
    if(inserted.rowCount){
     const key=`${item.id}:${body.setIndex}`;session.marks={...session.marks};
     if(body.side){
      if(session.marks[key]===true){session.marks[`${key}:1`]=true;session.marks[`${key}:2`]=true;}
      delete session.marks[key];session.marks[`${key}:${body.side}`]=body.done;
     }else{session.marks[key]=body.done;delete session.marks[`${key}:1`];delete session.marks[`${key}:2`];}
     return (await c.query('UPDATE juli_sessions SET marks=$1 WHERE id=$2 RETURNING *',[JSON.stringify(session.marks),session.id])).rows[0];
    }return session;
   }
   if(route==='/finish'){
    if(session.finished_at)return session;
    const result=sessionResult(session);
    if(!result.worked)throw new InputError('Сначала отметьте выполненный подход или сторону растяжки.');
    if(result.status!=='completed'&&body.allowPartial!==true)throw new InputError('Не всё выполнено. Продолжите занятие или сохраните частичный результат.');
    return (await c.query('UPDATE juli_sessions SET finished_at=now(),result_status=$2,result_summary=$3,duration_seconds=LEAST(28800,GREATEST(0,EXTRACT(EPOCH FROM (now()-started_at))::integer)) WHERE id=$1 RETURNING *',[session.id,result.status,JSON.stringify(result)])).rows[0];
   }
   throw new InputError('Неизвестный адрес.',404);
  });return reply({session:serialize(result)});
 }catch(e){if(!(e instanceof InputError))console.error('Request failed',e.code||e.name);return reply({error:e instanceof InputError?e.message:'База временно недоступна. Попробуйте ещё раз.'},e.status||503);}
}};
