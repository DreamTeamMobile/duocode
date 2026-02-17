import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import MessagesPanel from './Messages/MessagesPanel';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div id="app">
      <Header />
      <main>
        <div id="contentWrapper">
          <div id="mainLayout">
            {children}
            <Footer />
          </div>
          <MessagesPanel />
        </div>
      </main>
    </div>
  );
}
