import {groups} from './catalog.js';
import {icon, anatomy} from './icons.js';
import {stretches, stretchById, stretchPresets, stretchCooldown} from './stretch-catalog.js';
import {keepAwake, startTimer, stopTimer} from './timer.js';

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

export function initStretch(root, getOpenTechnique) {
  let group = 'all';
  let query = '';
  let selection = [];
  let workoutCooldown = [];
  let session = null;
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
    resume.hidden = !session || session.position >= session.steps.length;
  }

  function openCatalog() {
    if (!home.hidden) return;
    stopTimer();
    keepAwake(false);
    showHome();
  }

  function showStep() {
    root.classList.add('stretch-in-session');
    home.hidden = true;
    guided.hidden = false;
    const {title, steps, position, day} = session;
    const step = steps[position];
    if (!step) {
      guided.innerHTML = `<div class="stretch-complete">${icon('check')}<h2 tabindex="-1">Комплекс завершён</h2><p>${title}</p>${day ? `<button class="button primary" data-day-stretch-finish data-write data-workout-date="${day.workout_date}" data-workout-plan="${day.plan_id}">Сохранить в дневник</button>` : '<button class="button primary" data-stretch-home>К комплексам</button>'}</div>`;
    } else {
      const exercise = stretchById[step.id];
      const side = exercise.unilateral ? ` · сторона ${step.side} из 2` : '';
      const label = step.side === 1 && exercise.unilateral ? 'Сменить сторону' : position === steps.length - 1 ? 'Завершить' : 'Следующее упражнение';
      guided.innerHTML = `<div class="stretch-step-heading">
        <button class="button quiet" data-stretch-home>← Комплексы</button>
        <div><span class="eyebrow">${title}</span><h2 tabindex="-1">Движение ${step.exerciseIndex + 1} из ${session.exerciseCount}${side}</h2></div>
      </div>
      <progress class="stretch-progress" max="${steps.length}" value="${position}" aria-label="Пройдено шагов"></progress>
      ${exerciseCard(exercise, false, getOpenTechnique(), step.side)}
      <div class="stretch-step-actions">
        ${exercise.seconds ? `<button class="button secondary" data-stretch-hold>${icon('clock')} Удержание ${exercise.seconds} с</button>` : ''}
        <button class="button primary" data-stretch-next>${label} ${icon('arrow')}</button>
      </div>
      <div class="stretch-step-secondary">
        <button class="text-button" data-stretch-previous ${position === 0 ? 'disabled' : ''}>← Предыдущий шаг</button>
        <button class="text-button" data-stretch-skip>Пропустить движение</button>
      </div>`;
    }
    guided.querySelector('h2').focus({preventScroll: true});
    root.scrollIntoView({block: 'start'});
  }

  function goToStep(position) {
    stopTimer();
    keepAwake(false);
    session.position = position;
    showStep();
  }

  function start(title, ids, day) {
    if (!ids.length) return;
    if(day && session?.day?.id===day.id){showStep();return;}
    const steps = ids.flatMap((id, exerciseIndex) => {
      const first = {id, exerciseIndex, side: 1};
      return stretchById[id].unilateral ? [first, {...first, side: 2}] : [first];
    });
    session = {title, steps, exerciseCount: ids.length, position: 0, day};
    goToStep(0);
  }

  root.querySelector('#stretch-presets').innerHTML = stretchPresets.map((preset, index) =>
    `<button class="stretch-preset" data-stretch-preset="${preset.id}">
      ${anatomy(['all', 'legs', 'shoulders'][index])}<span><strong>${preset.title}</strong><small>${preset.description}</small><small>${movementCount(preset.ids.length)} · ${minutes(preset.ids)}</small></span>${icon('arrow')}
    </button>`
  ).join('');
  filterBar.innerHTML = groupFilters.map(filter => `<button class="button quiet" data-stretch-group="${filter.id}" aria-pressed="false">${filter.title}</button>`).join('');
  renderGroup();
  renderSelection();

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
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
      stopTimer();
      keepAwake(false);
      showHome();
      (resume.hidden ? root.querySelector('[data-stretch-preset]') : resume).focus({preventScroll: true});
      root.scrollIntoView({block: 'start'});
    }
    if (button.hasAttribute('data-stretch-resume')) showStep();
    if (!session || guided.hidden) return;
    const step = session.steps[session.position];
    if (!step) return;
    if (button.hasAttribute('data-stretch-hold')) startTimer(stretchById[step.id].seconds, 'Удержание растяжки', holdMessage);
    if (button.hasAttribute('data-stretch-next')) goToStep(session.position + 1);
    if (button.hasAttribute('data-stretch-previous')) goToStep(session.position - 1);
    if (button.hasAttribute('data-stretch-skip')) {
      const next = session.steps.findIndex((item, index) => index > session.position && item.id !== step.id);
      goToStep(next === -1 ? session.steps.length : next);
    }
  });

  return {
    start,
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
