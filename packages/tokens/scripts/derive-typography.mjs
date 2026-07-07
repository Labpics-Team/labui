/**
 * Воспроизводимая деривация оптических моделей типографики LabUI из отпечатков
 * Geist (Figma). Печатает коэффициенты и НЕВЯЗКИ по каждому отпечатку — так
 * калибровка в domain/typography.ts заземлена и проверяема, а не «из памяти».
 *
 * Запуск:  node packages/tokens/scripts/derive-typography.mjs
 * (аналог scripts/derive-corner-k.mjs — деривация как артефакт, не магия.)
 *
 * Отпечаток = [кегль px, letter-spacing px, line-height px, вес, роль].
 */

const FP = [
  { z: 112, ls: -5, lh: 96, w: 'Medium', role: 'Display/6XL' },
  { z: 80, ls: -4, lh: 80, w: 'Medium', role: 'Display/5XL' },
  { z: 64, ls: -3, lh: 64, w: 'Medium', role: 'Title/4XL' },
  { z: 48, ls: -2, lh: 48, w: 'Medium', role: 'Title/3XL' },
  { z: 32, ls: -1, lh: 32, w: 'Medium', role: 'Title/2XL' },
  { z: 24, ls: -0.5, lh: 24, w: 'Medium', role: 'Title/XL' },
  { z: 20, ls: -0.33, lh: 20, w: 'Medium', role: 'Headline/L' },
  { z: 16, ls: -0.25, lh: 24, w: 'Regular', role: 'Text/M-Common' },
  { z: 16, ls: 0, lh: 24, w: 'Medium', role: 'Text/M-Emphasized' },
  { z: 14, ls: 0, lh: 12, w: 'Medium', role: 'Caption/S' },
  { z: 12, ls: 0, lh: 12, w: 'Medium', role: 'Caption/XS' },
  { z: 8, ls: -0.25, lh: 8, w: 'Medium', role: 'Caption/XXS' },
];

// ЗАЛОЧЕННЫЕ константы (совпадают с domain/typography.ts) — скрипт их ПРОВЕРЯЕТ.
const TRACK = { A: -0.047, B: 0.1112, C: -0.066 };
const LH = { BASE: 16, SOLID: 1, READ_AMP: 0.5, READ_SIGMA: 0.05, KNEE_U: 5, TAPER_K: 0.4246 };

const track = (z) => TRACK.A + TRACK.B * Math.exp(TRACK.C * z);
const lhModel = (z) => {
  const reading = LH.READ_AMP * Math.exp(-0.5 * (Math.log(z / LH.BASE) / LH.READ_SIGMA) ** 2);
  const taper = LH.TAPER_K * Math.max(0, Math.log(z / LH.BASE / LH.KNEE_U));
  return LH.SOLID + reading - taper;
};

// --- ТРЕКИНГ: спайн (без 16-Emphasized и 8px-XXS) ---
const spine = FP.filter((p) => p.role !== 'Text/M-Emphasized' && p.role !== 'Caption/XXS');
console.info('=== ТРЕКИНГ  tracking(z) = A + B·e^(C·z) ===');
console.info(`A=${TRACK.A} B=${TRACK.B} C=${TRACK.C}`);
let maxT = 0;
for (const p of FP) {
  const r = (track(p.z) - p.ls / p.z) * p.z;
  const tag = p.role === 'Text/M-Emphasized' ? 'вне закона: ось веса' : p.role === 'Caption/XXS' ? 'вне закона: caption' : '';
  if (!tag) maxT = Math.max(maxT, Math.abs(r));
  console.info(`  ${p.role.padEnd(18)} z=${String(p.z).padStart(3)}  fit=${(track(p.z) * p.z).toFixed(3)}px отпечаток=${String(p.ls).padStart(5)}px  r=${(r >= 0 ? ' ' : '') + r.toFixed(3)}px  ${tag}`);
}
console.info(`  max|r| на спайне = ${maxT.toFixed(3)}px (допуск теста 0.35px)`);

// --- LINE-HEIGHT: solid + reading - taper (repro без caption-14) ---
console.info('\n=== LINE-HEIGHT  lh(z) = SOLID + reading(z) − taper(z) ===');
console.info(`BASE=${LH.BASE} AMP=${LH.READ_AMP} SIGMA=${LH.READ_SIGMA} KNEE=BASE·${LH.KNEE_U} K=${LH.TAPER_K}`);
let maxL = 0;
for (const p of FP) {
  const r = lhModel(p.z) - p.lh / p.z;
  const tag = p.role === 'Caption/S' ? 'вне закона: caption-микро −2px' : '';
  if (!tag) maxL = Math.max(maxL, Math.abs(r));
  console.info(`  ${p.role.padEnd(18)} z=${String(p.z).padStart(3)}  fit=${lhModel(p.z).toFixed(4)} отпечаток=${(p.lh / p.z).toFixed(4)}  r=${(r >= 0 ? ' ' : '') + r.toFixed(4)}  ${tag}`);
}
console.info(`  max|r| на repro = ${maxL.toFixed(4)} (допуск теста 0.01)`);

// Итоговый вывод (аналог derive-corner-k): фиксируем деривацию как факт.
console.info('\nВывод: exp-к-асимптоте для трекинга (SSE 0.19 против 0.35 px² у reciprocal),');
console.info('для line-height — set-solid + reading-надбавка на body + суб-solid тапер сверху;');
console.info('чистой f(z) для line-height нет (14→0.857 против 16→1.5 рвут монотон — см. domain).');
