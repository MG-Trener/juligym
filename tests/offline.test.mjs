import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const template=await readFile(new URL('../scripts/sw-template.js',import.meta.url),'utf8');
function worker(fail=false){
 const handlers={},names=new Map([['juligym:/juligym/:old',new Map()],['other-app',new Map()]]),scope='https://example.test/juligym/';
 const caches={keys:async()=>[...names.keys()],delete:async n=>names.delete(n),open:async n=>{if(!names.has(n))names.set(n,new Map());const map=names.get(n);return {put:async(u,r)=>map.set(String(u),r),match:async u=>map.get(String(u))};}};
 const self={registration:{scope},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>{}};
 vm.runInNewContext('const VERSION="new",FILES=["index.html","one.webp","bad.webp"];'+template,{self,caches,URL,Request,fetch:async request=>({ok:!fail || !request.url.endsWith('bad.webp')})});
 const run=async name=>{let promise;handlers[name]({waitUntil:p=>promise=p});await promise;};
 return {run,names};
}
test('Неудачная загрузка библиотеки не оставляет частичный кэш и сохраняет старую версию',async()=>{
 const w=worker(true);await assert.rejects(w.run('install'));assert.deepEqual([...w.names.keys()],['juligym:/juligym/:old','other-app']);
});
test('Новая версия активируется только с полным кэшем и не очищает другие приложения',async()=>{
 const w=worker();await w.run('install');assert.equal(w.names.get('juligym:/juligym/:new').size,3);assert.ok(w.names.has('juligym:/juligym/:old'));
 await w.run('activate');assert.deepEqual([...w.names.keys()],['other-app','juligym:/juligym/:new']);
});
