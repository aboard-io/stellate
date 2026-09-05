"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto("http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(2800);
  await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
  // open the kit column and turn the drummer off, the way the gate does
  await p.evaluate(()=>{const c=document.querySelector('#pan-band [data-k="tcol|kit"]'); if(c&&c.getAttribute("aria-expanded")!=="true")c.click();});
  await p.waitForTimeout(600);
  await p.evaluate(async()=>{ const c=document.querySelector('[data-k="drums"]');
    if(c){c.click(); await new Promise(r=>setTimeout(r,250));
      const off=[...document.querySelectorAll('#pan-band .nu-wchip')].find(x=>/sitting out/.test(x.textContent||""));
      if(off)off.click();}});
  await p.waitForTimeout(700);
  console.log("after drummer-off:", JSON.stringify(await p.evaluate(()=>({
    on: (window.__eightDoc().voices.find(v=>v.kind==="drums")||{}).cast,
    open: [...document.querySelectorAll('#pan-band [aria-expanded="true"]')].map(x=>x.dataset.k),
    dkSel: !!document.querySelector('[data-sel^="sound.drumkit"]'),
    dkCell: !!document.querySelector('[data-k^="sound.drumkit"]')}))));
  // now openCol("kit") as the gate does
  await p.evaluate(async()=>{ window.__eightTab("Band"); await new Promise(r=>setTimeout(r,250));
    const b=document.querySelector('#pan-band [data-k="tcol|kit"]');
    if(b&&b.getAttribute("aria-expanded")!=="true")b.click();});
  await p.waitForTimeout(600);
  console.log("after openCol:", JSON.stringify(await p.evaluate(()=>({
    open: [...document.querySelectorAll('#pan-band [aria-expanded="true"]')].map(x=>x.dataset.k),
    dkSel: !!document.querySelector('[data-sel^="sound.drumkit"]'),
    dkCell: (()=>{const e=document.querySelector('[data-k^="sound.drumkit"]');return e?e.tagName+"."+e.className:null;})()}))));
  await b.close();
})();
