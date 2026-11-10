import test from 'node:test';
import assert from 'node:assert/strict';
import {dayMove,dayRestore,checkDayVersion,removedExercise,editDayLayout} from '../api/day-layout.mjs';
import {dayEdit,editDayItems,defaultPlans} from '../api/model.mjs';
import {dayMarkup,weeklyLabel} from '../src/week-plan.js';

const fixture=()=>({...structuredClone(defaultPlans[0]),id:'weekday-0',revision:7,stretch_ids:['stretch-calves','stretch-sphinx','stretch-cat-cow'],stretch_settings:{'stretch-sphinx':{seconds:45},'stretch-cat-cow':{repetitions:9}}});
const version=base=>({expectedPlanId:base.id,expectedRevision:base.revision});
const updated=(base,next)=>({...base,items:next.items,stretch_ids:next.stretchIds,stretch_settings:next.stretchSettings,revision:base.revision+1});
function remove(base,id){
 const edit=dayEdit({weekday:0,exerciseId:id,added:false}),plan=updated(base,editDayItems(base,edit));
 return {plan,undo:removedExercise(base,edit,plan)};
}
test('move swaps one adjacent movement without changing its dose, the other section, or source template',()=>{
 const base=fixture(),before=structuredClone(base);
 const edit=dayMove({weekday:0,exerciseId:'legs01',direction:1,...version(base)});
 checkDayVersion(base,base.id,edit);
 const next=editDayLayout(base,edit);
 assert.deepEqual(next.items.map(i=>i.id),['glutes01','legs01','legs11','glutes06','legs09','core06']);
 assert.deepEqual(next.items[1],before.items[0]);assert.deepEqual(next.stretchIds,base.stretch_ids);assert.deepEqual(next.stretchSettings,base.stretch_settings);assert.deepEqual(base,before);
 const stretch=editDayLayout(base,dayMove({weekday:0,exerciseId:'stretch-sphinx',direction:-1,...version(base)}));
 assert.deepEqual(stretch.stretchIds,['stretch-sphinx','stretch-calves','stretch-cat-cow']);assert.deepEqual(stretch.items,base.items);
 assert.equal(editDayLayout(base,{...edit,direction:-1}),null,'first position has no previous item');
 assert.throws(()=>dayMove({weekday:0,exerciseId:'legs01',direction:2,...version(base)}));
 assert.throws(()=>checkDayVersion({...base,revision:8},base.id,edit));
});
test('undo restores the removed item and its dose, keeps later edits, and does not overwrite a re-added item',()=>{
 const base=fixture();base.items[1]={...base.items[1],sets:4,reps:'14',rest:75};
 const {plan,undo}=remove(base,'glutes01');
 plan.items[1]={...plan.items[1],sets:5};
 const restore=dayRestore({undo,...version(plan)}),next=editDayLayout(plan,restore);
 assert.deepEqual(next.items[1],base.items[1]);assert.equal(next.items[2].sets,5);
 const readded=updated(plan,next);readded.items[1].sets=3;
 assert.equal(editDayLayout(readded,restore),null,'repeat undo preserves a manual re-add');
 assert.throws(()=>dayRestore({undo:{...undo,item:{...undo.item,id:'legs01'}},...version(plan)}));
});
test('undo restores both static hold time and dynamic repetitions, including the last exercise of a day',()=>{
 for(const id of ['stretch-sphinx','stretch-cat-cow']){
  const base=fixture(),{plan,undo}=remove(base,id),next=editDayLayout(plan,dayRestore({undo,...version(plan)}));
  assert.deepEqual(next.stretchIds,base.stretch_ids);assert.deepEqual(next.stretchSettings,base.stretch_settings);
 }
 const base={...fixture(),items:[],stretch_ids:['stretch-sphinx']},{plan,undo}=remove(base,'stretch-sphinx');
 const restore=dayRestore({undo,expectedPlanId:null,expectedRevision:plan.revision});
 checkDayVersion(plan,null,restore);assert.deepEqual(editDayLayout(plan,restore).stretchIds,['stretch-sphinx']);
 assert.throws(()=>checkDayVersion({...plan,revision:plan.revision+1},null,{...restore,expectedRevision:plan.revision+1}),'do not restore over a later cleared plan');
 assert.throws(()=>checkDayVersion({...plan,id:'core'},'core',{...restore,expectedPlanId:'core'}),'do not restore into a different template');
});
test('weekly label covers every weekday and distinguishes a session snapshot from the editable template',()=>{
 assert.deepEqual(Array.from({length:7},(_,i)=>weeklyLabel(i)),['План всех понедельников','План всех вторников','План всех сред','План всех четвергов','План всех пятниц','План всех суббот','План всех воскресений']);
 const plan=fixture(),session={...plan,plan_id:plan.id,workout_date:'2026-11-09',items:[plan.items[0]],stretch_ids:[]};
 const data={plans:[plan],schedule:{weekdays:{0:plan.id}},sessions:[session]};
 const markup=dayMarkup(data,'2026-11-09');
 assert.match(markup.intro,/1 силовых · 0 на растяжку/);assert.match(markup.intro,/План всех понедельников/);assert.match(markup.intro,/уже начато/);
 assert.match(markup.lists,/data-day-move="glutes01"/);
});
