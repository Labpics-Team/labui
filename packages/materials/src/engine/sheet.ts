import { SHEET_BODY, authoredBlurSigma } from '../profiles/sheet';
import { type LengthProbe, createLengthProbe } from './length';
import { type EngineHandle, createHiddenDefs, trailingRaf } from './mount';

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

/** Project only the qualified paint/blur body. Ghost, geometry and controls
 * stay with Sheet; the existing runtime owns scope selection and lifetime. */
export function attach(el: HTMLElement): EngineHandle {
  const document = el.ownerDocument;
  let host: ReturnType<typeof createHiddenDefs> | undefined;
  let radius: LengthProbe | undefined;
  let ro: ResizeObserver | undefined;
  const filter = document.createElementNS(SVGNS, 'filter');
  const id = `lab-sheet-${++uid}`;
  filter.id = id;
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const probeParent = document.createElement('span');
  probeParent.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none';
  probeParent.setAttribute('aria-hidden', 'true');
  const baseline = [
    'backdrop-filter',
    '-webkit-backdrop-filter',
    'background-image',
    'background-color',
  ].map((property) => ({
    property,
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  }));
  const hadClass = el.classList.contains('lab-material--sheet-ordered');
  let disposed = false;
  let blur: SVGFEGaussianBlurElement | undefined;
  let blend: SVGFEBlendElement | undefined;
  let input = 'SourceGraphic';
  for (const step of SHEET_BODY) {
    const result = `sheet-${step.kind}`;
    if (step.kind === 'blur') {
      blur = document.createElementNS(SVGNS, 'feGaussianBlur');
      blur.setAttribute('in', input);
      blur.setAttribute('result', result);
      filter.appendChild(blur);
    } else {
      const flood = document.createElementNS(SVGNS, 'feFlood');
      flood.style.setProperty('flood-color', `var(${step.role})`);
      flood.setAttribute('result', `${result}-paint`);
      const composite = document.createElementNS(
        SVGNS,
        step.kind === 'tint' ? 'feComposite' : 'feBlend',
      );
      composite.setAttribute('in', `${result}-paint`);
      composite.setAttribute('in2', input);
      composite.setAttribute('result', result);
      if (step.kind === 'tint') composite.setAttribute('operator', 'over');
      else blend = composite as SVGFEBlendElement;
      filter.append(flood, composite);
    }
    input = result;
  }

  function refresh(): void {
    if (disposed || !radius) return;
    const sigma = authoredBlurSigma(radius.read());
    const reach = 3 * sigma;
    const theme = document.defaultView
      ?.getComputedStyle(el)
      .getPropertyValue('--_sheet-theme')
      .trim();
    const blendStep = SHEET_BODY.find((step) => step.kind === 'blend');
    if (!blendStep || (theme !== 'light' && theme !== 'dark')) {
      throw new Error('Sheet material requires a resolved Colors theme');
    }
    if (blur?.getAttribute('stdDeviation') !== String(sigma))
      blur?.setAttribute('stdDeviation', String(sigma));
    if (blend?.getAttribute('mode') !== blendStep.mode[theme])
      blend?.setAttribute('mode', blendStep.mode[theme]);
    for (const [name, value] of Object.entries({
      x: -reach,
      y: -reach,
      width: el.offsetWidth + 2 * reach,
      height: el.offsetHeight + 2 * reach,
    })) {
      if (filter.getAttribute(name) !== String(value)) filter.setAttribute(name, String(value));
    }
  }

  const raf = trailingRaf(refresh);
  const handle: EngineHandle = {
    restore(): void {
      if (disposed) return;
      host?.restore();
      if (probeParent.parentNode !== el) el.appendChild(probeParent);
      radius?.restore();
    },
    refresh,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      ro?.disconnect();
      raf.cancel();
      radius?.destroy();
      probeParent.remove();
      host?.svg.remove();
      if (!hadClass) el.classList.remove('lab-material--sheet-ordered');
      for (const { property, value, priority } of baseline)
        el.style.setProperty(property, value, priority);
    },
  };
  try {
    ro = new ResizeObserver(() => raf.schedule());
    host = createHiddenDefs(el, 'lab-sheet-defs');
    host.defs.appendChild(filter);
    el.appendChild(probeParent);
    const blurStep = SHEET_BODY.find((step) => step.kind === 'blur');
    if (!blurStep) throw new Error('Sheet material requires a blur stage');
    radius = createLengthProbe(el, probeParent, blurStep.radius);
    refresh();
    el.style.setProperty('backdrop-filter', `url(#${id})`);
    el.style.setProperty('-webkit-backdrop-filter', `url(#${id})`);
    el.style.setProperty('background-image', 'none');
    el.style.setProperty('background-color', 'transparent');
    el.classList.add('lab-material--sheet-ordered');
    ro.observe(el);
    ro.observe(radius.element);
    return handle;
  } catch (error) {
    handle.destroy();
    throw error;
  }
}
