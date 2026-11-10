import {doseValue} from './day-settings.js';

// Coalesce typing, serialize writes, and retain newer edits while a request is in flight.
export function createDayAutosave(save,changed,delay=450) {
 const entries=new Map();
 let timer,running=false;
 const keyFor=({weekday,exerciseId,field})=>`${weekday}:${exerciseId}:${field}`;
 const hasPending=()=>running||[...entries.values()].some(entry=>entry.state==='pending');
 async function flush(){
  clearTimeout(timer);
  if(running)return;
  running=true;
  try{
   let entry;
   while((entry=[...entries.values()].find(value=>value.state==='pending'))){
    entry.state='saving';changed();
    try{
     await save(entry.body);
     entry.state='saved';entry.message='Сохранено';
    }catch(error){entry.state='error';entry.message=error.message;}
    changed();
   }
  }finally{running=false;changed();}
 }
 function edit(body,raw){
  const entry={body:{...body},raw,state:'pending',message:''};
  try{entry.body.value=doseValue(body.exerciseId,body.field,raw);}
  catch(error){entry.state='invalid';entry.message=error.message;}
  entries.set(keyFor(body),entry);
  clearTimeout(timer);
  timer=setTimeout(flush,delay);
  changed();
 }
 return {
  entries,edit,flush,
  get pending(){return hasPending();},
  get unsaved(){return hasPending()||[...entries.values()].some(entry=>['invalid','error'].includes(entry.state));},
  retry(weekday,id){
   for(const entry of entries.values())if(entry.body.weekday===weekday&&entry.body.exerciseId===id&&entry.state==='error')entry.state='pending';
   void flush();
  },
  discard(weekday,id){
   for(const [key,entry] of entries)if(entry.body.weekday===weekday&&entry.body.exerciseId===id&&['error','invalid'].includes(entry.state))entries.delete(key);
   changed();
  },
  clearSaved(){for(const [key,entry] of entries)if(entry.state==='saved')entries.delete(key);}
 };
}
