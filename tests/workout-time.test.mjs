import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {workoutEstimate,estimateLabel} from '../src/workout-time.js';
import {exercises} from '../src/catalog.js';
import {stretches} from '../src/stretch-catalog.js';
import {todayMarkup} from '../src/workout-flow.js';

test('time estimate follows reps and sets, includes warmup, excludes rest after final set',()=>{
 const one={items:[{id:'legs01',sets:1,reps:'10',rest:60}]};
 assert.deepEqual([workoutEstimate(one).minSeconds,workoutEstimate(one).maxSeconds],[330,340]);
 const two={items:[{...one.items[0],sets:2}]};
 assert.deepEqual([workoutEstimate(two).minSeconds,workoutEstimate(two).maxSeconds],[420,440]);
 assert.equal(workoutEstimate(two).rest,60);
 assert(workoutEstimate({items:[{...one.items[0],reps:'20–24'}]}).minSeconds>workoutEstimate(one).minSeconds);
 assert.equal(estimateLabel({items:[],stretch_ids:[]}),'0 мин');
});
test('both separate and alternating sides count, hold seconds are not repetition tempo',()=>{
 const hold=workoutEstimate({items:[{id:'core03',sets:2,reps:'15–20 с',rest:60}]});
 assert.equal(hold.strengthMin,60);assert.equal(hold.strengthMax,80);assert.equal(hold.transitions,20);
 const alternate=workoutEstimate({items:[{id:'core06',sets:2,reps:'8–10',rest:45}]});
 assert.equal(alternate.strengthMin,96);assert.equal(alternate.strengthMax,160);assert.equal(alternate.transitions,0);
 const separate=workoutEstimate({items:[{id:'back01',sets:2,reps:'8–10',rest:45}]});
 assert.equal(separate.strengthMin,96);assert.equal(separate.transitions,20);
});
test('mixed plan includes stretch dose overrides, both sides, mobility reps and transitions',()=>{
 const plan={items:[{id:'legs01',sets:1,reps:'10',rest:60}],stretch_ids:['stretch-calves','stretch-cat-cow'],stretch_settings:{'stretch-calves':{seconds:45},'stretch-cat-cow':{repetitions:9}}};
 const value=workoutEstimate(plan);
 assert.equal(value.stretchMin,135);assert.equal(value.stretchMax,144);
 assert.equal(value.transitions,55);assert.equal(value.minSeconds,520);assert.equal(value.maxSeconds,539);
 assert.equal(estimateLabel(plan),'≈ 9 мин');
 const stretch=workoutEstimate({...plan,items:[]});assert.equal(stretch.warmup,0);assert.equal(stretch.minSeconds,160);
});
test('finished or resumed sessions use their own full plan and never present elapsed wall time as exercise time',()=>{
 const session={id:'saved',workout_date:'2026-11-10',plan_id:'legs',title:'Сохранённый состав',started_at:'2026-11-09T01:00:00Z',finished_at:'2026-11-10T10:00:00Z',duration_seconds:28800,result_status:'partial',items:[{id:'legs01',sets:1,reps:'10',rest:60}],stretch_ids:['stretch-calves'],stretch_settings:{'stretch-calves':{seconds:90}},marks:{}};
 const data={schedule:{weekdays:{1:'legs'}},plans:[{id:'legs',title:'Новый состав',items:[{id:'arms01',sets:5,reps:'50',rest:60}]}],sessions:[session]};
 const html=todayMarkup(data,'2026-11-10');assert(html.includes('По плану '+estimateLabel(session)));assert(!html.includes('480 мин'));
 const estimate=workoutEstimate(session);assert.deepEqual(workoutEstimate({...session,started_at:'2020-01-01',duration_seconds:9999999}),estimate);
});
test('all strength and stretch instructions have concrete easier variants and strength sources agree',async()=>{
 const source=JSON.parse(await fs.readFile(new URL('../src/catalog.json',import.meta.url),'utf8'));
 assert.deepEqual(source.map(({spec,...exercise})=>exercise),exercises);
 for(const exercise of [...exercises,...stretches]){
  assert(exercise.easier?.length>30,exercise.id);assert(exercise.easier.length<310,exercise.id);
  assert(!/Уменьшите амплитуду и выполните меньше повторений|Начните без веса, с опорой или с меньшей амплитудой/.test(exercise.easier),exercise.id);
  assert.equal(exercise.steps.length,3);assert.equal(exercise.phases.length,3);
 }
});
