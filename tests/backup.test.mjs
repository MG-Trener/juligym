import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPlanner} from '../planner.js';
import {createBackup,parseBackup} from '../backup.js';
test('Копия сохраняет расписание, новые движения, растяжку, отметки и историю',()=>{
 const state={...initialPlanner(),mode:'regular',sessions:{'1:regular':{done:['goblet:0','goblet:1'],stretchDone:['stretchhipflexor'],finished:true}},history:[{day:1,date:'2026-10-14T12:00:00.000Z',mode:'regular',title:'Мой день'}]};
 state.plans[0]={id:1,title:'Мой день',items:['goblet'],stretches:['stretchhipflexor']};
 assert.deepEqual(parseBackup(createBackup(state)),state);
});
test('Копия проверяет формат и очищает несуществующие упражнения и отметки',()=>{
 assert.throws(()=>parseBackup('{}'));
 assert.throws(()=>parseBackup('{'));
 const state={...initialPlanner(),sessions:{'1:easy':{done:['bad:0','squat:0','squat:0','squat:2'],stretchDone:['bad'],finished:true}},history:[null,{day:8,date:'bad'}]};
 const result=parseBackup(createBackup(state));
 assert.deepEqual(result.sessions['1:easy'],{done:['squat:0'],stretchDone:[],finished:false});
 assert.deepEqual(result.history,[]);
});
