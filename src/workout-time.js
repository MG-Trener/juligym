import {byId} from './catalog.js';
import {stretchById} from './stretch-catalog.js';
import {stretchExercise} from './day-settings.js';

// Planning estimate, never a measurement of active time or time spent with a tab open.
// Repetitions: 3–4 seconds in strength work, 5–6 seconds in gentle mobility.
export function quantityRange(value) {
 const numbers=String(value??'').match(/\d+/g)?.map(Number)||[];
 const min=Math.max(0,numbers[0]||0),max=Math.max(min,numbers[1]??min);
 return {min,max};
}
export function workoutEstimate(plan={}) {
 const items=(plan?.items||[]).filter(item=>byId[item.id]);
 const stretches=(plan?.stretch_ids||[]).filter(id=>stretchById[id]);
 const parts={warmup:items.length?300:0,strengthMin:0,strengthMax:0,rest:0,transitions:Math.max(0,items.length-1)*30,stretchMin:0,stretchMax:0};
 for(const [index,item] of items.entries()){
  const exercise=byId[item.id],sets=Math.max(0,Number(item.sets)||0),q=quantityRange(item.reps??exercise.reps);
  // Even alternating movements are prescribed as repetitions PER side.
  const sides=exercise.unilateral?2:1,hold=exercise.unit==='seconds';
  parts.strengthMin+=sets*sides*q.min*(hold?1:3);
  parts.strengthMax+=sets*sides*q.max*(hold?1:4);
  parts.rest+=Math.max(0,sets-(index===items.length-1?1:0))*Math.max(0,Number(item.rest??exercise.rest)||0);
  if(sides===2&&!exercise.alternating)parts.transitions+=sets*10;
 }
 for(const [index,id] of stretches.entries()){
  const exercise=stretchExercise(id,plan?.stretch_settings),sides=exercise.unilateral?2:1;
  const q=quantityRange(exercise.seconds||exercise.repetitions);
  parts.stretchMin+=sides*q.min*(exercise.seconds?1:5);
  parts.stretchMax+=sides*q.max*(exercise.seconds?1:6);
  if(sides===2)parts.transitions+=10;
  if(index>0)parts.transitions+=15;
 }
 if(items.length&&stretches.length)parts.transitions+=30;
 const fixed=parts.warmup+parts.rest+parts.transitions;
 return {...parts,minSeconds:fixed+parts.strengthMin+parts.stretchMin,maxSeconds:fixed+parts.strengthMax+parts.stretchMax};
}
export function estimateLabel(plan) {
 const {minSeconds,maxSeconds}=workoutEstimate(plan);
 if(!maxSeconds)return '0 мин';
 const min=Math.max(1,Math.ceil(minSeconds/60)),max=Math.max(min,Math.ceil(maxSeconds/60));
 return `≈ ${min}${max===min?'':'–'+max} мин`;
}
export function estimateHint(plan) {
 return plan?.items?.length?`С разминкой 5 мин, отдыхом${plan.stretch_ids?.length?' и растяжкой':''}. Темп может отличаться.`:
  'Учтены обе стороны и смена положений. Разминка отдельно.';
}
