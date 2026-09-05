"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto("http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(2800);
  await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
  const D=await p.evaluate(()=>window.__eightDoc());
  const line=D.voices.find((v)=>v.kind==="line").name, sid=D.form.sections[2].id;
  await p.evaluate((k)=>{const el=document.querySelector('#pan-band [data-k="'+k+'"]');
    if(!el)return; if(!el.classList.contains("is-sel"))el.click();
    const e2=document.querySelector('#pan-band [data-k="'+k+'"]');
    if(e2&&e2.getAttribute("aria-expanded")!=="true")e2.click();},"tcell|"+line+"|"+sid);
  await p.waitForTimeout(600);
  const r=await p.evaluate(()=>{
    const el=[...document.querySelectorAll("#pan-band tr.nu-wopen [data-k]")].find((x)=>/^dev\./.test(x.dataset.k));
    if(!el)return"missing"; el.click(); return el.dataset.k;});
  await p.waitForTimeout(600);
  console.log("field:",r);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const f=document.querySelector("#pan-band .nu-lzfield");
    if(!f)return{chips:document.querySelectorAll("#pan-band .nu-wchip").length};
    return {clusters:[...f.querySelectorAll(".nu-lzcluster")].map((s)=>
      ((s.querySelector(".nu-lzheadword")||{}).textContent||"(none)").trim()+":"+s.querySelectorAll(".nu-lz").length)};
  }),null,1));
  await b.close();
})();
