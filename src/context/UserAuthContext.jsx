// src/context/UserAuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '../lib/authService';
import { setStoredUser, clearAuth, getToken } from '../lib/apiClient';

const UserAuthContext = createContext(null);

export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // On the server (prerender) there's no session to validate, so render children
  // immediately; on the client we still gate on the one-time session check.
  const [loading, setLoading] = useState(typeof window !== 'undefined');
  const navigate = useNavigate();
  const validatedRef = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; validate the session only once.
    if (validatedRef.current) return;
    validatedRef.current = true;

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
  // After auth, finish a pending plan upgrade (chosen on /plans before signing
  // up) by returning to /plans; otherwise go straight to the app.
  const postAuthDest = () =>
    sessionStorage.getItem('privoraa_intended_plan') ? '/plans' : '/app';

  const login = async (email, password) => {
    const u = await authService.login(email, password);
    setUser(u);
    setIsAuthenticated(true);
    navigate(postAuthDest());
  };

  const signUp = async (name, email, password) => {
    const u = await authService.register(name, email, password);
    setUser(u);
    setIsAuthenticated(true);
    navigate(postAuthDest());
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
