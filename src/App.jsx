import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

// CONTEXT PROVIDERS
import { AdminAuthProvider } from './context/AdminAuthContext';
import { UserAuthProvider } from './context/UserAuthContext';

// Import General Pages & Components
import LandingPage from './pages/LandingPage';
import Footer from './components/Footer';
import UserProtectedRoute from './components/UserProtectedRoute'; // <-- IMPORT

// Import User-specific Pages
import UserLogin from './pages/Login'; // <-- RENAMED for clarity
import SignUp from './pages/SignUp';
import UserDashboard from './pages/Dashboard'; // <-- IMPORT

// Import Admin-specific Pages
import AdminLogin from './admin/Login'; // <-- RENAMED for clarity
import AdminDashboard from './admin/Dashboard';
import AdminProtectedRoute from './admin/ProtectedRoute';

function App() {
  return (
    <Router>
      <AdminAuthProvider>
        <UserAuthProvider> 
          <Routes>
            {/* --- Public Routes --- */}
            <Route path="/" element={<><LandingPage /><Footer /></>} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<UserLogin />} />

            {/* --- Protected User Routes --- */}
            <Route path="/dashboard" element={<UserProtectedRoute />}>
              <Route index element={<UserDashboard />} />
            </Route>

            {/* --- Admin Routes --- */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminProtectedRoute />}>
              <Route index element={<AdminDashboard />} />
            </Route>
            
            <Route path="*" element={<div>404: Page Not Found</div>} />
          </Routes>
          
          <Analytics />
        </UserAuthProvider>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;