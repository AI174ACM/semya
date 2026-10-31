/* Улучшатор снимков: поворот, выравнивание по четырём углам, режимы «Документ», «Скан», «Ярче».
   Работает на телефоне, без сторонних библиотек. Оригинал остаётся на Диске, вернуть можно из этого же окна. */
(function(){
const MAX_SIDE = 2400, PREVIEW_SIDE = 1000;
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const newCanvas = (w,h) => { const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; };
const ctxOf = c => c.getContext('2d',{willReadFrequently:true});

function fit(src, side){
  const w=src.width, h=src.height, k=Math.min(1, side/Math.max(w,h));
  const c=newCanvas(w*k,h*k), g=ctxOf(c); g.imageSmoothingQuality='high'; g.drawImage(src,0,0,c.width,c.height); return c;
}
function rotated(src, deg){
  deg=((deg%360)+360)%360; if(!deg) return src;
  const c=deg%180?newCanvas(src.height,src.width):newCanvas(src.width,src.height), g=ctxOf(c);
  g.translate(c.width/2,c.height/2); g.rotate(deg*Math.PI/180); g.drawImage(src,-src.width/2,-src.height/2); return c;
}
/* углы в долях кадра при повороте переходят вместе со снимком */
function turnCorners(q, deg){
  const t = deg===90 ? p=>[1-p[1],p[0]] : deg===270 ? p=>[p[1],1-p[0]] : p=>[1-p[0],1-p[1]];
  const m=q.map(t); return orderCorners(m);
}
function orderCorners(pts){
  const by=(f,b)=>pts.slice().sort((p,q)=>b?f(q)-f(p):f(p)-f(q))[0];
  return [by(p=>p[0]+p[1]), by(p=>p[0]-p[1],1), by(p=>p[0]+p[1],1), by(p=>p[0]-p[1])];
}
const FULL = () => [[0,0],[1,0],[1,1],[0,1]];
const isFull = q => q.every((p,i)=>Math.hypot(p[0]-FULL()[i][0],p[1]-FULL()[i][1])<0.004);

/* Лист ищем на уменьшенной копии: сглаживаем, чтобы буквы и заломы не рвали пятно, берём самое большое светлое пятно и его крайние точки.
   Рамку ставим, только если вокруг листа виден фон и получился почти прямоугольник. Иначе берём весь кадр: лучше не обрезать, чем отрезать часть документа. */
function detectCorners(src){
  const s=fit(src,320), W=s.width, H=s.height, N=W*H, d=ctxOf(s).getImageData(0,0,W,H).data, raw=new Float32Array(N), L=new Uint8Array(N), hist=new Array(256).fill(0);
  for(let i=0;i<N;i++) raw[i]=d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11;
  const R=5, I=new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) I[(y+1)*(W+1)+x+1]=raw[y*W+x]+I[y*(W+1)+x+1]+I[(y+1)*(W+1)+x]-I[y*(W+1)+x];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const x0=Math.max(0,x-R),x1=Math.min(W,x+R+1),y0=Math.max(0,y-R),y1=Math.min(H,y+R+1);
    const v=(I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0])/((x1-x0)*(y1-y0))|0; L[y*W+x]=v; hist[v]++; }
  let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
  let wB=0,sB=0,best=0,th=128;
  for(let i=0;i<256;i++){ wB+=hist[i]; if(!wB) continue; const wF=N-wB; if(!wF) break; sB+=i*hist[i]; const m=sB/wB-(sum-sB)/wF, v=wB*wF*m*m; if(v>best){best=v;th=i;} }
  const seen=new Uint8Array(N), stack=new Int32Array(N); let top=null,topN=0,topSides=0;
  for(let st=0;st<N;st++){
    if(seen[st]||L[st]<=th) continue;
    let n=0,sp=0,sides=0,a=[st,st,st,st],av=[Infinity,-Infinity,Infinity,-Infinity]; stack[sp++]=st; seen[st]=1;
    while(sp){ const p=stack[--sp], x=p%W, y=(p/W)|0; n++;
      if(x<2) sides|=1; if(x>W-3) sides|=2; if(y<2) sides|=4; if(y>H-3) sides|=8;
      const u=x+y, v=x-y;
      if(u<av[0]){av[0]=u;a[0]=p;} if(u>av[1]){av[1]=u;a[1]=p;} if(v<av[2]){av[2]=v;a[2]=p;} if(v>av[3]){av[3]=v;a[3]=p;}
      if(x>0&&!seen[p-1]&&L[p-1]>th){seen[p-1]=1;stack[sp++]=p-1;} if(x<W-1&&!seen[p+1]&&L[p+1]>th){seen[p+1]=1;stack[sp++]=p+1;}
      if(y>0&&!seen[p-W]&&L[p-W]>th){seen[p-W]=1;stack[sp++]=p-W;} if(y<H-1&&!seen[p+W]&&L[p+W]>th){seen[p+W]=1;stack[sp++]=p+W;} }
    if(n>topN){topN=n;top=a;topSides=sides;}
  }
  const F=FULL(); if(!top||topN<N*.15) return F;
  const sideCount=[1,2,4,8].filter(b=>topSides&b).length; if(sideCount>=3) return F;
  const pt=p=>[(p%W)/(W-1),((p/W)|0)/(H-1)], q=[pt(top[0]),pt(top[3]),pt(top[1]),pt(top[2])];
  const P=q.map(p=>[p[0]*W,p[1]*H]);
  let area=0; for(let i=0;i<4;i++){ const a=P[i],b=P[(i+1)%4]; area+=a[0]*b[1]-b[0]*a[1];
    const c=P[(i+3)%4], u=[c[0]-a[0],c[1]-a[1]], v=[b[0]-a[0],b[1]-a[1]], cos=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1);
    if(Math.abs(cos)>.42) return F; }
  if(Math.abs(area)/2<N*.15) return F;
  return q.map((p,i)=>Math.hypot(p[0]-F[i][0],p[1]-F[i][1])<.04?F[i]:p);
}

/* Перспектива: матрица из четырёх пар точек, обратное отображение с билинейной выборкой */
function solveH(from,to){
  const A=[],b=[];
  for(let i=0;i<4;i++){ const [x,y]=from[i],[u,v]=to[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u); A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v); }
  for(let c=0;c<8;c++){ let p=c; for(let r=c+1;r<8;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r;
    [A[c],A[p]]=[A[p],A[c]]; [b[c],b[p]]=[b[p],b[c]];
    for(let r=0;r<8;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; if(!f) continue; for(let k=c;k<8;k++) A[r][k]-=f*A[c][k]; b[r]-=f*b[c]; } }
  return b.map((v,i)=>v/A[i][i]);
}
function warp(src, q){
  if(isFull(q)) return src;
  const W=src.width,H=src.height, P=q.map(p=>[p[0]*(W-1),p[1]*(H-1)]), len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const w=Math.max(len(P[0],P[1]),len(P[3],P[2])), h=Math.max(len(P[0],P[3]),len(P[1],P[2])), k=Math.min(1,MAX_SIDE/Math.max(w,h));
  const c=newCanvas(w*k,h*k), oW=c.width,oH=c.height, m=solveH([[0,0],[oW-1,0],[oW-1,oH-1],[0,oH-1]],P);
  const s=ctxOf(src).getImageData(0,0,W,H).data, g=ctxOf(c), out=g.createImageData(oW,oH), o=out.data;
  for(let y=0,i=0;y<oH;y++) for(let x=0;x<oW;x++,i+=4){
    const z=m[6]*x+m[7]*y+1, u=clamp((m[0]*x+m[1]*y+m[2])/z,0,W-1.001), v=clamp((m[3]*x+m[4]*y+m[5])/z,0,H-1.001);
    const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0,a=(y0*W+x0)*4,b=a+4,e=a+W*4,f=e+4;
    for(let ch=0;ch<3;ch++) o[i+ch]=(s[a+ch]*(1-fx)+s[b+ch]*fx)*(1-fy)+(s[e+ch]*(1-fx)+s[f+ch]*fx)*fy;
    o[i+3]=255;
  }
  g.putImageData(out,0,0); return c;
}

/* Карта освещения: в каждой клетке берём светлую часть (бумагу, не буквы), размываем, делим снимок на неё. Так уходят тени и заломы */
function lightMap(d,w,h){
  const s=Math.max(8,Math.round(Math.max(w,h)/48)), gw=Math.ceil(w/s), gh=Math.ceil(h/s), G=new Float32Array(gw*gh), hist=new Uint32Array(64);
  for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){
    hist.fill(0); let n=0; const x1=Math.min(w,(gx+1)*s), y1=Math.min(h,(gy+1)*s);
    for(let y=gy*s;y<y1;y+=2) for(let x=gx*s;x<x1;x+=2){ const i=(y*w+x)*4; hist[(d[i]*.3+d[i+1]*.59+d[i+2]*.11)>>2]++; n++; }
    let c=0,t=n*.9,b=63; for(let k=0;k<64;k++){ c+=hist[k]; if(c>=t){b=k;break;} } G[gy*gw+gx]=(b+.5)*4;
  }
  const blur=(A)=>{ const B=new Float32Array(A.length);
    for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ let v=0,n=0; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){ const X=x+dx,Y=y+dy; if(X<0||Y<0||X>=gw||Y>=gh) continue; v+=A[Y*gw+X]; n++; } B[y*gw+x]=v/n; } return B; };
  const M=blur(blur(G));
  return (x,y)=>{ const fx=clamp(x/s-.5,0,gw-1.001), fy=clamp(y/s-.5,0,gh-1.001), a=fx|0,b=fy|0,u=fx-a,v=fy-b,p=b*gw+a,q=gh>1?gw:0,r=gw>1?1:0;
    return (M[p]*(1-u)+M[p+r]*u)*(1-v)+(M[p+q]*(1-u)+M[p+q+r]*u)*v; };
}
function sharpen(d,w,h,a){
  const s=d.slice();
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=(y*w+x)*4;
    for(let c=0;c<3;c++) d[i+c]=clamp(s[i+c]*(1+4*a)-a*(s[i+c-4]+s[i+c+4]+s[i+c-w*4]+s[i+c+w*4]),0,255); }
}
function percentile(d,p){
  const hist=new Uint32Array(256); let n=0;
  for(let i=0;i<d.length;i+=16){ hist[(d[i]*.3+d[i+1]*.59+d[i+2]*.11)|0]++; n++; }
  let c=0,t=n*p; for(let k=0;k<256;k++){ c+=hist[k]; if(c>=t) return k; } return 255;
}
function applyMode(cv, mode){
  if(mode==='orig') return cv;
  const w=cv.width,h=cv.height,c=newCanvas(w,h),g=ctxOf(c); g.drawImage(cv,0,0);
  const im=g.getImageData(0,0,w,h), d=im.data;
  if(mode==='bright'){
    const lo=percentile(d,.005), hi=Math.max(lo+40,percentile(d,.995));
    for(let i=0;i<d.length;i+=4) for(let k=0;k<3;k++) d[i+k]=255*Math.pow(clamp((d[i+k]-lo)/(hi-lo),0,1),.88);
    g.putImageData(im,0,0); return c;
  }
  const map=lightMap(d,w,h), gray=mode==='scan';
  for(let y=0,i=0;y<h;y++) for(let x=0;x<w;x++,i+=4){
    const gain=clamp(248/Math.max(map(x,y),24),1,4);
    if(gray){ const v=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)*gain; d[i]=d[i+1]=d[i+2]=clamp(v,0,255); }
    else { d[i]=clamp(d[i]*gain,0,255); d[i+1]=clamp(d[i+1]*gain,0,255); d[i+2]=clamp(d[i+2]*gain,0,255); }
  }
  const lo=percentile(d,.01), hi=gray?232:240, power=gray?1.5:1.2;
  for(let i=0;i<d.length;i+=4) for(let k=0;k<3;k++) d[i+k]=255*Math.pow(clamp((d[i+k]-lo)/(hi-lo),0,1),power);
  sharpen(d,w,h,gray?.45:.3);
  g.putImageData(im,0,0); return c;
}
function render(base, st){ return applyMode(warp(rotated(base,st.rotate),st.corners),st.mode); }

/* ---------- окно ---------- */
const CSS = `
.enh{position:fixed;inset:0;z-index:1000;background:#0F1730;color:#F3EFE3;display:flex;flex-direction:column;font-family:var(--font);padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);touch-action:none;user-select:none;-webkit-user-select:none}
.enh button{color:inherit;font:inherit;min-height:44px;-webkit-tap-highlight-color:transparent}
.enh-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 16px}
.enh-top b{font-size:17px;font-weight:600}
.enh-top button{font-size:17px;padding:0 4px}
.enh-save{color:#A9BBFF!important;font-weight:600}
.enh-save:disabled{opacity:.4}
.enh-stage{flex:1;min-height:0;position:relative;display:grid;place-items:center;padding:12px 16px}
.enh-stage canvas{max-width:100%;max-height:100%;display:block;border-radius:8px}
.enh-box{position:relative;line-height:0}
.enh-frame{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.enh-h{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;touch-action:none;display:grid;place-items:center}
.enh-h::after{content:"";width:20px;height:20px;border-radius:50%;background:#4A69E2;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.enh-note{min-height:20px;text-align:center;color:#B5B8C8;font-size:15px;padding:0 16px}
.enh-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 16px}
.enh-modes button{border-radius:12px;font-size:15px;font-weight:500;text-align:center;color:#B5B8C8;background:#1F2A4B}
.enh-modes button.on{background:#F3EFE3;color:#0F1730}
.enh-tools{display:flex;flex-wrap:wrap;gap:0 6px;padding:0 16px 10px}
.enh-tools button{flex:1 0 auto;padding:0 8px;border-radius:12px;font-size:15px;text-align:center;white-space:nowrap}
.enh-tools button:active{background:#1F2A4B}
.enh-tools button.on{color:#A9BBFF}
.enh-busy{position:absolute;inset:0;display:grid;place-items:center;color:#B5B8C8;font-size:15px;pointer-events:none}`;
const MODES=[['orig','Как есть'],['doc','Документ'],['scan','Скан'],['bright','Ярче']];

async function open(o){
  if(!document.getElementById('enh-css')){ const s=document.createElement('style'); s.id='enh-css'; s.textContent=CSS; document.head.appendChild(s); }
  const el=document.createElement('div'); el.className='enh'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','Улучшить снимок');
  el.innerHTML=`<div class="enh-top"><button data-a="close">Отмена</button><b></b><button class="enh-save" data-a="save">Сохранить</button></div>
    <div class="enh-stage"><div class="enh-box"><canvas></canvas></div><div class="enh-busy">Открываю…</div></div>
    <div class="enh-note"></div>
    <div class="enh-modes">${MODES.map(m=>`<button data-m="${m[0]}">${m[1]}</button>`).join('')}</div>
    <div class="enh-tools"><button data-a="left">Влево</button><button data-a="right">Вправо</button><button data-a="frame">Края листа</button><button data-a="was">Было</button></div>`;
  document.body.appendChild(el);
  const $=q=>el.querySelector(q), cv=$('canvas'), box=$('.enh-box'), busy=$('.enh-busy'), note=$('.enh-note'), save=$('.enh-save');
  let idx=0, full=null, prev=null, st=null, framing=false, closed=false, dirty=false;
  const setBusy=t=>{ busy.textContent=t||''; save.disabled=!!t; };
  const show=c=>{ cv.width=c.width; cv.height=c.height; ctxOf(cv).drawImage(c,0,0); const stage=$('.enh-stage'), sw=stage.clientWidth-32, sh=stage.clientHeight-24, k=Math.min(sw/c.width,sh/c.height); cv.style.width=c.width*k+'px'; cv.style.height=c.height*k+'px'; };
  const drawFrame=()=>{ box.querySelectorAll('.enh-frame,.enh-h').forEach(n=>n.remove()); if(!framing) return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','enh-frame'); svg.setAttribute('viewBox','0 0 1 1'); svg.setAttribute('preserveAspectRatio','none');
    const poly=document.createElementNS(svg.namespaceURI,'polygon'); poly.setAttribute('fill','rgba(74,105,226,.16)'); poly.setAttribute('stroke','#4A69E2'); poly.setAttribute('stroke-width','2'); poly.setAttribute('vector-effect','non-scaling-stroke'); poly.setAttribute('points',st.corners.map(p=>p.join(',')).join(' ')); svg.appendChild(poly); box.appendChild(svg);
    st.corners.forEach((p,i)=>{ const h=document.createElement('div'); h.className='enh-h'; h.style.left=p[0]*100+'%'; h.style.top=p[1]*100+'%'; h.setAttribute('aria-label','Угол листа '+(i+1));
      h.addEventListener('pointerdown',e=>{ h.setPointerCapture(e.pointerId); e.preventDefault(); });
      h.addEventListener('pointermove',e=>{ if(!h.hasPointerCapture(e.pointerId)) return; const b=cv.getBoundingClientRect(), x=clamp((e.clientX-b.left)/b.width,0,1), y=clamp((e.clientY-b.top)/b.height,0,1); st.corners[i]=[x,y]; dirty=true; h.style.left=x*100+'%'; h.style.top=y*100+'%'; poly.setAttribute('points',st.corners.map(p=>p.join(',')).join(' ')); });
      box.appendChild(h); }); };
  const paint=()=>new Promise(res=>{ setBusy('Обрабатываю…'); setTimeout(()=>{ try{
      if(framing){ show(rotated(prev,st.rotate)); note.textContent='Перетащите точки на углы листа'; }
      else { show(render(prev,st)); note.textContent=''; }
      drawFrame(); }finally{ setBusy(''); res(); } },30); });
  const sync=()=>{ el.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===st.mode)); $('[data-a=frame]').classList.toggle('on',framing); $('[data-a=frame]').textContent=framing?'Готово':'Края листа';
    const total=o.pages.length; $('.enh-top b').textContent=total>1?`Страница ${idx+1} из ${total}`:'Улучшить'; };
  const loadPage=async i=>{ idx=i; setBusy('Открываю…'); const pg=o.pages[i];
    try{ const j=await o.fetchFile(pg.id); if(!(j.mime||'').startsWith('image/')) throw new Error('notimage');
      const bin=Uint8Array.from(atob(j.data),c=>c.charCodeAt(0)), bmp=await createImageBitmap(new Blob([bin],{type:j.mime}),{imageOrientation:'from-image'});
      const c=newCanvas(bmp.width,bmp.height); ctxOf(c).drawImage(bmp,0,0); full=fit(c,MAX_SIDE); prev=fit(full,PREVIEW_SIDE);
      st={rotate:((pg.rotate||0)%360+360)%360, corners:FULL(), mode:'doc'}; st.corners=detectCorners(rotated(prev,st.rotate)); framing=false; dirty=false; sync(); await paint();
      const ex=el.querySelector('[data-a=orig]'); if(ex) ex.remove();
      if(pg.hasOriginal){ const b=document.createElement('button'); b.dataset.a='orig'; b.textContent='Вернуть оригинал'; $('.enh-tools').appendChild(b); }
    }catch(e){ closeEl(); o.toast(e.message==='notimage'?'Улучшать можно только фото':'Снимок не открылся. Проверьте связь и попробуйте ещё раз'); } };
  const closeEl=()=>{ closed=true; el.remove(); document.removeEventListener('keydown',onKey); };
  const onKey=e=>{ if(e.key==='Escape') closeEl(); };
  document.addEventListener('keydown',onKey);
  let wasOn=false;
  const was=on=>{ if(wasOn===on||!prev||framing) return; wasOn=on; if(on){ show(prev); note.textContent='Как было'; } else { show(render(prev,st)); note.textContent=''; } };
  const wb=$('[data-a=was]');
  wb.addEventListener('pointerdown',e=>{ e.preventDefault(); wb.setPointerCapture(e.pointerId); was(true); });
  ['pointerup','pointercancel'].forEach(t=>wb.addEventListener(t,()=>was(false)));
  el.addEventListener('click',async e=>{
    const b=e.target.closest('button'); if(!b||save.disabled&&b.dataset.a!=='close') return;
    if(b.dataset.m){ st.mode=b.dataset.m; dirty=true; if(framing) framing=false; sync(); await paint(); return; }
    const a=b.dataset.a;
    if(a==='close'){ closeEl(); return; }
    if(a==='left'||a==='right'){ const d=a==='left'?270:90; st.rotate=(st.rotate+d)%360; st.corners=turnCorners(st.corners,d); dirty=true; await paint(); return; }
    if(a==='frame'){ framing=!framing; sync(); await paint(); return; }
    if(a==='orig'){ setBusy('Возвращаю оригинал…'); try{ await o.restore(o.pages[idx].id); o.toast('Оригинал на месте'); closeEl(); }catch(err){ setBusy(''); o.toast('Не получилось. Проверьте связь и попробуйте ещё раз'); } return; }
    if(a==='save'){ setBusy('Сохраняю…');
      await new Promise(r=>setTimeout(r,30));
      try{ const res=render(full,st); const blob=await new Promise(r=>res.toBlob(r,'image/jpeg',.88)); await o.save({target:o.pages[idx].id, blob});
        if(idx+1<o.pages.length && !closed){ o.toast('Страница сохранена'); await loadPage(idx+1); } else { closeEl(); o.toast('Снимок улучшен'); }
      }catch(err){ setBusy(''); o.toast('Не сохранилось. Проверьте связь и попробуйте ещё раз'); } return; }
  });
  await loadPage(o.start||0);
}
window.SemyaEnhance={open, core:{detectCorners,warp,applyMode,rotated,fit,turnCorners}};
})();
