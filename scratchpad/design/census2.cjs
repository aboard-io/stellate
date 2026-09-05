"use strict";
const { chromium } = require("playwright");
const path = require("path");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = "http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1";
const C = `(() => {
  const V={w:innerWidth,h:innerHeight};
  const vis=(r)=>r.width>0&&r.height>0&&r.bottom>0&&r.top<V.h&&r.right>0&&r.left<V.w;
  const px=(s)=>{const n=parseFloat(s);return isFinite(n)?n:0;};
  const nm=(el)=>el.tagName.toLowerCase()+(typeof el.className==="string"&&el.className.trim()?"."+el.className.trim().split(/\\s+/).slice(0,2).join("."):"");
  const P={},T={},S={};
  const bump=(o,k)=>{o[k]=(o[k]||0)+1;};
  for(const el of document.body.querySelectorAll("*")){
    const r=el.getBoundingClientRect(); if(!vis(r))continue;
    const cs=getComputedStyle(el); if(cs.visibility==="hidden")continue;
    const bt=px(cs.borderTopWidth),bb=px(cs.borderBottomWidth),bl=px(cs.borderLeftWidth),br=px(cs.borderRightWidth);
    const bg=cs.backgroundColor||"";
    const op=bg&&!/rgba\\(0, 0, 0, 0\\)/.test(bg)&&bg!=="transparent";
    if(r.width>=24&&r.height>=18&&bt>0&&bb>0&&bl>0&&br>0&&op) bump(P,nm(el));
    if(Math.max(bt,bb,bl,br)>1.01) bump(T,nm(el)+" b="+Math.max(bt,bb,bl,br));
  }
  for(const el of document.querySelectorAll(".nu-bar button,.nu-bar select,.nu-bar input")){
    const r=el.getBoundingClientRect(); if(r.height<43.5||r.width<43.5) bump(S,nm(el)+" "+Math.round(r.width)+"x"+Math.round(r.height));
  }
  const top=(o)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,14);
  return {plates:top(P),thick:top(T),small:top(S)};
})()`;
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const p=await(await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
  await p.route("**/favicon.ico",(r)=>r.fulfill({status:200,body:""}));
  await p.goto(PAGE,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(2800);
  await p.evaluate(()=>window.__eightTab("Band")); await p.waitForTimeout(400);
  const D=await p.evaluate(()=>window.__eightDoc());
  const shut=async()=>{await p.evaluate(()=>{for(const e of document.querySelectorAll('#pan-band [aria-expanded="true"]'))e.click();});await p.waitForTimeout(300);};
  const see=async()=>{await p.evaluate(()=>{const o=document.querySelector("#pan-band tr.nu-wopen");if(o)o.scrollIntoView({block:"start"});});await p.waitForTimeout(250);};
  for(const [name,fn] of [
    ["rest",async()=>{}],
    ["time",async()=>{await p.evaluate(()=>window.__eightRow("time",true));}],
    ["rules",async()=>{await p.evaluate(()=>window.__eightRow("rules",true));}],
    ["motifs",async()=>{await p.evaluate(()=>window.__eightMotif());}],
    ["produce",async()=>{await p.evaluate(()=>window.__eightRow("produce",true));}],
    ["mix",async()=>{await p.evaluate((v)=>window.__eightMix(v),D.voices[0].name);}],
  ]){ await shut(); await fn(); await see();
    const o=await p.evaluate(C);
    console.log("\n== "+name);
    for(const g of ["plates","thick","small"]) if(o[g].length){console.log(" "+g+":");for(const [n,c] of o[g])console.log("   "+String(c).padStart(3)+"  "+n);}
  }
  await b.close();
})();
