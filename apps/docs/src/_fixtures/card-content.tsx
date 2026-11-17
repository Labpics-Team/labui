import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/card';
import { Card } from '@labpics/ui-react/card';
import { createRoot } from 'react-dom/client';

const mount = document.getElementById('react-root');
const image = document.querySelector<HTMLImageElement>('img[slot="media"]');
if (!mount || !image) throw new Error('Missing Card content fixture');
createRoot(mount).render(
  <Card
    data-testid="react-media"
    heading="Media test"
    media={<img width={640} height={400} alt="Preview" src={image.src} />}
  />,
);
