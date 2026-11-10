import test from 'node:test';
import assert from 'node:assert/strict';
import {separateSides,setDone,pendingSet,sessionResult,advanceStretch,stretchSteps} from '../src/session-progress.js';

test('one side survives resume, both sides make a set, legacy complete marks stay complete',()=>{
 const item={id:'back01',sets:2};const session={items:[item],marks:{'back01:0:1':true}};
 assert.equal(setDone(session,item,0),false);assert.equal(pendingSet(session).side,2);
 assert.equal(sessionResult(session).worked,1);assert.equal(sessionResult(session).status,'partial');
 session.marks['back01:0:2']=true;assert.equal(pendingSet(session).setIndex,1);
 session.marks['back01:1']=true;assert.equal(pendingSet(session),null);assert.equal(sessionResult(session).status,'completed');
 assert.equal(separateSides({id:'arms06'}),true);
 assert.equal(separateSides({id:'core06'}),false);
 assert.equal(separateSides({id:'back01',sideMode:'together'}),false,'snapshot mode remains immutable');
});
test('stretch skip does not erase a finished side or count the other as finished',()=>{
 const ids=['stretch-calves','stretch-sphinx'];let state=advanceStretch(ids,{},'next');
 assert.equal(state.position,1);assert.equal(stretchSteps(ids)[1].side,2);
 state=advanceStretch(ids,state,'skip');assert.equal(state.position,2);
 const session={items:[],stretch_ids:ids,stretch_state:state};
 assert.deepEqual(sessionResult(session).stretch,{total:3,done:1,skipped:1});
 assert.equal(sessionResult(session).status,'partial');
 state=advanceStretch(ids,state,'previous');assert.equal(state.position,1);
 state=advanceStretch(ids,state,'next');state=advanceStretch(ids,state,'next');
 assert.equal(sessionResult({...session,stretch_state:state}).status,'completed');
});
test('mixed session requires strength and stretch; an empty session is never complete',()=>{
 const session={items:[{id:'legs01',sets:1}],marks:{'legs01:0':true},stretch_ids:['stretch-sphinx']};
 assert.equal(sessionResult(session).status,'partial');
 assert.equal(sessionResult({...session,stretch_state:{marks:{'stretch-sphinx:1':'done'}}}).status,'completed');
 assert.equal(sessionResult({}).worked,0);assert.equal(sessionResult({}).status,'partial');
});
