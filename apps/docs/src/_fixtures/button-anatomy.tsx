import '@labpics/ui-core/button';
import '@labpics/fonts/fonts.css';
import { Button } from '@labpics/ui-react';
import { Button as VueButton } from '@labpics/ui-vue';
import { type ReactNode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, h, ref } from 'vue';

const sizes = ['s', 'm', 'l'] as const;
const modes = ['plain', 'full', 'wrapped', 'empty', 'visual'] as const;
type Size = (typeof sizes)[number];
type Mode = (typeof modes)[number];
const smallIcon = new URL('./button-small.svg', import.meta.url).href;
const mediumIcon = new URL('./button-medium.svg', import.meta.url).href;
const hasDescription = (mode: Mode) => ['full', 'wrapped', 'visual'].includes(mode);
const hasEnd = hasDescription;
const glyphHtml = (position: string) =>
  `<svg data-glyph="${position}" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor"/></svg>`;

function iconHtml(size: Size, mode: Mode, position: 'start' | 'end') {
  if (mode === 'plain' || (position === 'end' && !hasEnd(mode))) return '';
  const slot = position === 'start' ? 'icon' : 'end';
  if (mode === 'empty') return `<span slot="${slot}"></span>`;
  if (mode === 'visual') {
    return `<img slot="${slot}" alt="" data-glyph="${position}" src="${size === 's' ? smallIcon : mediumIcon}" style="width:${size === 's' ? 1.25 : 1.5}rem;height:${size === 's' ? 1.25 : 1.5}rem"/>`;
  }
  if (mode === 'wrapped') {
    return `<span slot="${slot}" ${position === 'end' ? 'style="display:contents"' : ''}>${glyphHtml(position)}</span>`;
  }
  return glyphHtml(position).replace('<svg ', `<svg slot="${slot}" `);
}

const litMount = document.querySelector<HTMLElement>('#lit-anatomy');
if (!litMount) throw new Error('Missing Lit anatomy mount');
litMount.innerHTML = `<h2>Lit</h2><div class="anatomy-controls"><label><input type="checkbox" data-testid="lit-anatomy-loading"/>Loading</label><label><input type="checkbox" data-testid="lit-anatomy-icon"/>Icon</label></div>${sizes.map((size) => `<div class="anatomy-row" data-testid="lit-anatomy-row-${size}">${modes.map((mode) => `<lab-button data-testid="lit-anatomy-${size}-${mode}" size="${size}" ${hasDescription(mode) ? 'description="Description"' : ''}>${iconHtml(size, mode, 'start')}<span data-label>Button</span>${iconHtml(size, mode, 'end')}</lab-button>`).join('')}</div>`).join('')}<lab-button data-testid="lit-anatomy-title" icon><svg slot="icon" width="16" height="16" viewBox="0 0 16 16"><title>Add item</title><path d="M8 2v12M2 8h12" stroke="currentColor"/></svg></lab-button>`;
for (const name of ['loading', 'icon']) {
  litMount
    .querySelector<HTMLInputElement>(`[data-testid="lit-anatomy-${name}"]`)
    ?.addEventListener('change', (event) => {
      const value = (event.target as HTMLInputElement).checked;
      for (const button of litMount.querySelectorAll(
        name === 'icon' ? 'lab-button:not([data-testid="lit-anatomy-title"])' : 'lab-button',
      )) {
        button.toggleAttribute(name, value);
      }
    });
}

function Glyph({ position }: { position: string }) {
  return (
    <svg data-glyph={position} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" />
    </svg>
  );
}
function reactIcon(size: Size, mode: Mode, position: 'start' | 'end'): ReactNode {
  if (mode === 'plain' || (position === 'end' && !hasEnd(mode))) return undefined;
  if (mode === 'empty') return <span />;
  if (mode === 'visual')
    return (
      <img
        alt=""
        data-glyph={position}
        src={size === 's' ? smallIcon : mediumIcon}
        style={{
          width: size === 's' ? '1.25rem' : '1.5rem',
          height: size === 's' ? '1.25rem' : '1.5rem',
        }}
      />
    );
  if (mode === 'wrapped')
    return (
      <span style={position === 'end' ? { display: 'contents' } : undefined}>
        <Glyph position={position} />
      </span>
    );
  return <Glyph position={position} />;
}
function ReactAnatomy() {
  const [loading, setLoading] = useState(false);
  const [icon, setIcon] = useState(false);
  return (
    <>
      <h2>React</h2>
      <div className="anatomy-controls">
        <label>
          <input
            type="checkbox"
            data-testid="react-anatomy-loading"
            checked={loading}
            onChange={(event) => setLoading(event.target.checked)}
          />
          Loading
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="react-anatomy-icon"
            checked={icon}
            onChange={(event) => setIcon(event.target.checked)}
          />
          Icon
        </label>
      </div>
      {sizes.map((size) => (
        <div className="anatomy-row" data-testid={`react-anatomy-row-${size}`} key={size}>
          {modes.map((mode) => (
            <Button
              key={mode}
              data-testid={`react-anatomy-${size}-${mode}`}
              size={size}
              loading={loading}
              icon={icon}
              description={hasDescription(mode) ? 'Description' : undefined}
              iconSlot={reactIcon(size, mode, 'start')}
              endSlot={reactIcon(size, mode, 'end')}
            >
              <span data-label>Button</span>
            </Button>
          ))}
        </div>
      ))}
      <Button
        data-testid="react-anatomy-title"
        icon
        loading={loading}
        iconSlot={
          <svg width="16" height="16" viewBox="0 0 16 16">
            <title>Add item</title>
            <path d="M8 2v12M2 8h12" stroke="currentColor" />
          </svg>
        }
      />
    </>
  );
}
const reactMount = document.querySelector('#react-anatomy');
if (!reactMount) throw new Error('Missing React anatomy mount');
createRoot(reactMount).render(<ReactAnatomy />);

function vueIcon(size: Size, mode: Mode, position: 'start' | 'end') {
  if (mode === 'empty') return h('span');
  if (mode === 'visual')
    return h('img', {
      alt: '',
      'data-glyph': position,
      src: size === 's' ? smallIcon : mediumIcon,
      style: {
        width: size === 's' ? '1.25rem' : '1.5rem',
        height: size === 's' ? '1.25rem' : '1.5rem',
      },
    });
  const glyph = h(
    'svg',
    {
      'data-glyph': position,
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      'aria-hidden': 'true',
    },
    [h('path', { d: 'M8 2v12M2 8h12', stroke: 'currentColor' })],
  );
  return mode === 'wrapped'
    ? h('span', position === 'end' ? { style: { display: 'contents' } } : {}, [glyph])
    : glyph;
}
createApp({
  setup() {
    const loading = ref(false);
    const icon = ref(false);
    return () => [
      h('h2', 'Vue'),
      h('div', { class: 'anatomy-controls' }, [
        h('label', [
          h('input', {
            type: 'checkbox',
            'data-testid': 'vue-anatomy-loading',
            checked: loading.value,
            onChange: (event: Event) => {
              loading.value = (event.target as HTMLInputElement).checked;
            },
          }),
          'Loading',
        ]),
        h('label', [
          h('input', {
            type: 'checkbox',
            'data-testid': 'vue-anatomy-icon',
            checked: icon.value,
            onChange: (event: Event) => {
              icon.value = (event.target as HTMLInputElement).checked;
            },
          }),
          'Icon',
        ]),
      ]),
      ...sizes.map((size) =>
        h(
          'div',
          { class: 'anatomy-row', 'data-testid': `vue-anatomy-row-${size}` },
          modes.map((mode) =>
            h(
              VueButton,
              {
                size,
                loading: loading.value,
                icon: icon.value,
                description: hasDescription(mode) ? 'Description' : undefined,
                'data-testid': `vue-anatomy-${size}-${mode}`,
              },
              {
                default: () => h('span', { 'data-label': '' }, 'Button'),
                ...(mode === 'plain' ? {} : { icon: () => vueIcon(size, mode, 'start') }),
                ...(hasEnd(mode) ? { end: () => vueIcon(size, mode, 'end') } : {}),
              },
            ),
          ),
        ),
      ),
    ];
  },
}).mount('#vue-anatomy');
