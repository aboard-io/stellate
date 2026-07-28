// app/entries/how.js — the how.html page script, VERBATIM out of the page.
//
// WHY IT LIVES HERE: this was how.html's inline <script>, and it was the SOLE
// reason the site's Content-Security-Policy still had to carry
// `script-src 'unsafe-inline'` (docs/HOSTING.md §4). Moving it to a file is the
// whole cost of dropping that token. Do not move it back inline.
//
// It is a page entry (like app/entries/access.js / embed.js): a classic script,
// NOT a module — it must run at its position at the end of <body>, where the
// whole document is already parsed, because sizeSky() measures
// document.body.scrollHeight. A `type=module` would defer past that and change
// nothing but the timing, for the worse.
//
// The content law of how.html applies to this file too: the stage narrative and
// the numbers it draws must track csd-engine / genre-kernel reality.
// the starfield + the matrix diagonal, both drawn by mulberry32 — the same
// PRNG family every note in the engine comes from. Deterministic from a seed.
(function(){
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296}}
  var NS="http://www.w3.org/2000/svg";
  // sky: 140 seeded stars
  var sky=document.getElementById("sky"),r=mulberry32(178);
  function sizeSky(){
    sky.style.height="0px";   // absolute sky adds to scrollHeight — exclude itself from the measure
    var w=innerWidth,h=Math.max(innerHeight,document.body.scrollHeight);
    sky.setAttribute("viewBox","0 0 "+w+" "+h);
    sky.style.height=h+"px";
    while(sky.firstChild)sky.removeChild(sky.firstChild);
    var rr=mulberry32(178);
    for(var i=0;i<140;i++){
      var c=document.createElementNS(NS,"circle");
      c.setAttribute("cx",(rr()*w).toFixed(1));
      c.setAttribute("cy",(rr()*h).toFixed(1));
      c.setAttribute("r",(rr()*1.3+.4).toFixed(2));
      var o=(rr()*.5+.15).toFixed(2);
      c.setAttribute("fill",["#ece9ff","#45e0ff","#ff6ec7","#ffd86b"][i%4]);
      c.style.setProperty("--o",o);c.setAttribute("opacity",o);
      c.style.animationDelay=(rr()*4).toFixed(2)+"s";
      sky.appendChild(c);
    }
  }
  sizeSky();addEventListener("resize",sizeSky);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sizeSky); // web fonts reflow the page after first measure
  // the matrix: an 18x18 downsample of the 249x249 grid, bright diagonal
  var mx=document.getElementById("mx");
  if(mx){var N=18,S=11,g=mulberry32(23);
    for(var y=0;y<N;y++)for(var x=0;x<N;x++){
      var q=document.createElementNS(NS,"rect");
      q.setAttribute("x",x*(S+2));q.setAttribute("y",y*(S+2));
      q.setAttribute("width",S);q.setAttribute("height",S);q.setAttribute("rx",2);
      if(x===y){q.setAttribute("fill","#4dffb0");q.setAttribute("opacity",".95")}
      else{q.setAttribute("fill","#2c2750");q.setAttribute("opacity",(0.25+g()*0.45).toFixed(2))}
      mx.appendChild(q);
    }
  }
})();
