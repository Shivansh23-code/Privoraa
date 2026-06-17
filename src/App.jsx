import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

// Public pages
import LandingPage from './pages/LandingPage';
import PlansPage from './pages/PlansPage';
import DownloadPage from './pages/DownloadPage';
import NotFound from './pages/NotFound';

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
        <Route path="/" element={<LandingPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/pricing" element={<Navigate to="/plans" replace />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/offline" element={<Navigate to="/download" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/register" element={<SignUp />} />
        <Route path="/login" element={<UserLogin />} />

        {/* 🔒 User Protected Routes */}
        <Route element={<UserProtectedRoute />}>
          <Route path="/app" element={<UserDashboard />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        </Route>

        {/* 🔒 Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/patterns" element={<AdminPatternManager />} />
        </Route>

        {/* ❌ 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Analytics />
    </>
  );
}

export default App;
