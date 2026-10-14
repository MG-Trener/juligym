// Runs before styles are painted, including when the page is opened offline.
(()=>{
 const key='juligym:theme',root=document.documentElement;
 const valid=value=>value==='light'?'light':'dark';
 function apply(value){
  const theme=valid(value);root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f7f8f2':'#0c0f12');
  const select=document.querySelector('#theme-select');if(select)select.value=theme;
 }
 let saved;try{saved=localStorage.getItem(key);}catch{}
 apply(saved);
 document.addEventListener('DOMContentLoaded',()=>{
  const select=document.querySelector('#theme-select');select.value=root.dataset.theme;
  select.addEventListener('change',()=>{
   apply(select.value);
   try{localStorage.setItem(key,root.dataset.theme);}catch{document.querySelector('#theme-status').textContent='Стиль применён. Браузер не разрешает сохранить выбор после закрытия страницы.';}
  });
 });
 addEventListener('storage',event=>{if(event.key===key || event.key===null)apply(event.newValue);});
})();
