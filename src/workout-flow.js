import {byId} from './catalog.js';
import {anatomy, icon} from './icons.js';
import {escape as esc, estimatedMinutes, firstPendingSet, formatDate, summary, todaySelection} from './state.js';

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
  const pending = session && firstPendingSet(session);
  let main;
  if (items.length) {
    const label = session?.finished_at ? 'Выполнено' : session ? 'В процессе' : 'По расписанию';
    const estimate = session?.finished_at ? `${Math.max(1, Math.round(session.duration_seconds / 60))} мин` : `≈ ${estimatedMinutes({items})} мин`;
    const next = pending ? `${byId[pending.item.id].title} · подход ${pending.setIndex + 1} из ${pending.item.sets}` : 'Все подходы отмечены';
    main = `<div class="today-card today-featured">
      ${anatomy(byId[items[0].id]?.group, 'today-anatomy')}
      <span class="eyebrow">${label}</span>
      <h2>${esc(title)}</h2>
      <p class="flow-meta">${icon('clock')} ${estimate}<span aria-hidden="true">·</span>${progress.total} ${approachNouns[numberForm.select(progress.total)]}</p>
      ${session ? `<p class="today-next">${session.finished_at ? 'Сохранено в дневнике' : next}</p>${progressBar(progress)}<small>${savedApproaches(progress)}</small>` : ''}
      <div class="flow-actions">${todayAction(date, session?.plan_id || plan.id, session?.finished_at ? 'Посмотреть занятие' : session ? 'Продолжить' : 'Начать тренировку', !!session?.finished_at)}</div>
    </div>`;
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
      <p>${previousStep ? `${byId[previousStep.item.id].title} · подход ${previousStep.setIndex + 1} из ${previousStep.item.sets}` : 'Все подходы отмечены'}</p><small>${savedApproaches(saved)}</small></div>
    ${todayAction(previous.workout_date, previous.plan_id, 'Продолжить занятие')}
  </div>`;
}

export function guidedMarkup(session, renderExercise) {
  const progress = summary(session);
  const step = firstPendingSet(session);
  if (session.finished_at) {
    return `<div class="today-card flow-finished">${icon('check')}<h2 id="guided-step" tabindex="-1">Тренировка сохранена</h2>
      <p>${savedApproaches(progress)} · ${formatDate(session.workout_date)}</p>
      <div class="flow-actions"><button class="button primary" data-workout-stretch>Растяжка после тренировки ${icon('arrow')}</button><button class="button quiet" data-view="today">На сегодня</button></div>
    </div>`;
  }
  if (!step) {
    return `<div class="today-card flow-finished">${icon('check')}<h2 id="guided-step" tabindex="-1">Все подходы выполнены</h2>
      <p>Завершите тренировку, чтобы отметить день в календаре.</p>
      <div class="flow-actions"><button class="button primary flow-primary" id="guided-finish" data-write>${icon('check')} Завершить тренировку</button></div>
    </div>`;
  }
  const {item, exerciseIndex, setIndex} = step;
  const exercise = byId[item.id];
  const hold = exercise.unit === 'seconds' ? Number.parseInt(item.reps, 10) : 0;
  return `<div class="guided-position">
    <h2 id="guided-step" tabindex="-1">Подход ${setIndex + 1} из ${item.sets}</h2>
    <span>Упражнение ${exerciseIndex + 1} из ${session.items.length}</span>
  </div>
  ${progressBar(progress)}<small class="guided-count">${savedApproaches(progress)}</small>
  ${renderExercise(item, exerciseIndex, 'guided')}
  <div class="flow-actions guided-actions">
    <button class="button primary flow-primary" id="guided-mark" data-guided-set="${item.id}:${setIndex}" data-write>${icon('check')} Подход готов</button>
    ${hold > 0 && hold <= 180 ? `<button class="button secondary" data-guided-hold="${hold}">${icon('clock')} Удержание ${hold} с</button>` : ''}
  </div>`;
}
