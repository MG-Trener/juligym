import {icon} from './icons.js';
const element=document.querySelector('#timer');let context,deadline=0,remaining=0,running=false,interval,voices=[],generation=0,sound=true,screen;
let timerTitle, timerFinish, timerDuration;
try{sound=localStorage.getItem('juligym2:sound')!=='off';}catch{}
function cancelAudio(){generation++;voices.forEach(o=>{try{o.stop();o.disconnect();}catch{}});voices=[];}
function tone(t,f,d=.08){const o=context.createOscillator(),g=context.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(context.destination);o.start(t);o.stop(t+d+.02);voices.push(o);o.onended=()=>{o.disconnect();g.disconnect();voices=voices.filter(n=>n!==o);};}
async function audio(seconds,end=false){cancelAudio();if(!sound)return;const token=generation;try{context ||= new (window.AudioContext||window.webkitAudioContext)();await context.resume();if(token!==generation)return;const time=context.currentTime+.02;if(end){[660,880,1046].forEach((f,i)=>tone(time+i*.2,f,.15));navigator.vibrate?.([100,70,100]);}else for(let n=1;n<seconds;n++)tone(time+n,seconds-n<=5?880:500,seconds-n<=5?.12:.04);}catch{}}
export async function keepAwake(active){try{if(!active && screen){await screen.release();screen=null;}else if(active && !screen && document.visibilityState==='visible' && navigator.wakeLock){screen=await navigator.wakeLock.request('screen');screen.addEventListener('release',()=>screen=null);}}catch{}}
function paint(){if(running)remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));element.querySelector('[data-time]').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;if(running && !remaining){running=false;clearInterval(interval);audio(0,true);element.querySelector('[data-timer-toggle]').textContent='↻';element.querySelector('.timer-description').textContent=timerFinish;}}
export function startTimer(seconds, title='Отдых между подходами', finish='Отдых завершён. Продолжайте, когда готовы.') {
 timerTitle=title;
 timerFinish=finish;
 timerDuration=seconds;
 runTimer(seconds);
}
function runTimer(seconds) {
 clearInterval(interval);remaining=seconds;deadline=Date.now()+seconds*1000;running=true;element.hidden=false;
 element.setAttribute('aria-label',timerTitle);
 element.innerHTML=`<div class="timer-head">${icon('clock')}<span class="timer-description"></span><button data-timer-close aria-label="Закрыть таймер">${icon('close')}</button></div><div class="timer-body"><strong data-time></strong><button data-timer-toggle aria-label="Пауза или продолжение">Ⅱ</button><button data-timer-more>+15 с</button><button data-timer-close>Пропустить</button><button data-timer-sound aria-pressed="${sound}" aria-label="Звук таймера">${icon('sound')} ${sound?'Вкл':'Выкл'}</button></div>`;
 element.querySelector('.timer-description').textContent=timerTitle;
 audio(seconds);paint();interval=setInterval(paint,250);keepAwake(true);
}
export function stopTimer(){running=false;clearInterval(interval);cancelAudio();element.hidden=true;}
element.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button)return;
 if(button.hasAttribute('data-timer-close'))stopTimer();
 if(button.hasAttribute('data-timer-more'))runTimer((running?Math.max(0,Math.ceil((deadline-Date.now())/1000)):remaining)+15);
 if(button.hasAttribute('data-timer-toggle')){
  if(!remaining)return runTimer(timerDuration);
  if(!running)return runTimer(remaining);
  paint();
  if(!running)return;
  running=false;clearInterval(interval);cancelAudio();button.textContent='▶';
 }
 if(button.hasAttribute('data-timer-sound')){
  sound=!sound;
  try{localStorage.setItem('juligym2:sound',sound?'on':'off');}catch{}
  if(sound&&running)audio(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
  else cancelAudio();
  button.setAttribute('aria-pressed',String(sound));
  button.innerHTML=icon('sound')+(sound?' Вкл':' Выкл');
 }
});
document.addEventListener('visibilitychange',()=>{if(running){paint();if(document.visibilityState==='visible' && running){audio(remaining);keepAwake(true);}}});
