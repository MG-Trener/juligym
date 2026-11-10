import {exercises,groups,byId} from './catalog.js';
import {stretches,stretchById} from './stretch-catalog.js';
import {icon} from './icons.js';
import {escape as esc,formatDate,today,dayIndex,plannedWorkout,sessionForDate} from './state.js';
import {stretchExercise} from './day-settings.js';

const shortDate={weekday:'long',day:'numeric',month:'long'};
const matchText=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е');
const weekdayPlurals=['понедельников','вторников','сред','четвергов','пятниц','суббот','воскресений'];
export const weeklyLabel=weekday=>`План всех ${weekdayPlurals[weekday]}`;

export function dayEditButton(id, included, compact=false) {
 const title=(byId[id]||stretchById[id]).title;
 return `<button type="button" class="button secondary day-edit${compact?' day-edit-compact':''}" data-day-edit="${id}" data-day-added="${!included}" data-write aria-label="${included?'Убрать':'Добавить'}: ${esc(title)}" title="${included?'Убрать из недельного плана':'Добавить в недельный план'}">${included?'−':'+'}${compact?'':included?' Убрать из плана':' Добавить в план'}</button>`;
}

function illustratedTile(exercise,included,dose='',editor=''){
 return `<article class="day-library-card" data-day-card="${exercise.id}">
  <button class="exercise-art" data-image="${exercise.id}" aria-label="Увеличить: ${esc(exercise.title)}"><img src="./media/${exercise.id}.webp" alt="${esc(exercise.title)}, три фазы" width="1536" height="1024" loading="lazy"></button>
  <div><div><h3>${esc(exercise.title)}</h3>${dose?`<p>${esc(dose)}</p>`:''}</div>${dayEditButton(exercise.id,included,true)}</div>
  ${editor}
 </article>`;
}

function doseEditor(exercise,fields){
 return `<div class="day-dose"><div class="day-dose-fields">${fields.map(({field,label,value,min,max})=>`<label>${label}${field==='sets'?`<select data-dose="sets" data-exercise="${exercise.id}" aria-label="Подходы: ${esc(exercise.title)}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${value===n?'selected':''}>${n}</option>`).join('')}</select>`:`<input data-dose="${field}" data-exercise="${exercise.id}" type="${field==='reps'?'text':'number'}" ${field==='reps'?'maxlength="10"':`inputmode="numeric" min="${min}" max="${max}" step="1"`} value="${esc(value)}" aria-label="${label}: ${esc(exercise.title)}" aria-describedby="dose-status-${exercise.id}" autocomplete="off">`}</label>`).join('')}</div>
 <small class="day-dose-status" id="dose-status-${exercise.id}" role="status">Сохраняется автоматически</small>
 <div class="day-dose-recovery" hidden><button type="button" class="text-button" data-dose-retry="${exercise.id}">Повторить</button><button type="button" class="text-button" data-dose-reset="${exercise.id}">Отменить изменение</button></div></div>`;
}

function orderControls(exercise,index,total){
 return `<div class="day-order" role="group" aria-label="Порядок: ${esc(exercise.title)}"><span aria-label="Упражнение ${index+1} из ${total}">${index+1} / ${total}</span><div>${[-1,1].map(direction=>{
  const boundary=direction===-1?index===0:index===total-1;
  return `<button type="button" class="icon-button" data-day-move="${exercise.id}" data-direction="${direction}" data-boundary="${boundary}" data-write ${boundary?'disabled':''} aria-label="${direction===-1?'Выше':'Ниже'}: ${esc(exercise.title)}" title="${direction===-1?'Выше':'Ниже'}">${direction===-1?'↑':'↓'}</button>`;
 }).join('')}</div></div>`;
}

function strengthTile(item,index,items){
 const exercise=byId[item.id];
 return illustratedTile(exercise,true,exercise.unilateral?'На каждую сторону':'',doseEditor(exercise,[
  {field:'sets',label:'Подходы',value:item.sets},
  {field:'reps',label:exercise.unit==='seconds'?'Удержание, с':'Повторы',value:item.reps.replace(/ с$/,'')}
 ])+orderControls(exercise,index,items.length));
}

function stretchTile(id,settings,index,total){
 const exercise=stretchExercise(id,settings);
 return illustratedTile(exercise,true,exercise.unilateral?'На каждую сторону':'',doseEditor(exercise,[
  exercise.seconds?{field:'seconds',label:'Удержание, с',value:exercise.seconds,min:5,max:300}:
   {field:'repetitions',label:'Плавные повторы',value:exercise.repetitions,min:1,max:99}
 ])+orderControls(exercise,index,total));
}

export function dayMarkup(data,date) {
 const plan=plannedWorkout(data,date);
 const session=sessionForDate(data,date);
 const items=plan?.items||[];
 const stretchIds=plan?.stretch_ids||[];
 const label=formatDate(date,shortDate);
 const sessionPlan=session||plan;
 const sessionItems=sessionPlan?.items||[],sessionStretches=sessionPlan?.stretch_ids||[];
 const future=date>today();
 const start=sessionPlan&&!future;
 const actionLabel=session?.finished_at?'Посмотреть результат':session?'Продолжить':sessionPlan?.items.length?'Начать тренировку':'Начать растяжку';
 const intro=`<div class="day-summary">
  <div><span class="eyebrow">${session?.finished_at?'ЗАНЯТИЕ СОХРАНЕНО':session?'ЗАНЯТИЕ В ПРОЦЕССЕ':date===today()?'СЕГОДНЯ':'ЗАНЯТИЕ ПО РАСПИСАНИЮ'}</span><h2 id="day-title" tabindex="-1">${label}</h2>
  <p>${sessionItems.length||sessionStretches.length?`${sessionItems.length} силовых · ${sessionStretches.length} на растяжку`:'День свободен. Добавьте упражнения в план ниже.'}${session?.finished_at?(session.result_status==='partial'?' · Частично выполнено':' · Выполнено'):''}</p></div>
  ${start?`<button class="button primary flow-primary" data-day-start data-workout-plan="${esc(sessionPlan.plan_id||sessionPlan.id)}" data-workout-date="${date}" ${session?.finished_at?'':'data-write'}>${icon('play')} ${actionLabel}</button>`:''}
 </div>
 <div class="day-template-heading"><h3 id="day-template-title">${weeklyLabel(dayIndex(date))}</h3><p class="day-note">Состав, нагрузка и порядок повторяются каждую неделю.${session?` Занятие ${formatDate(date)} ${session.finished_at?'уже сохранено':'уже начато'} — оно останется прежним.`:''}</p></div>
 <div class="day-tools" role="group" aria-label="Добавить упражнения">
  <button class="button secondary" data-day-catalog="strength">+ Силовое упражнение</button>
  <button class="button secondary" data-day-catalog="stretch">+ Растяжка</button>
 </div>`;
 const lists=`${items.length?`<section class="day-list"><h3>Силовые упражнения</h3><div class="day-library">${items.map(strengthTile).join('')}</div></section>`:''}
 ${stretchIds.length?`<section class="day-list"><div class="section-heading"><h3>Растяжка${items.length?' <small class="muted">после силовых</small>':''}</h3>${items.length&&!future?`<button class="button quiet" data-day-stretch-preview data-write>Начать растяжку дня →</button>`:''}</div><div class="day-library">${stretchIds.map((id,index)=>stretchTile(id,plan.stretch_settings,index,stretchIds.length)).join('')}</div></section>`:''}`;
 return {intro,lists};
}

export function catalogMarkup(mode,filters,plan) {
 const stretching=mode==='stretch';
 const term=matchText(filters.query.trim());
 const entries=(stretching?stretches:exercises).filter(e=>(filters.group==='all'||filters.group===e.group)&&
   matchText(`${e.title} ${e.muscles} ${e.equipment}`).includes(term));
 const ids=new Set(stretching?plan?.stretch_ids||[]:(plan?.items||[]).map(item=>item.id));
 return entries.map(e=>illustratedTile(e,ids.has(e.id))).join('')||
   '<p class="empty">Ничего не найдено. Измените запрос или выберите другую группу мышц.</p>';
}

export const catalogGroupOptions=[{id:'all',title:'Все группы мышц'},...groups]
 .map(g=>`<option value="${g.id}">${g.title}</option>`).join('');
