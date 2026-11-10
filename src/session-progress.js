import {byId} from './catalog.js';
import {stretchById} from './stretch-catalog.js';

// Alternating repetitions stay in one set. Separate-side movements require both sides.
export function separateSides(item) {
  return item.sideMode ? item.sideMode === 'separate' : !!byId[item.id]?.unilateral && !byId[item.id]?.alternating;
}
export function sideDone(session, item, index, side) {
  return session?.marks?.[`${item.id}:${index}`] === true || session?.marks?.[`${item.id}:${index}:${side}`] === true;
}
export function setDone(session, item, index) {
  return separateSides(item) ? [1, 2].every(side => sideDone(session, item, index, side)) : session?.marks?.[`${item.id}:${index}`] === true;
}
export function strengthProgress(session) {
  const items=session?.items||[];
  const total=items.reduce((n,item)=>n+item.sets,0);
  const done=items.reduce((n,item)=>n+Array.from({length:item.sets},(_,i)=>setDone(session,item,i)).filter(Boolean).length,0);
  const complete=items.filter(item=>Array.from({length:item.sets},(_,i)=>setDone(session,item,i)).every(Boolean)).length;
  return {total,done,complete,percent:total?Math.round(done/total*100):0};
}
export function pendingSet(session) {
  for(const [exerciseIndex,item] of (session?.items||[]).entries()) {
    for(let setIndex=0;setIndex<item.sets;setIndex++) {
      if(setDone(session,item,setIndex))continue;
      const side=separateSides(item)?([1,2].find(s=>!sideDone(session,item,setIndex,s))):0;
      return {item,exerciseIndex,setIndex,side};
    }
  }
  return null;
}
export function stretchSteps(ids=[]) {
  return ids.flatMap((id,exerciseIndex)=>{
    const step={id,exerciseIndex,side:1,key:`${id}:1`};
    return stretchById[id]?.unilateral?[step,{...step,side:2,key:`${id}:2`}]:[step];
  });
}
export function stretchProgress(session) {
  const steps=stretchSteps(session?.stretch_ids),marks=session?.stretch_state?.marks||{};
  return {total:steps.length,done:steps.filter(step=>marks[step.key]==='done').length,skipped:steps.filter(step=>marks[step.key]==='skipped').length};
}
export function sessionResult(session) {
  const strength=strengthProgress(session),stretch=stretchProgress(session);
  const sides=(session?.items||[]).reduce((n,item)=>n+Array.from({length:item.sets},(_,i)=>separateSides(item)?[1,2].filter(side=>sideDone(session,item,i,side)).length:Number(setDone(session,item,i))).reduce((a,b)=>a+b,0),0);
  const worked=sides+stretch.done;
  const completed=strength.done===strength.total&&stretch.done===stretch.total&&worked>0;
  return {strength,stretch,worked,status:completed?'completed':'partial'};
}
export function advanceStretch(ids,state,action) {
  const steps=stretchSteps(ids),position=Math.min(state?.position||0,steps.length),marks={...state?.marks};
  const step=steps[position];
  if(action==='previous')return {position:Math.max(0,position-1),marks};
  if(!step)return {position,marks};
  if(action==='next'){marks[step.key]='done';return {position:position+1,marks};}
  if(action==='skip'){
    let next=position;
    while(steps[next]?.id===step.id){if(marks[steps[next].key]!=='done')marks[steps[next].key]='skipped';next++;}
    return {position:next,marks};
  }
  throw Error('Неизвестный шаг.');
}
