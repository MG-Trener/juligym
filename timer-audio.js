// Web Audio schedules ticks against its own clock, independent of UI repainting.
export function createTimerAudio(onError=()=>{}) {
 let context,enabled=true,generation=0;
 const voices=new Set(),key='juligym:timer-sound';
 try{enabled=localStorage.getItem(key)!=='off';}catch{}
 function cancel(){generation++;for(const voice of voices){try{voice.stop();}catch{}voice.disconnect();}voices.clear();}
 async function unlock(){
  const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;
  if(!Audio)throw new Error('Звук недоступен в этом браузере.');
  context ||= new Audio();
  if(context.state!=='running')await context.resume();
  if(context.state!=='running')throw new Error('Нажмите кнопку звука ещё раз, чтобы разрешить воспроизведение.');
 }
 function tone(time,frequency,duration,volume){
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+duration);
  oscillator.connect(gain);gain.connect(context.destination);voices.add(oscillator);
  oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
  oscillator.start(time);oscillator.stop(time+duration+.02);
 }
 async function play(schedule){
  cancel();if(!enabled)return;const token=generation;
  try{await unlock();if(token===generation && enabled)schedule(context.currentTime+.025);}catch(error){if(token===generation)onError(error.message);}
 }
 return {
  get enabled(){return enabled;},
  setEnabled(value){enabled=value;cancel();try{localStorage.setItem(key,value?'on':'off');}catch{}},
  start(seconds){return play(time=>{
   tone(time,520,.09,.045);
   for(let left=Math.ceil(seconds)-1;left>0;left--){const final=left<=5;tone(time+seconds-left,final?880:520,final?.12:.045,final?.09:.035);}
  });},
  finish(){return play(time=>[660,830,1046].forEach((hz,i)=>tone(time+i*.19,hz,.16,.1)));},
  cancel
 };
}

export function createTimerWakeLock(){
 let active=false,lock,pending=false;
 async function sync(){
  if(!active || document.visibilityState!=='visible'){if(lock){const old=lock;lock=null;await old.release().catch(()=>{});}return;}
  if(lock || pending || !navigator.wakeLock)return;
  pending=true;
  try{const acquired=await navigator.wakeLock.request('screen');
   if(!active || document.visibilityState!=='visible')await acquired.release();
   else{lock=acquired;acquired.addEventListener('release',()=>{if(lock===acquired)lock=null;});}
  }catch{}finally{pending=false;}
 }
 document.addEventListener('visibilitychange',sync);
 return value=>{active=value;void sync();};
}
