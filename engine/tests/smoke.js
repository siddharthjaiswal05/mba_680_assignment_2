const {JSDOM}=require('jsdom');
const fs=require('fs');
const P=require('path').join(__dirname,'..','..','docs','index.html');
const errs=[];
const dom=new JSDOM(fs.readFileSync(P,'utf8'),{runScripts:"dangerously",pretendToBeVisual:true,url:"https://example.org/"});
dom.virtualConsole.on("jsdomError",e=>{ if(!/Not implemented/.test(e.message)) errs.push("jsdomError: "+e.message); });
dom.window.scrollTo=()=>{};
dom.window.addEventListener("error",e=>errs.push("error: "+e.message));
setTimeout(()=>{
  const d=dom.window.document;
  const q=s=>d.querySelectorAll(s).length;
  console.log("ladder rows      :", q("#ladder tr"));
  console.log("personality items:", q("#bfi .lik"));
  console.log("utility sliders  :", q("#util input[type=range]"));
  console.log("value sliders    :", q("#vf input[type=range]"));
  console.log("weighting inputs :", q("#pw input[type=number]"));
  console.log("method cards     :", q("#p-method .card"));

  // Drive the actual flow: fill from the demo, build the plan, open the group view.
  d.getElementById("demo").click();
  d.getElementById("go").click();
  console.log("plan cards       :", q("#p-plan .card"));
  console.log("plan tiles       :", q("#p-plan .tile"));
  console.log("plan charts      :", q("#p-plan svg.chart"));
  console.log("advice blocks    :", q("#p-plan .adv"));
  console.log("plan visible     :", !d.getElementById("p-plan").classList.contains("hide"));
  d.getElementById("t-group").click();
  console.log("group cards      :", q("#p-group .card"));
  console.log("group rows       :", q("#group-out table.data tbody tr"));
  console.log("group charts     :", q("#p-group svg.chart"));

  // A couple of headline numbers, so a silently-empty render is caught.
  const tiles=[...d.querySelectorAll("#p-plan .tile")].map(t=>
     t.querySelector(".k").textContent+" = "+t.querySelector(".v").textContent);
  console.log("tiles            :", tiles.join(" | "));
  const nan = d.getElementById("p-plan").textContent.match(/NaN|undefined|Infinity/g);
  console.log("bad values in DOM:", nan ? nan.join(",") : "none");
  const fail=[];
  if(q("#ladder tr")!==10) fail.push("risk ladder did not build 10 rows");
  if(q("#bfi .lik")!==30) fail.push("personality section did not build 30 items");
  if(q("#p-plan .tile")!==4) fail.push("plan did not render its headline tiles");
  if(q("#p-plan svg.chart")<4) fail.push("plan is missing charts");
  if(q("#group-out table.data tbody tr")<6) fail.push("group view did not populate");
  if(nan) fail.push("NaN or undefined reached the DOM");
  errs.forEach(e=>fail.push(e));
  console.log(fail.length ? "\nFAILED:\n  "+fail.join("\n  ") : "\nsmoke test passed");
  process.exit(fail.length?1:0);
},400);
