import { exercises, days, totalSets } from './exercises.js';

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
  day: [1, 2, 3].includes(stored.day) ? stored.day : 1,
  mode: stored.mode === 'regular' ? 'regular' : 'easy',
  sessions: stored.sessions && typeof stored.sessions === 'object' && !Array.isArray(stored.sessions) ? stored.sessions : {},
  history: Array.isArray(stored.history) ? stored.history.filter(x => x && [1,2,3].includes(x.day) && typeof x.date === 'string').slice(-100) : []
};
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { if (storageAvailable) toast('Браузер не разрешает сохранение. Отметки останутся до закрытия страницы.'); storageAvailable = false; }
}
const currentDay = () => days.find(d => d.id === state.day);
const setCount = () => state.mode === 'easy' ? 1 : 2;
const sessionKey = () => `${state.day}:${state.mode}`;
function session() {
  const key = sessionKey();
  if (!state.sessions[key] || typeof state.sessions[key] !== 'object' || Array.isArray(state.sessions[key])) state.sessions[key] = { done: [], finished: false };
  const s = state.sessions[key];
  const allowed = currentDay().items.flatMap(id => Array.from({ length:setCount() }, (_, i) => `${id}:${i}`));
  s.done = Array.isArray(s.done) ? [...new Set(s.done.filter(x => allowed.includes(x)))] : [];
  s.finished = s.finished === true && s.done.length === allowed.length;
  return s;
}
function toast(message) { $('#toast').textContent = message; clearTimeout(toast.timeout); toast.timeout = setTimeout(() => { $('#toast').textContent = ''; }, 5000); }
function phaseLabels(e) { return e.phases.map((p, i) => `<div class="phase-label"><b>${['01 · НАЧАЛО', '02 · ДВИЖЕНИЕ', '03 · КОНЕЧНАЯ ФАЗА'][i]}</b>${p}</div>`).join(''); }
function asset(id) { return `./assets/exercises/${id}.webp`; }
function weekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return start;
}
function renderWeek() {
  const since = weekStart().getTime();
  const completed = new Set(state.history.filter(h => new Date(h.date).getTime() >= since).map(h => h.day));
  $('#week-strip').innerHTML = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((label, i) => {
    const day = i === 0 ? 1 : i === 2 ? 2 : i === 4 ? 3 : null;
    return `<div class="week-day"><span>${label}</span>${day ? `<button class="day-circle work ${completed.has(day) ? 'done' : ''}" data-day="${day}" aria-label="Открыть день ${day}${completed.has(day) ? ', завершён на этой неделе' : ''}">${completed.has(day) ? '✓' : day}</button>` : '<span class="day-circle" aria-label="Восстановление">·</span>'}</div>`;
  }).join('');
}
function renderTabs() {
  $('#day-tabs').innerHTML = days.map(d => `<button id="tab-${d.id}" class="day-tab" role="tab" aria-selected="${state.day === d.id}" aria-controls="day-panel" tabindex="${state.day === d.id ? '0' : '-1'}" data-day="${d.id}"><span class="tab-number">0${d.id}</span><span class="tab-label"><small>ДЕНЬ ${d.id} · ${d.short}</small><strong>${d.title}</strong></span><span class="tab-arrow" aria-hidden="true">↗</span></button>`).join('');
}
function renderCard(id, index) {
  const e = exercises[id];
  const done = session().done;
  const complete = Array.from({length:setCount()},(_,i)=>`${id}:${i}`).every(k=>done.includes(k));
  return `<article class="exercise-card ${complete ? 'is-done' : ''}" id="exercise-${id}" aria-labelledby="title-${id}">
    <div class="card-header"><span class="exercise-index">${String(index+1).padStart(2,'0')}</span><div><h3 id="title-${id}">${e.title}</h3><p>${e.muscles}</p></div><span class="equipment">${e.equipment}</span></div>
    <button class="exercise-visual ${['bridge','heel','bird'].includes(id) ? 'ground' : ''}" data-image="${id}" aria-label="Увеличить: ${e.title}, три фазы движения"><img src="${asset(id)}" alt="${e.title}: ${e.phases.join('; ')}. Коралловым выделены: ${e.muscles.toLowerCase()}." width="1536" height="1024" loading="${index < 2 ? 'eager' : 'lazy'}"><span class="zoom-icon" aria-hidden="true">⤢</span></button>
    <div class="phase-labels">${phaseLabels(e)}</div>
    <div class="prescription"><span class="rep-value">${setCount()} × ${state.mode === 'easy' ? e.easy : e.reps}<span class="rep-unit">повторов</span></span>${e.side ? '<span class="rep-side">на каждую<br>сторону</span>' : ''}<button class="rest-button" data-rest="${e.rest}" aria-label="Запустить отдых ${e.rest} секунд">◷ ${e.rest} с отдыха</button></div>
    <p class="cue"><span aria-hidden="true">↳</span>${e.cue}</p>
    <details class="technique"><summary>Техника и облегчённый вариант</summary><ol>${e.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p><strong>Если тяжело:</strong> ${e.easier}</p><p><strong>Следите:</strong> ${e.avoid}</p></details>
    <div class="set-controls">${Array.from({length:setCount()},(_,i)=>`<button class="set-button" data-set="${id}:${i}" aria-label="${e.title}, подход ${i+1}" aria-pressed="${done.includes(`${id}:${i}`)}" ${session().finished ? 'disabled' : ''}>Подход ${i+1}</button>`).join('')}<span class="set-help">${complete ? 'Готово, отлично!' : 'Отметьте после выполнения'}</span></div>
  </article>`;
}
function renderPanel() {
  const d = currentDay();
  $('#day-panel').setAttribute('aria-labelledby', `tab-${d.id}`);
  $('#day-panel').innerHTML = `<div class="day-panel-heading"><div><h3>${d.subtitle}</h3><p>${d.description}</p></div><button class="button primary start-button" id="start-button">${session().done.length ? 'Продолжить тренировку' : 'К упражнениям'} <span aria-hidden="true">↓</span></button></div>
    <details class="warmup"><summary><span class="warmup-icon" aria-hidden="true">☀</span><span class="warmup-title">Сначала разминка</span><span class="warmup-sub">5 минут · без гантелей</span><span class="expand-icon" aria-hidden="true">+</span></summary><ol><li><strong>2 мин.</strong> Спокойно шагайте на месте.</li><li><strong>1 мин.</strong> Мягко вращайте плечами, затем сгибайте и разгибайте локти.</li><li><strong>1 мин.</strong> Неглубокие приседания с опорой на стул, в удобном темпе.</li><li><strong>1 мин.</strong> Несколько мягких наклонов от таза и подъёмов на носки с опорой.</li></ol></details>
    <div class="workout-meta"><span>5 упражнений · выполняйте по порядку</span><span class="muscle-key">Работающие мышцы</span></div>
    <div class="exercise-grid">${d.items.map(renderCard).join('')}<aside class="session-card" id="session-card" aria-label="Прогресс тренировки"></aside></div>`;
  renderProgress();
}
function renderProgress() {
  const s = session();
  const total = totalSets(currentDay(), state.mode);
  const done = s.done.length;
  const all = done === total;
  $('#session-card').innerHTML = `<span class="session-icon" aria-hidden="true">${s.finished ? '✓' : '↗'}</span><h3>${s.finished ? 'Вы сделали это.' : all ? 'Все подходы выполнены!' : 'Сегодня — чуть сильнее.'}</h3><p>${s.finished ? 'Тренировка сохранена. Отдохните хотя бы один день, затем переходите к следующему дню программы.' : all ? 'Осталось спокойно завершить занятие и сохранить результат. Выделите 2–3 минуты на восстановление дыхания.' : 'Не нужно делать идеально. Двигайтесь спокойно, следите за техникой и отмечайте каждый выполненный подход.'}</p><div class="progress-meta"><span>День ${state.day} · ваш прогресс</span><span>${done} из ${total} подходов</span></div><div class="progress-track" role="progressbar" aria-label="Выполнено подходов" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><div class="progress-fill" style="width:${done/total*100}%"></div></div>${s.finished ? '<button class="button primary" id="new-session">Начать этот день заново ↻</button>' : `<button class="button primary" id="finish-session" ${!all ? 'disabled' : ''}>Завершить тренировку ✓</button>${done ? '<button class="text-button" id="reset-session">Сбросить отметки этого дня</button>' : ''}`}`;
}
function render() {
  renderWeek(); renderTabs(); renderPanel();
  $('#mode').value = state.mode;
  $('#mode-note').textContent = state.mode === 'easy' ? 'Начните спокойно: важнее освоить движения.' : 'Переходите к двум подходам, когда хорошо восстанавливаетесь.';
}
function switchDay(day, focus = false) {
  state.day = day; save(); render();
  if (focus) $(`#tab-${day}`).focus();
}
function openDialog(id) { $(id).showModal(); }
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.day) switchDay(Number(button.dataset.day));
  if (button.dataset.image) {
    const id = button.dataset.image, e = exercises[id];
    $('#image-title').textContent = e.title;
    $('#large-image').src = asset(id); $('#large-image').alt = `${e.title}. ${e.phases.join('. ')}. Работающие мышцы: ${e.muscles}.`;
    $('#large-phases').innerHTML = phaseLabels(e); $('#image-cue').textContent = e.cue; openDialog('#image-dialog');
    $('#image-stage').className = 'image-stage';
    $('#image-stage').dataset.ground = String(['bridge','heel','bird'].includes(id));
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
  if (button.dataset.seconds) startTimer(Number(button.dataset.seconds));
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
    card.querySelector('.set-help').textContent = all ? 'Готово, отлично!' : 'Отметьте после выполнения';
    save(); renderProgress();
    if (!completed) {
      if (s.done.length === totalSets(currentDay(),state.mode)) { stopTimer(); toast('Все подходы готовы. Нажмите «Завершить тренировку» ниже.'); }
      else startTimer(exercises[id].rest);
    }
  }
  if (button.classList.contains('dialog-close')) button.closest('dialog').close();
  if (button.id === 'start-button') {
    const id = currentDay().items.find(id => Array.from({length:setCount()},(_,i)=>`${id}:${i}`).some(k=>!session().done.includes(k)));
    const target = id ? $(`#exercise-${id}`) : $('#session-card');
    target.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
    target.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  if (button.id === 'finish-session') {
    const s = session();
    if (s.finished || s.done.length !== totalSets(currentDay(),state.mode)) return;
    s.finished = true;
    state.history.push({day:state.day,mode:state.mode,date:new Date().toISOString()}); state.history = state.history.slice(-100);
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
  const day = event.key === 'Home' ? 1 : event.key === 'End' ? 3 : ((state.day-1+(event.key === 'ArrowRight' ? 1 : 2))%3)+1;
  switchDay(day,true);
});
$('#mode').addEventListener('change', event => { state.mode = event.target.value; save(); render(); toast('Для каждого режима сохраняются отдельные отметки.'); });
$('#guide-open').addEventListener('click',()=>openDialog('#guide-dialog'));
$('#about-open').addEventListener('click',()=>openDialog('#about-dialog'));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
}));

let deadline = 0, remaining = 0, running = false, interval;
function displayTimer() {
  if (running) remaining = Math.max(0,Math.ceil((deadline-Date.now())/1000));
  $('#timer-value').textContent = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  if (running && remaining === 0) {
    running = false; clearInterval(interval); $('#timer-label').textContent = 'ОТДЫХ ЗАВЕРШЁН';
    $('#timer-toggle').textContent = '↻'; $('#timer-toggle').setAttribute('aria-label','Повторить отдых 60 секунд'); toast('Отдых завершён. Продолжайте, когда будете готовы.');
  }
}
function startTimer(seconds) {
  remaining = seconds; deadline = Date.now()+seconds*1000; running=true;
  $('#timer').hidden = false; $('#timer-label').textContent = 'ОТДЫХ МЕЖДУ ПОДХОДАМИ';
  $('#timer-toggle').textContent = 'Ⅱ'; $('#timer-toggle').setAttribute('aria-label','Приостановить таймер');
  clearInterval(interval);interval=setInterval(displayTimer,250);displayTimer();
}
function stopTimer() { clearInterval(interval);running=false;$('#timer').hidden=true; }
$('#timer-close').addEventListener('click',stopTimer);
$('#timer-toggle').addEventListener('click',()=>{
  if (remaining === 0) return startTimer(60);
  if (running) { displayTimer();running=false;clearInterval(interval);$('#timer-label').textContent='ТАЙМЕР НА ПАУЗЕ';$('#timer-toggle').textContent='▶';$('#timer-toggle').setAttribute('aria-label','Продолжить таймер'); }
  else startTimer(remaining);
});
document.addEventListener('visibilitychange',()=>{if(running)displayTimer();});

function preparePrint() {
  $('#print-area').innerHTML = `<h1>Моя домашняя тренировка</h1><p>3 раза в неделю, с днём отдыха между занятиями. Например: понедельник, среда, пятница. Повторяйте дни 1 → 2 → 3 каждую неделю.</p><p>Первые 2 недели — 1 подход каждого упражнения. Основной режим — 2 подхода при хорошем восстановлении. Сначала все подходы одного упражнения, затем следующее. Оставляйте запас 2–3 повтора. Выдох на усилии, возвращение плавное.</p><p>Разминка 5 минут: 2 минуты шага на месте; по минуте движений плечами и локтями, неглубоких приседаний с опорой, наклонов от таза и подъёмов на носки.</p>${days.map((d,i)=>`<section class="${i ? 'print-day' : ''}"><h2>День ${d.id}. ${d.title}</h2><p>${d.description}</p>${d.items.map((id,n)=>{const e=exercises[id];return `<article class="print-exercise"><img src="${asset(id)}" alt="${e.title}"><div><h3>${n+1}. ${e.title}</h3><p><strong>Старт: 1 × ${e.easy} · Основной: 2 × ${e.reps}${e.side?' на каждую сторону':''} · Отдых ${e.rest} с</strong></p><p>${e.muscles}.</p><p>${e.cue} ${e.steps[2]}</p><p>Легче: ${e.easier}</p></div></article>`;}).join('')}<p class="print-note">Завершение: спокойно походите 2–3 минуты. При острой боли, головокружении, боли в груди или необычной одышке остановитесь. При известных ограничениях согласуйте занятия со специалистом.</p></section>`).join('')}`;
}
$('#print-button').addEventListener('click',async()=>{
  preparePrint();
  await Promise.all([...$('#print-area').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  window.print();
});
window.addEventListener('beforeprint',preparePrint);
render();
