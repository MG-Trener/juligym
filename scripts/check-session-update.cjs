const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD;
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Preview only');
const root=path.resolve(__dirname,'..');let modern=false;
const server=http.createServer(async(req,res)=>{try{
 const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html';
 if(rel.startsWith('api/')){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const response=await fetch(new URL(req.url.slice(5),api),{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:req.method==='POST'?Buffer.concat(chunks):undefined});
  res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());return;
 }
 const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw Error();
 const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[ext]||'text/plain');res.setHeader('Cache-Control','no-cache');
 let content=await fs.readFile(file);
 if(rel==='config.js')content='window.JULIGYM_CONFIG={apiUrl:location.origin+"/api/"}';
 if(rel==='sw.js'&&!modern)content=content.toString().replace("const CACHE='juligym-access-'+","const CACHE='juligym-access-fixture-'+");
 res.end(content);
}catch{res.writeHead(404);res.end();}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:320,height:740}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/';
  async function login(){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
  await page.goto(url);await login();await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.locator('.mobile-nav [data-view=stretch]').click();await page.locator('[data-stretch-preset=lower]').click();await page.waitForSelector('[data-stretch-next]');
  await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2')?.textContent.includes('правая'));
  await page.locator('[data-stretch-hold]').click();
  modern=true;await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting);
  await page.locator('#update-notice').waitFor();await page.locator('[data-defer-update]').click();assert.equal(await page.locator('#update-notice').isVisible(),false);
  await page.locator('#settings-open').click();assert(await page.locator('#update-app').isVisible());await page.locator('#update-app').click();
  await page.locator('#access-password').waitFor({timeout:30000});await login();
  await page.locator('.mobile-nav [data-view=stretch]').click();await page.locator('[data-stretch-resume]').click();assert.match(await page.locator('#stretch-guided h2').innerText(),/правая/);assert.match(await page.locator('.timer-description').innerText(),/паузе/);
  assert.deepEqual(errors,[]);console.log('PASS: actual service worker update, visible notice, defer, 320px settings, manual update/reload, preserved stretch side and paused timer.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
