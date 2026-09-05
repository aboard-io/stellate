"use strict";
const { chromium } = require("playwright"); const path=require("path"); const fs=require("fs");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = "http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1";
const OUT = process.argv[2] || "scratchpad/design/mid4";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",(e)=>errs.push(e.message));
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto(PAGE,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(2800);
  await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
  const D=await p.evaluate(()=>window.__eightDoc());
  const shut=async()=>{await p.evaluate(()=>{for(const e of document.querySelectorAll('#pan-band [aria-expanded="true"]'))e.click();window.scrollTo(0,0);});await p.waitForTimeout(300);};
  // scale picker
  await p.evaluate(()=>window.__eightRow("time",true)); await p.waitForTimeout(600);
  const r1=await p.evaluate(()=>{
    const el=document.querySelector('#pan-band [data-k="sel|alphabet.scale"],#pan-band [data-sel="alphabet.scale"]');
    if(!el)return"missing"; el.scrollIntoView({block:"center"});
    const f=el.querySelector("input,select,button")||el; f.click(); return el.dataset.widget||el.className;});
  await p.waitForTimeout(600);
  console.log("scale widget:",r1);
  console.log("scale lozenges:",await p.evaluate(()=>document.querySelectorAll('[data-sel="alphabet.scale"] .nu-lz, .nu-lzfield[data-sel="alphabet.scale"] .nu-lz').length));
  await p.screenshot({path:path.join(OUT,"scale-picker-390.png")});
  // mode
  await p.evaluate(()=>{const el=document.querySelector('#pan-band [data-sel="alphabet.mode"]');if(el)el.scrollIntoView({block:"center"});});
  await p.waitForTimeout(300);
  console.log("mode widget:",await p.evaluate(()=>{const el=document.querySelector('#pan-band [data-sel="alphabet.mode"]');return el?(el.dataset.widget||el.className):"missing";}));
  await p.screenshot({path:path.join(OUT,"mode-picker-390.png")});
  // instrument, in a column sheet
  await shut();
  await p.evaluate((v)=>document.querySelector('#pan-band [data-k="tcol|'+v+'"]').click(),D.voices[0].name);
  await p.waitForTimeout(700);
  const ins=await p.evaluate(()=>{
    const el=[...document.querySelectorAll("#pan-band tr.nu-wopen [data-k]")].find((x)=>/sound\.instrument/.test(x.dataset.k));
    if(!el)return"missing"; el.scrollIntoView({block:"center"}); el.click(); return el.dataset.k;});
  await p.waitForTimeout(700);
  console.log("instrument field:",ins);
  console.log("instrument lozenges:",await p.evaluate(()=>document.querySelectorAll("#pan-band .nu-lz").length),
    "clusters:",await p.evaluate(()=>document.querySelectorAll("#pan-band .nu-lzcluster").length));
  await p.evaluate(()=>{const el=document.querySelector("#pan-band .nu-lzfield");if(el)el.scrollIntoView({block:"start"});});
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(OUT,"instrument-picker-390.png")});
  console.log("errors:",errs.slice(0,5));
  await b.close();
})();
