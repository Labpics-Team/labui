import { Switch, type SwitchProps } from '@labpics/ui-react/switch';
import { Fragment, type ReactNode, createElement, useEffect, useRef, useState } from 'react';

const empty = (
  <Fragment>
    {false}
    {null}
    {''}
  </Fragment>
);

function OpaqueLabel(): ReactNode {
  return <span>Component label</span>;
}

function Caption(): ReactNode {
  const [text, setText] = useState('');
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setText(node.dataset.captionText ?? '');
    node.addEventListener('caption-text', update);
    return () => node.removeEventListener('caption-text', update);
  }, []);
  return (
    <span ref={ref} data-testid="react-caption-content">
      {text}
    </span>
  );
}

export function ReactSwitchLabels(): ReactNode {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const [label, setLabel] = useState<ReactNode>('Mutable');
  const [hidden, setHidden] = useState(false);
  const variants: Array<{ id: string; props?: SwitchProps; children?: ReactNode }> = [
    { id: 'both', props: { labelStart: 'Left' }, children: 'Right' },
    { id: 'start', props: { labelStart: 'Left', hideLabelEnd: true }, children: 'Right' },
    { id: 'end', props: { labelStart: 'Left', hideLabelStart: true }, children: 'Right' },
    {
      id: 'neither',
      props: { labelStart: 'Left', hideLabelStart: true, hideLabelEnd: true },
      children: 'Right',
    },
    { id: 'empty', children: '' },
    {
      id: 'empty-wrapper',
      children: (
        <span>
          <em>{' \t '}</em>
        </span>
      ),
    },
    { id: 'false', children: false },
    { id: 'whitespace', props: { labelStart: ' \t ' }, children: ' \n ' },
    { id: 'fragment', children: empty },
    { id: 'array', children: [null, false, '', empty] },
    { id: 'zero', children: 0 },
    { id: 'icons', props: { iconOn: <span>Icon</span> } },
    { id: 'legacy', children: <span>Legacy</span> },
    {
      id: 'rich',
      children: (
        <span>
          <strong>Legacy</strong> label
        </span>
      ),
    },
    {
      id: 'image',
      children: (
        <span>
          <img alt="Network" width={16} height={16} />
        </span>
      ),
    },
    { id: 'unknown', children: createElement('unknown-switch-label') },
    {
      id: 'class-caption',
      props: { labelStart: 'Leading' },
      children: <span className="caption">Trailing</span>,
    },
    {
      id: 'style-caption',
      props: { labelStart: 'Leading' },
      children: <span style={{ color: 'currentColor' }}>Trailing</span>,
    },
    { id: 'visibility', children: <span data-caption>Trailing</span> },
    {
      id: 'css-quoted',
      props: { labelStart: 'Leading' },
      children: (
        <span style={{ ...{ '--caption': '"; display:none;"' }, color: 'black' }}>Trailing</span>
      ),
    },
    {
      id: 'css-font',
      props: { labelStart: 'Leading' },
      children: <span style={{ fontFamily: '"; visibility:hidden;"' }}>Trailing</span>,
    },
    {
      id: 'css-comment',
      props: { labelStart: 'Leading' },
      children: <span style={{ display: 'n/**/one' }}>Trailing</span>,
    },
    {
      id: 'css-escaped-string',
      props: { labelStart: 'Leading' },
      children: (
        <span style={{ ...{ '--caption': String.raw`"\";display:none;"` }, color: 'black' }}>
          Trailing
        </span>
      ),
    },
    {
      id: 'css-nested',
      props: { labelStart: 'Leading' },
      children: (
        <span style={{ ...{ '--caption': '{[fn(;display:none;)]}' }, color: 'black' }}>
          Trailing
        </span>
      ),
    },
    {
      id: 'css-escaped-hidden',
      children: <span style={{ display: String.raw`n\6f ne` }}>Trailing</span>,
    },
    { id: 'css-vendor', children: <span style={{ display: '-webkit-box' }}>Trailing</span> },
    {
      id: 'idref-text',
      props: { labelStart: 'Leading' },
      children: <span aria-labelledby="react-external-name">Trailing</span>,
    },
    {
      id: 'role-text',
      props: { labelStart: 'Leading' },
      children: createElement('span', { role: 'none' }, 'Trailing'),
    },
    {
      id: 'svg-idref',
      props: { labelStart: 'Leading' },
      children: (
        <svg role="img" aria-labelledby="react-svg-name">
          <title id="react-svg-name">Network</title>
        </svg>
      ),
    },
    {
      id: 'svg-hidden-target',
      props: { labelStart: 'Leading' },
      children: createElement(
        'svg',
        { role: 'img', 'aria-labelledby': 'react-hidden-name' },
        createElement('title', { id: 'react-hidden-name', 'aria-hidden': 'true' }, 'Network'),
      ),
    },
    {
      id: 'svg-fragment',
      props: { labelStart: 'Leading' },
      children: createElement(
        'svg',
        { role: 'img', 'aria-labelledby': 'react-fragment-name' },
        <Fragment key="title">
          <title id="react-fragment-name">Network</title>
        </Fragment>,
      ),
    },
    { id: 'svg-dangling', children: <svg role="img" aria-labelledby="react-missing-name" /> },
    { id: 'svg-external', children: <svg role="img" aria-labelledby="react-external-name" /> },
    {
      id: 'svg-conflicting-title',
      props: { labelStart: 'Leading' },
      children: (
        <svg role="img" aria-labelledby="react-external-name">
          <title>Network</title>
        </svg>
      ),
    },
    {
      id: 'svg-cyclic',
      children: (
        <svg role="img" aria-labelledby="react-cycle-name">
          <title id="react-cycle-name" aria-labelledby="react-cycle-name">
            {' \t '}
          </title>
        </svg>
      ),
    },
    {
      id: 'svg-opaque',
      children: createElement(
        'svg',
        { role: 'img', 'aria-labelledby': 'react-opaque-name' },
        createElement('unknown-switch-label', { id: 'react-opaque-name' }),
      ),
    },
    {
      id: 'svg-blank',
      children: (
        <svg role="img" aria-labelledby="react-blank-name">
          <title id="react-blank-name">{' \t '}</title>
        </svg>
      ),
    },
    {
      id: 'svg-hidden-caption',
      children: (
        <svg style={{ display: 'none' }} role="img" aria-labelledby="react-hidden-caption-name">
          <title id="react-hidden-caption-name">Network</title>
        </svg>
      ),
    },
    { id: 'inline-hidden', children: <span style={{ display: 'none' }}>Trailing</span> },
    { id: 'opacity-caption', children: <span style={{ opacity: 0 }}>Trailing</span> },
    { id: 'opaque', children: <OpaqueLabel /> },
    { id: 'closed', children: createElement('closed-switch-caption') },
    {
      id: 'closed-named',
      children: createElement('closed-switch-caption', { 'aria-label': 'Public name' }),
    },
    { id: 'open', children: createElement('open-switch-caption') },
    { id: 'escaped', props: { labelStart: '<b>Left & right</b>' } },
    {
      id: 'form',
      props: { labelStart: 'Feature', name: 'feature', defaultChecked: true },
      children: 'Enabled',
    },
    {
      id: 'disabled',
      props: {
        labelStart: 'Disabled',
        name: 'disabled-feature',
        defaultChecked: true,
        disabled: true,
      },
      children: 'Feature',
    },
  ];
  return (
    <form id="react-switch-form" data-parent-renders={renderCount.current}>
      <span id="react-external-name" hidden>
        External
      </span>
      {variants.map(({ id, props, children }) => (
        <div className="row" data-testid={`react-${id}`} key={id}>
          <Switch type="neutral" size="m" aria-label="Wi-Fi" {...props}>
            {children}
          </Switch>
        </div>
      ))}
      <div className="row" data-testid="react-caption">
        <Switch type="neutral" aria-label="Wi-Fi">
          <Caption />
        </Switch>
      </div>
      <div className="row" data-testid="react-mutable">
        <Switch
          type="neutral"
          labelStart="Leading"
          hideLabelStart={hidden}
          hideLabelEnd={hidden}
          aria-label="Wi-Fi"
        >
          <span data-testid="react-mutable-wrapper">{label}</span>
        </Switch>
      </div>
      <button type="button" data-testid="react-empty-label" onClick={() => setLabel(false)}>
        Empty
      </button>
      <button type="button" data-testid="react-update-label" onClick={() => setLabel('Changed')}>
        Update
      </button>
      <button
        type="button"
        data-testid="react-hide-labels"
        onClick={() => setHidden((value) => !value)}
      >
        Visibility
      </button>
    </form>
  );
}
