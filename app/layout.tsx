import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientAppShell from './components/ClientAppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agentur OS',
  description: 'A Software that helps with project organisation in agencies.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientAppShell>
          {children}
        </ClientAppShell>
      </body>
    </html>
  );
}
