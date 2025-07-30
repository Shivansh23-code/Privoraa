import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

function ProtectedRoute() {
  const { isAuthenticated } = useAdminAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to="/admin/login" />;
}

export default ProtectedRoute;
