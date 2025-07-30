// src/context/UserAuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UserAuthContext = createContext(null);

export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const fakeUser = { name: 'Demo User', email };
    localStorage.setItem('userToken', 'dummy-token');
    localStorage.setItem('userData', JSON.stringify(fakeUser));
    setUser(fakeUser);
    setIsAuthenticated(true);
    navigate('/dashboard');
  };

  const signUp = async (name, email, password) => {
    const fakeUser = { name: name || 'New User', email };
    localStorage.setItem('userToken', 'dummy-token');
    localStorage.setItem('userData', JSON.stringify(fakeUser));
    setUser(fakeUser);
    setIsAuthenticated(true);
    navigate('/dashboard');
  };

  // 🔥 Renamed logout → logOut
  const logOut = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  return (
    <UserAuthContext.Provider value={{ user, isAuthenticated, loading, login, signUp, logOut }}>
      {!loading && children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
