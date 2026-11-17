import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/button';
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';
import { Button } from '@labpics/ui-react/button';
import { Card } from '@labpics/ui-react/card';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import image from './assets/card-source.png';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
const source = document.querySelector<LabCard>('[data-testid="lit-source"]');
if (source) source.image = image;
const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing Card root');
createRoot(mount).render(
  <StrictMode>
    <Card data-testid="react-source" image={image} heading="Title" description="Description" />
    <Card
      data-testid="react-elevated"
      heading="Рабочее пространство"
      description="Проекты и материалы команды"
      footer={
        <Button size="s" data-testid="react-interactive-control">
          Открыть пространство
        </Button>
      }
    />
    <Card
      data-testid="react-outlined"
      variant="outlined"
      heading="Оформление"
      description="Тема и контраст"
    />
    <Card
      data-testid="react-filled"
      variant="filled"
      heading="Общее"
      description="Материалы команды"
    />
  </StrictMode>,
);
