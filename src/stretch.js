import {groups} from './catalog.js';
import {icon, anatomy} from './icons.js';
import {stretches, stretchById, stretchPresets, stretchCooldown} from './stretch-catalog.js';
import {keepAwake, startTimer, stopTimer, observeTimer, timerSnapshot, restoreTimer} from './timer.js';
import {stretchExercise} from './day-settings.js';

import {stretchSteps,sessionResult} from './session-progress.js';
import {today,escape as esc} from './state.js';

const resumeKey='juligym2:stretch-session-v1';
const selectionKey = 'juligym2:stretch-selection';
const groupFilters = [{id: 'all', title: 'Все группы'}, ...groups];
const holdMessage = 'Удержание завершено. Плавно выйдите из положения.';

function movementCount(count) {
  const ones = count % 10;
  const word = count % 100 >= 11 && count % 100 <= 14 ? 'движений' :
    ones === 1 ? 'движение' : ones >= 2 && ones <= 4 ? 'движения' : 'движений';
  return `${count} ${word}`;
}

function duration(exercise) {
  return exercise.seconds || exercise.repetitions * 5;
}

function minutes(ids) {
  const seconds = ids.reduce((total, id) => {
    const exercise = stretchById[id];
    return total + duration(exercise) * (exercise.unilateral ? 2 : 1) + 15;
  }, 0);
  return `≈ ${Math.max(1, Math.round(seconds / 60))} мин`;
}

function exerciseCard(exercise, selected, openTechnique, side = 0) {
  const guided = side !== 0;
  const hintId = guided ? `guided-${exercise.id}` : exercise.id;
  const category = exercise.seconds ? 'Растяжка' : 'Подвижность';
  const quantity = exercise.seconds ? `${exercise.seconds} с` : `${exercise.repetitions} плавных повторов`;
  const dose = `${quantity}${exercise.unilateral ? ' на сторону' : ''}`;
  const technique = `<ol>${exercise.steps.map(step => `<li>${step}</li>`).join('')}</ol><p>${exercise.cue}</p>`;
  return `<article class="exercise-card stretch-card">
    <header><div><h3>${exercise.title}</h3><p>${exercise.muscles}</p></div><span class="difficulty">${category}</span></header>
    <button class="exercise-art" data-image="${exercise.id}" aria-label="Увеличить иллюстрацию: ${exercise.title}">
      <img src="./media/${exercise.id}.webp" alt="${exercise.title}: ${exercise.phases.join(', ')}" width="1536" height="1024" ${guided ? '' : 'loading="lazy"'}><span class="art-zoom">↗</span>
    </button>
    <div class="phase-labels">${exercise.phases.map((phase, index) => `<div><b>${index + 1}</b><span>${phase}</span></div>`).join('')}</div>
    <div class="stretch-meta"><span>${icon('clock')} ${dose}</span><span>${exercise.equipment}</span></div>
    <details class="technique" data-technique="${hintId}" ${openTechnique === hintId ? 'open' : ''}><summary>${icon('info')} Техника и подсказка</summary>${technique}</details>
    ${guided ? '' : `<button class="button secondary stretch-add" data-stretch-add="${exercise.id}" aria-pressed="${selected}">${icon(selected ? 'check' : 'plus')} ${selected ? 'В подборке' : 'В мою подборку'}</button>`}
  </article>`;
}

export function initStretch(root, getOpenTechnique, hooks={}) {
  let group = 'all';
  let query = '';
  let selection = [];
  let workoutCooldown = [];
  let session = null, active=false, saving=false, timer=null,lastStored='';
  try{
    const saved=JSON.parse(localStorage.getItem(resumeKey));
    if(saved?.day?.id&&!saved.day.finished_at&&Array.isArray(saved.day.stretch_ids)&&saved.day.stretch_ids.every(id=>Object.hasOwn(stretchById,id))){session=saved;timer=saved.timer;}
  }catch{}
  function persist(){if(!session)return;try{const value=JSON.stringify({...session,timer});if(value!==lastStored){localStorage.setItem(resumeKey,value);lastStored=value;}}catch{}}
  function suspend(){if(active){timer=timerSnapshot();persist();}active=false;}
  observeTimer(value=>{if(active&&session){timer=value;persist();}});
  addEventListener('pagehide',suspend);
  function bindDay(day){
    session={title:day.title,steps:stretchSteps(day.stretch_ids),exerciseCount:day.stretch_ids.length,position:day.stretch_state?.position||0,marks:day.stretch_state?.marks||{},day,settings:day.stretch_settings||{}};
  }
  async function move(action){
    if(saving||!session)return;
    saving=true;guided.querySelectorAll('button').forEach(button=>button.disabled=true);
    suspend();stopTimer();
    const result=await hooks.save?.(session.day,action);
    saving=false;
    if(result){bindDay(result);timer=null;persist();}
    showStep();
  }
  try {
    const stored = JSON.parse(localStorage.getItem(selectionKey));
    if (Array.isArray(stored)) selection = [...new Set(stored.filter(id => typeof id === 'string' && Object.hasOwn(stretchById, id)))];
  } catch {}

  const home = root.querySelector('#stretch-home');
  const guided = root.querySelector('#stretch-guided');
  const filterBar = root.querySelector('#stretch-groups');
  const grid = root.querySelector('#stretch-grid');
  const selectedList = root.querySelector('#stretch-selection');
  const cooldown = root.querySelector('#stretch-cooldown');
  const resume = root.querySelector('#stretch-resume');
  const count = root.querySelector('#stretch-count');
  const title = root.querySelector('#stretch-library-title');

  function renderSelection() {
    const start = root.querySelector('[data-stretch-custom]');
    start.disabled = !selection.length;
    start.textContent = selection.length ? `Начать подборку · ${minutes(selection)}` : 'Начать подборку';
    selectedList.innerHTML = selection.length ? selection.map(id =>
      `<button type="button" data-stretch-remove="${id}" aria-label="Убрать из подборки: ${stretchById[id].title}">${stretchById[id].title} ${icon('close')}</button>`
    ).join('') : '<span>Добавьте движения из каталога ниже.</span>';
  }

  function renderGroup() {
    filterBar.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stretchGroup === group)));
    const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');
    const term = normalize(query.trim());
    const entries = stretches.filter(exercise => (group === 'all' || exercise.group === group) &&
      normalize(`${exercise.title} ${exercise.muscles} ${exercise.equipment}`).includes(term));
    title.textContent = group === 'all' ? 'Упражнения по группам мышц' : groupFilters.find(filter => filter.id === group).title;
    count.textContent = movementCount(entries.length);
    grid.innerHTML = entries.map(exercise => exerciseCard(exercise, selection.includes(exercise.id), getOpenTechnique())).join('') ||
      '<p class="empty">Ничего не найдено. Измените запрос или выберите другую группу мышц.</p>';
  }

  function showHome() {
    root.classList.remove('stretch-in-session');
    home.hidden = false;
    guided.hidden = true;
    resume.hidden = !session || !!session.day.finished_at;
    if(!resume.hidden)resume.textContent='Продолжить · '+session.title;
  }

  function openCatalog() {
    if (!home.hidden) return;
    suspend();
    stopTimer();
    keepAwake(false);
    showHome();
  }

  function showStep() {
    active=!root.hidden;
    root.classList.add('stretch-in-session');
    home.hidden = true;
    guided.hidden = false;
    const {title, steps, position, day} = session;
    const step = steps[position];
    const result=sessionResult(day);
    const savedLabel=result.status==='completed'?'Сохранить занятие':'Сохранить частичный результат';
    const finish=`<details class="finish-choice"><summary>На сегодня всё</summary><p>В дневник попадёт только выполненное. Пропущенное не будет отмечено как готовое. После сохранения занятие закроется.</p><button class="button secondary" data-stretch-finish ${result.worked?'':'disabled'}>${savedLabel}</button></details>`;
    if (!step) {
      guided.innerHTML = `<div class="stretch-complete">${icon('check')}<h2 tabindex="-1">${result.status==='completed'?'Растяжка выполнена':'Растяжка пройдена'}</h2><p>${esc(title)}</p><p>Выполнено шагов: ${result.stretch.done} из ${steps.length}${result.stretch.skipped?' · пропущено: '+result.stretch.skipped:''}</p><button class="button primary" data-stretch-finish ${result.worked?'':'disabled'}>${savedLabel}</button><button class="button quiet" data-stretch-previous>← Вернуться к упражнениям</button><button class="button quiet" data-stretch-home>К комплексам</button></div>`;
    } else {
      const exercise = stretchExercise(step.id,session.settings);
      const side = exercise.unilateral ? ` · ${step.side===1?'левая сторона':'правая сторона'}` : '';
      const label = step.side === 1 && exercise.unilateral ? 'Левая готова → правая' : position === steps.length - 1 ? 'Готово → к результату' : 'Готово → дальше';
      guided.innerHTML = `<div class="stretch-step-heading">
        <button class="button quiet" data-stretch-home>← Комплексы</button>
        <div><span class="eyebrow">${esc(title)}</span><h2 tabindex="-1">Движение ${step.exerciseIndex + 1} из ${session.exerciseCount}${side}</h2></div>
      </div>
      <progress class="stretch-progress" max="${steps.length}" value="${result.stretch.done}" aria-label="Выполнено шагов"></progress>
      <p class="flow-save-note">${day.local?'Шаг сохранён на этом устройстве. Для записи в дневник понадобится интернет.':'Шаг сохранён. Можно вернуться к занятию позже.'}</p>
      ${exerciseCard(exercise, false, getOpenTechnique(), step.side)}
      <div class="stretch-step-actions">
        ${exercise.seconds ? `<button class="button secondary" data-stretch-hold>${icon('clock')} Удержание ${exercise.seconds} с</button>` : ''}
        <button class="button primary" data-stretch-next>${label}</button>
      </div>
      <div class="stretch-step-secondary">
        <button class="text-button" data-stretch-previous ${position === 0 ? 'disabled' : ''}>← Предыдущий шаг</button>
        <button class="text-button" data-stretch-skip>Пропустить движение</button>
      </div>${finish}`;
    }
    if(active){
      if(timer)restoreTimer(timer);
      guided.querySelector('h2').focus({preventScroll: true});
      root.scrollIntoView({block: 'start'});
    }
  }

  async function start(title, ids, day, settings=day?.stretch_settings||{}) {
    if(!ids.length||saving)return;
    suspend();stopTimer();
    const previousId=session?.day?.id;
    if(!day||day.finished_at){
      saving=true;
      day=await hooks.start?.({title,ids,settings,date:today(),planId:'stretch-'+crypto.randomUUID()});
      saving=false;
      if(!day){showHome();return;}
    }
    if(previousId!==day.id||session?.position!==(day.stretch_state?.position||0))timer=null;
    bindDay(day);persist();showStep();
  }

  root.querySelector('#stretch-presets').innerHTML = stretchPresets.map((preset, index) =>
    `<button class="stretch-preset" data-stretch-preset="${preset.id}">
      ${anatomy(['all', 'legs', 'shoulders'][index])}<span><strong>${preset.title}</strong><small>${preset.description}</small><small>${movementCount(preset.ids.length)} · ${minutes(preset.ids)}</small></span>${icon('arrow')}
    </button>`
  ).join('');
  filterBar.innerHTML = groupFilters.map(filter => `<button class="button quiet" data-stretch-group="${filter.id}" aria-pressed="false">${filter.title}</button>`).join('');
  renderGroup();
  renderSelection();

  showHome();
  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button||button.disabled||saving) return;
    const {stretchAdd, stretchRemove, stretchPreset} = button.dataset;
    if (stretchAdd || stretchRemove) {
      const id = stretchAdd || stretchRemove;
      const included = !selection.includes(id) && !!stretchAdd;
      selection = included ? [...selection, id] : selection.filter(saved => saved !== id);
      try {localStorage.setItem(selectionKey, JSON.stringify(selection));} catch {}
      renderSelection();
      const cardButton = grid.querySelector(`[data-stretch-add="${id}"]`);
      if (cardButton) {
        cardButton.setAttribute('aria-pressed', String(included));
        cardButton.innerHTML = `${icon(included ? 'check' : 'plus')} ${included ? 'В подборке' : 'В мою подборку'}`;
      }
      if (stretchRemove) (selectedList.querySelector('button') || cardButton || filterBar.querySelector('[aria-pressed="true"]')).focus();
      return;
    }
    if (stretchPreset) {
      const preset = stretchPresets.find(item => item.id === stretchPreset);
      start(preset.title, preset.ids);
      return;
    }
    if (button.hasAttribute('data-stretch-custom')) start('Моя подборка', selection);
    if (button.hasAttribute('data-stretch-after-start')) start('После тренировки', workoutCooldown);
    if (button.hasAttribute('data-stretch-home')) {
      suspend();
      stopTimer();
      keepAwake(false);
      showHome();
      (resume.hidden ? root.querySelector('[data-stretch-preset]') : resume).focus({preventScroll: true});
      root.scrollIntoView({block: 'start'});
    }
    if (button.hasAttribute('data-stretch-resume')) showStep();
    if (!session || guided.hidden) return;
    if(button.hasAttribute('data-stretch-finish')){
      saving=true;guided.querySelectorAll('button').forEach(button=>button.disabled=true);suspend();stopTimer();
      const result=await hooks.finish?.(session.day);
      saving=false;
      if(result){session=null;timer=null;localStorage.removeItem(resumeKey);showHome();hooks.changed?.();}
      else showStep();
      return;
    }
    if(button.hasAttribute('data-stretch-previous'))return move('previous');
    const step=session.steps[session.position];
    if(!step)return;
    if(button.hasAttribute('data-stretch-hold')){timer=null;startTimer(stretchExercise(step.id,session.settings).seconds,'Удержание растяжки',holdMessage);}
    if(button.hasAttribute('data-stretch-next'))await move('next');
    if(button.hasAttribute('data-stretch-skip'))await move('skip');
  });

  return {
    start,suspend,resume:()=>session&&showStep(),
    get current(){return session?.day;},
    sync(days){
      const day=days.find(item=>item.id===session?.day?.id);
      if(!day||saving||session.day.local)return;
      if(day.finished_at){session=null;timer=null;localStorage.removeItem(resumeKey);if(active)showHome();return;}
      if(day.stretch_revision!==(session.day.stretch_revision||0)){bindDay(day);timer=null;persist();if(active)showStep();}
    },
    get filters() { return {group, query}; },
    filterCatalog({group: nextGroup = group, query: nextQuery = query}) {
      group = nextGroup;
      query = nextQuery;
      openCatalog();
      renderGroup();
    },
    openCatalog,
    recommend(workedGroups) {
      workoutCooldown = stretchCooldown(workedGroups);
      cooldown.hidden = !workoutCooldown.length;
      cooldown.querySelector('p').textContent = workoutCooldown.length ? `${movementCount(workoutCooldown.length)} · ${minutes(workoutCooldown)}. Подборка по группам мышц выбранной тренировки.` : '';
      showHome();
    }
  };
}
