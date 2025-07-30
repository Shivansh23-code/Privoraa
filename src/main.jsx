import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Import all your context providers
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { UserAuthProvider } from './context/UserAuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* The Router wraps everything */}
    <Router>
      <ThemeProvider>
        <AdminAuthProvider>
          <UserAuthProvider>
            <App />
          </UserAuthProvider>
        </AdminAuthProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
);