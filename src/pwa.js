const install=document.querySelector('#install-app'),update=document.querySelector('#update-app'),status=document.querySelector('#offline-status'),banner=document.querySelector('#update-notice');
let prompt,registration,applying=false;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;});
install.addEventListener('click',async()=>{if(prompt){const p=prompt;prompt=null;await p.prompt();await p.userChoice;}else document.querySelector('#install-dialog').showModal();});
addEventListener('appinstalled',()=>install.hidden=true);
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)install.hidden=true;
function available(){update.hidden=false;banner.hidden=false;document.querySelectorAll('[data-settings-open],#settings-open').forEach(button=>button.classList.add('has-update'));}
async function applyUpdate(){
 if(!registration?.waiting||applying)return;
 applying=true;
 try{
  const detail={prepare:Promise.resolve(true)};
  document.dispatchEvent(new CustomEvent('juligym:before-update',{detail}));
  if(!await detail.prepare)return;
  sessionStorage.setItem('juli:update','1');
  registration.waiting.postMessage({type:'UPDATE'});
 }finally{applying=false;}
}
update.addEventListener('click',applyUpdate);
document.querySelector('[data-apply-update]').addEventListener('click',applyUpdate);
document.querySelector('[data-defer-update]').addEventListener('click',()=>banner.hidden=true);
document.querySelector('#check-update').addEventListener('click',async()=>{
 const message=document.querySelector('#update-status');message.textContent='Проверяем обновления…';
 try{await registration?.update();if(registration?.waiting)available();message.textContent=registration?.waiting?'Обновление готово к установке.':registration?.installing?'Загружаем обновление…':'Установлена актуальная версия.';}
 catch{message.textContent='Не удалось проверить. Повторите с интернетом.';}
});
if('serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(sessionStorage.getItem('juli:update')){sessionStorage.removeItem('juli:update');location.reload();}});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>{
  registration=r;
  const ready=()=>status.textContent='Сайт и иллюстрации сохранены на устройстве. Для записи общего прогресса нужен интернет.';
  if(r.active)ready();if(r.waiting&&navigator.serviceWorker.controller)available();
  r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',()=>{if(r.waiting&&navigator.serviceWorker.controller){available();document.querySelector('#update-status').textContent='Обновление готово к установке.';}}));
  navigator.serviceWorker.ready.then(ready);
 }).catch(()=>status.textContent='Не удалось сохранить офлайн-копию. Повторите открытие сайта с интернетом.');
}
