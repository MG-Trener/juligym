import {exercises,groups,byId} from './catalog.js';
import {stretches,stretchById} from './stretch-catalog.js';
import {icon} from './icons.js';
import {escape as esc,formatDate,today,plannedWorkout,sessionForDate} from './state.js';
import {stretchExercise} from './day-settings.js';

const shortDate={weekday:'long',day:'numeric',month:'long'};
const matchText=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е');

export function dayEditButton(id, included, compact=false) {
 const title=(byId[id]||stretchById[id]).title;
 return `<button type="button" class="button secondary day-edit${compact?' day-edit-compact':''}" data-day-edit="${id}" data-day-added="${!included}" data-write aria-label="${included?'Убрать':'Добавить'}: ${esc(title)}">${included?'−':'+'}${compact?'':included?' Убрать из дня':' Добавить в день'}</button>`;
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

function strengthTile(item){
 const exercise=byId[item.id];
 return illustratedTile(exercise,true,exercise.unilateral?'На каждую сторону':'',doseEditor(exercise,[
  {field:'sets',label:'Подходы',value:item.sets},
  {field:'reps',label:exercise.unit==='seconds'?'Удержание, с':'Повторы',value:item.reps.replace(/ с$/,'')}
 ]));
}

function stretchTile(id,settings){
 const exercise=stretchExercise(id,settings);
 return illustratedTile(exercise,true,exercise.unilateral?'На каждую сторону':'',doseEditor(exercise,[
  exercise.seconds?{field:'seconds',label:'Удержание, с',value:exercise.seconds,min:5,max:300}:
   {field:'repetitions',label:'Плавные повторы',value:exercise.repetitions,min:1,max:99}
 ]));
}

export function dayMarkup(data,date) {
 const plan=plannedWorkout(data,date);
 const session=sessionForDate(data,date);
 const items=plan?.items||[];
 const stretchIds=plan?.stretch_ids||[];
 const label=formatDate(date,shortDate);
 const sessionPlan=session||plan;
 const future=date>today();
 const start=sessionPlan&&!future;
 const actionLabel=session?.finished_at?'Посмотреть результат':session?'Продолжить':sessionPlan?.items.length?'Начать тренировку':'Начать растяжку';
 const intro=`<div class="day-summary">
  <div><span class="eyebrow">${date===today()?'СЕГОДНЯ':'ПЛАН ДНЯ'}</span><h2 id="day-title" tabindex="-1">${label}</h2>
  <p>${items.length||stretchIds.length?`${items.length} силовых · ${stretchIds.length} на растяжку`:'День свободен. Добавьте упражнения из библиотеки.'}${session?.finished_at?(session.result_status==='partial'?' · Частично выполнено':' · Выполнено'):''}</p></div>
  ${start?`<button class="button primary flow-primary" data-day-start data-workout-plan="${esc(sessionPlan.plan_id||sessionPlan.id)}" data-workout-date="${date}" ${session?.finished_at?'':'data-write'}>${icon('play')} ${actionLabel}</button>`:''}
 </div>
 <p class="day-note">${session&&!session.finished_at?'Начатое занятие продолжится с прежними упражнениями и нагрузкой. Изменения плана применятся к следующим занятиям.':'Состав и нагрузка этого дня повторяются каждую неделю.'}</p>
 <div class="day-tools" role="group" aria-label="Добавить упражнения">
  <button class="button secondary" data-day-catalog="strength">+ Силовое упражнение</button>
  <button class="button secondary" data-day-catalog="stretch">+ Растяжка</button>
 </div>`;
 const lists=`${items.length?`<section class="day-list"><h3>Силовые упражнения</h3><div class="day-library">${items.map(strengthTile).join('')}</div></section>`:''}
 ${stretchIds.length?`<section class="day-list"><div class="section-heading"><h3>Растяжка</h3>${items.length&&!future?`<button class="button quiet" data-day-stretch-preview data-write>Начать растяжку дня →</button>`:''}</div><div class="day-library">${stretchIds.map(id=>stretchTile(id,plan.stretch_settings)).join('')}</div></section>`:''}`;
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
