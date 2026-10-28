import {exercises,groups,byId} from './catalog.js';
import {icon,anatomy} from './icons.js';
import {today,addDays,weekStart,dayIndex,summary,estimatedMinutes,formatDate,escape as esc} from './state.js';
import {request} from './api.js';
import {startTimer,stopTimer,keepAwake} from './timer.js';
const $=s=>document.querySelector(s),days=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
let data={plans:[],schedule:{weekdays:{},revision:1},sessions:[],history:[]},selectedDate=today(),week=weekStart(today()),selectedPlan='legs',view='workout',group='all',query='',mobileSidebar=false,busy=false,online=false,editingId=null,editorItems=[],loadNumber=0;
const plural=(n,a,b,c)=>n%100>=11&&n%100<=14?c:n%10===1?a:n%10>=2&&n%10<=4?b:c;
const exerciseWord=n=>plural(n,'упражнение','упражнения','упражнений');
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
async function load(silent=false){const token=++loadNumber;try{const next=await request(`state?from=${week}&to=${addDays(week,6)}`);if(token!==loadNumber)return;data=next;try{localStorage.setItem('juligym2:shared-cache',JSON.stringify({data,week}));}catch{}setConnection(true);if(!data.plans.some(p=>p.id===selectedPlan))selectedPlan=data.plans[0]?.id;render();}catch(e){if(token!==loadNumber)return;setConnection(false,e.message);if(!silent)notify(e.message,true);if(!data.plans.length)render();}}
async function mutate(path,body){if(busy)return;loadNumber++;busy=true;renderBusy();try{const result=await request(path,body);if(result.session){const i=data.sessions.findIndex(s=>s.id===result.session.id);if(i<0)data.sessions.push(result.session);else data.sessions[i]=result.session;}setConnection(true);return result;}catch(e){notify(e.message+' Изменение не сохранено.',true);return null;}finally{busy=false;renderBusy();}}
function renderBusy(){document.querySelectorAll('[data-write]').forEach(b=>{b.disabled=busy || !online || ((b.hasAttribute('data-set')||b.id==='finish-workout')&&selectedDate>today()) || (b.hasAttribute('data-set')&&!!currentSession()?.finished_at);if(b.id==='finish-workout'){const p=summary(currentSession()||{items:currentItems(),marks:{}});b.disabled ||= !p.total||p.done!==p.total;}});$('#busy-indicator').hidden=!busy;}
function sidebar(){
 $('#brand').innerHTML=`${icon('leaf')}<span>Моя домашняя<br>тренировка</span>`;
 $('#muscle-groups').innerHTML=[{id:'all',title:'Все группы мышц',count:exercises.length},...groups].map(g=>`<button class="muscle-group ${group===g.id?'active':''}" data-group="${g.id}" aria-pressed="${group===g.id}">${anatomy(g.id)}<span><strong>${g.title}</strong><small>${g.count} упражнений</small></span>${group===g.id?'<i class="selection-dot"></i>':''}</button>`).join('');
 $('#sidebar-create').innerHTML=icon('plus')+' Создать подборку';
 $('#sidebar-foot').innerHTML=`${icon('user')}<div><strong>Дневник Юли</strong><small>Общий · без авторизации</small></div>`;
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
function exerciseCard(item,index,library=false){
 const e=byId[item.id],session=currentSession(),done=session?.marks||{},count=Array.from({length:item.sets||2},(_,i)=>done[`${e.id}:${i}`]===true).filter(Boolean).length,complete=count===(item.sets||2),frozen=!!session?.finished_at;
 return `<article class="exercise-card ${complete&&!library?'is-complete':''}" id="${library?'library':'exercise'}-${e.id}"><header><div><h3>${!library?`<span class="exercise-number">${index+1}</span>`:''}${e.title}</h3><p>${e.muscles}</p></div><span class="difficulty ${e.advanced?'advanced':''}">${e.level}</span>${complete&&!library?`<span class="complete-icon">${icon('check')}</span>`:''}</header><button class="exercise-art" data-image="${e.id}" aria-label="Увеличить: ${e.title}, три фазы"><img src="./media/${e.id}.webp" alt="Юля: ${e.title}. Коралловым выделены ${e.muscles.toLowerCase()}." width="1536" height="1024" loading="${index<2?'eager':'lazy'}"><span class="art-zoom">↗</span></button><div class="phase-labels">${e.phases.map((p,i)=>`<div><b>${i+1}</b><span>${p}</span></div>`).join('')}</div><div class="exercise-meta"><div>${icon('dumbbell')}<span><strong>${item.sets||2} ${plural(item.sets||2,'подход','подхода','подходов')}</strong><small>${esc(item.reps||e.reps)}${e.unit==='seconds'?'':' повторов'}${e.unilateral?' · на сторону':''}</small></span></div><button class="rest-action" data-rest="${item.rest||e.rest}">${icon('clock')}<span>Отдых<strong>${item.rest||e.rest} сек</strong></span></button><div class="completion-count">${icon('check')}<span>${library?'Инвентарь':'Выполнено'}<strong>${library?esc(e.equipment):`${count} / ${item.sets}`}</strong></span></div></div><details class="technique"><summary>${icon('info')} Техника и подсказка</summary><ol>${e.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p>${e.cue}</p><p><b>Легче:</b> ${e.easier}</p></details>${library?`<button class="button secondary add-library" data-add-library="${e.id}">${icon('plus')} Добавить в подборку</button>`:`<div class="set-buttons">${Array.from({length:item.sets},(_,i)=>`<button class="set-button ${done[`${e.id}:${i}`]?'done':''}" data-set="${e.id}:${i}" data-write aria-pressed="${!!done[`${e.id}:${i}`]}" ${frozen?'disabled':''}>${done[`${e.id}:${i}`]?icon('check'):''}Подход ${i+1}${done[`${e.id}:${i}`]?' ✓':''}</button>`).join('')}</div>`}</article>`;
}
function renderWorkout(){
 const openTech=[...document.querySelectorAll('#exercises .technique[open]')].map(e=>e.closest('article').id);
 const plan=selected(),session=currentSession(),items=currentItems(),p=summary(session||{items,marks:{}});
 $('#workout-title').textContent=session?.title||plan?.title||'Выберите тренировку';
 $('#date-badge').textContent=selectedDate===today()?'СЕГОДНЯ':formatDate(selectedDate);
 $('#workout-progress').innerHTML=`<div><span>Прогресс тренировки</span><span>${p.complete} / ${items.length} упражнений</span></div><div class="progress-line"><span style="width:${p.percent}%"></span></div><p>${icon(session?.finished_at?'check':'clock')}${session?.finished_at?'Занятие завершено и сохранено в общем дневнике.':p.done?`${p.percent}% · ${p.done} из ${p.total} подходов`:'Начните с разминки и двигайтесь в своём темпе.'}</p>`;
 $('#exercises').innerHTML=items.map((item,i)=>exerciseCard(item,i)).join('')||'<p class="empty">Создайте подборку из библиотеки.</p>';
 openTech.forEach(id=>{const node=document.getElementById(id)?.querySelector('.technique');if(node)node.open=true;});
 $('#session-actions').innerHTML=`${session?.finished_at?`<div class="session-saved">${icon('check')} Тренировка выполнена · ${formatDate(selectedDate)}<span>${Math.max(1,Math.round(session.duration_seconds/60))} мин</span></div>`:`<button class="button primary" id="finish-workout" data-write ${p.done!==p.total||!p.total?'disabled':''}>${icon('check')} Завершить тренировку</button><p>Завершите все подходы — занятие попадёт в историю, а день получит отметку ✓.</p>`}`;
 $('#training-start').innerHTML=icon('play')+(session?.finished_at?'Посмотреть занятие':session?'Продолжить':'Начать тренировку');
 $('#training-start').disabled=busy||!online||!plan||selectedDate>today();
 $('#edit-plan').disabled=!plan;
}
function renderLibrary(){
 const q=query.trim().toLocaleLowerCase('ru');const filtered=exercises.filter(e=>(group==='all'||e.group===group)&&(`${e.title} ${e.muscles} ${e.equipment}`).toLocaleLowerCase('ru').includes(q));
 $('#library-title').textContent=groups.find(g=>g.id===group)?.title||'Все группы мышц';$('#library-count').textContent=filtered.length+' '+exerciseWord(filtered.length);
 $('#library-grid').innerHTML=filtered.map((e,i)=>exerciseCard(e,i,true)).join('')||'<p class="empty">Ничего не найдено. Измените название или группу мышц.</p>';
}
function renderHistory(){
 $('#history-list').innerHTML=data.history.length?data.history.map(h=>`<button class="history-row" data-history-date="${h.workout_date}" data-history-plan="${h.plan_id}"><span class="history-check">${icon('check')}</span><span><strong>${esc(h.title)}</strong><small>${formatDate(h.workout_date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</small></span><span>${Math.max(1,Math.round(h.duration_seconds/60))} мин</span>${icon('chevron')}</button>`).join(''):'<div class="empty">Здесь появятся реальные завершённые занятия Юли.<br>Отметьте подходы и завершите тренировку.</div>';
 $('#history-total').textContent=data.history.length;
}
function render(){try{localStorage.setItem('juligym2:selected-plan',selectedPlan);}catch{}sidebar();renderWeek();renderPlans();renderWorkout();if(view==='library')renderLibrary();if(view==='history')renderHistory();document.querySelectorAll('[data-view-panel]').forEach(e=>e.hidden=e.dataset.viewPanel!==view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));renderBusy();const s=currentSession();if(s?.finished_at)document.querySelectorAll('[data-set]').forEach(b=>b.disabled=true);else{const p=summary(s||{items:currentItems(),marks:{}});if($('#finish-workout'))$('#finish-workout').disabled=busy||!online||p.done!==p.total||!p.total||selectedDate>today();}}
function setView(next){view=next;closeSidebar();render();window.scrollTo({top:0,behavior:'instant'});}
function openEditor(id=null,addId=null){editingId=id;const plan=data.plans.find(p=>p.id===id);editorItems=(plan?.items||[]).map(i=>({...i}));if(addId)editorItems.push({id:addId,sets:2,reps:byId[addId].reps,rest:byId[addId].rest});$('#editor-title').textContent=id?'Изменить подборку':'Новая подборка';$('#plan-name').value=plan?.title||'';$('#editor-search').value='';renderEditor();$('#editor-dialog').showModal();}
function renderEditor(){
 $('#editor-selected').innerHTML=editorItems.map((item,i)=>`<div class="editor-item"><div><strong>${byId[item.id].title}</strong><small>${byId[item.id].muscles}</small></div><label>Подходы<select data-editor-sets="${item.id}" aria-label="Подходы: ${byId[item.id].title}">${[1,2,3,4,5].map(n=>`<option ${item.sets===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Повторы<input data-editor-reps="${item.id}" value="${esc(item.reps)}" maxlength="10" aria-label="Повторы: ${byId[item.id].title}"></label><label>Отдых<select data-editor-rest="${item.id}" aria-label="Отдых: ${byId[item.id].title}">${[15,30,45,60,75,90,120,180].map(n=>`<option ${item.rest===n?'selected':''} value="${n}">${n} с</option>`).join('')}</select></label><div class="editor-move"><button data-editor-up="${i}" ${i===0?'disabled':''} aria-label="Выше: ${byId[item.id].title}">↑</button><button data-editor-remove="${item.id}" aria-label="Удалить: ${byId[item.id].title}">${icon('close')}</button></div></div>`).join('')||'<p class="empty">Выберите движения ниже. До 20 упражнений в подборке.</p>';
 const q=$('#editor-search').value.toLowerCase();$('#editor-options').innerHTML=exercises.filter(e=>!editorItems.some(i=>i.id===e.id)&&(!q||(`${e.title} ${e.muscles}`).toLowerCase().includes(q))).map(e=>`<button data-editor-add="${e.id}"><span>${e.title}<small>${groups.find(g=>g.id===e.group).title} · ${e.level}</small></span>${icon('plus')}</button>`).join('');$('#editor-counter').textContent=editorItems.length+' / 20';
}
function openSchedule(){
 $('#schedule-days').innerHTML=days.map((d,i)=>`<label>${d}<select data-schedule-day="${i}"><option value="">Отдых</option>${data.plans.map(p=>`<option value="${p.id}" ${data.schedule.weekdays[i]===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select></label>`).join('');$('#schedule-dialog').showModal();
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.group){group=b.dataset.group;setView('library');}
 if(b.dataset.view)setView(b.dataset.view);
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
  if(!currentSession()){const r=await mutate('start',{date:selectedDate,planId:selectedPlan});if(!r)return;}
  render();keepAwake(!currentSession()?.finished_at);$('#exercises').scrollIntoView({behavior:'smooth',block:'start'});
 }
 if(b.dataset.set){const [exerciseId,index]=b.dataset.set.split(':'),done=!currentSession()?.marks?.[b.dataset.set],date=selectedDate,planId=selectedPlan,rest=currentItems().find(e=>e.id===exerciseId)?.rest||60;const result=await mutate('sets',{date,planId,exerciseId,setIndex:Number(index),done,opId:crypto.randomUUID()});if(result){render();if(done&&selectedDate===date&&selectedPlan===planId&&summary(result.session).done<summary(result.session).total)startTimer(rest);}}
 if(b.id==='finish-workout'){const result=await mutate('finish',{date:selectedDate,planId:selectedPlan});if(result){stopTimer();keepAwake(false);notify('Тренировка Юли сохранена. День отмечен в календаре.');await load(true);}}
 if(b.dataset.rest)startTimer(Number(b.dataset.rest));
 if(b.dataset.image){const e=byId[b.dataset.image];$('#image-title').textContent=e.title;$('#image-large').src=`./media/${e.id}.webp`;$('#image-large').alt=`${e.title}: три фазы движения`;$('#image-steps').innerHTML=e.steps.map(s=>`<li>${s}</li>`).join('');$('#image-cue').textContent=e.cue;$('#image-dialog').showModal();}
 if(b.id==='menu-open'){mobileSidebar=!mobileSidebar;document.body.classList.toggle('sidebar-open',mobileSidebar);b.setAttribute('aria-expanded',String(mobileSidebar));$('.sidebar').inert=!mobileSidebar;$('#main').inert=mobileSidebar;$('.mobile-nav').inert=mobileSidebar;if(mobileSidebar)$('#search').focus();}
 if(b.id==='sidebar-backdrop')closeSidebar(true);
 if(b.id==='settings-open')$('#settings-dialog').showModal();
 if(b.id==='refresh-data')await load();
 if(b.id==='show-all-plans'){$('#plans').classList.toggle('all-plans');b.setAttribute('aria-expanded',String($('#plans').classList.contains('all-plans')));}
 if(b.dataset.historyDate){selectedDate=b.dataset.historyDate;week=weekStart(selectedDate);selectedPlan=b.dataset.historyPlan;await load();setView('workout');}
});
document.addEventListener('change',event=>{const e=event.target;if(e.dataset.editorSets)editorItems.find(i=>i.id===e.dataset.editorSets).sets=Number(e.value);if(e.dataset.editorReps)editorItems.find(i=>i.id===e.dataset.editorReps).reps=e.value;if(e.dataset.editorRest)editorItems.find(i=>i.id===e.dataset.editorRest).rest=Number(e.value);});
$('#search').addEventListener('input',event=>{query=event.target.value;if(view!=='library'){view='library';render();}else renderLibrary();});
$('#editor-search').addEventListener('input',renderEditor);
$('#plan-form').addEventListener('submit',async event=>{event.preventDefault();const p=data.plans.find(p=>p.id===editingId),result=await mutate('plans',{id:editingId||undefined,revision:p?.revision,title:$('#plan-name').value,items:editorItems});if(result){selectedPlan=result.plan.id;await load(true);$('#editor-dialog').close();setView('workout');notify('Подборка сохранена в общем дневнике.');}});
$('#schedule-form').addEventListener('submit',async event=>{event.preventDefault();const weekdays={};document.querySelectorAll('[data-schedule-day]').forEach(e=>{if(e.value)weekdays[e.dataset.scheduleDay]=e.value;});const result=await mutate('schedule',{weekdays,revision:data.schedule.revision});if(result){data.schedule=result.schedule;$('#schedule-dialog').close();render();notify('Расписание обновлено для всех посетителей.');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobileSidebar)closeSidebar(true);if(e.key==='Tab'&&mobileSidebar){const nodes=[...$('.sidebar').querySelectorAll('a,button,input')].filter(n=>!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();if(narrow.matches&&!mobileSidebar)$('#menu-open').click();$('#search').focus();}});
document.querySelectorAll('dialog').forEach(d=>{const h=d.querySelector('h2');if(h){h.id ||= d.id+'-heading';d.setAttribute('aria-labelledby',h.id);}});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy)load(true);});
addEventListener('online',()=>load(true));addEventListener('offline',()=>setConnection(false));
setInterval(()=>{if(document.visibilityState==='visible'&&!busy&&!document.querySelector('dialog[open]'))load(true);},20000);
$('#year').textContent=new Date().getFullYear();$('#sidebar-backdrop').innerHTML='';
try{const cached=JSON.parse(localStorage.getItem('juligym2:shared-cache'));if(cached?.data?.plans)data=cached.data;}catch{}
render();load();
