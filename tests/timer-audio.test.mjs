import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimerAudio} from '../timer-audio.js';
test('Звук: секундные сигналы, последние пять, завершение, отмена и сохранение выключения',async()=>{
 const saved={AudioContext:globalThis.AudioContext,localStorage:globalThis.localStorage},nodes=[],store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.AudioContext=class{currentTime=0;state='running';destination={};createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){const n={frequency:{value:0},connect(){},disconnect(){},start(t){this.time=t;},stop(){this.stops=(this.stops||0)+1;}};nodes.push(n);return n;}};
 try{
  const audio=createTimerAudio();await audio.start(10);assert.equal(nodes.length,10);
  assert.equal(nodes.filter(n=>n.frequency.value===880).length,5);
  assert.ok(Math.abs(nodes[1].time-nodes[0].time-1)<.0001);
  audio.cancel();assert.ok(nodes.every(n=>n.stops===2));
  await audio.finish();assert.deepEqual(nodes.slice(-3).map(n=>n.frequency.value),[660,830,1046]);
  audio.setEnabled(false);const count=nodes.length;await audio.start(60);await audio.finish();assert.equal(nodes.length,count);assert.equal(createTimerAudio().enabled,false);
 }finally{globalThis.AudioContext=saved.AudioContext;globalThis.localStorage=saved.localStorage;}
});
test('Позднее разрешение звука не запускает уже отменённый таймер',async()=>{
 const saved=globalThis.AudioContext;let resume,created=0;
 globalThis.AudioContext=class{state='suspended';currentTime=0;resume(){return new Promise(resolve=>resume=()=>{this.state='running';resolve();});}createOscillator(){created++;}};
 try{const audio=createTimerAudio();const start=audio.start(20);audio.cancel();resume();await start;assert.equal(created,0);}finally{globalThis.AudioContext=saved;}
});
