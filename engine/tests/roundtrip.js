const {JSDOM}=require('jsdom'); const fs=require('fs');
const P=require('path').join(__dirname,'..','..','docs','index.html');
const dom=new JSDOM(fs.readFileSync(P,'utf8'),{runScripts:"dangerously",pretendToBeVisual:true,url:"https://example.org/"});
dom.window.scrollTo=()=>{};
setTimeout(()=>{
  const w=dom.window, d=w.document;
  const PILOT=w.eval("PILOT"), analyse=w.eval("analyse"), ADVICE=w.eval("ADVICE");
  let worst=0, worstWhat="", advCount={};
  for(const m of PILOT){
    w.eval("writeForm")(m);
    const back = w.eval("readForm")();
    const A1=analyse(m), A2=analyse(back);
    const pick=a=>({g:a.ra.gamma,l:a.val.lambda,gw:a.wgt.gammaW,pb:a.dis.beta,
                    n:a.bfi.N.mean,ey:a.scen[ADVICE].eut.y,sy:a.scen[ADVICE].sa.best.y,
                    lb:a.scen[ADVICE].ma.lossBps});
    const p1=pick(A1), p2=pick(A2);
    for(const k in p1){
      const rel=Math.abs(p1[k]-p2[k])/(Math.abs(p1[k])||1);
      if(rel>worst){worst=rel; worstWhat=`${m.id}.${k}  form=${p2[k]}  direct=${p1[k]}`;}
    }
    advCount[m.id]=A1.advice.length;
  }
  console.log("form round-trip, worst relative drift:", (worst*100).toFixed(4)+"%");
  if(worst>1e-6) console.log("  at", worstWhat);
  console.log("advice blocks per member:", JSON.stringify(advCount));

  // Infeasible-floor guard
  const fail=[];
  if(worst>1e-9) fail.push("form round-trip drifts at "+worstWhat);
  let guarded=false;
  try{ analyse({...PILOT[0], floor: 99e7}); }catch(e){ guarded=true;
       console.log("impossible floor rejected:", e.message.slice(0,70)+"..."); }
  if(!guarded) fail.push("an unreachable floor was accepted");
  if(Object.values(advCount).every(n=>n===0)) fail.push("no advisory commentary fired for anyone");
  console.log(fail.length ? "\nFAILED:\n  "+fail.join("\n  ") : "\nround-trip test passed");
  process.exit(fail.length?1:0);
},400);
