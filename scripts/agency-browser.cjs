const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000');
 for(const width of [320,390,430,1024]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home overflow '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/agency-home.png',fullPage:true});
 await page.locator('nav [data-go="campaigns"]').click();await page.locator('#campaignTitle').fill('Campanie test 4MEN');await page.locator('#campaignBrief').fill('Promovăm tunsorile reale, fără oferte inventate.');await page.locator('#campaignDate').fill('2026-10-28');await page.locator('#campaignForm button').click();
 await page.locator('#deliverable').fill('Concept premium. Rezultatul final rămâne vizibil patru secunde.');await page.locator('#submitReview').click();await page.locator('#approve').click();assert.equal(await page.locator('#deliverableStatus').textContent(),'Aprobat');
 await page.locator('#deliverable').fill('Concept revizuit.');assert.ok(await page.locator('#approve').isDisabled());
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=1000;const x=c.getContext('2d');x.fillStyle='#516558';x.fillRect(0,0,800,1000);x.fillStyle='#b4c3ad';x.beginPath();x.arc(400,350,180,0,7);x.fill();return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#upload').setInputFiles({name:'test-photo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByText('Folosește fotografia',{exact:true}).click();
 let download=page.waitForEvent('download');await page.locator('#exportImage').click();let d=await download;assert.equal(d.suggestedFilename(),'agent-city-reclama.png');await d.saveAs('/tmp/agency-export.png');
 download=page.waitForEvent('download',{timeout:15000});await page.locator('#exportVideo').click();d=await download;await d.saveAs('/tmp/agency-export-video.'+(d.suggestedFilename().endsWith('mp4')?'mp4':'webm'));
 for(const width of [320,390,430,1024]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'studio overflow '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/agency-studio.png',fullPage:true});
 await page.reload();await page.locator('nav [data-go="studio"]').click();assert.equal(await page.locator('#deliverable').inputValue(),'Concept revizuit.');await page.getByText('Folosește fotografia',{exact:true}).waitFor();
 await page.locator('nav [data-go="clients"]').click();await page.locator('#clientName').fill('Al doilea client');await page.locator('#clientTone').fill('Clar');await page.locator('#clientForm .primary').click();await page.locator('nav [data-go="studio"]').click();assert.equal(await page.locator('#deliverable').inputValue(),'');assert.equal(await page.locator('#assets img').count(),0);
 await page.locator('#clientFilter').selectOption('4men');await page.getByText('Folosește fotografia',{exact:true}).waitFor();assert.equal(await page.locator('#deliverable').inputValue(),'Concept revizuit.');
 await page.locator('nav [data-go="settings"]').click();await page.locator('#accessToken').fill('wrong-token');await page.locator('#connectForm .primary').click();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('tokenul'));
 assert.deepEqual(errors,[]);console.log('PASS: navigation, client isolation, autosave, approvals, media persistence, PNG/video export, 320/390/430/1024 widths, unauthorized API UI; no page errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
