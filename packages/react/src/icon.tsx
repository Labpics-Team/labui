'use client';
import {
  type IconController,
  type IconHandle,
  type IconOptions,
  createIconController,
  iconMarkup,
  resolveTypographySize,
} from '@labpics/ui-core/icon/runtime';
import {
  type HTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
export type {
  IconHandle,
  IconSymbol,
  IconVariant,
  IconEffectOptions,
  SymbolPlayback,
  TypographyScale,
  TypographySize,
} from '@labpics/ui-core/icon/runtime';
export interface IconProps extends IconOptions, Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Omit for decorative icons; label the action on the containing button. */
  label?: string;
}
export const Icon = forwardRef<IconHandle, IconProps>(function Icon(
  {
    symbol,
    variant,
    size = 24,
    scale,
    weight = 400,
    opsz = 'auto',
    state,
    date,
    timeZone,
    duration = 180,
    reducedMotion = false,
    effect,
    effectKey,
    label,
    style,
    ...rest
  },
  ref,
) {
  const options: IconOptions = {
    symbol,
    variant,
    size,
    scale,
    weight,
    opsz,
    state,
    date,
    timeZone,
    duration,
    reducedMotion,
    effect,
    effectKey,
  };
  const root = useRef<HTMLSpanElement>(null);
  const controller = useRef<IconController>();
  const latest = useRef(options);
  latest.current = options;
  const [firstMarkup] = useState(() => iconMarkup(options));
  useEffect(() => {
    if (!root.current) return;
    controller.current = createIconController(root.current, latest.current);
    return () => {
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, []);
  useEffect(() => {
    controller.current?.update(options);
  });
  useImperativeHandle(
    ref,
    () => ({
      playEffect: (name, request) =>
        controller.current?.playEffect(name, request) ?? Promise.resolve(null),
    }),
    [],
  );
  const resolved = resolveTypographySize(size, scale).css;
  return (
    <span
      {...rest}
      ref={root}
      data-lab-icon=""
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{
        ...style,
        display: 'inline-flex',
        flexShrink: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
        width: resolved,
        height: resolved,
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: pure renderIcon output from imported trusted artwork; the controller owns later SVG writes.
      dangerouslySetInnerHTML={{ __html: firstMarkup }}
    />
  );
});
