import '@labpics/ui-core/avatar';
import { Avatar } from '@labpics/ui-react/avatar';
import { avatarProfile } from '@labpics/ui-tokens';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
const colors = Object.keys(avatarProfile.colors) as (keyof typeof avatarProfile.colors)[];
const fallbacks = ['initials', 'texture'] as const;
const lit = document.querySelector('#lit-root');
const react = document.querySelector('#react-root');
if (!lit || !react) throw new Error('Missing Avatar demo roots');
for (const fallback of fallbacks) {
  const row = document.createElement('div');
  row.className = 'specimens';
  row.style.marginBlock = '16px';
  for (const color of colors) {
    const avatar = document.createElement('lab-avatar');
    avatar.name = 'Даниил';
    avatar.initials = 'Д';
    avatar.color = color;
    avatar.fallback = fallback;
    avatar.status = 'online';
    row.append(avatar);
  }
  lit.append(row);
}
createRoot(react).render(
  fallbacks.map((fallback) => (
    <div className="specimens" style={{ marginBlock: 16 }} key={fallback}>
      {colors.map((color) => (
        <Avatar
          key={color}
          name="Даниил"
          initials="Д"
          color={color}
          fallback={fallback}
          status="online"
        />
      ))}
    </div>
  )),
);
