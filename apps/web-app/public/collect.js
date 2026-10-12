(()=>{
let q=[],p=location.pathname+location.search,a=0,t=Date.now(),s=0,b=0
const F=e=>{if(!q.length)return;const body=JSON.stringify({events:q.splice(0,20)});if(e&&navigator.sendBeacon)navigator.sendBeacon("/api/collect",new Blob([body],{type:"application/json"}));else fetch("/api/collect",{method:"POST",body,headers:{"content-type":"application/json"},keepalive:1}).catch(()=>{})}
const P=e=>{q.push(e);if(q.length>12)F(0)}
const D=()=>{let r=document.documentElement.scrollHeight-innerHeight;return r<=0?100:Math.min(100,Math.round(scrollY/r*100))}
const K=()=>{if(document.visibilityState=="hidden")return;let n=Date.now();a+=n-t;t=n;let d=D();if(d>s)s=d}
const V=(n,r)=>{p=n;a=s=0;t=Date.now();let w=screen.width;P({type:"pageview",path:p,ref:r||"",w:w<480?"xs":w<768?"sm":w<1024?"md":w<1440?"lg":"xl",lang:(navigator.language||"").slice(0,12)});if(!b){b=1;F(0)}}
V(p,document.referrer)
addEventListener("scroll",K,{passive:1})
setInterval(K,5e3)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState=="hidden"){K();P({type:"engage",path:p,ms:a,scroll:s});F(1);a=0}else t=Date.now()})
addEventListener("pagehide",()=>{K();P({type:"engage",path:p,ms:a,scroll:s});F(1)})
document.addEventListener("click",e=>{let n=e.target&&e.target.closest&&e.target.closest("[data-track]");if(n)P({type:n.getAttribute("data-track")||"outbound",path:p,target:n.getAttribute("data-track-name")||n.getAttribute("href")||""})})
addEventListener("k39-track",e=>{let d=e.detail||{};if(d.type=="pageview"){P({type:"engage",path:p,ms:a,scroll:s});V(d.path||p,d.ref||"")}else P({type:d.type||"outbound",path:p,target:d.target||""})})
setInterval(()=>F(0),15e3)
})()
