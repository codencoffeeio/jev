import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Jev Explainer',
  description: 'See TypeSafe AI\'s Jev evaluation model answer typed questions live.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
