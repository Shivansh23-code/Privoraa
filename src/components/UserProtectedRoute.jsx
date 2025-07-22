import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';

function UserProtectedRoute() {
  const { isAuthenticated } = useUserAuth();

  // If the user is authenticated, render the child route (Outlet).
  // Otherwise, redirect them to the login page.
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
}

export default UserProtectedRoute;