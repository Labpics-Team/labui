import { html, renderToString, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/switch';
import { renderToString as renderReact } from 'react-dom/server';
import { ReactSwitchLabels } from './switch-labels-react';

export function renderSwitchLabelExamples(): string {
  const variants = [
    { id: 'both', labelStart: 'Left', content: 'Right' },
    { id: 'start', labelStart: 'Left', hideLabelEnd: true, content: 'Right' },
    { id: 'end', labelStart: 'Left', hideLabelStart: true, content: 'Right' },
    {
      id: 'neither',
      labelStart: 'Left',
      hideLabelStart: true,
      hideLabelEnd: true,
      content: 'Right',
    },
    { id: 'empty' },
    { id: 'empty-wrapper', content: '<span><em> \t </em></span>' },
    { id: 'whitespace', labelStart: ' \t ', content: ' \n ' },
    { id: 'icons', content: '<span slot="icon-on">Icon</span>' },
    { id: 'legacy', content: '<span>Legacy</span>' },
    { id: 'rich', content: '<span><strong>Legacy</strong> label</span>' },
    { id: 'image', content: '<span><img alt="Network" width="16" height="16"></span>' },
    {
      id: 'class-caption',
      labelStart: 'Leading',
      content: '<span class="caption">Trailing</span>',
    },
    {
      id: 'style-caption',
      labelStart: 'Leading',
      content: '<span style="color:currentColor">Trailing</span>',
    },
    { id: 'visibility', content: '<span data-caption>Trailing</span>' },
    {
      id: 'css-quoted',
      labelStart: 'Leading',
      content: `<span style='--caption:"; display:none;";color:black'>Trailing</span>`,
    },
    {
      id: 'css-font',
      labelStart: 'Leading',
      content: `<span style='font-family:"; visibility:hidden;"'>Trailing</span>`,
    },
    {
      id: 'css-comment',
      labelStart: 'Leading',
      content: '<span style="display:n/**/one">Trailing</span>',
    },
    {
      id: 'css-escaped-string',
      labelStart: 'Leading',
      content: String.raw`<span style='--caption:"\";display:none;";color:black'>Trailing</span>`,
    },
    {
      id: 'css-nested',
      labelStart: 'Leading',
      content: '<span style="--caption:{[fn(;display:none;)]};color:black">Trailing</span>',
    },
    {
      id: 'css-escaped-hidden',
      content: String.raw`<span style="display:n\6f ne">Trailing</span>`,
    },
    { id: 'css-vendor', content: '<span style="display:-webkit-box">Trailing</span>' },
    {
      id: 'idref-text',
      labelStart: 'Leading',
      content: '<span aria-labelledby="lit-external-name">Trailing</span>',
    },
    { id: 'role-text', labelStart: 'Leading', content: '<span role="none">Trailing</span>' },
    {
      id: 'svg-idref',
      labelStart: 'Leading',
      content:
        '<svg role="img" aria-labelledby="lit-svg-name"><title id="lit-svg-name">Network</title></svg>',
    },
    {
      id: 'svg-hidden-target',
      labelStart: 'Leading',
      content:
        '<svg role="img" aria-labelledby="lit-hidden-name"><title id="lit-hidden-name" aria-hidden="true">Network</title></svg>',
    },
    {
      id: 'svg-fragment',
      labelStart: 'Leading',
      content:
        '<svg role="img" aria-labelledby="lit-fragment-name"><title id="lit-fragment-name">Network</title></svg>',
    },
    { id: 'svg-dangling', content: '<svg role="img" aria-labelledby="lit-missing-name"></svg>' },
    { id: 'svg-external', content: '<svg role="img" aria-labelledby="lit-external-name"></svg>' },
    {
      id: 'svg-conflicting-title',
      labelStart: 'Leading',
      content: '<svg role="img" aria-labelledby="lit-external-name"><title>Network</title></svg>',
    },
    {
      id: 'svg-cyclic',
      content:
        '<svg role="img" aria-labelledby="lit-cycle-name"><title id="lit-cycle-name" aria-labelledby="lit-cycle-name"> \t </title></svg>',
    },
    {
      id: 'svg-opaque',
      content:
        '<svg role="img" aria-labelledby="lit-opaque-name"><unknown-switch-label id="lit-opaque-name"></unknown-switch-label></svg>',
    },
    {
      id: 'svg-blank',
      content:
        '<svg role="img" aria-labelledby="lit-blank-name"><title id="lit-blank-name"> \t </title></svg>',
    },
    {
      id: 'svg-hidden-caption',
      content:
        '<svg style="display:none" role="img" aria-labelledby="lit-hidden-caption-name"><title id="lit-hidden-caption-name">Network</title></svg>',
    },
    {
      id: 'inline-hidden',
      content: '<span style="display:none">Trailing</span>',
    },
    {
      id: 'opacity-caption',
      content: '<span style="opacity:0">Trailing</span>',
    },
    { id: 'unknown', content: '<unknown-switch-label></unknown-switch-label>' },
    { id: 'closed', content: '<closed-switch-caption></closed-switch-caption>' },
    {
      id: 'closed-named',
      content: '<closed-switch-caption aria-label="Public name"></closed-switch-caption>',
    },
    { id: 'open', content: '<open-switch-caption></open-switch-caption>' },
    { id: 'escaped', labelStart: '<b>Left & right</b>' },
    { id: 'mutable' },
    { id: 'mutable-wrapper', content: '<span data-wrapper> \t </span>' },
    { id: 'disabled', labelStart: 'Disabled', content: 'Feature', disabled: true },
  ];
  const core = variants
    .map((variant) => {
      const output = renderToString(html`<lab-switch type="neutral" size="m"
      label-start=${variant.labelStart ?? ''}
      .hideLabelStart=${variant.hideLabelStart ?? false}
      .hideLabelEnd=${variant.hideLabelEnd ?? false}
      .disabled=${variant.disabled ?? false}
      name=${`core-${variant.id}`} aria-label="Wi-Fi"
    >${unsafeHTML(variant.content ?? '')}</lab-switch>`);
      return `<div class="row" data-testid="lit-${variant.id}">${output}</div>`;
    })
    .join('\n');
  const projected =
    '<div class="row" data-testid="lit-projected"><switch-label-projection><span slot="caption" data-projected-caption> \t </span></switch-label-projection></div>';
  return `<span id="lit-external-name" hidden>External</span><section id="lit-labels">${core}${projected}</section><section id="react-labels">${renderReact(<ReactSwitchLabels />)}</section>`;
}
