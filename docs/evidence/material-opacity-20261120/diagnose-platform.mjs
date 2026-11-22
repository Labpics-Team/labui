import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { displayPixels } from '../materials-20261117/display-pixels.mjs';

const engines = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))('@playwright/test');
const display = process.env.MATERIAL_CAPTURE === 'display';
if (display && !process.env.CI) throw new Error('Display capture only in isolated CI');
const files = new Map(await Promise.all([
  ['/runtime.js', '../../../packages/materials/dist/index.js', 'text/javascript'],
  ['/material.css', '../../../packages/materials/dist/material.css', 'text/css'],
  ['/colors.css', '../../../packages/colors/contract.css', 'text/css'],
].map(async ([path, file, type]) => [path, { body: await readFile(new URL(file, import.meta.url)), type }])));
const html = '<!doctype html><html data-theme="light" data-material="acrylic"><head><link rel="stylesheet" href="/colors.css"><link rel="stylesheet" href="/material.css"></head><body></body></html>';
const server = createServer((req, res) => {const file = files.get(req.url);res.setHeader('Content-Type',file?.type ?? 'text/html');res.end(file?.body ?? html);});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const rows=[];
async function sample(page,points) {
  if(display) return displayPixels(page, points);
  const png=await page.screenshot();
  return page.evaluate(async({data,points})=>{
    const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    return points.map(({x,y})=>Array.from(ctx.getImageData(x,y,1,1).data));
  },{data:png.toString('base64'),points});
}
async function settle(page) {await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));if(display)await page.waitForTimeout(300);}
try {
for(const name of (process.env.MATERIAL_BROWSERS ?? 'chromium,webkit').split(',')) {
  const browser=await engines[name].launch({headless:!display,...(name==='chromium'?{channel:'chromium'}:{})});
  try {
    const page=await browser.newPage({viewport:{width:800,height:300}});
    if(name==='chromium') {const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'no-preference'},{name:'prefers-contrast',value:'no-preference'}]});}
    if(display)await page.bringToFront();
    // Six simultaneous backdrops make a repeated transfer distinguishable from
    // a missing transfer or an opaque fallback. No diagnostic variant is a verdict.
    for(const variant of ['native','affine-filter','separate-face','capture-blend']) {
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const styles=await page.evaluate(async variant=>{
        document.head.insertAdjacentHTML('beforeend',`<style>body{margin:0}.zone{position:absolute;top:0;width:100px;height:100px}.surface{position:absolute;inset:0;border-radius:0;transform:translateZ(0);--_rim:none;--_backdrop-blur:1px;--_acrylic-noise:none;overflow:auto}.content{width:300px;height:300px}</style>`);
        [[0,0,0],[255,255,255],[15,75,200],[200,60,15],[120,128,140],[240,230,220]].forEach((rgb,index)=>{
          const zone=document.createElement('div');zone.className='zone';zone.style.cssText=`left:${index*100}px;background:rgb(${rgb.join(' ')})`;
          const surface=document.createElement('div');surface.className='lab-material lab-material--subtle surface';surface.innerHTML='<div class="content"></div>';zone.append(surface);document.body.append(zone);
        });
        const {mountMaterialRuntime}=await import('/runtime.js');window.dispose=mountMaterialRuntime();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        for(const surface of document.querySelectorAll('.surface')) {
          if(variant==='no-transform')surface.style.transform='none';
          if(variant==='no-isolation')surface.style.isolation='auto';
          if(variant==='local-background')surface.style.backgroundAttachment='local';
          if(variant==='affine-filter') {
            const rgb=getComputedStyle(surface).backgroundColor.match(/[\d.]+/g).map(Number);
            const alpha=rgb[3]??1, m=1-alpha, b=rgb[0]*alpha/255, brightness=m+2*b, contrast=brightness?m/brightness:0;
            surface.style.setProperty('--_material-paint-filter',`contrast(${contrast}) brightness(${brightness})`);surface.style.background='none';
          }
          if(variant==='separate-face') {
            const face=document.createElement('div');face.style.cssText='position:sticky;top:0;left:0;width:100px;height:100px;z-index:-1;pointer-events:none;backdrop-filter:var(--_material-filter);-webkit-backdrop-filter:var(--_material-filter);background:var(--_surface-paint)';
            const runway=document.createElement('div');runway.style.cssText='position:absolute;inset:0 auto auto 0;width:300px;height:300px;pointer-events:none;z-index:-1';runway.append(face);surface.prepend(runway);
            surface.style.background='none';surface.style.backdropFilter='none';surface.style.webkitBackdropFilter='none';
          }
          if(variant==='capture-blend') {
            const runway=document.createElement('div');runway.style.cssText='position:absolute;inset:0 auto auto 0;width:300px;height:300px;pointer-events:none;z-index:-1';
            const face=document.createElement('div');face.style.cssText='position:sticky;top:0;left:0;width:100px;height:100px;z-index:-1;pointer-events:none';face.innerHTML='<div style="position:absolute;inset:0;backdrop-filter:blur(var(--_blur));-webkit-backdrop-filter:blur(var(--_blur))"></div><div style="position:absolute;inset:0;background:var(--_tint)"></div><div style="position:absolute;inset:0;background:var(--_blend);mix-blend-mode:color-dodge"></div>';runway.append(face);surface.prepend(runway);
            surface.style.background='none';surface.style.backdropFilter='none';surface.style.webkitBackdropFilter='none';
          }
        }
        const cs=getComputedStyle(document.querySelector('.surface'));
        return {fill:cs.backgroundColor,filter:cs.backdropFilter,tint:cs.getPropertyValue('--_tint'),blend:cs.getPropertyValue('--_blend')};
      },variant);
      await settle(page);
      const points=[0,1,2,3,4,5].map(i=>({x:i*100+50,y:50}));
      const before=await sample(page,points);
      await page.evaluate(()=>document.querySelectorAll('.surface').forEach(s=>s.scrollTo(150,150)));
      await settle(page);
      const after=await sample(page,points);
      const row={kind:'scroll',name,display,variant,styles,before,after};rows.push(row);console.log(JSON.stringify(row));
    }
    for(const variant of ['native','no-lens','no-stroke','opaque-filter-alpha','no-dispersion','affine-filter','wide-region']) {
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(async variant=>{
        document.documentElement.dataset.material='glass';
        document.head.insertAdjacentHTML('beforeend',`<style>body{margin:0;background:white}.clip{position:absolute;left:32px;top:40px;width:400px;height:8px;overflow:hidden;border-radius:0 0 8px 8px}.surface{position:absolute;inset:auto 0 0;height:16px;border-radius:inherit;--_material-layer-opacity:.64}.surface::after{content:'';position:absolute;inset:auto 0 0;height:8px;border:1px solid rgb(0 0 0 / .2);border-top:0;box-sizing:border-box;border-radius:inherit}</style>`);
        document.body.innerHTML='<div class="clip"><div class="lab-material lab-material--base surface"></div></div>';
        const {mountMaterialRuntime}=await import('/runtime.js');window.dispose=mountMaterialRuntime();
        if(variant==='no-lens')document.querySelector('.surface').style.setProperty('--_lg-refraction','0');
        if(variant==='no-stroke')document.head.insertAdjacentHTML('beforeend','<style>.surface::after{border:0}</style>');
        if(variant==='no-dispersion')document.querySelector('.surface').style.setProperty('--_lg-dispersion','0');
        await new Promise(r=>setTimeout(r,200));
        if(variant==='opaque-filter-alpha')for(const filter of document.querySelectorAll('filter[id^="lab-lg-"]')) {
          const transfer=document.createElementNS('http://www.w3.org/2000/svg','feComponentTransfer');
          const fn=document.createElementNS('http://www.w3.org/2000/svg','feFuncA');fn.setAttribute('type','linear');fn.setAttribute('slope','0');fn.setAttribute('intercept','1');transfer.append(fn);filter.append(transfer);
        }
        if(variant==='affine-filter') {
          const surface=document.querySelector('.surface'), rgb=getComputedStyle(surface).backgroundColor.match(/[\d.]+/g).map(Number);
          const alpha=rgb[3]??1,m=1-alpha,b=rgb[0]*alpha/255,brightness=m+2*b,contrast=brightness?m/brightness:0;
          surface.style.setProperty('--_material-paint-filter',`contrast(${contrast}) brightness(${brightness})`);surface.style.background='none';
        }
        if(variant==='wide-region')for(const filter of document.querySelectorAll('filter[id^="lab-lg-"]')) {filter.setAttribute('x','-100');filter.setAttribute('y','-100');filter.setAttribute('width','600');filter.setAttribute('height','216');}
      },variant);
      const points=[{x:232,y:43},...[0,1,2,3,4,5,6,7].map(d=>({x:32+d,y:47})),...[0,1,2].map(d=>({x:32,y:40+d}))];
      const frames=[];
      for(const alpha of [0,.64,1]) {
        await page.evaluate(alpha=>document.querySelector('.surface').style.setProperty('--_material-layer-opacity',String(alpha)),alpha);await settle(page);frames.push(await sample(page,points));
      }
      const errors=points.map((_,i)=>Math.max(...[0,1,2].map(c=>Math.abs(frames[1][i][c]-.36*frames[0][i][c]-.64*frames[2][i][c]))));
      const row={kind:'glass',name,display,variant,frames,errors};rows.push(row);console.log(JSON.stringify(row));
    }
  } finally {await browser.close();}
}
} finally {
  const output=resolve(process.env.MATERIAL_OUTPUT??'.scratch','platform-diagnostic-'+process.platform+'-'+(display?'display':'snapshot')+'.json');await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(rows,null,2)+'\n');server.close();
}
