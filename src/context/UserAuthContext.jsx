// src/context/UserAuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '../lib/authService';
import { setStoredUser, clearAuth, getToken } from '../lib/apiClient';

const UserAuthContext = createContext(null);

export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    const userData = localStorage.getItem('userData');
    if (token && userData) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
      // Best-effort: refresh the user from the backend if it's live. If the
      // stored token turned out to be invalid (cleared by fetchMe), log out.
      authService.fetchMe().then((fresh) => {
        if (fresh) setUser(fresh);
        else if (!getToken()) {
          setUser(null);
          setIsAuthenticated(false);
        }
      });
    }
    setLoading(false);
  }, []);

  // login/signUp throw on real auth failures (the pages catch + show the error).
  const login = async (email, password) => {
    const u = await authService.login(email, password);
    setUser(u);
    setIsAuthenticated(true);
    navigate('/app');
  };

  const signUp = async (name, email, password) => {
    const u = await authService.register(name, email, password);
    setUser(u);
    setIsAuthenticated(true);
    navigate('/app');
  };

  const updateProfile = (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      setStoredUser(next);
      return next;
    });
  };

  const logOut = () => {
    authService.logout();
    clearAuth();
    setUser(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  return (
    <UserAuthContext.Provider
      value={{ user, isAuthenticated, loading, login, signUp, logOut, updateProfile }}
    >
      {!loading && children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
