// Small feedback for controls, independent of workout timer signals.
import {previewTimerSound} from './timer.js';
const key='juligym2:interface-sound',setting=document.querySelector('#interface-sounds');
let enabled=true,context,master,voice=null,generation=0,hoverTarget=null,hoverDelay,lastSound=-Infinity;
const volumeControl=document.querySelector('#sound-volume'),volumeLabel=document.querySelector('#sound-volume-value');
const readVolume=()=>{try{const saved=localStorage.getItem('juligym2:sound-volume');return saved===null?75:Math.max(0,Math.min(100,Number(saved)||0));}catch{return 75;}};
function refreshVolume(){const value=readVolume();if(volumeControl)volumeControl.value=value;if(volumeLabel)volumeLabel.value=value+'%';if(master)master.gain.value=value/100;}
refreshVolume();
volumeControl?.addEventListener('input',()=>{try{localStorage.setItem('juligym2:sound-volume',volumeControl.value);}catch{}refreshVolume();document.dispatchEvent(new Event('juligym:volume'));});
document.querySelector('#sound-preview')?.addEventListener('click',()=>{if(unlocked())void previewTimerSound();});
try{enabled=localStorage.getItem(key)!=='off';}catch{}
if(setting)setting.checked=enabled;
const unlocked=()=>!document.body.classList.contains('access-locked');
function control(node){
 const target=node instanceof Element?node.closest('button,a[href],summary,select,input,textarea,[role="button"]'):null;
 return target&&!target.matches(':disabled,[aria-disabled="true"],[type="password"],[type="hidden"],#sidebar-backdrop')&&!target.closest('[inert]')&&target.getClientRects().length?target:null;
}
function stop(){
 generation++;clearTimeout(hoverDelay);
 if(voice){try{voice.oscillator.stop();voice.oscillator.disconnect();voice.gain.disconnect();}catch{}voice=null;}
}
function prime(){
 if(!enabled)return Promise.resolve(false);
 try{
  if(!context||context.state==='closed'){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.connect(context.destination);refreshVolume();}
  return context.resume().then(()=>context.state==='running',()=>false);
 }catch{return Promise.resolve(false);}
}
async function play(kind,gesture=false){
 if(!enabled||!unlocked()||document.visibilityState!=='visible')return;
 const now=performance.now();if(now-lastSound<(kind==='hover'?160:60))return;
 stop();const token=generation;
 if(gesture){if(!await prime())return;}else if(context?.state!=='running')return;
 if(token!==generation||!enabled||!unlocked()||document.visibilityState!=='visible')return;
 lastSound=performance.now();
 const oscillator=context.createOscillator(),gain=context.createGain(),time=context.currentTime+.005;
 const hover=kind==='hover',duration=hover ? 0.06 : 0.09;
 oscillator.type='sine';oscillator.frequency.setValueAtTime(hover?720:440,time);
 oscillator.frequency.exponentialRampToValueAtTime(hover?600:340,time+duration);
 gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(hover ? 0.04 : 0.07,time+.006);
 gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 oscillator.connect(gain);gain.connect(master);voice={oscillator,gain};
 oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(voice?.oscillator===oscillator)voice=null;};
 oscillator.start(time);oscillator.stop(time+duration+.01);
}
document.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse')return;
 const target=control(event.target);if(target===hoverTarget)return;
 hoverTarget=target;clearTimeout(hoverDelay);
 if(target)hoverDelay=setTimeout(()=>{if(hoverTarget===target&&target.isConnected)void play('hover');},90);
},{passive:true});
document.addEventListener('pointerdown',()=>clearTimeout(hoverDelay),{passive:true});
document.addEventListener('pointerout',event=>{if(!event.relatedTarget){hoverTarget=null;clearTimeout(hoverDelay);}},{passive:true});
document.addEventListener('focusin',event=>{
 const target=control(event.target);if(target?.matches(':focus-visible'))void play('hover');
});
document.addEventListener('click',event=>{
 const target=control(event.target);if(!target||target===setting||target.id==='sound-preview'||target.id==='sound-volume')return;
 // Prepare audio during sign-in, but never sound out passwords or a locked diary.
 if(!unlocked()){if(target.matches('#access-form [type="submit"]'))void prime();return;}
 void play('click',true);
},true);
document.addEventListener('submit',event=>{if(event.target.id==='access-form')void prime();},true);
setting?.addEventListener('change',()=>{
 enabled=setting.checked;stop();try{localStorage.setItem(key,enabled?'on':'off');}catch{}
 if(enabled){lastSound=-Infinity;void play('click',true);}else void context?.suspend().catch(()=>{});
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible'){hoverTarget=null;stop();void context?.suspend().catch(()=>{});}
 else if(context&&enabled)void prime();
});
document.addEventListener('juligym:locked',()=>{hoverTarget=null;stop();});
addEventListener('pagehide',()=>{hoverTarget=null;stop();void context?.suspend().catch(()=>{});});
addEventListener('pageshow',event=>{if(event.persisted&&context&&enabled)void prime();});
addEventListener('storage',event=>{
 if(event.key==='juligym2:sound-volume'){refreshVolume();return;}
 if(event.key!==key)return;
 enabled=event.newValue!=='off';if(setting)setting.checked=enabled;stop();
});
