"use strict";
const { chromium } = require("playwright"); const path=require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto("http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(2800);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const cs=(s)=>{const e=document.querySelector(s);return e?getComputedStyle(e).backgroundColor:null;};
    const v=(n)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return {pane:cs(".nu-pane"), pan:cs("#pan-band"), body:cs("body"),
      wrap:cs(".nu-sheetwrap"), table:cs("#pan-band table.nu-wordgrid"),
      th:cs("#pan-band thead th.nu-colhead"), sheet:cs("#pan-band .nu-vsheet"),
      paper:v("--paper"), panel:v("--panel"), ground:v("--ground"), well:v("--well"),
      zTh:(()=>{const e=document.querySelector("#pan-band thead th.nu-colhead");return e?getComputedStyle(e).zIndex+"/"+getComputedStyle(e).position:null;})(),
      zSheet:(()=>{const e=document.querySelector("#pan-band .nu-vsheet");return e?getComputedStyle(e).zIndex+"/"+getComputedStyle(e).position:null;})()};
  }),null,1));
  await b.close();
})();
