import type { ReactNode } from 'react';
// The --lab-* contract stub + dimension tokens (same integration point the docs
// app uses) and the prototype theme sets + the Button styles. Imported in the
// root layout so SSR ships the CSS with the first paint (no FOUC).
import '../../../theme/contract-base.css';
import '../../../theme/light.css';
import '../../../theme/dark.css';
import '../../../src/button.css';

export const metadata = {
  title: 'proto-B Mitosis — Next 15 SSR fixture',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
