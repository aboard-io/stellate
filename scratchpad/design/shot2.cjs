"use strict";
const { chromium } = require("playwright"); const path=require("path"); const fs=require("fs");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const OUT = process.argv[2];
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const b=await chromium.launch({executablePath:EXE});
  for (const W of [390,1280]) {
    const p=await(await b.newContext({viewport:{width:W,height:W===1280?900:844},hasTouch:W<800})).newPage();
    await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
    await p.goto("http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1",{waitUntil:"domcontentloaded"});
    await p.waitForTimeout(2800);
    await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
    const D=await p.evaluate(()=>window.__eightDoc());
    const sid=D.form.sections[0].id, v=D.voices[0].name;
    await p.evaluate((s)=>document.querySelector('#pan-band [data-k="trow|'+s+'"]').click(),sid);
    await p.waitForTimeout(600);
    await p.evaluate(()=>{const pane=document.querySelector(".nu-pane"); if(pane)pane.scrollTop=180;});
    await p.waitForTimeout(300);
    await p.screenshot({path:path.join(OUT,"row-sheet-scrolled-"+W+".png")});
    await p.close();
  }
  await b.close();
})();
