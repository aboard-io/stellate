"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto("http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(2800);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const el=document.querySelector(".nu-bar");
    return [...el.querySelectorAll("button,select,input")].map((c)=>{
      const r=c.getBoundingClientRect();
      const own=[...c.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue.trim()).join("");
      const spans=[...c.querySelectorAll("span:not(.nu-vh):not(.nu-g)")].map(s=>s.textContent.trim()).filter(Boolean);
      return {k:c.dataset.k||c.id||c.className, w:Math.round(r.width),h:Math.round(r.height),
        mark:!!c.querySelector(".nu-g, svg"), own, spans};});
  }),null,1));
  await b.close();
})();
