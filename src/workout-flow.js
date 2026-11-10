import {sessionResult,stretchProgress} from './session-progress.js';
import {byId} from './catalog.js';
import {anatomy, icon} from './icons.js';
import {escape as esc, estimateLabel, estimateHint, firstPendingSet, formatDate, summary, todaySelection} from './state.js';

const numberForm = new Intl.PluralRules('ru');
const approachNouns = {one:'подход', few:'подхода', many:'подходов'};
const savedApproaches = ({done, total}) => `Сохранено подходов · ${done} из ${total}`;

function todayAction(date, planId, label, finished = false) {
  const action = finished ? 'data-today-details' : 'data-today-start data-write';
  return `<button class="button primary flow-primary" ${action} data-workout-date="${esc(date)}" data-workout-plan="${esc(planId)}">${icon(finished ? 'arrow' : 'play')} ${label}</button>`;
}

function progressBar(progress) {
  return `<progress class="flow-progress" max="${Math.max(1, progress.total)}" value="${progress.done}" aria-label="Сохранённые подходы"></progress>`;
}

export function todayMarkup(data, date) {
  const {plan, session, previous} = todaySelection(data, date);
  const items = session?.items || plan?.items || [];
  const progress = summary({items, marks: session?.marks});
  const title = session?.title || plan?.title;
  const stretchIds = (session||plan)?.stretch_ids||[];
  const pending = session && firstPendingSet(session);
  let main;
  if (items.length) {
    const label = session?.finished_at ? (session.result_status==='partial'?'Частично выполнено':'Выполнено') : session ? 'В процессе' : 'По расписанию';
    const estimate = `По плану ${estimateLabel(session||plan)}`;
    const next = pending ? `${byId[pending.item.id].title} · подход ${pending.setIndex + 1} из ${pending.item.sets}${pending.side?' · '+(pending.side===1?'левая сторона':'правая сторона'):''}` : 'Все подходы отмечены';
    main = `<div class="today-card today-featured">
      ${anatomy(byId[items[0].id]?.group, 'today-anatomy')}
      <span class="eyebrow">${label}</span>
      <h2>${esc(title)}</h2>
      <p class="flow-meta">${icon('clock')} ${estimate}<span aria-hidden="true">·</span>${progress.total} ${approachNouns[numberForm.select(progress.total)]}${stretchIds.length?' · растяжка после':''}</p>
      ${!session?.finished_at?`<small class="time-note">${estimateHint(session||plan)}</small>`:''}
      ${session ? `<p class="today-next">${session.finished_at ? 'Сохранено в дневнике' : next}</p>${progressBar(progress)}<small>${savedApproaches(progress)}</small>` : ''}
      <div class="flow-actions">${todayAction(date, session?.plan_id || plan.id, session?.finished_at ? 'Посмотреть занятие' : session ? 'Продолжить' : 'Начать тренировку', !!session?.finished_at)}</div>
    </div>`;
  } else if(stretchIds.length){
    main = `<div class="today-card today-featured"><span class="eyebrow">${session?.finished_at?(session.result_status==='partial'?'Частично выполнено':'Выполнено'):session?'В процессе':'По расписанию'}</span>
      <h2>Растяжка · ${esc(title)}</h2><p>По плану ${estimateLabel(session||plan)} · движений: ${stretchIds.length}${session&&(!session.finished_at||session.result_summary)?` · выполнено шагов: ${stretchProgress(session).done} из ${stretchProgress(session).total}`:''}</p>
      ${!session?.finished_at?`<small class="time-note">${estimateHint(session||plan)}</small>`:''}
      <div class="flow-actions"><button class="button primary flow-primary" data-day-start ${session?.finished_at?'':'data-write'} data-workout-date="${date}" data-workout-plan="${esc(session?.plan_id||plan.id)}">${icon('play')} ${session?.finished_at?'Посмотреть результат':session?'Продолжить':'Начать растяжку'}</button></div></div>`;
  } else {
    main = `<div class="today-card">
      <h2>${data.plans.length ? 'День отдыха' : 'Расписание тренировок'}</h2>
      <p>${data.plans.length ? 'На сегодня нет занятия по расписанию. Можно открыть любой комплекс.' : 'Когда дневник загрузится, здесь появится занятие на сегодня.'}</p>
      <div class="flow-actions"><button class="button secondary" id="today-choose">Выбрать тренировку ${icon('arrow')}</button></div>
    </div>`;
  }
  if (!previous) return main;
  const saved = summary(previous);
  const previousStep = firstPendingSet(previous);
  return `${main}<div class="today-card today-previous">
    <div><span class="eyebrow">Незавершённое занятие · ${formatDate(previous.workout_date)}</span><h3>${esc(previous.title)}</h3>
      <p>${previous.items.length?(previousStep ? `${byId[previousStep.item.id].title} · подход ${previousStep.setIndex + 1} из ${previousStep.item.sets}` : 'Все подходы отмечены'):`Растяжка · движений в плане: ${previous.stretch_ids.length}`}</p>${previous.items.length?`<small>${savedApproaches(saved)}</small>`:''}</div>
    ${previous.items.length?todayAction(previous.workout_date, previous.plan_id, 'Продолжить занятие'):`<button class="button primary flow-primary" data-day-start data-write data-workout-date="${previous.workout_date}" data-workout-plan="${esc(previous.plan_id)}">Продолжить растяжку</button>`}
  </div>`;
}

export function guidedMarkup(session, renderExercise) {
  const progress = summary(session);
  const result=sessionResult(session);
  const step = firstPendingSet(session);
  if (session.finished_at) {
    return `<div class="today-card flow-finished">${icon('check')}<h2 id="guided-step" tabindex="-1">Тренировка сохранена</h2>
      <p>${session.result_status==='partial'?'Частично выполнено · ':''}${savedApproaches(progress)} · ${formatDate(session.workout_date)}</p>
      <div class="flow-actions"><button class="button primary" data-workout-stretch>Растяжка после тренировки ${icon('arrow')}</button><button class="button quiet" data-view="today">На сегодня</button></div>
    </div>`;
  }
  if (!step) {
    return `<div class="today-card flow-finished">${icon('check')}<h2 id="guided-step" tabindex="-1">Все подходы выполнены</h2>
      <p>${result.stretch.total?'Силовая часть готова. Теперь можно перейти к растяжке.':'Сохраните занятие, чтобы отметить день в календаре.'}</p>
      <div class="flow-actions">${result.stretch.total?`<button class="button primary" data-workout-stretch>К растяжке ${icon('arrow')}</button>`:`<button class="button primary flow-primary" id="guided-finish" data-write>${icon('check')} Сохранить занятие</button>`}</div>${result.stretch.total?finishChoice(session):''}
    </div>`;
  }
  const {item, exerciseIndex, setIndex, side} = step;
  const exercise = byId[item.id];
  const hold = exercise.unit === 'seconds' ? Number.parseInt(item.reps, 10) : 0;
  return `<div class="guided-position">
    <h2 id="guided-step" tabindex="-1">Подход ${setIndex + 1} из ${item.sets}${side?` · ${side===1?'левая':'правая'} сторона`:''}</h2>
    <span>Упражнение ${exerciseIndex + 1} из ${session.items.length}</span>
  </div>
  ${progressBar(progress)}<small class="guided-count">${savedApproaches(progress)}</small>
  ${!result.worked?'<details class="flow-warmup"><summary>Сначала разминка · 5 мин</summary><p>2 минуты спокойного шага. Затем по минуте: движения плечами и локтями, неглубокие приседания с опорой, наклоны от таза и подъёмы на носки. Начните без гантелей.</p></details>':''}
  ${renderExercise(item, exerciseIndex, 'guided')}
  <div class="flow-actions guided-actions">
    <button class="button primary flow-primary" id="guided-mark" data-guided-set="${item.id}:${setIndex}${side?':'+side:''}" data-write>${icon('check')} ${side===1?'Левая готова → правая':side===2?'Правая готова · подход выполнен':'Подход готов'}</button>
    ${hold > 0 && hold <= 180 ? `<button class="button secondary" data-guided-hold="${hold}">${icon('clock')} Удержание ${hold} с</button>` : ''}
  </div>${finishChoice(session)}`;
}

export function finishChoice(session){
 const result=sessionResult(session);
 if(session?.finished_at||!result.worked)return '';
 return `<details class="finish-choice"><summary>На сегодня всё</summary><p>Сохранено действий: ${result.worked}. Выполнено подходов: ${result.strength.done} из ${result.strength.total}${result.stretch.total?' · шагов растяжки: '+result.stretch.done+' из '+result.stretch.total:''}. Сохраним только то, что получилось сделать. Занятие закроется.</p><button class="button secondary" data-finish-partial data-write>${result.status==='completed'?'Сохранить занятие':'Сохранить частичный результат'}</button><p>Для продолжения позже вернитесь на «Сегодня» без завершения — отмеченные шаги уже сохранены.</p></details>`;
}
