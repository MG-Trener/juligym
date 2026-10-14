import {initialPlanner} from './planner.js';
export function cleanBackupState(input){
 if(!input || typeof input!=='object' || Array.isArray(input) || !Array.isArray(input.plans) || !Array.isArray(input.schedule))throw new Error('В файле нет расписания Juligym.');
 const planner=initialPlanner(input),sessions={};
 for(const plan of planner.plans)for(const mode of ['easy','regular']){
  const source=input.sessions?.[`${plan.id}:${mode}`];
  if(!source || typeof source!=='object')continue;
  const allowed=plan.items.flatMap(id=>Array.from({length:mode==='easy'?1:2},(_,i)=>`${id}:${i}`));
  const done=Array.isArray(source.done)?[...new Set(source.done.filter(k=>allowed.includes(k)))]:[];
  const stretchDone=Array.isArray(source.stretchDone)?[...new Set(source.stretchDone.filter(id=>plan.stretches.includes(id)))]:[];
  sessions[`${plan.id}:${mode}`]={done,stretchDone,finished:source.finished===true && allowed.length>0 && done.length===allowed.length};
 }
 const history=Array.isArray(input.history)?input.history.filter(h=>h && Number.isInteger(h.day) && h.day>=1 && h.day<=7 && typeof h.date==='string' && Number.isFinite(Date.parse(h.date))).slice(-100).map(h=>({day:h.day,date:h.date,mode:h.mode==='regular'?'regular':'easy',title:String(h.title || '').slice(0,60)})):[];
 return {...planner,mode:input.mode==='regular'?'regular':'easy',sessions,history};
}
export function parseBackup(text){
 const file=JSON.parse(text);
 if(file?.app!=='juligym' || file.version!==1)throw new Error('Это не поддерживаемая копия плана Juligym.');
 return cleanBackupState(file.data);
}
export function createBackup(data){return JSON.stringify({app:'juligym',version:1,exportedAt:new Date().toISOString(),data:cleanBackupState(data)},null,2);}
