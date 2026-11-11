// Development-only browser checks. The site itself has no dependencies or server.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'));
const shots = path.resolve(process.env.SCREENSHOT_DIR || path.join(__dirname, 'screenshots'));
const key = 'todo.tasks.v1';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const file = ({'/':'index.html', '/styles.css':'styles.css', '/storage.js':'storage.js', '/app.js':'app.js'})[req.url];
  if (!file) { res.writeHead(404); return res.end(); }
  try { res.writeHead(200, {'Content-Type': mime[path.extname(file)]}); res.end(fs.readFileSync(path.join(root, file))); }
  catch { res.writeHead(500); res.end(); }
});
async function run() {
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const url = `http://127.0.0.1:${server.address().port}/`;
 const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
 console.log(`Playwright ${require(path.join(path.dirname(require.resolve(process.env.PLAYWRIGHT_PATH || 'playwright')), 'package.json')).version}; Chromium ${browser.version()}`);
 let count = 0;
 async function test(name, fn) {
   const ctx = await browser.newContext({viewport:{width:375,height:812}});
   try { await fn(ctx); console.log(`PASS ${name}`); count++; }
   catch (e) { console.error(`FAIL ${name}\n${e.stack}`); throw e; }
   finally { await ctx.close(); }
 }
 const get = p => p.locator('#task-input');
 const submit = async (p, t, method='enter') => { await get(p).fill(t); if(method==='enter') await get(p).press('Enter'); else await p.getByRole('button',{name:'Добавить'}).click(); };
 const read = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
 try {
  await test('empty and whitespace rejected', async ctx => {
   const p=await ctx.newPage(); await p.goto(url); await submit(p,''); assert.equal(await p.locator('li').count(),0); assert.equal(await p.locator('#form-error').isVisible(),true);
   await submit(p,'  \t  ','button'); assert.equal(await p.locator('li').count(),0); assert.equal(await p.locator('#task-input').getAttribute('aria-invalid'),'true'); assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null);
  });
  await test('button, Enter, distinct IDs, independent toggle/delete and reload', async ctx => {
   const p=await ctx.newPage(); await p.goto(url); await submit(p,'Повтор','button'); await submit(p,'Повтор');
   let tasks=await read(p); assert.equal(tasks.length,2); const [a,b]=tasks.map(x=>x.id); assert.notEqual(a,b);
   await p.locator('input[type=checkbox]').nth(0).check(); tasks=await read(p); assert.equal(tasks.find(x=>x.id===a).completed,true); assert.equal(tasks.find(x=>x.id===b).completed,false);
   await p.reload(); assert.equal(await p.locator('li').count(),2); assert.equal(await p.locator('input[type=checkbox]').nth(0).isChecked(),true); assert.equal(await p.locator('input[type=checkbox]').nth(1).isChecked(),false);
   await p.locator('input[type=checkbox]').nth(1).check(); await p.locator('input[type=checkbox]').nth(0).uncheck();
   await p.locator('.delete-button').nth(0).click(); tasks=await read(p); assert.deepEqual(tasks.map(x=>x.id),[b]); assert.equal(tasks[0].completed,true);
   await p.reload(); assert.equal(await p.locator('li').count(),1); assert.equal(await p.locator('input[type=checkbox]').isChecked(),true);
   await p.locator('.delete-button').click(); await p.reload(); assert.equal(await p.locator('li').count(),0);
  });
  await test('HTML-like text rendered as text, no script execution', async ctx => {
   const p=await ctx.newPage(); await p.goto(url); const text='<img src=x onerror="window.hacked=1"><script>window.hacked=2</script>';
   await submit(p,text); assert.equal(await p.locator('.task-text').textContent(),text); assert.equal(await p.locator('#task-list img, #task-list script').count(),0); assert.equal(await p.evaluate(()=>window.hacked),undefined);
  });
  await test('long text, 375px, no horizontal overflow, delete button in viewport', async ctx => {
   const p=await ctx.newPage(); await p.goto(url); await submit(p,'Длинная'.repeat(140));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
   const task=await p.locator('.task').boundingBox(), text=await p.locator('.task-text').boundingBox(), btn=await p.locator('.delete-button').boundingBox();
   assert.ok(text.height>40); assert.ok(btn.x>=0 && btn.x+btn.width<=375); assert.ok(task.x+task.width<=375);
  });
  await test('keyboard operation and visible focus outlines', async ctx => {
   const p=await ctx.newPage(); await p.goto(url); await p.keyboard.press('Tab');
   async function focus(selector) { const el=p.locator(selector); assert.equal(await el.evaluate(e=>e===document.activeElement && e.matches(':focus-visible')),true); const outline=await el.evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth)})); assert.notEqual(outline.style,'none'); assert.ok(outline.width>=2); }
   await focus('#task-input'); await p.keyboard.type('Keyboard'); await p.keyboard.press('Tab'); await focus('.add-button'); await p.keyboard.press('Enter');
   await p.keyboard.press('Tab'); await focus('.add-button'); await p.keyboard.press('Tab'); await focus('input[type=checkbox]'); await p.keyboard.press('Space'); assert.equal(await p.locator('input[type=checkbox]').isChecked(),true);
   await p.keyboard.press('Tab'); await focus('.delete-button'); await p.keyboard.press('Enter'); assert.equal(await p.locator('li').count(),0);
  });
  await test('unavailable read: no crash, changes in memory, no writes', async ctx => {
   await ctx.addInitScript(()=>{ Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')}; Storage.prototype.setItem=function(){throw new Error('unexpected write')}; });
   const p=await ctx.newPage(); await p.goto(url); assert.equal(await p.locator('#storage-warning').isVisible(),true); await submit(p,'В памяти'); assert.equal(await p.locator('li').count(),1); assert.match(await p.locator('#storage-warning').textContent(),/только на этой странице/);
  });
  await test('unavailable write: visible warning, no promise of persistence', async ctx => {
   await ctx.addInitScript(()=>{ Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')}; });
   const p=await ctx.newPage(); await p.goto(url); await submit(p,'В памяти'); assert.equal(await p.locator('li').count(),1); const msg=await p.locator('#storage-warning').textContent(); assert.equal(await p.locator('#storage-warning').isVisible(),true); assert.match(msg,/Не удалось сохранить/); assert.match(msg,/только на этой странице/); await p.reload(); assert.equal(await p.locator('li').count(),0);
  });
  await test('actual browser quota exhaustion: warning, no promise of persistence', async ctx => {
   const p=await ctx.newPage(); await p.goto(url);
   const result=await p.evaluate(()=>{let i=0; try {for(;i<100;i++)localStorage.setItem('fill'+i,'x'.repeat(100000));} catch(e){return {name:e.name, count:i};} return {name:'not exhausted', count:i};});
   assert.equal(result.name,'QuotaExceededError'); assert.ok(result.count>0);
   await submit(p,'Q'.repeat(200000)); assert.equal(await p.locator('li').count(),1); assert.equal(await p.locator('#storage-warning').isVisible(),true); assert.match(await p.locator('#storage-warning').textContent(),/Не удалось сохранить.*только на этой странице/);
   assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null); await p.reload(); assert.equal(await p.locator('li').count(),0); console.log(`  quota: ${result.name}, ${result.count} × 100000 characters`);
  });
  for (const [name, raw] of [['invalid JSON','{broken'],['invalid shape','{"not":"array"}'],['duplicate IDs','[{"id":"x","text":"a","completed":false},{"id":"x","text":"b","completed":true}]']]) {
   await test(`corrupt storage (${name}) never overwritten`, async ctx => {
    const p=await ctx.newPage(); await p.goto(url); await p.evaluate(([k,v])=>localStorage.setItem(k,v),[key,raw]); await p.reload();
    assert.equal(await p.locator('#storage-warning').isVisible(),true); assert.equal(await p.locator('li').count(),0); assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
    await submit(p,'В памяти'); await p.locator('input[type=checkbox]').check(); await p.locator('.delete-button').click(); assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw); await p.reload(); assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),raw);
   });
  }
  fs.mkdirSync(shots,{recursive:true});
  for (const [label,width,height] of [['mobile',375,812],['desktop',1440,900]]) {
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}); const p=await ctx.newPage(); await p.goto(url);
   await p.screenshot({path:path.join(shots,`${label}-empty.png`),fullPage:true});
   await submit(p,'Купить продукты'); await submit(p,'Позвонить по важному вопросу'); await p.locator('input[type=checkbox]').first().check(); await submit(p,'Подготовить заметки на завтра');
   await p.screenshot({path:path.join(shots,`${label}-filled.png`),fullPage:true}); await ctx.close(); console.log(`SCREENSHOT ${label}: ${width}x${height}, empty + filled`);
  }
  console.log(`RESULT ${count} tests passed`);
 } finally { await browser.close(); }
}
run().catch(e=>{process.exitCode=1;}).finally(()=>server.close());
