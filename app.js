import {createTimerAudio,createTimerWakeLock} from './timer-audio.js';
import { exercises, days as templates, totalSets } from './exercises.js';
import { stretches, stretchGroups, stretchRecommendations, stretchMatches, updateStretches } from './stretches.js';
import { initialPlanner, groups, weekdays, shorts, resizeSchedule, recommendations, hasAdjacentDays, updateItems } from './planner.js';

const $ = selector => document.querySelector(selector);
const KEY = 'juligym:v1';
let storageAvailable = true;
function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
  } catch { return {}; }
}
const stored = readState();
const state = {
  ...initialPlanner(stored),
  mode: stored.mode === 'regular' ? 'regular' : 'easy',
  sessions: stored.sessions && typeof stored.sessions === 'object' && !Array.isArray(stored.sessions) ? stored.sessions : {},
  history: Array.isArray(stored.history) ? stored.history.filter(x => x && [1,2,3,4,5,6,7].includes(x.day) && typeof x.date === 'string').slice(-100) : []
};
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { if (storageAvailable) toast('Браузер не разрешает сохранение. Отметки останутся до закрытия страницы.'); storageAvailable = false; }
}
const currentDay = () => state.plans.find(d => d.id === state.day);
const activeDays = () => state.schedule.map(s=>({...state.plans.find(p=>p.id===s.planId), weekday:weekdays[s.weekday], short:shorts[s.weekday]}));
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selectedExercise = 'squat';
let librarySearch = '';
let libraryMode='strength';
let previewOpen=false;
const openGroups={strength:new Set(),stretch:new Set()};
let equipmentFilter='all',levelFilter='all';
const selectedByMode={strength:'squat',stretch:'stretchquad'};
const allExercises={...exercises,...stretches};
let viewMode='plan',exerciseIndex=0,timerExercise=null;
const todayIndex=(new Date().getDay()+6)%7;
viewMode=state.schedule.some(s=>s.weekday===todayIndex)?'train':'plan';
const todaySlot=state.schedule.find(s=>s.weekday===todayIndex);
if(todaySlot && !stored.day)state.day=todaySlot.planId;
const setCount = () => state.mode === 'easy' ? 1 : 2;
const sessionKey = () => `${state.day}:${state.mode}`;
function session() {
  const key = sessionKey();
  if (!state.sessions[key] || typeof state.sessions[key] !== 'object' || Array.isArray(state.sessions[key])) state.sessions[key] = { done: [], finished: false };
  const s = state.sessions[key];
  const allowed = currentDay().items.flatMap(id => Array.from({ length:setCount() }, (_, i) => `${id}:${i}`));
  s.done = Array.isArray(s.done) ? [...new Set(s.done.filter(x => allowed.includes(x)))] : [];
  s.finished = s.finished === true && allowed.length > 0 && s.done.length === allowed.length;
  s.stretchDone=Array.isArray(s.stretchDone)?[...new Set(s.stretchDone.filter(id=>currentDay().stretches.includes(id)))]:[];
  return s;
}
function toast(message) { $('#toast').textContent = message; clearTimeout(toast.timeout); toast.timeout = setTimeout(() => { $('#toast').textContent = ''; }, 5000); }
function estimateMinutes(plan){return Math.round(5+plan.items.reduce((n,id)=>n+(setCount()*((exercises[id].side?2:1)*40+exercises[id].rest))/60,0));}
function equipmentIcon(text){const shape=/гантел/i.test(text)?'<path d="M3 7v10m4-13v16m0-8h10m0-8v16m4-13v10"/>':/стул/i.test(text)?'<path d="M5 3v12h14V8H5m0 7v6m12-6v6"/>':/стен/i.test(text)?'<path d="M4 3v18m0-12h16M4 15h16M11 3v6m5 0v6m-5 0v6"/>':'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v12"/>';return `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${shape}</svg>`;}
function phaseLabels(e) { return e.phases.map((p, i) => `<div class="phase-label"><b>${['01 · НАЧАЛО', '02 · ДВИЖЕНИЕ', (e.seconds || e.unit==='seconds')?'03 · УДЕРЖАНИЕ':'03 · КОНЕЧНАЯ ФАЗА'][i]}</b>${p}</div>`).join(''); }
function asset(id) { return `./assets/exercises/${id}.webp`; }
function weekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return start;
}
function renderWeek() {
  $('#week-count').value = state.schedule.length;
  const since = weekStart().getTime();
  const completed = new Set(state.history.filter(h=>new Date(h.date).getTime()>=since).map(h=>h.day));
  $('#week-strip').innerHTML = shorts.map((label,i)=>{
    const slot=state.schedule.find(s=>s.weekday===i);
    return `<div class="week-day"><button class="day-circle ${slot?'work':''} ${i===todayIndex?'today':''} ${slot && completed.has(slot.planId)?'done':''}" data-weekday="${i}" aria-pressed="${!!slot}" aria-label="${weekdays[i]}: ${slot?'убрать тренировку':'добавить тренировку'}"><span>${label}</span><strong>${new Date(since+i*86400000).getDate()+'<span class="week-month"> '+new Date(since+i*86400000).toLocaleDateString('ru-RU',{month:'short'})+'</span>'}</strong><small>${slot ? (completed.has(slot.planId)?'✓ Выполнено':'● Тренировка') : '+ Отдых'}</small></button></div>`;
  }).join('');
  $('#week-note').textContent = hasAdjacentDays(state.schedule) ? 'Есть занятия подряд. Не нагружайте одну группу мышц в соседние дни; для начала удобнее 2–3 занятия через день.' : 'За неделю: '+state.schedule.filter(s=>completed.has(s.planId)).length+' из '+state.schedule.length+' тренировок.';
  $('#week-assignments').innerHTML = state.schedule.map(slot=>{
    const plan=state.plans.find(p=>p.id===slot.planId);
    return `<div class="week-assignment"><button data-day="${plan.id}" class="assignment-day" aria-label="Открыть комплекс: ${weekdays[slot.weekday]}">${shorts[slot.weekday]}</button><select data-template="${plan.id}" aria-label="Комплекс на ${weekdays[slot.weekday]}"><option value="current">${escape(plan.title)} · ${plan.items.length} упр.</option><optgroup label="Заменить готовым комплексом">${templates.map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}</optgroup><option value="empty">Собрать с нуля</option></select></div>`;
  }).join('');
}
function renderTabs() {
  $('#day-tabs').innerHTML = activeDays().map(d=>`<button id="tab-${d.id}" class="day-tab" role="tab" aria-selected="${state.day===d.id}" aria-controls="day-panel" tabindex="${state.day===d.id?'0':'-1'}" data-day="${d.id}"><span class="tab-number">${d.short}</span><span class="tab-label"><small>${d.weekday.toUpperCase()} · ${d.items.length} УПР.</small><strong>${escape(d.title)}</strong><span>${d.items.length} упражнений · ≈ ${estimateMinutes(d)} мин</span></span><span class="tab-arrow" aria-hidden="true">→</span></button>`).join('');
}
function renderLibrary() {
  const isStretch=libraryMode==='stretch';
  const catalog=isStretch?stretches:exercises;
  const e=catalog[selectedExercise], plan=currentDay();
  const included=isStretch?plan.stretches:plan.items;
  const rec=isStretch?stretchRecommendations(plan.items,included):recommendations(selectedExercise,plan.items);
  $('#library-selected').hidden=Boolean(librarySearch.trim());
  document.querySelectorAll('[data-library-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryMode===libraryMode)));
  $('#library-target').textContent=activeDays().find(d=>d.id===state.day).weekday+(isStretch?' · после тренировки':'');
  const added=included.includes(selectedExercise);
  const action=isStretch?'data-add-stretch':'data-add';
  const dose=isStretch?`1 × ${e.seconds} с${e.side?' на каждую сторону':''}`:`${setCount()} × ${state.mode==='easy'?e.easy:e.reps}${e.unit==='seconds'?' с':''}${e.side?' на сторону':''} · отдых ${e.rest} с`;
  const matched=isStretch?stretchMatches(selectedExercise,plan.items):[];
  $('#library-selected').innerHTML=`<details class="library-detail" id="library-detail" ${previewOpen?'open':''}><summary><span>Техника: ${e.title}</span><b>⌄</b></summary><div class="library-preview"><button class="library-preview-image" data-image="${selectedExercise}" aria-label="Посмотреть технику: ${e.title}"><img src="${asset(selectedExercise)}" alt="Три фазы: ${e.title}"><span>Увеличить ↗</span></button><h3>${e.title}</h3><p>${e.cue}</p><div class="library-dose">${dose}</div><p class="level-note">${e.level==='progress'?'После освоения базы':'Начальный уровень'} · ${e.equipment}</p>${isStretch?`<p class="stretch-match">${matched.length?'Подходит после: '+matched.map(id=>exercises[id].title).join(', '):'В текущем комплексе нет целевой нагрузки на эту группу. Можно выбрать вручную.'}</p>`:''}<button class="button primary library-add" ${action}="${selectedExercise}" ${added?'disabled':''}>${added?'✓ Уже в плане':isStretch?'+ Добавить после тренировки':'+ Добавить в тренировку'}</button></div><section class="recommendations" aria-label="Рекомендуемые дополнения"><h3>${isStretch?'Растяжка под вашу тренировку':'Хорошо дополнит'}</h3><p>${isStretch?'Выбраны мышцы из силовой части этого дня. Начните с 2–3 комфортных вариантов.':'Учитываем выбранное движение и состав тренировки. Это варианты, не обязательная нагрузка.'}</p>${rec.map(r=>`<div class="recommendation"><button data-select-exercise="${r.id}" class="recommendation-name">${catalog[r.id].title}<small>${r.reason}</small></button><button ${action}="${r.id}" class="recommendation-add" aria-label="Добавить: ${catalog[r.id].title}">+</button></div>`).join('')}${rec.length?`<button class="text-button" id="${isStretch?'add-stretch-recommendations':'add-recommendations'}">Добавить подборку (${rec.length}) ↗</button>`:`<p>${isStretch?(plan.items.length?'Выбранная растяжка уже охватывает мышцы комплекса. Другие варианты доступны в группах ниже.':'Сначала добавьте силовые упражнения — появится подборка по их мышцам.'):'Базовые дополнения уже в комплексе. Другие варианты можно выбрать в библиотеке.'}</p>`}</section></details>`;
  const query=librarySearch.toLocaleLowerCase('ru').trim();let found=0;
  $('#library-groups').innerHTML=(isStretch?stretchGroups:groups).map(group=>{
    const ids=group.items.filter(id=>{
      const item=catalog[id],dumbbell=/гантел/i.test(item.equipment),support=/стул|стен|опор|ступень|стол/i.test(item.equipment);
      return (item.title+' '+item.muscles+' '+item.equipment+' '+group.title).toLocaleLowerCase('ru').includes(query)
        && (equipmentFilter==='all' || equipmentFilter==='dumbbell'&&dumbbell || equipmentFilter==='body'&&!dumbbell || equipmentFilter==='support'&&support)
        && (isStretch || levelFilter==='all' || (item.level || 'start')===levelFilter);
    });found+=ids.length;
    return ids.length?`<details class="library-group" data-group="${group.title}" ${query || openGroups[libraryMode].has(group.title)?'open':''}><summary>${group.title}<span>${ids.length} <b>⌄</b></span></summary>${ids.map(id=>`<div class="library-row"><button class="library-item ${id===selectedExercise?'selected':''}" data-select-exercise="${id}" aria-pressed="${id===selectedExercise}"><img src="${asset(id)}" alt="" loading="lazy"><span><strong>${catalog[id].title}</strong><small>${catalog[id].level==='progress'?'После базы · ':''}${catalog[id].muscles} · ${catalog[id].equipment}</small></span></button><button class="quick-add" ${action}="${id}" ${included.includes(id)?'disabled':''} aria-label="Добавить: ${catalog[id].title}">${included.includes(id)?'✓':'+'}</button></div>`).join('')}</details>`:'';
  }).join('') || '<p class="library-empty">Ничего не найдено. Измените запрос или фильтры.</p>';
  $('#library-result-count').textContent=`${found} из ${Object.keys(catalog).length}`;
  $('#library-level').disabled=isStretch;
  document.querySelectorAll('[data-library-mode]').forEach(b=>b.textContent=b.dataset.libraryMode==='strength'?`Силовые · ${Object.keys(exercises).length}`:`Растяжка · ${Object.keys(stretches).length}`);

}
function setLibraryMode(mode) {
  selectedByMode[libraryMode]=selectedExercise;libraryMode=mode;
  equipmentFilter='all';levelFilter='all';$('#library-equipment').value='all';$('#library-level').value='all';
  selectedExercise=selectedByMode[mode];previewOpen=false;librarySearch='';$('#library-search').value='';renderLibrary();
}
function addStretch(id) {
  if(!stretches[id] || currentDay().stretches.includes(id))return;
  updateStretches(state,state.day,[...currentDay().stretches,id]);save();renderLibrary();renderStretchSection();
  toast('Растяжка добавлена после тренировки.');
}
function stretchCard(id,index) {
  const e=stretches[id], done=session().stretchDone.includes(id);
  return `<article class="stretch-card ${done?'is-done':''}" id="stretch-${id}"><div class="card-header"><span class="exercise-index">${index+1}</span><div><h3>${e.title}</h3><p>${e.muscles}</p></div><button class="stretch-remove" data-remove-stretch="${id}" aria-label="Убрать растяжку: ${e.title}">×</button></div><button class="exercise-visual" data-image="${id}" aria-label="Увеличить растяжку: ${e.title}"><img src="${asset(id)}" alt="${e.title}: ${e.phases.join('; ')}" loading="lazy"><span class="zoom-icon" aria-hidden="true">⤢</span></button><div class="phase-labels">${phaseLabels(e)}</div><div class="prescription"><span class="rep-value">1 × ${e.seconds}<span class="rep-unit">секунд</span></span>${e.side?'<span class="rep-side">⇄ на каждую сторону</span>':''}<button class="rest-button" data-stretch-timer="${id}" aria-label="Таймер растяжки: ${e.title}">◷ Удержание</button></div><p class="cue">${e.cue}</p><details class="technique"><summary>Техника и облегчённый вариант</summary><ol>${e.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p><strong>Легче:</strong> ${e.easier}</p><p><strong>Следите:</strong> ${e.avoid}</p></details><div class="set-controls"><button class="set-button" data-stretch-done="${id}" aria-pressed="${done}">${done?'✓ Выполнено':e.side?'Обе стороны выполнены':'Растяжка выполнена'}</button></div></article>`;
}
function renderStretchSection() {
  const plan=currentDay(), rec=stretchRecommendations(plan.items,plan.stretches);
  $('#stretch-section').innerHTML=`<div class="stretch-heading"><div><div class="eyebrow">ПОСЛЕ СИЛОВОЙ ЧАСТИ</div><h2>Растяжка под вашу тренировку</h2><p>Спокойно походите 2–3 минуты, затем мягко потяните разогретые мышцы. Удерживайте 20 секунд, дышите свободно, без пружинящих движений и боли.</p></div><button class="button light" id="open-stretch-library">Выбрать растяжку +</button></div>${rec.length?`<div class="stretch-suggestions">${rec.map(r=>`<button data-add-stretch="${r.id}" aria-label="Добавить растяжку: ${stretches[r.id].title}"><img src="${asset(r.id)}" alt="" loading="lazy"><span><strong>${stretches[r.id].title}</strong><small>${r.reason}</small></span><b>+</b></button>`).join('')}</div>`:plan.items.length?'':'<p class="stretch-empty">Добавьте силовые упражнения, чтобы увидеть растяжку для задействованных мышц. Также можно выбрать варианты вручную.</p>'}<div class="stretch-progress">${plan.stretches.length?`${session().stretchDone.length} из ${plan.stretches.length} растяжек выполнено`:'Выберите несколько подходящих упражнений выше или в библиотеке.'} <span>Отметки отдельно от силовых подходов</span></div><div class="exercise-grid stretch-grid">${plan.stretches.map(stretchCard).join('')}</div>`;
}
function editPlan(items) {
  updateItems(state,state.day,items);
  save(); stopTimer(); render();
}
function addExercise(id) {
  if(!exercises[id] || currentDay().items.includes(id)) return;
  editPlan([...currentDay().items,id]);
  toast(`${exercises[id].title}: добавлено. В комплексе ${currentDay().items.length} упражнений.`);
}
function openLibrary() {
  setView('plan');document.body.classList.remove('sidebar-collapsed');
  const panel=$('#library');
  if(matchMedia('(max-width: 1000px)').matches) {
    panel.classList.add('is-open'); $('#library-backdrop').hidden=false;
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    document.querySelectorAll('body > header, body > main, body > footer, body > .offline-panel').forEach(el=>el.inert=true);
    document.body.classList.add('library-open');
    $('#library-close').focus();
  } else { $('#library-search').focus(); }
}
function closeLibrary() {
  if(matchMedia('(min-width:1001px)').matches){document.body.classList.add('sidebar-collapsed');$('#sidebar-toggle').setAttribute('aria-expanded','false');$('#sidebar-toggle').focus();return;}
  $('#library').classList.remove('is-open');$('#library-backdrop').hidden=true;
  $('#library').removeAttribute('role');$('#library').removeAttribute('aria-modal');
  document.querySelectorAll('body > header, body > main, body > footer, body > .offline-panel').forEach(el=>el.inert=false);
  document.body.classList.remove('library-open');
  $('#library-open').focus();
}
function renderCard(id, index) {
  const e = exercises[id];
  const done = session().done;
  const complete = Array.from({length:setCount()},(_,i)=>`${id}:${i}`).every(k=>done.includes(k));
  return `<article class="exercise-card ${complete ? 'is-done' : ''}" id="exercise-${id}" aria-labelledby="title-${id}">
    <div class="card-header"><span class="exercise-index">${String(index+1).padStart(2,'0')}</span><div><h3 id="title-${id}">${e.title}</h3><p>${e.muscles}</p></div><span class="equipment" title="${e.equipment}">${equipmentIcon(e.equipment)} ${e.equipment}</span></div><div class="exercise-edit"><button data-move="${id}" data-direction="-1" ${index===0?'disabled':''} aria-label="Выше: ${e.title}">↑</button><button data-move="${id}" data-direction="1" ${index===currentDay().items.length-1?'disabled':''} aria-label="Ниже: ${e.title}">↓</button><button data-remove="${id}" aria-label="Убрать: ${e.title}">Убрать ×</button></div>
    <button class="exercise-visual ${(['bridge','heel','bird'].includes(id) || e.equipment.includes('Коврик')) ? 'ground' : ''}" data-image="${id}" aria-label="Увеличить: ${e.title}, три фазы движения"><img src="${asset(id)}" alt="${e.title}: ${e.phases.join('; ')}. Коралловым выделены: ${e.muscles.toLowerCase()}." width="1536" height="1024" loading="${index < 2 ? 'eager' : 'lazy'}"><span class="zoom-icon" aria-hidden="true">⤢</span></button>
    <div class="phase-labels">${phaseLabels(e)}</div>
    <div class="prescription"><span class="rep-value">${setCount()} × ${state.mode === 'easy' ? e.easy : e.reps}<span class="rep-unit">${e.unit==='seconds'?'секунд':'повторов'}</span></span>${e.side ? '<span class="rep-side">на каждую<br>сторону</span>' : ''}<button class="rest-button" data-rest="${e.rest}" aria-label="Запустить отдых ${e.rest} секунд">◷ ${e.rest} с отдыха</button></div>
    <p class="cue"><span aria-hidden="true">↳</span>${e.cue}</p>
    <details class="technique"><summary>Техника и облегчённый вариант</summary><ol>${e.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p><strong>Если тяжело:</strong> ${e.easier}</p><p><strong>Следите:</strong> ${e.avoid}</p></details>
    <div class="set-controls">${Array.from({length:setCount()},(_,i)=>`<button class="set-button" data-set="${id}:${i}" aria-label="${e.title}, подход ${i+1}" aria-pressed="${done.includes(`${id}:${i}`)}" ${session().finished ? 'disabled' : ''}>${done.includes(`${id}:${i}`)?`Подход ${i+1} ✓`:`Подход ${i+1} из ${setCount()} — выполнен`}</button>`).join('')}<span class="set-help">${complete ? 'Готово, отлично!' : 'Отметьте после выполнения'}</span></div>
  </article>`;
}
function renderPanel() {
  const d = currentDay();
  $('#day-panel').setAttribute('aria-labelledby', `tab-${d.id}`);
  $('#day-panel').innerHTML = `<div class="day-panel-heading"><div><label class="plan-name-label"><span class="sr-only">Название комплекса</span><input id="plan-name" value="${escape(d.title)}" maxlength="60" aria-label="Название комплекса"><span aria-hidden="true">✎</span></label><p>Соберите комплекс из библиотеки. Упражнения можно убрать или поменять местами.</p></div><button class="button primary start-button" id="start-button">${session().done.length ? 'Продолжить тренировку' : 'К упражнениям'} <span aria-hidden="true">↓</span></button></div>
    <details class="warmup"><summary><span class="warmup-icon" aria-hidden="true">☀</span><span class="warmup-title">Сначала разминка</span><span class="warmup-sub">5 минут · без гантелей</span><span class="expand-icon" aria-hidden="true">+</span></summary><ol><li><strong>2 мин.</strong> Спокойно шагайте на месте.</li><li><strong>1 мин.</strong> Мягко вращайте плечами, затем сгибайте и разгибайте локти.</li><li><strong>1 мин.</strong> Неглубокие приседания с опорой на стул, в удобном темпе.</li><li><strong>1 мин.</strong> Несколько мягких наклонов от таза и подъёмов на носки с опорой.</li></ol></details>
    <div class="workout-meta"><span>${d.items.length} упражнений · ${totalSets(d,state.mode)} подходов${d.items.length>6?' · для начала можно оставить 4–6 упражнений':''}</span><span class="muscle-key">Работающие мышцы</span></div>
    <div class="exercise-grid">${d.items.length?d.items.map(renderCard).join(''):'<div class="empty-plan"><h3>Ваш комплекс начинается здесь</h3><p>Выберите упражнение в библиотеке слева. Мы предложим подходящие дополнения.</p><button class="button primary" id="empty-library">Открыть библиотеку +</button></div>'}<aside class="session-card" id="session-card" aria-label="Прогресс тренировки"></aside></div>`;
  if(!$('#stretch-section'))$('#day-panel').insertAdjacentHTML('beforeend','<section id="stretch-section" class="stretch-section" aria-label="Растяжка после тренировки"></section>');
  renderProgress();renderStretchSection();syncExperience();
}
function renderProgress() {
  const s = session();
  const total = totalSets(currentDay(), state.mode);
  const done = s.done.length;
  const all = total > 0 && done === total;
  $('#session-card').innerHTML = `<span class="session-icon" aria-hidden="true">${s.finished ? '✓' : '↗'}</span><h3>${s.finished ? 'Вы сделали это.' : all ? 'Все подходы выполнены!' : 'Сегодня — чуть сильнее.'}</h3><p>${s.finished ? 'Тренировка сохранена. Отдохните хотя бы один день, затем переходите к следующему дню программы.' : all ? 'Осталось спокойно завершить занятие и сохранить результат. Выделите 2–3 минуты на восстановление дыхания.' : 'Не нужно делать идеально. Двигайтесь спокойно, следите за техникой и отмечайте каждый выполненный подход.'}</p><div class="progress-meta"><span>День ${state.day} · ваш прогресс</span><span>${done} из ${total} подходов</span></div><div class="progress-track" role="progressbar" aria-label="Выполнено подходов" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><div class="progress-fill" style="width:${total?done/total*100:0}%"></div></div>${s.finished ? '<button class="button primary" id="new-session">Начать этот день заново ↻</button>' : `<button class="button primary" id="finish-session" ${!all ? 'disabled' : ''}>Завершить тренировку ✓</button>${done ? '<button class="text-button" id="reset-session">Сбросить отметки этого дня</button>' : ''}`}`;
}
function render() {
  renderWeek(); renderTabs(); renderPanel(); renderLibrary();renderToday();syncExperience();
  $('#mode').value = state.mode;
  $('#mode-note').textContent = state.mode === 'easy' ? 'Начните спокойно: важнее освоить движения.' : 'Переходите к двум подходам, когда хорошо восстанавливаетесь.';
}
function switchDay(day, focus = false) {
  exerciseIndex=0;stopTimer();state.day = day; save(); render();
  if (focus) $(`#tab-${day}`).focus();
}
function openDialog(id) { $(id).showModal(); }
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.day) switchDay(Number(button.dataset.day));
  if(button.dataset.libraryMode)setLibraryMode(button.dataset.libraryMode);
  if(button.id==='open-stretch-library'){setLibraryMode('stretch');openLibrary();}
  if(button.dataset.addStretch)addStretch(button.dataset.addStretch);
  if(button.dataset.removeStretch){updateStretches(state,state.day,currentDay().stretches.filter(id=>id!==button.dataset.removeStretch));save();renderStretchSection();renderLibrary();}
  if(button.id==='add-stretch-recommendations'){
    const ids=stretchRecommendations(currentDay().items,currentDay().stretches).map(r=>r.id);
    updateStretches(state,state.day,[...currentDay().stretches,...ids]);save();renderStretchSection();renderLibrary();toast(`Добавлено растяжек: ${ids.length}.`);
  }
  if(button.dataset.stretchDone){
    const id=button.dataset.stretchDone,s=session();
    s.stretchDone=s.stretchDone.includes(id)?s.stretchDone.filter(x=>x!==id):[...s.stretchDone,id];save();
    renderStretchSection();$(`[data-stretch-done="${id}"]`)?.focus({preventScroll:true});
  }
  if(button.dataset.stretchTimer){const e=stretches[button.dataset.stretchTimer];startTimer(e.seconds,'stretch',e.side?'Удержание завершено. Повторите с другой стороны.':'Удержание завершено. Плавно выйдите из положения.');}
  if (button.dataset.selectExercise) { previewOpen=true; selectedExercise=button.dataset.selectExercise; selectedByMode[libraryMode]=selectedExercise; librarySearch=''; $('#library-search').value=''; renderLibrary(); $('#library-selected').scrollIntoView({block:'nearest'}); }
  if (button.dataset.add) addExercise(button.dataset.add);
  if (button.id==='add-recommendations') {
    const ids=recommendations(selectedExercise,currentDay().items).map(r=>r.id);
    editPlan([...currentDay().items,...ids]);toast(`Добавлено упражнений: ${ids.length}.`);
  }
  if (button.dataset.remove) { editPlan(currentDay().items.filter(id=>id!==button.dataset.remove));toast('Упражнение убрано. Остальные отметки сохранены.'); }
  if (button.dataset.move) {
    const items=currentDay().items.slice(), index=items.indexOf(button.dataset.move), next=index+Number(button.dataset.direction);
    if(next>=0 && next<items.length){[items[index],items[next]]=[items[next],items[index]];currentDay().items=items;save();renderPanel();$(`[data-move="${button.dataset.move}"][data-direction="${button.dataset.direction}"]`)?.focus({preventScroll:true});}
  }
  if (['library-open','empty-library'].includes(button.id)) openLibrary();
  if (button.id==='library-close') closeLibrary();
  if (button.dataset.weekday!==undefined) {
    const weekday=Number(button.dataset.weekday), slot=state.schedule.find(s=>s.weekday===weekday);
    if(slot && state.schedule.length===1) return toast('Оставьте хотя бы один тренировочный день.');
    if(slot) state.schedule=state.schedule.filter(s=>s!==slot);
    else state.schedule.push({weekday,planId:[1,2,3,4,5,6,7].find(id=>!state.schedule.some(s=>s.planId===id))});
    state.schedule.sort((a,b)=>a.weekday-b.weekday);
    if(!state.schedule.some(s=>s.planId===state.day))state.day=state.schedule[0].planId;
    save();render();
  }
  if (button.dataset.image) {
    const id = button.dataset.image, e = allExercises[id];
    $('#image-title').textContent = e.title;
    $('#large-image').src = asset(id); $('#large-image').alt = `${e.title}. ${e.phases.join('. ')}. ${e.seconds?'Растягиваемые':'Работающие'} мышцы: ${e.muscles}.`;
    $('#large-phases').innerHTML = phaseLabels(e); $('#image-cue').textContent = e.cue; $('#image-technique').innerHTML=`<summary>Подробная техника</summary><ol>${e.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p><strong>Легче:</strong> ${e.easier}</p>`; openDialog('#image-dialog');
    $('#image-dialog .image-disclaimer').textContent=e.seconds?'Коралловым условно выделены растягиваемые мышцы. Не тянитесь через боль; плавно выходите из положения.':'Коралловым условно выделены работающие мышцы. После показанной фазы вернитесь в исходное положение по подсказке.';
    $('#image-dialog [data-phase="2"]').textContent=(e.seconds || e.unit==='seconds')?'Удержание':'Конец';
    $('#image-stage').className = 'image-stage';
    $('#image-stage').dataset.ground = String((['bridge','heel','bird'].includes(id) || e.equipment.includes('Коврик')));
    $('#large-image').style.transform = '';
    document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phase==='all')));
  }
  if (button.dataset.phase !== undefined) {
    const phase = button.dataset.phase;
    const zoomed = phase !== 'all';
    $('#image-stage').classList.toggle('zoomed',zoomed);
    $('#large-image').style.transform = zoomed ? `translateX(-${Number(phase)*100/3}%)` : '';
    document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }
  if (button.dataset.rest) startTimer(Number(button.dataset.rest));
  if (button.dataset.seconds) startTimer(Number(button.dataset.seconds),timerKind,timerTitle);
  if (button.dataset.set) {
    const key = button.dataset.set, s = session();
    if (s.finished) return;
    const completed = s.done.includes(key);
    s.done = completed ? s.done.filter(k=>k!==key) : [...s.done,key];
    button.setAttribute('aria-pressed', String(!completed));
    const id = key.split(':')[0];
    const card = button.closest('.exercise-card');
    const all = Array.from({length:setCount()},(_,i)=>`${id}:${i}`).every(k=>s.done.includes(k));
    card.classList.toggle('is-done',all);
    button.textContent = completed?`Подход ${Number(key.split(':')[1])+1} из ${setCount()} — выполнен`:`Подход ${Number(key.split(':')[1])+1} ✓`;
    card.querySelector('.set-help').textContent = all ? 'Готово, отлично!' : '';
    save(); renderProgress();renderToday();syncExperience();
    if (!completed) {
      if (s.done.length === totalSets(currentDay(),state.mode)) { stopTimer(); toast('Все подходы готовы. Нажмите «Завершить тренировку» ниже.'); }
      else {timerExercise=id;startTimer(exercises[id].rest);showInlineTimer();}
    }
  }
  if (button.classList.contains('dialog-close')) button.closest('dialog').close();
  if (button.id === 'start-button') {
    setView('train');exerciseIndex=Math.max(0,currentDay().items.findIndex(id=>Array.from({length:setCount()},(_,i)=>`${id}:${i}`).some(k=>!session().done.includes(k))));syncExperience();
    const id = currentDay().items.find(id => Array.from({length:setCount()},(_,i)=>`${id}:${i}`).some(k=>!session().done.includes(k)));
    const target = id ? $(`#exercise-${id}`) : $('#session-card');
    target.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
    target.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  if (button.id === 'finish-session') {
    const s = session();
    if (s.finished || !currentDay().items.length || s.done.length !== totalSets(currentDay(),state.mode)) return;
    s.finished = true;
    state.history.push({day:state.day,mode:state.mode,date:new Date().toISOString(),title:currentDay().title,items:currentDay().items.slice(),stretches:currentDay().stretches.slice()}); state.history = state.history.slice(-100);
    save(); stopTimer(); renderWeek(); renderPanel(); $('#new-session').focus({preventScroll:true}); toast('Тренировка сохранена. Теперь — время восстановиться.');
  }
  if (['new-session','reset-session'].includes(button.id)) {
    if (!confirm('Сбросить отметки этого дня для новой тренировки? История завершённых занятий сохранится.')) return;
    state.sessions[sessionKey()] = {done:[],finished:false};save();stopTimer();renderPanel();$('#start-button').focus({preventScroll:true});toast('Можно начинать новое занятие этого дня.');
  }
});
$('#day-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const ids=activeDays().map(d=>d.id), index=ids.indexOf(state.day);
  const day=event.key==='Home'?ids[0]:event.key==='End'?ids.at(-1):ids[(index+(event.key==='ArrowRight'?1:ids.length-1))%ids.length];
  switchDay(day,true);
});
document.addEventListener('change',event=>{
  if(event.target.id!=='plan-name')return;
  currentDay().title=event.target.value.trim() || 'Мой комплекс';
  event.target.value=currentDay().title;save();renderTabs();renderWeek();
});
$('#week-count').addEventListener('change',event=>{
  state.schedule=resizeSchedule(state.schedule,event.target.value);
  if(!state.schedule.some(s=>s.planId===state.day))state.day=state.schedule[0].planId;
  save();render();toast('Расписание сохранено. Настройте комплекс для каждого дня.');
});
$('#week-assignments').addEventListener('change',event=>{
  const select=event.target.closest('[data-template]');if(!select || select.value==='current')return;
  const plan=state.plans.find(p=>p.id===Number(select.dataset.template));
  if(plan.items.length && !confirm('Заменить упражнения этого комплекса? Отметки удалённых упражнений будут сброшены, история завершённых занятий сохранится.')) {select.value='current';return;}
  const template=templates.find(t=>t.id===Number(select.value));
  plan.title=template?template.title:'Мой комплекс';
  updateItems(state,plan.id,template?template.items:[]);updateStretches(state,plan.id,[]);state.day=plan.id;save();stopTimer();render();
  if(!plan.items.length)openLibrary();
});
$('#library-search').addEventListener('input',event=>{librarySearch=event.target.value;renderLibrary();});
$('#library-equipment').addEventListener('change',event=>{equipmentFilter=event.target.value;renderLibrary();});
$('#library-level').addEventListener('change',event=>{levelFilter=event.target.value;renderLibrary();});
$('#library').addEventListener('toggle',event=>{
 if(event.target.id==='library-detail' && event.target.isConnected)previewOpen=event.target.open;
 if(event.target.matches('.library-group') && event.target.isConnected && !librarySearch.trim()){
  const name=event.target.dataset.group;
  if(event.target.open)openGroups[libraryMode].add(name);else openGroups[libraryMode].delete(name);
 }
},true);

$('#library-backdrop').addEventListener('click',closeLibrary);
document.addEventListener('keydown',event=>{
  if(!$('#library').classList.contains('is-open') || document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){event.preventDefault();closeLibrary();}
  if(event.key==='Tab'){
    const nodes=[...$('#library').querySelectorAll('button:not(:disabled),input,select:not(:disabled),summary')].filter(el=>el.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);
    if(!$('#library').contains(document.activeElement)){event.preventDefault();first.focus();}
    else if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
});
matchMedia('(max-width: 1000px)').addEventListener('change',()=>{if($('#library').classList.contains('is-open'))closeLibrary();});
$('#mode').addEventListener('change', event => { state.mode = event.target.value; save(); render(); toast('Для каждого режима сохраняются отдельные отметки.'); });
$('#guide-open').addEventListener('click',()=>openDialog('#guide-dialog'));
$('#about-open').addEventListener('click',()=>openDialog('#about-dialog'));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
}));

let deadline = 0, remaining = 0, running = false, interval;
let timerKind='rest',timerTitle='',timerDuration=60;
const timerAudio=createTimerAudio(message=>toast(message)),keepScreenAwake=createTimerWakeLock();
function renderSound(){const button=$('#timer-sound');button.textContent=timerAudio.enabled?'Звук включён':'Звук выключен';button.setAttribute('aria-pressed',String(timerAudio.enabled));}
renderSound();
$('#timer-sound').addEventListener('click',()=>{timerAudio.setEnabled(!timerAudio.enabled);renderSound();if(running && timerAudio.enabled)timerAudio.start(Math.max(0,(deadline-Date.now())/1000));});
function displayTimer() {
  if (running) remaining = Math.max(0,Math.ceil((deadline-Date.now())/1000));
  document.querySelectorAll('.inline-time').forEach(n=>n.textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'));
  $('#timer-value').textContent = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  if (running && remaining === 0) {
    if(timerAudio.enabled){try{navigator.vibrate?.([150,80,150]);}catch{}} clearInlineTimer();
    running = false; clearInterval(interval);timerAudio.finish();keepScreenAwake(false); $('#timer-label').textContent = timerKind==='stretch'?'УДЕРЖАНИЕ ЗАВЕРШЕНО':'ОТДЫХ ЗАВЕРШЁН';
    $('#timer-toggle').textContent = '↻'; $('#timer-toggle').setAttribute('aria-label',`Повторить ${timerDuration} секунд`); toast(timerKind==='stretch'?timerTitle:'Отдых завершён. Продолжайте, когда будете готовы.');
  }
}
function startTimer(seconds,kind='rest',title='') {
  clearInlineTimer();
  timerKind=kind;timerTitle=title;timerDuration=seconds;
  $('#timer').setAttribute('aria-label',kind==='stretch'?'Таймер растяжки':'Таймер отдыха');
  document.querySelector('.timer-presets').innerHTML=(kind==='stretch'?[20,30]:[45,60,90]).map(n=>`<button data-seconds="${n}">${n} с</button>`).join('');
  remaining = seconds; deadline = Date.now()+seconds*1000; running=true;
  $('#timer').hidden = false; $('#timer-label').textContent = kind==='stretch'?'МЯГКАЯ РАСТЯЖКА · УДЕРЖАНИЕ':'ОТДЫХ МЕЖДУ ПОДХОДАМИ';
  $('#timer-toggle').textContent = 'Ⅱ'; $('#timer-toggle').setAttribute('aria-label','Приостановить таймер');
  timerAudio.start(seconds);keepScreenAwake(true);clearInterval(interval);interval=setInterval(displayTimer,250);displayTimer();
}
function stopTimer() { clearInterval(interval);running=false;clearInlineTimer();timerAudio.cancel();keepScreenAwake(false);$('#timer').hidden=true; }
$('#timer-close').addEventListener('click',stopTimer);
$('#timer-toggle').addEventListener('click',()=>{
  if (remaining === 0) return startTimer(timerDuration,timerKind,timerTitle);
  if (running) { displayTimer();if(!running)return;running=false;timerAudio.cancel();keepScreenAwake(false);clearInterval(interval);$('#timer-label').textContent='ТАЙМЕР НА ПАУЗЕ';$('#timer-toggle').textContent='▶';$('#timer-toggle').setAttribute('aria-label','Продолжить таймер'); }
  else {const duration=timerDuration;startTimer(remaining,timerKind,timerTitle);timerDuration=duration;}
});
document.addEventListener('visibilitychange',()=>{if(running){displayTimer();if(running && document.visibilityState==='visible')timerAudio.start(Math.max(0,(deadline-Date.now())/1000));}});

function printStretches(plan) {
  if(!plan.stretches.length)return '';
  return `<div class="print-stretches"><h3>После силовой части: растяжка</h3><p>Мягкое натяжение без боли и пружинящих движений. Дышите свободно. Один раз по 20 секунд${plan.stretches.some(id=>stretches[id].side)?', в односторонних упражнениях — с каждой стороны':''}.</p>${plan.stretches.map(id=>{const e=stretches[id];return `<article class="print-exercise"><img src="${asset(id)}" alt="${e.title}"><div><h3>${e.title}</h3><p><strong>1 × ${e.seconds} секунд${e.side?' на сторону':''}</strong> · ${e.muscles}</p><p>${e.cue}</p><p>${e.steps[0]} ${e.steps[1]}</p></div></article>`;}).join('')}</div>`;
}
function preparePrint() {
  $('#print-area').innerHTML = `<h1>Моя домашняя тренировка</h1><p>Ваше расписание: ${activeDays().map(d=>d.weekday).join(', ')}. Между нагрузкой на одну группу мышц оставляйте день отдыха.</p><p>Первые 2 недели — 1 подход каждого упражнения. Основной режим — 2 подхода при хорошем восстановлении. Сначала все подходы одного упражнения, затем следующее. Оставляйте запас 2–3 повтора. Выдох на усилии, возвращение плавное.</p><p>Разминка 5 минут: 2 минуты шага на месте; по минуте движений плечами и локтями, неглубоких приседаний с опорой, наклонов от таза и подъёмов на носки.</p>${activeDays().map((d,i)=>`<section class="${i ? 'print-day' : ''}"><h2>${d.weekday}. ${escape(d.title)}</h2><p>${d.items.length?'Ваш выбранный комплекс':'Комплекс пока пуст: добавьте упражнения из библиотеки.'}</p>${d.items.map((id,n)=>{const e=exercises[id];return `<article class="print-exercise"><img src="${asset(id)}" alt="${e.title}"><div><h3>${n+1}. ${e.title}</h3><p><strong>Старт: 1 × ${e.easy}${e.unit==='seconds'?' с':''} · Основной: 2 × ${e.reps}${e.unit==='seconds'?' с':''}${e.side?' на каждую сторону':''} · Отдых ${e.rest} с</strong></p><p>${e.muscles}.</p><p>${e.cue} ${e.steps[2]}</p><p>Легче: ${e.easier}</p></div></article>`;}).join('')}${printStretches(d)}<p class="print-note">Завершение: спокойно походите 2–3 минуты. При острой боли, головокружении, боли в груди или необычной одышке остановитесь. При известных ограничениях согласуйте занятия со специалистом.</p></section>`).join('')}`;
}
$('#print-button').addEventListener('click',async()=>{
  preparePrint();
  await Promise.all([...$('#print-area').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  window.print();
});
window.addEventListener('beforeprint',preparePrint);
function setView(mode){viewMode=mode;document.body.dataset.view=mode;document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));syncExperience();}
function renderToday(){
 const sorted=[...state.schedule].sort((a,b)=>(a.weekday-todayIndex+7)%7-(b.weekday-todayIndex+7)%7),slot=sorted[0],plan=state.plans.find(p=>p.id===slot.planId);
 const today=slot.weekday===todayIndex;
 $('#today-summary').innerHTML=`<div><span class="section-kicker">${today?'СЕГОДНЯ · ВАШ ПЛАН':'СЕГОДНЯ · ВОССТАНОВЛЕНИЕ'}</span><h2>${today?escape(plan.title):'День для себя'}</h2><p>${today?`${plan.items.length} упражнений · ≈ ${estimateMinutes(plan)} мин`:`Спокойная прогулка и отдых. Ближайшая тренировка — ${weekdays[slot.weekday].toLowerCase()}: ${escape(plan.title)}.`}</p></div><button class="button primary" data-start-day="${plan.id}">${today?'Начать тренировку':'К ближайшей тренировке'} →</button>`;
}
function syncExperience(){
 document.body.dataset.view=viewMode;
 document.body.classList.toggle('workout-finished',session().finished);
 document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===viewMode)));
 const cards=[...document.querySelectorAll('#day-panel > .exercise-grid > .exercise-card')];exerciseIndex=Math.min(exerciseIndex,Math.max(0,cards.length-1));
 cards.forEach((card,i)=>card.classList.toggle('current-exercise',i===exerciseIndex));
 const old=$('#exercise-navigation');if(old)old.remove();
 if(cards.length){const bar=document.createElement('div');bar.id='exercise-navigation';bar.innerHTML=`<button data-exercise-step="-1" ${exerciseIndex===0?'disabled':''}>← Назад</button><strong>Упражнение ${exerciseIndex+1} из ${cards.length}</strong><button data-exercise-step="1" ${exerciseIndex===cards.length-1?'disabled':''}>Далее →</button>`;$('.workout-meta').after(bar);}
 const total=totalSets(currentDay(),state.mode),percent=total?Math.round(session().done.length/total*100):0;
 let progress=$('#current-progress');if(!progress && $('.day-panel-heading')){progress=document.createElement('div');progress.id='current-progress';$('.day-panel-heading > div').after(progress);}
 if(progress)progress.innerHTML=`<div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><span>${percent}% выполнено · ${session().done.length} из ${total} подходов</span>`;
 if($('#plan-name'))$('#plan-name').readOnly=viewMode==='train';
 const filterCount=Number(equipmentFilter!=='all')+Number(levelFilter!=='all');$('#filter-count').textContent=filterCount?`(${filterCount})`:'';
 if($('#active-filters'))$('#active-filters').innerHTML=filterCount?`<span>${[equipmentFilter!=='all'?$('#library-equipment').selectedOptions[0].text:'',levelFilter!=='all'?$('#library-level').selectedOptions[0].text:''].filter(Boolean).join(' · ')}</span><button data-reset-filters aria-label="Сбросить фильтры">×</button>`:'';
 document.querySelectorAll('[data-nav]').forEach(b=>b.setAttribute('aria-current',b.dataset.nav===(viewMode==='train'?'today':'week')?'page':'false'));
}
function clearInlineTimer(){document.querySelectorAll('.inline-rest').forEach(n=>n.remove());}
function showInlineTimer(){clearInlineTimer();const card=document.getElementById('exercise-'+timerExercise);if(!card)return;card.insertAdjacentHTML('beforeend','<div class="inline-rest" role="status"><span>Отдых</span><strong class="inline-time">'+$('#timer-value').textContent+'</strong><button data-more-rest>+15 с</button><button data-skip-rest>Пропустить</button></div>');}
function initializeExperience(){
 $('.filter-drawer').insertAdjacentHTML('afterend','<div id="active-filters" class="active-filters"></div>');
 $('#today-date').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
 $('#settings-storage').append($('.offline-panel'),$('#about-open'));
 const updateBadge=()=>{$('#settings-open').classList.toggle('has-update',!$('#app-update').hidden);$('#settings-open').setAttribute('aria-label',$('#app-update').hidden?'Настройки и установка':'Настройки: доступно обновление сайта');};
 new MutationObserver(updateBadge).observe($('#app-update'),{attributes:true,attributeFilter:['hidden']});updateBadge();
 $('#settings-open').addEventListener('click',()=>openDialog('#settings-dialog'));
 $('#setup-open').addEventListener('click',()=>{$('#settings-dialog').close();openDialog('#setup-dialog');});
 $('#setup-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.target);
  if((state.plans.some(p=>p.items.length)||state.history.length) && !confirm('Заменить первые три комплекса стартовыми? Текущие отметки этих комплексов сбросятся, история завершений сохранится. Для копии используйте Настройки → Скачать копию.'))return;
  for(const original of templates){const plan=state.plans.find(p=>p.id===original.id);plan.title=original.title;updateItems(state,plan.id,original.items.map(id=>form.get('equipment')==='no'?({row:'pronew',hinge:'bridge',press:'wall',curl:'wall'}[id]||id):id));updateStretches(state,plan.id,[]);for(const mode of ['easy','regular'])state.sessions[`${plan.id}:${mode}`]={done:[],stretchDone:[],finished:false};}
  state.schedule=resizeSchedule([{weekday:0,planId:1},{weekday:2,planId:2},{weekday:4,planId:3}],form.get('days'));state.mode=form.get('level');state.day=state.schedule[0].planId;save();$('#setup-dialog').close();setView('plan');render();toast('Стартовый план готов. Изменяйте его в режиме «План».');
 });
 $('#sidebar-toggle').addEventListener('click',()=>{if(matchMedia('(max-width:1000px)').matches){openLibrary();return;}if(viewMode==='train'){setView('plan');document.body.classList.remove('sidebar-collapsed');}else document.body.classList.toggle('sidebar-collapsed');$('#sidebar-toggle').setAttribute('aria-expanded',String(!document.body.classList.contains('sidebar-collapsed')));});
 document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.view)setView(b.dataset.view);
  if(b.hasAttribute('data-reset-filters')){equipmentFilter='all';levelFilter='all';$('#library-equipment').value='all';$('#library-level').value='all';renderLibrary();syncExperience();}
  if(b.dataset.startDay){switchDay(Number(b.dataset.startDay));$('#start-button').click();}
  if(b.dataset.exerciseStep){exerciseIndex+=Number(b.dataset.exerciseStep);syncExperience();$('.current-exercise')?.scrollIntoView({block:'start',behavior:'smooth'});}
  if(b.hasAttribute('data-more-rest')){startTimer(Math.max(0,Math.ceil((deadline-Date.now())/1000))+15,timerKind,timerTitle);showInlineTimer();}
  if(b.hasAttribute('data-skip-rest')){stopTimer();toast('Отдых завершён. Продолжайте, когда будете готовы.');}
  if(b.dataset.nav==='library')openLibrary();
  if(b.dataset.nav==='week'){setView('plan');$('.week-card').scrollIntoView({block:'start',behavior:'smooth'});}
  if(b.dataset.nav==='today'){$('#today-summary').scrollIntoView({block:'start',behavior:'smooth'});setView('train');}
 });
 let touch;$('#day-panel').addEventListener('touchstart',e=>{if(!e.target.closest('button,input,select,details'))touch={x:e.touches[0].clientX,y:e.touches[0].clientY};else touch=null;},{passive:true});
 $('#day-panel').addEventListener('touchend',e=>{if(!touch || viewMode!=='train')return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5){exerciseIndex=Math.max(0,Math.min(currentDay().items.length-1,exerciseIndex+(dx<0?1:-1)));syncExperience();}touch=null;},{passive:true});
 document.querySelectorAll('#library-equipment,#library-level').forEach(e=>e.addEventListener('change',syncExperience));
 const wake=createTimerWakeLock();document.querySelectorAll('button[data-view]').forEach(b=>b.addEventListener('click',()=>wake(viewMode==='train')));$('#day-panel').addEventListener('click',e=>{if(e.target.closest('#start-button'))wake(true);if(e.target.closest('#finish-session'))wake(false);});
}

initializeExperience();
render();
