import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, signUp as apiSignUp, getUserProfile } from '../api/userApi';

// Create the context
const UserAuthContext = createContext(null);

// Create the Provider component
export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // To handle initial page load
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      getUserProfile()
        .then(response => {
          setUser(response.data);
          setIsAuthenticated(true);
        })
        .catch(() => {
          localStorage.removeItem('userToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiLogin({ email, password });
      localStorage.setItem('userToken', response.data.token);
      setUser(response.data.user); // Assuming the backend sends user info
      setIsAuthenticated(true);
      navigate('/dashboard'); // Redirect to user dashboard after login
    } catch (error) {
      console.error('Login failed:', error);
      // You can add logic here to show an error message to the user
      throw error;
    }
  };

  const signUp = async (name, email, password) => {
    try {
      const response = await apiSignUp({ name, email, password });
      // Automatically log the user in after successful sign-up
      localStorage.setItem('userToken', response.data.token);
      setUser(response.data.user);
      setIsAuthenticated(true);
      navigate('/dashboard'); // Redirect to dashboard after sign-up
    } catch (error) {
      console.error('Sign-up failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('userToken');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/'); // Redirect to homepage after logout
  };

  // The value provided to consuming components
  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    signUp,
    logout,
  };

  return (
    <UserAuthContext.Provider value={value}>
      {!loading && children}
    </UserAuthContext.Provider>
  );
};

// Custom hook to easily use the context
export const useUserAuth = () => {
  return useContext(UserAuthContext);
};