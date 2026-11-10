import type { CardProps } from '@labpics/ui-react/card';

// Intrinsic 16:10, цветовые полосы различают cover и растяжение изображения.
export const cardImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><path fill="red" d="M0 0h100v250H0z"/><path fill="lime" d="M100 0h200v250H100z"/><path fill="blue" d="M300 0h100v250H300z"/></svg>',
)}`;

export interface CardSpec {
  id: string;
  width?: number;
  height?: number;
  props?: CardProps;
  header?: boolean;
  media?: boolean;
  body?: boolean;
  footer?: boolean;
}

const text = { heading: 'Заголовок', description: 'Описание карточки' };
const picture = { imageSrc: cardImage, imageAlt: 'Цветовые полосы' };
export const longHeading = 'Длинный заголовок сохраняется полностью для чтения';
export const longDescription =
  'Длинное описание карточки не теряет текст, даже когда строки ограничены. '.repeat(4);

export const cardSpecs: CardSpec[] = [
  { id: 'master', height: 294, props: { ...text, ...picture } },
  { id: 'tall', height: 400, props: { ...text, ...picture } },
  { id: 'intrinsic', props: { ...text, ...picture } },
  { id: 'empty' },
  { id: 'description', props: { description: text.description } },
  { id: 'caption', props: { caption: 'Подпись' } },
  { id: 'lower', props: { lowerCaption: 'Нижняя подпись' } },
  { id: 'caption-lower', props: { caption: 'Подпись', lowerCaption: 'Нижняя подпись' } },
  { id: 'hint', props: { titleHint: 'Hint' } },
  { id: 'badge', props: { badge: 'Badge' } },
  {
    id: 'wrap',
    width: 200,
    props: { heading: 'Заголовок', titleHint: 'Title Hint', badge: 'Badge' },
  },
  {
    id: 'all',
    props: {
      ...text,
      caption: 'Подпись',
      lowerCaption: 'Нижняя подпись',
      headingLevel: 4,
      titleHint: 'Hint',
      badge: 'Badge',
    },
    body: true,
    footer: true,
  },
  {
    id: 'override',
    props: {
      ...text,
      ...picture,
      caption: 'Скрытая подпись',
      lowerCaption: 'Скрытая нижняя подпись',
      titleHint: 'Hint',
      badge: 'Badge',
    },
    height: 294,
    header: true,
    media: true,
    body: true,
    footer: true,
  },
  { id: 'media', props: { ...text }, media: true },
  { id: 'media-whitespace', props: { ...text, media: ' \t\n\r ' } },
  { id: 'tight', height: 64, props: { ...text, ...picture }, footer: true },
  {
    id: 'long',
    width: 200,
    props: { heading: longHeading, description: longDescription, lowerCaption: longDescription },
  },
  ...(['none', 's', 'm', 'l'] as const).map((padding) => ({
    id: `padding-${padding}`,
    props: { ...text, padding },
  })),
];
