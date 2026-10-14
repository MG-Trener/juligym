import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPlanner,resizeSchedule,recommendations,updateItems,hasAdjacentDays,groups} from '../planner.js';
import {exercises} from '../exercises.js';

test('Старый прогресс совместим с исходными комплексами; данные не дублируются',()=>{
  const planner=initialPlanner({day:2});
  assert.equal(planner.day,2);
  assert.equal(planner.plans[1].items.length,5);
  assert.deepEqual(planner.schedule,[{weekday:0,planId:1},{weekday:2,planId:2},{weekday:4,planId:3}]);
  const corrupt=initialPlanner({plans:[{id:1,items:['row','row','missing'],title:'Test'}],schedule:[{weekday:0,planId:1},{weekday:0,planId:2},{weekday:3,planId:1},{weekday:20,planId:7}]});
  assert.deepEqual(corrupt.plans[0].items,['row']);assert.equal(corrupt.schedule.length,1);
});
test('От одного до семи дней: уникальные дни и независимые комплексы',()=>{
  for(let count=1;count<=7;count++){
    const schedule=resizeSchedule(initialPlanner().schedule,count);
    assert.equal(schedule.length,count);assert.equal(new Set(schedule.map(s=>s.weekday)).size,count);assert.equal(new Set(schedule.map(s=>s.planId)).size,count);
  }
  assert.equal(hasAdjacentDays([{weekday:6},{weekday:0}]),true);
  assert.equal(hasAdjacentDays(initialPlanner().schedule),false);
  assert.deepEqual(resizeSchedule(resizeSchedule(initialPlanner().schedule,7),3).map(s=>s.weekday),[0,2,4]);
});
test('Рекомендации дополняют упражнение, исключают повторы и учитывают состав',()=>{
  for(const id of Object.keys(exercises)){
    const rec=recommendations(id,[]);assert.equal(rec.length,3);
    assert.equal(new Set(rec.map(r=>r.id)).size,3);assert.ok(rec.every(r=>r.id!==id && exercises[r.id] && r.reason));
    const next=recommendations(id,rec.map(r=>r.id));assert.ok(next.every(r=>!rec.some(x=>x.id===r.id)));
  }
  assert.equal(recommendations('row',Object.keys(exercises)).length,0);
  assert.deepEqual(new Set(groups.flatMap(g=>g.items)),new Set(Object.keys(exercises)));
});
test('Изменение комплекса сохраняет оставшиеся подходы и историю',()=>{
  const state={...initialPlanner(),sessions:{'1:easy':{done:['squat:0','row:0'],finished:false},'2:easy':{done:['row:0'],finished:false}},history:[{day:1}]};
  updateItems(state,1,['row','press']);
  assert.deepEqual(state.sessions['1:easy'].done,['row:0']);assert.deepEqual(state.sessions['2:easy'].done,['row:0']);assert.equal(state.history.length,1);
  state.sessions['1:easy'].finished=true;
  updateItems(state,1,['row','press','heel']);assert.deepEqual(state.sessions['1:easy'].done,[]);assert.equal(state.sessions['1:easy'].finished,false);
});
