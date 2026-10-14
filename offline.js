import {initialPlanner} from './planner.js';
import {createBackup,parseBackup} from './backup.js';
const $=s=>document.querySelector(s),KEY='juligym:v1';
let registration,refreshing=false,prepared=false;
function status(title,detail){$('#offline-status').textContent=title;if(detail)$('#offline-detail').textContent=detail;}
function ready(){prepared=true;$('#offline-retry').hidden=true;status(navigator.onLine?'Сайт сохранён для работы без интернета':'Офлайн · сайт сохранён','Библиотека и картинки доступны без сети. Ваш план и отметки сохраняются в этом браузере после перезагрузки компьютера.');}
function failed(){if(prepared)return;status('Офлайн-копия пока не готова','Оставьте страницу открытой с интернетом и повторите загрузку. Настройки плана сохраняются независимо от загрузки картинок.');$('#offline-retry').hidden=false;}
function watch(worker){if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){if(registration.waiting)$('#app-update').hidden=false;else ready();}if(worker.state==='redundant')failed();});}
async function register(){
 if(!('serviceWorker' in navigator) || !isSecureContext){status('Офлайн-режим недоступен в этом браузере','План сохраняется локально. Для офлайн-версии откройте сайт по HTTPS в современном браузере.');return;}
 try{
  status('Сохраняем сайт и картинки на устройстве…');
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  if(registration.active)ready();
  if(registration.waiting)$('#app-update').hidden=false;
  watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
  navigator.serviceWorker.ready.then(ready);
 }catch{failed();}
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)location.reload();else ready();});
$('#offline-retry').addEventListener('click',register);
$('#app-update').addEventListener('click',()=>{if(registration?.waiting){refreshing=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
addEventListener('online',()=>{if(prepared)ready();else register();});addEventListener('offline',()=>{if(prepared)ready();});
$('#backup-export').addEventListener('click',()=>{
 try{
  const data=JSON.parse(localStorage.getItem(KEY)) || {...initialPlanner(),mode:'easy',sessions:{},history:[]};
  const blob=new Blob([createBackup(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`моя-тренировка-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Копия плана скачана','В ней находятся расписание, упражнения, отметки и история. Храните файл, чтобы восстановить настройки.');
 }catch{status('Не удалось скачать копию','Браузер не разрешает доступ к сохранённым данным.');}
});
$('#backup-import').addEventListener('click',()=>$('#backup-file').click());
$('#backup-file').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>2_000_000)throw new Error('Файл слишком большой. Выберите JSON-копию плана до 2 МБ.');
  const data=parseBackup(await file.text());
  if(!confirm(`Восстановить план: ${data.schedule.length} тренировочных дней? Текущие настройки и отметки будут заменены данными из файла.`))return;
  localStorage.setItem(KEY,JSON.stringify(data));location.reload();
 }catch(error){status('Копия не восстановлена',error instanceof SyntaxError?'Файл не является корректным JSON.':error.message);}
 finally{event.target.value='';}
});
register();
