// Server entry for build-time prerendering. Renders the app for a given URL to
// an HTML string using StaticRouter, mirroring main.jsx's provider tree. Only the
// public routes are prerendered (heavy routes are lazy and never rendered here).
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { UserAuthProvider } from './context/UserAuthContext.jsx';

export function render(url) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });
  return renderToString(
    <StaticRouter location={url}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AdminAuthProvider>
            <UserAuthProvider>
              <App />
            </UserAuthProvider>
          </AdminAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StaticRouter>
  );
}
