import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Navigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isAuthenticated } = useAdminAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mock credentials (you can change this)
    const mockAdmin = {
      email: 'admin@privoraa.com',
      password: 'admin123'
    };

    if (email === mockAdmin.email && password === mockAdmin.password) {
      login(email); // store login in context/localStorage
    } else {
      setError('Invalid credentials');
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" />;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;
