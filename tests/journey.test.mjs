import test from 'node:test';
import assert from 'node:assert/strict';
import {todayMarkup} from '../src/workout-flow.js';
const date='2026-11-10';
const session={id:'session',plan_id:'mixed',title:'Мой комплекс',workout_date:date,items:[{id:'back01',sets:1}],stretch_ids:['stretch-calves'],marks:{'back01:0:1':true,'back01:0:2':true},stretch_state:{position:0,marks:{}}};
const data=s=>({plans:[],sessions:[s],schedule:{weekdays:{}}});
test('mixed Today explains remaining stretching and shows its progress instead of a full strength bar',()=>{
 const html=todayMarkup(data(session),date);
 assert.match(html,/Осталась растяжка/);assert.match(html,/>.*К растяжке<\/button>/);
 assert.match(html,/Икры у стены · левая сторона/);
 assert.match(html,/max="2" value="0" aria-label="Выполненные шаги растяжки"/);
 const partial=todayMarkup(data({...session,marks:{'back01:0:1':true}}),date);
 assert.doesNotMatch(partial,/Осталась растяжка/);assert.match(partial,/правая сторона/);
});
test('mixed continuation names the saved stretch side, previous-day session and final review without creating a new workout',()=>{
 const progressed={...session,stretch_state:{position:1,marks:{'stretch-calves:1':'done'}}};
 for(const workout_date of [date,'2026-11-09']){
  const html=todayMarkup(data({...progressed,workout_date}),date);
  assert.match(html,/Икры у стены · правая сторона/);assert.match(html,/Продолжить растяжку/);
  assert.match(html,/Растяжка · выполнено шагов: 1 из 2/);
  assert.match(html,new RegExp('data-workout-date="'+workout_date+'" data-workout-plan="mixed"'));
 }
 const finishedSteps={...session,stretch_state:{position:2,marks:{'stretch-calves:1':'done','stretch-calves:2':'done'}}};
 assert.match(todayMarkup(data(finishedSteps),date),/К результату/);
 const saved=todayMarkup(data({...finishedSteps,finished_at:'2026-11-10T12:00:00Z',result_status:'completed'}),date);
 assert.match(saved,/Сохранено в дневнике/);assert.match(saved,/Растяжка · выполнено шагов: 2 из 2/);assert.doesNotMatch(saved,/Осталась растяжка/);
 const previousStretch=todayMarkup(data({...progressed,items:[],workout_date:'2026-11-09'}),date);
 assert.doesNotMatch(previousStretch,/Силовая часть готова/);assert.match(previousStretch,/Продолжить растяжку/);
});
