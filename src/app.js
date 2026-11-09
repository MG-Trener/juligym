import {exercises,groups,byId} from './catalog.js';
import {icon,anatomy} from './icons.js';
import {today,addDays,weekStart,dayIndex,summary,estimatedMinutes,formatDate,firstPendingSet,escape as esc} from './state.js';
import {request} from './api.js';
import {isUnlocked,lockAccess} from './access.js';
import {startTimer,stopTimer,keepAwake} from './timer.js';
import {initStretch} from './stretch.js';
import {stretches,stretchById} from './stretch-catalog.js';
import {todayMarkup,guidedMarkup} from './workout-flow.js';
const $=s=>document.querySelector(s),days=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
let openTechnique=null;
const stretch=initStretch($('#stretch-view'),()=>openTechnique);
let data={plans:[],schedule:{weekdays:{},revision:1},sessions:[],history:[]},selectedDate=today(),week=weekStart(today()),selectedPlan='legs',view='today',group='all',query='',mobileSidebar=false,busy=false,online=false,editingId=null,editorItems=[],loadNumber=0;
let loadedWeek=null, guidedKey=null, todayHtml=null, strengthView='today';
const plural=(n,a,b,c)=>n%100>=11&&n%100<=14?c:n%10===1?a:n%10>=2&&n%10<=4?b:c;
const exerciseWord=n=>plural(n,'упражнение','упражнения','упражнений');
const strengthGroups=[{id:'all',title:'Все группы мышц',count:exercises.length},...groups];
const stretchGroups=strengthGroups.map(g=>({...g,count:g.id==='all'?stretches.length:stretches.filter(e=>e.group===g.id).length}));
const ui={};
try{selectedPlan=localStorage.getItem('juligym2:selected-plan')||selectedPlan;}catch{}
const narrow=matchMedia('(max-width:1000px)');
function closeSidebar(focus=false){mobileSidebar=false;document.body.classList.remove('sidebar-open');$('#menu-open').setAttribute('aria-expanded','false');$('.sidebar').inert=narrow.matches;$('#main').inert=false;$('.mobile-nav').inert=false;if(focus)$('#menu-open').focus();}
narrow.addEventListener('change',()=>closeSidebar());
closeSidebar();
const selected=()=>data.plans.find(p=>p.id===selectedPlan)||data.plans[0];
const currentSession=()=>data.sessions.find(s=>s.workout_date===selectedDate && s.plan_id===selectedPlan);
const currentItems=()=>currentSession()?.items||selected()?.items||[];
function notify(message,error=false){const box=$('#toast');box.textContent=message;box.classList.toggle('error',error);box.hidden=false;clearTimeout(ui.toast);ui.toast=setTimeout(()=>box.hidden=true,5000);}
function setConnection(ok,message){online=ok;$('#connection').innerHTML=`<i class="status-dot ${ok?'':'offline'}"></i>${esc(message|| (ok?'Общий дневник · сохранено в Neon':'Нет связи · данные из последней загрузки'))}`;$('#connection').setAttribute('title','Один общий дневник Юли. Изменения видны всем посетителям.');renderBusy();}
function cacheDiary(){
 if(!loadedWeek)return;
 try{localStorage.setItem('juligym2:shared-cache',JSON.stringify({data,week:loadedWeek}));}catch{}
}
async function load(silent=false){
 if(!isUnlocked()||busy)return;
 if(view==='today')week=weekStart(today());
 const requestedWeek=week;
 const token=++loadNumber;
 try{
  const next=await request(`state?from=${addDays(requestedWeek,-7)}&to=${addDays(requestedWeek,6)}`);
  if(token!==loadNumber)return;
  data=next;
  loadedWeek=requestedWeek;
  cacheDiary();
  setConnection(true);
  if(!data.plans.some(p=>p.id===selectedPlan))selectedPlan=data.plans[0]?.id;
  render();
 }catch(e){
  if(token!==loadNumber)return;
  setConnection(false,e.message);
  if(!silent)notify(e.message,true);
  if(!data.plans.length)render();
 }
}
async function mutate(path,body){
 if(busy)return;
 loadNumber++;busy=true;renderBusy();
 try{
  const result=await request(path,body);
  const session=result.session;
  if(session){
   const index=data.sessions.findIndex(saved=>saved.id===session.id);
   if(index<0)data.sessions.push(session);
   else data.sessions[index]=session;
   if(session.finished_at&&!data.history.some(entry=>entry.id===session.id)){
    const {id,workout_date,plan_id,title,started_at,finished_at,duration_seconds}=session;
    data.history.unshift({id,workout_date,plan_id,title,started_at,finished_at,duration_seconds});
   }
   cacheDiary();
  }
  setConnection(true);
  return result;
 }catch(e){
  notify(e.message+' Изменение не сохранено.',true);
  return null;
 }finally{
  busy=false;
  renderBusy();
  if(view==='today'&&loadedWeek!==week)void load(true);
 }
}
function renderBusy(){
 const session=currentSession();
 const progress=summary(session||{items:currentItems(),marks:{}});
 const future=selectedDate>today();
 const readOnly=busy||!online;
 document.querySelectorAll('[data-write]').forEach(button=>{
  let disabled=readOnly;
  if(button.hasAttribute('data-today-start'))disabled ||= loadedWeek!==weekStart(today());
  if(button.hasAttribute('data-set')||button.hasAttribute('data-guided-set'))disabled ||= future||!!session?.finished_at;
  if(button.id==='finish-workout'||button.id==='guided-finish')disabled ||= future||!session||!!session.finished_at||!progress.total||progress.done!==progress.total;
  button.disabled=disabled;
 });
 $('#training-start').disabled=readOnly||!selected()||future;
 $('#today-offline').hidden=online||!data.plans.length;
 $('#guided-offline').hidden=online||!!session?.finished_at;
 $('#busy-indicator').hidden=!busy;
}
function sidebar(){
 const stretching=view==='stretch';
 const filters=stretching?stretch.filters:{group,query};
 const search=$('#search');
 $('#sidebar-caption').textContent=stretching?'БИБЛИОТЕКА РАСТЯЖКИ':'СИЛОВАЯ БИБЛИОТЕКА';
 search.placeholder=stretching?'Поиск растяжки…':'Поиск упражнений…';
 if(search.value!==filters.query)search.value=filters.query;
 $('.search-submit').hidden=!stretching;
 $('#brand').innerHTML=`${icon('leaf')}<span>Моя домашняя<br>тренировка</span>`;
 const groupNav=$('#muscle-groups');
 const catalogKey=`${stretching?'stretch':'strength'}:${filters.group}`;
 if(groupNav.dataset.catalog!==catalogKey){
  groupNav.innerHTML=(stretching?stretchGroups:strengthGroups).map(g=>{
   const active=filters.group===g.id;
   return `<button class="muscle-group ${active?'active':''}" data-group="${g.id}" aria-pressed="${active}">${anatomy(g.id)}<span><strong>${g.title}</strong><small>${g.count} ${exerciseWord(g.count)}</small></span>${active?'<i class="selection-dot"></i>':''}</button>`;
  }).join('');
  groupNav.dataset.catalog=catalogKey;
 }
 $('#sidebar-create').innerHTML=stretching?icon('arrow')+' Моя подборка':icon('plus')+' Создать подборку';
 $('#sidebar-foot').innerHTML=`${icon('user')}<div><strong>Дневник Юли</strong><small>Общий · вход по паролю</small></div>`;
}
function renderWeek(){
 const finished=new Set(data.history.filter(h=>h.workout_date>=week&&h.workout_date<=addDays(week,6)).map(h=>h.workout_date));
 const active=new Set(data.sessions.filter(s=>summary(s).done>0).map(s=>s.workout_date));
 $('#week-stat').textContent=`7 дней · ${Object.keys(data.schedule?.weekdays||{}).length} тренировочных дня · ${finished.size} завершено`;
 $('#week-range').textContent=`${formatDate(week,{day:'numeric',month:'short'})} — ${formatDate(addDays(week,6),{day:'numeric',month:'short'})}`;
 $('#week-days').innerHTML=days.map((label,i)=>{const date=addDays(week,i),isToday=date===today(),done=finished.has(date),planned=data.schedule?.weekdays?.[i];return `<button data-date="${date}" class="week-day ${date===selectedDate?'selected':''} ${isToday?'today':''} ${done?'completed':''}" aria-pressed="${date===selectedDate}" aria-label="${formatDate(date)}${done?', тренировка выполнена':planned?', тренировка запланирована':', отдых'}"><span>${label}</span><small>${formatDate(date,{day:'numeric',month:'short'})}</small><span class="day-marker">${done?icon('check'):isToday?icon('flame'):active.has(date)?'<i></i>':''}</span><em>${isToday?'Сегодня':done?'Готово':planned?'По плану':'Отдых'}</em></button>`;}).join('');
}
function renderPlans(){
 $('#plans').innerHTML=data.plans.map(plan=>{const sess=data.sessions.find(s=>s.plan_id===plan.id&&s.workout_date===selectedDate),p=summary(sess||{items:plan.items,marks:{}}),g=byId[plan.items[0]?.id]?.group||'all';return `<button data-plan="${plan.id}" class="plan-card ${plan.id===selectedPlan?'active':''}" aria-pressed="${plan.id===selectedPlan}"><span class="plan-badge">${sess?.finished_at?'ВЫПОЛНЕНО':plan.id===selectedPlan?'АКТИВНАЯ':'ПОДБОРКА'}</span><h3>${esc(plan.title)}</h3><p>${plan.items.length} ${exerciseWord(plan.items.length)} · ≈ ${estimatedMinutes(plan)} мин</p><div class="progress-line"><span style="width:${p.percent}%"></span></div><div class="plan-percent"><span>${sess?.finished_at?'Сохранено в дневнике':p.done?`${p.done} из ${p.total} подходов`:'Запланировано'}</span><strong>${p.percent}%</strong></div>${anatomy(g,'plan-anatomy')}<span class="plan-action">${plan.id===selectedPlan?'К упражнениям':'Открыть'} ${icon('arrow')}</span></button>`;}).join('');
}
function exerciseCard(item,index,kind='exercise'){
 const e=byId[item.id];
 const session=currentSession();
 const marks=session?.marks||{};
 const library=kind==='library';
 const guided=kind==='guided';
 const cardId=`${kind}-${e.id}`;
 const sets=item.sets||2;
 const count=Array.from({length:sets},(_,i)=>marks[`${e.id}:${i}`]===true).filter(Boolean).length;
 const complete=count===sets&&!library&&!guided;
 const dose=`${esc(item.reps||e.reps)}${e.unit==='seconds'?'':' повторов'}${e.unilateral?' · на сторону':''}`;
 const rest=item.rest||e.rest;
 const meta=guided ? `<div class="guided-meta"><strong>${dose}</strong><span>${esc(e.equipment)}</span><span>Отдых ${rest} с</span></div>` : `
  <div class="exercise-meta">
   <div>${icon('dumbbell')}<span><strong>${sets} ${plural(sets,'подход','подхода','подходов')}</strong><small>${dose}</small></span></div>
   <button class="rest-action" data-rest="${rest}">${icon('clock')}<span>Отдых<strong>${rest} сек</strong></span></button>
   <div class="completion-count">${icon('check')}<span>${library?'Инвентарь':'Выполнено'}<strong>${library?esc(e.equipment):`${count} / ${sets}`}</strong></span></div>
  </div>`;
 let actions='';
 if(library)actions=`<button class="button secondary add-library" data-add-library="${e.id}">${icon('plus')} Добавить в подборку</button>`;
 if(!library&&!guided)actions=`<div class="set-buttons">${Array.from({length:sets},(_,i)=>{
  const key=`${e.id}:${i}`;
  const marked=marks[key]===true;
  return `<button class="set-button ${marked?'done':''}" data-set="${key}" data-write aria-pressed="${marked}" ${session?.finished_at?'disabled':''}>${marked?icon('check'):''}Подход ${i+1}${marked?' ✓':''}</button>`;
 }).join('')}</div>`;
 return `<article class="exercise-card ${complete?'is-complete':''}" id="${cardId}">
  <header><div><h3>${kind==='exercise'?`<span class="exercise-number">${index+1}</span>`:''}${e.title}</h3><p>${e.muscles}</p></div><span class="difficulty ${e.advanced?'advanced':''}">${e.level}</span>${complete?`<span class="complete-icon">${icon('check')}</span>`:''}</header>
  <button class="exercise-art" data-image="${e.id}" aria-label="Увеличить: ${e.title}, три фазы"><img src="./media/${e.id}.webp" alt="Юля: ${e.title}. Коралловым выделены ${e.muscles.toLowerCase()}." width="1536" height="1024" loading="${guided||index<2?'eager':'lazy'}"><span class="art-zoom">↗</span></button>
  <div class="phase-labels">${e.phases.map((phase,i)=>`<div><b>${i+1}</b><span>${phase}</span></div>`).join('')}</div>
  ${meta}
  <details class="technique" data-technique="${cardId}" ${openTechnique===cardId?'open':''}><summary>${icon('info')} Техника и подсказка</summary><ol>${e.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p>${e.cue}</p><p><b>Легче:</b> ${e.easier}</p></details>
  ${actions}
 </article>`;
}
function renderWorkout(){
 const plan=selected(),session=currentSession(),items=currentItems(),p=summary(session||{items,marks:{}});
 $('#workout-title').textContent=session?.title||plan?.title||'Выберите тренировку';
 $('#date-badge').textContent=selectedDate===today()?'СЕГОДНЯ':formatDate(selectedDate);
 $('#workout-progress').innerHTML=`<div><span>Прогресс тренировки</span><span>${p.complete} / ${items.length} упражнений</span></div><div class="progress-line"><span style="width:${p.percent}%"></span></div><p>${icon(session?.finished_at?'check':'clock')}${session?.finished_at?'Занятие завершено и сохранено в общем дневнике.':p.done?`${p.percent}% · ${p.done} из ${p.total} подходов`:'Начните с разминки и двигайтесь в своём темпе.'}</p>`;
 $('#exercises').innerHTML=items.map((item,i)=>exerciseCard(item,i)).join('')||'<p class="empty">Создайте подборку из библиотеки.</p>';

 $('#session-actions').innerHTML=`${session?.finished_at?`<div class="session-saved">${icon('check')} Тренировка выполнена · ${formatDate(selectedDate)}<span>${Math.max(1,Math.round(session.duration_seconds/60))} мин</span></div>`:`<button class="button primary" id="finish-workout" data-write ${p.done!==p.total||!p.total?'disabled':''}>${icon('check')} Завершить тренировку</button><p>Завершите все подходы — занятие попадёт в историю, а день получит отметку ✓.</p>`}`;
 $('#training-start').innerHTML=icon('play')+(session?.finished_at?'Посмотреть занятие':session?'Продолжить':'Начать тренировку');
 $('#edit-plan').disabled=!plan;
 $('#stretch-after').hidden=!items.length;
}
function renderLibrary(){
 const q=query.trim().toLocaleLowerCase('ru');const filtered=exercises.filter(e=>(group==='all'||e.group===group)&&(`${e.title} ${e.muscles} ${e.equipment}`).toLocaleLowerCase('ru').includes(q));
 $('#library-title').textContent=groups.find(g=>g.id===group)?.title||'Все группы мышц';$('#library-count').textContent=filtered.length+' '+exerciseWord(filtered.length);
 $('#library-grid').innerHTML=filtered.map((e,i)=>exerciseCard(e,i,'library')).join('')||'<p class="empty">Ничего не найдено. Измените название или группу мышц.</p>';
}
function renderHistory(){
 $('#history-list').innerHTML=data.history.length?data.history.map(h=>`<button class="history-row" data-history-date="${h.workout_date}" data-history-plan="${h.plan_id}"><span class="history-check">${icon('check')}</span><span><strong>${esc(h.title)}</strong><small>${formatDate(h.workout_date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</small></span><span>${Math.max(1,Math.round(h.duration_seconds/60))} мин</span>${icon('chevron')}</button>`).join(''):'<div class="empty">Здесь появятся реальные завершённые занятия Юли.<br>Отметьте подходы и завершите тренировку.</div>';
 $('#history-total').textContent=data.history.length;
}
function render(){
 try{localStorage.setItem('juligym2:selected-plan',selectedPlan);}catch{}
 sidebar();renderWeek();renderPlans();renderWorkout();
 if(view==='library')renderLibrary();
 if(view==='history')renderHistory();
 if(view==='today'){
  $('#today-date').textContent=formatDate(today(),{weekday:'long',day:'numeric',month:'long'});
  const html=todayMarkup(data,today());
  if(html!==todayHtml){$('#today-content').innerHTML=html;todayHtml=html;}
 }
 if(view==='guided'){
  const session=currentSession();
  const key=JSON.stringify(session);
  if(key!==guidedKey){
   $('#guided-title').textContent=session?.title||'Силовая тренировка';
   $('#guided-content').innerHTML=session ? guidedMarkup(session,exerciseCard) : '<p>Занятие пока недоступно. Откройте дневник ещё раз.</p>';
   guidedKey=key;
  }
 }
 $('.week-section').hidden=['today','stretch','guided'].includes(view);
 document.querySelectorAll('[data-view-panel]').forEach(panel=>panel.hidden=panel.dataset.viewPanel!==view);
 document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-current',button.dataset.view===(view==='guided'?'workout':view)?'page':'false'));
 document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===(view==='stretch'?'stretch':'strength'))));
 renderBusy();
}

function focusGuided(){
 $('#guided-step')?.focus({preventScroll:true});
 $('#guided-view').scrollIntoView({block:'start',behavior:'instant'});
}

function revealStretchSection(selector='#stretch-library-title',focus=true){
 stretch.openCatalog();
 const heading=$(selector);
 if(focus)heading.focus({preventScroll:true});
 heading.scrollIntoView({block:'start',behavior:'instant'});
}

function setView(next,closeMenu=true){
 if(view!==next&&(['stretch','guided'].includes(view)||['stretch','guided'].includes(next))){stopTimer();keepAwake(false);}
 if(view==='guided'&&next!=='guided')document.body.insertBefore($('#timer'),$('#toast'));
 if(view!=='guided'&&next==='guided')$('#guided-timer-slot').append($('#timer'));
 view=next;
 if(['today','workout','guided','library'].includes(view))strengthView=view;
 if(view==='today'){
  week=weekStart(today());
  if(weekStart(selectedDate)!==week)selectedDate=today();
 }
 if(closeMenu)closeSidebar();
 render();
 if(view==='guided')focusGuided();
 else window.scrollTo({top:0,behavior:'instant'});
 if(view==='today'&&loadedWeek!==week)void load(true);
}

async function beginGuided(date,planId){
 if(busy||!online||!planId||date>today())return;
 const origin={view,selectedDate,selectedPlan};
 const result=await mutate('start',{date,planId});
 if(!result)return;
 if(view!==origin.view||selectedDate!==origin.selectedDate||selectedPlan!==origin.selectedPlan){render();return;}
 selectedDate=date;
 selectedPlan=planId;
 week=weekStart(date);
 setView('guided');
 keepAwake(!result.session.finished_at);
}

async function markApproach(key,guided=false){
 const [exerciseId,index]=key.split(':');
 const session=currentSession();
 const date=selectedDate, planId=selectedPlan, originView=view;
 const item=currentItems().find(entry=>entry.id===exerciseId);
 if(!item||session?.finished_at||!online)return;
 if(guided){
  const pending=session&&firstPendingSet(session);
  if(!pending||key!==`${pending.item.id}:${pending.setIndex}`)return;
 }
 const done=guided||!session?.marks?.[key];
 const result=await mutate('sets',{date,planId,exerciseId,setIndex:Number(index),done,opId:crypto.randomUUID()});
 if(!result){if(guided&&view==='guided')await load(true);return;}
 render();
 if(view!==originView||selectedDate!==date||selectedPlan!==planId)return;
 const progress=summary(result.session);
 if(done&&progress.done<progress.total)startTimer(item.rest);
 else if(guided)stopTimer();
 if(guided)focusGuided();
}

async function finishTraining(){
 const date=selectedDate, planId=selectedPlan, originView=view;
 const result=await mutate('finish',{date,planId});
 if(!result)return;
 const sameSession=view===originView&&selectedDate===date&&selectedPlan===planId;
 if(sameSession){stopTimer();keepAwake(false);}
 render();
 if(sameSession&&view==='guided')focusGuided();
 notify('Тренировка Юли сохранена. День отмечен в календаре.');
 await load(true);
}
function openEditor(id=null,addId=null){editingId=id;const plan=data.plans.find(p=>p.id===id);editorItems=(plan?.items||[]).map(i=>({...i}));if(addId)editorItems.push({id:addId,sets:2,reps:byId[addId].reps,rest:byId[addId].rest});$('#editor-title').textContent=id?'Изменить подборку':'Новая подборка';$('#plan-name').value=plan?.title||'';$('#editor-search').value='';renderEditor();$('#editor-dialog').showModal();}
function renderEditor(){
 $('#editor-selected').innerHTML=editorItems.map((item,i)=>`<div class="editor-item"><div><strong>${byId[item.id].title}</strong><small>${byId[item.id].muscles}</small></div><label>Подходы<select data-editor-sets="${item.id}" aria-label="Подходы: ${byId[item.id].title}">${[1,2,3,4,5].map(n=>`<option ${item.sets===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Повторы<input data-editor-reps="${item.id}" value="${esc(item.reps)}" maxlength="10" aria-label="Повторы: ${byId[item.id].title}"></label><label>Отдых<select data-editor-rest="${item.id}" aria-label="Отдых: ${byId[item.id].title}">${[15,30,45,60,75,90,120,180].map(n=>`<option ${item.rest===n?'selected':''} value="${n}">${n} с</option>`).join('')}</select></label><div class="editor-move"><button data-editor-up="${i}" ${i===0?'disabled':''} aria-label="Выше: ${byId[item.id].title}">↑</button><button data-editor-remove="${item.id}" aria-label="Удалить: ${byId[item.id].title}">${icon('close')}</button></div></div>`).join('')||'<p class="empty">Выберите движения ниже. До 20 упражнений в подборке.</p>';
 const q=$('#editor-search').value.toLowerCase();$('#editor-options').innerHTML=exercises.filter(e=>!editorItems.some(i=>i.id===e.id)&&(!q||(`${e.title} ${e.muscles}`).toLowerCase().includes(q))).map(e=>`<button data-editor-add="${e.id}"><span>${e.title}<small>${groups.find(g=>g.id===e.group).title} · ${e.level}</small></span>${icon('plus')}</button>`).join('');$('#editor-counter').textContent=editorItems.length+' / 20';
}
function openSchedule(){
 $('#schedule-days').innerHTML=days.map((d,i)=>`<label>${d}<select data-schedule-day="${i}"><option value="">Отдых</option>${data.plans.map(p=>`<option value="${p.id}" ${data.schedule.weekdays[i]===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select></label>`).join('');$('#schedule-dialog').showModal();
}
document.addEventListener('click',async event=>{
 if(!isUnlocked())return;
 const hint=event.target.closest('.technique>summary');if(hint){event.preventDefault();const panel=hint.parentElement;openTechnique=panel.open?null:panel.dataset.technique;document.querySelectorAll('.technique').forEach(d=>d.open=d.dataset.technique===openTechnique);return;}
 if(event.target.closest('#lock-access')){stopTimer();keepAwake(false);lockAccess();return;}
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.mode){
  const next=b.dataset.mode==='stretch'?'stretch':strengthView;
  if(next!==view)setView(next);
  return;
 }
 if(b.dataset.stretchGroup){
  stretch.filterCatalog({group:b.dataset.stretchGroup});
  sidebar();
  return;
 }
 if(view==='stretch'){
  if(b.dataset.group){
   stretch.filterCatalog({group:b.dataset.group});
   sidebar();
   closeSidebar();
   revealStretchSection();
   return;
  }
  if(b.dataset.view==='library'||b.id==='sidebar-create'){
   closeSidebar();
   revealStretchSection(b.id==='sidebar-create'?'#stretch-custom-title':'#stretch-library-title');
   return;
  }
 }
 if(b.dataset.group){group=b.dataset.group;setView('library');}
 if(b.dataset.view)setView(b.dataset.view);
 if(b.id==='stretch-after'||b.hasAttribute('data-workout-stretch')){
  stretch.recommend(currentItems().map(item=>byId[item.id]?.group));
  setView('stretch');
  $('#stretch-cooldown button').focus({preventScroll:true});
 }
 if(b.id==='today-choose'){
  selectedDate=today();
  week=weekStart(selectedDate);
  selectedPlan=data.schedule?.weekdays?.[dayIndex(selectedDate)]||selectedPlan;
  setView('workout');
  if(loadedWeek!==week)await load(true);
 }
 if(b.hasAttribute('data-today-start')&&loadedWeek===weekStart(today()))await beginGuided(b.dataset.workoutDate,b.dataset.workoutPlan);
 if(b.hasAttribute('data-today-details')){
  selectedDate=b.dataset.workoutDate;selectedPlan=b.dataset.workoutPlan;week=weekStart(selectedDate);
  setView('workout');
  $('#session-actions').scrollIntoView({block:'center'});
 }
 if(b.dataset.plan){selectedPlan=b.dataset.plan;stopTimer();render();$('#current-workout').scrollIntoView({behavior:'smooth',block:'start'});}
 if(b.dataset.date){selectedDate=b.dataset.date;selectedPlan=data.schedule?.weekdays?.[dayIndex(selectedDate)]||selectedPlan;stopTimer();render();}
 if(b.dataset.week){week=addDays(week,Number(b.dataset.week)*7);selectedDate=week;await load();}
 if(b.id==='current-week'){week=weekStart(today());selectedDate=today();selectedPlan=data.schedule?.weekdays?.[dayIndex(selectedDate)]||selectedPlan;await load();}
 if(b.id==='sidebar-create'||b.id==='create-plan')openEditor();
 if(b.id==='edit-plan')openEditor(selectedPlan);
 if(b.dataset.addLibrary)openEditor(null,b.dataset.addLibrary);
 if(b.dataset.editorAdd){if(editorItems.length>=20)return notify('Максимум 20 упражнений в подборке.',true);const e=byId[b.dataset.editorAdd];editorItems.push({id:e.id,sets:2,reps:e.reps,rest:e.rest});renderEditor();}
 if(b.dataset.editorRemove){editorItems=editorItems.filter(i=>i.id!==b.dataset.editorRemove);renderEditor();}
 if(b.dataset.editorUp){const i=Number(b.dataset.editorUp);[editorItems[i-1],editorItems[i]]=[editorItems[i],editorItems[i-1]];renderEditor();}
 if(b.hasAttribute('data-close'))b.closest('dialog').close();
 if(b.id==='schedule-open')openSchedule();
 if(b.id==='training-start'){
  if(currentSession()?.finished_at)$('#session-actions').scrollIntoView({block:'center'});
  else await beginGuided(selectedDate,selectedPlan);
 }
 if(b.dataset.set)await markApproach(b.dataset.set);
 if(b.dataset.guidedSet)await markApproach(b.dataset.guidedSet,true);
 if(b.dataset.guidedHold)startTimer(Number(b.dataset.guidedHold),'Удержание','Удержание завершено. Можно отметить подход.');
 if(b.id==='finish-workout'||b.id==='guided-finish')await finishTraining();
 if(b.dataset.rest)startTimer(Number(b.dataset.rest));
 if(b.dataset.image){const e=byId[b.dataset.image]||stretchById[b.dataset.image];$('#image-title').textContent=e.title;$('#image-large').src=`./media/${e.id}.webp`;$('#image-large').alt=`${e.title}: три фазы движения`;$('#image-steps').innerHTML=e.steps.map(s=>`<li>${s}</li>`).join('');$('#image-cue').textContent=e.cue;$('#image-dialog').showModal();}
 if(b.id==='menu-open'){mobileSidebar=!mobileSidebar;document.body.classList.toggle('sidebar-open',mobileSidebar);b.setAttribute('aria-expanded',String(mobileSidebar));$('.sidebar').inert=!mobileSidebar;$('#main').inert=mobileSidebar;$('.mobile-nav').inert=mobileSidebar;if(mobileSidebar)$('#brand').focus({preventScroll:true});}
 if(b.id==='sidebar-backdrop')closeSidebar(true);
 if(b.id==='settings-open')$('#settings-dialog').showModal();
 if(b.id==='refresh-data')await load();
 if(b.id==='show-all-plans'){$('#plans').classList.toggle('all-plans');b.setAttribute('aria-expanded',String($('#plans').classList.contains('all-plans')));}
 if(b.dataset.historyDate){selectedDate=b.dataset.historyDate;week=weekStart(selectedDate);selectedPlan=b.dataset.historyPlan;await load();setView('workout');}
});
document.addEventListener('change',event=>{const e=event.target;if(e.dataset.editorSets)editorItems.find(i=>i.id===e.dataset.editorSets).sets=Number(e.value);if(e.dataset.editorReps)editorItems.find(i=>i.id===e.dataset.editorReps).reps=e.value;if(e.dataset.editorRest)editorItems.find(i=>i.id===e.dataset.editorRest).rest=Number(e.value);});
$('#search').addEventListener('input',event=>{
 const value=event.target.value;
 if(view==='stretch'){
  stretch.filterCatalog({query:value});
  if(!mobileSidebar)revealStretchSection('#stretch-library-title',false);
  return;
 }
 query=value;
 if(view!=='library')setView('library',false);else renderLibrary();
});
$('#library-search').addEventListener('submit',event=>{
 event.preventDefault();
 if(view==='stretch'){
  closeSidebar();
  revealStretchSection();
 }
});
$('#editor-search').addEventListener('input',renderEditor);
$('#plan-form').addEventListener('submit',async event=>{event.preventDefault();const p=data.plans.find(p=>p.id===editingId),result=await mutate('plans',{id:editingId||undefined,revision:p?.revision,title:$('#plan-name').value,items:editorItems});if(result){selectedPlan=result.plan.id;await load(true);$('#editor-dialog').close();setView('workout');notify('Подборка сохранена в общем дневнике.');}});
$('#schedule-form').addEventListener('submit',async event=>{event.preventDefault();const weekdays={};document.querySelectorAll('[data-schedule-day]').forEach(e=>{if(e.value)weekdays[e.dataset.scheduleDay]=e.value;});const result=await mutate('schedule',{weekdays,revision:data.schedule.revision});if(result){data.schedule=result.schedule;$('#schedule-dialog').close();render();notify('Расписание обновлено для всех посетителей.');}});
document.addEventListener('keydown',e=>{if(!isUnlocked())return;if(e.key==='Escape'&&mobileSidebar)closeSidebar(true);if(e.key==='Tab'&&mobileSidebar){const nodes=[...$('.sidebar').querySelectorAll('a,button,input')].filter(n=>!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();if(narrow.matches&&!mobileSidebar)$('#menu-open').click();$('#search').focus();}});
document.querySelectorAll('dialog').forEach(d=>{const h=d.querySelector('h2');if(h){h.id ||= d.id+'-heading';d.setAttribute('aria-labelledby',h.id);}});
document.querySelectorAll('dialog:not(#access-dialog)').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy)load(true);});
document.addEventListener('juligym:unlocked',()=>load(true));
document.addEventListener('juligym:locked',()=>{stopTimer();keepAwake(false);});
addEventListener('online',()=>load(true));addEventListener('offline',()=>setConnection(false));
setInterval(()=>{if(document.visibilityState==='visible'&&!busy&&!document.querySelector('dialog[open]'))load(true);},20000);
$('#year').textContent=new Date().getFullYear();$('#sidebar-backdrop').innerHTML='';
try{const cached=JSON.parse(localStorage.getItem('juligym2:shared-cache'));if(cached?.data?.plans)data=cached.data;}catch{}
render();load();
