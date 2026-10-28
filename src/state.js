export const timezone='Asia/Qyzylorda';
export function today(){return new Date().toLocaleDateString('sv-SE',{timeZone:timezone});}
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(date){const d=new Date(date+'T12:00:00Z');return addDays(date,-((d.getUTCDay()+6)%7));}
export function dayIndex(date){return (new Date(date+'T12:00:00Z').getUTCDay()+6)%7;}
export function summary(session){const items=session?.items||[],marks=session?.marks||{},total=items.reduce((n,i)=>n+i.sets,0),done=items.reduce((n,i)=>n+Array.from({length:i.sets},(_,s)=>marks[`${i.id}:${s}`]===true).filter(Boolean).length,0),complete=items.filter(i=>Array.from({length:i.sets},(_,s)=>marks[`${i.id}:${s}`]===true).every(Boolean)).length;return {total,done,complete,percent:total?Math.round(done/total*100):0};}
export function estimatedMinutes(plan){return Math.round(5+(plan?.items||[]).reduce((n,i)=>n+i.sets*(40+i.rest)/60,0));}
export const formatDate=(date,options={day:'numeric',month:'long'})=>new Date(date+'T12:00:00Z').toLocaleDateString('ru-RU',{...options,timeZone:'UTC'});
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
