"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = process.argv[2] || "http://127.0.0.1:8777/nukernel/index.html";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
  const p=await ctx.newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto(PAGE+"#at=Rome&y=600&s=1",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(3000);
  await p.addScriptTag({content: require("fs").readFileSync("/home/ford/stellate/test/lib-combo.js","utf8").match(/function INSTALL\(\)[\s\S]*?\n\}/)[0] + "\nINSTALL();"}).catch(()=>{});
  await p.evaluate(()=>window.__eightRow("rules",true)); await p.waitForTimeout(800);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const n=document.querySelector('[data-sel="rule-add|Time"]');
    if(!n) return "missing";
    const was=n.dataset.v;
    const words=window.__combo?window.__combo.words(n):[];
    return {was, widget:n.dataset.widget, n:words.length, words:words.slice(0,4)};
  })));
  await b.close();
})();
