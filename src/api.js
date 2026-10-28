import {accessToken,lockAccess} from './access.js';
const base=window.JULIGYM_CONFIG?.apiUrl;
export async function request(path,data){
 if(!base)throw new Error('Адрес общего дневника ещё не настроен.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const headers=data?{'Content-Type':'application/json'}:{};if(accessToken())headers.Authorization='Bearer '+accessToken();const r=await fetch(new URL(path.replace(/^\//,''),base),{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store'});const value=await r.json();if(r.status===401)lockAccess('Сеанс завершён. Введите пароль ещё раз.');if(!r.ok)throw new Error(value.error||'Не удалось сохранить.');return value;}catch(error){if(error.name==='AbortError')throw new Error('База отвечает дольше обычного. Попробуйте снова.');if(error instanceof TypeError)throw new Error('Нет соединения с общим дневником. Проверьте интернет.');throw error;}finally{clearTimeout(timer);}
}
