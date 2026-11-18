import '@labpics/fonts/fonts.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/tokens.css';
import '@labui/colors/contract.css';
import '@labpics/ui-core/avatar';
import { Avatar } from '@labpics/ui-react/avatar';
import type { AvatarProps } from '@labpics/ui-react/avatar';
import { avatarProfile } from '@labpics/ui-tokens';
import { createRoot } from 'react-dom/client';

document.head.insertAdjacentHTML(
  'beforeend',
  '<style>body{margin:0;padding:32px;background:var(--lab-bg-primary);color:var(--lab-label-primary);font-family:Geist,sans-serif}section{margin-bottom:24px}.row{display:flex;align-items:center;gap:16px;padding:12px 0}h2{font-size:14px;font-weight:500}</style>',
);
const mount = document.querySelector('#specimens');
if (!mount) throw new Error('Missing Avatar specimens');
for (const size of ['s', 'm', 'l'] as const) {
  const section = document.createElement('section');
  section.innerHTML = `<h2>${size} — Lit / React</h2><div class="row lit"></div><div class="row react"></div>`;
  mount.append(section);
  for (const color of Object.keys(avatarProfile.colors)) {
    const avatar = document.createElement('lab-avatar');
    avatar.setAttribute('name', 'Даниил');
    avatar.setAttribute('color', color);
    avatar.setAttribute('size', size);
    avatar.setAttribute('initials', 'Д');
    avatar.setAttribute('status', 'online');
    avatar.dataset.testid = `lit-${size}-${color}`;
    section.querySelector('.lit')?.append(avatar);
  }
  const react = section.querySelector('.react');
  if (react)
    createRoot(react).render(
      Object.keys(avatarProfile.colors).map((color) => (
        <Avatar
          key={color}
          data-testid={`react-${size}-${color}`}
          color={color as keyof typeof avatarProfile.colors}
          name="Даниил"
          initials="Д"
          status="online"
          size={size}
        />
      )),
    );
}

const stateRow = document.createElement('section');
stateRow.className = 'row';
stateRow.innerHTML =
  '<lab-avatar data-testid="lit-state" name="Даниил"></lab-avatar><div id="react-state"></div>';
mount.append(stateRow);
const litState = stateRow.querySelector('lab-avatar');
const reactState = stateRow.querySelector('#react-state');
if (!litState || !reactState) throw new Error('Missing state fixtures');
const reactRoot = createRoot(reactState);
const setAvatar = (props: AvatarProps) => {
  const values = {
    size: 'm',
    color: 'blue',
    name: 'Даниил',
    src: undefined,
    initials: undefined,
    fallback: 'initials',
    decorative: false,
    status: 'none',
    statusLabel: '',
    ...props,
  };
  Object.assign(litState, values);
  reactRoot.render(<Avatar data-testid="react-state" {...(values as AvatarProps)} />);
};
setAvatar({});
Object.assign(window, { setAvatar });
