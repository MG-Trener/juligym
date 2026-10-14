import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {stretches,stretchGroups,trainedMuscles,stretchRecommendations,stretchMatches,updateStretches} from '../stretches.js';
import {initialPlanner,updateItems} from '../planner.js';
import {exercises} from '../exercises.js';

test('Все группы покрыты: 10 иллюстрированных растяжек с секундами и техникой',()=>{
  assert.equal(Object.keys(stretches).length,10);
  assert.equal(stretchGroups.length,7);
  assert.deepEqual(stretchGroups.flatMap(g=>g.items).sort(),Object.keys(stretches).sort());
  for(const [id,e] of Object.entries(stretches)){
    assert.ok(existsSync(new URL(`../assets/exercises/${id}.webp`,import.meta.url)));
    assert.equal(e.phases.length,3);assert.equal(e.steps.length,3);assert.equal(e.seconds,20);
    assert.ok(e.cue && e.avoid && e.easier && e.targets.length);
  }
  assert.deepEqual(Object.keys(trainedMuscles).sort(),Object.keys(exercises).sort());
});
test('Подборка только для тренируемых мышц, без повторов и лишних рекомендаций',()=>{
  assert.deepEqual(stretchRecommendations([],[]),[]);
  assert.deepEqual(stretchRecommendations(['curl']).map(r=>r.id),['stretchbiceps']);
  assert.deepEqual(stretchRecommendations(['squat']).map(r=>r.id),['stretchquad','stretchglute']);
  for(const id of Object.keys(exercises)){
    const rec=stretchRecommendations([id]);
    assert.ok(rec.length>0 && rec.length<=3);
    assert.ok(rec.every(r=>stretchMatches(r.id,[id]).includes(id) && r.reason.includes(exercises[id].title)));
    const next=stretchRecommendations([id],rec.map(r=>r.id));
    assert.ok(next.every(r=>!rec.some(x=>x.id===r.id)));
  }
  assert.equal(stretchRecommendations(Object.keys(exercises),Object.keys(stretches)).length,0);
});
test('Миграция старого плана и очистка повреждённых данных растяжки',()=>{
  assert.ok(initialPlanner().plans.every(p=>p.stretches.length===0));
  const planner=initialPlanner({plans:[{id:1,items:['curl','stretchquad'],stretches:['stretchquad','bad','stretchquad'],title:'План'}]});
  assert.deepEqual(planner.plans[0].items,['curl']);
  assert.deepEqual(planner.plans[0].stretches,['stretchquad']);
});
test('Добавление после завершения сохраняет силовые подходы и историю; отметки независимы',()=>{
  const state={...initialPlanner(),sessions:{'1:easy':{done:['squat:0'],finished:true,stretchDone:['stretchquad']},'1:regular':{done:['row:1'],stretchDone:['stretchquad']},'2:easy':{done:['row:0'],stretchDone:['stretchback']}},history:[{day:1}]};
  updateStretches(state,1,['stretchquad','stretchham','stretchham','bad']);
  assert.deepEqual(state.plans[0].stretches,['stretchquad','stretchham']);
  assert.deepEqual(state.sessions['1:easy'],{done:['squat:0'],finished:true,stretchDone:['stretchquad']});
  assert.equal(state.history.length,1);
  updateStretches(state,1,['stretchham']);
  assert.deepEqual(state.sessions['1:easy'].stretchDone,[]);
  assert.deepEqual(state.sessions['1:regular'].stretchDone,[]);
  assert.deepEqual(state.sessions['2:easy'].stretchDone,['stretchback']);
  state.sessions['1:easy'].stretchDone=['stretchham'];
  updateItems(state,1,['curl']);
  assert.deepEqual(state.sessions['1:easy'].stretchDone,[]);
});
