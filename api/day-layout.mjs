import {dayEdit,InputError,planValue} from './model.mjs';
import {stretchById} from '../src/stretch-catalog.js';
import {doseValue} from '../src/day-settings.js';

function version(input) {
 if(input.expectedPlanId!==null&&(typeof input.expectedPlanId!=='string'||!/^[a-zA-Z0-9-]{1,50}$/.test(input.expectedPlanId)))throw new InputError('Обновите план дня.');
 if(!Number.isInteger(input.expectedRevision)||input.expectedRevision<1)throw new InputError('Обновите план дня.');
 return {expectedPlanId:input.expectedPlanId,expectedRevision:input.expectedRevision};
}
export function dayMove(input) {
 const edit=dayEdit({...input,added:true});
 if(![-1,1].includes(input.direction))throw new InputError('Выберите направление перемещения.');
 return {...edit,...version(input),kind:'move',direction:input.direction};
}
export function dayRestore(input) {
 const undo=input?.undo;
 const edit=dayEdit({...undo,added:true});
 if(undo.planId!==edit.id||!Number.isInteger(undo.revision)||undo.revision<1||!Number.isInteger(undo.index)||undo.index<0||undo.index>19)throw new InputError('Не удалось прочитать отмену удаления.');
 const restored={planId:undo.planId,revision:undo.revision,index:undo.index};
 for(const key of ['previousId','nextId'])if(undo[key]!==undefined){
  if(typeof undo[key]!=='string'||undo[key].length>60)throw new InputError('Некорректное место упражнения.');
  restored[key]=undo[key];
 }
 if(edit.strength){
  if(undo.item?.id!==edit.exerciseId)throw new InputError('Некорректное упражнение.');
  restored.item=planValue({title:'Восстановление',items:[undo.item]}).items[0];
 }else{
  restored.settings={};
  const field=stretchById[edit.exerciseId].seconds?'seconds':'repetitions';
  if(undo.settings?.[field]!==undefined)try{restored.settings[field]=doseValue(edit.exerciseId,field,undo.settings[field]);}catch(e){throw new InputError(e.message);}
 }
 return {...edit,...version(input),kind:'restore',undo:restored};
}
export function checkDayVersion(base,assigned,edit) {
 if((assigned||null)!==edit.expectedPlanId||base?.revision!==edit.expectedRevision)
  throw new InputError('План изменился в другом окне. Мы обновим его — повторите действие.',409);
 if(edit.kind==='restore'&&((assigned&&assigned!==edit.undo.planId)||(!assigned&&(!base||base.revision!==edit.undo.revision||base.items.length||base.stretch_ids.length))))
  throw new InputError('Для этого дня уже выбран другой план. Добавьте упражнение через библиотеку.',409);
}
export function removedExercise(base,edit,plan) {
 const list=edit.strength?base.items:base.stretch_ids;
 const idOf=value=>edit.strength?value.id:value;
 const index=list.findIndex(value=>idOf(value)===edit.exerciseId);
 return {weekday:edit.weekday,exerciseId:edit.exerciseId,index,planId:plan.id,revision:plan.revision,
  ...(index>0?{previousId:idOf(list[index-1])}:{}),...(index<list.length-1?{nextId:idOf(list[index+1])}:{}),
  ...(edit.strength?{item:list[index]}:{settings:base.stretch_settings?.[edit.exerciseId]||{}})};
}
export function editDayLayout(base,edit) {
 const items=[...(base?.items||[])],stretchIds=[...(base?.stretch_ids||[])],stretchSettings={...base?.stretch_settings};
 const list=edit.strength?items:stretchIds,idOf=value=>edit.strength?value.id:value;
 const index=list.findIndex(value=>idOf(value)===edit.exerciseId);
 if(edit.kind==='move'){
  if(index<0)throw new InputError('Упражнение уже убрано из плана.',409);
  const target=index+edit.direction;
  if(target<0||target>=list.length)return null;
  [list[index],list[target]]=[list[target],list[index]];
 }else{
  // A replay or a manual re-add must never overwrite newer exercise settings.
  if(index>=0)return null;
  if(list.length>=20)throw new InputError('В этой части плана уже 20 упражнений. Сначала освободите место.');
  const next=list.findIndex(value=>idOf(value)===edit.undo.nextId),previous=list.findIndex(value=>idOf(value)===edit.undo.previousId);
  const position=next>=0?next:previous>=0?previous+1:Math.min(edit.undo.index,list.length);
  list.splice(position,0,edit.strength?edit.undo.item:edit.exerciseId);
  if(!edit.strength&&Object.keys(edit.undo.settings).length)stretchSettings[edit.exerciseId]=edit.undo.settings;
 }
 return {items,stretchIds,stretchSettings};
}
