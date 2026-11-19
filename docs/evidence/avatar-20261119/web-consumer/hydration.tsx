import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/avatar';
import { Avatar, type AvatarProps } from '@labpics/ui-react/avatar';
import { hydrateRoot } from 'react-dom/client';

const state = window as unknown as {
  avatarSsrProps: AvatarProps;
  avatarHydrated: boolean;
  updateReactAvatar: (props: AvatarProps) => void;
};
const root = document.querySelector('#react-ssr');
if (!root) throw new Error('Missing React SSR root');
const react = hydrateRoot(root, <Avatar {...state.avatarSsrProps} />);
state.updateReactAvatar = (props) => react.render(<Avatar {...props} />);
state.avatarHydrated = true;
