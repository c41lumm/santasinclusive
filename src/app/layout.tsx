import type { Metadata } from 'next';
import { Atkinson_Hyperlegible, Fredoka } from 'next/font/google';
import './globals.css';

// Body text in Atkinson Hyperlegible, designed for readers with low vision; headings in Fredoka
const body = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const heading = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-fredoka' });

export const metadata: Metadata = {
  title: { default: "Santa's Inclusive Grotto, Leicester", template: "%s | Santa's Inclusive Grotto" },
  description: 'A calm Christmas grotto made only for children and adults with disabilities, and the families who love them. Free, in Leicester city centre.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${body.className} ${heading.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
