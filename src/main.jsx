import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';

// Import all your context providers
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { UserAuthProvider } from './context/UserAuthContext.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* The Router wraps everything */}
    <Router>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AdminAuthProvider>
            <UserAuthProvider>
              <App />
            </UserAuthProvider>
          </AdminAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  </React.StrictMode>
);