import {icon} from './icons.js';

const element=document.querySelector('#timer'),observers=new Set();
let context,deadline=0,remaining=0,running=false,interval,voices=[],generation=0,sound=true;
let timerTitle='',timerFinish='',timerDuration=0,pauseReason='';
let workoutAwake=false,screen=null,wakePending=false,wakeIssue=false,pageActive=true;
try{sound=localStorage.getItem('juligym2:sound')!=='off';}catch{}

export function observeTimer(callback){observers.add(callback);return ()=>observers.delete(callback);}
const secondsLeft=()=>running?Math.max(0,Math.ceil((deadline-Date.now())/1000)):remaining;
export function timerSnapshot(){return element.hidden?null:{remaining:secondsLeft(),title:timerTitle,finish:timerFinish,duration:timerDuration};}
function changed(){for(const callback of observers)callback(timerSnapshot());}
const wantsScreen=()=>pageActive&&document.visibilityState==='visible'&&(workoutAwake||running);
function screenNote(){
 const unavailable=wantsScreen()&&!screen&&!wakePending&&(!navigator.wakeLock||wakeIssue);
 document.querySelectorAll('[data-awake-note]').forEach(note=>{
  note.hidden=!unavailable;
  note.textContent='Не удалось удержать экран включённым. При сворачивании таймер встанет на паузу.';
 });
}
async function syncScreen(){
 if(!wantsScreen()){
  const previous=screen;screen=null;
  try{await previous?.release();}catch{}
  screenNote();return;
 }
 if(screen||wakePending||!navigator.wakeLock){screenNote();return;}
 wakePending=true;screenNote();
 try{
  const next=await navigator.wakeLock.request('screen');
  if(!wantsScreen()){await next.release();return;}
  screen=next;wakeIssue=false;
  next.addEventListener('release',()=>{if(screen===next){screen=null;wakeIssue=true;screenNote();}});
 }catch{wakeIssue=true;}
 finally{wakePending=false;screenNote();}
}
// The workout and a running standalone timer independently need the screen.
export function keepAwake(active){workoutAwake=!!active;return syncScreen();}

function cancelAudio(){generation++;voices.forEach(node=>{try{node.stop();node.disconnect();}catch{}});voices=[];}
function tone(time,frequency,duration=.1){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,time);
 gain.gain.linearRampToValueAtTime(.07,time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+duration);
 oscillator.connect(gain);gain.connect(context.destination);oscillator.start(time);oscillator.stop(time+duration+.02);voices.push(oscillator);
 oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();voices=voices.filter(node=>node!==oscillator);};
}
function soundNote(){
 const note=element.querySelector('[data-timer-note]');
 const text=sound&&running&&context?.state!=='running'?'Для звука нажмите кнопку «Звук».':'При сворачивании — пауза. Продолжите, когда готовы.';
 if(note&&note.textContent!==text)note.textContent=text;
}
function prepareAudio(){
 if(!sound)return Promise.resolve(false);
 try{
  if(!context||context.state==='closed'){
   context=new (window.AudioContext||window.webkitAudioContext)();
   context.addEventListener('statechange',soundNote);
  }
  // Called in the original click, before any network request loses user activation.
  const resume=context.resume();soundNote();
  return resume.then(()=>{soundNote();return context.state==='running';},()=>{soundNote();return false;});
 }catch{soundNote();return Promise.resolve(false);}
}
async function audio(seconds,end=false){
 cancelAudio();if(!sound||document.visibilityState!=='visible'||!pageActive)return;
 const token=generation;
 if(!await prepareAudio()||token!==generation)return;
 const time=context.currentTime+.02;
 if(end){[660,880,1046].forEach((frequency,index)=>tone(time+index*.2,frequency,.15));navigator.vibrate?.([100,70,100]);}
 else{
  tone(time,500,.04);
  // A quiet start, last five seconds, then a distinct finish. No long queued audio.
  for(let n=Math.max(1,seconds-5);n<seconds;n++)tone(time+n,880,.12);
 }
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button||button.disabled)return;
 if(button.matches('[data-today-start],[data-day-start],#training-start,[data-guided-set],[data-set],[data-rest],[data-guided-hold],[data-stretch-hold],[data-stretch-resume],[data-timer-toggle],[data-timer-more],[data-timer-sound]'))void prepareAudio();
 if(workoutAwake)void syncScreen();
},true);

function paint(){
 remaining=secondsLeft();
 element.querySelector('[data-time]').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
 if(running&&!remaining){running=false;clearInterval(interval);void audio(0,true);void syncScreen();}
 const toggle=element.querySelector('[data-timer-toggle]');
 toggle.textContent=running?'Пауза':remaining?'Продолжить':'Повторить';
 toggle.setAttribute('aria-label',running?'Пауза таймера':remaining?'Продолжить таймер':'Повторить таймер');
 const description=element.querySelector('.timer-description');
 const text=!remaining?timerFinish:running?timerTitle:pauseReason||'Таймер на паузе · продолжите, когда готовы';
 if(description.textContent!==text)description.textContent=text;
 soundNote();
}
export function pauseTimer(reason='Таймер на паузе · продолжите, когда готовы'){
 if(element.hidden)return;
 remaining=secondsLeft();running=false;pauseReason=reason;clearInterval(interval);cancelAudio();paint();changed();void syncScreen();
}
export function restoreTimer(snapshot){
 if(!snapshot||!Number.isFinite(snapshot.remaining)||snapshot.remaining<0||snapshot.remaining>3600)return;
 timerTitle=String(snapshot.title||'Таймер');timerFinish=String(snapshot.finish||'Время завершено.');
 timerDuration=Number.isFinite(snapshot.duration)&&snapshot.duration>0&&snapshot.duration<=3600?snapshot.duration:snapshot.remaining;
 runTimer(snapshot.remaining,false);
}
export function startTimer(seconds,title='Отдых между подходами',finish='Отдых завершён. Продолжайте, когда готовы.'){
 if(!Number.isFinite(seconds)||seconds<=0||seconds>3600)return;
 timerTitle=title;timerFinish=finish;timerDuration=seconds;runTimer(seconds);
 if(element.closest('#stretch-timer-slot'))element.scrollIntoView({block:'nearest',behavior:'instant'});
}
function runTimer(seconds,autostart=true){
 clearInterval(interval);cancelAudio();remaining=seconds;deadline=Date.now()+seconds*1000;
 running=autostart&&pageActive&&document.visibilityState==='visible';pauseReason='';element.hidden=false;
 element.setAttribute('aria-label',timerTitle);
 element.innerHTML=`<div class="timer-head">${icon('clock')}<span class="timer-description" role="status"></span><button data-timer-close aria-label="Закрыть таймер">${icon('close')}</button></div><div class="timer-body"><strong data-time role="timer" aria-live="off"></strong><button data-timer-toggle></button><button data-timer-more>+15 с</button><button data-timer-sound aria-pressed="${sound}" aria-label="Звук таймера">${icon('sound')} ${sound?'Вкл':'Выкл'}</button></div><small class="timer-note" data-timer-note></small>`;
 if(running){void audio(seconds);interval=setInterval(()=>{paint();changed();},250);}
 paint();changed();void syncScreen();
}
export function stopTimer(){running=false;clearInterval(interval);cancelAudio();element.hidden=true;changed();void syncScreen();}
element.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-timer-close'))stopTimer();
 if(button.hasAttribute('data-timer-more'))runTimer(Math.min(3600,secondsLeft()+15),running);
 if(button.hasAttribute('data-timer-toggle')){
  if(running)pauseTimer();else runTimer(remaining||timerDuration);
 }
 if(button.hasAttribute('data-timer-sound')){
  // A blocked audio context needs a direct retry, not a misleading switch to mute.
  if(sound&&running&&context?.state!=='running'){void audio(secondsLeft());return;}
  sound=!sound;try{localStorage.setItem('juligym2:sound',sound?'on':'off');}catch{}
  if(sound&&running)void audio(secondsLeft());else cancelAudio();
  button.setAttribute('aria-pressed',String(sound));button.innerHTML=icon('sound')+(sound?' Вкл':' Выкл');soundNote();
 }
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible')pauseTimer('Таймер на паузе после сворачивания');
 void syncScreen();
});
addEventListener('pagehide',()=>{pageActive=false;pauseTimer('Таймер на паузе · продолжите, когда готовы');void syncScreen();});
addEventListener('pageshow',()=>{pageActive=true;void syncScreen();});
