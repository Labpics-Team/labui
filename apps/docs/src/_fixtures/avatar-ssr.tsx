import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/avatar';
import { Avatar, type AvatarProps } from '@labpics/ui-react/avatar';
import { hydrateRoot } from 'react-dom/client';

const root = document.querySelector('#react-ssr');
if (root) {
  const react = hydrateRoot(
    root,
    <Avatar data-testid="react-ssr-avatar" name="Даниил" initials="Д" src="/avatar-cache.svg" />,
  );
  Object.assign(window, {
    updateReactAvatar: (props: AvatarProps) =>
      react.render(<Avatar data-testid="react-ssr-avatar" {...props} />),
  });
}
Object.assign(window, { avatarHydrated: true });
