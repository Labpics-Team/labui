import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'proto-a-lit · Next 15 SSR',
  description: 'Lit Button server-rendered in Next 15 (criterion 1).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // data-theme drives the --lab-* set; the Button never reads it.
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
