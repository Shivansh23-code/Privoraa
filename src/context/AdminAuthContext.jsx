// src/admin/context/AdminAuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Render children during prerender (no localStorage on the server); the client
  // still gates on its one-time token check.
  const [loading, setLoading] = useState(typeof window !== 'undefined');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (email) => {
    // Frontend-only dummy login
    console.log(`Pretending to login as admin: ${email}`);
    localStorage.setItem('adminToken', 'dummy-admin-token');
    setIsAuthenticated(true);
    navigate('/admin/dashboard');
  };

  const logout = () => {
    // Frontend-only dummy logout
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    navigate('/admin/login');
  };

  const value = { isAuthenticated, login, logout, loading };

  return (
    <AdminAuthContext.Provider value={value}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
