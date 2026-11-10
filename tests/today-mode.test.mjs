import test from 'node:test';
import assert from 'node:assert/strict';
import {todayWorkoutMode} from '../src/state.js';
const date='2026-11-10';
const plan={id:'day',title:'План',items:[],stretch_ids:['stretch-calves']};
const data=session=>({plans:[plan],schedule:{weekdays:{1:'day'}},sessions:session?[{id:'session',plan_id:'day',workout_date:date,...session}]:[]});
test('Today mode follows the displayed snapshot, including completed stretches and a changed weekly template',()=>{
 assert.equal(todayWorkoutMode(data(),date),'stretch');
 assert.equal(todayWorkoutMode(data({...plan,finished_at:'2026-11-10T08:00:00Z'}),date),'stretch');
 assert.equal(todayWorkoutMode(data({items:[{id:'legs01',sets:2}],stretch_ids:[],marks:{}}),date),'strength');
 assert.equal(todayWorkoutMode({plans:[],schedule:{weekdays:{}},sessions:[]},date),'strength');
});
test('mixed Today switches only when both strength sides are finished, not merely the first side',()=>{
 const mixed={items:[{id:'back01',sets:1}],stretch_ids:['stretch-calves'],marks:{'back01:0:1':true}};
 assert.equal(todayWorkoutMode(data(mixed),date),'strength');
 mixed.marks['back01:0:2']=true;
 assert.equal(todayWorkoutMode(data(mixed),date),'stretch');
 assert.equal(todayWorkoutMode(data({...mixed,finished_at:'2026-11-10T09:00:00Z'}),date),'strength');
});
