const buttons=[...document.querySelectorAll('[data-install]')],dialog=document.querySelector('#install-dialog');
const standalone=matchMedia('(display-mode: standalone)');
let promptEvent;
function installed(){return standalone.matches || navigator.standalone===true;}
function updateButtons(){buttons.forEach(b=>b.hidden=installed());}
function help(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform==='MacIntel' && navigator.maxTouchPoints>1;
 const android=/Android/.test(navigator.userAgent);
 document.querySelector('#install-platform').textContent=ios?'На iPhone и iPad':android?'На Android':'На компьютере';
 document.querySelector('#install-instructions').innerHTML=ios?
  '<li>Откройте сайт в Safari.</li><li>Нажмите «Поделиться», затем «На экран Домой» (или «Добавить на экран Домой»).</li><li>Если показан переключатель «Открывать как веб-приложение», включите его и нажмите «Добавить».</li>':android?
  '<li>Откройте сайт в Chrome или другом браузере с установкой приложений.</li><li>В меню ⋮ выберите «Установить приложение» или «Добавить на главный экран».</li><li>Подтвердите установку и запускайте тренировку с новой иконки.</li>':
  '<li>В Chrome или Edge нажмите значок установки в адресной строке либо откройте меню браузера → установка сайта как приложения.</li><li>На Mac в Safari используйте «Файл» → «Добавить в Dock».</li><li>Запускайте тренировку с созданной иконки.</li>';
 if(!dialog.open)dialog.showModal();
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;updateButtons();});
buttons.forEach(button=>button.addEventListener('click',async()=>{
 if(installed())return;
 if(!promptEvent){help();return;}
 const event=promptEvent;promptEvent=null;
 try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')navigator.storage?.persist?.().catch(()=>{});}catch{help();}
}));
addEventListener('appinstalled',()=>{promptEvent=null;buttons.forEach(b=>b.hidden=true);if(dialog.open)dialog.close();});
standalone.addEventListener('change',updateButtons);updateButtons();
