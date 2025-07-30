import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

// Public pages and layout
import LandingPage from './pages/LandingPage';
import Footer from './components/Footer';

// User-side
import UserLogin from './pages/Login';
import SignUp from './pages/SignUp';
import UserDashboard from './pages/Dashboard';
import UserProtectedRoute from './components/UserProtectedRoute';

// Admin-side
import AdminLogin from './admin/Login';
import AdminDashboard from './admin/Dashboard';
import AdminPatternManager from './admin/AdminPatternManager';
import AdminProtectedRoute from './admin/ProtectedRoute';

function App() {
  return (
    <>
      <Routes>
        {/* 🌐 Public Routes */}
        <Route path="/" element={<><LandingPage /><Footer /></>} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<UserLogin />} />

        {/* 🔒 User Protected Routes */}
        <Route element={<UserProtectedRoute />}>
          <Route path="/dashboard" element={<UserDashboard />} />
        </Route>

        {/* 🔒 Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/patterns" element={<AdminPatternManager />} />
        </Route>

        {/* ❌ 404 Not Found */}
        <Route path="*" element={
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>404: Page Not Found</h1>
          </div>
        } />
      </Routes>

      <Analytics />
    </>
  );
}

export default App;
