/** Native content sizing first; the fallback only measures changed content or metrics. */
const textMetrics = [
  'font',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'textIndent',
  'textTransform',
  'fontFeatureSettings',
  'fontVariationSettings',
  'fontKerning',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
] as const;

export class TextareaResize {
  private enabled = false;
  private key = '';
  private text = '';
  private originalHeight = '';
  private managesHeight = false;
  private observer?: ResizeObserver;
  private fontProbe?: HTMLDivElement;
  private probeHeight = 0;
  private readonly nativeSizing: boolean;

  constructor(private readonly control: HTMLTextAreaElement) {
    this.nativeSizing =
      control.ownerDocument.defaultView?.CSS?.supports('field-sizing', 'content') ?? false;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.key = '';
    this.stopObserving();
    if (!enabled) {
      this.releaseHeight();
      return;
    }
    if (!this.nativeSizing && typeof ResizeObserver !== 'undefined') {
      // WebKit can omit FontFaceSet events even for CSS @font-face loads. Observe
      // intrinsic text height instead; this probe exists only during fallback
      // autosizing and has no visible, accessible or form presence.
      const probe = this.control.ownerDocument.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.dataset.labTextareaMeasure = '';
      probe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;inset:0 auto auto 0;display:block;box-sizing:content-box;height:auto;min-height:0;max-height:none;min-width:0;max-width:none;padding:0;border:0;margin:0;contain:layout style;';
      this.control.parentElement?.append(probe);
      this.fontProbe = probe;
      this.observer = new ResizeObserver((entries) => {
        if (
          entries.some(
            (entry) =>
              entry.target === probe && Math.round(entry.contentRect.height) !== this.probeHeight,
          )
        )
          this.key = '';
        this.update();
      });
      this.observer.observe(this.control);
      this.observer.observe(probe);
    }
    this.update();
  }

  update(): void {
    if (!this.enabled || this.nativeSizing || !this.control.isConnected) return;
    const control = this.control;
    const style = getComputedStyle(control);
    const text = control.value || control.placeholder;
    const key = [
      control.rows,
      control.clientWidth,
      ...textMetrics.map((property) => style[property]),
      style.padding,
      style.minHeight,
    ].join('\u0000');
    if ((this.key === key && this.text === text) || !control.clientWidth) return;
    this.key = key;
    this.text = text;
    const probe = this.fontProbe;
    if (probe) {
      for (const property of textMetrics) probe.style[property] = style[property];
      probe.style.width = `${control.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)}px`;
      // Keep a trailing empty line measurable, just like the native editor.
      probe.textContent = `${text}\u200b`;
    }
    if (!this.managesHeight) this.originalHeight = control.style.height;
    this.managesHeight = true;
    control.style.height = 'auto';
    const height = control.scrollHeight;
    this.probeHeight = probe?.offsetHeight ?? 0;
    control.style.height = `${height}px`;
  }

  disconnect(): void {
    this.stopObserving();
    this.enabled = false;
    this.key = '';
    this.releaseHeight();
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.fontProbe?.remove();
    this.fontProbe = undefined;
  }

  private releaseHeight(): void {
    if (this.managesHeight) this.control.style.height = this.originalHeight;
    this.managesHeight = false;
  }
}

export function textareaRows(rows: number): number {
  return Number.isFinite(rows) && rows > 0 ? Math.max(1, Math.floor(rows)) : 3;
}

/** Match the native value setter before an SSR parser can consume its first LF. */
export function normalizeTextareaValue(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
