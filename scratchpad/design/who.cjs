"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = "http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto(PAGE,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(2800);
  await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
  for (const row of ["time","rules","produce"]) {
    await p.evaluate(()=>{for(const e of document.querySelectorAll('#pan-band [aria-expanded="true"]'))e.click();});
    await p.waitForTimeout(300);
    await p.evaluate((r)=>window.__eightRow(r,true),row); await p.waitForTimeout(500);
    await p.evaluate(()=>{const o=document.querySelector("#pan-band tr.nu-wopen");if(o)o.scrollIntoView({block:"start"});});
    await p.waitForTimeout(250);
    const o=await p.evaluate(()=>{
      const px=(s)=>{const n=parseFloat(s);return isFinite(n)?n:0;};
      const V={w:innerWidth,h:innerHeight};
      const out=[];
      for(const el of document.querySelectorAll("#pan-band tr.nu-wopen *")){
        const r=el.getBoundingClientRect();
        if(!(r.width>0&&r.height>0&&r.bottom>0&&r.top<V.h&&r.right>0&&r.left<V.w))continue;
        const cs=getComputedStyle(el);
        const bt=px(cs.borderTopWidth),bb=px(cs.borderBottomWidth),bl=px(cs.borderLeftWidth),br=px(cs.borderRightWidth);
        const bg=cs.backgroundColor||"";
        const op=bg&&!/rgba\(0, 0, 0, 0\)/.test(bg)&&bg!=="transparent";
        if(r.width>=24&&r.height>=18&&bt>0&&bb>0&&bl>0&&br>0&&op)
          out.push(el.tagName.toLowerCase()+"."+(el.className||"")+" k="+(el.dataset.k||"")+" in="+(el.closest(".nu-noderow")?"NODEROW":(el.closest(".nu-sheetrow")?"row":"?")));
      }
      return out;});
    console.log("\n== "+row+" ("+o.length+")"); o.slice(0,20).forEach((x)=>console.log("  "+x));
  }
  await b.close();
})();
