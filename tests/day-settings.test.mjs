import test from 'node:test';
import assert from 'node:assert/strict';
import {dayEdit,editDayItems,daySettings,editDaySettings,defaultPlans} from '../api/model.mjs';
import {doseValue,stretchExercise} from '../src/day-settings.js';
import {createDayAutosave} from '../src/day-autosave.js';

test('dose inputs reject invalid ranges, zero, decimals and unsupported units',()=>{
 assert.equal(doseValue('legs01','reps',' 10 - 12 '),'10–12');
 assert.equal(doseValue('core02','reps','30'),'30 с');
 assert.equal(doseValue('stretch-sphinx','seconds','35'),35);
 assert.equal(doseValue('stretch-cat-cow','repetitions','8'),8);
 for(const value of ['',0,6,1.5,'2abc'])assert.throws(()=>doseValue('legs01','sets',value));
 for(const value of ['0','12-8','100','8.5','8 с'])assert.throws(()=>doseValue('legs01','reps',value));
 for(const value of ['',0,4,301,20.5])assert.throws(()=>doseValue('stretch-sphinx','seconds',value));
 assert.throws(()=>doseValue('stretch-cat-cow','seconds',20));
 assert.throws(()=>daySettings({weekday:7,exerciseId:'legs01',field:'sets',value:3}));
});

test('editing a day preserves the template, other fields and snapshot settings',()=>{
 const base={...defaultPlans[0],stretch_ids:['stretch-sphinx'],stretch_settings:{'stretch-sphinx':{seconds:20}}};
 const snapshot=structuredClone(base),original=structuredClone(base);
 const next=editDaySettings(base,daySettings({weekday:0,exerciseId:'legs01',field:'sets',value:4}));
 assert.equal(next.items[0].sets,4);
 assert.equal(next.items[0].reps,base.items[0].reps);
 const hold=editDaySettings(base,daySettings({weekday:0,exerciseId:'stretch-sphinx',field:'seconds',value:45}));
 assert.equal(stretchExercise('stretch-sphinx',hold.stretchSettings).seconds,45);
 assert.equal(stretchExercise('stretch-sphinx',snapshot.stretch_settings).seconds,20);
 assert.deepEqual(base,original);
 assert.throws(()=>editDaySettings(base,daySettings({weekday:0,exerciseId:'back01',field:'sets',value:3})));
 const removed=editDayItems(base,dayEdit({weekday:0,exerciseId:'stretch-sphinx',added:false}));
 assert.deepEqual(removed.stretchSettings,{});
});

test('autosave keeps newer input during a slow write and serializes adjacent fields',async()=>{
 const sent=[];let release;
 const queue=createDayAutosave(async body=>{
  sent.push({...body});
  if(sent.length===1)await new Promise(resolve=>release=resolve);
 },()=>{},10000);
 const body={weekday:0,exerciseId:'legs01',field:'reps'};
 queue.edit(body,'12');
 const flush=queue.flush();
 queue.edit(body,'14');
 queue.edit({...body,field:'sets'},'3');
 queue.edit({...body,weekday:1},'16');
 release();await flush;
 assert.deepEqual(sent.map(item=>[item.weekday,item.field,item.value]),[[0,'reps','12'],[0,'reps','14'],[0,'sets',3],[1,'reps','16']]);
 assert.equal(queue.unsaved,false);
 await queue.flush();
});

test('autosave exposes failure, retries explicitly, and never sends invalid input',async()=>{
 let fails=true,calls=0;
 const queue=createDayAutosave(async()=>{calls++;if(fails)throw Error('Offline');},()=>{},10000);
 const body={weekday:0,exerciseId:'legs01',field:'sets'};
 queue.edit(body,'3');await queue.flush();
 assert.equal(queue.unsaved,true);
 assert.equal([...queue.entries.values()][0].state,'error');
 fails=false;queue.retry(0,'legs01');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(queue.unsaved,false);assert.equal(calls,2);
 queue.edit(body,'0');await queue.flush();
 assert.equal(calls,2);assert.equal(queue.unsaved,true);
 queue.discard(0,'legs01');assert.equal(queue.unsaved,false);
});
