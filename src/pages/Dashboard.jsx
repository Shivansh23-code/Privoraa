import React from 'react';
import ChatWorkspace from '../features/chat/ChatWorkspace';
import { VaultProvider } from '../context/VaultContext';

// The user dashboard is the full Vedix chat workspace. The sealed vault lives
// here (not app-wide) so its browser-only crypto/IndexedDB never loads during
// the public-page prerender.
export default function Dashboard() {
  return (
    <VaultProvider>
      <ChatWorkspace />
    </VaultProvider>
  );
}
