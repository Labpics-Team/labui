const { join } = require('node:path');
const { createRequire } = require('node:module');
const docsRequire = createRequire(join(__dirname, '../../../../apps/docs/package.json'));
const { chromium } = docsRequire('@playwright/test');

/*
 * Два решающих факта для «чтобы юзерам не лагало»:
 *  1. GPU НАСЫЩАЕМ ли acrylic-блюром — под тяжёлой нагрузкой FPS должен упасть
 *     (throughput = кадры/wallclock, НЕ rAF-дельта: она врёт на high-Hz).
 *  2. КУЛЛИТ ли браузер вне-вьюпортные backdrop-filter — если FPS с
 *     поверхностями ЗА экраном ≈ FPS без них, браузер сам не тратит GPU на
 *     невидимое → IntersectionObserver избыточен. Если FPS(за экраном) заметно
 *     ниже FPS(нет) → браузер растеризует невидимое → IO реально экономит.
 */

const PAGE = `<!doctype html><html><head><meta charset=utf-8><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#101014}
  #bg{position:fixed;left:0;top:0;width:300vw;height:100vh;background:
    repeating-linear-gradient(90deg,#000 0 6px,#fff 6px 12px,#d40045 12px 18px,#0af 18px 24px)}
  .s{position:absolute;background:rgba(128,128,128,.35)}
  svg{position:absolute;width:0;height:0}
</style></head><body>
  <div id=bg></div><svg><defs id=defs></defs></svg>
  <script>
    const NS='http://www.w3.org/2000/svg', defs=document.getElementById('defs');
    let uid=0;
    function filt(w,h,M){
      const id='f'+ ++uid, f=document.createElementNS(NS,'filter');
      f.setAttribute('id',id); f.setAttribute('filterUnits','userSpaceOnUse');
      f.setAttribute('color-interpolation-filters','sRGB');
      f.setAttribute('x',-M); f.setAttribute('y',-M);
      f.setAttribute('width',w+2*M); f.setAttribute('height',h+2*M);
      const b=document.createElementNS(NS,'feGaussianBlur'); b.setAttribute('stdDeviation',48); b.setAttribute('result','b');
      const s=document.createElementNS(NS,'feColorMatrix'); s.setAttribute('in','b'); s.setAttribute('type','saturate'); s.setAttribute('values',1.8); s.setAttribute('result','s');
      const fl=document.createElementNS(NS,'feFlood'); fl.setAttribute('flood-color','#f0f0f0'); fl.setAttribute('flood-opacity',.7); fl.setAttribute('result','fl');
      const bl=document.createElementNS(NS,'feBlend'); bl.setAttribute('in','fl'); bl.setAttribute('in2','s'); bl.setAttribute('mode','luminosity');
      f.append(b,s,fl,bl); defs.appendChild(f); return id;
    }
    window.setup=({n,w,h,M,offscreen})=>{
      for(const e of document.querySelectorAll('.s')) e.remove();
      while(defs.firstChild) defs.removeChild(defs.firstChild); uid=0;
      for(let i=0;i<n;i++){
        const id=filt(w,h,M), d=document.createElement('div'); d.className='s';
        // onscreen: тайлим в вьюпорт (перекрываем — все реально видимы/растеризуются);
        // offscreen: далеко вниз (за вьюпортом).
        d.style.left=(offscreen?20:(i%3)*(w+8))+'px';
        d.style.top=(offscreen?4000+i*10:Math.floor(i/3)*(h+8))+'px';
        d.style.width=w+'px'; d.style.height=h+'px';
        d.style.backdropFilter='url(#'+id+')'; d.style.webkitBackdropFilter='url(#'+id+')';
        document.body.appendChild(d);
      }
      document.getElementById('bg').animate(
        [{transform:'translateX(0)'},{transform:'translateX(-66%)'}],
        {duration:1400,iterations:Infinity,easing:'linear'});
    };
    // FPS = frames / wallclock (perf time) over the window. Under GPU
    // saturation the browser cannot keep native refresh, FPS falls below it.
    window.fps=(ms)=>new Promise(res=>{
      let n=0; const t0=performance.now();
      const tick=()=>{ n++; if(performance.now()-t0<ms) requestAnimationFrame(tick);
        else res(Math.round(n/((performance.now()-t0)/1000))); };
      requestAnimationFrame(tick);
    });
    window.__ready=true;
  </script>
</body></html>`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.argv[2],
    args: ['--window-size=1400,900', '--window-position=0,0'],
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 860 },
    deviceScaleFactor: 2,
  });
  await page.setContent(PAGE);
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

  const run = async (cfg) => {
    await page.evaluate((c) => window.setup(c), cfg);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.fps(400)); // warm
    return page.evaluate(() => window.fps(1500));
  };

  console.log('dpr=2, 720x460 big acrylic panels, moving backdrop. FPS (higher=better)');
  // 1. Насыщение: наращиваем видимые панели, смотрим падает ли FPS.
  for (const n of [1, 4, 8, 16, 32]) {
    const f = await run({ n, w: 720, h: 460, M: 96, offscreen: false });
    console.log(`onscreen n=${String(n).padStart(2)}  FPS=${f}`);
  }
  // 2. Куллинг: те же панели ЗА вьюпортом.
  for (const n of [8, 16, 32]) {
    const f = await run({ n, w: 720, h: 460, M: 96, offscreen: true });
    console.log(`OFFscreen n=${String(n).padStart(2)} FPS=${f}`);
  }
  // 3. Регион: 16 видимых, охват %≈объёмный vs 2σ=96 (площадь-эффект).
  const f96 = await run({ n: 16, w: 720, h: 460, M: 96, offscreen: false });
  const f180 = await run({ n: 16, w: 720, h: 460, M: 180, offscreen: false }); // ~%-регион охват
  console.log(`region 16×720x460: M=96 FPS=${f96}  M=180(≈pct) FPS=${f180}`);

  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
