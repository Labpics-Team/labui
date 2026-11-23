// Independent reference vectors from the public Color.js codec, never production data.
import Color from '../../../packages/core/node_modules/colorjs.io/src/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
const inputs = [];
for (const r of [0, .1, .25, .5, .75, .9, 1]) for (const g of [0, .1, .5, .9, 1]) for (const b of [0,.3,.7,1]) inputs.push(['srgb',r,g,b]);
for (const l of [0,25,50,75,100]) for (const c of [0,50,145,195]) for (let h=0;h<360;h+=30) inputs.push(['lch',l,c,h]);
inputs.push(['lch',72.09123456789,84.86123456789,65.34123456789],['lch',50,120,250],['hsv',13.123456789,79.56789123,43.123456789],['hsl',235.123456789,33.123456789,65.123456789]);
const lines = [];
for (const [space,...coords] of inputs) for (const target of ['srgb','hsl','hsv','lch','p3','rec2020']) {
  const c = new Color(space,coords,.5019607843137255).to(target);
  lines.push([space,...coords,target,...c.coords.map(v=>v==null||Number.isNaN(v)?0:v)].join('\t'));
}
const folder = new URL('../src/desktopTest/resources/', import.meta.url);
mkdirSync(folder,{recursive:true});
writeFileSync(new URL('color-picker-colorjs.tsv',folder),lines.join('\n')+'\n');
