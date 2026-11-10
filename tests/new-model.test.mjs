import test from 'node:test';
import assert from 'node:assert/strict';
import {exercises,groups} from '../src/catalog.js';
import {defaultPlans,planValue,dateValue,scheduleValue,progress} from '../api/model.mjs';
import {firstPendingSet,todaySelection} from '../src/state.js';
test('87 movements in 7 exact groups; complete instructions and individual image names',()=>{assert.equal(exercises.length,87);assert.equal(new Set(exercises.map(e=>e.id)).size,87);assert.deepEqual(groups.map(g=>g.count),[18,14,12,9,11,13,10]);for(const e of exercises){assert.equal(e.phases.length,3);assert.equal(e.steps.length,3);assert.ok(e.title&&e.cue&&e.equipment&&e.easier);}});
test('default plans are valid and use known movements without repetitions',()=>{assert.equal(defaultPlans.length,3);for(const plan of defaultPlans){assert.equal(plan.items.length,6);assert.equal(planValue(plan).items.length,6);}});
test('input validation rejects malformed plans, dates and schedules',()=>{for(const v of ['bad','2026-02-30','2026-13-01',null])assert.throws(()=>dateValue(v));assert.equal(dateValue('2026-10-29'),'2026-10-29');assert.throws(()=>planValue({title:'a',items:[]}));assert.throws(()=>planValue({title:'xx',items:[{id:'not-real'}]}));assert.throws(()=>planValue({title:'xx',items:[{id:'legs01',sets:999}]}));assert.throws(()=>planValue({title:'xx',items:[{id:'legs01',reps:'<script>'}]}));assert.throws(()=>scheduleValue({'7':'legs'},['legs']));assert.deepEqual(scheduleValue({'0':'legs'},['legs']),{'0':'legs'});});
test('progress counts known snapshot sets and ignores unrelated marks',()=>{const s={items:[{id:'legs01',sets:2},{id:'glutes01',sets:1}],marks:{'legs01:0':true,'legs01:1':false,'glutes01:0':true,'extra:0':true}};assert.deepEqual(progress(s),{total:3,done:2,percent:67});});

test('guided resume uses snapshot order and the first missing or undone approach',()=>{
 const items=[{id:'legs01',sets:3},{id:'glutes01',sets:1}];
 const marks={'legs01:0':true,'legs01:1':false,'legs01:2':true,'glutes01:0':true,'extra:0':true};
 assert.deepEqual(firstPendingSet({items,marks}),{item:items[0],exerciseIndex:0,setIndex:1,side:0});
 marks['legs01:1']=true;
 assert.equal(firstPendingSet({items,marks}),null);
 delete marks['glutes01:0'];
 assert.deepEqual(firstPendingSet({items,marks}),{item:items[1],exerciseIndex:1,setIndex:0,side:0});
});

test('Today follows the local schedule and prioritizes an active session on the same date',()=>{
 const date='2026-11-09';
 const planned={id:'scheduled'}, manual={id:'manual'};
 const previous={workout_date:'2026-11-06',plan_id:'manual',finished_at:null};
 const active={workout_date:date,plan_id:'manual',finished_at:null};
 const finished={workout_date:date,plan_id:'scheduled',finished_at:'2026-11-09T03:00:00Z'};
 const data={plans:[planned,manual],schedule:{weekdays:{0:'scheduled'}},sessions:[previous]};
 assert.deepEqual(todaySelection(data,date),{plan:planned,session:null,previous});
 data.sessions.push(finished,active,{workout_date:'2026-11-10',finished_at:null});
 assert.deepEqual(todaySelection(data,date),{plan:manual,session:active,previous});
 data.sessions.splice(2,1);
 assert.deepEqual(todaySelection(data,date),{plan:planned,session:finished,previous});
 assert.equal(todaySelection(data,'2026-11-08').plan,undefined);
 assert.equal(todaySelection(data,'2026-11-08').previous,previous);
});
