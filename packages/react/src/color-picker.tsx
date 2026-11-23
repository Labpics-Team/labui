'use client';
import {
  type ColorPickerInput,
  type ColorPickerRuntime,
  ColorPickerState,
  type ColorPlane,
  type LabColorModel,
  type LabColorPickerVariant,
  type LabColorValue,
  channelGradient,
  clamp,
  colorChannelText,
  colorChannels,
  colorChevron,
  colorClose,
  colorComponent,
  colorCoords,
  colorCopy,
  colorCss,
  colorDisplay,
  colorEyedropper,
  colorPalette,
  colorPickerModels,
  colorPickerVariants,
  colorPlaneAxes,
  defaultColor,
  displayNumber,
  mountColorPicker,
  serializeColor,
} from '@labpics/ui-core/color-picker/runtime';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Icon } from './icon.js';
import { SegmentedControl } from './segmented-control.js';
import { Switch } from './switch.js';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/color-picker.css';
export type { LabColorValue, LabColorModel, LabColorPickerVariant };
export interface ColorPickerProps extends ColorPickerInput {
  label?: string;
  className?: string;
  onValueChange?: (value: LabColorValue | null) => void;
  onValueChangeEnd?: (value: LabColorValue | null) => void;
  onVariantChange?: (value: LabColorPickerVariant) => void;
  onModelChange?: (value: LabColorModel) => void;
  onClose?: () => void;
  pickScreenColor?: (signal: AbortSignal) => Promise<LabColorValue | null>;
}
const customStyle = (style: Record<string, string>): CSSProperties => style as CSSProperties;
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export function ColorPicker(props: ColorPickerProps): ReactNode {
  const [state] = useState(() => new ColorPickerState());
  const [, refresh] = useState(0);
  const latest = useRef(props);
  latest.current = props;
  const root = useRef<HTMLFieldSetElement>(null);
  const runtime = useRef<ColorPickerRuntime>();
  useClientLayoutEffect(() => {
    if (!root.current) return;
    runtime.current = mountColorPicker(root.current, state, () => ({
      ...latest.current,
      onValueChange: (value) => latest.current.onValueChange?.(value),
      onValueChangeEnd: (value) => latest.current.onValueChangeEnd?.(value),
      onUpdate: () => refresh((n) => n + 1),
    }));
    return () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    };
  }, [state]);
  useClientLayoutEffect(() => runtime.current?.update());
  const { model, variant } = state.view(props);
  const accepted = state.value(props);
  const value = accepted ?? defaultColor;
  const channels = colorChannels(value, model, variant, state.showRec2020);
  const rgb = colorCoords(value, 'srgb');
  const palette = colorPalette(model);
  const selected = palette.colors.findIndex((s) =>
    s.coords.every((c, i) => Math.abs(c - rgb[i as 0 | 1 | 2]) < 1e-7),
  );
  const blocked = props.disabled || props.readOnly;
  const plane = (kind: ColorPlane) => {
    const axes = colorPlaneAxes(value, kind, state.showRec2020);
    return (
      <fieldset
        className="lab-color-plane"
        data-plane={kind}
        aria-label={`${axes.xLabel} and ${axes.yLabel}`}
        style={customStyle({
          '--_color-x': `${clamp(axes.x / axes.xMax) * 100}%`,
          '--_color-y': `${clamp(axes.y / axes.yMax) * 100}%`,
        })}
      >
        {kind !== 'spectrum' && <canvas data-graph={kind} aria-hidden="true" tabIndex={-1} />}
        <span className="lab-color-marker" />
        <input
          className="lab-color-hidden"
          type="range"
          data-axis="x"
          aria-label={axes.xLabel}
          min={0}
          max={axes.xMax}
          step="any"
          defaultValue={axes.x}
          disabled={props.disabled}
          aria-readonly={props.readOnly || undefined}
        />
        <input
          className="lab-color-hidden"
          type="range"
          data-axis="y"
          aria-label={axes.yLabel}
          min={0}
          max={axes.yMax}
          step="any"
          defaultValue={axes.y}
          disabled={props.disabled}
          aria-readonly={props.readOnly || undefined}
        />
      </fieldset>
    );
  };
  const graphNames = ['h', 'l', 'c'] as const;
  return (
    <fieldset
      ref={root}
      data-lab-color-picker=""
      className={`lab-material lab-material--elevated ${props.className ?? ''}`}
      data-variant={variant}
      data-model={model}
      aria-label={props.label ?? 'Colors'}
      style={customStyle({
        '--_color-columns': String(palette.columns),
        '--_color-selected': colorCss(value),
        '--_color-hue': colorCss({
          space: 'hsv',
          coords: [colorCoords(value, 'hsv')[0], 100, 100],
          alpha: 1,
        }),
      })}
    >
      <header className="lab-color-header">
        <button
          className="lab-color-action"
          data-action="eyedropper"
          type="button"
          aria-label="Pick a color"
          disabled={blocked}
        >
          <Icon symbol={colorEyedropper} variant="filled" size={24} />
        </button>
        <span className="lab-color-heading">{props.label ?? 'Colors'}</span>
        <button
          className="lab-color-action"
          data-action="close"
          type="button"
          aria-label="Close color picker"
        >
          <Icon symbol={colorClose} size={24} />
        </button>
      </header>
      <SegmentedControl
        items={colorPickerVariants}
        value={variant}
        label="Color selection method"
        disabled={props.disabled}
        onValueChange={(value) => runtime.current?.setVariant(value as LabColorPickerVariant)}
      />
      {variant !== 'sliders' && (
        <div className="lab-color-view">
          {variant === 'spectrum' ? (
            model === 'lch' ? (
              <div className="lab-color-lch-spectrum">
                {plane('h')}
                {plane('l')}
              </div>
            ) : (
              plane('spectrum')
            )
          ) : (
            <div className="lab-color-grid" role="radiogroup" aria-label="Color palette">
              {palette.colors.map((swatch, index) => (
                <button
                  key={swatch.coords.join(':')}
                  type="button"
                  className="lab-color-swatch"
                  data-swatch={index}
                  role="radio"
                  aria-label={`Color ${index + 1}: ${colorDisplay(swatch, 'hex')}`}
                  aria-checked={index === selected}
                  tabIndex={index === Math.max(0, selected) ? 0 : -1}
                  disabled={blocked}
                  style={{ background: colorCss(swatch) }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="lab-color-channels">
        {channels.map((channel) => (
          <div className="lab-color-channel" key={channel.key}>
            <div>
              <span className="lab-color-channel-label">{channel.label}</span>
              {model === 'lch' &&
                variant === 'sliders' &&
                channel.index < 3 &&
                state.showGraphs &&
                plane(graphNames[channel.index as 0 | 1 | 2])}
              <div
                className="lab-color-channel-track"
                style={customStyle({
                  '--_color-gradient': channelGradient(
                    value,
                    channel,
                    state.showP3,
                    state.showRec2020,
                  ),
                  '--_color-fraction': String(clamp(channel.value / channel.max)),
                })}
              >
                <span className="lab-color-channel-paint" />
                <span className="lab-color-channel-thumb" />
                <input
                  className="lab-color-range"
                  type="range"
                  data-channel={channel.key}
                  aria-label={channel.label}
                  min={0}
                  max={channel.max}
                  step="any"
                  defaultValue={channel.value}
                  disabled={props.disabled}
                  aria-readonly={props.readOnly || undefined}
                />
              </div>
            </div>
            <input
              className="lab-color-number"
              data-channel={channel.key}
              aria-label={`${channel.label} value`}
              inputMode={channel.hexadecimal ? 'text' : 'decimal'}
              defaultValue={colorChannelText(channel)}
              disabled={props.disabled}
              readOnly={props.readOnly}
            />
          </div>
        ))}
      </div>
      <hr className="lab-color-separator" />
      <div className="lab-color-footer">
        <label className="lab-color-model">
          <Icon symbol={colorComponent} size={16} />
          <span className="lab-color-model-label">{model.toUpperCase()}</span>
          <Icon symbol={colorChevron} size={16} />
          <select
            data-model=""
            aria-label="Color model"
            value={model}
            disabled={props.disabled}
            onChange={(event) => runtime.current?.setModel(event.target.value as LabColorModel)}
          >
            {colorPickerModels.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {model === 'hex' || model === 'lch' ? (
          <div className="lab-color-text-field" key={model}>
            <span className="lab-color-dot" />
            <input
              data-color-text=""
              aria-label={`${model.toUpperCase()} color`}
              defaultValue={accepted ? colorDisplay(value, model) : ''}
              disabled={props.disabled}
              readOnly={props.readOnly}
            />
            <button
              className="lab-color-action"
              data-action="copy"
              type="button"
              aria-label="Copy color"
              disabled={!accepted}
            >
              <Icon symbol={colorCopy} size={20} />
            </button>
          </div>
        ) : (
          <div className="lab-color-coordinates" key={model}>
            {colorChannels(value, model, 'sliders', state.showRec2020)
              .slice(0, 3)
              .map((channel, index) => (
                <input
                  key={channel.key}
                  className="lab-color-coordinate"
                  data-coordinate={index + 1}
                  inputMode="decimal"
                  aria-label={`${model.toUpperCase()} ${channel.label}`}
                  defaultValue={displayNumber(channel.value)}
                  disabled={props.disabled}
                  readOnly={props.readOnly}
                />
              ))}
          </div>
        )}
      </div>
      {model === 'lch' && variant !== 'grid' && (
        <>
          <hr className="lab-color-separator" />
          <div className="lab-color-options">
            {(variant === 'sliders'
              ? (['showGraphs', 'showP3', 'showRec2020'] as const)
              : (['showP3', 'showRec2020'] as const)
            ).map((key) => (
              <Switch
                key={key}
                checked={state[key]}
                disabled={props.disabled}
                onCheckedChange={(checked) => runtime.current?.toggle(key, checked)}
              >
                {key === 'showGraphs'
                  ? 'Show graphs'
                  : key === 'showP3'
                    ? 'Show P3'
                    : 'Show Rec2020'}
              </Switch>
            ))}
          </div>
        </>
      )}
      <input
        data-form-value=""
        type="hidden"
        defaultValue={serializeColor(accepted)}
        name={props.name}
        form={props.form ?? undefined}
        disabled={props.disabled}
      />
      <input
        className="lab-color-hidden"
        data-validity=""
        aria-label="Selected color"
        tabIndex={-1}
        form={props.form ?? undefined}
        disabled={props.disabled}
        readOnly={props.readOnly}
      />
      <output className="lab-color-hidden">{state.status}</output>
    </fieldset>
  );
}
