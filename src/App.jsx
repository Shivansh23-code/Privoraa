import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

// Public pages — kept eager so they prerender to static HTML (SEO / first paint).
import LandingPage from './pages/LandingPage';
import PlansPage from './pages/PlansPage';
import DownloadPage from './pages/DownloadPage';
import NotFound from './pages/NotFound';
import UserLogin from './pages/Login';
import SignUp from './pages/SignUp';
import UserProtectedRoute from './components/UserProtectedRoute';
import AdminProtectedRoute from './admin/ProtectedRoute';

// Heavy, auth-gated screens — lazy so the chat store (which touches localStorage
// at module load) and other browser-only deps never load during prerender.
const UserDashboard = lazy(() => import('./pages/Dashboard'));
const AdminLogin = lazy(() => import('./admin/Login'));
const AdminDashboard = lazy(() => import('./admin/Dashboard'));
const AdminPatternManager = lazy(() => import('./admin/AdminPatternManager'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-500" />
    </div>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>

      <Analytics />
    </>
  );
}

export default App;
