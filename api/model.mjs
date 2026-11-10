import {byId} from '../src/catalog.js';
import {stretchById} from '../src/stretch-catalog.js';
export class InputError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function dateValue(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new InputError('Некорректная дата.');return value;}
export function planValue(input){
 if(!input || typeof input.title!=='string'||input.title.trim().length<2||input.title.trim().length>70)throw new InputError('Название: от 2 до 70 символов.');
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>20)throw new InputError('Выберите от 1 до 20 движений.');
 const seen=new Set();const items=input.items.map(item=>{if(!item||!Object.hasOwn(byId,item.id)||seen.has(item.id))throw new InputError('Неизвестное или повторное упражнение.');seen.add(item.id);
  const sets=Number(item.sets??2),rest=Number(item.rest??byId[item.id].rest),reps=String(item.reps??byId[item.id].reps).trim();
  if(!Number.isInteger(sets)||sets<1||sets>5||!Number.isInteger(rest)||rest<15||rest>180||!/^\d{1,2}(?:[–-]\d{1,2})?(?: с)?$/.test(reps))throw new InputError('Проверьте подходы, повторы и отдых.');
  return {id:item.id,sets,reps,rest};});return {title:input.title.trim(),subtitle:typeof input.subtitle==='string'?input.subtitle.slice(0,120):'Домашняя силовая',items};
}
export function scheduleValue(input,plans){if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Некорректное расписание.');const out={};for(const [day,id] of Object.entries(input)){if(!/^[0-6]$/.test(day)||!plans.includes(id)||(/^weekday-[0-6]$/.test(id)&&id!==`weekday-${day}`))throw new InputError('Проверьте дни и комплексы.');out[day]=id;}return out;}

const weekdayTitles=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

export function dayEdit(input) {
 const {weekday, exerciseId, added}=input||{};
 if(!Number.isInteger(weekday)||weekday<0||weekday>6||typeof exerciseId!=='string'||
    typeof added!=='boolean')throw new InputError('Проверьте день и упражнение.');
 const strength=Object.hasOwn(byId,exerciseId);
 if(!strength&&!Object.hasOwn(stretchById,exerciseId))throw new InputError('Проверьте день и упражнение.');
 return {weekday, exerciseId, added, strength, id:`weekday-${weekday}`, title:weekdayTitles[weekday]};
}

export function editDayItems(base, {exerciseId, added, strength}) {
 const items=base?.items||[], stretchIds=base?.stretch_ids||[];
 const list=strength?items:stretchIds;
 const includes=list.some(item=>(strength?item.id:item)===exerciseId);
 if(includes===added)return null;
 if(added&&list.length>=20)throw new InputError('В каждой части дня можно добавить до 20 упражнений.');
 if(strength){
  const exercise=byId[exerciseId];
  const next=added?[...items,{id:exerciseId,sets:2,reps:exercise.reps,rest:exercise.rest}]:items.filter(item=>item.id!==exerciseId);
  return {items:next, stretchIds};
 }
 return {items, stretchIds:added?[...stretchIds,exerciseId]:stretchIds.filter(id=>id!==exerciseId)};
}
export const defaultPlans=[
 {id:'legs',title:'Ноги и ягодицы',subtitle:'Сила и опора · нижняя часть тела',ids:['legs01','glutes01','legs11','glutes06','legs09','core06']},
 {id:'upper',title:'Верх тела',subtitle:'Спина, грудь, плечи и руки',ids:['back01','chest01','shoulders01','back08','arms01','arms06']},
 {id:'core',title:'Кор и спина',subtitle:'Контроль корпуса и осанка',ids:['core06','back09','glutes10','core04','core03','glutes01']}
].map(({ids,...p})=>({...p,items:ids.map(id=>({id,sets:2,reps:byId[id].reps,rest:byId[id].rest}))}));
export function progress(session){const total=session.items.reduce((n,e)=>n+e.sets,0),done=session.items.reduce((n,e)=>n+Array.from({length:e.sets},(_,i)=>!!session.marks?.[`${e.id}:${i}`]).filter(Boolean).length,0);return {total,done,percent:total?Math.round(done/total*100):0};}
