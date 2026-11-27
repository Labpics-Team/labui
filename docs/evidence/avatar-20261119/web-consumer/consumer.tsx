import type { LabAvatarSize } from '@labpics/ui-core/avatar/contract';
import { Avatar } from '@labpics/ui-react/avatar';
import '@labpics/ui-core/avatar';
import '@labpics/ui-core/avatar.css';
import '@labpics/fonts/fonts.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/tokens.css';
import '@labui/colors/contract.css';
import { avatarProfile } from '@labpics/ui-tokens';
import { createRoot } from 'react-dom/client';
const query = new URLSearchParams(location.search);
const colors = query.has('matrix') ? Object.keys(avatarProfile.colors) : ['blue'];
const sizes: LabAvatarSize[] = query.has('matrix') ? ['m', 'l'] : ['m'];
const count = Number(query.get('count') || 1);
const specimens = colors.flatMap((color) =>
  Array.from({ length: count }, (_, copy) => ({ color, id: `${color}-${copy}` })),
);
for (const size of sizes) {
  const section = document.createElement('section');
  section.innerHTML = `<h2>${size === 'm' ? '32' : '48'} px — Lit / React</h2><div class="row lit"></div><div class="row react"></div>`;
  document.body.append(section);
  for (const color of colors)
    for (let i = 0; i < count; i++) {
      const el = document.createElement('lab-avatar');
      Object.assign(el, { name: color, size, color, fallback: 'texture', status: 'online' });
      section.querySelector('.lit')?.append(el);
    }
  const react = section.querySelector('.react');
  if (!react) throw new Error('Missing React root');
  createRoot(react).render(
    specimens.map(({ color, id }) => (
      <Avatar
        key={id}
        color={color as keyof typeof avatarProfile.colors}
        size={size}
        name={color}
        fallback="texture"
        status="online"
      />
    )),
  );
}
