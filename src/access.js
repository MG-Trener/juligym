const dialog=document.querySelector('#access-dialog'),form=document.querySelector('#access-form'),input=document.querySelector('#access-password'),error=document.querySelector('#access-error'),submit=form.querySelector('[type=submit]');
const verifierKey='juligym2:access-verifier';
let unlocked=false,token='',waiting=[],checking=false;
export const accessToken=()=>token;
export const isUnlocked=()=>unlocked;
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
async function verifier(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},key,256)));
}
async function rememberVerifier(password){
 try{const salt=crypto.getRandomValues(new Uint8Array(16));localStorage.setItem(verifierKey,JSON.stringify({salt:hex(salt),hash:await verifier(password,salt)}));}catch{}
}
async function offlineMatches(password){
 try{const saved=JSON.parse(localStorage.getItem(verifierKey));if(!/^[0-9a-f]{32}$/.test(saved?.salt)||!/^[0-9a-f]{64}$/.test(saved?.hash))return false;return saved.hash===await verifier(password,new Uint8Array(saved.salt.match(/../g).map(n=>parseInt(n,16))));}catch{return false;}
}
async function authenticate(password){
 if(!navigator.onLine)throw new TypeError('offline');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const result=await fetch(new URL('auth',window.JULIGYM_CONFIG.apiUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:controller.signal,cache:'no-store',credentials:'omit'});
  if(result.status>=500)throw new TypeError('unavailable');
  const value=await result.json();if(!result.ok)throw Error(value.error||'Не удалось проверить пароль.');
  if(typeof value.token!=='string')throw Error('Не удалось проверить пароль.');return value.token;
 }finally{clearTimeout(timer);}
}
export function unlockSite(){
 if(unlocked)return Promise.resolve();
 document.body.classList.add('access-locked');
 if(dialog.open)dialog.close();dialog.showModal();input.focus({preventScroll:true});
 return new Promise(resolve=>waiting.push(resolve));
}
export function lockAccess(message='Введите пароль для доступа к дневнику.'){
 if(!unlocked&&dialog.open)return;
 unlocked=false;token='';document.dispatchEvent(new Event('juligym:locked'));error.textContent=message;void unlockSite();
}
dialog.addEventListener('cancel',event=>event.preventDefault());
document.querySelector('#access-show').addEventListener('click',event=>{const show=input.type==='password';input.type=show?'text':'password';event.currentTarget.textContent=show?'Скрыть':'Показать';event.currentTarget.setAttribute('aria-pressed',String(show));input.focus();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(checking)return;checking=true;submit.disabled=true;submit.textContent='Проверяем…';error.textContent='';input.setAttribute('aria-invalid','false');
 const password=input.value;
 try{
  try{token=await authenticate(password);await rememberVerifier(password);}catch(e){
   if(e instanceof TypeError||e.name==='AbortError'){if(!await offlineMatches(password))throw Error('Нет связи с дневником. Для первого входа нужен интернет; проверьте пароль и соединение.');token='';}
   else throw e;
  }
  unlocked=true;input.value='';input.type='password';document.querySelector('#access-show').textContent='Показать';document.querySelector('#access-show').setAttribute('aria-pressed','false');dialog.close();document.body.classList.remove('access-locked');waiting.splice(0).forEach(resolve=>resolve());document.dispatchEvent(new Event('juligym:unlocked'));
 }catch(e){error.textContent=e.message;input.setAttribute('aria-invalid','true');input.focus();input.select();}
 finally{checking=false;submit.disabled=false;submit.textContent='Открыть тренировку';}
});
