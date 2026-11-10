import {exercises,groups,byId} from './catalog.js';
import {stretches,stretchById} from './stretch-catalog.js';
import {icon} from './icons.js';
import {escape as esc,formatDate,today,plannedWorkout,sessionForDate} from './state.js';

const shortDate={weekday:'long',day:'numeric',month:'long'};
const matchText=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е');

export function dayEditButton(id, included, compact=false) {
 const title=(byId[id]||stretchById[id]).title;
 return `<button type="button" class="button secondary day-edit${compact?' day-edit-compact':''}" data-day-edit="${id}" data-day-added="${!included}" data-write aria-label="${included?'Убрать':'Добавить'}: ${esc(title)}">${included?'−':'+'}${compact?'':included?' Убрать из дня':' Добавить в день'}</button>`;
}

function illustratedTile(exercise,included,dose=''){
 return `<article class="day-library-card">
  <button class="exercise-art" data-image="${exercise.id}" aria-label="Увеличить: ${esc(exercise.title)}"><img src="./media/${exercise.id}.webp" alt="${esc(exercise.title)}, три фазы" width="1536" height="1024" loading="lazy"></button>
  <div><div><h3>${esc(exercise.title)}</h3>${dose?`<p>${esc(dose)}</p>`:''}</div>${dayEditButton(exercise.id,included,true)}</div>
 </article>`;
}

function strengthTile(item){
 const exercise=byId[item.id];
 const unit=exercise.unit==='seconds'?(item.reps.endsWith('с')?'':' с'):' повт.';
 return illustratedTile(exercise,true,`${item.sets} × ${item.reps}${unit}${exercise.unilateral?' на сторону':''}`);
}

function stretchTile(id){
 const exercise=stretchById[id];
 const dose=exercise.seconds?`${exercise.seconds} с`:`${exercise.repetitions} повт.`;
 return illustratedTile(exercise,true,dose+(exercise.unilateral?' на сторону':''));
}

export function dayMarkup(data,date) {
 const plan=plannedWorkout(data,date);
 const session=sessionForDate(data,date);
 const items=plan?.items||[];
 const stretchIds=plan?.stretch_ids||[];
 const label=formatDate(date,shortDate);
 const sessionPlan=session||plan;
 const future=date>today();
 const start=sessionPlan&&!future&&(!session?.finished_at||(session.stretch_ids||[]).length);
 const actionLabel=session?.finished_at?'Открыть растяжку':session?'Продолжить':sessionPlan?.items.length?'Начать тренировку':'Начать растяжку';
 const intro=`<div class="day-summary">
  <div><span class="eyebrow">${date===today()?'СЕГОДНЯ':'ПЛАН ДНЯ'}</span><h2 id="day-title" tabindex="-1">${label}</h2>
  <p>${items.length||stretchIds.length?`${items.length} силовых · ${stretchIds.length} на растяжку`:'День свободен. Добавьте упражнения из библиотеки.'}${session?.finished_at?' · Выполнено':''}</p></div>
  ${start?`<button class="button primary flow-primary" data-day-start data-workout-plan="${esc(sessionPlan.plan_id||sessionPlan.id)}" data-workout-date="${date}" ${session?.finished_at?'':'data-write'}>${icon('play')} ${actionLabel}</button>`:''}
 </div>
 <p class="day-note">${session&&!session.finished_at?'Начатое занятие продолжится по сохранённому составу. Изменения плана применятся к следующим занятиям.':'Состав дня повторяется каждую неделю.'}</p>
 <div class="day-tools" role="group" aria-label="Добавить упражнения">
  <button class="button secondary" data-day-catalog="strength">+ Силовое упражнение</button>
  <button class="button secondary" data-day-catalog="stretch">+ Растяжка</button>
 </div>`;
 const lists=`${items.length?`<section class="day-list"><h3>Силовые упражнения</h3><div class="day-library">${items.map(strengthTile).join('')}</div></section>`:''}
 ${stretchIds.length?`<section class="day-list"><div class="section-heading"><h3>Растяжка</h3>${items.length?`<button class="button quiet" data-day-stretch-preview>Открыть растяжку →</button>`:''}</div><div class="day-library">${stretchIds.map(stretchTile).join('')}</div></section>`:''}`;
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
