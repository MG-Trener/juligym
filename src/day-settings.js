import {byId} from './catalog.js';
import {stretchById} from './stretch-catalog.js';

// Shared by the inline editor and API so both accept the same values.
export function doseValue(id,field,raw) {
 const strength=Object.hasOwn(byId,id), exercise=strength?byId[id]:stretchById[id];
 if(!exercise)throw new Error('Упражнение не найдено.');
 const text=String(raw??'').trim();
 if(strength&&field==='reps'){
  const match=text.match(/^(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?(?:\s*с)?$/);
  if(!match||Number(match[1])<1||(match[2]&&Number(match[2])<Number(match[1]))||(!exercise.unit?.includes('seconds')&&/с$/.test(text)))
   throw new Error('От 1 до 99, например 12 или 10–12.');
  return `${Number(match[1])}${match[2]?'–'+Number(match[2]):''}${exercise.unit==='seconds'?' с':''}`;
 }
 const allowed=strength?field==='sets':field===(exercise.seconds?'seconds':'repetitions');
 if(!allowed)throw new Error('Этот параметр недоступен для упражнения.');
 const min=field==='seconds'?5:1,max=field==='sets'?5:field==='seconds'?300:99;
 if(!/^\d+$/.test(text)||!Number.isInteger(Number(text))||Number(text)<min||Number(text)>max)
  throw new Error(`Введите целое число от ${min} до ${max}.`);
 return Number(text);
}

export function stretchExercise(id,settings={}) {
 return {...stretchById[id],...settings?.[id]};
}
